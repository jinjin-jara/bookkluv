// 닉네임과 익명 ID. localStorage에만 산다.
//
// anon_id는 "이 브라우저가 쓴 댓글"을 표시하기 위한 것이지 신원 증명이 아니다.
// 지우거나 바꾸면 예전 댓글은 남의 것으로 보인다. 그게 정상 동작이다.

const NICK_KEY = 'bookkluv:nickname';
const ANON_KEY = 'bookkluv:anon-id';

export function getNickname() {
  return localStorage.getItem(NICK_KEY) || '';
}

export function setNickname(name) {
  const clean = (name || '').trim().slice(0, 20);
  if (clean) localStorage.setItem(NICK_KEY, clean);
  return clean;
}

export function getAnonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

/** 이 브라우저가 쓴 댓글이고, 아직 수정할 수 있는 시간인가. */
export const EDIT_WINDOW_MS = 30 * 60 * 1000;

export function isMine(comment) {
  return !!comment && comment.anon_id === getAnonId();
}

export function isEditable(comment) {
  if (!isMine(comment)) return false;
  return Date.now() - new Date(comment.created_at).getTime() < EDIT_WINDOW_MS;
}
