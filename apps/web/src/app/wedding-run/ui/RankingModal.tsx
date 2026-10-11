'use client';

// 웨딩런 랭킹 화면(261011 사장 사양서 [8]·[9] — 오늘/이번 주/전체 탭 · 상위 3명 강조 · 일반 순위 목록 · 내 순위 하단 고정 ·
//   첫 플레이 전 '첫 기록을 남겨보세요' · 닫기(close.png))
//  · 데이터는 ranking.ts(loadBoard)만 — 서버가 없으면(404·네트워크) '랭킹 준비 중' + 개인 최고기록·첫 완주·최대 도달 구간.
//    가짜 참여자·순위는 어디에도 만들지 않는다.
//  · 기간 경계는 서버(한국 시간: 오늘=자정부터, 이번 주=월요일 0시부터).
//  · (261011 검증 반영) 서버 없음에서도 첫 플레이 전이면 '첫 기록을 남겨보세요' · 하단 '나 · 닉네임' 은 서버가 순위에 보여 주는 이름 우선
//    · 탭 = tablist/tab/tabpanel 연결(aria-controls).
import { useCallback, useEffect, useState } from 'react';
import { WR_CHAR } from '../assets';
import { loadBoard, type BoardOutcome, type WrPeriod } from '../ranking';
import { Dim, ImgButton, ModalPanel } from './parts';
import { fmtScore, progressLabel } from './text';

const TABS: Array<{ key: WrPeriod; label: string }> = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'all', label: '전체' },
];

const MEDAL = ['linear-gradient(180deg,#ffd76a,#e8a93a)', 'linear-gradient(180deg,#d9dde8,#a9b1c4)', 'linear-gradient(180deg,#f5c09a,#cf8a5c)'];
const POD_H = [64, 46, 34];

type Slot = { status: 'loading' } | BoardOutcome;

