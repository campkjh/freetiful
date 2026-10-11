'use client';

// 웨딩런 플레이 HUD(261011 사장 사양서 [8] 플레이 화면)
//  · 상단 중앙: 현재 점수(hud_blank 빈 점수판 위 동적 숫자) · 그 아래 최고기록 비교 한 줄(+보호막 표시)
//  · 상단 왼쪽: 현재 구간 + 신혼집까지 진행(12구간 눈금, 끝에 home 아이콘) · 우측 상단: 일시정지(pause.png)
//  · 점수는 엔진이 매 프레임 보내도 React 를 다시 그리지 않는다 — liveRef 를 rAF 로 읽어 바뀐 글자만 DOM 에 쓴다.
import { useEffect, useRef, type MutableRefObject } from 'react';
import { WR_UI } from '../assets';
import { HudPill, ImgButton } from './parts';
import { SEGMENT_COUNT, fmtScore, segmentName } from './text';

export type LiveState = { score: number; toHome: number; segment: number; stage: number; lap: number };

export default function Hud({
  liveRef,
  bestRef,
  challengeScore,
  segment,
  lap,
  shieldOn,
  onPause,
}: {
  liveRef: MutableRefObject<LiveState>;
  /** 이번 판 시작 때의 최고점(비교 기준) */
  bestRef: MutableRefObject<number>;
  /** 도전 링크 목표 점수(없으면 null) */
  challengeScore: number | null;
  segment: number;
  /** 지금 몇 번째 여정(1부터) */
  lap: number;
  shieldOn: boolean;
  onPause: () => void;
}) {
  const scoreEl = useRef<HTMLSpanElement>(null);
  const bestEl = useRef<HTMLSpanElement>(null);
  const barEl = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastScore = -1;
    let lastBest = '';
    let lastBeat = false;
    let lastBar = -1;
    /** 이번 판에 도전 목표를 넘은 시각(ms) — 잠깐 '돌파!'를 보여 준 뒤 내 최고기록 기준으로 바꾼다 */
    let goalBeatAt = 0;
    const tick = () => {
      const s = liveRef.current;
      const score = Math.max(0, Math.floor(s.score));
      if (score !== lastScore && scoreEl.current) {
        scoreEl.current.textContent = fmtScore(score);
        lastScore = score;
      }
      const best = bestRef.current;
      let text: string;
      let beat = false;
      // (261011 검증 E3) 도전 링크 목표는 '아직 못 넘었을 때'만 — 이미 넘었으면(이전 판 최고기록 ≥ 목표) 처음부터 내 최고기록 기준,
      // 이번 판에 넘은 뒤엔 비교 기준 = max(최고기록, 목표)
      const goalOn = !!challengeScore && best < challengeScore;
      // (261011 검증 E3 low) 이번 판에 목표를 넘으면 2.5초만 '도전 목표 돌파!' → 그다음은 내 최고기록 기준(최고기록이 없으면 목표 기준 그대로)
      if (goalOn && score >= challengeScore! && !goalBeatAt) goalBeatAt = performance.now();
      if (score < 1) goalBeatAt = 0; // 다시 도전(점수 0부터)
      const goalFresh = goalBeatAt > 0 && performance.now() - goalBeatAt < 2500;
      if (goalOn && score < challengeScore!) text = `도전 목표 ${fmtScore(challengeScore!)}점까지 ${fmtScore(challengeScore! - score)}점`;
      else if (best > 0 && score <= best) text = `최고기록 ${fmtScore(best)}점까지 ${fmtScore(best - score)}점`;
      else if (goalOn && (goalFresh || best <= 0)) {
        text = `도전 목표 돌파! +${fmtScore(score - challengeScore!)}점`;
        beat = true;
      } else if (best > 0) {
        text = `최고기록 경신 중! +${fmtScore(score - best)}점`;
        beat = true;
      } else text = '첫 기록 도전 중';
      if (text !== lastBest && bestEl.current) {
        bestEl.current.textContent = text;
        lastBest = text;
      }
      if (beat !== lastBeat && bestEl.current) {
        bestEl.current.classList.toggle('is-beat', beat);
        lastBeat = beat;
      }
      const bar = Math.round(Math.max(0, Math.min(1, s.toHome)) * 1000) / 10;
      if (bar !== lastBar && barEl.current) {
        barEl.current.style.width = `${bar}%`;
        lastBar = bar;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [liveRef, bestRef, challengeScore]);

  return (
    <div className="wr-hud">
      {/* 상단 왼쪽 — 현재 구간·신혼집까지 */}
      <div className="wr-route" aria-label={`현재 구간 ${segmentName(segment)}`}>
        <HudPill>
          <div className="wr-route-in">
            <div className="wr-route-top">
              <span className="wr-route-name">{segmentName(segment)}</span>
              {/* 다음 여정 N바퀴째 — 짧게 'N바퀴'(긴 구간 이름이 좁은 폰에서 잘리지 않게, 261011 검증 low) */}
              {lap > 1 && (
                <span className="wr-lap" title={`다음 여정 ${lap}바퀴째`} aria-label={`다음 여정 ${lap}바퀴째`}>
                  {lap}바퀴
                </span>
              )}
              <span className="wr-route-step">
                {segment + 1}/{SEGMENT_COUNT}
              </span>
            </div>
            <div className="wr-route-track">
              <div className="wr-route-bar">
                <i ref={barEl} />
                {Array.from({ length: SEGMENT_COUNT - 1 }, (_, i) => (
                  <b key={i} style={{ left: `${((i + 1) / SEGMENT_COUNT) * 100}%` }} />
                ))}
              </div>
              <span className="wr-route-home" title="신혼집">
                <img src={WR_UI.home.src} alt="" draggable={false} />
              </span>
            </div>
          </div>
        </HudPill>
      </div>

      {/* 상단 중앙 — 현재 점수 + 최고기록 비교 */}
      <div className="wr-score" aria-live="off">
        <HudPill>
          <span className="wr-score-val wr-score-num">
            <span ref={scoreEl}>0</span>
            <small>점</small>
          </span>
        </HudPill>
        <div className="wr-best-line">
          <span ref={bestEl} className="wr-best-chip">
            첫 기록 도전 중
          </span>
          {shieldOn && <span className="wr-shield-chip">보호막 1회</span>}
        </div>
      </div>

      {/* 우측 상단 — 일시정지 */}
      <div className="wr-hud-tr">
        <ImgButton ui="pause" width="calc(var(--u) * 44)" label="일시정지" onClick={onPause} />
      </div>
    </div>
  );
}
