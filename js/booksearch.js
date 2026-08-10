// Google Books 조회. 등록 화면에서만 쓴다.
//
// 키가 없어도 쓸 수 있지만 IP 단위 쿼터를 공유해서 가끔 429가 난다.
// 실패해도 등록을 막지 않는다 — 손으로 채우면 된다.

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

/**
 * @returns {Promise<Array<{title, author, pages, publisher}>>}
 * @throws 검색 자체가 실패했을 때만 (호출부에서 잡아 안내한다)
 */
export async function searchBooks(query) {
  const q = (query || '').trim();
  if (!q) return [];

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&maxResults=6&printType=books&langRestrict=ko`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`책 검색 실패 (${res.status})`);

  const json = await res.json();
  return (json.items || []).map((item) => {
    const v = item.volumeInfo || {};
    return {
      title: v.title || '',
      author: (v.authors || []).join(', '),
      pages: Number.isFinite(v.pageCount) ? v.pageCount : null,
      publisher: v.publisher || '',
    };
  });
}
