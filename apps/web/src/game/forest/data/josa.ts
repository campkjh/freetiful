// 한국어 조사 — 받침에 맞춰(을/를 · 이/가 · 와/과 · 은/는 · 으로/로). 'ㄹ' 받침은 '로'.
export function josa(word: string, pair: '을/를' | '이/가' | '와/과' | '은/는' | '으로/로' | '이에요/예요'): string {
  const ch = word.trim().charCodeAt(word.trim().length - 1);
  const isHangul = ch >= 0xac00 && ch <= 0xd7a3;
  const jong = isHangul ? (ch - 0xac00) % 28 : 0;
  const has = isHangul && jong !== 0;
  const [a, b] = pair.split('/');
  if (pair === '으로/로') return word + (has && jong !== 8 ? '으로' : '로');
  // 첫 번째 = 받침 있을 때(을·이·과·은), 두 번째 = 없을 때(를·가·와·는)
  if (pair === '와/과') return word + (has ? '과' : '와');
  return word + (has ? a : b);
}
