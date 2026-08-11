// 모임 달력. 한 번에 한 달씩 본다.

import { listMeetings } from './api.js';
import { swr } from './cache.js';
import { spineColor } from './shelf.js';
import { esc, showError, setupNav, rise, atLeast } from './ui.js';
import { setupInstall } from './install.js';

const root = document.getElementById('calendar');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

let meetings = [];
let byDate = new Map();
let year;
let month; // 1~12

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function shift(delta) {
  const d = new Date(year, month - 1 + delta, 1);
  year = d.getFullYear();
  month = d.getMonth() + 1;
  render();
}

function render() {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const lead = first.getDay();
  const monthKey = `${year}-${pad(month)}`;
  const count = [...byDate.keys()].filter((k) => k.startsWith(monthKey)).length;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell is-blank"></div>');

  for (let d = 1; d <= days; d++) {
    const key = iso(year, month, d);
    const m = byDate.get(key);
    const weekday = new Date(year, month - 1, d).getDay();
    const cls = ['cal-cell'];
    if (weekday === 0) cls.push('is-sun');
    if (weekday === 6) cls.push('is-sat');

    if (!m) {
      cls.push('is-empty');
      cells.push(`
        <a class="${cls.join(' ')}" href="admin/?date=${key}" title="${key}에 모임지 쓰기">
          <span class="cal-day">${d}</span>
        </a>`);
      continue;
    }

    cls.push('has-meeting');
    cells.push(`
      <a class="${cls.join(' ')}" href="meeting/?id=${encodeURIComponent(m.id)}"
         title="${esc(`${m.title} · ${m.author || '저자 미상'}`)}">
        <span class="cal-day" style="--pad:${spineColor(m, m._seq, meetings.length)}">${d}</span>
        <span class="cal-book">${esc(m.title)}</span>
        ${m.author ? `<span class="cal-author">${esc(m.author)}</span>` : ''}
      </a>`);
  }

  const marks = new Set([...byDate.keys()].map((k) => k.slice(0, 7)));

  root.innerHTML = `
    <div class="cal-bar">
      <button type="button" class="cal-nav" id="prev" aria-label="이전 달">‹</button>
      <button type="button" class="cal-label" id="open-picker" aria-haspopup="dialog">
        ${year}년 ${month}월
      </button>
      <button type="button" class="cal-nav" id="next" aria-label="다음 달">›</button>
    </div>

    <p class="cal-count">${count ? `이 달에 ${count}번 모였어요` : '이 달에는 모임 기록이 없어요'}</p>

    <div class="cal-grid" id="grid">
      ${WEEK.map((w, i) => `<div class="cal-head${i === 0 ? ' is-sun' : ''}${i === 6 ? ' is-sat' : ''}">${w}</div>`).join('')}
      ${cells.join('')}
    </div>`;

  document.getElementById('prev').addEventListener('click', () => shift(-1));
  document.getElementById('next').addEventListener('click', () => shift(1));
  document.getElementById('open-picker').addEventListener('click', () => openPicker(marks));

  rise(document.getElementById('grid'));
  setupSwipe();
}

/** 연·월 고르기. 네이티브 select 대신 직접 그린다. */
function openPicker(marks) {
  if (document.getElementById('cal-picker')) return;

  let pickYear = year;

  const paint = () => {
    document.getElementById('picker-year').textContent = `${pickYear}년`;
    document.querySelectorAll('#picker-months button').forEach((btn) => {
      const mm = Number(btn.dataset.m);
      btn.classList.toggle('is-on', pickYear === year && mm === month);
      btn.classList.toggle('has-dot', marks.has(`${pickYear}-${pad(mm)}`));
    });
  };

  document.body.insertAdjacentHTML('beforeend', `
    <div class="picker-backdrop" id="cal-picker">
      <div class="picker" role="dialog" aria-label="연월 고르기">
        <div class="picker-head">
          <button type="button" class="cal-nav" id="picker-prev" aria-label="이전 해">‹</button>
          <strong id="picker-year"></strong>
          <button type="button" class="cal-nav" id="picker-next" aria-label="다음 해">›</button>
        </div>
        <div class="picker-months" id="picker-months">
          ${Array.from({ length: 12 }, (_, i) => i + 1)
            .map((mm) => `<button type="button" data-m="${mm}">${mm}월</button>`)
            .join('')}
        </div>
      </div>
    </div>`);

  const modal = document.getElementById('cal-picker');
  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('picker-prev').addEventListener('click', () => { pickYear--; paint(); });
  document.getElementById('picker-next').addEventListener('click', () => { pickYear++; paint(); });
  document.querySelectorAll('#picker-months button').forEach((btn) => {
    btn.addEventListener('click', () => {
      year = pickYear;
      month = Number(btn.dataset.m);
      close();
      render();
    });
  });

  paint();
}

/** 모바일에서 좌우로 밀어 달을 넘긴다. */
function setupSwipe() {
  const grid = document.getElementById('grid');
  let x0 = null;
  let y0 = null;

  grid.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });

  grid.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    // 세로로 더 많이 움직였으면 그냥 스크롤이다
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    shift(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function skeleton() {
  root.innerHTML = `
    <div class="sk sk-title" style="width:200px"></div>
    <div class="cal-grid">${'<div class="sk cal-sk"></div>'.repeat(35)}</div>`;
}

function apply(list) {
  meetings = list;
  meetings.forEach((m, i) => { m._seq = i; });
  byDate = new Map(meetings.map((m) => [String(m.date), m]));

  // 처음 그릴 때만 가장 최근 모임이 있는 달로 맞춘다
  if (!year) {
    const latest = meetings[0]?.date;
    const start = latest ? new Date(latest + 'T00:00:00') : new Date();
    year = start.getFullYear();
    month = start.getMonth() + 1;
  }
  render();
}

async function load() {
  const { cached, fresh } = swr('meetings', listMeetings, apply);

  if (cached && cached.length) {
    apply(cached);
  } else {
    skeleton();
  }

  try {
    const data = await fresh;
    if (!cached || !cached.length) apply(data);
  } catch (err) {
    if (!cached) showError(root, '지금 달력을 불러오지 못했어요.', load);
  }
}

load();
setupInstall();
setupNav();
