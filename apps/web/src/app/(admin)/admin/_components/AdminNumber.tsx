'use client';

import { useEffect, useState } from 'react';

const ROLL_STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 다이얼 숫자 — 홈 상단 숫자 칸 그대로(261005 사장 '각 수치 섹션에 수치들 애니메이션 추가해주고 홈처럼').
 *  자리마다 0~9 띠가 위로 굴러가 제 숫자에 멈춘다(오른쪽 자리부터 조금씩 늦게, 감속 곡선).
 *  띠는 0~9 를 두 번 이어 붙여 두 번째 바퀴에 멈추게 해 '도는' 느낌을 낸다.
 *  · 처음 뜰 때 0 → 값으로 굴러가고, 값이 바뀌면(새로고침·거르기) 그 자리로 다시 굴러간다.
 *  · 같은 값이 다시 오면(주기 새로고침) 띠 위치가 그대로라 다시 돌지 않는다 — 그래서 이 칸은 로딩 중에도 내리지 말 것.
 *  · 자리 칸 폭 = tabular 숫자 폭, 높이 = 1.25em 고정 → 도는 동안 줄 높이·폭이 안 바뀐다.
 *  · 동작 줄이기(prefers-reduced-motion)면 CSS 가 전환을 끈다(바로 값). */
export function RollingNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const safe = Number.isFinite(value) ? value : 0;
  const text = Math.abs(safe).toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const shown = safe < 0 ? `-${text}` : text;
  const chars = shown.split('');
  const digitsTotal = chars.filter((c) => /\d/.test(c)).length;
  let seen = 0;
  return (
    <span className="adm-roll">
      <span className="sr-only">{shown}</span>
      {chars.map((ch, i) => {
        // 자리 키는 오른쪽 기준 — 자릿수가 바뀌어도 같은 자리는 같은 칸
        const fromRight = chars.length - i;
        if (!/\d/.test(ch)) return <span key={`s${fromRight}`} className="adm-roll-sep" aria-hidden="true">{ch}</span>;
        const order = digitsTotal - (seen += 1); // 0 = 일의 자리
        return <RollColumn key={`d${fromRight}`} digit={Number(ch)} order={order} />;
      })}
    </span>
  );
}

/** 한 자리 — 칸마다 따로 '처음 뜸'을 안다: 0(로딩 중 자리표시)에서 1,234,000 처럼 자리가 새로 생겨도 새 자리는 0 에서 굴러온다 */
function RollColumn({ digit, order }: { digit: number; order: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setReady(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  return (
    <span className="adm-roll-col" aria-hidden="true">
      <span className="adm-roll-strip" style={{ transform: `translateY(${ready ? -((10 + digit) / 20) * 100 : 0}%)`, transitionDelay: `${order * 55}ms` }}>
        {ROLL_STRIP.map((n, k) => <span key={k}>{n}</span>)}
      </span>
    </span>
  );
}
