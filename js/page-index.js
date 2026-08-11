// 책장 목록 화면.

import { listMeetings } from './api.js';
import { swr } from './cache.js';
import { spineColor, spineLayout, spineMarkup, groupByYear } from './shelf.js';
import { esc, dayOf, DAY_NAMES, showError, showEmpty, setupNav, rise, restoreScroll, atLeast, skeletonShelf } from './ui.js';
import { setupInstall } from './install.js';

const shelvesEl = document.getElementById('shelves');
const daysEl = document.getElementById('days');
const nohitEl = document.getElementById('nohit');
const searchBox = document.getElementById('q');


const activeDays = new Set();
let query = '';
let meetings = [];

const scaleOf = () => (window.innerWidth < 700 ? 0.78 : 1);

function bookHTML(m, index, total) {
  const { width: w, height: h, fontSize: fs } = spineLayout(m, scaleOf());
  const key = `${m.title} ${m.author || ''}`.toLowerCase();
  const tip = `${m.title} · ${m.author || '저자 미상'} · ${m.date} ${dayOf(m.date)}요모임`;

  return `<div class="slot" style="width:${w}px" data-date="${esc(m.date)}" data-key="${esc(key)}">
    <a class="book" href="meeting/?id=${encodeURIComponent(m.id)}"
      style="height:${h}px;background:${spineColor(m, index, total)};--spine-size:${fs}px"
      title="${esc(tip)}">
      <span class="spine-text">${spineMarkup(esc(m.title))}</span></a>
  </div>`;
}

function renderDayChips() {
  const days = [...new Set(meetings.map((m) => dayOf(m.date)))]
    .sort((a, b) => DAY_NAMES.indexOf(a) - DAY_NAMES.indexOf(b));

  daysEl.innerHTML = days
    .map((d) => `<button class="chip" data-day="${d}" aria-pressed="false">${d}요모임</button>`)
    .join('');

  daysEl.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.day;
      activeDays.has(d) ? activeDays.delete(d) : activeDays.add(d);
      btn.setAttribute('aria-pressed', String(activeDays.has(d)));
      applyFilter();
    });
  });
}

function matches(date, key) {
  const q = query.trim().toLowerCase();
  if (activeDays.size && !activeDays.has(dayOf(date))) return false;
  if (!q) return true;
  return key.includes(q);
}

// 책은 한 번만 그린다. 이후 필터는 클래스 토글이라 폭이 부드럽게 접힌다.
function renderShelves() {
  const groups = groupByYear(meetings);

  // 책장은 하나지만, 해가 다르면 줄을 나눈다. 줄마다 위에 팻말을 붙인다.
  let seq = 0;
  const rows = groups.map((g) => {
    const books = g.items.map((m) => bookHTML(m, seq++, meetings.length)).join('');
    return `
      <section class="shelf-year" id="y${g.year}" data-year="${g.year}">
        <span class="year-label">${g.year}</span>
        <div class="shelf-books">${books}</div>
      </section>`;
  });

  shelvesEl.innerHTML = `<div class="bookcase">${rows.join('')}</div>`;

  rise(shelvesEl);
  applyFilter();
}

function applyFilter() {
  let total = 0;

  document.querySelectorAll('.shelf-year').forEach((row) => {
    let shown = 0;
    row.querySelectorAll('.slot').forEach((slot) => {
      const ok = matches(slot.dataset.date, slot.dataset.key);
      slot.classList.toggle('is-out', !ok);
      if (ok) shown++;
    });
    // 그 해에 남은 책이 없으면 줄째로 접는다
    row.classList.toggle('is-empty', shown === 0);
    total += shown;
  });

  nohitEl.hidden = total > 0;
}

// 한글 조합 중에는 걸러내지 않고, 입력이 멎으면 그때 한 번만 반영한다.
let composing = false;
let timer = null;
function scheduleFilter() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    query = searchBox.value;
    applyFilter();
  }, 160);
}
searchBox.addEventListener('compositionstart', () => { composing = true; });
searchBox.addEventListener('compositionend', () => { composing = false; scheduleFilter(); });
searchBox.addEventListener('input', () => { if (!composing) scheduleFilter(); });

// 화면 폭이 바뀌면 책 치수를 다시 잡는다.
let resizeTimer = null;
let lastScale = scaleOf();
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (scaleOf() !== lastScale) {
      lastScale = scaleOf();
      renderShelves();
    }
  }, 200);
});

async function load() {
  // 저장해 둔 목록이 있으면 기다리지 않고 바로 그린다.
  const { cached, fresh } = swr('meetings', listMeetings, (data) => {
    meetings = data;
    renderDayChips();
    renderShelves();
  });

  if (cached && cached.length) {
    meetings = cached;
    renderDayChips();
    renderShelves();
  } else {
    skeletonShelf(shelvesEl);
  }

  try {
    const data = await fresh;
    if (!cached || !cached.length) {
      meetings = data;
      if (!meetings.length) {
        showEmpty(shelvesEl, '아직 꽂힌 책이 없어요. 첫 모임지를 등록해보세요.');
        return;
      }
      renderDayChips();
      renderShelves();
    }
    restoreScroll();
  } catch (err) {
    if (!cached) showError(shelvesEl, '지금 책장을 불러오지 못했어요.', load);
  }
}

load();
setupInstall();
setupNav();
