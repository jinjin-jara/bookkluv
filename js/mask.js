// 이름 가운데 가리기. 저장은 풀네임, 화면 출력만 마스킹.

/**
 * 홍   → 홍
 * 홍길  → 홍*
 * 홍길동 → 홍*동
 * 남궁길동 → 남**동
 */
export function maskName(name) {
  const s = (name || '').trim();
  if (!s) return '';
  if (s.length === 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}
