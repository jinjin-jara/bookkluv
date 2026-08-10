// 책장 목록 화면.

import { listMeetings } from './api.js';
import { spineWidth, spineHeight, spineColor, spineFontSize, spineMarkup, groupByYear } from './shelf.js';
import { siteHead, esc, dayOf, DAY_NAMES, showError, showEmpty, showLoading, mountNav, rise } from './ui.js';
import { setupInstall } from './install.js';

const shelvesEl = document.getElementById('shelves');
const yearsEl = document.getElementById('years');
const daysEl = document.getElementById('days');
const nohitEl = document.getElementById('nohit');
const searchBox = document.getElementById('q');

document.getElementById('head').innerHTML = siteHead();

const activeDays = new Set();
let query = '';
let meetings = [];

const scaleOf = () => (window.innerWidth < 700 ? 0.78 : 1);

function bookHTML(m) {
  const k = scaleOf();
  const w = Math.max(20, Math.round(spineWidth(m.pages) * k));
  const h = Math.round(spineHeight(m.title) * k);
  const fs = spineFontSize(m.title, h, w, k);
  const key = `${m.title} ${m.author || ''}`.toLowerCase();
  const tip = `${m.title} · ${m.author || '저자 미상'} · ${m.date} ${dayOf(m.date)}요모임`;

  return `<div class="slot" style="width:${w}px" data-date="${esc(m.date)}" data-key="${esc(key)}">
    <a class="book" href="meeting.html?id=${encodeURIComponent(m.id)}"
      style="height:${h}px;background:${spineColor(m)};--spine-size:${fs}px"
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
  yearsEl.innerHTML = groups.map((g) => `<a href="#y${g.year}">${g.year}</a>`).join('');

  shelvesEl.innerHTML = groups
    .map(
      (g) => `
    <section class="year-block" id="y${g.year}">
      <h2 class="year-title">${g.year} BOOKS<span class="count"></span></h2>
      <div class="bookcase">${g.items.map(bookHTML).join('')}</div>
    </section>`
    )
    .join('');

  rise(shelvesEl, true);
  applyFilter();
}

function applyFilter() {
  let total = 0;
  document.querySelectorAll('.year-block').forEach((block) => {
    let shown = 0;
    block.querySelectorAll('.slot').forEach((slot) => {
      const ok = matches(slot.dataset.date, slot.dataset.key);
      slot.classList.toggle('is-out', !ok);
      if (ok) shown++;
    });
    block.classList.toggle('is-empty', shown === 0);
    block.querySelector('.count').textContent = `${shown}권`;
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
  showLoading(shelvesEl, '책장을 꺼내는 중이에요');
  try {
    meetings = await listMeetings();
  } catch (err) {
    showError(shelvesEl, '지금 책장을 불러오지 못했어요.', load);
    return;
  }

  if (!meetings.length) {
    showEmpty(shelvesEl, '아직 꽂힌 책이 없어요. 첫 모임지를 등록해보세요.');
    return;
  }

  renderDayChips();
  renderShelves();
}

load();
setupInstall();
mountNav();
