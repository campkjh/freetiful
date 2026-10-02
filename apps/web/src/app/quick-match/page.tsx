'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { captureUtm } from '@/lib/landing-track';
import ProToneCard, { type ProToneCardData } from '@/components/pros/ProToneCard';

/* ─────────────────────────────────────────────────────────────
 * 퀵매칭 — 토스 톤앤매너. 한 화면당 한 질문, 단일선택 자동 진행.
 * 등장: 타이틀 페이드업 → 서브 → 카드 위→아래 순서로 우→좌 페이드슬라이드.
 * 모바일 최적화 + PC(넓은 화면)는 가운데 카드 프레임.
 * ──────────────────────────────────────────────────────────── */

type Step = 'date' | 'region' | 'venue' | 'mood' | 'part' | 'gender' | 'searching' | 'results' | 'contact' | 'phone' | 'done';

const ICON = (n: string) => `/quick-match/icons/${n}.svg`;
function Ic({ name, size = 24, color, className = '' }: { name: string; size?: number; color?: string; className?: string }) {
  return <i aria-hidden className={`qm-ic ${className}`} style={{ width: size, height: size, color, WebkitMaskImage: `url(${ICON(name)})`, maskImage: `url(${ICON(name)})` }} />;
}

type Note = { title: string; body: string; list?: string[] };

const REGION_GROUPS: { key: string; label: string; match: string[] }[] = [
  { key: 'sudogwon', label: '수도권', match: ['수도권(서울/인천/경기)'] },
  { key: 'gangwon', label: '강원권', match: ['강원도'] },
  { key: 'chungcheong', label: '충청권', match: ['충청권'] },
  { key: 'jeolla', label: '전라권', match: ['전라권'] },
  { key: 'gyeongsang', label: '경상권', match: ['경상권'] },
  { key: 'jeju', label: '제주', match: ['제주'] },
];
const MOOD_OPTIONS: { label: string; icon: string; desc: string }[] = [
  { label: '진중하고 격식있게', icon: 'crown', desc: '차분하고 우아한 분위기로' },
  { label: '유쾌하고 밝게', icon: 'smile', desc: '웃음이 넘치는 즐거운 예식으로' },
  { label: '위트있고 센스있게', icon: 'sparkle', desc: '지루하지 않은 재치있는 진행으로' },
  { label: '감동적이고 따뜻하게', icon: 'heart', desc: '진심이 전해지는 뭉클한 예식으로' },
];
const PART_OPTIONS: { label: string; note?: Note }[] = [
  { label: '1부 (본식)' },
  { label: '2부 (피로연)', note: {
    title: '2부는 진행 스타일이 본식과 달라요',
    body: '2부는 게임·이벤트 등 캐주얼한 진행이 많아요. 2부 전문 진행이 가능한 사회자를 우선 보여드릴게요.',
  } },
  { label: '둘 다 (1부·2부)', note: {
    title: '1부·2부는 필요한 진행 톤이 달라요',
    body: '본식은 격식 있게, 2부는 유쾌하게. 두 분위기를 모두 잘 소화하는 사회자를 추천해드릴게요.',
  } },
];
const GENDERS: { k: 'any' | 'male' | 'female'; label: string }[] = [
  { k: 'female', label: '여자 사회자' },
  { k: 'male', label: '남자 사회자' },
  { k: 'any', label: '상관없어요' },
];
const CONTACTS: { k: string; label: string; hint: string; icon: string }[] = [
  { k: '전화', label: '전화', hint: '사회자가 직접 전화드려요', icon: 'call' },
  { k: '문자', label: '문자', hint: '문자로 편하게 상담받아요', icon: 'message' },
  { k: '프리티풀 채팅', label: '프리티풀 채팅', hint: '앱에서 실시간으로 채팅해요', icon: 'chat' },
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

/* ── helpers ─────────────────────────────────────────────── */
function extractYoutubeId(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const first = url.split(/\s+/).map((s) => s.trim()).find(Boolean) || url;
  try {
    const p = new URL(first);
    const host = p.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return p.pathname.split('/').filter(Boolean)[0];
    if (host.includes('youtube.com')) {
      const v = p.searchParams.get('v');
      if (v) return v;
      const parts = p.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1];
    }
  } catch {}
  return first.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/)?.[1];
}
function extractYoutubeIds(url: string | null | undefined): string[] {
  if (!url) return [];
  const ids: string[] = [];
  for (const tok of url.split(/\s+/)) {
    const id = extractYoutubeId(tok.trim());
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
function formatKDate(v: string) {
  if (!v) return '';
  const [y, m, d] = v.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}
function formatKTime(v: string) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function matchesGender(p: ProListItem, g: 'any' | 'male' | 'female') {
  if (g === 'any') return true;
  const v = (p.gender || '').toLowerCase();
  return g === 'male' ? v === 'male' || (p.gender || '').includes('남') : v === 'female' || (p.gender || '').includes('여');
}
/** 두 줄을 번갈아 한 줄로(여·남·여·남…) — 성별 상관없음일 때 지정 사회자 */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]); }
  return out;
}
function matchesRegion(p: ProListItem, group?: { match: string[] }) {
  if (!group) return true;
  if (p.isNationwide) return true;
  const rs = p.regions || [];
  return rs.includes('전국가능') || rs.some((r) => group.match.includes(r));
}
const stag = (i: number) => ({ animationDelay: `${0.3 + i * 0.07}s` });

/* ── 사회자 카드 — 홈 사회자 카드(사진 색 카드)를 상세 프로필 사진처럼 옆으로 넘긴다 ──────────────
 * 261002 사장 "퀵매칭 사회자 카드를 홈에 사회자 카드 디자인처럼, 사회자 상세페이지 프로필 사진 스와이프하면
 * 다음 사진 나오는 것처럼 다음 사회자 나오게".
 *  카드 = components/pros/ProToneCard(홈·/pros 와 같은 컴포넌트) size='lg'.
 *  넘기기 = 상세 히어로와 같은 방식: 왼쪽 정렬 + 다음 카드 살짝 보임(peek) + 스크롤 스냅 + 가운데 아닌 카드는 0.9배 + 아래 점.
 *  누르기: 보고 있는 카드 = 고르기/빼기(오른쪽 위 체크가 그려진다), 옆에 걸친 카드 = 그 카드로 넘어가기.
 *  영상은 카드 위 '영상' 유리 버튼 → 아래 시트에서 재생(홈 카드엔 영상 썸네일을 안 올린다 — 사장 지시). */
function toneOf(p: ProListItem): ProToneCardData {
  return {
    id: p.id,
    name: p.name,
    image: p.images?.[0] || p.profileImageUrl || '',
    experience: p.careerYears || 0,
    isPartner: Boolean(p.showPartnersLogo || p.isFeatured),
    rating: p.avgRating || 0,
    reviews: p.reviewCount || 0,
    region: p.isNationwide ? '전국' : String((p.regions || [])[0] || '').replace(/\(.*?\)/g, '').trim(),
    intro: p.shortIntro || p.mainExperience || '',
    tags: p.tags || [],
  };
}

