// 모임지 등록.

import { createMeeting } from './api.js';
import { parseQuestions } from './parser.js';
import { searchBooks } from './booksearch.js';
import { esc, setupNav } from './ui.js';

const $ = (id) => document.getElementById(id);

// 달력에서 날짜를 눌러 왔으면 그 날짜로 채운다.
const wanted = new URLSearchParams(location.search).get('date');
$('f-date').value = /^\d{4}-\d{2}-\d{2}$/.test(wanted || '')
  ? wanted
  : new Date().toISOString().slice(0, 10);

let questions = [];

// ── 책 검색 ──────────────────────────────
/** 제목에서 찾는 말과 겹치는 자리에 표시를 씌운다. */
function mark(title, query) {
  const t = String(title || '');
  const q = String(query || '').trim();
  if (!q) return esc(t);

  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(t);

  return (
    esc(t.slice(0, i)) +
    `<mark>${esc(t.slice(i, i + q.length))}</mark>` +
    esc(t.slice(i + q.length))
  );
}

let lastResults = [];   // 다시 열어 볼 수 있게 들고 있는다
let lastQuery = '';     // 같은 말로 다시 찾지 않게
let searchSeq = 0;      // 뒤늦게 도착한 옛 응답을 버리려고 센다
let searchTimer = null; // 예약된 자동 검색
let pickedAt = 0;       // 방금 골랐으면 잠깐은 다시 열지 않는다

async function runSearch() {
  const box = $('f-results');
  const query = $('f-title').value.trim();
  if (!query) { closeResults(); lastResults = []; return; }

  const seq = ++searchSeq;

  openResults();
  box.innerHTML = '<p class="result-msg">찾는 중이에요…</p>';

  let results = [];
  try {
    results = await searchBooks(query);
    if (seq !== searchSeq) return;   // 그 사이 새 검색이 시작됐다
  } catch (err) {
    if (seq !== searchSeq) return;
    box.innerHTML = '<p class="result-msg">지금 검색이 안 돼요. 저자와 쪽수를 직접 적어주세요.</p>';
    return;
  }

  if (!results.length) {
    lastResults = [];
    box.innerHTML = '<p class="result-msg">찾은 책이 없어요. 직접 적어주세요.</p>';
    return;
  }

  lastResults = results;
  openResults();

  box.innerHTML = results
    .map(
      (b, i) => `
    <button type="button" class="result" data-i="${i}">
      <b>${mark(b.title, query)}</b>
      <span>${esc(b.author || '저자 미상')}${b.pages ? ` · ${b.pages}쪽` : ' · 쪽수 정보 없음'}${b.publisher ? ` · ${esc(b.publisher)}` : ''}</span>
    </button>`
    )
    .join('');

}

/**
 * 결과 고르기는 목록 전체에 한 번만 걸어 둔다.
 *
 * 버튼마다 핸들러를 붙이면 목록을 다시 그릴 때 사라지고, 누르는 도중 목록이
 * 움직이면 클릭이 버튼 밖에서 끝나 아무 일도 일어나지 않는다.
 * 손가락이나 마우스를 누르는 순간(pointerdown)에 바로 고른다.
 */
function pickResult(target) {
  const btn = target.closest('.result');
  if (!btn) { return; }

  const b = lastResults[Number(btn.dataset.i)];
  if (!b) { return; }

  $('f-title').value = b.title;
  $('f-author').value = b.author;
  if (b.pages) $('f-pages').value = b.pages;

  // 고른 뒤에 목록이 되살아나는 길을 전부 막는다
  lastQuery = b.title;          // 같은 말로 다시 찾지 않게
  searchSeq++;                  // 날아오던 응답은 버린다
  clearTimeout(searchTimer);    // 예약된 검색도 취소
  pickedAt = Date.now();        // 초점이 되돌아와도 잠깐은 열지 않는다
  closeResults();
}

function closeResults() {
  $('f-results').hidden = true;
}

/**
 * 목록을 여는 문은 여기 하나뿐이다.
 * 방금 하나를 골랐다면 무슨 이유로 열려고 하든 열지 않는다.
 * 여는 곳이 여럿이면 그중 하나만 놓쳐도 목록이 되살아난다.
 */
/**
 * 목록을 여는 문은 여기 하나뿐이다.
 * 방금 하나를 골랐다면 무슨 이유로 열려고 하든 열지 않는다.
 */
function openResults() {
  if (Date.now() - pickedAt < 600) return;
  $('f-results').hidden = false;
}

$('f-results').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pickResult(e.target);
});

