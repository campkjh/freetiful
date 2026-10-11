'use client';

// 웨딩런 종료 화면(261011 사장 사양서 [8] — 도달 결과 · 이번 점수 · 실제 랭킹 데이터가 있으면 순위와 참여 인원 · 내 최고기록 · 다음 목표 ·
//   다시 도전 / 내 기록 공유 / 랭킹 / 홈)
//  · modal_blank 를 가로로 넓혀 왼쪽 = 결과 글자, 오른쪽 = retry·share·ranking 버튼 이미지 + home.
//  · result_panel.png(예시 '1,280점·오늘 12위')는 쓰지 않는다 — 숫자는 전부 이번 판 실제 값.
//  · 순위 칸: 서버가 순위를 돌려줬을 때만 'N위 · M명'. 서버 없음 = '랭킹 준비 중'(가짜 순위 금지).
import type { SubmitOutcome } from '../ranking';
import type { Challenge } from '../share';
import { WR_CHAR } from '../assets';
import { Dim, ImgButton, ModalPanel } from './parts';
import { SEGMENT_COUNT, clampStage, fmtScore, reachHeadline, segmentName } from './text';
import type { WRResult } from './types';

export type ResultView = {
  result: WRResult;
  /** 이번 판 시작 때의 최고점 */
  prevBest: number;
  /** 저장 뒤 최고점 */
  best: number;
  /** 이번 판 전에 완주한 적 있나 */
  everArrived: boolean;
};

function nextGoal(v: ResultView, submit: SubmitOutcome | null, challenge: Challenge | null): string {
  const { result: r } = v;
  // (261011 검증 E3) 도전 목표는 아직 못 넘었을 때만(이전 판 포함 최고기록이 목표 이상이면 내 기록·순위 기준으로)
  if (challenge && r.score < challenge.score && v.best < challenge.score) return `도전 목표 ${fmtScore(challenge.score)}점까지 ${fmtScore(challenge.score - r.score)}점 남았어요`;
  if (challenge && v.best >= challenge.score && submit?.status === 'ok' && !submit.res.held && submit.res.top10Gap != null && submit.res.top10Gap > 0)
    return `다음 목표: 오늘 TOP10까지 ${fmtScore(submit.res.top10Gap)}점`;
  if (!v.everArrived && !r.arrived) {
    const s = Math.max(0, Math.min(SEGMENT_COUNT - 1, r.segment));
    return s >= SEGMENT_COUNT - 1 ? '다음 목표: 신혼집 입주 완료!' : `다음 목표: ${segmentName(s + 1)}까지 가 보기`;
  }
  if (submit?.status === 'ok' && submit.res.nextGoal) return `다음 목표: 오늘 ${submit.res.nextGoal.rank}위까지 ${fmtScore(submit.res.nextGoal.gap)}점`;
  if (r.score < v.best) return `다음 목표: 최고기록까지 ${fmtScore(v.best - r.score)}점`;
  const step = r.score < 1000 ? 100 : r.score < 10000 ? 500 : 1000;
  const target = (Math.floor(r.score / step) + 1) * step;
  return `다음 목표: ${fmtScore(target)}점 돌파`;
}

/** 단계별 신부 얼굴 가운데(run_02 프레임 px) — 얼굴 원 그림용, 프레임 알파로 머리 위치를 재서 정함 */
const FACE: Array<[number, number]> = [
  [483, 168],
  [469, 127],
  [455, 140],
  [557, 143],
  [380, 136],
];

function CharFace({ stage }: { stage: number }) {
  const i = clampStage(stage);
  const c = WR_CHAR[i];
  const f = c.frames.run_02;
  const [fx, fy] = FACE[i];
  const d = c.refH * 0.42; // 원 지름 = 몸 높이의 42%
  const style = {
    width: `${(f.w / d) * 100}%`,
    left: `${(0.5 - fx / d) * 100}%`,
    top: `${(0.5 - fy / d) * 100}%`,
  };
  return (
    <span className="wr-result-char" aria-hidden>
      <img src={f.src} alt="" draggable={false} style={style} />
    </span>
  );
}

