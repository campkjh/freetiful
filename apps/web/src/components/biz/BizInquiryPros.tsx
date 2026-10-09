'use client';

/*
 * 비즈 상담 '사회자 섭외' 카드 줄(261009 사장 '프리티풀 비즈 상담 이거 사회자섭외 부분 누르면 사회자 리스트 주르륵 나오게끔 해줘').
 *
 *  · 언제: 문의유형이 기업행사 사회자 섭외(enterprise) · 결혼식 사회자 섭외(wedding) · 축제 · 체육대회(festival)일 때,
 *    유형 다음 질문 '이런 사회자들이 함께해요 · 원하는 분을 골라 주세요(여러 명 가능)' 아래(BizInquiryChat 'pros' 단계).
 *    축제 · 체육대회도 넣는다 — 비즈 문의는 결국 진행자 섭외이고(비즈 FAQ '축제, 체육대회 등 전문 진행자가 필요한 행사'),
 *    사회자 태그에 '체육대회' · '축제/페스티벌' · '레크리에이션' · '팀빌딩'이 따로 있어 그 행사에 맞는 사람을 앞에 세울 수 있다.
 *    웨딩홀 전속 제휴 · 제휴 · 기타는 사회자 한 사람을 고르는 문의가 아니라 뺀다.
 *  · 데이터: 홈 · /pros 와 같은 공개 사회자 목록(discoveryApi.getProList(PRO_FEED_LIST_PARAMS) — 같은 캐시라 다녀왔으면 바로 보인다).
 *    순서 = 홈 BEST 와 같은 기준(어드민 사회자 랭킹 rankOrder 먼저 → 안 매긴 사람은 리뷰 3개 이상 평점순 → 나머지 평점순).
 *      결혼식 = BEST 와 같은 사람들(분류 결혼식 · 사회자 · MC + 분류가 빈 사회자) 순서 그대로,
 *      기업행사 = 행사 · 기업 · 컨퍼런스 · 컨벤션 · 쇼호스트 태그(홈 행사 사회자 칸과 같은 낱말) 먼저,
 *      축제 · 체육대회 = 체육대회 · 축제 · 레크리에이션 · 팀빌딩 태그 먼저 → 행사 태그 → 나머지. 12명 + 끝에 '더 보기'.
 *  · 매칭 제외 사회자(api match/quick-match.config.ts MATCH_EXCLUDED_PRO_IDS — 서나웅 · 김정현(점검 계정) · 황지애)는 웹에 사본이 없어
 *    퀵매칭과 같은 GET /match/quick-pool 의 excluded 로 뺀다(비로그인 공개 API). 그걸 못 받으면 리뷰 0건 사회자를 빼고 보인다
 *    (제외 명단이 지금 모두 리뷰 0 — 점검 계정이 섞여 나오지 않게 하는 안전한 쪽).
 *  · 카드 = 홈 사회자 카드(ProToneCard — 사진 색 카드)의 결을 작게: 사진 4:5(아래가 카드 색으로 녹음) · 경력 배지 · 이름 · ★ 평점(리뷰) · 태그 1~2.
 *    ProToneCard 는 글자가 한국어로 박혀 있어(비즈는 4개 언어) 같은 색 뽑기(lib/image-tone)로 여기서 작게 다시 그린다.
 *    누르면 고르기(체크 원 + 사진 톤 색 테두리 — 퀵매칭 결과 카드와 같은 어법 · toneAccent), '프로필 ›' 작은 단추 · 길게 누르기 = 사회자 상세(/pros/[id]).
 *    같은 탭으로 간다 — 상담 대화 · 고른 사람은 BizInquiryChat 의 sessionStorage 저장본이, 줄 위치는 아래 UI_KEY 가 되살려
 *    돌아오면 하던 그대로다('더 보기' → /pros 도 같은 이유로 같은 탭 · 결혼식은 '결혼식사회자', 기업행사 · 축제는 '전문행사사회자' 보기).
 *    이미 고른 사람이 줄에 없으면(유형을 바꿈 · 다시 고르기) 줄 맨 앞에 같이 보여 뺄 수 있게 한다.
 *  · 줄 = 채팅 칸 전체 폭(말풍선 들여쓰기 밖까지) + 좌우 끝 흰 그라데이션, CSS 스냅. 첫 카드는 말풍선 왼쪽 끝에 맞춘다.
 *    처음 나올 때만 카드가 오른쪽에서 차례로 흘러 들어온다(되살린 화면은 그냥 보인다). PC(마우스)는 좌우 화살표 단추.
 */

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { discoveryApi, getCachedProList, type ProListItem } from '@/lib/api/discovery.api';
import { matchApi } from '@/lib/api/match.api';
import { PRO_FEED_LIST_PARAMS } from '@/components/pros/ProFeedCard';
import { toneAccent, useImageTone } from '@/lib/image-tone';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons/mono';
import { getT, useBizLang, useT, type Translations } from '@/lib/biz/i18n';

/* ───────────── 유형 · 고른 사람 ───────────── */

/** 사회자를 고르는 문의유형(값은 BizInquiryChat INQUIRY_TYPES 와 같은 것) */
export const MC_INQUIRY_TYPES = ['enterprise', 'wedding', 'festival'] as const;
export type McInquiryKind = (typeof MC_INQUIRY_TYPES)[number];
export const isMcInquiry = (v: unknown): v is McInquiryKind => typeof v === 'string' && (MC_INQUIRY_TYPES as readonly string[]).includes(v);

