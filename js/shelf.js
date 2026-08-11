// 책등 치수·색 계산. 순수 함수.

export const SPINE = {
  minPages: 100,
  maxPages: 800,
  minWidth: 34,
  maxWidth: 74,
  defaultWidth: 45,
  baseHeight: 172,
  maxHeight: 252,   // 칸 높이에서 연도 표시 자리를 뺀 값   // 선반 한 칸에서 간판·여백을 뺀 높이
  minHeight: 126,
  heightJitter: 0.17,   // 책마다 키가 제법 달라야 책장처럼 보인다
};

// 무지개 순서를 따르되 채도를 낮춘다. 서재 삽화에서 뽑아낸 색들이다.
export const PALETTE = [
  '#c9502a', // 벽돌
  '#d96a2f', // 주황
  '#e08b34', // 살구
  '#d9a52f', // 호박
  '#c2a52c', // 겨자
  '#a3a63e', // 올리브
  '#7fa04a', // 연두
  '#4f9160', // 초록
  '#2f8a74', // 청록
  '#4d94a3', // 물빛
  '#5b7fae', // 하늘
  '#4a63a0', // 파랑
  '#5f5f9c', // 남색
  '#8a6099', // 보라
  '#a8628f', // 자주
  '#c07289', // 장미
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

/**
 * 제목 해시로 키를 흔든다. 같은 책은 언제나 같은 키다.
 * 해시를 두 번 섞어 값이 가운데로 몰리지 않게 한다.
 */
export function spineHeight(title, base = SPINE.baseHeight) {
  const h = hashString(title || '');
  const t = (((h % 977) / 977) + ((h >>> 11) % 613) / 613) / 2; // 0~1
  const spread = (t * 2 - 1) * SPINE.heightJitter;
  return Math.round(base * (1 + spread));
}

/**
 * 꽂힌 자리 순서대로 무지개 색을 돌린다.
 *
 * 해시로 뽑으면 색이 뒤죽박죽 섞인다. 순서대로 돌리면 책장 전체가 무지개로
 * 흐른다. 대신 새 책이 앞에 꽂히면 뒤의 색이 한 칸씩 밀린다.
 */
export function spineColor(meeting, index = 0, total = 0) {
  if (meeting && meeting.spine_color) return meeting.spine_color;

  // 책이 적으면 팔레트 앞쪽 색만 쓰여 한 계열로 몰린다. 전체에 고르게 편다.
  const n = Math.max(1, total || PALETTE.length);
  const pos = n >= PALETTE.length
    ? index
    : Math.round((index * PALETTE.length) / n);
  return PALETTE[((pos % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

export const SPINE_TEXT = {
  min: 9,       // px
  max: 22,
  maxSmall: 14,   // 좁은 화면에서는 가장 큰 글자도 이보다 크지 않다
  wrapMax: 16,  // 두 줄로 접을 때 쓰는 글자 크기 상한
  wrapPad: 8,   // 두 줄일 때 좌우로 더 비워두는 폭
  padding: 34,  // 책등 위아래 여백. CSS의 .book/.spine-text 여백 합과 맞춘다
  perChar: 1.3, // 글자 하나가 먹는 세로 높이 배수 (줄간 + 자간)
  colGap: 1.18, // 한 열이 먹는 가로 폭 배수
  oneLineMax: 14, // 되도록 한 줄로 세운다. 이보다 긴 제목만 두 줄로 접는다
  sidePad: 0.08,  // 책등 좌우 여백. 폭에 비례한다(얇은 책은 여백도 얇아야 한다)
  sidePadMax: 6,
  widthRatio: 0.46, // 글자 크기는 책등 폭의 이 비율을 넘지 않는다
};

/**
 * 책등에 들어갈 글자 크기와 열 수를 정한다.
 * 큰 크기부터 내려가며, 그 크기로 필요한 열 수가 책등 폭에 들어가는 첫 값을 쓴다.
 * 짧은 제목은 크게, 긴 제목은 줄바꿈해서 두 줄로.
 */
export function spineFontSize(title, boxHeight, boxWidth, scale = 1) {
  const chars = (title || '').replace(/\s/g, '').length || 1;
  const usable = boxHeight - SPINE_TEXT.padding;
  const inner = boxWidth - Math.min(SPINE_TEXT.sidePadMax, Math.round(boxWidth * SPINE_TEXT.sidePad)) * 2;

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
 * 책등 하나의 치수를 한 번에 정한다.
 *
 * 제목이 길면 글자를 줄이는 대신 책을 키운다. 두 줄로 접히는 것보다 키가 다른
 * 책들이 섞여 있는 편이 책장답고 읽기도 쉽다. 그래도 안 들어가면 그때 접는다.
 */
export function spineLayout(meeting, scale = 1) {
  const title = (meeting && meeting.title) || '';
  // 띄어쓰기도 자리를 조금 차지한다. CSS에서 정한 공백 폭과 같은 비율로 센다.
  const spaces = (title.match(/\s/g) || []).length;
  const chars = (title.replace(/\s/g, '').length || 1) + spaces * 0.42;

  const width = Math.max(20, Math.round(spineWidth(meeting && meeting.pages) * scale));
  const base = spineHeight(title);

  const minFs = Math.max(7, Math.round(SPINE_TEXT.min * scale));
  // 폭에 비해 글자가 크면 좌우가 답답하다. 책등 폭에 상한을 건다.
  // 좁은 화면에서는 가장 큰 글자를 한 번 더 낮춘다.
  const byWidth = Math.floor(width * SPINE_TEXT.widthRatio);
  const cap = scale < 1 ? SPINE_TEXT.maxSmall : SPINE_TEXT.max;
  const maxFs = Math.max(minFs, Math.min(cap, byWidth));
  const maxH = Math.round(SPINE.maxHeight * scale);
  const minH = Math.round(SPINE.minHeight * scale);

  // 좌우로 숨 쉴 자리를 남긴다. 다만 얇은 책에서 여백이 글자보다 크면 안 된다.
  const pad = Math.min(SPINE_TEXT.sidePadMax, Math.round(width * SPINE_TEXT.sidePad));
  const inner = width - pad * 2;
  const colsFit = (fs) => Math.floor(inner / (fs * SPINE_TEXT.colGap));
  // 두 열이 되면 글자 덩어리가 넓어진다. 그만큼 여백을 더 잡아둔다.
  const colsFitWrapped = (fs) =>
    Math.floor((inner - SPINE_TEXT.wrapPad) / (fs * SPINE_TEXT.colGap));

  // 아주 긴 제목은 책만 커지고 글자는 잘아진다. 그럴 바에는 두 줄로 접는다.
  const preferWrap = chars > SPINE_TEXT.oneLineMax;

  // 한 줄로 담기는 가장 큰 글자를 찾되, 필요하면 책을 키운다.
  for (let fs = preferWrap ? -1 : maxFs; fs >= minFs; fs--) {
    const need = Math.ceil(chars * fs * SPINE_TEXT.perChar) + SPINE_TEXT.padding;
    if (need <= maxH && colsFit(fs) >= 1) {
      const height = Math.min(maxH, Math.max(minH, Math.round(base * scale), need));
      return { width, height, fontSize: fs };
    }
  }

  // 두 줄로 접어 본다. 폭이 좁으면 열이 안 들어가므로 확인이 필요하다.
  const height = maxH;
  for (let fs = SPINE_TEXT.wrapMax; fs >= minFs; fs--) {
    const cols = Math.ceil((chars * fs * SPINE_TEXT.perChar) / (height - SPINE_TEXT.padding));
    // 접기로 정한 제목이 한 열로 떨어지면 글자만 작아진다. 두 열 이상일 때만 쓴다.
    if (preferWrap && cols < 2) continue;
    const fits = cols >= 2 ? colsFitWrapped(fs) >= cols : colsFit(fs) >= cols;
    if (fits) return { width, height, fontSize: fs };
  }

  // 얇은 책은 두 줄도 못 넣는다. 한 줄로 되돌리고 글자를 줄인다.
  for (let fs = SPINE_TEXT.wrapMax; fs >= minFs; fs--) {
    if (colsFit(fs) >= 1) return { width, height, fontSize: fs };
  }
  return { width, height, fontSize: minFs };
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
