// 모임지 상세: 포스트잇 그리드 + 질문 모달 + 댓글.

import { getMeeting, listComments, addComment, updateComment, deleteComment } from './api.js';
import { maskName } from './mask.js';
import { isClean } from './profanity.js';
import { getNickname, setNickname, isEditable } from './nickname.js';
import { esc, formatMeetingDate, formatShort, showError, showEmpty, setupNav, rise, atLeast, skeletonNotes } from './ui.js';
import { setupInstall } from './install.js';

const root = document.getElementById('meeting');

const meetingId = new URLSearchParams(location.search).get('id');

let meeting = null;
let comments = [];

const commentsFor = (target) => comments.filter((c) => c.target === target);

function renderMeeting() {
  const picked = meeting.picked_by
    ? ` · 선정자 ${esc(maskName(meeting.picked_by))}`
    : '';
  const pages = meeting.pages ? ` · ${meeting.pages}쪽` : '';

  root.innerHTML = `
    <div class="meeting-head">
      <div>
        <p class="meeting-date">${esc(formatMeetingDate(meeting.date))}${picked}</p>
        <h2 class="meeting-title">${esc(meeting.title)}</h2>
        <p class="meeting-author">${esc(meeting.author || '저자 미상')}${pages}</p>
      </div>
    </div>
    <div class="notes" id="notes"></div>
    <a class="back-link" href="index.html">← 책장으로</a>`;

  rise(root);
  renderNotes();
  rise(document.getElementById('notes'), true);
  document.getElementById('notes').addEventListener('click', (e) => {
    const note = e.target.closest('.note');
    if (note) openNote(note.dataset.target);
  });
}

function renderNotes() {
  const questions = meeting.questions || [];
  document.getElementById('notes').innerHTML =
    questions
      .map(
        (q, i) => `
      <button class="note" data-target="q:${i}">
        <span class="note-num">Q${i + 1}</span>
        <p class="note-text">${esc(q)}</p>
        <span class="note-count">이야기 ${commentsFor(`q:${i}`).length}</span>
      </button>`
      )
      .join('') +
    `<button class="note overall" data-target="overall">
       <span class="note-num">AFTER</span>
       <p class="note-text">모임 전체 후기</p>
       <span class="note-count">이야기 ${commentsFor('overall').length}</span>
     </button>`;
}

function commentHTML(c) {
  const tools = isEditable(c)
    ? `<span class="comment-tools">
         <button type="button" data-act="edit" data-id="${c.id}">고치기</button>
         <button type="button" data-act="delete" data-id="${c.id}">지우기</button>
       </span>`
    : '';
  return `<div class="comment" data-id="${c.id}">
    <span class="who">${esc(c.nickname)}</span><span class="body">${esc(c.body)}</span><span class="when">${esc(formatShort(c.created_at))}</span>
    ${tools}
  </div>`;
}

function openNote(target) {
  const isOverall = target === 'overall';
  const i = Number(target.split(':')[1]);
  const text = isOverall ? '모임 전체 후기' : meeting.questions[i];
  const num = isOverall ? 'AFTER' : `QUESTION ${i + 1}`;
  const pad = getComputedStyle(document.querySelector(`.note[data-target="${target}"]`)).backgroundColor;

  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="note-backdrop" id="note-modal">
      <div class="note-modal" role="dialog" aria-modal="true">
        <div class="note-modal-head" style="--pad:${pad}">
          <button class="note-close" aria-label="닫기">×</button>
          <span class="note-modal-num">${num}</span>
          <p class="note-modal-text">${esc(text)}</p>
        </div>
        <div class="note-modal-body">
          <div class="comments" id="modal-comments"></div>
          <form class="comment-form" id="modal-form">
            <input placeholder="닉네임" maxlength="20" value="${esc(getNickname())}" required>
            <textarea placeholder="${isOverall ? '후기를 남겨보세요' : '이 질문에 답해보세요'}" maxlength="1000" required></textarea>
            <button>남기기</button>
          </form>
        </div>
      </div>
    </div>`
  );

  const modal = document.getElementById('note-modal');
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    renderNotes();
  };
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('note-close')) close();
  });

  renderModalComments(target);
  setupCommentForm(target);
}

function renderModalComments(target) {
  const box = document.getElementById('modal-comments');
  if (!box) return;
  const list = commentsFor(target);
  box.innerHTML = list.length
    ? list.map(commentHTML).join('')
    : '<p class="comments-none">아직 남긴 이야기가 없어요.</p>';

  box.querySelectorAll('.comment-tools button').forEach((btn) => {
    btn.addEventListener('click', () => handleTool(btn, target));
  });
}

async function handleTool(btn, target) {
  const id = btn.dataset.id;
  const row = comments.find((c) => c.id === id);
  if (!row) return;

  if (btn.dataset.act === 'delete') {
    if (!confirm('이 이야기를 지울까요? 되돌릴 수 없어요.')) return;
    try {
      await deleteComment(id);
      comments = comments.filter((c) => c.id !== id);
      renderModalComments(target);
    } catch (err) {
      alert('지우지 못했어요. 쓴 지 30분이 지났을 수 있어요.');
    }
    return;
  }

  const next = prompt('내용을 고쳐주세요', row.body);
  if (next === null) return;
  if (!isClean(next)) return alert('남기기 어려운 표현이 있어요.');
  try {
    await updateComment(id, next);
    row.body = next.trim();
    renderModalComments(target);
  } catch (err) {
    alert('고치지 못했어요. 쓴 지 30분이 지났을 수 있어요.');
  }
}

function setupCommentForm(target) {
  const form = document.getElementById('modal-form');
  const nick = form.querySelector('input');
  const body = form.querySelector('textarea');
  const button = form.querySelector('button');

  const warn = (message) => {
    form.classList.add('has-error');
    form.dataset.error = message;
    setTimeout(() => form.classList.remove('has-error'), 2200);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!nick.value.trim() || !body.value.trim()) return;
    if (!isClean(body.value) || !isClean(nick.value)) {
      return warn('남기기 어려운 표현이 있어요');
    }

    button.disabled = true;
    try {
      const saved = await addComment({
        meetingId,
        target,
        nickname: nick.value,
        body: body.value,
      });
      setNickname(nick.value);
      comments.push(saved);
      body.value = '';           // 성공했을 때만 비운다
      renderModalComments(target);
    } catch (err) {
      warn('지금 남기지 못했어요. 잠시 뒤 다시 시도해주세요');
    } finally {
      button.disabled = false;
    }
  });
}

async function load() {
  if (!meetingId) {
    showEmpty(root, '어떤 모임지인지 알 수 없어요.');
    return;
  }

  skeletonNotes(root);
  try {
    meeting = await atLeast(getMeeting(meetingId));
  } catch (err) {
    showError(root, '지금 모임지를 불러오지 못했어요.', load);
    return;
  }

  if (!meeting) {
    root.innerHTML = `
      <div class="state">
        <img src="assets/mascot.png" alt="">
        <p>그런 모임지가 없어요.</p>
        <a class="back-link" href="index.html">← 책장으로</a>
      </div>`;
    return;
  }

  document.title = `${meeting.title} — 북끄럽`;

  try {
    comments = await listComments(meetingId);
  } catch (err) {
    comments = []; // 댓글이 없어도 모임지는 보여준다
  }

  renderMeeting();
}

load();
setupInstall();
setupNav();
