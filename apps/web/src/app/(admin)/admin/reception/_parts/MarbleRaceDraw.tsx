'use client';

/* 한우 '핀볼 레이스'(261123 사장 'lazygyu 룰렛 이걸로 해서 지금 참가자 전원해서 … 딱 스타트하면 되게끔').
 *  · 물리 = lazygyu/roulette(MIT) 엔진을 광고 · 통계 · 외부 그림 없이 다시 묶은 정적 파일(public/reception/draw/race, 같은 출처 iframe).
 *  · 미리 정한 당첨자를 그리는 게 아니라 **구슬 물리가 당첨을 정한다** — 먼저 골인한 winners 명이 당첨, 끝나면 onFinish(골인 순서).
 *    기록은 부르는 쪽이 /draws/pick 으로(서버가 안 뽑힌 응모권 · 남은 경품인지 다시 본다).
 *  · 구슬 이름은 겹치면 안 된다(엔진은 이름으로만 알려 준다) — 동명이인은 '이름 · 번호'. 엔진이 '/', '*', ',' 를 특수 문자로 읽어서 빼 둔다. */
import { useEffect, useMemo, useRef, useState } from 'react';

/** id = 응모권 id(실제 추첨만 — 기록할 때 서버가 번호 주인을 대조) */
export type RaceEntrant = { number: number; name: string; id?: string };

const RACE_SRC = '/reception/draw/race/index.html';

type RaceApi = {
  isReady: () => boolean;
  setup: (names: string[], winners: number) => number;
  start: () => boolean;
  isStarted: () => boolean;
};

const clean = (s: string) => s.replace(/[\/*,\r\n]/g, ' ').replace(/\s+/g, ' ').trim() || '손님';

/** 구슬 이름(겹치지 않게) ↔ 응모권 */
export function raceLabels(entrants: readonly RaceEntrant[]) {
  const count = new Map<string, number>();
  for (const e of entrants) count.set(clean(e.name), (count.get(clean(e.name)) ?? 0) + 1);
  const byLabel = new Map<string, RaceEntrant>();
  const labels = entrants.map((e) => {
    const base = clean(e.name);
    let label = (count.get(base) ?? 0) > 1 ? `${base} ${e.number}` : base;
    while (byLabel.has(label)) label = `${label}'`;
    byLabel.set(label, e);
    return label;
  });
  return { labels, byLabel };
}

export function MarbleRaceDraw({ entrants, winners, running, onFinish, onError }: {
  entrants: readonly RaceEntrant[];
  /** 먼저 골인한 몇 명이 당첨인지 */
  winners: number;
  running: boolean;
  /** 골인 순서대로 당첨자 — 한 판에 한 번만 */
  onFinish: (ranked: RaceEntrant[]) => void;
  onError?: (message: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const started = useRef(false);
  const finished = useRef(false);
  const finishRef = useRef(onFinish);
  const errorRef = useRef(onError);
  finishRef.current = onFinish;
  errorRef.current = onError;
  // 부모가 다시 그릴 때마다 새 배열이 와도 같은 사람들이면 다시 놓지 않는다
  const key = entrants.map((e) => `${e.number}:${e.name}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const table = useMemo(() => raceLabels(entrants), [key]);
  const tableRef = useRef(table);

  const api = () => (frame.current?.contentWindow as (Window & { ftRace?: RaceApi }) | null)?.ftRace;
  const poll = useRef(0);
  useEffect(() => () => window.clearInterval(poll.current), []);
  /** 'ready' 알림을 놓쳐도(iframe 이 먼저 다 떴을 때) 직접 물어본다 — 15초 넘게 안 되면 오류로 알린다 */
  const watchReady = () => {
    window.clearInterval(poll.current);
    let tries = 0;
    poll.current = window.setInterval(() => {
      tries += 1;
      if (api()?.isReady()) {
        setReady(true);
        window.clearInterval(poll.current);
      } else if (tries > 150) {
        window.clearInterval(poll.current);
        errorRef.current?.('레이스 판을 불러오지 못했어요. 닫고 다시 열어 주세요.');
      }
    }, 100);
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { source?: string; type?: string; winners?: unknown };
      if (data?.source !== 'ft-race') return;
      if (data.type === 'ready') setReady(true);
      if (data.type === 'goal' && started.current && !finished.current) {
        const names = Array.isArray(data.winners) ? data.winners.filter((n): n is string => typeof n === 'string') : [];
        const ranked = names.map((n) => tableRef.current.byLabel.get(n));
        if (!ranked.length || ranked.some((r) => !r)) {
          errorRef.current?.('골인한 구슬 이름을 응모권과 맞추지 못했어요.');
          return;
        }
        finished.current = true;
        finishRef.current(ranked as RaceEntrant[]);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 시작 전에는 사람이 바뀌면 구슬을 다시 놓는다
  useEffect(() => {
    if (!ready || started.current) return;
    tableRef.current = table;
    api()?.setup(table.labels, Math.max(1, winners));
  }, [ready, table, winners]);

  useEffect(() => {
    if (!running || !ready || started.current) return;
    const race = api();
    if (!race) return;
    tableRef.current = table;
    started.current = true;
    finished.current = false;
    if (!race.start()) {
      started.current = false;
      errorRef.current?.('레이스를 시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    }
  }, [running, ready, table]);

  return (
    <div className="rpx-engine">
      <iframe ref={frame} src={RACE_SRC} title="핀볼 레이스" className="rpx-frame" onLoad={watchReady} />
      {!ready && <p className="rpx-loading">레이스 판을 준비하는 중…</p>}
    </div>
  );
}
