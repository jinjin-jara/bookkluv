// 모임지 상세: 포스트잇 그리드 + 질문 모달 + 댓글.

import { getMeeting, listComments, addComment, updateComment, deleteComment } from './api.js';
import { maskName } from './mask.js';
import { isClean } from './profanity.js';
import { getNickname, setNickname, isEditable } from './nickname.js';
import { esc, formatAuthor, formatMeetingDate, formatShort, showError, showEmpty, setupNav, rise, atLeast, skeletonNotes } from './ui.js';
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
        <p class="meeting-author">${esc(formatAuthor(meeting.author) || '저자 미상')}${pages}</p>
      </div>
    </div>
    <div class="notes" id="notes"></div>
    <div class="meeting-foot">
      <a class="back-link" href="./">← 책장으로</a>
      <a class="edit-link" href="admin/?id=${encodeURIComponent(meeting.id)}">고치기</a>
    </div>`;

  rise(root);
  renderNotes();
  rise(document.getElementById('notes'), true);
  document.getElementById('notes').addEventListener('click', (e) => {
    const note = e.target.closest('.note');
    if (note) openNote(note.dataset.target);
  });
}

/** 답이 있을 때만 개수를, 없을 땐 조용한 안내만. 질문 본문보다 튀지 않게 한다. */
function noteFoot(target) {
  const n = commentsFor(target).length;
  return n
    ? `<span class="note-count">이야기 ${n}</span>`
    : '<span class="note-count is-none">첫 이야기 남기기</span>';
}

function noteLabel(num, text, target) {
  const n = commentsFor(target).length;
  return `${num}. ${text} — ${n ? `이야기 ${n}개` : '아직 이야기 없음'}`;
}

function renderNotes() {
  const questions = meeting.questions || [];
  document.getElementById('notes').innerHTML =
    questions
      .map(
        (q, i) => `
      <button class="note" data-target="q:${i}" aria-label="${esc(noteLabel(`Q${i + 1}`, q, `q:${i}`))}">
        <span class="note-num">Q${i + 1}</span>
        <p class="note-text">${esc(q)}</p>
        ${noteFoot(`q:${i}`)}
      </button>`
      )
      .join('') +
    `<button class="note overall" data-target="overall">
       <span class="note-num">AFTER</span>
       <p class="note-text">모임 전체 후기</p>
       ${noteFoot('overall')}
     </button>`;
}

function commentHTML(c) {
  const tools = isEditable(c)
    ? `<span class="comment-tools">
         <button type="button" data-act="edit" data-id="${c.id}">고치기</button>
         <button type="button" data-act="delete" data-id="${c.id}">지우기</button>
       </span>`
    : '';
  return `<article class="comment" data-id="${c.id}">
    <header class="comment-meta">
      <span class="who">${esc(c.nickname)}</span>
      <time class="when" datetime="${esc(c.created_at)}">${esc(formatShort(c.created_at))}</time>
      ${tools}
    </header>
    <p class="body">${esc(c.body)}</p>
  </article>`;
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
      <div class="note-modal" role="dialog" aria-modal="true" aria-labelledby="modal-q">
        <div class="note-modal-head" style="--pad:${pad}">
          <button type="button" class="note-close" aria-label="닫기">×</button>
          <span class="note-modal-num">${num}</span>
          <p class="note-modal-text" id="modal-q">${esc(text)}</p>
        </div>
        <div class="note-modal-body">
          <div class="comments" id="modal-comments"></div>
          <form class="comment-form" id="modal-form" novalidate>
            <label class="cf-nick"><span>닉네임</span>
              <input name="nickname" placeholder="닉네임" maxlength="20" autocomplete="nickname" value="${esc(getNickname())}" required>
            </label>
            <label class="cf-body"><span>${isOverall ? '후기' : '내 이야기'}</span>
              <textarea name="body" placeholder="${isOverall ? '후기를 남겨보세요' : '이 질문에 답해보세요'}" maxlength="1000" required></textarea>
            </label>
            <button type="submit" class="cf-submit">남기기</button>
            <p class="cf-status" id="cf-status" role="status" aria-live="polite"></p>
          </form>
        </div>
      </div>
    </div>`
  );

  const modal = document.getElementById('note-modal');
  const dialog = modal.querySelector('.note-modal');
  const opener = document.activeElement;
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey, true);
    renderNotes();
    // 카드를 다시 그렸으니 같은 카드로 포커스를 돌려준다
    const back = document.querySelector(`.note[data-target="${target}"]`) || opener;
    back?.focus?.();
  };
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...dialog.querySelectorAll('button, input, textarea, a[href]')].filter((x) => !x.disabled);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (!dialog.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.note-close')) close();
  });
  dialog.querySelector('.note-close').focus();

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
  const nick = form.elements.nickname;
  const body = form.elements.body;
  const button = form.querySelector('.cf-submit');
  const status = document.getElementById('cf-status');
  let sending = false;
  let clearTimer = null;

  const say = (text, kind = '') => {
    clearTimeout(clearTimer);
    status.textContent = text;
    status.className = `cf-status ${kind ? `is-${kind}` : ''}`;
    form.classList.toggle('has-error', kind === 'error');
    if (kind === 'ok') clearTimer = setTimeout(() => { status.textContent = ''; }, 2600);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;                 // 중복 제출 방지
    if (!nick.value.trim()) { say('닉네임을 적어주세요', 'error'); return nick.focus(); }
    if (!body.value.trim()) { say('이야기를 적어주세요', 'error'); return body.focus(); }
    if (!isClean(body.value) || !isClean(nick.value)) {
      return say('남기기 어려운 표현이 있어요', 'error');
    }

    sending = true;
    button.disabled = true;
    button.textContent = '남기는 중…';
    say('남기는 중이에요…');
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
      say('남겼어요', 'ok');
      document.getElementById('modal-comments')?.lastElementChild?.scrollIntoView({ block: 'nearest' });
    } catch (err) {
      say('지금 남기지 못했어요. 쓴 내용은 그대로 두었으니 다시 시도해주세요', 'error');
    } finally {
      sending = false;
      button.disabled = false;
      button.textContent = '남기기';
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
        <a class="back-link" href="./">← 책장으로</a>
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
