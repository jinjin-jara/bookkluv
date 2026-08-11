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
const flat = (t) => String(t || '').toLowerCase().replace(/[\s(),.·:'"]/g, '');

export async function searchBooks(query) {
  const q = (query || '').trim();
  if (!q) return [];

  // 국립중앙도서관은 국내서 서지가 정확하지만 쪽수가 자주 비어 있다.
  // 구글은 반대로 쪽수를 가진 경우가 많다. 둘을 같이 물어보고 채워 넣는다.
  const [seoji, google] = await Promise.all([
    searchSeoji(q).catch(() => []),
    searchGoogle(q).catch(() => []),
  ]);

  if (!seoji.length) return google;

  return seoji.map((book) => {
    if (book.pages) return book;
    const key = flat(book.title);
    const hit = google.find((g) => {
      const gk = flat(g.title);
      return g.pages && (gk === key || gk.startsWith(key) || key.startsWith(gk));
    });
    return hit ? { ...book, pages: hit.pages } : book;
  });
}
