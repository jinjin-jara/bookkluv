// 책 정보 조회. 등록 화면에서만 쓴다.
//
// 국립중앙도서관 ISBN 서지정보(seoji)를 먼저 본다. 국내 출간서는 여기가 가장
// 정확하고, 표지·쪽수·출판사를 한 번에 준다. CORS가 열려 있어 서버 없이 부른다.
// 키가 없거나 결과가 없으면 Google Books로 넘어간다.

import { NL_KEY } from './config.js';

const SEOJI = 'https://seoji.nl.go.kr/landingPage/SearchApi.do';
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';

/** "지은이: 최찬혁", "글: A ;그림: B" 같은 표기에서 이름만 추린다. */
function parseAuthor(text) {
  return String(text || '')
    .split(/[;·]/)
    .map((part) => part.replace(/^[^:]*:\s*/, '').trim())
    .filter(Boolean)
    .join(', ');
}

/** "352 p." / "352p" / "1책(352 p.)" 같은 표기에서 숫자만 뽑는다. */
function parsePages(text) {
  const m = String(text || '').match(/(\d{2,4})\s*(?:p|쪽|페이지)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function searchSeoji(query) {
  if (!NL_KEY) return [];

  const url = `${SEOJI}?cert_key=${encodeURIComponent(NL_KEY)}&result_style=json&page_no=1&page_size=8&title=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`서지정보 조회 실패 (${res.status})`);

  const json = await res.json();
  if (json.RESULT === 'ERROR') throw new Error(json.ERR_MESSAGE || '서지정보 조회 실패');

  return (json.docs || []).map((d) => ({
    title: (d.TITLE || '').trim(),
    author: parseAuthor(d.AUTHOR),
    pages: parsePages(d.PAGE),
    publisher: (d.PUBLISHER || '').trim(),
    cover: (d.TITLE_URL || '').trim() || null,
    source: '국립중앙도서관',
  }));
}

async function searchGoogle(query) {
  const url = `${GOOGLE}?q=${encodeURIComponent(query)}&maxResults=6&printType=books&langRestrict=ko`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`책 검색 실패 (${res.status})`);

  const json = await res.json();
  return (json.items || []).map((item) => {
    const v = item.volumeInfo || {};
    const thumb = (v.imageLinks || {}).thumbnail || null;
    return {
      title: v.title || '',
      author: (v.authors || []).join(', '),
      pages: Number.isFinite(v.pageCount) ? v.pageCount : null,
      publisher: v.publisher || '',
      cover: thumb ? thumb.replace(/^http:/, 'https:') : null,
      source: 'Google Books',
    };
  });
}

/**
 * @returns {Promise<Array<{title, author, pages, publisher, cover, source}>>}
 * @throws 두 곳 모두 실패했을 때만
 */
/** 제목을 비교하기 좋게 다듬는다. */
const flat = (t) => String(t || '').toLowerCase().replace(/[\s(),.·:'"\[\]]/g, '');

/**
 * 찾는 제목과 얼마나 가까운지 점수를 매긴다. 높을수록 위로 올린다.
 *
 * 도서관 검색은 "파친코"를 넣으면 《파친코와 정동의 미디어》 같은 책도 같이 준다.
 * 사람이 찾는 건 대개 제목이 그대로거나 거의 같은 책이다.
 */
function score(book, query) {
  const q = flat(query);
  const t = flat(book.title);
  if (!t) return -1;

  let s = 0;
  if (t === q) s += 100;                       // 제목이 똑같다
  else if (t.startsWith(q)) s += 60;           // 제목이 찾는 말로 시작한다
  else if (t.includes(q)) s += 25;             // 어딘가에 들어 있다
  else return -1;                              // 아니면 후보에서 뺀다

  // 군더더기가 적을수록 위로. "파친코" < "파친코와 정동의 미디어"
  s -= Math.min(30, Math.max(0, t.length - q.length) * 1.5);

  // 정보가 갖춰진 쪽이 쓸모 있다
  if (book.pages) s += 12;
  if (book.author) s += 6;
  if (book.publisher) s += 3;

  // 낱권 표시가 붙은 것은 살짝 뒤로 (파친코 2)
  if (/\d+$/.test(book.title.trim())) s -= 8;

  return s;
}

export async function searchBooks(query) {
  const q = (query || '').trim();
  if (!q) return [];

  // 국립중앙도서관은 국내서 서지가 정확하지만 쪽수가 자주 비어 있다.
  // 구글은 반대로 쪽수를 가진 경우가 많다. 둘을 같이 물어보고 채워 넣는다.
  const [seoji, google] = await Promise.all([
    searchSeoji(q).catch(() => []),
    searchGoogle(q).catch(() => []),
  ]);

  if (!seoji.length) return rank(google, q);

  const merged = seoji.map((book) => {
    if (book.pages) return book;
    const key = flat(book.title);
    const hit = google.find((g) => {
      const gk = flat(g.title);
      return g.pages && (gk === key || gk.startsWith(key) || key.startsWith(gk));
    });
    return hit ? { ...book, pages: hit.pages } : book;
  });

  // 도서관 결과에 없던 책이 구글에만 있을 수 있다. 제목이 똑같은 것만 더한다.
  const seen = new Set(merged.map((b) => flat(b.title)));
  const extra = google.filter((g) => flat(g.title) === flat(q) && !seen.has(flat(g.title)));

  return rank([...merged, ...extra], q);
}

/** 관련도가 높은 것부터. 너무 동떨어진 것은 버린다. */
function rank(list, query) {
  return list
    .map((book) => ({ book, s: score(book, query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.book);
}