export default function ResultModal({
  view,
  submit,
  challenge,
  onRetry,
  onShare,
  onRanking,
  onHome,
}: {
  view: ResultView;
  submit: SubmitOutcome | null;
  challenge: Challenge | null;
  onRetry: () => void;
  onShare: () => void;
  onRanking: () => void;
  onHome: () => void;
}) {
  const r = view.result;
  const newBest = view.prevBest > 0 && r.score > view.prevBest;
  const firstRecord = view.prevBest <= 0 && r.score > 0;
  const where = r.laps > 0 ? `다음 여정 ${r.laps + 1}바퀴째 · ${segmentName(r.segment)}` : `${SEGMENT_COUNT}구간 중 ${Math.min(SEGMENT_COUNT, r.segment + 1)}구간 · ${segmentName(r.segment)}`;

  let rankLabel = '오늘 순위';
  let rankValue: string;
  let rankSub: string | null = null;
  let rankMuted = false;
  if (!submit) {
    rankValue = '확인 중…';
    rankMuted = true;
  } else if (submit.status === 'ok' && submit.res.held) {
    // 자동 보류(사람이 내기 어려운 판) — 운영 확인 뒤 순위에 반영(261011 검증 반영)
    rankLabel = '랭킹';
    rankValue = '기록 확인 중';
    rankSub = '확인 뒤 랭킹에 반영돼요';
    rankMuted = true;
  } else if (submit.status === 'ok') {
    rankValue = `${fmtScore(submit.res.today.rank)}위`;
    rankSub = `오늘 ${fmtScore(submit.res.today.participants)}명 참여`;
  } else if (submit.status === 'rejected') {
    rankLabel = '랭킹';
    rankValue = '등록 못 함';
    rankSub = submit.message;
    rankMuted = true;
  } else if (submit.status === 'skipped') {
    rankLabel = '랭킹';
    rankValue = '이번 판 미등록';
    // 429(같은 와이파이에서 판이 몰림)와 연결 지연을 나눠 안내(261011 검증 반영 — 예전엔 둘 다 '연결이 늦었어요')
    rankSub = submit.reason === 'busy' ? '요청이 몰려 잠시 등록을 쉬어요' : '서버 연결이 늦었어요';
    rankMuted = true;
  } else {
    rankLabel = '랭킹';
    rankValue = '랭킹 준비 중';
    rankSub = '개인 기록은 저장됐어요';
    rankMuted = true;
  }

  return (
    <Dim>
      <ModalPanel className="wr-result" label="게임 결과" restoreFocus={false}>
        <div className="wr-result-info">
          <div className="wr-result-reach">
            <CharFace stage={r.stage} />
            <div>
              <h2 className="wr-h1" style={{ textAlign: 'left' }}>
                {reachHeadline(r)}
              </h2>
              <p className="wr-sub" style={{ textAlign: 'left' }}>
                {where}
              </p>
            </div>
          </div>
          <div className="wr-result-scoreline">
            <span className="wr-result-score wr-score-num">
              {fmtScore(r.score)}
              <small>점</small>
            </span>
            {(newBest || firstRecord) && <span className="wr-newbest">{newBest ? '최고기록 경신!' : '첫 기록!'}</span>}
          </div>
          <div className="wr-stats">
            <div className="wr-stat">
              <span>{rankLabel}</span>
              <b className={rankMuted ? 'is-muted' : ''}>{rankValue}</b>
              {rankSub && <em title={rankSub}>{rankSub}</em>}
            </div>
            <div className="wr-stat">
              <span>내 최고기록</span>
              <b>{fmtScore(view.best)}점</b>
              <em>{view.everArrived || r.arrived ? '신혼집 입주 완료' : '첫 완주 도전 중'}</em>
            </div>
            <div className="wr-stat">
              <span>모은 하트</span>
              <b>{fmtScore(r.hearts)}개</b>
              <em>축의금 봉투 {fmtScore(r.envelopes)}개</em>
            </div>
          </div>
          <div className="wr-goal">{nextGoal(view, submit, challenge)}</div>
        </div>
        <div className="wr-result-btns">
          <ImgButton ui="retry" width="calc(var(--u) * 184)" label="다시 도전" onClick={onRetry} />
          <ImgButton ui="share" width="calc(var(--u) * 184)" label="내 기록 공유" onClick={onShare} />
          <ImgButton ui="ranking" width="calc(var(--u) * 176)" label="랭킹" onClick={onRanking} />
          <div className="wr-icon-btn" style={{ flexDirection: 'row', gap: 'calc(var(--u) * 6)' }}>
            <ImgButton ui="home" width="calc(var(--u) * 40)" label="홈으로" onClick={onHome} />
            <span>홈으로</span>
          </div>
        </div>
      </ModalPanel>
    </Dim>
  );
}
