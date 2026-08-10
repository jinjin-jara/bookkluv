// 모임 달력. 회차가 있는 달만 그린다.

import { listMeetings } from './api.js';
import { spineColor } from './shelf.js';
import { siteHead, esc, showError, showEmpty, mountNav, rise } from './ui.js';
import { setupInstall } from './install.js';

const root = document.getElementById('calendar');
document.getElementById('head').innerHTML = siteHead('모임 달력', '어느 날 어떤 책으로 모였는지');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 회차를 'YYYY-MM' 단위로 묶는다. 최신 달이 먼저. */
function groupByMonth(meetings) {
  const map = new Map();
  for (const m of meetings) {
    const key = String(m.date).slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function monthHTML(key, items) {
  const [y, mm] = key.split('-').map(Number);
  const first = new Date(y, mm - 1, 1);
  const days = new Date(y, mm, 0).getDate();
  const lead = first.getDay();

  const byDay = new Map();
  for (const m of items) byDay.set(Number(String(m.date).slice(8, 10)), m);

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell is-blank"></div>');

  for (let d = 1; d <= days; d++) {
    const m = byDay.get(d);
    const weekday = new Date(y, mm - 1, d).getDay();
    const cls = ['cal-cell'];
    if (weekday === 0) cls.push('is-sun');
    if (weekday === 6) cls.push('is-sat');

    if (!m) {
      // 빈 날은 그 날짜로 모임지를 쓰러 가는 링크가 된다.
      const iso = `${y}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cls.push('is-empty');
      cells.push(`
        <a class="${cls.join(' ')}" href="admin.html?date=${iso}" title="${iso}에 모임지 쓰기">
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

  return `
    <section class="cal-month">
      <h2 class="cal-title">${y}년 ${mm}월<span>${items.length}회</span></h2>
      <div class="cal-grid">
        ${WEEK.map((w, i) => `<div class="cal-head${i === 0 ? ' is-sun' : ''}${i === 6 ? ' is-sat' : ''}">${w}</div>`).join('')}
        ${cells.join('')}
      </div>
    </section>`;
}

function skeleton() {
  root.innerHTML = `
    <section class="cal-month">
      <div class="sk sk-title"></div>
      <div class="cal-grid">${'<div class="sk cal-sk"></div>'.repeat(35)}</div>
    </section>`;
}

async function load() {
  skeleton();

  let meetings = [];
  try {
    meetings = await listMeetings();
  } catch (err) {
    showError(root, '지금 달력을 불러오지 못했어요.', load);
    return;
  }

  if (!meetings.length) {
    showEmpty(root, '아직 기록된 모임이 없어요.');
    return;
  }

  root.innerHTML = groupByMonth(meetings)
    .map(([key, items]) => monthHTML(key, items))
    .join('');
  rise(root, true);
}

load();
setupInstall();
mountNav();
