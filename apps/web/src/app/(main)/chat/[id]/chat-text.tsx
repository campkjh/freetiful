import React from 'react';

/**
 * 채팅 본문 렌더 — @멘션 하이라이트 + URL 링크화.
 *
 * 기존 renderTextWithMentions 는 @멘션만 처리하고 URL 은 그냥 텍스트로 뒀다.
 * 그래서 채팅에 링크를 보내도 눌러지지 않았다(안드로이드·iOS 공통).
 * 여기서 <a> 로 감싸 실제로 열리게 한다.
 */

// 링크 뒤에 붙는 문장부호는 URL 에서 떼어낸다 ("...확인해보세요: https://a.com." 같은 케이스)
const TRAILING_PUNCT = /[.,!?;:)\]}>"'`·…]+$/;

const isUrlToken = (s: string) => /^(https?:\/\/|www\.)/i.test(s);

export function renderMessageText(text: string): React.ReactNode[] {
  const src = String(text ?? '');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  // 1) URL 기준으로 자른다(캡처 그룹이라 URL 조각도 배열에 남는다)
  for (const chunk of src.split(/(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi)) {
    if (!chunk) continue;

    if (isUrlToken(chunk)) {
      const tail = chunk.match(TRAILING_PUNCT)?.[0] ?? '';
      const url = tail ? chunk.slice(0, -tail.length) : chunk;
      const href = /^www\./i.test(url) ? `https://${url}` : url;
      nodes.push(
        <a
          key={`u${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          // 버블에 달린 핸들러(길게 눌러 답장 등)가 링크 탭을 삼키지 않도록
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 break-all"
        >
          {url}
        </a>,
      );
      if (tail) nodes.push(<span key={`t${key++}`}>{tail}</span>);
      continue;
    }

    // 2) URL 이 아닌 조각에서 @멘션 처리
    for (const part of chunk.split(/(@[\w가-힣]+)/g)) {
      if (!part) continue;
      if (part.startsWith('@')) {
        nodes.push(
          <span key={`m${key++}`} className="font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1 py-0.5 rounded">
            {part}
          </span>,
        );
      } else {
        nodes.push(<span key={`s${key++}`}>{part}</span>);
      }
    }
  }

  return nodes;
}

/** 기존 이름 유지(호출부 호환) */
export const renderTextWithMentions = renderMessageText;
