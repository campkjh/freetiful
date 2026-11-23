'use client';

/* 물리로 당첨을 정하는 무대(261123) — 한우 = 핀볼 레이스(구슬, 먼저 골인한 N명) · 체스타필드 = 공 배틀(마지막까지 남은 1명).
 *  · 다른 연출은 서버가 먼저 뽑고 그림이 따라가지만, 여기선 물리가 정하고 끝난 뒤 /draws/pick 으로 기록한다.
 *  · 판을 열면 참가자 전원이 이미 들어가 있고 [시작] 한 번이면 된다. 시작 전엔 [그만두기], 기록이 실패하면 [다시 기록].
 *  · run.id 가 바뀌면 엔진을 새로 띄운다(같은 판에서 다시 그리지 않게 key 로). */
import { FlagBattleDraw } from './FlagBattleDraw';
import { MarbleRaceDraw, type RaceEntrant } from './MarbleRaceDraw';
import './physics-draw.css';

export type PhysicsKind = 'marble' | 'battle';
export type PhysicsRun = {
  id: string;
  kind: PhysicsKind;
  entrants: RaceEntrant[];
  /** 당첨 수 — 구슬은 먼저 골인한 N명, 배틀은 늘 1명 */
  quantity: number;
  started: boolean;
  /** 끝난 순서(응모권 번호) — 기록 전이거나 기록 실패해도 남겨 둔다 */
  result?: number[];
  saving?: boolean;
  error?: string;
  preview?: boolean;
};

export function physicsKindOf(theme: string): PhysicsKind | null {
  return theme === 'pinball' ? 'marble' : theme === 'vault' ? 'battle' : null;
}

export function PhysicsDraw({ run, onStart, onFinish, onRetry, onCancel, onEngineError }: {
  run: PhysicsRun;
  onStart: () => void;
  onFinish: (numbers: number[]) => void;
  onRetry: () => void;
  onCancel: () => void;
  onEngineError: (message: string) => void;
}) {
  const n = run.entrants.length;
  return (
    <div className={`rpx rpx-${run.kind}${run.started ? ' started' : ''}`}>
      {run.kind === 'marble' ? (
        <MarbleRaceDraw key={run.id} entrants={run.entrants} winners={run.quantity} running={run.started} onFinish={(ranked) => onFinish(ranked.map((r) => r.number))} onError={onEngineError} />
      ) : (
        <FlagBattleDraw key={run.id} entrants={run.entrants} running={run.started} onFinish={(winner) => onFinish([winner.number])} title="체스타필드 배틀" />
      )}
      {!run.started && (
        <div className="rpx-ready">
          <p className="rpx-ready-text">
            {run.preview && <b>미리보기 · </b>}참가자 {n}명 · {run.kind === 'marble' ? `먼저 골인한 ${run.quantity}명 당첨` : '마지막까지 남은 1명 당첨'}
          </p>
          <div className="rpx-ready-actions">
            <button type="button" className="rpx-start" onClick={onStart}>시작</button>
            <button type="button" className="rpx-cancel" onClick={onCancel}>그만두기</button>
          </div>
        </div>
      )}
      {run.saving && <p className="rpx-status">당첨 기록 중…</p>}
      {run.error && (
        <div className="rpx-status error" role="alert">
          <p>{run.error}</p>
          <div className="rpx-ready-actions">
            {run.result && <button type="button" className="rpx-start" onClick={onRetry}>다시 기록</button>}
            <button type="button" className="rpx-cancel" onClick={onCancel}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
