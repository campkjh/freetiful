'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 프로필(이사진 소개와 같은 3:4 webp, 이미 받아 둔 파일) */
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp, useInView } from '@/components/biz/biz-motion';
import { holdBizTabBar, prefersReducedMotion } from '../scroll-to';
import { LEADERS, ORG_CAPTION, ORG_CEO, ORG_HEAD, ORG_UNITS, type Tr } from './content';
import { useIsoLayoutEffect } from './motion';
import { ORG_CSS } from './orgStyles';

/*
 * ⑤ 조직도(261012 사장 '조직도 이런느낌으로' + 참고 화면 — 흰 카드 조직도).
 * 가운데 대표 카드(동그란 얼굴이 왼쪽 위 모서리에 반쯤 걸침 · ⋯ · 이름 · 직함) → 얇은 머리선(대표 카드 아래 작은 꺾쇠) →
 *   사람 카드 격자: 김도윤 부대표(COO) 먼저, 그다음 부문 5(CFO · CTO · CMO · CPO · 마케팅본부장). 1200~ 4칸(마지막 줄 가운데) ·
 *   900~ 3칸 · 그 아래 2칸.
 * 직함 줄 = 이사진 소개 카드 알약(LEADERS.pill — '최고재무책임자(CFO)' · 영어는 직함만), 얼굴 = 이사진 사진을 원으로 잘라(FACE).
 * ⋯ = 진짜 단추 — 그 사람 산하 팀(ORG_UNITS.teams) 말풍선. 대표는 격자와 같은 6칸(부대표 + 부문 5와 산하 팀)을 한눈에.
 *   부대표는 산하 팀 자료가 없어 ⋯ 없음. 말풍선 머리말에 이름을 넣는다(카드 이름 · 직함을 덮어도 누구 것인지 보이게).
 *   바깥 누름 · Esc · 포커스가 빠지면 · 화면 폭이 바뀌면 닫힌다(Esc 는 포커스가 칸 안 · 없음일 때만 ⋯ 로 돌려준다).
 *   아래 자리가 모자라면(폰 하단 탭바) 위로 열고, 위아래 다 모자라면 아래로 열며 모자란 만큼 화면을 올린다(261012 검수).
 * 들어올 때 한 번: 대표 카드가 떠오르고 → 머리선이 가운데에서 양쪽으로 → 카드가 차례로. 움직임 줄이기면 처음부터 다 보인다.
 * content.ts 는 건드리지 않고 여기서 엮는다(예전 선 나무 · 세로 줄기 판은 걷어냄 — 261009 판).
 */

const tr = (ko: string, en: string, ja: string, zh: string): Tr => ({ ko, en, ja, zh });
const L = {
  more: tr('산하 팀 보기', 'View teams', '傘下チームを見る', '查看下属团队'),
  teams: tr('산하 팀', 'Teams', '傘下チーム', '下属团队'),
  // 대표 말풍선 = 부대표 + 부문 5(격자와 같은 6칸) — 부대표는 '부문'이 아니라서 '산하 조직'(261012 검수)
  ceoMore: tr('산하 조직 보기', 'View organization', '傘下組織を見る', '查看下属组织'),
  divisions: tr('산하 조직', 'Organization', '傘下組織', '下属组织'),
};

/**
 * 얼굴 맞추기(720×960 사진, 261012 sharp 로 잘라 보며 맞춘 값) — x · y = 원 가운데가 올 자리(사진 가로 · 세로 비율),
 * s = 원 지름 ÷ 사진 가로. 머리 위 끝이 원 위에서 조금 떨어지고 어깨가 살짝 보이게.
 * y 는 261012 검수로 7명 모두 머리 위 여백 ≈ 원 지름의 7% 로 맞춤(Δy = (지금 비율 − 0.07) × s × 0.75 만큼 y 를 줄인다 —
 *   김명옥 · 김수연이 원 테에 붙어 보였다. 1440 2x 캡처로 다시 재서 한 번 더 다듬음).
 */
type Face = { x: number; y: number; s: number };
const FACE: Record<string, Face> = {
  'seo-nw': { x: 0.51, y: 0.288, s: 0.62 },
  'kim-dy': { x: 0.47, y: 0.277, s: 0.64 },
  'kim-mo': { x: 0.462, y: 0.312, s: 0.7 },
  'kim-jh': { x: 0.565, y: 0.298, s: 0.66 },
  'lim-hr': { x: 0.47, y: 0.307, s: 0.69 },
  'kim-sy': { x: 0.528, y: 0.299, s: 0.68 },
  'park-sy': { x: 0.5, y: 0.264, s: 0.68 },
};