export default function RankingModal({
  best,
  firstClear,
  maxProgress,
  nickname,
  refreshKey,
  onClose,
  onNickname,
}: {
  best: number;
  firstClear: boolean;
  maxProgress: number;
  nickname: string;
  /** 점수를 새로 올리면 바뀜 → 다시 받음 */
  refreshKey: number;
  onClose: () => void;
  onNickname: () => void;
}) {
  const [period, setPeriod] = useState<WrPeriod>('today');
  const [slots, setSlots] = useState<Partial<Record<WrPeriod, Slot>>>({});

  const load = useCallback((p: WrPeriod, force: boolean) => {
    setSlots((s) => (force || !s[p] || s[p]!.status !== 'ok' ? { ...s, [p]: { status: 'loading' } } : s));
    loadBoard(p, force).then((res) => setSlots((s) => ({ ...s, [p]: res })));
  }, []);

  useEffect(() => {
    load(period, false);
  }, [period, load, refreshKey]);

  const slot = slots[period];
  const unavailable = slot?.status === 'unavailable';
  const data = slot && slot.status === 'ok' ? slot.data : null;
  const top = data?.top ?? [];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const neverPlayed = best <= 0;
  // 하단 고정 줄의 내 이름 = 순위표에 실제로 보이는 이름(서버) — 없으면 기기에 저장한 이름
  const myName = data?.me?.nickname || nickname;
  const panelA11y = { role: 'tabpanel', id: 'wr-rank-panel', 'aria-labelledby': `wr-tab-${period}` } as const;

  return (
    <Dim onBackdrop={onClose}>
      <ModalPanel className="wr-rank" label="랭킹">
        <div className="wr-panel-close">
          <ImgButton ui="close" width="calc(var(--u) * 38)" label="닫기" onClick={onClose} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--u) * 10)' }}>
          <h2 className="wr-h2">랭킹</h2>
          {!unavailable && (
            <div className="wr-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  id={`wr-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={period === t.key}
                  aria-controls="wr-rank-panel"
                  tabIndex={period === t.key ? 0 : -1}
                  className={`wr-tab${period === t.key ? ' is-on' : ''}`}
                  onClick={() => setPeriod(t.key)}
                  onKeyDown={(e) => {
                    // 탭 목록 화살표 이동(WAI-ARIA tabs)
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    e.preventDefault();
                    const i = TABS.findIndex((x) => x.key === period);
                    const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                    setPeriod(n.key);
                    document.getElementById(`wr-tab-${n.key}`)?.focus();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {unavailable ? (
          <div className="wr-empty">
            <img src={WR_CHAR[4].frames.celebrate.src} alt="" draggable={false} style={{ width: 'calc(var(--u) * 120)' }} />
            <h3 className="wr-h2">랭킹 준비 중</h3>
            <p className="wr-sub">랭킹 서버가 열리면 이곳에서 다른 예랑·예신과 순위를 겨룰 수 있어요.</p>
            {neverPlayed && <p className="wr-sub wr-first-rec">첫 기록을 남겨보세요</p>}
            <div className="wr-stats" style={{ maxWidth: 'calc(var(--u) * 360)' }}>
              <div className="wr-stat">
                <span>내 최고기록</span>
                <b className={best > 0 ? '' : 'is-muted'}>{best > 0 ? `${fmtScore(best)}점` : '아직 없음'}</b>
              </div>
              <div className="wr-stat">
                <span>첫 완주</span>
                <b className={firstClear ? '' : 'is-muted'}>{firstClear ? '신혼집 입주 완료' : '도전 중'}</b>
              </div>
              <div className="wr-stat">
                <span>가장 멀리</span>
                <b className={maxProgress > 0 || best > 0 ? '' : 'is-muted'}>{maxProgress > 0 || best > 0 ? progressLabel(maxProgress) : '아직 없음'}</b>
              </div>
            </div>
          </div>
        ) : !slot || slot.status === 'loading' ? (
          <div className="wr-empty" {...panelA11y}>
            <p className="wr-sub">순위를 불러오는 중…</p>
          </div>
        ) : slot.status === 'error' ? (
          <div className="wr-empty" {...panelA11y}>
            <p className="wr-sub">순위를 불러오지 못했어요.</p>
            <button type="button" className="wr-pill-btn" onClick={() => load(period, true)}>
              다시 불러오기
            </button>
          </div>
        ) : top.length === 0 ? (
          <div className="wr-empty" {...panelA11y}>
            <img src={WR_CHAR[0].frames.run_02.src} alt="" draggable={false} />
            <h3 className="wr-h2">첫 기록을 남겨보세요</h3>
            <p className="wr-sub">{period === 'today' ? '오늘은 아직 아무도 달리지 않았어요.' : period === 'week' ? '이번 주 첫 주자가 되어 보세요.' : '가장 먼저 신혼집에 도착해 보세요.'}</p>
          </div>
        ) : (
          <div className="wr-rank-main" {...panelA11y}>
            <div className="wr-podium" aria-label="상위 3명">
              {[1, 0, 2].map((i) => {
                const row = podium[i];
                if (!row) return <div key={i} className="wr-pod" />;
                return (
                  <div key={i} className={`wr-pod${row.isMe ? ' is-me' : ''}`}>
                    <span className="wr-pod-medal" style={{ background: MEDAL[i] }}>
                      {row.rank}
                    </span>
                    <span className="wr-pod-name" title={row.nickname}>
                      {row.nickname}
                    </span>
                    <span className="wr-pod-score">{fmtScore(row.score)}</span>
                    <span className="wr-pod-block" style={{ height: `calc(var(--u) * ${POD_H[i]})` }} />
                  </div>
                );
              })}
            </div>
            <div className="wr-list" aria-label="순위 목록">
              {rest.length === 0 ? (
                <p className="wr-sub" style={{ marginTop: 'calc(var(--u) * 20)' }}>
                  {data ? `지금 ${fmtScore(data.participants)}명이 달렸어요` : ''}
                </p>
              ) : (
                rest.map((row) => (
                  <div key={`${row.rank}-${row.nickname}`} className={`wr-row${row.isMe ? ' is-me' : ''}`}>
                    <span className="wr-row-rank">{row.rank}</span>
                    <span className="wr-row-name">{row.nickname}</span>
                    {row.arrived && <span className="wr-row-reach">신혼집 입주</span>}
                    <span className="wr-row-score">{fmtScore(row.score)}점</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 내 순위 하단 고정 */}
        {!unavailable && (
          <div className="wr-mine">
            {data?.me ? (
              <>
                <span className="wr-row-rank">{fmtScore(data.me.rank)}위</span>
                <span className="wr-row-name">나 · {myName}</span>
                <span className="wr-row-reach">{fmtScore(data.participants)}명 중</span>
                <span className="wr-row-score">{fmtScore(data.me.best)}점</span>
              </>
            ) : neverPlayed ? (
              <span className="wr-row-name">첫 기록을 남겨보세요 · {nickname}</span>
            ) : (
              <span className="wr-row-name">
                {period === 'today' ? '오늘' : period === 'week' ? '이번 주' : '랭킹에'} 등록된 기록이 아직 없어요 · 내 최고 {fmtScore(best)}점
              </span>
            )}
            <button type="button" className="wr-nick-btn" onClick={onNickname}>
              닉네임 바꾸기
            </button>
          </div>
        )}
      </ModalPanel>
    </Dim>
  );
}