/** 고른 사회자 — 이름까지 같이 남긴다(말풍선 · 접수 문구가 목록을 다시 받지 않아도 되게) */
export type PickedPro = { id: string; name: string };

/** 저장본에서 읽은 고른 사람 — 모양이 어긋난 건 버린다 */
export function cleanPicked(v: unknown): PickedPro[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: PickedPro[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const id = String((x as { id?: unknown }).id ?? '').slice(0, 64);
    const name = String((x as { name?: unknown }).name ?? '').slice(0, 40);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
    if (out.length >= 30) break;
  }
  return out;
}

/* ───────────── 데이터 ───────────── */

const SHOW = 12;
const rowsOf = (res: unknown): ProListItem[] => {
  const r = res as { data?: unknown } | null;
  return Array.isArray(r?.data) ? (r!.data as ProListItem[]) : Array.isArray(res) ? (res as ProListItem[]) : [];
};
const cachedRows = (): ProListItem[] | null => {
  const r = rowsOf(getCachedProList(PRO_FEED_LIST_PARAMS));
  return r.length ? r : null;
};
const loadRows = () => discoveryApi.getProList(PRO_FEED_LIST_PARAMS).then(rowsOf);

/** 매칭 제외 명단 — 한 번 받으면 이 탭에선 기억(상세에 다녀와도 바로) */
let excludedMemo: string[] | null = null;
let excludedLoading: Promise<string[] | null> | null = null;
function loadExcluded(): Promise<string[] | null> {
  if (excludedMemo) return Promise.resolve(excludedMemo);
  if (!excludedLoading) {
    excludedLoading = matchApi.getQuickPool()
      .then((r) => {
        // excluded 가 배열이 아니면(옛 API · 프록시가 다른 본문을 200 으로 줌) 못 받은 것으로 — 빈 명단으로 확정하면
        // '리뷰 0건 빼기' 안전장치가 안 돌아 제외 사회자가 섞였다. 기억도 안 해서 다음 진입에 다시 받는다(261009 검증)
        if (!Array.isArray(r?.excluded)) return null;
        excludedMemo = r.excluded.map(String);
        return excludedMemo;
      })
      .catch(() => null)
      .finally(() => { excludedLoading = null; });
  }
  return excludedLoading;
}

/** 상담 화면에 들어오면 미리 받아 둔다 — 유형을 고를 즈음엔 목록이 와 있게 */
export function prefetchBizInquiryPros() {
  void loadExcluded();
  loadRows().catch(() => { /* 고를 때 다시 받는다 */ });
}

type ProRow = ProListItem & { rankOrder?: number | null };
const lower = (xs: unknown) => (Array.isArray(xs) ? xs : []).map((x) => String(x ?? '').toLowerCase());
const hasWord = (p: ProListItem, words: readonly string[]) =>
  [...lower(p.categories), ...lower(p.tags)].some((v) => words.some((w) => v.includes(w)));
const WEDDING_CAT = ['결혼식', '사회자', 'mc'] as const;
const EVENT_WORDS = ['행사', '기업', '컨퍼런스', '컨벤션', '쇼호스트', 'event'] as const;
const FESTIVAL_WORDS = ['체육대회', '운동회', '축제', '페스티벌', '레크리에이션', '팀빌딩'] as const;