/**
 * 직함 덮어쓰기(content.ts 는 그대로) — 영어 알약은 C레벨도 코드 없이 'Chief Financial Officer' 인데 부대표만 'Vice President (COO)' 라
 * 괄호가 혼자 튀었다(261012 검수). 영어만 'Vice President & COO', 나머지 언어는 알약 그대로.
 */
const TITLE_EN: Record<string, string> = { COO: 'Vice President & COO' };
const FACE_DEFAULT: Face = { x: 0.5, y: 0.3, s: 0.68 };

type Person = {
  id: string; // 코드(CEO · COO · CFO …) — 말풍선 id 에도 쓴다
  name: Tr;
  title: Tr;
  image?: string;
  cut?: boolean;
  face: Face;
  teams?: Tr[];
};

const leaderOf = (badge: string) => LEADERS.find((l) => l.badge === badge);
function person(badge: string, name: Tr, fallbackTitle: Tr, teams?: Tr[]): Person {
  const l = leaderOf(badge);
  const pill = l?.pill ?? fallbackTitle;
  return {
    id: badge,
    name,
    title: TITLE_EN[badge] ? { ...pill, en: TITLE_EN[badge] } : pill,
    image: l?.image,
    cut: l?.cut,
    face: (l && FACE[l.key]) || FACE_DEFAULT,
    teams,
  };
}

const CEO = person(ORG_CEO.badge, ORG_CEO.name, ORG_CEO.role);
const COO_L = leaderOf('COO');
const PEOPLE: Person[] = [
  ...(COO_L ? [person('COO', COO_L.name, COO_L.role)] : []),
  ...ORG_UNITS.map((u) => person(u.badge, u.name, u.role, u.teams)),
];

/**
 * 직함 줄바꿈 자리(<wbr>) — '(' 앞, 일본어 가타카나 ↔ 한자 사이. 일본어 낱말 묶기(auto-phrase)가 '最高マーケティング責任者(CMO)' 를
 * 한 덩어리로 보고 넘치면 아무 데서나('責任 | 者') 잘라서, '最高マーケティング | 責任者(CMO)' · 'マーケティング | 本部長' 처럼 끊길 자리를 직접 준다.
 */
const isKata = (ch: string) => /[\u30A1-\u30FA\u30FC]/.test(ch);
const isHan = (ch: string) => /[\u4E00-\u9FFF]/.test(ch);
function soft(s: string): ReactNode {
  const parts: string[] = [];
  let cur = '';
  const ch = Array.from(s);
  ch.forEach((b, i) => {
    const a = ch[i - 1];
    if (i > 0 && cur && ((b === '(' && a !== ' ') || (isKata(a) && isHan(b)) || (isHan(a) && isKata(b)))) {
      parts.push(cur);
      cur = '';
    }
    cur += b;
  });
  parts.push(cur);
  return parts.map((p, i) => <Fragment key={i}>{i > 0 && <wbr />}{p}</Fragment>);
}

function Dots() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden focusable="false">
      <circle cx="4.5" cy="10" r="1.7" fill="currentColor" />
      <circle cx="10" cy="10" r="1.7" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.7" fill="currentColor" />
    </svg>
  );
}

type CardProps = {
  p: Person;
  i?: number;
  ceo?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  onClose: (id: string, refocus: boolean) => void;
  wrapRef: (el: HTMLDivElement | null) => void;
};

