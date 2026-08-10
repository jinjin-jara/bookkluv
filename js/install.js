// PWA 설치 안내 모달 + 서비스워커 등록.

const DISMISS_KEY = 'bookkluv:install-dismissed';
const DISMISS_DAYS = 14;

let deferredPrompt = null;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function dismissedRecently() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  document.getElementById('install-modal')?.remove();
}

function modalHTML(mode) {
  const guide =
    mode === 'ios'
      ? `<ol class="install-steps">
           <li>아래 <b>공유 버튼</b>을 누르고</li>
           <li><b>홈 화면에 추가</b>를 고르면 끝이에요</li>
         </ol>`
      : `<p class="install-desc">홈 화면에 추가하면 앱처럼 바로 열려요.</p>`;

  const action =
    mode === 'ios'
      ? `<button class="install-btn ghost" data-act="close">알겠어요</button>`
      : `<button class="install-btn ghost" data-act="close">나중에</button>
         <button class="install-btn" data-act="install">다운로드</button>`;

  return `
    <div class="install-backdrop" id="install-modal">
      <div class="install-card" role="dialog" aria-modal="true" aria-label="앱으로 보기">
        <img src="assets/mascot.png" alt="" class="install-mascot">
        <h2 class="install-title">북끄럽을 앱으로 받아<br>편하게 보세요!</h2>
        ${guide}
        <div class="install-actions">${action}</div>
      </div>
    </div>`;
}

function showModal(mode) {
  if (document.getElementById('install-modal')) return;
  document.body.insertAdjacentHTML('beforeend', modalHTML(mode));
  const root = document.getElementById('install-modal');

  root.addEventListener('click', async (e) => {
    const act = e.target.dataset?.act;
    if (e.target === root || act === 'close') return dismiss();
    if (act !== 'install') return;

    dismiss();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
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

  if (isStandalone() || dismissedRecently()) return;

  // 크롬 계열: 브라우저가 설치 가능하다고 알려줄 때만 띄운다.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => showModal('prompt'), 900);
  });

  // iOS 사파리에는 설치 API가 없다. 방법만 알려준다.
  if (isIOS()) setTimeout(() => showModal('ios'), 1200);
}
