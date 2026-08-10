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

const NAV = [
  {
    href: 'index.html',
    label: '책장',
    icon: '<path d="M4 4h3v16H4zM9.5 4h3v16h-3zM15.2 4.4l2.9.8-4.2 15.4-2.9-.8z"/>',
  },
  {
    href: 'picks.html',
    label: '추천',
    icon: '<path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>',
  },
  {
    href: 'admin.html',
    label: '등록',
    icon: '<path d="M11 5h2v14h-2z"/><path d="M5 11h14v2H5z"/>',
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
          <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
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
      <p class="foot-made">만든 사람 · JinKyung Choi</p>
      <p class="foot-links">
        <a href="https://www.instagram.com/bookk_luv/" target="_blank" rel="noopener noreferrer">인스타그램</a>
        <a href="https://github.com/jinjin-jara" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://github.com/jinjin-jara/bookkluv" target="_blank" rel="noopener noreferrer">소스</a>
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

export function showLoading(el, message = '불러오는 중이에요') {
  el.innerHTML = `<div class="state is-loading"><p>${esc(message)}</p></div>`;
}
