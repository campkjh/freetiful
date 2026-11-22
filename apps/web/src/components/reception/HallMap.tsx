'use client';

// 송년회 자리 배치도 — 받은 도면 그대로(261116 사장 '이거 송년회 좌석배치도인데 이거 완벽하게 구현해'). 좌표·선은 lib/reception/hall.ts.
// 처음엔 홀 전체가 폭에 맞게 보이고, 배치도를 누르거나 [크게 보기]를 누르면 2.5배로 커진다 — 누른 곳(버튼이면 내 테이블)이
// 화면의 같은 자리에 머문 채 커진다. 커진 뒤엔 옆으로 밀어서 본다. 글자(테이블 번호 등)는 HTML 로 얹어 작은 화면에서도 읽히게.
// table 없음 = 명단에서 못 찾은 손님(홀만 보여 줌) · seat 없음 = 명단에 테이블만 있는 손님(테이블만 빛냄).
import { useEffect, useRef, useState } from 'react';
import { SEATS_PER_TABLE } from '@/lib/reception/event';
import {
  CHAIR_DIST, CHAIR_SIZE, HALL_COLUMNS, HALL_LABELS, HALL_PATHS, HALL_TABLES, HALL_VIEW as V, STAGE_PILLARS, TABLE_R, seatAngle, type Pt,
} from '@/lib/reception/hall';

const pos = ([x, y]: Pt): React.CSSProperties => ({ left: `${((x - V.x) / V.w) * 100}%`, top: `${((y - V.y) / V.h) * 100}%` });
const r1 = (n: number) => Math.round(n * 10) / 10;
/** 기둥 속 H(도면 기호) */
const H_GLYPH = 'M-2.4 -2.6V2.6M2.4 -2.6V2.6M-2.4 0H2.4';

/** 좌석 s 의 중심 */
function chairAt(t: { x: number; y: number }, s: number) {
  const a = (seatAngle(s) * Math.PI) / 180;
  return { x: r1(t.x + Math.cos(a) * CHAIR_DIST), y: r1(t.y + Math.sin(a) * CHAIR_DIST), rot: seatAngle(s) + 90 };
}

/** 위에서 본 팔걸이 의자 — 위쪽이 등받이, 아래(방석)가 테이블 쪽. me = 방석까지 진하게 */
function ChairSymbol({ id, me }: { id: string; me?: boolean }) {
  return (
    <symbol id={id} viewBox="0 0 24 24">
      <path d="M3 6.2C3 3.9 4.9 2 7.2 2h9.6C19.1 2 21 3.9 21 6.2V8H3z" fill="currentColor" />
      <rect x="2" y="6.5" width="4.4" height="14" rx="2.2" fill="currentColor" />
      <rect x="17.6" y="6.5" width="4.4" height="14" rx="2.2" fill="currentColor" />
      <rect x="7.2" y="8.6" width="9.6" height="12.4" rx="2.6" fill="currentColor" opacity={me ? 1 : 0.6} />
    </symbol>
  );
}

