// 추천 링크 다루기. 순수 함수.

/**
 * 유튜브 주소에서 영상 ID를 뽑는다.
 * youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID 를 받는다.
 */
export function youtubeId(url) {
  if (!url) return null;
  let u;
  try {
    u = new URL(url);
  } catch (err) {
    return null;
  }

  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return clean(u.pathname.slice(1));
  if (!host.endsWith('youtube.com')) return null;

  const v = u.searchParams.get('v');
  if (v) return clean(v);

  const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
  return m ? clean(m[2]) : null;
}

function clean(id) {
  return /^[\w-]{6,20}$/.test(id) ? id : null;
}

/** 유튜브 썸네일 주소. 키가 필요 없다. */
export function youtubeThumb(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * 유튜브가 공개한 oEmbed로 제목과 채널명을 가져온다. 키가 필요 없다.
 * 실패하면 null. 손으로 적으면 되니 등록을 막지 않는다.
 */
export async function fetchYoutubeInfo(url) {
  const id = youtubeId(url);
  if (!id) return null;

  const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://youtu.be/${id}`)}&format=json`;
  try {
    const res = await fetch(api);
    if (!res.ok) return null;
    const json = await res.json();
    return { title: json.title || '', creator: json.author_name || '' };
  } catch (err) {
    return null;
  }
}
