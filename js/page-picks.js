// 모임 중에 나온 추천 도서·영화.

import { listPicks, addPick, listMeetings } from './api.js';
import { maskName } from './mask.js';
import { youtubeId, youtubeThumb, fetchYoutubeInfo } from './picks-util.js';
import { isClean } from './profanity.js';
import { getNickname, setNickname } from './nickname.js';
import { esc, showError, showEmpty, setupNav, rise, restoreScroll, atLeast, skeletonCards } from './ui.js';
import { setupInstall } from './install.js';

const KIND_LABEL = { book: '책', movie: '영화', video: '영상', etc: '그 외' };

const gridEl = document.getElementById('picks');
const searchBox = document.getElementById('pq');


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
        ? `<a href="meeting/?id=${encodeURIComponent(p.meeting_id)}">${esc(p.meetings.date)} ${esc(p.meetings.title)}</a>`
        : '<span></span>';
      const vid = youtubeId(p.url);
      const head = vid
        ? `<a class="pick-thumb" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
             <img src="${esc(youtubeThumb(vid))}" alt="" loading="lazy"
                  onerror="this.closest('.pick-thumb').remove()">
             <span class="pick-play" aria-hidden="true"></span>
           </a>`
        : '';
      const title = p.url && !vid
        ? `<a class="pick-title" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>`
        : `<h3 class="pick-title">${esc(p.title)}</h3>`;

      return `
      <article class="pick${vid ? ' has-thumb' : ''}">
        ${head}
        <div class="pick-body">
          <span class="pick-kind">${KIND_LABEL[p.kind] || '그 외'}</span>
          ${title}
          ${p.creator ? `<p class="pick-creator">${esc(p.creator)}</p>` : ''}
          ${p.note ? `<p class="pick-note">${esc(p.note)}</p>` : ''}
          <p class="pick-meta">
            <span>${p.recommended_by ? `${esc(maskName(p.recommended_by))} 추천` : ''}</span>
            ${from}
          </p>
        </div>
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

// ── 추천 남기기 ──────────────────────────
let meetingOptions = null;   // 회차 목록은 한 번만 받아 둔다

async function openForm() {
  if (document.getElementById('pick-modal')) return;

  if (!meetingOptions) {
    try {
      meetingOptions = await listMeetings();
    } catch (err) {
      meetingOptions = [];
    }
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="note-backdrop" id="pick-modal">
      <div class="note-modal pick-modal">
        <div class="pick-form-head">
          <button class="note-close" aria-label="닫기">×</button>
          <h2>추천 남기기</h2>
          <p>모임에서 이야기하다 나온 책이나 영화를 적어주세요.</p>
        </div>
        <form class="form pick-form" id="pick-form">
          <div class="field-row">
            <label class="field">
              <span>무엇인가요</span>
              <select id="p-kind">
                <option value="book">책</option>
                <option value="movie">영화</option>
                <option value="video">영상</option>
                <option value="etc">그 외</option>
              </select>
            </label>
            <label class="field">
              <span>남기는 사람</span>
              <input type="text" id="p-by" maxlength="20" placeholder="닉네임" value="${esc(getNickname())}" required>
            </label>
          </div>

          <label class="field">
            <span>제목</span>
            <input type="text" id="p-title" maxlength="120" placeholder="퍼펙트 데이즈" required>
          </label>

          <label class="field">
            <span>만든이 <em>없으면 비워두세요</em></span>
            <input type="text" id="p-creator" maxlength="80" placeholder="빔 벤더스">
          </label>

          <label class="field">
            <span>링크 <em>유튜브 주소를 넣으면 썸네일이 붙어요</em></span>
            <input type="url" id="p-url" maxlength="500" placeholder="https://youtu.be/...">
          </label>

          <label class="field">
            <span>한 줄 메모 <em>어떤 이야기 중에 나왔나요</em></span>
            <input type="text" id="p-note" maxlength="200" placeholder="말 없는 주인공 이야기하다가">
          </label>

          <label class="field">
            <span>어느 모임에서 <em>선택</em></span>
            <select id="p-meeting">
              <option value="">고르지 않음</option>
              ${meetingOptions.map((m) => `<option value="${m.id}">${esc(m.date)} · ${esc(m.title)}</option>`).join('')}
            </select>
          </label>

          <p class="form-msg" id="p-msg" hidden></p>

          <div class="form-actions">
            <button type="submit" class="primary" id="p-submit">남기기</button>
          </div>
        </form>
      </div>
    </div>`);

  const modal = document.getElementById('pick-modal');
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('note-close')) close();
  });

  // 유튜브 주소를 넣으면 제목과 채널을 대신 채워준다.
  const urlBox = document.getElementById('p-url');
  const titleBox = document.getElementById('p-title');
  const creatorBox = document.getElementById('p-creator');
  const kindBox = document.getElementById('p-kind');

  const fillFromYoutube = async () => {
    const id = youtubeId(urlBox.value);
    if (!id) return;

    kindBox.value = 'video';
    urlBox.classList.add('is-loading');
    const info = await fetchYoutubeInfo(urlBox.value);
    urlBox.classList.remove('is-loading');
    if (!info) return;

    // 이미 적어둔 내용은 건드리지 않는다
    if (!titleBox.value.trim()) titleBox.value = info.title;
    if (!creatorBox.value.trim()) creatorBox.value = info.creator;
  };

  urlBox.addEventListener('paste', () => setTimeout(fillFromYoutube, 0));
  urlBox.addEventListener('change', fillFromYoutube);
  urlBox.addEventListener('blur', fillFromYoutube);

  const msg = (text, kind = 'error') => {
    const el = document.getElementById('p-msg');
    el.hidden = false;
    el.textContent = text;
    el.className = `form-msg is-${kind}`;
  };

  document.getElementById('pick-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const by = document.getElementById('p-by').value;
    const title = document.getElementById('p-title').value;
    const creator = document.getElementById('p-creator').value;
    const note = document.getElementById('p-note').value;

    if (![by, title, creator, note].every(isClean)) {
      return msg('남기기 어려운 표현이 있어요.');
    }

    const submit = document.getElementById('p-submit');
    submit.disabled = true;
    msg('남기는 중이에요…', 'info');

    try {
      const saved = await addPick({
        kind: document.getElementById('p-kind').value,
        title: title.trim(),
        creator: creator.trim(),
        note: note.trim(),
        url: document.getElementById('p-url').value.trim() || null,
        recommended_by: by.trim(),
        meeting_id: document.getElementById('p-meeting').value || null,
      });
      setNickname(by);
      picks.unshift(saved);
      close();
      render();
    } catch (err) {
      msg('지금 남기지 못했어요. 잠시 뒤 다시 시도해주세요.');
      submit.disabled = false;
    }
  });
}

document.getElementById('add-pick').addEventListener('click', openForm);

async function load() {
  skeletonCards(gridEl);
  try {
    picks = await atLeast(listPicks());
  } catch (err) {
    showError(gridEl, '지금 추천 목록을 불러오지 못했어요.', load);
    return;
  }
  if (!picks.length) {
    showEmpty(gridEl, '아직 쌓인 추천이 없어요. 아래 버튼으로 첫 추천을 남겨보세요.');
    return;
  }
  render();
  restoreScroll();
}

load();
setupInstall();
setupNav();
