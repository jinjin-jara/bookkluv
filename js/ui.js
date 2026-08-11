// 여러 페이지가 함께 쓰는 자잘한 것들.

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function dayOf(date) {
  return DAY_NAMES[new Date(date + 'T00:00:00').getDay()];
}

/** 2026-02-03 → 2026년 2월 3일 화요모임 */
export function formatMeetingDate(date) {
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${dayOf(date)}요모임`;
}

/** 2026-02-03 → 2월 3일 */
export function formatShort(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 사용자가 넣은 값은 전부 이걸 통과시킨다. */
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const supportsViewTransition = 'startViewTransition' in document;

/** 링크를 누르면 본문이 살짝 사라졌다가 다음 화면으로 넘어간다. */
function setupLinkFade() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || link.target || e.metaKey || e.ctrlKey || e.shiftKey) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.hash && url.pathname === location.pathname) return;

    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = link.href; }, 90);
  });
}

/**
 * 자리 표시가 깜빡이고 마는 걸 막는다.
 * 응답이 빠르면 스켈레톤이 보이자마자 사라져 오히려 어수선하다.
 */
export function atLeast(promise, ms = 520) {
  return Promise.all([promise, new Promise((r) => setTimeout(r, ms))]).then(([v]) => v);
}

const SCROLL_KEY = 'bookkluv:scroll';

/** 떠나기 직전 스크롤 위치를 적어 둔다. 돌아오면 그 자리로 되돌린다. */
function setupScrollMemory() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const here = location.pathname + location.search;
  const save = () => {
    try {
      const all = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}');
      all[here] = window.scrollY;
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(all));
    } catch (err) { /* 저장 못 해도 화면은 멀쩡하다 */ }
  };

  window.addEventListener('pagehide', save);
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[href]')) save();
  }, true);
}

/**
 * 목록을 다 그린 뒤에 부른다.
 *
 * 뒤로 가기로 돌아왔을 때만 보던 자리로 되돌린다. 탭을 눌러 새 화면으로
 * 옮겼을 때까지 자리를 물려주면, 엉뚱하게 중간부터 보여서 어리둥절해진다.
 */
export function restoreScroll() {
  const nav = performance.getEntriesByType('navigation')[0];
  const wentBack = nav && nav.type === 'back_forward';

  if (!wentBack) {
    window.scrollTo(0, 0);
    return;
  }

  try {
    const all = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}');
    const y = all[location.pathname + location.search];
    if (typeof y === 'number' && y > 0) {
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  } catch (err) { /* 무시 */ }
}

/** 방금 그린 내용이 아래에서 올라오게 한다. */
export function rise(el, stagger = false) {
  if (!el) return;
  el.classList.remove('has-state');
  el.classList.remove('rise', 'stagger');
  void el.offsetWidth;           // 다시 재생시키려면 한 번 끊어줘야 한다
  el.classList.add(stagger ? 'stagger' : 'rise');
}

/**
 * 헤더·탭바·푸터는 HTML에 직접 들어 있다. 자바스크립트로 그리면 문서가 뜬 뒤에야
 * 나타나서 깜빡인다. 여기서는 동작만 붙인다.
 */
export function setupNav() {
  setupLinkFade();
  setupScrollMemory();

  // 새 화면은 늘 맨 위에서 시작한다. 뒤로 가기는 restoreScroll이 따로 챙긴다.
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav || nav.type !== 'back_forward') window.scrollTo(0, 0);
}

export function showError(el, message, retry) {
  el.classList.add('has-state');
  el.innerHTML = `
    <div class="state">
      <img src="assets/mascot.png" alt="">
      <p>${esc(message)}</p>
      ${retry ? '<button type="button" class="state-retry">다시 시도</button>' : ''}
    </div>`;
  if (retry) el.querySelector('.state-retry').addEventListener('click', retry);
}

export function showEmpty(el, message) {
  el.classList.add('has-state');
  el.innerHTML = `
    <div class="state">
      <img src="assets/mascot.png" alt="">
      <p>${esc(message)}</p>
    </div>`;
}

/**
 * 책장 모양 자리 표시. 실제 책장과 같은 틀 안에 책등만 회색으로 세운다.
 * 실물과 모양이 다르면 자리 표시가 사라질 때 화면이 크게 튄다.
 */
export function skeletonShelf(el) {
  el.classList.remove('has-state');
  const sizes = [
    [52, 196], [38, 158], [45, 212], [34, 168], [58, 184], [41, 150],
    [48, 224], [36, 176], [54, 162], [40, 200], [33, 154], [50, 188],
  ];
  const books = sizes
    .map(([w, h]) => `<span class="sk sk-book" style="width:${w}px;height:${h}px"></span>`)
    .join('');
  el.innerHTML = `
    <div class="bookcase">
      <section class="shelf-year">
        <span class="year-label sk-year"></span>
        <div class="shelf-books">${books}</div>
      </section>
    </div>`;
}

/** 포스트잇 자리 */
export function skeletonNotes(el) {
  el.classList.remove('has-state');
  el.innerHTML = `
    <div class="sk sk-line" style="width:180px"></div>
    <div class="sk sk-head"></div>
    <div class="notes">
      ${'<div class="sk sk-note"></div>'.repeat(3)}
    </div>`;
}

/** 추천 카드 자리 */
export function skeletonCards(el) {
  el.classList.remove('has-state');
  el.innerHTML = '<div class="sk sk-card"></div>'.repeat(6);
}

export function showLoading(el, message = '불러오는 중이에요') {
  el.classList.add('has-state');
  el.innerHTML = `<div class="state is-loading"><p>${esc(message)}</p></div>`;
}
