// 모임 중에 나온 추천 도서·영화.

import { listPicks } from './api.js';
import { maskName } from './mask.js';
import { siteHead, esc, showError, showEmpty, showLoading, mountNav, rise } from './ui.js';
import { setupInstall } from './install.js';

const KIND_LABEL = { book: '책', movie: '영화', etc: '그 외' };

const gridEl = document.getElementById('picks');
const searchBox = document.getElementById('pq');

document.getElementById('head').innerHTML = siteHead('이야기하다 나온 것들', '모임 중에 자연스레 추천된 책과 영화');

const activeKinds = new Set();
let query = '';
let picks = [];

function render() {
  const q = query.trim().toLowerCase();
  const list = picks.filter((p) => {
    if (activeKinds.size && !activeKinds.has(p.kind)) return false;
    if (!q) return true;
    return `${p.title} ${p.creator || ''}`.toLowerCase().includes(q);
  });

  if (!list.length) {
    gridEl.innerHTML = '<p class="no-hit">해당하는 추천이 없어요.</p>';
    return;
  }

  gridEl.innerHTML = list
    .map((p) => {
      const from = p.meetings
        ? `<a href="meeting.html?id=${encodeURIComponent(p.meeting_id)}">${esc(p.meetings.date)} ${esc(p.meetings.title)}</a>`
        : '<span></span>';
      return `
      <article class="pick">
        <span class="pick-kind">${KIND_LABEL[p.kind] || '그 외'}</span>
        <h3 class="pick-title">${esc(p.title)}</h3>
        ${p.creator ? `<p class="pick-creator">${esc(p.creator)}</p>` : ''}
        ${p.note ? `<p class="pick-note">${esc(p.note)}</p>` : ''}
        <p class="pick-meta">
          <span>${p.recommended_by ? `${esc(maskName(p.recommended_by))} 추천` : ''}</span>
          ${from}
        </p>
      </article>`;
    })
    .join('');

  rise(gridEl, true);
}

document.querySelectorAll('#kinds .chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.kind;
    activeKinds.has(k) ? activeKinds.delete(k) : activeKinds.add(k);
    btn.setAttribute('aria-pressed', String(activeKinds.has(k)));
    render();
  });
});

let composing = false;
let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    query = searchBox.value;
    render();
  }, 160);
}
searchBox.addEventListener('compositionstart', () => { composing = true; });
searchBox.addEventListener('compositionend', () => { composing = false; schedule(); });
searchBox.addEventListener('input', () => { if (!composing) schedule(); });

async function load() {
  showLoading(gridEl);
  try {
    picks = await listPicks();
  } catch (err) {
    showError(gridEl, '지금 추천 목록을 불러오지 못했어요.', load);
    return;
  }
  if (!picks.length) {
    showEmpty(gridEl, '아직 쌓인 추천이 없어요. 모임지를 등록할 때 함께 남겨보세요.');
    return;
  }
  render();
}

load();
setupInstall();
mountNav();