export default function HallMap({ table, seat }: { table: number | null; seat: number | null }) {
  const [zoomed, setZoomed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const mine = HALL_TABLES.find((t) => t.n === table);
  const myChair = mine && seat ? chairAt(mine, seat) : null;

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** 확대·축소 — 배치도 안의 한 점(fx, fy)이 화면의 같은 자리(vx, vy)에 머물게 커지는 동안 매 프레임 스크롤을 맞춘다 */
  const zoomTo = (next: boolean, at?: { clientX: number; clientY: number }) => {
    const el = box.current;
    const m = map.current;
    if (!el || !m) return;
    const r = m.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    let fx = 0.5;
    let fy = 0.5;
    if (at) {
      fx = (at.clientX - r.left) / r.width;
      fy = (at.clientY - r.top) / r.height;
    } else if (mine) {
      fx = (mine.x - V.x) / V.w;
      fy = (mine.y - V.y) / V.h;
    }
    const vx = Math.min(Math.max(r.left + fx * r.width, b.left + 24), b.right - 24);
    const vy = r.top + fy * r.height;
    setZoomed(next);
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = () => {
      const now = m.getBoundingClientRect();
      el.scrollLeft += now.left + fx * now.width - vx;
      const dy = now.top + fy * now.height - vy;
      // html 은 scroll-behavior: smooth 라 즉시 이동을 따로 지정(안 하면 매 프레임 부드러운 스크롤끼리 싸운다)
      if (Math.abs(dy) > 0.5) window.scrollTo({ top: window.scrollY + dy, behavior: 'instant' as ScrollBehavior });
      if (performance.now() - t0 < 700) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <div className={`rc-hall ${zoomed ? 'zoomed' : ''}`}>
      <div className="rc-hallmap" ref={box}>
        <div
          className="rc-hallmap-in"
          ref={map}
          onClick={zoomed ? undefined : (e) => zoomTo(true, e)}
        >
          <svg
            className="rc-hall-svg"
            viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}
            role="img"
            aria-label={`자리 배치도 — 무대 아래 원탁 ${HALL_TABLES.length}개.${mine ? ` 내 자리는 ${table}번 테이블${seat ? ` ${seat}번 좌석` : ''}` : ''}`}
          >
            <defs>
              <clipPath id="rc-hall-clip"><path d={HALL_PATHS.floor} /></clipPath>
              <ChairSymbol id="rc-chair" />
              <ChairSymbol id="rc-chair-me" me />
            </defs>

            {/* 건물·홀 바닥 */}
            <path d={HALL_PATHS.building} className="rc-h-building" />
            <path d={HALL_PATHS.floor} className="rc-h-floor" />

            {/* 무대 */}
            <path d={HALL_PATHS.stage} className="rc-h-stage" />
            <ellipse {...HALL_PATHS.stageOval} className="rc-h-oval" clipPath="url(#rc-hall-clip)" />
            <path d={HALL_PATHS.stageDashed} className="rc-h-dash" />
            <path d={HALL_PATHS.stairs} className="rc-h-stairs" />
            <path d={HALL_PATHS.crescents} className="rc-h-crescent" />
            <rect x={HALL_PATHS.screen.x} y={HALL_PATHS.screen.y} width={HALL_PATHS.screen.w} height={HALL_PATHS.screen.h} rx={1.5} className="rc-h-screen" />
            <path d={HALL_PATHS.stageLip} className="rc-h-lip" />
            {STAGE_PILLARS.map(([x, y]) => (
              <g key={x} transform={`translate(${x} ${y})`}>
                <circle r={8.5} className="rc-h-pillar" />
                <path d={H_GLYPH} transform="scale(1.4)" className="rc-h-pillar-h" />
              </g>
            ))}

            {/* 벽·문 */}
            <path d={HALL_PATHS.innerWall} className="rc-h-wall-in" />
            <path d={HALL_PATHS.colLineA} className="rc-h-colline" />
            <path d={HALL_PATHS.colLineB} className="rc-h-colline" />
            <path d={HALL_PATHS.foyer} className="rc-h-foyer" />
            <path d={HALL_PATHS.doors} className="rc-h-door" />
            <path d={HALL_PATHS.canopy} className="rc-h-canopy" />
            <path d={HALL_PATHS.exits} className="rc-h-exit" />
            <path d={HALL_PATHS.counter} className="rc-h-counter" />
            <path d={HALL_PATHS.outerWall} className="rc-h-wall" />
            {HALL_COLUMNS.map((c) => (
              <g key={`${c.x}-${c.y}`} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
                <rect x={-7} y={-7} width={14} height={14} rx={1.5} className="rc-h-col" />
                <circle r={4.6} className="rc-h-col-ring" />
                <path d={H_GLYPH} transform="scale(0.8)" className="rc-h-col-h" />
              </g>
            ))}

            {/* 원탁 + 의자 8 */}
            {HALL_TABLES.map((t) => {
              const isMine = t.n === table;
              return (
                <g key={t.n} className={`rc-h-table ${isMine ? 'mine' : ''}`}>
                  {Array.from({ length: SEATS_PER_TABLE }, (_, i) => {
                    const s = i + 1;
                    const c = chairAt(t, s);
                    const me = isMine && s === seat;
                    const size = me ? CHAIR_SIZE * 1.3 : CHAIR_SIZE;
                    return (
                      <use
                        key={s}
                        href={me ? '#rc-chair-me' : '#rc-chair'}
                        x={-size / 2}
                        y={-size / 2}
                        width={size}
                        height={size}
                        transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}
                        className={`rc-h-chair ${me ? 'me' : ''}`}
                      />
                    );
                  })}
                  <circle cx={t.x} cy={t.y} r={TABLE_R} className="rc-h-top" />
                </g>
              );
            })}
            {myChair && <circle cx={myChair.x} cy={myChair.y} r={7.5} className="rc-h-ping" />}
          </svg>

          <div className="rc-hall-labels" aria-hidden="true">
            <span className="rc-h-stage-label" style={pos(HALL_LABELS.stage)}>STAGE</span>
            <span className="rc-h-entrance" style={pos(HALL_LABELS.entrance)}>입구</span>
            {HALL_TABLES.map((t) => (
              <span key={t.n} className={`rc-h-no ${t.n === table ? 'mine' : ''}`} style={pos([t.x, t.y])}>{t.n}</span>
            ))}
            {mine && <span className="rc-h-pin" style={pos([mine.x, mine.y - TABLE_R - 15])}>{seat ? '내 자리' : '내 테이블'}</span>}
          </div>
        </div>
      </div>

      <div className="rc-hall-bar">
        <span className="rc-hall-legend">
          {mine && <><i className="t" />내 테이블</>}
          {myChair && <><i className="s" />내 좌석</>}
        </span>
        <button type="button" className="rc-hall-zoom" aria-pressed={zoomed} onClick={() => zoomTo(!zoomed)}>
          {zoomed ? '전체 보기' : '크게 보기'}
        </button>
      </div>
    </div>
  );
}
