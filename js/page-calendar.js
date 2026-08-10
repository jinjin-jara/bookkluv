// 모임 달력. 한 번에 한 달씩 본다.

import { listMeetings } from './api.js';
import { spineColor } from './shelf.js';
import { siteHead, esc, showError, mountNav, rise } from './ui.js';
import { setupInstall } from './install.js';

const root = document.getElementById('calendar');
document.getElementById('head').innerHTML = siteHead('모임 달력', '어느 날 어떤 책으로 모였는지');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

let meetings = [];
let byDate = new Map();
let year;
let month; // 1~12

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function monthsWithMeetings() {
  return [...new Set(meetings.map((m) => String(m.date).slice(0, 7)))].sort().reverse();
}

/** 회차가 있는 해 + 올해를 합쳐 고를 수 있게 한다. */
function yearOptions() {
  const years = new Set(meetings.map((m) => Number(String(m.date).slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

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
  const count = meetings.filter((m) => String(m.date).startsWith(monthKey)).length;

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
        <a class="${cls.join(' ')}" href="admin.html?date=${key}" title="${key}에 모임지 쓰기">
          <span class="cal-day">${d}</span>
          <span class="cal-add" aria-hidden="true">+</span>
        </a>`);
      continue;
    }

    cls.push('has-meeting');
    cells.push(`
      <a class="${cls.join(' ')}" href="meeting.html?id=${encodeURIComponent(m.id)}"
         title="${esc(`${m.title} · ${m.author || '저자 미상'}`)}">
        <span class="cal-day">${d}</span>
        <span class="cal-book" style="--pad:${spineColor(m)}">${esc(m.title)}</span>
      </a>`);
  }

  const marks = new Set(monthsWithMeetings());

  root.innerHTML = `
    <div class="cal-bar">
      <button type="button" class="cal-nav" id="prev" aria-label="이전 달">‹</button>
      <div class="cal-pickers">
        <select id="pick-year" aria-label="연도">
          ${yearOptions().map((y) => `<option value="${y}"${y === year ? ' selected' : ''}>${y}년</option>`).join('')}
        </select>
        <select id="pick-month" aria-label="월">
          ${Array.from({ length: 12 }, (_, i) => i + 1)
            .map((mm) => {
              const has = marks.has(`${year}-${pad(mm)}`);
              return `<option value="${mm}"${mm === month ? ' selected' : ''}>${mm}월${has ? ' ·' : ''}</option>`;
            })
            .join('')}
        </select>
      </div>
      <button type="button" class="cal-nav" id="next" aria-label="다음 달">›</button>
    </div>

    <p class="cal-count">${count ? `이 달에 ${count}번 모였어요` : '이 달에는 모임 기록이 없어요'}</p>

    <div class="cal-grid" id="grid">
      ${WEEK.map((w, i) => `<div class="cal-head${i === 0 ? ' is-sun' : ''}${i === 6 ? ' is-sat' : ''}">${w}</div>`).join('')}
      ${cells.join('')}
    </div>`;

  document.getElementById('prev').addEventListener('click', () => shift(-1));
  document.getElementById('next').addEventListener('click', () => shift(1));
  document.getElementById('pick-year').addEventListener('change', (e) => {
    year = Number(e.target.value);
    render();
  });
  document.getElementById('pick-month').addEventListener('change', (e) => {
    month = Number(e.target.value);
    render();
  });

  rise(document.getElementById('grid'));
  setupSwipe();
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

async function load() {
  skeleton();

  try {
    meetings = await listMeetings();
  } catch (err) {
    showError(root, '지금 달력을 불러오지 못했어요.', load);
    return;
  }

  byDate = new Map(meetings.map((m) => [String(m.date), m]));

  // 가장 최근 모임이 있는 달부터 보여준다. 기록이 없으면 이번 달.
  const latest = meetings[0]?.date;
  const start = latest ? new Date(latest + 'T00:00:00') : new Date();
  year = start.getFullYear();
  month = start.getMonth() + 1;

  render();
}

load();
setupInstall();
mountNav();