function Card({ p, i = 0, ceo, open, onToggle, onClose, wrapRef }: CardProps) {
  const t = useT();
  const name = t(p.name);
  const popId = `cxo-pop-${p.id}`;
  const hasMore = ceo || !!p.teams?.length;
  const f = p.face;
  return (
    <div className="cxo-card" data-open={open ? '' : undefined} style={{ '--i': i } as CSSProperties}>
      <span
        className="cxo-av"
        data-cut={p.cut || !p.image ? '' : undefined}
        style={{ '--x': String(f.x), '--y': String(f.y), '--s': String(f.s) } as CSSProperties}
        aria-hidden
      >
        {p.image ? <img src={p.image} alt="" loading="lazy" decoding="async" draggable={false} /> : <b>{p.id}</b>}
      </span>
      {/* 이름 · 직함은 위 읽기 프로그램용 목록이 말해 준다 — 여기선 가려 두 번 읽히지 않게 */}
      <span className="cxo-n" aria-hidden>{name}</span>
      <span className="cxo-r" aria-hidden>{soft(t(p.title))}</span>
      {hasMore && (
        <div
          ref={wrapRef}
          className="cxo-more"
          onBlur={(e) => {
            // 포커스가 이 칸 밖으로 나가면 닫는다(Tab 으로 지나갈 때)
            if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) onClose(p.id, false);
          }}
        >
          <button
            type="button"
            className="cxo-btn"
            aria-label={`${t(ceo ? L.ceoMore : L.more)} (${name})`}
            aria-expanded={open}
            aria-controls={popId}
            onClick={(e) => {
              // macOS Safari 는 단추를 눌러도 포커스를 주지 않는다 — 직접 줘야 Tab 으로 빠질 때 onBlur 로 닫힌다(261012 검수)
              e.currentTarget.focus({ preventScroll: true });
              onToggle(p.id);
            }}
          >
            <Dots />
          </button>
          {/* tabIndex -1 — 말풍선 안을 눌러도 포커스가 칸 안에 남아 닫히지 않게 · data-lenis-prevent — 높이를 줄여 안에서 굴릴 때 Lenis 가 휠을 가로채지 않게 */}
          <div id={popId} className="cxo-pop" data-open={open ? '' : undefined} tabIndex={-1} data-lenis-prevent="">
            {/* 머리말에 이름 — 말풍선이 카드 이름 · 직함을 덮어도 누구 것인지 보이게(261012 검수) */}
            <span className="cxo-pop-h"><b>{name}</b> · {t(ceo ? L.divisions : L.teams)}</span>
            {ceo ? (
              <ul>
                {PEOPLE.map((u) => (
                  <li key={u.id} className="cxo-pop-u">
                    <b>{u.id}</b>
                    <span>{t(u.name)}</span>
                    {!!u.teams?.length && <small>{u.teams.map((tm) => t(tm)).join(' · ')}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                {p.teams?.map((tm, j) => <li key={j} className="cxo-pop-t">{t(tm)}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CeoOrg() {
  const t = useT();
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(prefersReducedMotion()); }, []);
  const { ref: chartRef, inView } = useInView<HTMLDivElement>({ threshold: 0.22, rootMargin: '0px 0px -8% 0px' });
  const [openId, setOpenId] = useState<string | null>(null);
  const wraps = useRef<Record<string, HTMLDivElement | null>>({});

  const onToggle = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), []);
  const onClose = useCallback((id: string, refocus: boolean) => {
    setOpenId((cur) => (cur === id ? null : cur));
    if (refocus) wraps.current[id]?.querySelector<HTMLButtonElement>('.cxo-btn')?.focus();
  }, []);

  // 바깥 누름 · Esc · 화면 폭 바뀜(돌리기 · 창 크기)으로 닫기
  useEffect(() => {
    if (!openId) return undefined;
    const vw = window.innerWidth;
    const onDown = (e: PointerEvent) => {
      const w = wraps.current[openId];
      if (w && !w.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 포커스가 이 칸 안이거나 아무 데도 없을 때만 ⋯ 로 돌려준다 — 다른 곳에 있는 포커스를 끌어오지 않게(261012 검수)
      const a = document.activeElement;
      const w = wraps.current[openId];
      onClose(openId, !a || a === document.body || !!w?.contains(a));
    };
    // 폭이 바뀌면 자리 계산(--dx · 위아래)이 틀어지므로 닫는다 — 높이만 바뀌는 건(폰 주소창 접힘) 그대로
    const onResize = () => { if (window.innerWidth !== vw) setOpenId(null); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [openId, onClose]);

  /*
   * 말풍선 자리 — 열 때 한 번(그리기 전에).
   *  · 가로: 단추 오른쪽 끝에 맞춰 열리므로 화면 왼쪽 밖으로 나가면(폰 왼쪽 칸) 오른쪽으로 당긴다(--dx).
   *  · 세로(261012 검수 — 폰에서 대표 말풍선 아랫부분이 하단 탭바에 가렸다): 아래 자리 = 화면 높이 − 하단 탭바(보일 때) − 8.
   *    아래로 들어가면 아래로, 아니면 위(머리줄 밑)로 들어가면 위로(data-up). 둘 다 모자라면 아래로 열고 모자란 만큼 화면을 올린다
   *    (단추가 머리줄 밑으로 숨지 않는 만큼만). 그래도 모자라면(가로로 눕힌 폰) 높이를 줄이고 안에서 굴린다.
   */
  useIsoLayoutEffect(() => {
    if (!openId) return;
    const w = wraps.current[openId];
    const pop = w?.querySelector<HTMLElement>('.cxo-pop');
    if (!w || !pop) return;
    pop.style.removeProperty('max-height');
    const wr = w.getBoundingClientRect();
    const dx = Math.max(0, 16 - (wr.right - pop.offsetWidth));
    pop.style.setProperty('--dx', `${Math.round(dx)}px`);

    const GAP = 6;
    const hdr = document.querySelector<HTMLElement>('[data-biz-header]');
    const ceil = (hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0) + 8;
    // 하단 탭바 — lg 이상은 display:none 이라 offsetHeight 0. 숨김(아래로 내려간) 상태여도 다시 나올 수 있어 늘 높이를 뺀다
    let navH = 0;
    document.querySelectorAll<HTMLElement>('[data-ios-biz-bottom-nav],[data-ios-mobile-bottom-nav]').forEach((n) => { navH = Math.max(navH, n.offsetHeight); });
    const floor = window.innerHeight - navH - 8;
    const h = pop.offsetHeight; // 숨김(visibility:hidden)이어도 잡힌다 · scale 은 영향 없음
    const downTop = wr.bottom + GAP;
    const upBottom = wr.top - GAP;
    let up = false;
    let room = floor - downTop;
    if (downTop + h > floor) {
      if (upBottom - h >= ceil) {
        up = true;
        room = upBottom - ceil;
      } else {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight - window.scrollY);
        const s = Math.ceil(Math.max(0, Math.min(downTop + h - floor, wr.top - ceil, maxScroll)));
        if (s > 0) {
          const y = window.scrollY + s;
          holdBizTabBar(1200); // 스스로 굴리는 동안 탭바를 내리지 않는다(비즈 공통 규칙)
          if (prefersReducedMotion()) window.scrollTo({ top: y, behavior: 'instant' });
          else if (window.__bizLenis) window.__bizLenis.scrollTo(y, { duration: 0.6 });
          else window.scrollTo({ top: y, behavior: 'smooth' });
        }
        room = floor - (downTop - s);
      }
    }
    pop.toggleAttribute('data-up', up);
    if (h > room + 1) pop.style.setProperty('max-height', `${Math.max(160, Math.floor(room))}px`);
  }, [openId]);

  const card = (p: Person, i: number, ceo?: boolean) => (
    <Card
      key={p.id}
      p={p}
      i={i}
      ceo={ceo}
      open={openId === p.id}
      onToggle={onToggle}
      onClose={onClose}
      wrapRef={(el) => { wraps.current[p.id] = el; }}
    />
  );

  return (
    <section className="cx-org" aria-labelledby="cx-org-title">
      <style dangerouslySetInnerHTML={{ __html: ORG_CSS }} />
      <div className="cx-wrap">
        <FadeUp>
          <p className="cx-eyebrow">{ORG_HEAD.eyebrow}</p>
          <h2 id="cx-org-title" className="cx-h2">{t(ORG_HEAD.title)}</h2>
        </FadeUp>
        {/* 읽기 프로그램용 — 카드 그림 대신 목록으로(대표 → 부대표 · 부문 → 산하 팀) */}
        <ul className="sr-only">
          <li>
            {`${t(CEO.title)} ${t(CEO.name)}`}
            <ul>
              {PEOPLE.map((p) => (
                <li key={p.id}>
                  {`${t(p.title)} ${t(p.name)}`}
                  {!!p.teams?.length && (
                    <ul>
                      {p.teams.map((tm, j) => <li key={j}>{t(tm)}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </li>
        </ul>
        <div ref={chartRef} className="cxo" data-in={inView || still ? '' : undefined}>
          <div className="cxo-top">{card(CEO, 0, true)}</div>
          <div className="cxo-rule" aria-hidden>
            <span className="cxo-rule-l" />
            <svg className="cxo-caret" viewBox="0 0 16 8" fill="none" focusable="false">
              <path d="M0 7.5 8 .9l8 6.6" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            <span className="cxo-rule-r" />
          </div>
          <div className="cxo-grid">{PEOPLE.map((p, i) => card(p, i))}</div>
        </div>
        <FadeUp delay={120}>
          <p className="cxo-cap">
            {t(ORG_CAPTION[0])}<br className="lg:hidden" /> {t(ORG_CAPTION[1])}
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