/** 홈 BEST 와 같은 순서 — 랭킹(rankOrder) 먼저, 안 매긴 사람은 리뷰 3개 이상 평점순 → 나머지 평점순 */
function bestOrder(rows: ProRow[]): ProRow[] {
  const rank = (p: ProRow) => (typeof p.rankOrder === 'number' ? p.rankOrder : null);
  const byRating = (a: ProRow, b: ProRow) =>
    (Number(b.avgRating) || 0) - (Number(a.avgRating) || 0) || (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
  const ranked = rows.filter((p) => rank(p) !== null).sort((a, b) => (rank(a) as number) - (rank(b) as number));
  const un = rows.filter((p) => rank(p) === null);
  return [
    ...ranked,
    ...un.filter((p) => (Number(p.reviewCount) || 0) >= 3).sort(byRating),
    ...un.filter((p) => (Number(p.reviewCount) || 0) < 3).sort(byRating),
  ];
}

/** 유형에 맞는 사람을 앞에 — 남는 자리는 같은 순서의 나머지로 채운다 */
function candidatesFor(kind: McInquiryKind, rows: ProRow[], excluded: Set<string> | null) {
  const seenUser = new Set<string>();
  const clean = rows.filter((p) => {
    if (!p?.id || !p.name) return false;
    if (excluded ? excluded.has(p.id) : (Number(p.reviewCount) || 0) === 0) return false;
    const u = p.userId || p.id; // 한 사람이 프로필 여럿이면 앞(서버 순서) 하나만 — 홈과 같음
    if (seenUser.has(u)) return false;
    seenUser.add(u);
    return true;
  });
  const ordered = bestOrder(clean);
  let first: ProRow[];
  if (kind === 'wedding') {
    first = ordered.filter((p) => lower(p.categories).length === 0 || lower(p.categories).some((v) => WEDDING_CAT.some((w) => v.includes(w))));
  } else if (kind === 'enterprise') {
    first = ordered.filter((p) => hasWord(p, EVENT_WORDS));
  } else {
    const fest = ordered.filter((p) => hasWord(p, FESTIVAL_WORDS));
    const ids = new Set(fest.map((p) => p.id));
    first = [...fest, ...ordered.filter((p) => !ids.has(p.id) && hasWord(p, EVENT_WORDS))];
  }
  const ids = new Set(first.map((p) => p.id));
  return { list: [...first, ...ordered.filter((p) => !ids.has(p.id))].slice(0, SHOW), total: clean.length };
}

type Pool = { rows: ProRow[] | null; excluded: string[] | null; ready: boolean; failed: boolean };
function usePool() {
  const [pool, setPool] = useState<Pool>(() => {
    const rows = cachedRows();
    return { rows, excluded: excludedMemo, ready: !!rows && !!excludedMemo, failed: false };
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (pool.ready) return undefined;
    let alive = true;
    const rows0 = pool.rows;
    Promise.all([rows0 ? Promise.resolve(rows0) : loadRows(), loadExcluded()])
      .then(([rows, excluded]) => {
        if (!alive) return;
        setPool({ rows, excluded, ready: true, failed: rows.length === 0 });
      })
      .catch(() => { if (alive) setPool((s) => ({ ...s, failed: true })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const retry = () => {
    setPool({ rows: null, excluded: excludedMemo, ready: false, failed: false });
    setTick((n) => n + 1);
  };
  return { pool, retry };
}

/** 유형을 고른 순간(상대 '입력 중' 동안) 앞 카드 사진을 미리 받아 둔다 — 줄이 나올 때 빈 칸이 덜 보이게 */
export function warmBizInquiryPros(kind: McInquiryKind) {
  if (typeof window === 'undefined') return;
  Promise.all([cachedRows() ? Promise.resolve(cachedRows() as ProRow[]) : loadRows(), loadExcluded()])
    .then(([rows, excluded]) => {
      candidatesFor(kind, rows, excluded ? new Set(excluded) : null).list.slice(0, 4).forEach((p) => {
        const src = p.images?.[0] || p.profileImageUrl;
        if (!src) return;
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      });
    })
    .catch(() => { /* noop */ });
}

/* ───────────── 문구(4개 언어) ───────────── */

const L = {
  group: { ko: '사회자 목록', en: 'MC list', ja: '司会者一覧', zh: '主持人列表' },
  profile: { ko: '프로필', en: 'Profile', ja: 'プロフィール', zh: '资料' },
  newPro: { ko: '새로 온 사회자', en: 'New MC', ja: '新しい司会者', zh: '新加入主持人' },
  more: { ko: '사회자 더 보기', en: 'See more MCs', ja: '司会者をもっと見る', zh: '查看更多主持人' },
  failed: { ko: '사회자 목록을 불러오지 못했어요', en: "Couldn't load the MC list", ja: '司会者一覧を読み込めませんでした', zh: '未能加载主持人列表' },
  retry: { ko: '다시 불러오기', en: 'Try again', ja: '再読み込み', zh: '重新加载' },
  prev: { ko: '이전 사회자', en: 'Previous', ja: '前へ', zh: '上一个' },
  next: { ko: '다음 사회자', en: 'Next', ja: '次へ', zh: '下一个' },
  partner: { ko: '프리티풀 파트너', en: 'Freetiful partner', ja: 'Freetiful パートナー', zh: 'Freetiful 合作伙伴' },
} satisfies Record<string, Translations>;
const careerOf = (n: number): Translations => ({ ko: `경력 ${n}년`, en: `${n} yrs`, ja: `経歴${n}年`, zh: `从业${n}年` });
const totalOf = (n: number): Translations => ({ ko: `전체 ${n}명`, en: `${n} MCs in all`, ja: `全${n}名`, zh: `共 ${n} 位` });
/**
 * 카드 단추 이름 — 이름 · 경력 · 평점(리뷰)으로 고정하고 고른 상태는 aria-pressed 에만 맡긴다
 * (예전엔 이름에 '고름 · 눌러서 빼기'를 넣고 aria-pressed 도 같이 써서 상태를 두 번 읽고, 누를 때마다 이름이 바뀌었다 — 261009 검증)
 */
function cardAria(p: ProListItem): Translations {
  const career = Number(p.careerYears) || 0;
  const reviews = Number(p.reviewCount) || 0;
  const r = (Number(p.avgRating) || 0).toFixed(1);
  const join = (sep: string, xs: Array<string | false>) => xs.filter(Boolean).join(sep);
  return {
    ko: join(', ', [p.name, career > 0 && `경력 ${career}년`, reviews > 0 ? `평점 ${r} 리뷰 ${reviews}개` : '새로 온 사회자']),
    en: join(', ', [p.name, career > 0 && `${career} yrs`, reviews > 0 ? `rated ${r} (${reviews} reviews)` : 'new MC']),
    ja: join('、', [p.name, career > 0 && `経歴${career}年`, reviews > 0 ? `評価${r}（レビュー${reviews}件）` : '新しい司会者']),
    zh: join('，', [p.name, career > 0 && `从业${career}年`, reviews > 0 ? `评分${r}（${reviews}条评价）` : '新加入主持人']),
  };
}
const profileAria = (name: string): Translations => ({ ko: `${name} 프로필 보기`, en: `View ${name}'s profile`, ja: `${name}のプロフィールを見る`, zh: `查看${name}的资料` });

/** 카드 태그 — 사회자가 고른 태그(한국어 데이터) 중 아는 것만 4개 언어로. 한국어는 칸이 좁아 짧게 */
const TAG_LABEL: Record<string, Translations> = {
  '결혼식': { ko: '결혼식', en: 'Wedding', ja: '結婚式', zh: '婚礼' },
  '돌잔치': { ko: '돌잔치', en: '1st birthday', ja: 'トルチャンチ', zh: '周岁宴' },
  '상견례': { ko: '상견례', en: 'Family meeting', ja: '顔合わせ', zh: '见家长' },
  '회갑/칠순': { ko: '회갑·칠순', en: 'Milestone birthday', ja: '還暦・古希', zh: '寿宴' },
  '기업행사': { ko: '기업행사', en: 'Corporate', ja: '企業イベント', zh: '企业活动' },
  '컨퍼런스/세미나': { ko: '컨퍼런스', en: 'Conference', ja: 'カンファレンス', zh: '会议' },
  '공식행사': { ko: '공식행사', en: 'Ceremony', ja: '公式行事', zh: '官方活动' },
  '송년회/시무식': { ko: '송년회', en: 'Year-end party', ja: '忘年会', zh: '年会' },
  '기업PT': { ko: '기업PT', en: 'Pitch', ja: '企業PT', zh: '企业路演' },
  '쇼호스트': { ko: '쇼호스트', en: 'Show host', ja: 'ショーホスト', zh: '购物主持' },
  '라이브커머스': { ko: '라이브커머스', en: 'Live commerce', ja: 'ライブコマース', zh: '直播带货' },
  '체육대회': { ko: '체육대회', en: 'Sports day', ja: '体育大会', zh: '运动会' },
  '축제/페스티벌': { ko: '축제', en: 'Festival', ja: 'フェス', zh: '节庆' },
  '레크리에이션': { ko: '레크리에이션', en: 'Recreation', ja: 'レク', zh: '娱乐活动' },
  '팀빌딩': { ko: '팀빌딩', en: 'Team building', ja: 'チームビルディング', zh: '团建' },
};
const TAG_PRIORITY: Record<McInquiryKind, string[]> = {
  enterprise: ['기업행사', '컨퍼런스/세미나', '공식행사', '송년회/시무식', '기업PT', '쇼호스트', '라이브커머스', '팀빌딩', '레크리에이션'],
  wedding: ['결혼식', '돌잔치', '상견례', '회갑/칠순', '공식행사'],
  festival: ['체육대회', '축제/페스티벌', '레크리에이션', '팀빌딩', '기업행사', '공식행사'],
};
function tagsFor(p: ProListItem, kind: McInquiryKind): Translations[] {
  const own = (Array.isArray(p.tags) ? p.tags : []).map(String);
  const picked = [
    ...TAG_PRIORITY[kind].filter((k) => own.includes(k)),
    ...own.filter((k) => TAG_LABEL[k] && !TAG_PRIORITY[kind].includes(k)),
  ];
  return picked.slice(0, 2).map((k) => TAG_LABEL[k]);
}

/* ───────────── 줄 위치 기억(상세 · 더 보기에 다녀오면 보던 자리) ───────────── */

const UI_KEY = 'biz-inquiry-pros-ui-v1';
function saveUi(kind: McInquiryKind, left: number) {
  try { sessionStorage.setItem(UI_KEY, JSON.stringify({ kind, left, at: Date.now() })); } catch { /* noop */ }
}
function takeUi(kind: McInquiryKind): number | null {
  try {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(UI_KEY);
    const s = JSON.parse(raw) as { kind?: string; left?: number; at?: number };
    if (s?.kind !== kind || !s.at || Date.now() - s.at > 30 * 60 * 1000) return null;
    return Number(s.left) || 0;
  } catch {
    return null;
  }
}

/* ───────────── 카드 ───────────── */

/** 사진 아래쪽을 카드 바탕색으로 녹여 이어지게 — ProToneCard 와 같은 마스크 */
const PHOTO_FADE = 'linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,.4) 82%, transparent 100%)';
const GLASS: CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.36)',
  WebkitBackdropFilter: 'blur(10px) saturate(140%)',
  backdropFilter: 'blur(10px) saturate(140%)',
  boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)',
};
const LONG_PRESS_MS = 520;
const reducedMotionNow = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

type CardText = { career: string; rating: string; newPro: string; profile: string; aria: string; profileAria: string; partner: string; tags: string[] };

const McCard = memo(function McCard({ p, index, on, animate, text, onToggle, onOpen, onOpenIntent }: {
  p: ProListItem;
  index: number;
  on: boolean;
  animate: boolean;
  text: CardText;
  onToggle: (p: ProListItem) => void;
  onOpen: (id: string) => void;
  onOpenIntent: (id: string) => void;
}) {
  const image = p.images?.[0] || p.profileImageUrl || '/images/default-profile.png';
  const tone = useImageTone(image);
  const sub = tone?.sub || '#6B7684';
  const acc = toneAccent(tone) || '#3182F6';
  const soft = '.45s cubic-bezier(.4,0,.2,1)';

  // 길게 누르기(터치만) = 상세로. 움직이면(옆으로 넘기기) 취소, 뒤따라오는 click 은 고르기로 새지 않게 먹는다
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const ate = useRef(false);
  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    ate.current = false;
    if (e.pointerType !== 'touch') return;
    clearPress();
    onOpenIntent(p.id);
    const timer = window.setTimeout(() => {
      press.current = null;
      ate.current = true;
      try { navigator.vibrate?.(8); } catch { /* noop */ }
      onOpen(p.id);
    }, LONG_PRESS_MS);
    press.current = { x: e.clientX, y: e.clientY, timer };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = press.current;
    if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) clearPress();
  };
  useEffect(() => clearPress, []);

  const career = Number(p.careerYears) || 0;
  const reviews = Number(p.reviewCount) || 0;
  // 사진 받는 동안은 옅은 반짝임(빈 회색 카드로 멈춰 보이지 않게) — 이미 받아 둔 사진이면 첫 그림부터 사진
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useLayoutEffect(() => { if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true); }, []);

  return (
    <div
      className={`bzp-card relative shrink-0 ${animate ? 'bzp-in' : ''}`}
      style={{ ['--i' as string]: Math.min(index, 7) } as CSSProperties}
    >
      <button
        type="button"
        aria-pressed={on}
        aria-label={text.aria}
        onClick={() => {
          if (ate.current) { ate.current = false; return; }
          onToggle(p);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
        onContextMenu={(e) => e.preventDefault()}
        className="bzp-hit flex h-full w-full flex-col overflow-hidden rounded-[18px] border text-left"
        style={{
          backgroundColor: tone?.bg || '#F2F4F6',
          borderColor: on ? acc : tone?.line || '#EAEDF0',
          boxShadow: on ? `0 0 0 1px ${acc}` : '0 0 0 0 transparent',
          transition: `background-color .5s ease, border-color ${soft}, box-shadow ${soft}, transform .2s cubic-bezier(.4,0,.2,1)`,
        }}
      >
        <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
          {!loaded && <span aria-hidden="true" className="bzp-ph absolute inset-0" style={{ WebkitMaskImage: PHOTO_FADE, maskImage: PHOTO_FADE }} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={image}
            alt=""
            // 12장뿐이고 넘기자마자 보여야 해 전부 바로 받는다(lazy 면 끝 쪽 카드가 넘긴 뒤에야 받기 시작해 빈 카드로 보였다)
            loading="eager"
            decoding="async"
            draggable={false}
            className={`bzp-img relative h-full w-full object-cover ${loaded ? 'is-loaded' : ''}`}
            style={{ objectPosition: 'center 20%', WebkitMaskImage: PHOTO_FADE, maskImage: PHOTO_FADE }}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fb) return;
              el.dataset.fb = '1';
              el.src = '/images/default-profile.png';
            }}
          />
          {career > 0 && (
            <span className="absolute left-2 top-2 inline-flex h-[22px] items-center rounded-[7px] px-1.5 text-[11.5px] font-bold tracking-[-0.2px] text-white" style={GLASS}>
              {text.career}
            </span>
          )}
          {/* 고른 표시 — 퀵매칭 체크 원과 같은 결(빈 원 = 흰 테두리 유리, 고름 = 사진 톤 색 + 그려지는 체크) */}
          <span
            aria-hidden="true"
            className={`bzp-check absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full ${on ? 'on' : ''}`}
            style={{ ['--acc' as string]: acc } as CSSProperties}
          >
            {on && (
              <svg viewBox="0 0 26 26" width="16" height="16" fill="none">
                <path d="M5.5 13.5 L10.8 18.6 L20.5 8" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
              </svg>
            )}
          </span>
        </span>
        <span className="relative -mt-2 block px-3 pb-3">
          <span className="flex items-center gap-1 text-[15px] font-bold leading-[1.4] tracking-[-0.3px] text-[#191F28]">
            <span className="min-w-0 truncate">{p.name}</span>
            {(p.showPartnersLogo || p.isFeatured) && (
              <svg width="13" height="13" viewBox="0 0 24 24" className="shrink-0" role="img" aria-label={text.partner}>
                <path d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" fill="#3182F6" />
                <path d="M8.2 12.2l2.5 2.5 5-5.2" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-[3px] text-[12.5px] leading-[1.5] tracking-[-0.2px]" style={{ color: sub }}>
            {reviews > 0 ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" />
                </svg>
                <span className="truncate tabular-nums">{text.rating}</span>
              </>
            ) : (
              <span className="truncate">{text.newPro}</span>
            )}
          </span>
          {/* 태그 칸은 늘 같은 높이(태그 없는 사람도 카드 키가 같게), 한 줄에 안 들어가는 둘째 태그는 숨는다 */}
          <span className="mt-2 flex h-[22px] flex-wrap gap-1 overflow-hidden">
            {text.tags.map((tag) => (
              <span key={tag} className="flex h-[22px] items-center whitespace-nowrap rounded-[7px] bg-white/60 px-[6px] text-[11.5px] font-semibold tracking-[-0.2px] text-[#333D4B]">
                {tag}
              </span>
            ))}
          </span>
        </span>
      </button>
      {/* 프로필 → 사회자 상세(같은 탭 — 돌아오면 상담 그대로). 카드 단추와 겹치지 않는 형제 단추 */}
      <button
        type="button"
        aria-label={text.profileAria}
        onPointerDown={() => onOpenIntent(p.id)}
        onClick={() => onOpen(p.id)}
        className="bzp-prof absolute left-2 inline-flex h-[26px] items-center gap-[1px] rounded-[13px] pl-2.5 pr-1.5 text-[12px] font-semibold tracking-[-0.2px] text-white"
        style={GLASS}
      >
        {text.profile}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
          <path d="M9.5 6 15.5 12 9.5 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
});

/* ───────────── 줄 ───────────── */

export default function BizInquiryPros({ kind, picked, onToggle, animate }: {
  kind: McInquiryKind;
  picked: PickedPro[];
  onToggle: (p: PickedPro) => void;
  /** 처음 나올 때 카드가 차례로 흘러 들어오게 — 마운트 때 값만 쓴다(되살린 화면 · 다시 그림엔 안 튼다) */
  animate: boolean;
}) {
  const t = useT();
  const { lang } = useBizLang();
  const router = useRouter();
  const { pool, retry } = usePool();
  const [playIn] = useState(() => animate);
  const groupRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const { list: base, total } = useMemo(
    () => (pool.ready && pool.rows ? candidatesFor(kind, pool.rows, pool.excluded ? new Set(pool.excluded) : null) : { list: [] as ProRow[], total: 0 }),
    [kind, pool],
  );
  /*
   * 이미 고른 사람이 이 줄에 없으면(고르다가 유형을 결혼식 → 기업행사로 바꿈 · 다시 고르기 · 목록에서 빠짐) 줄 맨 앞에 같이 보인다 —
   * 예전엔 '선택 완료(1명)'인데 체크된 카드가 0장이라 뺄 수도 없이 보이지 않는 사람이 희망 사회자로 접수됐다(261009 검증).
   * 줄이 열린 동안은 그대로 둔다(빼자마자 카드가 사라져 줄이 덜컥 당겨지지 않게). 유형이 바뀌면 줄이 닫혔다 다시 열려 새로 정한다
   */
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const stickyRef = useRef<{ base: ProRow[]; extra: ProRow[] } | null>(null);
  const list = useMemo(() => {
    if (!base.length) return base;
    if (stickyRef.current?.base !== base) {
      const inBase = new Set(base.map((p) => p.id));
      const byId = new Map((pool.rows || []).map((p) => [p.id, p] as const));
      const keep = stickyRef.current?.extra.filter((p) => !inBase.has(p.id)) || [];
      const keepIds = new Set(keep.map((p) => p.id));
      const extra = [
        ...keep,
        ...pickedRef.current
          .filter((x) => !inBase.has(x.id) && !keepIds.has(x.id))
          // 목록에 아예 없는 사람(그새 내려간 프로필)도 이름 카드로는 보여 빼게 한다
          .map((x) => byId.get(x.id) || ({ id: x.id, userId: x.id, name: x.name, images: [], reviewCount: 0, careerYears: 0 } as unknown as ProRow)),
      ];
      stickyRef.current = { base, extra };
    }
    const extra = stickyRef.current.extra;
    return extra.length ? [...extra, ...base] : base;
  }, [base, pool.rows]);
  const pickedIds = useMemo(() => new Set(picked.map((x) => x.id)), [picked]);
  // 카드 글자 — 목록 · 유형 · 언어가 같으면 같은 객체(memo 카드가 부모의 '입력 중' 점 · 칩 · 저장마다 12장 모두 다시 그려지지 않게)
  const texts = useMemo(() => {
    const tr = (x: Translations) => getT(x, lang);
    return new Map(list.map((p) => [p.id, {
      career: tr(careerOf(Number(p.careerYears) || 0)),
      rating: `${(Number(p.avgRating) || 0).toFixed(1)} (${Number(p.reviewCount) || 0})`,
      newPro: tr(L.newPro),
      profile: tr(L.profile),
      aria: tr(cardAria(p)),
      profileAria: tr(profileAria(p.name)),
      partner: tr(L.partner),
      tags: tagsFor(p, kind).map(tr),
    } satisfies CardText] as const));
  }, [list, kind, lang]);

  // 최신 콜백은 ref 로 — memo 카드에 늘 같은 함수를 준다
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const handlers = useMemo(() => ({
    toggle: (p: ProListItem) => toggleRef.current({ id: p.id, name: p.name }),
    open: (id: string) => {
      saveUi(kindRef.current, rowRef.current?.scrollLeft || 0);
      router.push(`/pros/${id}`);
    },
    intent: (id: string) => { discoveryApi.getProDetail(id).catch(() => { /* noop */ }); },
  }), [router]);
  const openMore = () => {
    saveUi(kind, rowRef.current?.scrollLeft || 0);
    // /pros 의 결혼식 · 행사 사회자 보기 — 값은 /pros PC_KIND 와 같은 '결혼식사회자' · '전문행사사회자'
    // ('행사사회자'는 /pros 의 사회자 보기 목록에 없어 '전체 사회자'가 열렸다, 261009 검증)
    router.push(`/pros?category=${encodeURIComponent(kind === 'wedding' ? '결혼식사회자' : '전문행사사회자')}`);
  };

  const updateEdge = () => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  };

  // 상세 · 더 보기에서 돌아왔으면 보던 자리로(목록이 그려진 첫 순간에 한 번)
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !list.length) return;
    restored.current = true;
    const left = takeUi(kind);
    const el = rowRef.current;
    if (el && left) el.scrollLeft = left;
    updateEdge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);
  useEffect(() => {
    window.addEventListener('resize', updateEdge);
    return () => window.removeEventListener('resize', updateEdge);
  }, []);
  // 질문이 막 나온 줄 — 고른 유형 단추가 사라지며 초점이 body 로 떨어져 있으면 줄(그룹)로 옮긴다(키보드 · 화면 읽기가 이어서 고르게, 261009 검증)
  useEffect(() => {
    if (!playIn) return;
    const a = document.activeElement;
    if (!a || a === document.body) groupRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** PC 화살표 — 카드 두 장씩 */
  const nudge = (dir: 1 | -1) => {
    const el = rowRef.current;
    const card = el?.querySelector<HTMLElement>('.bzp-card');
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 10) * 2, behavior: 'smooth' });
  };

  /**
   * Tab 으로 온 카드가 줄 끝에 잘리거나 '다음' 화살표에 가리면 보이는 자리로 — 스냅(카드 시작) 자리 중 가장 가까운 곳.
   * 브라우저 기본 초점 스크롤은 조금만 움직였다가 mandatory 스냅이 제자리(0)로 되돌려 카드가 42px 잘린 채 화살표 밑에 있었다(261009 검증)
   */
  const onRowFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    const target = e.target as HTMLElement;
    if (!row || !target.matches(':focus-visible')) return;
    const card = target.closest<HTMLElement>('.bzp-card');
    if (!card) return;
    const cards = Array.from(row.querySelectorAll<HTMLElement>('.bzp-card'));
    const j = cards.indexOf(card);
    if (j < 0) return;
    const inset = parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0;
    const rightPad = 52; // 화살표(36) + 여백
    const pos = (k: number) => cards[k].offsetLeft - cards[0].offsetLeft; // 줄 안쪽 기준 카드 시작
    const snap = (k: number) => Math.max(0, pos(k) - pos(0)); // k 번째 카드를 맨 앞에 맞춘 스크롤 값
    const left = row.scrollLeft;
    const cardL = pos(j) + inset - pos(0);
    const cardR = cardL + card.offsetWidth;
    let to: number | null = null;
    if (cardL - left < inset - 1) to = snap(j);
    else if (cardR - left > row.clientWidth - rightPad + 1) {
      // 이 카드가 오른쪽 안쪽에 들어오는 가장 앞쪽 스냅 자리
      for (let k = 0; k <= j; k++) {
        if (snap(k) >= left && cardR - snap(k) <= row.clientWidth - rightPad) { to = snap(k); break; }
      }
      if (to === null) to = snap(j);
    }
    if (to !== null && Math.abs(to - left) > 1) row.scrollTo({ left: to, behavior: reducedMotionNow() ? 'auto' : 'smooth' });
  };

  const loading = !pool.ready && !pool.failed;
  const failed = pool.failed || (pool.ready && !list.length);

  return (
    <div ref={groupRef} tabIndex={-1} className="bzp relative -mx-3 mt-2 outline-none" role="group" aria-label={t(L.group)}>
      {failed ? (
        <div className="flex items-center gap-2 py-2 pl-[60px] pr-6 text-[13.5px] text-[#8B95A1]">
          <span>{t(L.failed)}</span>
          <button type="button" onClick={retry} className="shrink-0 rounded-full bg-[#F2F4F6] px-3 py-1.5 text-[13px] font-semibold text-[#4E5968] active:bg-[#E5E8EB]">
            {t(L.retry)}
          </button>
        </div>
      ) : (
        <div
          ref={rowRef}
          onScroll={updateEdge}
          onFocus={onRowFocus}
          className="bzp-row flex gap-2.5 overflow-x-auto overflow-y-hidden pb-1.5 pt-1"
          aria-busy={loading || undefined}
        >
          {loading
            ? [0, 1, 2].map((i) => <div key={i} className="bzp-card bzp-skel shrink-0 rounded-[18px]" aria-hidden="true" />)
            : list.map((p, i) => (
              <McCard
                key={p.id}
                p={p}
                index={i}
                on={pickedIds.has(p.id)}
                animate={playIn}
                onToggle={handlers.toggle}
                onOpen={handlers.open}
                onOpenIntent={handlers.intent}
                text={texts.get(p.id) as CardText}
              />
            ))}
          {!loading && (
            <div className={`bzp-card relative shrink-0 ${playIn ? 'bzp-in' : ''}`} style={{ ['--i' as string]: Math.min(list.length, 7) } as CSSProperties}>
              <button
                type="button"
                onClick={openMore}
                className="bzp-hit flex h-full w-full flex-col items-center justify-center gap-3 rounded-[18px] border border-[#EAEDF0] bg-[#F7F8FA] px-3 text-center"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3182F6] shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                  <ChevronRightIcon size={20} />
                </span>
                <span className="flex flex-col items-center gap-1">
                  <span className="text-[15px] font-bold leading-[1.35] tracking-[-0.3px] text-[#191F28]">{t(L.more)}</span>
                  {total > 0 && <span className="text-[12.5px] text-[#8B95A1]">{t(totalOf(total))}</span>}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 좌우 끝 — 카드가 흰 바탕으로 살짝 사라지게 */}
      {!failed && (
        <>
          <div aria-hidden="true" className="bzp-fade-l pointer-events-none absolute bottom-0 left-0 top-0 w-4" />
          <div aria-hidden="true" className="bzp-fade-r pointer-events-none absolute bottom-0 right-0 top-0 w-5" />
        </>
      )}

      {/* PC(마우스) — 좌우 화살표 */}
      {!failed && !loading && (
        <>
          {!edge.start && (
            <button type="button" aria-label={t(L.prev)} onClick={() => nudge(-1)} className="bzp-nav left-2">
              <ChevronLeftIcon size={18} />
            </button>
          )}
          {!edge.end && (
            <button type="button" aria-label={t(L.next)} onClick={() => nudge(1)} className="bzp-nav right-2">
              <ChevronRightIcon size={18} />
            </button>
          )}
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* 카드 폭 — 폰은 두 장 + 셋째가 30px 쯤(넘길 게 있다는 표시 — 360 에서 134 고정이면 셋째가 12px 라 끝 그라데이션에 묻혔다),
           PC 채팅 칸(680)은 세 장 반쯤 */
        .bzp { --bzp-w: clamp(120px, calc((100vw - 84px) / 2.2), 164px); --bzp-inset: 60px; }
        .bzp-row {
          padding-left: var(--bzp-inset); padding-right: 28px;
          scroll-padding-left: var(--bzp-inset);
          scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
        }
        .bzp-row::-webkit-scrollbar { display: none; }
        .bzp-card { width: var(--bzp-w); scroll-snap-align: start; }
        .bzp-skel {
          height: calc(var(--bzp-w) * 1.25 + 70px);
          background: linear-gradient(100deg, #F2F4F6 30%, #F9FAFB 50%, #F2F4F6 70%) 0 0 / 300% 100%;
          animation: bzpShimmer 1.3s linear infinite;
        }
        .bzp-hit { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; cursor: pointer; }
        .bzp-hit:active { transform: scale(0.97); }
        .bzp-img { opacity: 0; transition: transform .5s ease-out, opacity .35s ease; -webkit-touch-callout: none; }
        .bzp-img.is-loaded { opacity: 1; }
        .bzp-ph {
          background: linear-gradient(100deg, rgba(0,0,0,.035) 30%, rgba(255,255,255,.5) 50%, rgba(0,0,0,.035) 70%) 0 0 / 300% 100%;
          animation: bzpShimmer 1.3s linear infinite;
        }
        @media (hover: hover) { .bzp-hit:hover .bzp-img { transform: scale(1.04); } }
        .bzp-check {
          background: rgba(0,0,0,.26);
          -webkit-backdrop-filter: blur(10px) saturate(140%); backdrop-filter: blur(10px) saturate(140%);
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.85);
          transition: background-color .38s cubic-bezier(.4,0,.2,1), box-shadow .38s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.34,1.56,.64,1);
        }
        .bzp-check.on { background: var(--acc, #3182F6); box-shadow: none; transform: scale(1.06); }
        .bzp-check path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: bzpDraw .34s .02s cubic-bezier(.65,0,.35,1) forwards; }
        /* 프로필 단추 — 사진 아래쪽(카드 색으로 녹기 시작하는 자리), 퀵매칭 '포트폴리오'와 같은 유리 알약 */
        .bzp-prof { top: calc(var(--bzp-w) * 1.25 - 42px); z-index: 2; -webkit-tap-highlight-color: transparent; }
        .bzp-prof:active { background-color: rgba(0,0,0,.5) !important; }
        .bzp-fade-l { background: linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%); }
        .bzp-fade-r { background: linear-gradient(to left, #fff 0%, rgba(255,255,255,0) 100%); }
        .bzp-nav {
          position: absolute; top: calc(var(--bzp-w) * 0.625 - 14px); z-index: 3;
          display: none; width: 36px; height: 36px; align-items: center; justify-content: center;
          border-radius: 50%; background: #fff; color: #333D4B; border: 0; cursor: pointer;
          box-shadow: 0 2px 10px rgba(15,23,42,.12), inset 0 0 0 1px rgba(15,23,42,.04);
          transition: transform .15s ease, background-color .15s ease;
        }
        .bzp-nav:hover { background: #F9FAFB; }
        .bzp-nav:active { transform: scale(.94); }
        @media (hover: hover) and (pointer: fine) { .bzp-nav { display: flex; } }
        /* 주르륵 — 오른쪽에서 한 장씩 조금씩 늦게 흘러 들어와 제자리 */
        @keyframes bzpIn {
          0% { opacity: 0; transform: translateX(96px) scale(.94); }
          45% { opacity: 1; }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .bzp-in { animation: bzpIn .72s cubic-bezier(.22,.61,.36,1) both; animation-delay: calc(var(--i, 0) * 85ms + 60ms); }
        @keyframes bzpDraw { to { stroke-dashoffset: 0; } }
        @keyframes bzpShimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
        @media (prefers-reduced-motion: reduce) {
          .bzp *, .bzp *::before, .bzp *::after { animation: none !important; transition: none !important; }
          .bzp-check path { stroke-dashoffset: 0; }
        }
      ` }} />
    </div>
  );
}
