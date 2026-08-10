// 욕설·비속어 걸러내기. 순수 함수.
//
// 한계를 먼저 밝힌다: 이건 완벽한 차단이 아니다. 자음 분리(ㅅㅂ), 사이 문자 삽입
// (시1발), 초성만 쓰기 같은 흔한 우회는 잡지만, 마음먹고 비트는 표현은 못 잡는다.
// 프런트엔드에서만 도는 검사라 브라우저 콘솔로 우회할 수도 있다.
// 목적은 "실수로 튀어나온 말"과 "장난 삼은 도배"를 줄이는 것이다.

const WORDS = [
  '시발', '씨발', '씨팔', '시팔', '싀발', '쒸발', '씹',
  '병신', '븅신', '빙신',
  '지랄', '개새끼', '새끼', '개년', '년놈',
  '좆', '좇', '자지', '보지',
  '미친놈', '미친년', '또라이', '돌아이',
  '엠창', '느금', '니미', '애미', '애비',
  '뒤져', '꺼져', '죽어라',
  'fuck', 'shit', 'bitch', 'asshole', 'dick',
];

// 초성만 쓴 형태
const CHOSUNG = ['ㅅㅂ', 'ㅄ', 'ㅂㅅ', 'ㅈㄹ', 'ㄲㅈ', 'ㅗ'];

// 흔한 치환: 숫자·기호로 눈속임한 것을 되돌린다
const SUBS = [
  [/[1lI|]/g, 'ㅣ'],
  [/[0oO]/g, 'ㅇ'],
  [/[@]/g, 'ㅇ'],
];

/** 검사용으로 문자열을 평평하게 만든다. 공백·기호·반복을 걷어낸다. */
export function normalize(text) {
  let s = (text || '').toLowerCase();
  for (const [re, to] of SUBS) s = s.replace(re, to);
  s = s.replace(/[\s.,!?~\-_*^'"()[\]{}<>/\\]/g, '');
  s = s.replace(/(.)\1{2,}/g, '$1$1'); // ㅋㅋㅋㅋ → ㅋㅋ
  return s;
}

/**
 * @returns {string[]} 걸린 단어 목록. 비어 있으면 통과.
 */
export function findProfanity(text) {
  const flat = normalize(text);
  // 글자 사이에 숫자·기호를 낀 형태(시1발)도 잡으려면 한글/영문만 남긴 형태도 본다.
  const bare = (text || '').toLowerCase().replace(/[^가-힣a-z]/g, '');
  const raw = (text || '').toLowerCase();
  const hits = [];

  for (const w of WORDS) {
    if (flat.includes(w) || bare.includes(w)) hits.push(w);
  }
  for (const c of CHOSUNG) {
    if (raw.replace(/\s/g, '').includes(c)) hits.push(c);
  }
  return [...new Set(hits)];
}

export function isClean(text) {
  return findProfanity(text).length === 0;
}
