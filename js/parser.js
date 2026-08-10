// 줄글 → 질문 배열. 순수 함수. DOM·DB 모름.

// Q1. / Q1) / Q. / Q) / 1. / 1)
const MARKER = /^\s*(?:Q\s*(\d+)\s*[.)]|Q\s*[.)]|(\d+)\s*[.)])\s*/i;

function markerOf(line) {
  const m = line.match(MARKER);
  if (!m) return null;
  const num = m[1] ?? m[2];
  return { rest: line.slice(m[0].length), num: num ? Number(num) : null };
}

// 접힌 줄은 이어 붙이고, 빈 줄은 문단 구분으로 살린다.
function joinLines(lines) {
  const out = [];
  let buf = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (buf.length) out.push(buf.join(' '));
      buf = [];
    } else {
      buf.push(line.trim());
    }
  }
  if (buf.length) out.push(buf.join(' '));
  return out.join('\n').trim();
}

/**
 * @param {string} text 붙여넣은 줄글
 * @returns {{questions: string[], warnings: string[]}}
 */
export function parseQuestions(text) {
  const warnings = [];
  if (!text || !text.trim()) return { questions: [], warnings };

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  const groups = [];
  const numbers = [];
  let current = null;

  for (const line of lines) {
    const marker = markerOf(line);
    if (marker) {
      if (current) groups.push(current);
      current = [marker.rest];
      numbers.push(marker.num);
    } else if (current) {
      current.push(line);
    }
    // 첫 머리표 앞의 줄은 버린다 (제목 등)
  }
  if (current) groups.push(current);

  if (groups.length === 0) {
    // 머리표가 없으면 빈 줄로 나뉜 문단 하나를 질문 하나로 본다
    const paragraphs = text
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)
      .map((p) => joinLines(p.split('\n')))
      .filter(Boolean);
    return { questions: paragraphs, warnings };
  }

  const questions = groups.map((g) => joinLines(g)).filter(Boolean);

  const given = numbers.filter((n) => n !== null);
  if (given.length) {
    const expected = given.map((_, i) => i + 1);
    if (given.some((n, i) => n !== expected[i])) {
      warnings.push(
        `원본 번호가 순서대로가 아니에요 (${given.join(', ')}). 등장 순서대로 다시 매겼어요.`
      );
    }
  }
  if (questions.length !== groups.length) {
    warnings.push('내용이 비어 있는 질문을 걸러냈어요.');
  }

  return { questions, warnings };
}