$('f-search').addEventListener('click', runSearch);

/*
 * 골라서 닫은 목록을 다시 보고 싶을 때가 있다. 제목 칸을 "눌렀을 때"만 다시 편다.
 * 초점만으로 열면, 고른 직후 키보드가 올라오며 초점이 되돌아올 때 저절로 다시 열린다.
 */
$('f-title').addEventListener('pointerdown', () => {
  if (lastResults.length && $('f-results').innerHTML) openResults();
});

// 포인터 이벤트가 오지 않는 환경을 위해 클릭도 예비로 받는다
$('f-results').addEventListener('click', (e) => pickResult(e.target));
document.addEventListener('click', (e) => {
  if (e.target.closest('#f-results, #f-title, #f-search')) return;
  closeResults();
});

// 목록 바깥을 누르면 접는다
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#f-results, #f-title, #f-search')) return;
  closeResults();
});

// 제목을 치다 멈추면 알아서 찾는다. 글자마다 부르지 않게 잠깐 기다린다.
const titleBox = $('f-title');
let titleComposing = false;

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = titleBox.value.trim();
    if (!q || q === lastQuery) return;
    lastQuery = q;
    runSearch();
  }, 450);
}

titleBox.addEventListener('compositionstart', () => { titleComposing = true; });
titleBox.addEventListener('compositionend', () => { titleComposing = false; scheduleSearch(); });
titleBox.addEventListener('input', () => { if (!titleComposing) scheduleSearch(); });

// ── 질문 나누기 ──────────────────────────
// 붙여넣거나 고치는 즉시 나눈다. 한글 조합 중에는 기다린다.
const raw = $('f-raw');
let composing = false;
let parseTimer = null;

function reparse() {
  const result = parseQuestions(raw.value);
  questions = result.questions;
  renderPreview(result.warnings);
}

function scheduleParse() {
  clearTimeout(parseTimer);
  parseTimer = setTimeout(reparse, 250);
}

raw.addEventListener('compositionstart', () => { composing = true; });
raw.addEventListener('compositionend', () => { composing = false; scheduleParse(); });
raw.addEventListener('input', () => { if (!composing) scheduleParse(); });
raw.addEventListener('paste', () => setTimeout(reparse, 0));

function renderPreview(warnings = []) {
  if (!raw.value.trim()) {
    $('f-preview').innerHTML = '';
    return;
  }
  if (!questions.length) {
    $('f-preview').innerHTML = '<p class="parse-warn">아직 질문을 못 찾았어요. Q1. 이나 1. 같은 머리표가 있으면 더 잘 나눕니다.</p>';
    return;
  }

  $('f-preview').innerHTML = `
    ${warnings.length ? `<p class="parse-warn">${esc(warnings.join(' '))}</p>` : ''}
    <p class="preview-head">질문 ${questions.length}개로 나눴어요. 고칠 게 있으면 바로 수정하세요.</p>
    ${questions
      .map(
        (q, i) => `
      <div class="preview-q">
        <span class="preview-num">Q${i + 1}</span>
        <textarea rows="3" data-i="${i}">${esc(q)}</textarea>
        <button type="button" class="preview-del" data-i="${i}" aria-label="지우기">×</button>
      </div>`
      )
      .join('')}`;

  $('f-preview').querySelectorAll('textarea').forEach((ta) => {
    ta.addEventListener('input', () => { questions[Number(ta.dataset.i)] = ta.value; });
  });
  $('f-preview').querySelectorAll('.preview-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      questions.splice(Number(btn.dataset.i), 1);
      renderPreview();
    });
  });
}

// ── 등록 ─────────────────────────────────
function message(text, kind = 'info') {
  const el = $('f-msg');
  el.hidden = false;
  el.textContent = text;
  el.className = `form-msg is-${kind}`;
}

$('admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!questions.length) {
    return message('이야깃거리를 붙여넣어주세요.', 'error');
  }

  const submit = $('f-submit');
  submit.disabled = true;
  message('등록하는 중이에요…');

  const pages = Number($('f-pages').value);

  try {
    const saved = await createMeeting({
      date: $('f-date').value,
      title: $('f-title').value.trim(),
      author: $('f-author').value.trim(),
      pages: Number.isFinite(pages) && pages > 0 ? pages : null,
      picked_by: $('f-picker').value.trim() || null,
      questions,
    });

    location.href = `meeting/?id=${saved.id}`;
  } catch (err) {
    message('등록하지 못했어요. 잠시 뒤 다시 시도해주세요.', 'error');
    submit.disabled = false;
  }
});

setupNav();
