'use client';

// 웨딩런 진입 화면(261011 사장 사양서 [8] — 게임명 · 신부 캐릭터와 서울 배경 · 게임 시작/랭킹/사운드 · 내 최고기록 · 짧은 안내)
//  · 바탕 = entry-illustration(벚꽃 서울 + 손잡고 달리는 신랑신부, 키 비주얼) — 오른쪽 커플이 보이게 자르고 왼쪽에 글자.
//  · 게임 시작 = start.png(엔진 준비 전엔 로딩 진행 막대 + 흐리게), 랭킹 = ranking.png, 사운드 = sound/sound_off.png, 홈 = home.png.
//  · 도전 링크로 들어오면 '1,280점에 도전!' 배너(검증 기록 / 친구가 보낸 목표 구분).
import { WR_ENTRY } from '../assets';
import type { Challenge } from '../share';
import { ImgButton } from './parts';
import { fmtScore, progressLabel, reachShort } from './text';

export default function Entry({
  ready,
  progress,
  failed,
  best,
  firstClear,
  maxProgress,
  soundOn,
  challenge,
  onStart,
  onRanking,
  onSound,
  onHome,
  onHelp,
  onRetryLoad,
}: {
  ready: boolean;
  /** 0~1, 엔진이 아직 진행을 안 보냈으면 null */
  progress: number | null;
  failed: boolean;
  best: number;
  firstClear: boolean;
  maxProgress: number;
  soundOn: boolean;
  challenge: Challenge | null;
  onStart: () => void;
  onRanking: () => void;
  onSound: () => void;
  onHome: () => void;
  onHelp: () => void;
  onRetryLoad: () => void;
}) {
  const pct = progress == null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <section className="wr-entry" aria-label="웨딩런 시작 화면">
      <img className="wr-entry-art" src={WR_ENTRY.src} alt="벚꽃이 핀 서울에서 손잡고 달리는 신랑신부" draggable={false} />
      <div className="wr-entry-fade" />

      <div className="wr-entry-corner">
        <ImgButton ui={soundOn ? 'sound' : 'sound_off'} width="calc(var(--u) * 42)" label={soundOn ? '소리 끄기' : '소리 켜기'} onClick={onSound} />
        <ImgButton ui="home" width="calc(var(--u) * 42)" label="프리티풀 홈으로" onClick={onHome} />
      </div>

      <div className="wr-entry-col">
        <span className="wr-entry-tag">프리티풀 미니게임</span>
        <h1 className="wr-title" aria-label="웨딩런: 신혼집까지 달려!">
          <span className="wr-title-main">웨딩런:</span>
          <span className="wr-title-sub">신혼집까지 달려!</span>
        </h1>
        <p className="wr-entry-guide">점프하고, 슬라이드하고, 신혼집까지!</p>

        {challenge && (
          <div className="wr-challenge" role="note">
            <small>{challenge.kind === 'verified' ? '검증된 기록' : '친구가 보낸 목표'}</small>
            <span>
              {challenge.nickname ? `${challenge.nickname}님의 ` : ''}
              {fmtScore(challenge.score)}점에 도전!
              {challenge.kind === 'verified' ? ` (${reachShort(challenge)})` : ''}
            </span>
          </div>
        )}

        <div className="wr-entry-best">
          {best > 0 ? (
            <>
              <span>내 최고기록</span>
              <b className="wr-score-num">{fmtScore(best)}점</b>
              {firstClear ? <span className="wr-badge">신혼집 입주 완료</span> : maxProgress > 0 ? <span className="wr-badge is-lav">최대 {progressLabel(maxProgress)}</span> : null}
            </>
          ) : (
            <span>아직 기록이 없어요 — 첫 기록을 남겨 보세요</span>
          )}
        </div>

        <div className="wr-entry-btns">
          {failed ? (
            <div className="wr-fail">
              <span className="wr-loading-txt">게임을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.</span>
              <button type="button" className="wr-pill-btn" onClick={onRetryLoad}>
                다시 불러오기
              </button>
            </div>
          ) : (
            !ready && (
              <div className="wr-loading" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="게임 불러오는 중">
                <div className={`wr-loading-bar${pct == null ? ' is-indet' : ''}`}>
                  <i style={{ width: `${pct ?? 0}%` }} />
                </div>
                <span className="wr-loading-txt">{pct == null ? '게임 준비 중…' : `웨딩 준비물 챙기는 중… ${pct}%`}</span>
              </div>
            )
          )}
          <ImgButton ui="start" width="calc(var(--u) * 236)" label="게임 시작" onClick={onStart} disabled={!ready} />
          <div className="wr-entry-row">
            <ImgButton ui="ranking" width="calc(var(--u) * 150)" label="랭킹" onClick={onRanking} />
            <button type="button" className="wr-link" onClick={onHelp}>
              조작 방법
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
