'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronLeft, Star, RefreshCw, Phone, MessageSquare,
  MessageCircle, Play, CalendarDays, MapPin, Sparkles,
} from 'lucide-react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { captureUtm } from '@/lib/landing-track';

/* ─────────────────────────────────────────────────────────────
 * 퀵매칭 랜딩 — 조건 입력 → 사회자 5명 추천 → 선택 의뢰 → 연락방식
 * 비로그인에서도 matchApi.quickRequest(type:'single', selectedProProfileIds)
 * 로 선택한 사회자들에게 바로 매칭요청이 전달된다.
 * ──────────────────────────────────────────────────────────── */

type Step = 'start' | 'details' | 'searching' | 'results' | 'contact' | 'done';

/** 예식장 권역 → (사회자 지역명 매칭, 세부지역) */
const REGION_GROUPS: { key: string; label: string; match: string[]; subs: string[] }[] = [
  { key: 'seoul', label: '서울권', match: ['수도권(서울/인천/경기)'], subs: ['강남·서초', '송파·강동', '마포·서대문', '용산·중구', '성동·광진', '영등포·구로', '노원·강북', '기타 서울'] },
  { key: 'gyeonggi', label: '경기권', match: ['수도권(서울/인천/경기)'], subs: ['수원', '성남·분당', '고양·일산', '용인', '안양·평촌', '부천', '화성·동탄', '기타 경기'] },
  { key: 'incheon', label: '인천권', match: ['수도권(서울/인천/경기)'], subs: ['송도', '부평', '계양', '기타 인천'] },
  { key: 'gangwon', label: '강원권', match: ['강원도'], subs: ['춘천', '원주', '강릉', '기타 강원'] },
  { key: 'chungcheong', label: '충청권', match: ['충청권'], subs: ['대전', '청주', '천안', '세종', '기타 충청'] },
  { key: 'jeolla', label: '전라권', match: ['전라권'], subs: ['광주', '전주', '여수', '기타 전라'] },
  { key: 'gyeongsang', label: '경상권', match: ['경상권'], subs: ['부산', '대구', '울산', '창원', '기타 경상'] },
  { key: 'jeju', label: '제주', match: ['제주'], subs: ['제주시', '서귀포'] },
];

const CEREMONY_TYPES = ['일반 예식장(웨딩홀)', '호텔 예식', '하우스·스몰웨딩', '종교시설(성당·교회)', '야외·기타'];

const GENDERS: { k: 'any' | 'male' | 'female'; label: string }[] = [
  { k: 'any', label: '무관' },
  { k: 'male', label: '남자 사회자' },
  { k: 'female', label: '여자 사회자' },
];

const CONTACT_METHODS: { k: string; label: string; icon: typeof Phone; hint: string }[] = [
  { k: '전화', label: '전화', icon: Phone, hint: '사회자가 직접 전화드려요' },
  { k: '문자', label: '문자', icon: MessageSquare, hint: '문자로 상담받아요' },
  { k: '프리티풀 채팅', label: '프리티풀 채팅', icon: MessageCircle, hint: '앱에서 편하게 채팅해요' },
];

const PRIMARY = '#3182F6';

/* ── helpers ─────────────────────────────────────────────── */
function extractYoutubeId(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // youtubeUrl 은 개행으로 여러 URL 이 조인돼 올 수 있음 — 첫 유튜브만 사용
  const first = url.split(/\s+/).map((s) => s.trim()).find(Boolean) || url;
  try {
    const parsed = new URL(first);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0];
    if (host.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1];
    }
  } catch {}
  return first.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/)?.[1];
}

function normalizePhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matchesGender(p: ProListItem, g: 'any' | 'male' | 'female') {
  if (g === 'any') return true;
  const val = (p.gender || '').toLowerCase();
  if (g === 'male') return val === 'male' || (p.gender || '').includes('남');
  return val === 'female' || (p.gender || '').includes('여');
}

function matchesRegion(p: ProListItem, group?: { match: string[] }) {
  if (!group) return true;
  if (p.isNationwide) return true;
  const regions = p.regions || [];
  if (regions.includes('전국가능')) return true;
  return regions.some((r) => group.match.includes(r));
}

