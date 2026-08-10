// 모임지 등록.

import { createMeeting } from './api.js';
import { parseQuestions } from './parser.js';
import { searchBooks } from './booksearch.js';
import { siteHead, esc, mountNav } from './ui.js';

const $ = (id) => document.getElementById(id);
document.getElementById('head').innerHTML = siteHead('모임지 등록', '줄글을 붙여넣으면 질문으로 나눠드려요');

// 달력에서 날짜를 눌러 왔으면 그 날짜로 채운다.
const wanted = new URLSearchParams(location.search).get('date');
$('f-date').value = /^\d{4}-\d{2}-\d{2}$/.test(wanted || '')
  ? wanted
  : new Date().toISOString().slice(0, 10);

let questions = [];

// ── 책 검색 ──────────────────────────────
$('f-search').addEventListener('click', async () => {
  const box = $('f-results');
  const query = $('f-title').value.trim();
  if (!query) return;

  box.hidden = false;
  box.innerHTML = '<p class="result-msg">찾는 중이에요…</p>';

  let results = [];
  try {
    results = await searchBooks(query);
  } catch (err) {
    box.innerHTML = '<p class="result-msg">지금 검색이 안 돼요. 저자와 쪽수를 직접 적어주세요.</p>';
    return;
  }

  if (!results.length) {
    box.innerHTML = '<p class="result-msg">찾은 책이 없어요. 직접 적어주세요.</p>';
    return;
  }

  box.innerHTML = results
    .map(
      (b, i) => `
    <button type="button" class="result" data-i="${i}">
      <b>${esc(b.title)}</b>
      <span>${esc(b.author || '저자 미상')}${b.pages ? ` · ${b.pages}쪽` : ' · 쪽수 정보 없음'}${b.publisher ? ` · ${esc(b.publisher)}` : ''}</span>
    </button>`
    )
    .join('');

  box.querySelectorAll('.result').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = results[Number(btn.dataset.i)];
      $('f-title').value = b.title;
      $('f-author').value = b.author;
      if (b.pages) $('f-pages').value = b.pages;
      box.hidden = true;
    });
  });
});

// ── 질문 나누기 ──────────────────────────
$('f-parse').addEventListener('click', () => {
  const result = parseQuestions($('f-raw').value);
  questions = result.questions;
  renderPreview(result.warnings);
});

function renderPreview(warnings = []) {
  if (!questions.length) {
    $('f-preview').innerHTML = '<p class="parse-warn">질문을 못 찾았어요. 줄글을 확인해주세요.</p>';
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
    return message('먼저 "질문 나누기"를 눌러 이야깃거리를 확인해주세요.', 'error');
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

    location.href = `meeting.html?id=${saved.id}`;
  } catch (err) {
    message('등록하지 못했어요. 잠시 뒤 다시 시도해주세요.', 'error');
    submit.disabled = false;
  }
});

mountNav();