function QmProCarousel({ pros, selected, onToggle, runAll = false, onSelectOne, onRunAllDone }: {
  pros: ProListItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** 전체선택 연출 — 켜지면 첫 장부터 끝 장까지 촤라락 넘기며 한 장씩 체크하고 onRunAllDone */
  runAll?: boolean;
  onSelectOne?: (id: string) => void;
  onRunAllDone?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [video, setVideo] = useState<ProListItem | null>(null);
  const tones = useMemo(() => pros.map(toneOf), [pros]);
  const videoCount = useMemo(() => pros.map((p) => extractYoutubeIds(p.youtubeUrl).length), [pros]);
  const idsKey = pros.map((p) => p.id).join(',');
  // 다른 사회자 보기(리롤)로 명단이 바뀌면 첫 카드부터
  useEffect(() => {
    ref.current?.scrollTo({ left: 0 });
    setActive(0);
  }, [idsKey]);
  /** 카드 한 칸 = 카드 폭 + 틈 12 */
  const step = () => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 1;
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(pros.length - 1, Math.round(el.scrollLeft / step())));
    setActive((prev) => (prev === i ? prev : i));
  };
  const go = (i: number) => ref.current?.scrollTo({ left: i * step(), behavior: 'smooth' });

  /* 전체선택 — 스냅을 잠시 끄고 rAF 로 한 장씩 빠르게 넘기며(장당 0.14초) 도착한 카드를 체크한다.
     ⚠ 스냅을 켠 채 scrollLeft 를 옮기면 브라우저가 중간에 가까운 칸으로 끌어당겨 덜컹거린다. */
  const selectOneRef = useRef(onSelectOne);
  selectOneRef.current = onSelectOne;
  const runDoneRef = useRef(onRunAllDone);
  runDoneRef.current = onRunAllDone;
  useEffect(() => {
    if (!runAll) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const ids = pros.map((p) => p.id);
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    const slideTo = (target: number, ms: number) => new Promise<void>((resolve) => {
      const from = el.scrollLeft;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) { resolve(); return; }
        const k = Math.min(1, (now - t0) / ms);
        el.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    (async () => {
      el.style.scrollSnapType = 'none';
      const st = step();
      const max = el.scrollWidth - el.clientWidth;
      for (let i = 0; i < ids.length; i++) {
        if (cancelled) return;
        await slideTo(Math.min(i * st, max), i === 0 ? 220 : 140);
        if (cancelled) return;
        selectOneRef.current?.(ids[i]);
        await wait(55);
      }
      await wait(420);
      el.style.scrollSnapType = '';
      if (!cancelled) runDoneRef.current?.();
    })();
    return () => { cancelled = true; el.style.scrollSnapType = ''; };
  }, [runAll]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className="qm-cwrap qm-a-item" style={stag(1)}>
      <div ref={ref} className="qm-carousel" onScroll={onScroll}>
        {pros.map((p, i) => {
          const on = selected.has(p.id);
          const vids = videoCount[i];
          return (
            <div key={p.id} className="qm-cslide" style={{ transform: `scale(${i === active ? 1 : 0.9})` }}>
              <ProToneCard
                size="lg"
                pro={tones[i]}
                index={i}
                selected={on}
                onPress={() => { if (runAll) return; if (i !== active) go(i); else onToggle(p.id); }}
                photoOverlay={
                  <>
                    <span className={`qm-ccheck ${on ? 'on' : ''}`} aria-hidden="true">
                      {on && (
                        <svg viewBox="0 0 26 26" width="20" height="20" fill="none">
                          <path d="M5.5 13.5 L10.8 18.6 L20.5 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
                        </svg>
                      )}
                    </span>
                    {vids > 0 && (
                      <button type="button" className="qm-cvideo" aria-label={`${p.name} 소개영상 보기`}
                        onClick={(e) => { e.stopPropagation(); setVideo(p); }}>
                        <Ic name="play" size={13} color="#fff" />영상{vids > 1 ? ` ${vids}` : ''}
                      </button>
                    )}
                  </>
                }
              />
            </div>
          );
        })}
      </div>
      {pros.length > 1 && (
        <div className="qm-cdots">
          {pros.map((p, i) => (
            <button key={p.id} type="button" aria-label={`${i + 1}번째 사회자`} className={i === active ? 'on' : ''} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
    {/* ⚠ 시트는 카드 줄(.qm-a-item) 밖에 — 등장 애니메이션의 transform 이 fixed 의 기준이 돼 시트가 줄 안에 갇혔다 */}
    {video && (
        <QmVideoSheet
          pro={video}
          selected={selected.has(video.id)}
          onToggle={() => onToggle(video.id)}
          onClose={() => setVideo(null)}
        />
    )}
    </>
  );
}

/** 소개영상 시트 — 아래에서 올라오는 흰 시트(토스 결) · 영상 여러 개면 아래 썸네일로 바꿔 보기 · 여기서도 고르기 */
function QmVideoSheet({ pro, selected, onToggle, onClose }: { pro: ProListItem; selected: boolean; onToggle: () => void; onClose: () => void }) {
  const ids = useMemo(() => extractYoutubeIds(pro.youtubeUrl), [pro.youtubeUrl]);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const id = ids[at];
  return (
    <div className="qm-vdim" onClick={onClose}>
      <div className="qm-vsheet" role="dialog" aria-modal="true" aria-label={`${pro.name} 소개영상`} onClick={(e) => e.stopPropagation()}>
        <span className="qm-vgrab" aria-hidden="true" />
        <div className="qm-vhead">
          <b>{pro.name}</b>
          <span>소개영상{ids.length > 1 ? ` ${at + 1}/${ids.length}` : ''}</span>
        </div>
        <div className="qm-vplayer">
          {id && (
            <iframe key={id} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
              title={`${pro.name} 소개영상`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          )}
        </div>
        {ids.length > 1 && (
          <div className="qm-vthumbs">
            {ids.map((v, k) => (
              <button key={v} type="button" className={k === at ? 'on' : ''} onClick={() => setAt(k)} aria-label={`영상 ${k + 1}`}>
                <img src={`https://i.ytimg.com/vi/${v}/mqdefault.jpg`} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div className="qm-btnrow qm-vbtns">
          <button type="button" className="qm-cta ghost" onClick={onClose}>닫기</button>
          <button type="button" className="qm-cta" onClick={() => { onToggle(); onClose(); }}>{selected ? '선택 빼기' : '이 사회자 선택'}</button>
        </div>
      </div>
    </div>
  );
}
/* ── 사회자 찾는 중 — 토스 '대출 비교' 조회 화면과 같게(261002 사장이 준 화면 녹화, "100% 동일하게") ──────────
 * 녹화에서 잰 것: 왼쪽 정렬 두 줄 제목(단계마다 흐려졌다 또렷해지며 바뀜: 시작 → 'N개 중 M개 금융사에 다녀왔어요'
 *  → 안심 문구 → 혜택 확인 → '거의 다 됐어요' → 다 되면 '찾았어요!') · 굵은 도넛 링(연한 하늘 바탕 위로 위에서 시계 방향,
 *  꼬리는 연하고 머리는 진한 파랑 · 둥근 머리) · 가운데 큰 숫자 + 연한 % · 링 아래에 걸친 3D 아이콘 ·
 *  회색 바탕 두 칸 탭(흰 알약이 미끄러짐) · 결과가 하나씩 들어오며 제 순위에 끼어드는 목록(그 자리에서 커지며 등장 +
 *  연한 파랑 바탕이 1초쯤 뒤 사라짐, 아래 줄은 밀려 내려감 — 아직인 줄은 '…하고 있어요' 회색) ·
 *  100% 뒤 제목이 '찾았어요!' 로 바뀌고 잠시 뒤 링 → 탭 → 줄 차례로 사라지며 결과 화면으로.
 * 바꾼 것: 금융사 → 사회자(사진·이름·경력·지역 / ★평점·리뷰 수), 금리 낮은 순·한도 높은 순 → 평점 높은 순·리뷰 많은 순,
 *  은행 아이콘 → 홈 사회자 아이콘(백합+마이크), 64초 → 6초 남짓(토스는 실제 조회 시간이다). 결과 화면은 그대로. */
const S_ROWS = 10;
const S_INTRO_MS = 650;
const S_COUNT_MS = 5400;
const S_FOUND_HOLD_MS = 900;
const S_OUT_MS = 600;

type SRow = { id: string; name: string; photo: string; career: number; region: string; rating: number; reviews: number };

/** 제목 바꾸기 — 옛 제목은 짧게 사라지고 새 제목은 흐렸다 또렷하게(녹화의 0.3초 바뀜) */
function SwapTitle({ k, children }: { k: string; children: ReactNode }) {
  const [prev, setPrev] = useState<{ k: string; node: ReactNode } | null>(null);
  const lastK = useRef(k);
  const lastNode = useRef<ReactNode>(children);
  useLayoutEffect(() => {
    if (lastK.current === k) return;
    setPrev({ k: lastK.current, node: lastNode.current });
    lastK.current = k;
    const t = window.setTimeout(() => setPrev(null), 220);
    return () => window.clearTimeout(t);
  }, [k]);
  useLayoutEffect(() => { lastNode.current = children; });
  return (
    <div className="qm-s-titlebox">
      {prev && <h1 key={`p-${prev.k}`} className="qm-s-title out" aria-hidden="true">{prev.node}</h1>}
      <h1 key={`c-${k}`} className="qm-s-title in" aria-live="polite">{children}</h1>
    </div>
  );
}

function QmSearching({ pool, ready, failed, onDone, onBack }: {
  pool: { featured: ProListItem[]; rest: ProListItem[] };
  ready: boolean;
  failed: boolean;
  onDone: () => void;
  onBack: () => void;
}) {
  const rows = useMemo<SRow[]>(() => [...pool.featured, ...pool.rest].slice(0, S_ROWS).map((p) => ({
    id: p.id,
    name: p.name,
    photo: p.images?.[0] || p.profileImageUrl || '',
    career: p.careerYears || 0,
    region: p.isNationwide ? '전국' : String((p.regions || [])[0] || '').replace(/\(.*?\)/g, '').trim(),
    rating: p.avgRating || 0,
    reviews: p.reviewCount || 0,
  })), [pool]);
  const total = pool.featured.length + pool.rest.length;
  // 결과가 들어오는 순서 — 화면 순서와 다르게 섞는다(위에서부터 차례로 채우면 '조회'가 아니라 '목록'처럼 보인다)
  const rowsKey = rows.map((r) => r.id).join(',');
  const arrival = useMemo(() => shuffle(rows.map((r) => r.id)), [rowsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<'run' | 'found' | 'out'>('run');
  const [tab, setTab] = useState<'rating' | 'reviews'>('rating');
  const ringRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(ready);
  const failedRef = useRef(failed);
  readyRef.current = ready;
  failedRef.current = failed;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /* 시간표 — 데이터 오기 전엔 0~2% 에서 기다리고, 오면 S_COUNT_MS 동안 100% 까지.
     링은 매 프레임 CSS 변수로(다시 그리기 없음), 숫자는 정수가 바뀔 때만 상태로. */
  useEffect(() => {
    const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
    const countMs = reduce ? 1200 : S_COUNT_MS;
    const t0 = performance.now();
    let countStart: number | null = null;
    let raf = 0;
    let lastInt = -1;
    let finished = false;
    const timers: number[] = [];
    const tick = (now: number) => {
      if (failedRef.current) {
        if (countStart === null) countStart = now - countMs * 0.9; // 못 받았으면 얼른 끝내고 결과 화면이 안내한다
      } else if (countStart === null && readyRef.current && now - t0 >= S_INTRO_MS) {
        countStart = now;
      }
      const v = countStart === null ? Math.min(2, ((now - t0) / S_INTRO_MS) * 2) : 2 + 98 * Math.min(1, (now - countStart) / countMs);
      const el = ringRef.current;
      if (el) {
        // 녹화 실측: 머리 뒤로 160° 쯤에서 바탕색까지 옅어지는 '혜성'(46% 땐 위쪽 시작점이 비어 있다),
        // 아직 짧을 땐 머리도 옅다(2% ≈ 0.45 → 11% ≈ 0.65 → 46% ≈ 0.95)
        const head = (v / 100) * 360;
        el.style.setProperty('--head', `${head}deg`);
        el.style.setProperty('--tail', `${Math.max(0, head - 160)}deg`);
        // 0% 땐 아예 숨긴다 — 시작선(0°)에서 원뿔 그라데이션 이음매가 머리카락처럼 한 줄 보였다
        el.style.setProperty('--a', head < 1 ? '0' : String(Math.min(1, 0.36 + head / 180)));
      }
      const iv = Math.floor(v);
      if (iv !== lastInt) { lastInt = iv; setPct(iv); }
      if (v >= 100 && !finished) {
        finished = true;
        setPhase('found');
        timers.push(window.setTimeout(() => setPhase('out'), S_FOUND_HOLD_MS));
        timers.push(window.setTimeout(() => doneRef.current(), S_FOUND_HOLD_MS + S_OUT_MS));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  /* 결과 들어온 줄 — 6% 부터 하나씩(마지막 줄은 90% 남짓) */
  const n = rows.length;
  const doneCount = ready && n ? Math.max(0, Math.min(n, Math.floor((pct - 6) / (84 / n)) + 1)) : 0;
  const doneIds = useMemo(() => new Set(arrival.slice(0, doneCount)), [arrival, doneCount]);
  /* 들어온 시각 — 그 줄만 '그 자리에서 커지며 + 연한 파랑' 을 탄다 */
  const arrivedAt = useRef(new Map<string, number>());
  doneIds.forEach((id) => { if (!arrivedAt.current.has(id)) arrivedAt.current.set(id, performance.now()); });
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sortKey = (r: SRow) => (tab === 'rating' ? [r.rating, r.reviews] : [r.reviews, r.rating]);
  const doneRows = [...doneIds].map((id) => byId.get(id)).filter((r): r is SRow => !!r)
    .sort((a, b) => { const x = sortKey(a), y = sortKey(b); return y[0] - x[0] || y[1] - x[1]; });
  const pendingRows = rows.filter((r) => !doneIds.has(r.id));
  const ordered = [...doneRows, ...pendingRows];

  /* 줄 자리 — DOM 순서는 처음 그대로 두고 자리(translateY)만 바꾼다. 탭을 바꾸거나 새 줄이 끼어들면 미끄러진다.
     ⚠ React 가 DOM 을 옮기게 두면(순서대로 그리기) 옮겨진 줄의 등장 애니가 처음부터 다시 돈다(실측 — 여러 줄이 깜빡였다).
     방금 들어온 줄만 미끄러지지 않고 제 자리로 바로 가서 그 자리에서 커진다(녹화의 끼어들기). */
  const rankOf = new Map(ordered.map((r, i) => [r.id, i]));
  const ROW_H = 70;

  // 제목
  const visited = total ? Math.min(total, Math.max(1, Math.round(total * Math.min(1, pct / 46)))) : 0;
  const stage = phase !== 'run' ? 'found' : !ready || pct < 3 || !total ? 'intro' : pct < 52 ? 'count' : pct < 63 ? 'safe' : pct < 76 ? 'check' : 'almost';
  const titles: Record<string, ReactNode> = {
    intro: <>고객님의<br />사회자 매칭을 시작할게요</>,
    count: <>{total}명 중<br />{visited}명의 사회자를 살펴봤어요</>,
    safe: <>연락처는 걱정 마세요<br />고른 사회자에게만 전달돼요</>,
    check: <>예식일과 분위기에 맞는지도<br />함께 확인할게요</>,
    almost: <>거의 다 됐어요<br />곧 매칭이 완료돼요</>,
    found: <>조건에 딱 맞는<br />사회자를 찾았어요!</>,
  };
  const pendingText = pct < 35 ? '프로필을 살펴보고 있어요' : '리뷰를 확인하고 있어요';
  const out = phase === 'out';
  const fade = (i: number): React.CSSProperties | undefined => (out ? { animation: `qm-s-fade ${S_OUT_MS - 120}ms ease ${i * 45}ms both` } : undefined);

  return (
    <div className="qm-page" key="searching">
      <Header onBack={onBack} />
      <main className="qm-main qm-s-main">
        <div style={fade(0)}><SwapTitle k={stage}>{titles[stage]}</SwapTitle></div>

        <div className="qm-s-ringwrap" style={fade(0)}>
          <div ref={ringRef} className="qm-s-ring" style={{ ['--head' as string]: '0deg', ['--tail' as string]: '0deg', ['--a' as string]: '0' }}>
            <span className="qm-s-track" />
            <span className="qm-s-arc" />
            {pct > 0 && <span className="qm-s-cap" />}
          </div>
          <div className="qm-s-num">
            <b>{Math.min(100, pct)}</b>{pct < 100 && <i>%</i>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qm-s-ic" src="/images/category-icons/wedding-mc-icon.png" alt="" draggable={false} />
          <span className="qm-s-icshadow" aria-hidden="true" />
        </div>

        <div className="qm-s-tabs" role="tablist" style={fade(1)}>
          <span className="qm-s-pill" style={{ transform: tab === 'rating' ? 'translateX(0)' : 'translateX(100%)' }} />
          <button type="button" role="tab" aria-selected={tab === 'rating'} className={`qm-s-tab ${tab === 'rating' ? 'on' : ''}`} onClick={() => setTab('rating')}>평점 높은 순</button>
          <button type="button" role="tab" aria-selected={tab === 'reviews'} className={`qm-s-tab ${tab === 'reviews' ? 'on' : ''}`} onClick={() => setTab('reviews')}>리뷰 많은 순</button>
        </div>

        <div className="qm-s-list">
          {!ready && !failed
            ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="qm-s-row skel">
                <span className="qm-s-ava" />
                <span className="qm-s-txt"><span className="qm-s-bar w1" /><span className="qm-s-bar w2" /></span>
              </div>
            ))
            : (
              <div className="qm-s-rows" style={{ height: rows.length * ROW_H }}>
                {rows.map((r) => {
                  const done = doneIds.has(r.id);
                  const age = done ? performance.now() - (arrivedAt.current.get(r.id) ?? 0) : Infinity;
                  const rank = rankOf.get(r.id) ?? 0;
                  const sub = [r.career ? `경력 ${r.career}년` : '', r.region].filter(Boolean).join(' · ');
                  return (
                    <div key={r.id} className="qm-s-slot"
                      style={{ transform: `translateY(${rank * ROW_H}px)`, transition: age < 90 ? 'none' : undefined, ...(fade(2 + rank) || {}) }}>
                      <div className={`qm-s-row ${age < 1250 ? 'new' : ''}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.photo ? <img className="qm-s-ava" src={r.photo} alt="" loading="eager" /> : <span className="qm-s-ava" />}
                        <span className="qm-s-txt">
                          <span className="qm-s-name">{r.name}</span>
                          <span className={`qm-s-sub ${done ? '' : 'wait'}`}>{done ? sub || '프리티풀 사회자' : pendingText}</span>
                        </span>
                        {done && (
                          <span className="qm-s-val">
                            <b>{r.reviews > 0 ? `★ ${r.rating.toFixed(1)}` : '신규'}</b>
                            <span>리뷰 {r.reviews}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  return (
    <div className="qm-note">
      <b>{note.title}</b>
      <p>{note.body}</p>
      {note.list && <ol>{note.list.map((t, i) => <li key={i}><span>{i + 1}.</span>{t}</li>)}</ol>}
    </div>
  );
}

export default function QuickMatchPage() {
  const [step, setStep] = useState<Step>('date');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [regionKey, setRegionKey] = useState('');
  const [venue, setVenue] = useState('');
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [part, setPart] = useState('');
  const [gender, setGender] = useState<'any' | 'male' | 'female' | ''>('');
  // 후보(260927 사장) — featured = 지정 사회자(첫 화면, 이 사람들한테만 고객 번호가 간다),
  // rest = 나머지(리롤하면 나옴, 최근 견적을 보낸 순, 번호 없이 채팅으로만)
  const [pool, setPool] = useState<{ featured: ProListItem[]; rest: ProListItem[] }>({ featured: [], rest: [] });
  const [rerolled, setRerolled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState(false);
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  /** 전체선택 연출 중(카드 줄이 넘기며 체크) */
  const [selectAllRun, setSelectAllRun] = useState(false);
  /** 찾는 중 화면이 데이터를 기다리는지 — 받기 끝나면(성공·실패 모두) true */
  const [poolReady, setPoolReady] = useState(false);

  const group = useMemo(() => REGION_GROUPS.find((g) => g.key === regionKey), [regionKey]);
  useEffect(() => { captureUtm(); }, []);
  useEffect(() => { if (step === 'results') { setSelectingAll(false); setSelectAllRun(false); } }, [step]);

  // 단일선택 자동 진행. 빠른 연속 탭만 디바운스로 막고, 절대 영구히 막히지 않게 타임스탬프로 관리.
  const lastAdvanceRef = useRef(0);
  function advance(next: Step) {
    const now = Date.now();
    if (now - lastAdvanceRef.current < 350) return;
    lastAdvanceRef.current = now;
    setTimeout(() => setStep(next), 200);
  }
  function back(to: Step) { lastAdvanceRef.current = Date.now(); setStep(to); }

  function press(k: string) {
    setPhone((p) => {
      const d = p.replace(/\D/g, '');
      if (k === 'back') return normalizePhone(d.slice(0, -1));
      if (d.length >= 11) return p;
      return normalizePhone(d + k);
    });
  }

  async function loadPros(g: 'any' | 'male' | 'female') {
    setLoadErr(false);
    try {
      const [res, qp] = await Promise.all([
        discoveryApi.getProList({ limit: 500, sort: 'reviews', withTotal: false }) as Promise<any>,
        matchApi.getQuickPool().catch(() => null),
      ]);
      const rows: ProListItem[] = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      const byId = new Map(rows.map((p) => [p.id, p] as const));
      const pick = (ids: string[] = []) => shuffle(ids.map((id) => byId.get(id)).filter((p): p is ProListItem => !!p));
      // 지정 사회자 — 성별은 사장 명단 기준(프로필 성별 아님). 상관없음이면 여·남 번갈아 12명. 권역 맞는 사람 먼저
      const fm = qp?.featured;
      const featuredList = !fm ? [] : g === 'male' ? pick(fm.male) : g === 'female' ? pick(fm.female) : interleave(pick(fm.female), pick(fm.male));
      const featured = [...featuredList.filter((p) => matchesRegion(p, group)), ...featuredList.filter((p) => !matchesRegion(p, group))];
      // 나머지 — 지정·매칭 제외 빼고 고른 성별만, 최근 견적을 보낸 순(서버 순서). 권역 맞는 사람 먼저
      const skip = new Set([...(fm?.male || []), ...(fm?.female || []), ...(qp?.excluded || [])]);
      const rank = new Map<string, number>();
      (qp?.order || []).forEach((id, i) => rank.set(id, i));
      const others = rows
        .filter((p) => !skip.has(p.id) && matchesGender(p, g))
        .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
      const rest = [...others.filter((p) => matchesRegion(p, group)), ...others.filter((p) => !matchesRegion(p, group))];
      setPool({ featured, rest });
    } catch { setLoadErr(true); setPool({ featured: [], rest: [] }); }
    setPoolReady(true);
  }

  useEffect(() => {
    if (step !== 'searching') return;
    // 시간표(링·목록·문구)는 QmSearching 이 맡고, 끝나면 onDone 으로 결과 화면에 넘긴다
    setRerolled(false); setSelected(new Set()); setPoolReady(false);
    loadPros((gender || 'any') as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 첫 화면 = 지정 사회자 전원, 리롤 = 나머지 5명(지정 명단을 못 받았으면 나머지 5명씩)
  const hasFeatured = pool.featured.length > 0;
  const displayed = useMemo(() => {
    if (!rerolled) return hasFeatured ? pool.featured : pool.rest.slice(0, 5);
    return hasFeatured ? pool.rest.slice(0, 5) : pool.rest.slice(5, 10);
  }, [pool, rerolled, hasFeatured]);
  const canReroll = !rerolled && (hasFeatured ? pool.rest.length > 0 : pool.rest.length > 5);
  // 지정 사회자에게 보내는 신청만 번호가 간다 → 리롤 뒤에 고른 사회자는 연락 방식을 묻지 않고 프리티풀 채팅으로
  const phoneShared = hasFeatured && !rerolled;
  // 몇 단계째인지 — 머리에 'N / 5' + 진행 막대(QUICK_PROGRESS). 결과·연락 방식·번호 화면은 표시 없이.
  const progressOf = (s: Step) => {
    const p = QUICK_PROGRESS[s];
    return p ? { at: p.at, total: QUICK_PROGRESS_TOTAL, from: p.from / QUICK_PROGRESS_TOTAL, to: p.to / QUICK_PROGRESS_TOTAL } : undefined;
  };

  function toggle(id: string) { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function reroll() { if (!canReroll) return; setRerolled(true); setSelected(new Set()); }
  /** 전체선택 — 카드 줄이 첫 장부터 촤라락 넘기며 한 장씩 체크하고, 끝나면 다음 단계(QmProCarousel runAll) */
  function selectAllAndGo() {
    if (selectingAll) return;
    setSelectingAll(true);
    setSelected(new Set()); // 처음부터 하나씩 체크되는 게 보이도록 비운다
    if (loadErr || displayed.length === 0) { setSelectingAll(false); return; }
    setSelectAllRun(true);
  }
  /** 고른 사회자로 다음 단계 — 번호가 가는 신청이면 연락 방식, 아니면 프리티풀 채팅으로 번호 입력 */
  function goAfterSelect() {
    if (phoneShared) { setStep('contact'); return; }
    setContact('프리티풀 채팅');
    setStep('phone');
  }

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || selected.size === 0 || !contact) return;
    setSubmitting(true);
    const utm = { utm_source: sessionStorage.getItem('utm_source') || '', utm_medium: sessionStorage.getItem('utm_medium') || '', utm_campaign: sessionStorage.getItem('utm_campaign') || '', referrer: sessionStorage.getItem('referrer') || '', landing_url: typeof window !== 'undefined' ? window.location.href : '' };
    try {
      await matchApi.quickRequest({ phone: digits, categoryId: '결혼식사회자', type: 'single', selectedProProfileIds: [...selected], eventDate: date || undefined, eventTime: time || undefined, eventLocation: [group?.label, venue.trim()].filter(Boolean).join(' ') || undefined, rawUserInput: { source: 'landing_quick_match', eventDate: date, eventTime: time, region: group?.label, venue: venue.trim(), mood: [...moods].join(', '), part, genderPref: gender, contactMethod: contact, phone: digits, selectedCount: selected.size, quickBatch: phoneShared ? 'featured' : 'reroll', ...utm } });
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') (window as any).fbq('track', 'Lead', { content_category: 'quick-match', currency: 'KRW' });
      setStep('done');
    } catch (e: any) { window.alert(`신청에 실패했어요. 잠시 후 다시 시도해 주세요. ${e?.response?.data?.message || ''}`); }
    setSubmitting(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const phoneDigits = phone.replace(/\D/g, '');

  return (
    <div className="qm-root">
      <style>{CSS}</style>

      {step === 'date' && (
        <div className="qm-page" key="date">
          <Header onBack={() => { try { history.back(); } catch {} }} progress={progressOf('date')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식 일시가<br />언제인가요?</h1>
            <p className="qm-sub qm-a-sub">날짜와 시간에 맞춰 가능한 사회자만 찾아드려요.</p>
            <label className="qm-datefield qm-a-item" style={stag(0)}>
              <Ic name="calendar" size={22} color={date ? '#3182F6' : '#8B95A1'} />
              <span className={date ? 'val' : 'ph'}>{date ? formatKDate(date) : '예식일을 선택해주세요'}</span>
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }} />
            </label>
            <label className="qm-datefield qm-a-item" style={stag(1)}>
              <Ic name="clock" size={22} color={time ? '#3182F6' : '#8B95A1'} />
              <span className={time ? 'val' : 'ph'}>{time ? formatKTime(time) : '예식 시간을 선택해주세요'}</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker(); } catch {} }} />
            </label>
          </main>
          {/* 예식 시간도 필수(260927 사장) */}
          <Cta disabled={!date || !time} onClick={() => setStep('region')}>다음</Cta>
        </div>
      )}

      {step === 'region' && (
        <div className="qm-page" key="region">
          <Header onBack={() => back('date')} progress={progressOf('region')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장은<br />어느 권역인가요?</h1>
            <p className="qm-sub qm-a-sub">가까운 지역의 사회자를 우선 추천해드려요.</p>
            <div className="qm-list">
              {REGION_GROUPS.map((g, i) => (
                <button key={g.key} type="button" className={`qm-opt qm-a-item ${regionKey === g.key ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setRegionKey(g.key); advance('venue'); }}>
                  <span className="qm-opt-t">{g.label}</span>
                  <span className="qm-chk-line">{regionKey === g.key && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'venue' && (
        <div className="qm-page" key="venue">
          <Header onBack={() => back('region')} progress={progressOf('venue')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장 이름을<br />알려주세요</h1>
            <p className="qm-sub qm-a-sub">예식장을 알면 더 잘 맞는 사회자를 찾아드려요.</p>
            <input className="qm-textinput qm-a-item" style={stag(0)} type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="예: 빌라드지디 청담" enterKeyHint="next"
              onKeyDown={(e) => { if (e.key === 'Enter' && venue.trim()) setStep('mood'); }} />
          </main>
          {/* 예식장(웨딩홀) 이름 필수(260927 사장) — 예전 '건너뛰기' 없앰 */}
          <Cta disabled={!venue.trim()} onClick={() => setStep('mood')}>다음</Cta>
        </div>
      )}

      {step === 'mood' && (
        <div className="qm-page" key="mood">
          <Header onBack={() => back('venue')} progress={progressOf('mood')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">어떤 분위기의<br />예식을 원하세요?</h1>
            <p className="qm-sub qm-a-sub">원하는 분위기를 모두 선택하세요. 여러 개 선택할 수 있어요.</p>
            <div className="qm-list">
              {MOOD_OPTIONS.map((m, i) => {
                const on = moods.has(m.label);
                return (
                  <button key={m.label} type="button" className={`qm-opt icon sub qm-a-item ${on ? 'on' : ''}`} style={stag(i)}
                    onClick={() => setMoods((prev) => { const n = new Set(prev); n.has(m.label) ? n.delete(m.label) : n.add(m.label); return n; })}>
                    <span className={`qm-opt-ic ${on ? 'on' : ''}`}><Ic name={m.icon} size={22} color={on ? '#3182F6' : '#6B7684'} /></span>
                    <span className="qm-opt-tt"><span className="qm-opt-t">{m.label}</span><span className="qm-opt-hint">{m.desc}</span></span>
                    <span className={`qm-chk ${on ? 'on' : ''}`}>{on && <Ic name="check" size={16} color="#fff" />}</span>
                  </button>
                );
              })}
            </div>
          </main>
          <Cta disabled={moods.size === 0} onClick={() => setStep('part')}>{moods.size > 0 ? `${moods.size}개 선택 · 다음` : '다음'}</Cta>
        </div>
      )}

      {step === 'part' && (
        <div className="qm-page" key="part">
          <Header onBack={() => back('mood')} progress={progressOf('part')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">몇 부 진행이<br />필요하세요?</h1>
            <p className="qm-sub qm-a-sub">1부(본식)·2부(피로연) 중 필요한 진행을 알려주세요.</p>
            <div className="qm-list">
              {PART_OPTIONS.map((p, i) => {
                const on = part === p.label;
                return (
                  <div className="qm-optwrap qm-a-item" style={stag(i)} key={p.label}>
                    <button type="button" className={`qm-opt ${on ? 'on' : ''}`} onClick={() => setPart(p.label)}>
                      <span className="qm-opt-t">{p.label}</span>
                      <span className="qm-chk-line">{on && <Ic name="check" size={20} color="#3182F6" />}</span>
                    </button>
                    {on && p.note && <NoteCard note={p.note} />}
                  </div>
                );
              })}
            </div>
          </main>
          <Cta disabled={!part} onClick={() => setStep('gender')}>다음</Cta>
        </div>
      )}

      {step === 'gender' && (
        <div className="qm-page" key="gender">
          <Header onBack={() => back('part')} progress={progressOf('gender')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">선호하는<br />사회자 성별이 있나요?</h1>
            <p className="qm-sub qm-a-sub">원하시는 성별의 사회자를 우선 보여드려요.</p>
            <div className="qm-list">
              {GENDERS.map((g, i) => (
                <button key={g.k} type="button" className={`qm-opt qm-a-item ${gender === g.k ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setGender(g.k); advance('searching'); }}>
                  <span className="qm-opt-t">{g.label}</span>
                  <span className="qm-chk-line">{gender === g.k && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'searching' && (
        <QmSearching pool={pool} ready={poolReady} failed={loadErr} onDone={() => setStep('results')} onBack={() => back('gender')} />
      )}

      {step === 'results' && (
        <div className="qm-page" key="results">
          {/* 다른 사회자 보기(리롤)는 머리 오른쪽, 'N명 선택됨' 줄은 없앰(261002 사장) — 고른 수는 아래 버튼('N명 선택 완료')이 말한다 */}
          <Header onBack={() => back('gender')} progress={progressOf('results')}
            right={<button type="button" className="qm-hreroll" onClick={reroll} disabled={!canReroll || selectingAll}><Ic name="refresh" size={15} color="currentColor" />{rerolled ? '다시 찾기 완료' : '다른 사회자 보기'}</button>} />
          <main className="qm-main tight">
            <h1 className="qm-h1 qm-a-title">조건에 가장 잘 맞는<br />사회자 <b className="blue">{displayed.length || 5}명</b>을 찾았어요</h1>
            <p className="qm-sub qm-a-sub">옆으로 넘겨 보고, 의뢰할 사회자를 눌러 선택하세요. 여러 명 선택할 수 있어요.</p>
            {loadErr ? (
              <div className="qm-err">사회자를 불러오지 못했어요.<br /><button type="button" onClick={() => setStep('searching')}>다시 시도</button></div>
            ) : (
              <QmProCarousel pros={displayed} selected={selected} onToggle={toggle}
                runAll={selectAllRun}
                onSelectOne={(id) => setSelected((prev) => new Set(prev).add(id))}
                onRunAllDone={() => { setSelectAllRun(false); goAfterSelect(); }} />
            )}
          </main>
          <div className="qm-ctawrap qm-btnrow">
            <button type="button" className="qm-cta ghost" onClick={() => back('gender')} disabled={selectingAll}>이전으로</button>
            {/* 몇 명을 골랐으면 그 사람들에게만('N명 선택 완료'), 안 골랐으면 전체선택(260927 사장 — 골라도 전체선택만 돼 있던 것) */}
            <button type="button" className="qm-cta" onClick={selected.size > 0 ? goAfterSelect : selectAllAndGo} disabled={selectingAll}>
              {selectingAll ? '선택 중…' : selected.size > 0 ? `${selected.size}명 선택 완료` : '전체선택'}
            </button>
          </div>
        </div>
      )}

      {step === 'contact' && (
        <div className="qm-page" key="contact">
          <Header onBack={() => back('results')} progress={progressOf('contact')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">어떤 방식으로<br />연락받으시겠어요?</h1>
            <p className="qm-sub qm-a-sub">선택한 {selected.size}명의 사회자가 이 방법으로 연락드려요.</p>
            <div className="qm-list">
              {CONTACTS.map((c, i) => {
                const on = contact === c.k;
                return (
                  <button key={c.k} type="button" className={`qm-opt icon sub qm-a-item ${on ? 'on' : ''}`} style={stag(i)} onClick={() => { setContact(c.k); advance('phone'); }}>
                    <span className={`qm-opt-ic ${on ? 'on' : ''}`}><Ic name={c.icon} size={22} color={on ? '#3182F6' : '#6B7684'} /></span>
                    <span className="qm-opt-tt"><span className="qm-opt-t">{c.label}</span><span className="qm-opt-hint">{c.hint}</span></span>
                    <span className="qm-chk-line">{on && <Ic name="check" size={20} color="#3182F6" />}</span>
                  </button>
                );
              })}
            </div>
          </main>
        </div>
      )}

      {step === 'phone' && (
        <div className="qm-page" key="phone">
          <Header onBack={() => back(phoneShared ? 'contact' : 'results')} progress={progressOf('phone')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">연락받을 번호를<br />입력해주세요</h1>
            <p className="qm-sub qm-a-sub">{contact}(으)로 연락드려요. 매칭된 사회자 연결에만 사용돼요.</p>
            <div className={`qm-bignum qm-a-item ${phoneDigits ? 'on' : ''}`} style={stag(0)}>
              <span className="qm-bignum-t">
                {phone ? <b>{phone}</b> : <i>010-0000-0000</i>}
                <em className="qm-caret" />
              </span>
            </div>
          </main>
          <div className="qm-phone-bottom">
            <div className="qm-cta-pad">
              <button type="button" className="qm-cta" disabled={phoneDigits.length < 10 || submitting} onClick={submit}>{submitting ? '신청 중…' : '매칭 신청하기'}</button>
            </div>
            <div className="qm-keypad">
              {KEYS.map((k, i) => (
                <button type="button" key={i} className={`qm-key ${k === '' ? 'empty' : ''}`} disabled={k === ''} onClick={() => k && press(k)}>
                  {k === 'back' ? <Ic name="backspace" size={26} color="#191F28" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="qm-page center" key="done">
          <span className="qm-done-ic"><Ic name="check" size={40} color="#fff" /></span>
          <h2 className="qm-h2 center">매칭 신청이<br />완료되었어요</h2>
          <p className="qm-done-sub">선택하신 <b className="blue">{selected.size}명</b>의 사회자에게 신청이 전달됐어요.<br />{contact}(으)로 곧 연락드릴게요.</p>
          <div className="qm-summary">
            <div><span>예식 일시</span><b>{[date ? formatKDate(date) : '', formatKTime(time)].filter(Boolean).join(' ') || '-'}</b></div>
            <div><span>지역</span><b>{[group?.label, venue.trim()].filter(Boolean).join(' ') || '-'}</b></div>
            <div><span>분위기</span><b>{[...moods].join(', ') || '-'}</b></div>
            <div><span>연락방식</span><b>{contact}</b></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 머리 — 뒤로 + 몇 단계째인지(진행 막대 + 'N / 전체'). 막대는 앞 단계 길이에서 이번 단계 길이로 늘어난다 */
/**
 * 진행 단계(260928 사장 '1/9 → 1/5 — 1~5 끝나면 매칭 화면이라 그다음은 번호 없어도 됨'): 성별까지 다섯 단계.
 * 예식 장소는 권역 → 예식장 이름 두 화면을 한 단계로 센다(번호는 2 그대로, 막대만 반 칸씩 찬다) → 5/5(성별) 다음이 바로 매칭.
 */
const QUICK_PROGRESS_TOTAL = 5;
const QUICK_PROGRESS: Partial<Record<Step, { at: number; from: number; to: number }>> = {
  date: { at: 1, from: 0, to: 1 },
  region: { at: 2, from: 1, to: 1.5 },
  venue: { at: 2, from: 1.5, to: 2 },
  mood: { at: 3, from: 2, to: 3 },
  part: { at: 4, from: 3, to: 4 },
  gender: { at: 5, from: 4, to: 5 },
};

function Header({ onBack, progress, right }: { onBack: () => void; progress?: { at: number; total: number; from: number; to: number }; right?: React.ReactNode }) {
  return (
    <header className="qm-header">
      <button type="button" onClick={onBack} aria-label="뒤로"><Ic name="back" size={26} color="#191F28" /></button>
      {progress && (
        <div className="qm-progress" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.at} aria-label={`전체 ${progress.total}단계 중 ${progress.at}단계`}>
          <span className="qm-progress-track">
            <span
              className="qm-progress-fill"
              style={{ '--from': `${progress.from * 100}%`, '--to': `${progress.to * 100}%` } as React.CSSProperties}
            />
          </span>
          <span className="qm-progress-t"><b>{progress.at}</b> / {progress.total}</span>
        </div>
      )}
      {right && <div className="qm-header-right">{right}</div>}
    </header>
  );
}
function Cta({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <div className="qm-ctawrap"><button type="button" className="qm-cta" disabled={disabled} onClick={onClick}>{children}</button></div>;
}

const CSS = `
.qm-root{--blue:#3182F6;--blue-press:#2272EB;--blue-bg:#EDF4FF;--t-strong:#191F28;--t:#333D4B;--t-sub:#4E5968;--t-weak:#6B7684;--t-ph:#8B95A1;--t-dis:#B0B8C1;--border:#E5E8EB;--divider:#F2F4F6;--bg-gray:#F2F4F6;
 font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 -webkit-font-smoothing:antialiased;background:#fff;color:var(--t-strong);min-height:100dvh;max-width:520px;margin:0 auto;}
.qm-ic{display:inline-block;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;flex:none;}
.qm-root b,.qm-root strong{font-weight:600;}
.qm-page{display:flex;flex-direction:column;min-height:100dvh;}
.qm-page.center{align-items:center;justify-content:center;text-align:center;padding:0 32px;animation:qm-pagefade .32s ease both;}
@keyframes qm-fadeup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes qm-slidein{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
@keyframes qm-pagefade{from{opacity:0}to{opacity:1}}
.qm-a-title{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) both;}
.qm-a-sub{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) .18s both;}
.qm-a-item{animation:qm-slidein .46s cubic-bezier(.22,.61,.36,1) both;}
.qm-header{height:56px;display:flex;align-items:center;padding:0 8px;flex:none;}
.qm-header button{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:20px;cursor:pointer;}
.qm-header button:active{background:var(--divider);}
.qm-progress{flex:1;display:flex;align-items:center;gap:12px;padding:0 20px 0 6px;}
.qm-progress-track{flex:1;height:4px;border-radius:2px;background:var(--divider);overflow:hidden;}
.qm-progress-fill{display:block;height:100%;width:var(--to);border-radius:2px;background:var(--blue);animation:qm-progress .5s cubic-bezier(.22,.61,.36,1) both;}
@keyframes qm-progress{from{width:var(--from)}to{width:var(--to)}}
.qm-progress-t{flex:none;font-size:13px;font-weight:500;color:var(--t-ph);font-variant-numeric:tabular-nums;letter-spacing:.2px;}
.qm-progress-t b{color:var(--blue);font-weight:600;}
.qm-main{flex:1;padding:8px 24px 24px;}
.qm-main.tight{padding:8px 16px 24px;}
.qm-h1{font-size:24px;font-weight:600;line-height:1.4;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h1 .blue{color:var(--blue);}
.qm-h2{font-size:21px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h2.center{margin-top:26px;}
.qm-sub{font-size:15px;color:var(--t-ph);margin:10px 0 0;line-height:1.5;}
.qm-datefield{position:relative;display:flex;align-items:center;gap:12px;height:60px;margin-top:16px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;}
.qm-datefield:first-of-type{margin-top:28px;}
.qm-datefield:focus-within{border-color:var(--blue);}
.qm-datefield .ph{color:var(--t-ph);font-size:16px;}
.qm-datefield .val{color:var(--t-strong);font-size:16px;font-weight:600;}
.qm-datefield input{position:absolute;inset:0;opacity:0;width:100%;height:100%;border:0;background:none;cursor:pointer;}
.qm-list{margin-top:26px;display:flex;flex-direction:column;gap:10px;}
.qm-optwrap{display:block;}
.qm-opt{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s;text-align:left;}
.qm-opt:active{background:#F8F9FA;}
.qm-opt.on{border-color:var(--blue);background:var(--blue-bg);}
.qm-opt.icon,.qm-opt.sub{padding:14px 18px;}
.qm-opt-ic{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--divider);}
.qm-opt-ic.on{background:#DCEBFF;}
.qm-opt-t{flex:1;font-size:17px;font-weight:600;color:var(--t);}
.qm-opt.on .qm-opt-t{color:var(--blue);}
.qm-opt-tt{flex:1;display:flex;flex-direction:column;gap:3px;}
.qm-opt-hint{font-size:13px;font-weight:400;color:var(--t-ph);}
.qm-chk-line{width:24px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;}
.qm-note{margin:8px 2px 0;padding:16px 18px;background:var(--divider);border-radius:14px;animation:qm-note-in .28s ease both;}
.qm-note b{display:block;font-size:15px;color:var(--t-strong);}
.qm-note p{margin:8px 0 0;font-size:14px;line-height:1.55;color:var(--t-sub);}
.qm-note ol{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;}
.qm-note li{display:flex;gap:6px;font-size:14px;line-height:1.5;color:var(--t-sub);}
.qm-note li span{flex:none;color:var(--t-weak);}
@keyframes qm-note-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.qm-textinput{margin-top:36px;width:100%;border:0;border-bottom:2px solid var(--border);background:none;font-family:inherit;font-size:22px;font-weight:600;color:var(--t-strong);padding:0 2px 12px;outline:none;}
.qm-textinput::placeholder{color:var(--t-dis);font-weight:600;}
.qm-textinput:focus{border-color:var(--blue);}
.qm-ctawrap{position:sticky;bottom:0;background:#fff;padding:10px 20px calc(env(safe-area-inset-bottom,0px) + 16px);flex:none;}
.qm-cta{width:100%;height:56px;border:0;border-radius:16px;background:var(--blue);color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:transform .05s,background .15s;font-family:inherit;}
.qm-cta:active:not(:disabled){transform:scale(.99);background:var(--blue-press);}
.qm-cta:disabled{background:var(--bg-gray);color:var(--t-dis);cursor:default;}
.qm-btnrow{display:flex;gap:10px;}
.qm-btnrow .qm-cta{flex:1;width:auto;}
.qm-btnrow .qm-cta.ghost{background:var(--divider);color:var(--t-sub);}
.qm-btnrow .qm-cta.ghost:active{transform:scale(.99);background:#E5E8EB;}
.qm-bignum{margin-top:44px;padding-bottom:16px;border-bottom:2px solid var(--border);transition:border-color .15s;}
.qm-bignum.on{border-color:var(--blue);}
.qm-bignum-t{display:flex;align-items:center;font-size:28px;font-weight:600;letter-spacing:.5px;line-height:1;}
.qm-bignum-t b{color:var(--t-strong);}
.qm-bignum-t i{color:var(--t-dis);font-style:normal;font-weight:600;}
.qm-caret{width:2px;height:28px;background:var(--blue);margin-left:2px;animation:qm-blink 1s step-end infinite;}
@keyframes qm-blink{50%{opacity:0}}
.qm-phone-bottom{margin-top:auto;flex:none;}
.qm-cta-pad{padding:0 20px 10px;}
.qm-keypad{display:grid;grid-template-columns:repeat(3,1fr);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6px);}
.qm-key{height:62px;display:flex;align-items:center;justify-content:center;border:0;background:none;font-size:26px;font-weight:500;color:var(--t-strong);cursor:pointer;font-family:inherit;transition:background .1s;border-radius:14px;margin:2px 6px;}
.qm-key:active:not(.empty){background:var(--divider);}
.qm-key.empty{pointer-events:none;}
.qm-s-main{padding:4px 24px 32px;}
.qm-s-titlebox{position:relative;min-height:62px;}
.qm-s-title{font-size:22px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-s-title.in{animation:qm-s-tin .34s cubic-bezier(.22,.61,.36,1) .08s both;}
.qm-s-title.out{position:absolute;left:0;top:0;right:0;animation:qm-s-tout .16s ease both;}
@keyframes qm-s-tin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes qm-s-tout{from{opacity:1}to{opacity:0}}
/* 링 — 연한 하늘 도넛 위로 위에서부터 시계 방향(꼬리 연함 → 머리 진함), 둥근 머리·꼬리 */
.qm-s-ringwrap{position:relative;width:178px;height:206px;margin:30px auto 0;}
.qm-s-ring{position:absolute;left:0;top:0;width:178px;height:178px;}
.qm-s-track,.qm-s-arc{position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 38px),#000 calc(100% - 37.4px));mask:radial-gradient(closest-side,transparent calc(100% - 38px),#000 calc(100% - 37.4px));}
.qm-s-track{background:#F4F7FE;}
.qm-s-arc{background:conic-gradient(from 0deg,transparent var(--tail),rgba(61,132,247,0) var(--tail),rgba(61,132,247,var(--a)) var(--head),transparent var(--head));}
/* 둥근 머리 — 바탕(링 색) 위에 머리와 같은 진하기로 */
.qm-s-cap{position:absolute;left:50%;top:0;width:38px;height:38px;margin-left:-19px;border-radius:50%;transform-origin:19px 89px;transform:rotate(var(--head));background:radial-gradient(closest-side,rgba(61,132,247,var(--a)) 99%,transparent 100%),#F4F7FE;}
.qm-s-num{position:absolute;left:0;top:0;width:178px;height:178px;display:flex;align-items:center;justify-content:center;gap:1px;padding-bottom:4px;}
.qm-s-num b{font-size:46px;font-weight:700;letter-spacing:-1.6px;color:var(--blue);font-variant-numeric:tabular-nums;line-height:1;}
.qm-s-num i{font-style:normal;font-size:21px;font-weight:600;color:#A6C8FA;margin-top:8px;}
.qm-s-ic{position:absolute;left:50%;top:143px;width:58px;height:58px;margin-left:-29px;object-fit:contain;z-index:1;filter:drop-shadow(0 4px 6px rgba(70,100,160,.18));}
.qm-s-icshadow{position:absolute;left:50%;top:192px;width:120px;height:14px;margin-left:-60px;border-radius:50%;background:radial-gradient(closest-side,rgba(120,150,210,.22),rgba(120,150,210,0));}
/* 탭 — 회색 바탕 두 칸, 흰 알약이 미끄러진다 */
.qm-s-tabs{position:relative;display:flex;height:46px;padding:4px;margin-top:22px;border-radius:14px;background:var(--bg-gray);}
.qm-s-pill{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:10px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .32s cubic-bezier(.22,.61,.36,1);}
.qm-s-tab{position:relative;z-index:1;flex:1;border:0;background:none;font-family:inherit;font-size:15px;font-weight:600;color:var(--t-ph);cursor:pointer;transition:color .2s;}
.qm-s-tab.on{color:var(--t-strong);}
/* 목록 — 들어온 줄은 제자리에서 커지며 + 연한 파랑이 1초쯤 뒤 사라진다 */
.qm-s-list{position:relative;margin-top:10px;}
.qm-s-rows{position:relative;}
.qm-s-slot{position:absolute;left:0;right:0;top:0;transition:transform .38s cubic-bezier(.22,.61,.36,1);will-change:transform;}
.qm-s-row{position:relative;display:flex;align-items:center;gap:14px;height:70px;padding:0 12px;margin:0 -12px;border-radius:16px;}
.qm-s-row.new{animation:qm-s-rowin .42s cubic-bezier(.22,.61,.36,1) both,qm-s-hl 1.25s ease both;}
@keyframes qm-s-rowin{from{opacity:.25;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes qm-s-hl{0%,35%{background:#EAF2FE}100%{background:rgba(234,242,254,0)}}
.qm-s-ava{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none;background:var(--divider);}
.qm-s-txt{flex:1;min-width:0;display:flex;flex-direction:column;}
.qm-s-name{font-size:17px;font-weight:600;letter-spacing:-.3px;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qm-s-sub{margin-top:2px;font-size:13.5px;color:var(--t-ph);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qm-s-sub.wait{color:var(--t-dis);}
.qm-s-val{flex:none;display:flex;flex-direction:column;align-items:flex-end;}
.qm-s-val b{font-size:17px;font-weight:600;color:var(--blue);letter-spacing:-.2px;}
.qm-s-val span{margin-top:2px;font-size:13.5px;color:var(--t-ph);}
.qm-s-row.skel .qm-s-ava,.qm-s-bar{background:linear-gradient(90deg,#F2F4F6 0%,#E9ECEF 50%,#F2F4F6 100%);background-size:200% 100%;animation:qm-s-shine 1.2s linear infinite;}
.qm-s-bar{display:block;height:13px;border-radius:7px;}
.qm-s-bar.w1{width:38%;}
.qm-s-bar.w2{width:58%;margin-top:8px;height:11px;}
@keyframes qm-s-shine{from{background-position:200% 0}to{background-position:0 0}}
@keyframes qm-s-fade{to{opacity:0}}
@media (prefers-reduced-motion:reduce){.qm-s-title.in,.qm-s-title.out,.qm-s-row.new{animation:none;}}
.qm-header-right{margin-left:auto;padding-right:12px;display:flex;align-items:center;}
.qm-header .qm-hreroll{width:auto;height:34px;display:flex;align-items:center;gap:5px;border:1px solid var(--border);background:#fff;color:var(--t-sub);font-size:13.5px;font-weight:600;padding:0 13px 0 11px;border-radius:999px;cursor:pointer;font-family:inherit;white-space:nowrap;}
.qm-header .qm-hreroll:active{background:var(--divider);}
.qm-header .qm-hreroll:disabled{opacity:.4;cursor:default;}
/* 사회자 카드 줄 — 상세 히어로와 같은 넘기기(왼쪽 정렬·peek·스냅·0.9배) */
.qm-cwrap{margin:2px -16px 0;}
.qm-carousel{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:14px 18px 20px;scroll-snap-type:x mandatory;scroll-padding-left:18px;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain;}
.qm-carousel::-webkit-scrollbar{display:none;}
.qm-cslide{flex:0 0 min(72vw,300px);scroll-snap-align:start;transition:transform .3s cubic-bezier(.22,.61,.36,1);}
/* 키 작은 폰 — 카드를 조금 줄여 이름 줄까지 첫 화면에 더 들어오게(넘치면 세로로 내려 본다) */
@media (max-height:720px){.qm-cslide{flex-basis:min(64vw,260px);}}
.qm-cdots{display:flex;justify-content:center;gap:6px;margin-top:-4px;}
.qm-cdots button{width:6px;height:6px;padding:0;border:0;border-radius:50%;background:#D5DAE0;transition:background-color .3s;cursor:pointer;}
.qm-cdots button.on{background:#191F28;}
.qm-ccheck{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.26);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.85);transition:background-color .2s,box-shadow .2s,transform .25s cubic-bezier(.34,1.56,.64,1);}
.qm-ccheck.on{background:var(--tone-accent,var(--blue));box-shadow:none;transform:scale(1.06);}
.qm-ccheck path{stroke-dasharray:1;stroke-dashoffset:1;animation:qm-check-draw .36s .02s cubic-bezier(.65,0,.35,1) forwards;}
.qm-cvideo{position:absolute;left:14px;bottom:24px;z-index:2;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 13px 0 11px;border:0;border-radius:16px;color:#fff;font-family:inherit;font-size:13.5px;font-weight:600;letter-spacing:-.2px;background:rgba(0,0,0,.38);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.2);cursor:pointer;}
.qm-cvideo:active{background:rgba(0,0,0,.5);}
/* 소개영상 시트 */
.qm-vdim{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.42);display:flex;align-items:flex-end;justify-content:center;animation:qm-pagefade .2s ease both;}
.qm-vsheet{width:100%;max-width:520px;background:#fff;border-radius:28px 28px 0 0;padding:10px 20px calc(env(safe-area-inset-bottom,0px) + 14px);animation:qm-sheetup .42s cubic-bezier(.32,.72,0,1) both;}
@keyframes qm-sheetup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.qm-vgrab{display:block;width:40px;height:5px;border-radius:3px;background:#D1D6DB;margin:0 auto 14px;}
.qm-vhead{display:flex;align-items:baseline;gap:8px;margin:0 2px 12px;}
.qm-vhead b{font-size:19px;font-weight:600;color:var(--t-strong);letter-spacing:-.3px;}
.qm-vhead span{font-size:14px;color:var(--t-ph);}
.qm-vplayer{position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;}
.qm-vplayer iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
.qm-vthumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;scrollbar-width:none;}
.qm-vthumbs::-webkit-scrollbar{display:none;}
.qm-vthumbs button{flex:none;width:96px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;border:0;padding:0;opacity:.55;box-shadow:inset 0 0 0 2px transparent;cursor:pointer;transition:opacity .2s;}
.qm-vthumbs button.on{opacity:1;outline:2px solid var(--blue);outline-offset:-2px;}
.qm-vthumbs img{width:100%;height:100%;object-fit:cover;display:block;}
.qm-vbtns{margin-top:16px;}
.qm-chk{width:26px;height:26px;flex:none;border-radius:50%;border:2px solid #D1D6DB;display:flex;align-items:center;justify-content:center;}
.qm-chk.on{border-color:var(--blue);background:var(--blue);}
@keyframes qm-check-draw{to{stroke-dashoffset:0;}}
.qm-err{margin-top:40px;text-align:center;color:var(--t-ph);font-size:14px;line-height:1.6;}
.qm-err button{margin-top:12px;background:var(--divider);color:var(--t-sub);font-weight:600;border:0;border-radius:12px;padding:9px 16px;cursor:pointer;font-family:inherit;}
.qm-done-ic{width:84px;height:84px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;}
.qm-done-sub{margin-top:14px;font-size:15px;line-height:1.6;color:var(--t-weak);}
.qm-done-sub .blue,.blue{color:var(--blue);}
.qm-summary{margin-top:30px;width:100%;max-width:330px;background:#F9FAFB;border-radius:16px;padding:6px 18px;}
.qm-summary>div{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--divider);}
.qm-summary>div:last-child{border-bottom:0;}
.qm-summary span{font-size:14px;color:var(--t-ph);flex:none;}
.qm-summary b{font-size:14px;font-weight:600;color:var(--t);text-align:right;}
/* ── PC(넓은 화면): 가운데 카드 프레임 ── */
@media (min-width:768px){
  .qm-root{max-width:none;background:#EBEEF3;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;}
  .qm-page{width:100%;max-width:430px;height:min(824px,94vh);min-height:0;background:#fff;border-radius:28px;box-shadow:0 16px 50px rgba(17,24,39,.14);overflow:hidden;}
  .qm-page.center{width:100%;max-width:430px;height:min(824px,94vh);}
  .qm-main{overflow-y:auto;}
  .qm-ctawrap{padding-bottom:18px;}
  .qm-keypad{padding-bottom:10px;}
  .qm-opt:hover:not(.on){border-color:#C4CCD4;background:#FBFCFD;}
  .qm-cta:hover:not(:disabled){background:var(--blue-press);}
  .qm-btnrow .qm-cta.ghost:hover{background:#E5E8EB;}
  .qm-header .qm-hreroll:hover:not(:disabled){background:var(--divider);}
  .qm-header button:hover{background:var(--divider);}
  /* PC 틀(430×824) — 카드가 버튼 줄에 가리지 않게 */
  .qm-cslide{flex-basis:272px;}
}
`;
