'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { clamp01, seg, useFrame, usePassProgress } from '../toss/scene';
import { prefersReducedMotion } from '../scroll-to';
import { ORG_CAPTION, ORG_CEO, ORG_HEAD, ORG_UNITS, type OrgUnit } from './content';
import { flag, put, useIsoLayoutEffect } from './motion';

/*
 * ⑤ 조직도(261009 사장 '선이 그려지며 카드가 나타남'). 구조는 예전 화면 그대로(대표 → C레벨 5 → 산하 팀 2개씩).
 * 스크롤 따라 선이 자란다(transform scale — 리렌더 없이): 대표 카드 → 세로 줄기 → 가로 막대(가운데에서 양쪽으로) →
 *   가운데 칸부터 바깥으로 세로 가지 → 가지 끝에 닿으면 임원 카드가 흐림→또렷 → 팀 가지 → 팀 칸.
 * 모바일 · 태블릿(<1024)은 세로 나무: 대표 카드 아래 왼쪽 줄기가 내려가며 칸마다 옆 가지 → 카드(팀은 카드 안 칩).
 * 김도윤 부대표(COO)는 산하 팀 · 보고 체계 자료가 없어 조직도에 칸을 지어내지 않았다(이사진 소개에만, 261009).
 * 움직임 줄이기면 다 그려진 상태.
 */

/** 가운데 칸에서 먼 순서로 늦게 */
const ORDER = ORG_UNITS.map((_, i) => Math.abs(i - (ORG_UNITS.length - 1) / 2));

function Ceo({ t, refEl }: { t: ReturnType<typeof useT>; refEl: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={refEl} className="cx-oc cx-ap">
      <span className="cx-oc-b">{ORG_CEO.badge}</span>
      <span className="cx-oc-n">{t(ORG_CEO.name)}</span>
      <span className="cx-oc-r">{t(ORG_CEO.role)}</span>
    </div>
  );
}

function Unit({ u, t, compact }: { u: OrgUnit; t: ReturnType<typeof useT>; compact?: boolean }) {
  return (
    <>
      <span className="cx-ou-b">{u.badge}</span>
      <span className="cx-ou-n">{t(u.name)}</span>
      <span className="cx-ou-r">{t(u.role)}</span>
      {compact && (
        <span className="cx-ou-teams">
          {u.teams.map((tm, j) => <span key={j} className="cx-ot-chip">{t(tm)}</span>)}
        </span>
      )}
    </>
  );
}

