import React from 'react';

/**
 * 검색어 강조 — 대소문자 무시, 앞에서부터 겹치지 않게 <mark> 로 감싼다(260926 대화 내용 검색).
 * 소문자로 바꾸며 길이가 달라지는 글자(드묾)가 섞이면 위치가 어긋나므로 강조하지 않는다.
 */
export function highlightText(text: string, q: string | undefined, className = 'chat-hl', keyBase = 'h'): React.ReactNode {
  const src = String(text ?? '');
  const ql = String(q ?? '').toLowerCase();
  if (!ql) return src;
  const lower = src.toLowerCase();
  if (lower.length !== src.length) return src;
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < src.length) {
    const at = lower.indexOf(ql, i);
    if (at < 0) {
      out.push(src.slice(i));
      break;
    }
    if (at > i) out.push(src.slice(i, at));
    out.push(
      <mark key={`${keyBase}${k++}`} className={className}>
        {src.slice(at, at + ql.length)}
      </mark>,
    );
    i = at + ql.length;
  }
  return out;
}
