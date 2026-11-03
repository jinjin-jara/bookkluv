// PWA 설치 안내 + 서비스워커 등록.
//
// 첫 방문 직후에는 띄우지 않는다. 두 번째 방문이거나, 한 세션에서 충분히
// 둘러본 뒤에만 한 번 알린다.

const DISMISS_KEY = 'bookkluv:install-dismissed';
const VISITS_KEY = 'bookkluv:visits';
const SHOWN_KEY = 'bookkluv:install-shown';   // sessionStorage: 같은 세션에서 한 번만
const COUNTED_KEY = 'bookkluv:counted';
const DISMISS_DAYS = 14;
const BROWSE_MS = 25000;                      // 첫 방문이면 이만큼 둘러본 뒤에
const REVISIT_MS = 4000;

let deferredPrompt = null;
let scheduled = false;

const store = {
  get: (k, area = localStorage) => { try { return area.getItem(k); } catch (e) { return null; } },
  set: (k, v, area = localStorage) => { try { area.setItem(k, v); } catch (e) { /* 무시 */ } },
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function dismissedRecently() {
  const at = Number(store.get(DISMISS_KEY) || 0);
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/** 방문 횟수는 세션마다 한 번만 센다. 화면을 옮겨 다녀도 늘지 않는다. */
function countVisit() {
  if (store.get(COUNTED_KEY, sessionStorage)) return Number(store.get(VISITS_KEY) || 1);
  const n = Number(store.get(VISITS_KEY) || 0) + 1;
  store.set(VISITS_KEY, String(n));
  store.set(COUNTED_KEY, '1', sessionStorage);
  return n;
}

let opener = null;
let onKey = null;

function close(remember) {
  if (remember) store.set(DISMISS_KEY, String(Date.now()));
  if (onKey) document.removeEventListener('keydown', onKey, true);
  document.getElementById('install-modal')?.remove();
  document.body.style.overflow = '';
  if (opener && document.contains(opener)) opener.focus();
  opener = null;
}

function modalHTML(mode) {
  const guide =
    mode === 'ios'
      ? `<ol class="install-steps">
           <li>브라우저의 <b>공유 버튼</b>을 누르고</li>
           <li><b>홈 화면에 추가</b>를 고르면 끝이에요</li>
         </ol>`
      : `<p class="install-desc">홈 화면에 추가하면 앱처럼 바로 열려요.</p>`;

  const action =
    mode === 'ios'
      ? `<button type="button" class="install-btn" data-act="close">알겠어요</button>`
      : `<button type="button" class="install-btn ghost" data-act="later">나중에</button>
         <button type="button" class="install-btn" data-act="install">홈 화면에 추가</button>`;

  return `
    <div class="install-backdrop" id="install-modal">
      <div class="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <img src="assets/mascot.png" alt="" class="install-mascot">
        <h2 class="install-title" id="install-title">북끄럽을 홈 화면에<br>추가해 보세요</h2>
        ${guide}
        <div class="install-actions">${action}</div>
      </div>
    </div>`;
}

function showModal(mode) {
  if (document.getElementById('install-modal')) return;
  if (store.get(SHOWN_KEY, sessionStorage)) return;
  // 다른 창을 보고 있는 중이면 방해하지 않는다
  if (document.querySelector('.note-backdrop, .picker-backdrop')) return;
  store.set(SHOWN_KEY, '1', sessionStorage);

  opener = document.activeElement;
  document.body.insertAdjacentHTML('beforeend', modalHTML(mode));
  document.body.style.overflow = 'hidden';
  const root = document.getElementById('install-modal');
  const card = root.querySelector('.install-card');
  const buttons = () => [...card.querySelectorAll('button')];

  // Esc·바깥 누르기는 "나중에"와 같다. 한동안 다시 묻지 않는다.
  onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key !== 'Tab') return;
    const f = buttons();
    const first = f[0];
    const last = f[f.length - 1];
    if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);

  root.addEventListener('click', async (e) => {
    const act = e.target.dataset?.act;
    if (e.target === root || act === 'close' || act === 'later') return close(true);
    if (act !== 'install') return;

    const ev = deferredPrompt;
    deferredPrompt = null;
    close(false);
    if (!ev) return;
    ev.prompt();
    try {
      const { outcome } = await ev.userChoice;
      if (outcome === 'dismissed') store.set(DISMISS_KEY, String(Date.now()));
    } catch (err) { /* 무시 */ }
  });

  (card.querySelector('[data-act="later"], [data-act="close"]') || buttons()[0]).focus();
}

const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);

export function setupInstall() {
  // 로컬에서는 예전에 등록된 워커가 낡은 파일을 물고 있을 수 있다. 지운다.
  if (DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  if (isStandalone()) return;

  const visits = countVisit();
  if (dismissedRecently() || store.get(SHOWN_KEY, sessionStorage)) return;

  const delay = visits >= 2 ? REVISIT_MS : BROWSE_MS;

  // 설치 가능한 브라우저는 이벤트가 온 경우에만, iOS는 방법 안내만 띄운다.
  // 둘 다 아니면(데스크톱 사파리·파이어폭스 등) 아무것도 띄우지 않는다.
  const maybe = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      if (deferredPrompt) showModal('prompt');
      else if (isIOS()) showModal('ios');
    }, delay);
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    maybe();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; close(false); });

  if (isIOS()) maybe();
}