/* ─── 데스크톱: 위에서 아래로 퍼지는 나무 ─── */
function OrgDesk({ still }: { still: boolean }) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const ceoRef = useRef<HTMLDivElement | null>(null);
  const trunkRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const stubRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stub2Refs = useRef<(HTMLSpanElement | null)[]>([]);
  const teamRefs = useRef<(HTMLDivElement | null)[]>([]);
  const P = usePassProgress(rootRef, ['start 0.88', 'end 0.72']);

  const update = (p: number) => {
    const q = still ? 1 : p;
    flag(ceoRef.current, 'data-on', q > 0.02);
    put(trunkRef.current, 'transform', `scaleY(${seg(q, 0.06, 0.2).toFixed(4)})`);
    put(barRef.current, 'transform', `scaleX(${seg(q, 0.2, 0.36).toFixed(4)})`);
    ORG_UNITS.forEach((_, i) => {
      const o = ORDER[i] * 0.05;
      const s1 = seg(q, 0.34 + o, 0.44 + o);
      put(stubRefs.current[i], 'transform', `scaleY(${s1.toFixed(4)})`);
      flag(cardRefs.current[i], 'data-on', s1 >= 0.96);
      const s2 = seg(q, 0.52 + o, 0.6 + o);
      put(stub2Refs.current[i], 'transform', `scaleY(${s2.toFixed(4)})`);
      flag(teamRefs.current[i], 'data-on', s2 >= 0.96);
    });
  };
  useFrame(P, update);
  useEffect(() => { update(P.get()); // 움직임 줄이기 판정이 붙은 뒤에 바뀐다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  return (
    <div ref={rootRef} className="cx-og" aria-hidden>
      <div className="cx-og-top"><Ceo t={t} refEl={(el) => { ceoRef.current = el; }} /></div>
      <span ref={trunkRef} className="cx-ln cx-lv cx-og-trunk" />
      <div className="cx-og-barw"><span ref={barRef} className="cx-ln cx-lh cx-og-bar" /></div>
      <div className="cx-og-cols">
        {ORG_UNITS.map((u, i) => (
          <div key={u.badge} className="cx-og-col">
            <span ref={(el) => { stubRefs.current[i] = el; }} className="cx-ln cx-lv cx-og-stub" />
            <div ref={(el) => { cardRefs.current[i] = el; }} className="cx-ou cx-ap"><Unit u={u} t={t} /></div>
            <span ref={(el) => { stub2Refs.current[i] = el; }} className="cx-ln cx-lv cx-og-stub2" />
            <div ref={(el) => { teamRefs.current[i] = el; }} className="cx-og-teams">
              {u.teams.map((tm, j) => (
                <div key={j} className="cx-ot" style={{ '--j': j } as CSSProperties}>{t(tm)}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 모바일 · 태블릿: 왼쪽 줄기 + 옆 가지 ─── */
const STUB_Y = 26; // 카드 위 끝에서 가지까지(배지 줄 가운데)

function OrgStack({ still }: { still: boolean }) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ceoRef = useRef<HTMLDivElement | null>(null);
  const trunkRef = useRef<HTMLSpanElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stubRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frac = useRef<number[]>([]);
  // 목록 아래 끝이 화면 88% 에 닿을 때 다 그려진다(하단 탭바 위) — 늦게 끝나면 설명 글이 먼저 보이고 마지막 카드 자리가 비어 보였다
  const P = usePassProgress(rootRef, ['start 0.9', 'end 0.88']);

  const update = (p: number) => {
    const q = still ? 1 : p;
    flag(ceoRef.current, 'data-on', q > 0.01);
    const tp = seg(q, 0.02, 0.86);
    put(trunkRef.current, 'transform', `scaleY(${tp.toFixed(4)})`);
    ORG_UNITS.forEach((_, i) => {
      const f = frac.current[i] ?? (i + 1) / ORG_UNITS.length;
      // 줄기 끝이 가지 자리(f)에 닿을 때 가지가 다 그려지게(앞 7% 동안) — 마지막 칸은 f = 1 이라 예전 식(f 뒤까지)이면 끝내 안 나타났다
      const s = clamp01((tp - f) / 0.07 + 1);
      put(stubRefs.current[i], 'transform', `scaleX(${s.toFixed(4)})`);
      flag(cardRefs.current[i], 'data-on', s >= 0.96);
    });
  };
  const upd = useRef(update);
  upd.current = update;

  // 줄기 길이 = 마지막 가지 자리까지, 칸마다 가지 자리(줄기 길이 대비)
  useIsoLayoutEffect(() => {
    const layout = () => {
      const rows = rowRefs.current.filter(Boolean) as HTMLDivElement[];
      const trunk = trunkRef.current;
      if (!rows.length || !trunk) return;
      const len = rows[rows.length - 1].offsetTop + STUB_Y;
      trunk.style.height = `${len}px`;
      frac.current = rows.map((r) => (r.offsetTop + STUB_Y) / Math.max(1, len));
      upd.current(P.get());
    };
    layout();
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout).catch(() => {});
    return () => window.removeEventListener('resize', layout);
  }, [P]);

  useFrame(P, update);
  useEffect(() => { upd.current(P.get()); }, [still, P]);

  return (
    <div ref={rootRef} className="cx-om" aria-hidden>
      <Ceo t={t} refEl={(el) => { ceoRef.current = el; }} />
      <div ref={listRef} className="cx-om-list">
        <span ref={trunkRef} className="cx-ln cx-lv cx-om-trunk" />
        {ORG_UNITS.map((u, i) => (
          <div key={u.badge} ref={(el) => { rowRefs.current[i] = el; }} className="cx-om-row">
            <span ref={(el) => { stubRefs.current[i] = el; }} className="cx-ln cx-lh cx-om-stub" style={{ top: STUB_Y }} />
            <div ref={(el) => { cardRefs.current[i] = el; }} className="cx-ou cx-om-card cx-ap"><Unit u={u} t={t} compact /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CeoOrg() {
  const t = useT();
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(prefersReducedMotion()); }, []);
  return (
    <section className="cx-org" aria-labelledby="cx-org-title">
      <div className="cx-wrap">
        <FadeUp>
          <p className="cx-eyebrow">{ORG_HEAD.eyebrow}</p>
          <h2 id="cx-org-title" className="cx-h2">{t(ORG_HEAD.title)}</h2>
        </FadeUp>
        {/* 읽기 프로그램용 — 그림 나무 대신 목록으로 */}
        <ul className="sr-only">
          <li>{`${ORG_CEO.badge} ${t(ORG_CEO.name)} ${t(ORG_CEO.role)}`}
            <ul>
              {ORG_UNITS.map((u) => (
                <li key={u.badge}>{`${u.badge} ${t(u.name)} ${t(u.role)} — ${u.teams.map((tm) => t(tm)).join(', ')}`}</li>
              ))}
            </ul>
          </li>
        </ul>
        <div className="hidden lg:block"><OrgDesk still={still} /></div>
        <div className="lg:hidden"><OrgStack still={still} /></div>
        <FadeUp delay={120}>
          <p className="cx-og-cap">
            {t(ORG_CAPTION[0])}<br className="lg:hidden" /> {t(ORG_CAPTION[1])}
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