/* ── 사회자 추천 카드 ─────────────────────────────────────── */
function ProCard({
  pro, selected, onToggle,
}: { pro: ProListItem; selected: boolean; onToggle: () => void }) {
  const [playing, setPlaying] = useState(false);
  const ytId = extractYoutubeId(pro.youtubeUrl);
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : pro.profileImageUrl;

  return (
    <div
      className={`overflow-hidden rounded-[20px] border bg-white transition-shadow ${selected ? 'border-[#3182F6] shadow-[0_0_0_1.5px_#3182F6]' : 'border-[#EAECEF]'}`}
    >
      {/* 영상 */}
      <div className="relative aspect-video w-full bg-black">
        {playing && ytId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
            title={`${pro.name} 소개영상`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => ytId && setPlaying(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label={ytId ? `${pro.name} 소개영상 재생` : `${pro.name}`}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={pro.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#0F1115] text-white/40 text-sm">소개영상 준비중</div>
            )}
            {ytId && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover:scale-105">
                  <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
                </span>
              </span>
            )}
          </button>
        )}
      </div>

      {/* 정보 + 선택 */}
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#F2F5F9]">
          {pro.profileImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pro.profileImageUrl} alt={pro.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-bold text-[#1A1A1A]">사회자 {pro.name}</span>
            {pro.avgRating > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#1A1A1A]">
                <Star className="h-3.5 w-3.5 fill-[#FFC64B] text-[#FFC64B]" />{pro.avgRating.toFixed(2)}
                <span className="text-[#8B95A1]">({pro.reviewCount})</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[#6B7684]">
            {[pro.careerYears ? `경력 ${pro.careerYears}년` : '', pro.shortIntro || pro.mainExperience || ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${selected ? 'border-[#3182F6] bg-[#3182F6]' : 'border-[#D1D6DB] bg-white'}`}
        >
          {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </span>
      </button>
    </div>
  );
}

/* ── 상단 진행바 ─────────────────────────────────────────── */
function TopBar({ pct, onBack }: { pct: number; onBack?: () => void }) {
  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[#4E5968] active:bg-[#F2F5F9]" aria-label="뒤로">
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 pl-0.5">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#1A1A1A]">퀵매칭</span>
            <Sparkles className="h-4 w-4 text-[#3182F6]" />
          </div>
        )}
        <div className="ml-auto text-[12px] font-semibold text-[#8B95A1]">{Math.round(pct)}%</div>
      </div>
      <div className="h-1 w-full bg-[#F2F4F6]">
        <div className="h-full rounded-r-full bg-[#3182F6] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── 하단 고정 버튼 ─────────────────────────────────────── */
function BottomCta({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-[#F2F4F6] bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="h-[54px] w-full rounded-2xl bg-[#3182F6] text-[16px] font-bold text-white transition active:scale-[0.99] disabled:bg-[#DDE2E6] disabled:text-[#B0B8C1]"
      >
        {children}
      </button>
    </div>
  );
}

const chip = (active: boolean) =>
  `rounded-2xl border px-4 py-3.5 text-[15px] font-semibold transition ${active ? 'border-[#3182F6] bg-[#EEF5FF] text-[#3182F6]' : 'border-[#E5E8EB] bg-white text-[#4E5968] active:bg-[#F8F9FA]'}`;

export default function QuickMatchPage() {
  const [step, setStep] = useState<Step>('start');
  const [date, setDate] = useState('');
  const [regionKey, setRegionKey] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [ceremony, setCeremony] = useState('');
  const [gender, setGender] = useState<'any' | 'male' | 'female'>('any');

  const [pool, setPool] = useState<ProListItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [rerolled, setRerolled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState(false);

  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [searchPct, setSearchPct] = useState(0);

  const group = useMemo(() => REGION_GROUPS.find((g) => g.key === regionKey), [regionKey]);

  useEffect(() => { captureUtm(); }, []);

  /* 조건에 맞는 사회자 풀 구성 */
  async function loadPros() {
    setLoadErr(false);
    try {
      const res: any = await discoveryApi.getProList({ limit: 80, sort: 'reviews', withTotal: false });
      const rows: ProListItem[] = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      const byGender = rows.filter((p) => matchesGender(p, gender));
      const withVid = byGender.filter((p) => extractYoutubeId(p.youtubeUrl));
      // 영상 있는 사회자가 충분하면 그들 위주로, 아니면 성별만 맞으면 포함
      const base = withVid.length >= 5 ? withVid : (byGender.length >= 5 ? byGender : rows);
      const inRegion = base.filter((p) => matchesRegion(p, group));
      const rest = base.filter((p) => !matchesRegion(p, group));
      const ordered = [...shuffle(inRegion), ...shuffle(rest)];
      setPool(ordered);
    } catch {
      setLoadErr(true);
      setPool([]);
    }
  }

  /* searching 단계: 게이지 + 풀 로드 후 결과로 */
  useEffect(() => {
    if (step !== 'searching') return;
    setSearchPct(0);
    setOffset(0);
    setRerolled(false);
    setSelected(new Set());
    loadPros();
    const started = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / 2400);
      // 살짝 감속하는 곡선
      setSearchPct(Math.round((1 - Math.pow(1 - t, 2)) * 100));
      if (t >= 1) {
        clearInterval(timer);
        setStep('results');
      }
    }, 40);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const displayed = useMemo(() => {
    if (pool.length === 0) return [];
    if (pool.length <= 5) return pool;
    const start = offset % pool.length;
    const out = pool.slice(start, start + 5);
    if (out.length < 5) out.push(...pool.slice(0, 5 - out.length));
    return out;
  }, [pool, offset]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function reroll() {
    if (rerolled) return;
    setRerolled(true);
    setOffset((o) => o + 5);
    setSelected(new Set());
  }

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || selected.size === 0 || !contact) return;
    setSubmitting(true);
    const utm = {
      utm_source: sessionStorage.getItem('utm_source') || '',
      utm_medium: sessionStorage.getItem('utm_medium') || '',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '',
      referrer: sessionStorage.getItem('referrer') || '',
      landing_url: typeof window !== 'undefined' ? window.location.href : '',
    };
    try {
      await matchApi.quickRequest({
        phone: digits,
        categoryId: '결혼식사회자',
        type: 'single',
        selectedProProfileIds: [...selected],
        eventDate: date || undefined,
        eventLocation: [group?.label, subRegion].filter(Boolean).join(' ') || undefined,
        rawUserInput: {
          source: 'landing_quick_match',
          eventDate: date,
          region: group?.label,
          subRegion,
          ceremony,
          genderPref: gender,
          contactMethod: contact,
          phone: digits,
          selectedCount: selected.size,
          ...utm,
        },
      });
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', { content_category: 'quick-match', currency: 'KRW' });
      }
      setStep('done');
    } catch (e: any) {
      window.alert(`신청에 실패했어요. 잠시 후 다시 시도해 주세요. ${e?.response?.data?.message || ''}`);
    }
    setSubmitting(false);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col bg-white">
      {/* ── STEP: 시작(예식일 + 권역) ── */}
      {step === 'start' && (
        <>
          <TopBar pct={12} />
          <main className="flex-1 px-5 pb-6 pt-5">
            <h1 className="text-[24px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#1A1A1A]">
              내 예식에 딱 맞는<br />사회자를 3분 만에 찾아요
            </h1>
            <p className="mt-2 text-[14px] text-[#8B95A1]">예식일과 지역만 알려주세요.</p>

            <section className="mt-7">
              <label className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <CalendarDays className="h-4 w-4 text-[#3182F6]" /> 예식일
              </label>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                className="h-[54px] w-full rounded-2xl border border-[#E5E8EB] bg-white px-4 text-[16px] font-medium text-[#1A1A1A] outline-none focus:border-[#3182F6]"
              />
            </section>

            <section className="mt-7">
              <label className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold text-[#1A1A1A]">
                <MapPin className="h-4 w-4 text-[#3182F6]" /> 예식장 지역
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {REGION_GROUPS.map((g) => (
                  <button key={g.key} type="button" onClick={() => { setRegionKey(g.key); setSubRegion(''); }} className={chip(regionKey === g.key)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </section>
          </main>
          <BottomCta disabled={!date || !regionKey} onClick={() => setStep('details')}>다음</BottomCta>
        </>
      )}

      {/* ── STEP: 세부조건(세부지역 + 예식구분 + 성별) ── */}
      {step === 'details' && (
        <>
          <TopBar pct={40} onBack={() => setStep('start')} />
          <main className="flex-1 px-5 pb-6 pt-5">
            <h1 className="text-[22px] font-extrabold leading-[1.34] tracking-[-0.02em] text-[#1A1A1A]">
              조금만 더 알려주세요
            </h1>

            <section className="mt-6">
              <p className="mb-2.5 text-[15px] font-bold text-[#1A1A1A]">세부 지역 <span className="text-[#B0B8C1]">({group?.label})</span></p>
              <div className="grid grid-cols-2 gap-2.5">
                {(group?.subs || []).map((s) => (
                  <button key={s} type="button" onClick={() => setSubRegion(s)} className={chip(subRegion === s)}>{s}</button>
                ))}
              </div>
            </section>

            <section className="mt-7">
              <p className="mb-2.5 text-[15px] font-bold text-[#1A1A1A]">예식 구분</p>
              <div className="flex flex-wrap gap-2.5">
                {CEREMONY_TYPES.map((c) => (
                  <button key={c} type="button" onClick={() => setCeremony(c)} className={chip(ceremony === c)}>{c}</button>
                ))}
              </div>
            </section>

            <section className="mt-7">
              <p className="mb-2.5 text-[15px] font-bold text-[#1A1A1A]">선호하는 사회자 성별</p>
              <div className="grid grid-cols-3 gap-2.5">
                {GENDERS.map((g) => (
                  <button key={g.k} type="button" onClick={() => setGender(g.k)} className={chip(gender === g.k)}>{g.label}</button>
                ))}
              </div>
            </section>
          </main>
          <BottomCta disabled={!subRegion || !ceremony} onClick={() => setStep('searching')}>사회자 찾기</BottomCta>
        </>
      )}

      {/* ── STEP: 탐색중(게이지) ── */}
      {step === 'searching' && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="relative mb-8 h-20 w-20">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#3182F6]/15" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#EEF5FF]">
              <Sparkles className="h-9 w-9 text-[#3182F6]" />
            </div>
          </div>
          <h2 className="text-[20px] font-extrabold leading-[1.4] tracking-[-0.02em] text-[#1A1A1A]">
            고객님의 예식에 알맞는<br />사회자를 찾고 있어요
          </h2>
          <div className="mt-7 h-2.5 w-full max-w-[280px] overflow-hidden rounded-full bg-[#F2F4F6]">
            <div className="h-full rounded-full bg-[#3182F6] transition-[width] duration-100 ease-out" style={{ width: `${searchPct}%` }} />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#8B95A1]">{searchPct}%</p>
        </div>
      )}

      {/* ── STEP: 결과(5명 + 리롤 + 선택) ── */}
      {step === 'results' && (
        <>
          <TopBar pct={72} onBack={() => setStep('details')} />
          <main className="flex-1 px-4 pb-6 pt-4">
            <div className="px-1">
              <h1 className="text-[21px] font-extrabold leading-[1.36] tracking-[-0.02em] text-[#1A1A1A]">
                고객님의 조건에 가장 잘 맞는<br />사회자 <span className="text-[#3182F6]">{Math.min(5, displayed.length) || 5}명</span>을 찾았습니다
              </h1>
              <p className="mt-1.5 text-[13px] text-[#8B95A1]">영상을 확인하고, 의뢰할 사회자를 선택하세요. (중복 선택 가능)</p>
            </div>

            <div className="mt-4 flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-[#4E5968]">{selected.size}명 선택됨</span>
              <button
                type="button"
                onClick={reroll}
                disabled={rerolled || pool.length <= 5}
                className="flex items-center gap-1.5 rounded-full border border-[#E5E8EB] px-3.5 py-2 text-[13px] font-semibold text-[#4E5968] transition active:bg-[#F2F5F9] disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {rerolled ? '다시 찾기 완료' : '다른 사회자 보기'}
              </button>
            </div>

            {loadErr ? (
              <div className="mt-10 text-center text-[14px] text-[#8B95A1]">
                사회자를 불러오지 못했어요.<br />
                <button type="button" onClick={() => setStep('searching')} className="mt-3 rounded-xl bg-[#F2F5F9] px-4 py-2 font-semibold text-[#4E5968]">다시 시도</button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {displayed.map((pro) => (
                  <ProCard key={pro.id} pro={pro} selected={selected.has(pro.id)} onToggle={() => toggle(pro.id)} />
                ))}
              </div>
            )}
          </main>
          <BottomCta disabled={selected.size === 0} onClick={() => setStep('contact')}>
            {selected.size > 0 ? `${selected.size}명에게 의뢰하기` : '사회자를 선택하세요'}
          </BottomCta>
        </>
      )}

      {/* ── STEP: 연락방식 ── */}
      {step === 'contact' && (
        <>
          <TopBar pct={90} onBack={() => setStep('results')} />
          <main className="flex-1 px-5 pb-6 pt-5">
            <h1 className="text-[22px] font-extrabold leading-[1.34] tracking-[-0.02em] text-[#1A1A1A]">
              사회자에게 어떤 방식으로<br />연락받으시겠어요?
            </h1>
            <p className="mt-2 text-[14px] text-[#8B95A1]">선택한 {selected.size}명의 사회자가 이 방법으로 연락드려요.</p>

            <section className="mt-6 space-y-2.5">
              {CONTACT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = contact === m.k;
                return (
                  <button
                    key={m.k}
                    type="button"
                    onClick={() => setContact(m.k)}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left transition ${active ? 'border-[#3182F6] bg-[#EEF5FF]' : 'border-[#E5E8EB] bg-white active:bg-[#F8F9FA]'}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${active ? 'bg-[#3182F6] text-white' : 'bg-[#F2F5F9] text-[#8B95A1]'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className={`block text-[16px] font-bold ${active ? 'text-[#3182F6]' : 'text-[#1A1A1A]'}`}>{m.label}</span>
                      <span className="block text-[13px] text-[#8B95A1]">{m.hint}</span>
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-[#3182F6] bg-[#3182F6]' : 'border-[#D1D6DB]'}`}>
                      {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </section>

            <section className="mt-7">
              <label className="mb-2.5 block text-[15px] font-bold text-[#1A1A1A]">연락받을 번호</label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                placeholder="010-0000-0000"
                className="h-[54px] w-full rounded-2xl border border-[#E5E8EB] bg-white px-4 text-[16px] font-medium text-[#1A1A1A] outline-none placeholder:text-[#C4CAD0] focus:border-[#3182F6]"
              />
            </section>

            <p className="mt-4 text-[12px] leading-[1.6] text-[#B0B8C1]">
              신청 시 프리티풀 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다. 남겨주신 번호는 매칭된 사회자 연결 목적으로만 사용돼요.
            </p>
          </main>
          <BottomCta disabled={phone.replace(/\D/g, '').length < 10 || !contact || submitting} onClick={submit}>
            {submitting ? '신청 중…' : '매칭 신청하기'}
          </BottomCta>
        </>
      )}

      {/* ── STEP: 완료 ── */}
      {step === 'done' && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-7 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#3182F6]">
            <Check className="h-11 w-11 text-white" strokeWidth={3} />
          </div>
          <h2 className="text-[24px] font-extrabold leading-[1.36] tracking-[-0.02em] text-[#1A1A1A]">
            매칭 신청이<br />완료되었습니다
          </h2>
          <p className="mt-3 text-[15px] leading-[1.6] text-[#6B7684]">
            선택하신 <b className="text-[#3182F6]">{selected.size}명</b>의 사회자에게 신청이 전달됐어요.<br />
            {contact}(으)로 곧 연락드릴게요.
          </p>
          <div className="mt-8 w-full max-w-[320px] rounded-2xl bg-[#F8F9FA] px-5 py-4 text-left">
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between"><dt className="text-[#8B95A1]">예식일</dt><dd className="font-semibold text-[#333D4B]">{date || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-[#8B95A1]">지역</dt><dd className="font-semibold text-[#333D4B]">{[group?.label, subRegion].filter(Boolean).join(' ') || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-[#8B95A1]">연락방식</dt><dd className="font-semibold text-[#333D4B]">{contact}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
