// 책등 치수·색 계산. 순수 함수.

export const SPINE = {
  minPages: 100,
  maxPages: 800,
  minWidth: 22,
  maxWidth: 68,
  defaultWidth: 45,
  baseHeight: 168,
  heightJitter: 0.08,
};

export const PALETTE = [
  '#f2d9a0', '#e8a7a7', '#a8cfe0', '#bfe0a8', '#f0c2e0',
  '#f5e6a8', '#c9b8e8', '#f7b489', '#9fd8c8', '#e5cdb0',
  '#d9e8a0', '#f0a8b8',
];

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 쪽수 → 책등 폭(px). 없거나 이상하면 기본 두께. */
export function spineWidth(pages) {
  const n = Number(pages);
  if (!Number.isFinite(n) || n <= 0) return SPINE.defaultWidth;
  const clamped = Math.min(Math.max(n, SPINE.minPages), SPINE.maxPages);
  const ratio = (clamped - SPINE.minPages) / (SPINE.maxPages - SPINE.minPages);
  return Math.round(SPINE.minWidth + ratio * (SPINE.maxWidth - SPINE.minWidth));
}

/** 제목 해시로 높이를 ±8% 흔든다. 같은 제목은 항상 같은 높이. */
export function spineHeight(title, base = SPINE.baseHeight) {
  const t = (hashString(title || '') % 1000) / 1000; // 0~1
  const factor = 1 + (t * 2 - 1) * SPINE.heightJitter;
  return Math.round(base * factor);
}

/** spine_color가 있으면 그것, 없으면 제목 해시로 팔레트에서 고른다. */
export function spineColor(meeting) {
  if (meeting && meeting.spine_color) return meeting.spine_color;
  const title = (meeting && meeting.title) || '';
  return PALETTE[hashString(title) % PALETTE.length];
}

export const SPINE_TEXT = {
  min: 11,      // px
  max: 18,
  wrapMax: 13,  // 줄바꿈되는 긴 제목은 이 크기 이하로
  padding: 20,  // 책등 위아래 여백
  perChar: 1.3, // 글자 하나가 먹는 세로 높이 배수 (줄간 + 자간)
  colGap: 1.18, // 한 열이 먹는 가로 폭 배수
};

/**
 * 책등에 들어갈 글자 크기와 열 수를 정한다.
 * 큰 크기부터 내려가며, 그 크기로 필요한 열 수가 책등 폭에 들어가는 첫 값을 쓴다.
 * 짧은 제목은 크게, 긴 제목은 줄바꿈해서 두 줄로.
 */
export function spineFontSize(title, boxHeight, boxWidth, scale = 1) {
  const chars = (title || '').replace(/\s/g, '').length || 1;
  const usable = boxHeight - SPINE_TEXT.padding;
  const inner = boxWidth - 6;

  // 책장이 줄면 글자 하한도 같이 줄어야 책등 밖으로 넘치지 않는다.
  const min = Math.max(7, Math.round(SPINE_TEXT.min * scale));
  const max = Math.max(min, Math.round(SPINE_TEXT.max * scale));
  const wrapMax = Math.max(min, Math.round(SPINE_TEXT.wrapMax * scale));

  const cols = (fs) => Math.ceil((chars * fs * SPINE_TEXT.perChar) / usable);
  const fits = (fs) => Math.floor(inner / (fs * SPINE_TEXT.colGap)) >= cols(fs);

  // 한 줄로 들어가면 그 크기를 쓴다.
  for (let fs = max; fs >= min; fs--) {
    if (cols(fs) === 1 && fits(fs)) return fs;
  }
  // 줄바꿈이 필요하면 한 단계 작은 크기부터 찾는다.
  for (let fs = wrapMax; fs >= min; fs--) {
    if (fits(fs)) return fs;
  }
  return min;
}

/**
 * 세로쓰기에서 영문·숫자 토막을 한 칸에 눕혀 넣는다(縦中横).
 * "82년생 김지영"의 82가 한 글자 자리를 차지한다.
 * 한 글자짜리(아Q정전의 Q)는 세워두는 편이 낫다. 겹쳐 보인다.
 */
export function spineMarkup(title) {
  // 한 번에 훑는다. 두 번 치환하면 앞서 넣은 태그 속 공백까지 바꿔 HTML이 깨진다.
  return (title || '').replace(/[A-Za-z0-9]{2,3}| /g, (m) =>
    m === ' '
      ? '<span class="sp"> </span>'   // 세로쓰기 공백은 한 글자 높이를 먹는다. 좁게.
      : `<span class="tcy">${m}</span>`
  );
}

/** 회차 목록을 연도별로 묶는다. 최신 연도가 먼저, 연도 안에서도 최신이 먼저. */
export function groupByYear(meetings) {
  const map = new Map();
  for (const m of meetings) {
    const year = String(m.date).slice(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year).push(m);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    }));
}
