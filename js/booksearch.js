// 책 정보 조회. 등록 화면에서만 쓴다.
//
// 국립중앙도서관 ISBN 서지정보(seoji)를 먼저 본다. 국내 출간서는 여기가 가장
// 정확하고, 표지·쪽수·출판사를 한 번에 준다. CORS가 열려 있어 서버 없이 부른다.
// 키가 없거나 결과가 없으면 Google Books로 넘어간다.

import { NL_KEY } from './config.js';

const SEOJI = 'https://seoji.nl.go.kr/landingPage/SearchApi.do';
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';

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
    author: (d.AUTHOR || '').trim(),
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
export async function searchBooks(query) {
  const q = (query || '').trim();
  if (!q) return [];

  try {
    const found = await searchSeoji(q);
    if (found.length) return found;
  } catch (err) {
    // 국립중앙도서관이 막히면 구글로 넘어간다
  }

  return searchGoogle(q);
}
