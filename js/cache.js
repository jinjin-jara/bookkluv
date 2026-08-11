// 목록을 브라우저에 저장해 두고 다음 방문 때 먼저 보여준다.
//
// 회차는 두 주에 한 번 늘어난다. 그래서 "저장해 둔 걸 즉시 그리고, 뒤에서 새로
// 받아 달라졌을 때만 다시 그린다". 기다리는 시간이 사라지고, 새 회차도 놓치지
// 않는다. 저장은 localStorage에 하고, 실패해도 화면은 멀쩡히 돌아간다.

const PREFIX = 'bookkluv:cache:';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 이보다 오래된 것은 버린다

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > MAX_AGE) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch (err) {
    // 저장 공간이 없으면 그냥 넘어간다
  }
}

/**
 * 저장해 둔 값을 먼저 돌려주고, 새 값이 오면 알려준다.
 *
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 * @param {(fresh: any) => void} onFresh  내용이 달라졌을 때만 불린다
 * @returns {{ cached: any, fresh: Promise<any> }}
 */
export function swr(key, fetcher, onFresh) {
  const cached = readCache(key);

  const fresh = fetcher()
    .then((data) => {
      const changed = JSON.stringify(data) !== JSON.stringify(cached);
      writeCache(key, data);
      if (changed) onFresh(data);
      return data;
    })
    .catch((err) => {
      // 저장해 둔 게 있으면 그걸로 버틴다
      if (cached) return cached;
      throw err;
    });

  return { cached, fresh };
}
