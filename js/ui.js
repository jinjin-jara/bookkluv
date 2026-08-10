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

export function siteHead(title = '북끄럽', subtitle = '독서모임 아카이브') {
  return `
    <a class="site-head" href="index.html">
      <img src="assets/mascot.png" alt="">
      <div>
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle)}</p>
      </div>
    </a>`;
}

// 선으로만 그린 아이콘. 굵기와 끝맺음을 맞춰 한 벌로 보이게 한다.
const NAV = [
  {
    href: 'index.html',
    label: '책장',
    icon: `<rect x="4" y="6" width="4" height="11" rx="0.8"/>
           <rect x="10" y="4" width="4" height="13" rx="0.8"/>
           <path d="M16.4 5.6l3.1.9-2.6 10.2-3.1-.9z"/>
           <path d="M3 19.5h18"/>`,
  },
  {
    href: 'calendar.html',
    label: '달력',
    icon: `<rect x="3.5" y="5.5" width="17" height="15" rx="2.2"/>
           <path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>
           <circle cx="8.5" cy="14" r="1.1" fill="currentColor" stroke="none"/>
           <circle cx="15.5" cy="17" r="1.1" fill="currentColor" stroke="none"/>`,
  },
  {
    href: 'picks.html',
    label: '추천',
    icon: `<path d="M6.5 3.5h11a1 1 0 011 1v15.2a.6.6 0 01-.93.5L12 16.6l-5.57 3.6a.6.6 0 01-.93-.5V4.5a1 1 0 011-1z"/>
           <path d="M9.4 8.6l2.6 2.6 2.6-3.6"/>`,
  },
  {
    href: 'admin.html',
    label: '등록',
    icon: `<path d="M4 20.2l.9-3.6L15.3 6.2a1.6 1.6 0 012.3 0l1.1 1.1a1.6 1.6 0 010 2.3L8.3 19.9z"/>
           <path d="M14.2 7.4l2.9 2.9M4.9 16.6l2.9 2.9"/>`,
  },
];

/** 앱처럼 화면 아래 붙는 탭바. 현재 페이지가 켜진다. */
export function bottomNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  return `
    <nav class="tabbar" aria-label="주요 화면">
      ${NAV.map(
        (item) => `
        <a href="${item.href}" class="tab${item.href === here ? ' is-on' : ''}">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
          <span>${item.label}</span>
        </a>`
      ).join('')}
    </nav>`;
}

export const supportsViewTransition = 'startViewTransition' in document;

/**
 * View Transitions를 못 쓰는 브라우저에서, 링크를 누르면 살짝 사라졌다가 넘어간다.
 * 쓸 수 있는 브라우저는 브라우저가 알아서 하니 건드리지 않는다.
 */
function setupLinkFade() {
  if (supportsViewTransition) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || link.target || e.metaKey || e.ctrlKey || e.shiftKey) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.hash && url.pathname === location.pathname) return; // 같은 페이지 앵커

    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = link.href; }, 130);
  });
}

/** 방금 그린 내용이 아래에서 올라오게 한다. */
export function rise(el, stagger = false) {
  if (!el) return;
  el.classList.remove('rise', 'stagger');
  void el.offsetWidth;           // 다시 재생시키려면 한 번 끊어줘야 한다
  el.classList.add(stagger ? 'stagger' : 'rise');
}

export function siteFooter() {
  return `
    <footer class="site-foot">
      <p class="foot-made">
        만든 사람 ·
        <a href="https://github.com/jinjin-jara/bookkluv" target="_blank" rel="noopener noreferrer">JinKyung Choi</a>
      </p>
      <p class="foot-links">
        <a href="https://www.instagram.com/bookk_luv/" target="_blank" rel="noopener noreferrer">북끄럽 인스타그램</a>
      </p>
    </footer>`;
}

/** 페이지마다 한 번 부르면 푸터와 탭바가 붙는다. */
export function mountNav() {
  document.querySelector('.wrap')?.insertAdjacentHTML('beforeend', siteFooter());
  document.body.insertAdjacentHTML('beforeend', bottomNav());
  setupLinkFade();
}

export function showError(el, message, retry) {
  el.innerHTML = `
    <div class="state">
      <img src="assets/mascot.png" alt="">
      <p>${esc(message)}</p>
      ${retry ? '<button type="button" class="state-retry">다시 시도</button>' : ''}
    </div>`;
  if (retry) el.querySelector('.state-retry').addEventListener('click', retry);
}

export function showEmpty(el, message) {
  el.innerHTML = `
    <div class="state">
      <img src="assets/mascot.png" alt="">
      <p>${esc(message)}</p>
    </div>`;
}

/** 책장 모양 스켈레톤. 빈 화면 대신 들어갈 자리를 미리 보여준다. */
export function skeletonShelf(el) {
  const widths = [34, 52, 28, 61, 40, 47, 33, 56, 44, 30, 50, 38, 58, 42];
  const books = widths.map((w) => {
    const h = 130 + ((w * 7) % 60);
    return `<span class="sk-book" style="width:${w}px;height:${h}px"></span>`;
  }).join('');
  el.innerHTML = `
    <section class="year-block">
      <div class="sk sk-title"></div>
      <div class="bookcase">${books}</div>
    </section>`;
}

/** 포스트잇 자리 */
export function skeletonNotes(el) {
  el.innerHTML = `
    <div class="sk sk-line" style="width:180px"></div>
    <div class="sk sk-head"></div>
    <div class="notes">
      ${'<div class="sk sk-note"></div>'.repeat(3)}
    </div>`;
}

/** 추천 카드 자리 */
export function skeletonCards(el) {
  el.innerHTML = '<div class="sk sk-card"></div>'.repeat(6);
}

export function showLoading(el, message = '불러오는 중이에요') {
  el.innerHTML = `<div class="state is-loading"><p>${esc(message)}</p></div>`;
}
