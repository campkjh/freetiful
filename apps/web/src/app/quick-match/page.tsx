'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { captureUtm } from '@/lib/landing-track';

/* ─────────────────────────────────────────────────────────────
 * 퀵매칭 — 토스 톤앤매너. 한 화면당 한 질문, 단일선택 자동 진행.
 * 등장: 타이틀 페이드업 → 서브타이틀 → 카드들 위→아래 순서로 우→좌 페이드슬라이드.
 * 번호 입력: 큰 숫자 + 밑줄 + 커스텀 숫자 키패드(토스식).
 * 의뢰: 비로그인 quickRequest(single, selectedProProfileIds).
 * ──────────────────────────────────────────────────────────── */

type Step = 'date' | 'region' | 'subregion' | 'venue' | 'ceremony' | 'part' | 'gender' | 'searching' | 'results' | 'contact' | 'phone' | 'done';

const ICON = (n: string) => `/quick-match/icons/${n}.svg`;
function Ic({ name, size = 24, color, className = '' }: { name: string; size?: number; color?: string; className?: string }) {
  return <i aria-hidden className={`qm-ic ${className}`} style={{ width: size, height: size, color, WebkitMaskImage: `url(${ICON(name)})`, maskImage: `url(${ICON(name)})` }} />;
}

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
type Note = { title: string; body: string; list?: string[] };
const CEREMONY_TYPES: { label: string; icon: string; note?: Note }[] = [
  { label: '일반 예식장 (웨딩홀)', icon: 'diamond' },
  { label: '호텔 예식', icon: 'building' },
  { label: '하우스 · 스몰웨딩', icon: 'home' },
  { label: '종교시설 (성당·교회)', icon: 'church', note: {
    title: '성당·교회 예식은 미리 확인해주세요',
    body: '종교시설은 예식 순서가 정해져 있어 외부 사회자를 두기 어려운 경우가 있어요. 섭외 전 예식장에 아래를 확인해주세요.',
    list: ['외부 사회자 진행이 가능한지', '예식 시간·순서를 조율할 수 있는지'],
  } },
  { label: '야외 · 기타', icon: 'tree', note: {
    title: '야외 예식은 이런 점을 확인해요',
    body: '야외는 음향과 날씨의 영향을 크게 받아요. 야외 진행 경험이 있는 사회자를 우선 추천해드릴게요.',
  } },
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
const SEARCH_STEPS = ['예식 정보를 확인했어요', '선호 조건을 분석했어요', '조건에 맞는 사회자를 찾았어요'];
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
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function matchesGender(p: ProListItem, g: 'any' | 'male' | 'female') {
  if (g === 'any') return true;
  const v = (p.gender || '').toLowerCase();
  return g === 'male' ? v === 'male' || (p.gender || '').includes('남') : v === 'female' || (p.gender || '').includes('여');
}
function matchesRegion(p: ProListItem, group?: { match: string[] }) {
  if (!group) return true;
  if (p.isNationwide) return true;
  const rs = p.regions || [];
  return rs.includes('전국가능') || rs.some((r) => group.match.includes(r));
}
/** 카드 등장 순서 지연 (위에서부터 하나씩) */
const stag = (i: number) => ({ animationDelay: `${0.3 + i * 0.07}s` });

/* ── 사회자 카드 ─────────────────────────────────────────── */
function ProCard({ pro, selected, onToggle, style }: { pro: ProListItem; selected: boolean; onToggle: () => void; style?: React.CSSProperties }) {
  const [playing, setPlaying] = useState(false);
  const ytId = extractYoutubeId(pro.youtubeUrl);
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : pro.profileImageUrl;
  return (
    <div className={`qm-pro qm-a-item ${selected ? 'on' : ''}`} style={style}>
      <div className="qm-pro-video">
        {playing && ytId ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`} title={`${pro.name} 소개영상`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" onClick={() => ytId && setPlaying(true)} aria-label={`${pro.name} 소개영상`}>
            {thumb ? <img src={thumb} alt={pro.name} /> : <div className="qm-pro-noimg">소개영상 준비중</div>}
            {ytId && <span className="qm-play"><Ic name="play" size={22} color="#fff" /></span>}
          </button>
        )}
      </div>
      <button type="button" className="qm-pro-info" onClick={onToggle}>
        <span className="qm-pro-ava">{pro.profileImageUrl && <img src={pro.profileImageUrl} alt="" />}</span>
        <span className="qm-pro-body">
          <span className="qm-pro-name">
            사회자 {pro.name}
            {pro.avgRating > 0 && <span className="qm-pro-rate"><Ic name="star" size={14} color="#FFC94D" />{pro.avgRating.toFixed(2)}<em>({pro.reviewCount})</em></span>}
          </span>
          <span className="qm-pro-desc">{[pro.careerYears ? `경력 ${pro.careerYears}년` : '', pro.shortIntro || pro.mainExperience || ''].filter(Boolean).join(' · ')}</span>
        </span>
        <span className={`qm-chk ${selected ? 'on' : ''}`}>{selected && <Ic name="check" size={16} color="#fff" />}</span>
      </button>
    </div>
  );
}

export default function QuickMatchPage() {
  const [step, setStep] = useState<Step>('date');
  const [date, setDate] = useState('');
  const [regionKey, setRegionKey] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [venue, setVenue] = useState('');
  const [ceremony, setCeremony] = useState('');
  const [part, setPart] = useState('');
  const [gender, setGender] = useState<'any' | 'male' | 'female' | ''>('');
  const [pool, setPool] = useState<ProListItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [rerolled, setRerolled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState(false);
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pct, setPct] = useState(0);

  const group = useMemo(() => REGION_GROUPS.find((g) => g.key === regionKey), [regionKey]);
  useEffect(() => { captureUtm(); }, []);

  const advancingRef = useRef(false);
  useEffect(() => { advancingRef.current = false; }, [step]);
  function advance(next: Step) { if (advancingRef.current) return; advancingRef.current = true; setTimeout(() => setStep(next), 220); }
  function back(to: Step) { advancingRef.current = true; setStep(to); }

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
      const res: any = await discoveryApi.getProList({ limit: 80, sort: 'reviews', withTotal: false });
      const rows: ProListItem[] = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      const byGender = rows.filter((p) => matchesGender(p, g));
      const withVid = byGender.filter((p) => extractYoutubeId(p.youtubeUrl));
      const base = withVid.length >= 5 ? withVid : (byGender.length >= 5 ? byGender : rows);
      const inR = base.filter((p) => matchesRegion(p, group));
      const rest = base.filter((p) => !matchesRegion(p, group));
      setPool([...shuffle(inR), ...shuffle(rest)]);
    } catch { setLoadErr(true); setPool([]); }
  }

  useEffect(() => {
    if (step !== 'searching') return;
    setPct(0); setOffset(0); setRerolled(false); setSelected(new Set());
    loadPros((gender || 'any') as any);
    const t0 = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - t0) / 2600);
      setPct(Math.round((1 - Math.pow(1 - t, 2)) * 100));
      if (t >= 1) { clearInterval(timer); setStep('results'); }
    }, 40);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const displayed = useMemo(() => {
    if (pool.length === 0) return [];
    if (pool.length <= 5) return pool;
    const s = offset % pool.length;
    const out = pool.slice(s, s + 5);
    if (out.length < 5) out.push(...pool.slice(0, 5 - out.length));
    return out;
  }, [pool, offset]);

  function toggle(id: string) { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function reroll() { if (rerolled) return; setRerolled(true); setOffset((o) => o + 5); setSelected(new Set()); }

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || selected.size === 0 || !contact) return;
    setSubmitting(true);
    const utm = { utm_source: sessionStorage.getItem('utm_source') || '', utm_medium: sessionStorage.getItem('utm_medium') || '', utm_campaign: sessionStorage.getItem('utm_campaign') || '', referrer: sessionStorage.getItem('referrer') || '', landing_url: typeof window !== 'undefined' ? window.location.href : '' };
    try {
      await matchApi.quickRequest({ phone: digits, categoryId: '결혼식사회자', type: 'single', selectedProProfileIds: [...selected], eventDate: date || undefined, eventLocation: [group?.label, subRegion, venue.trim()].filter(Boolean).join(' ') || undefined, rawUserInput: { source: 'landing_quick_match', eventDate: date, region: group?.label, subRegion, venue: venue.trim(), ceremony, part, genderPref: gender, contactMethod: contact, phone: digits, selectedCount: selected.size, ...utm } });
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') (window as any).fbq('track', 'Lead', { content_category: 'quick-match', currency: 'KRW' });
      setStep('done');
    } catch (e: any) { window.alert(`신청에 실패했어요. 잠시 후 다시 시도해 주세요. ${e?.response?.data?.message || ''}`); }
    setSubmitting(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const R = 2 * Math.PI * 34;
  const phoneDigits = phone.replace(/\D/g, '');

  return (
    <div className="qm-root">
      <style>{CSS}</style>

      {step === 'date' && (
        <div className="qm-page" key="date">
          <Header onBack={() => { try { history.back(); } catch {} }} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식일이<br />언제인가요?</h1>
            <p className="qm-sub qm-a-sub">날짜에 맞춰 가능한 사회자만 찾아드려요.</p>
            <label className="qm-datefield qm-a-item" style={stag(0)}>
              <Ic name="calendar" size={22} color={date ? '#3182F6' : '#8B95A1'} />
              <span className={date ? 'val' : 'ph'}>{date ? formatKDate(date) : '예식일을 선택해주세요'}</span>
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </main>
          <Cta disabled={!date} onClick={() => setStep('region')}>다음</Cta>
        </div>
      )}

      {step === 'region' && (
        <div className="qm-page" key="region">
          <Header onBack={() => back('date')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장은<br />어느 지역인가요?</h1>
            <p className="qm-sub qm-a-sub">가까운 지역의 사회자를 우선 추천해드려요.</p>
            <div className="qm-list">
              {REGION_GROUPS.map((g, i) => (
                <button key={g.key} type="button" className={`qm-opt qm-a-item ${regionKey === g.key ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setRegionKey(g.key); setSubRegion(''); advance('subregion'); }}>
                  <span className="qm-opt-t">{g.label}</span>
                  <span className="qm-chk-line">{regionKey === g.key && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'subregion' && (
        <div className="qm-page" key="subregion">
          <Header onBack={() => back('region')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">{group?.label} 중<br />어디에서 하시나요?</h1>
            <p className="qm-sub qm-a-sub">예식장 위치를 알려주시면 더 정확해요.</p>
            <div className="qm-list">
              {(group?.subs || []).map((s, i) => (
                <button key={s} type="button" className={`qm-opt qm-a-item ${subRegion === s ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setSubRegion(s); advance('venue'); }}>
                  <span className="qm-opt-t">{s}</span>
                  <span className="qm-chk-line">{subRegion === s && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'venue' && (
        <div className="qm-page" key="venue">
          <Header onBack={() => back('subregion')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장 이름을<br />알려주세요</h1>
            <p className="qm-sub qm-a-sub">예식장을 알면 더 잘 맞는 사회자를 찾아드려요. (선택)</p>
            <input className="qm-textinput qm-a-item" style={stag(0)} type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="예: 빌라드지디 청담" enterKeyHint="next" />
          </main>
          <Cta disabled={false} onClick={() => setStep('ceremony')}>{venue.trim() ? '다음' : '건너뛰기'}</Cta>
        </div>
      )}

      {step === 'ceremony' && (
        <div className="qm-page" key="ceremony">
          <Header onBack={() => back('venue')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">어떤 형태의<br />예식인가요?</h1>
            <p className="qm-sub qm-a-sub">예식 분위기에 어울리는 사회자를 찾아드려요.</p>
            <div className="qm-list">
              {CEREMONY_TYPES.map((c, i) => {
                const on = ceremony === c.label;
                return (
                  <div className="qm-optwrap qm-a-item" style={stag(i)} key={c.label}>
                    <button type="button" className={`qm-opt icon ${on ? 'on' : ''}`} onClick={() => setCeremony(c.label)}>
                      <span className={`qm-opt-ic ${on ? 'on' : ''}`}><Ic name={c.icon} size={22} color={on ? '#3182F6' : '#6B7684'} /></span>
                      <span className="qm-opt-t">{c.label}</span>
                      <span className="qm-chk-line">{on && <Ic name="check" size={20} color="#3182F6" />}</span>
                    </button>
                    {on && c.note && <NoteCard note={c.note} />}
                  </div>
                );
              })}
            </div>
          </main>
          <Cta disabled={!ceremony} onClick={() => setStep('part')}>다음</Cta>
        </div>
      )}

      {step === 'part' && (
        <div className="qm-page" key="part">
          <Header onBack={() => back('ceremony')} />
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
          <Header onBack={() => back('part')} />
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
        <div className="qm-page center" key="searching">
          <div className="qm-ringwrap">
            <svg viewBox="0 0 80 80" className="qm-ring">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#EEF0F3" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#3182F6" strokeWidth="6" strokeLinecap="round" strokeDasharray={R} strokeDashoffset={R * (1 - pct / 100)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset .1s linear' }} />
            </svg>
            <span className="qm-ring-ic"><Ic name="sparkle" size={30} color="#3182F6" /></span>
          </div>
          <h2 className="qm-h2 center">고객님의 예식에 알맞는<br />사회자를 찾고 있어요</h2>
          <p className="qm-pct">{pct}% 진행 중</p>
          <div className="qm-searchlist">
            {SEARCH_STEPS.map((s, i) => {
              const done = pct >= (i + 1) * 33;
              return (
                <div className={`qm-searchrow ${done ? 'done' : ''}`} key={s}>
                  <span className="qm-searchrow-ic">{done ? <Ic name="check" size={18} color="#3182F6" /> : <span className="qm-spin" />}</span>
                  <span>{s}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="qm-page" key="results">
          <Header onBack={() => back('gender')} />
          <main className="qm-main tight">
            <h1 className="qm-h1 qm-a-title">조건에 가장 잘 맞는<br />사회자 <b className="blue">{Math.min(5, displayed.length) || 5}명</b>을 찾았어요</h1>
            <p className="qm-sub qm-a-sub">영상을 보고 의뢰할 사회자를 선택하세요. 여러 명 선택할 수 있어요.</p>
            <div className="qm-resbar qm-a-item" style={stag(0)}>
              <span>{selected.size}명 선택됨</span>
              <button type="button" className="qm-reroll" onClick={reroll} disabled={rerolled || pool.length <= 5}><Ic name="refresh" size={16} color="currentColor" />{rerolled ? '다시 찾기 완료' : '다른 사회자 보기'}</button>
            </div>
            {loadErr ? (
              <div className="qm-err">사회자를 불러오지 못했어요.<br /><button type="button" onClick={() => setStep('searching')}>다시 시도</button></div>
            ) : (
              <div className="qm-pros">{displayed.map((p, i) => <ProCard key={p.id} pro={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} style={stag(i + 1)} />)}</div>
            )}
          </main>
          <Cta disabled={selected.size === 0} onClick={() => setStep('contact')}>{selected.size > 0 ? `${selected.size}명에게 의뢰하기` : '사회자를 선택하세요'}</Cta>
        </div>
      )}

      {step === 'contact' && (
        <div className="qm-page" key="contact">
          <Header onBack={() => back('results')} />
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
          <Header onBack={() => back('contact')} />
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
            <div><span>예식일</span><b>{date ? formatKDate(date) : '-'}</b></div>
            <div><span>지역</span><b>{[group?.label, subRegion].filter(Boolean).join(' ') || '-'}</b></div>
            {venue.trim() && <div><span>예식장</span><b>{venue.trim()}</b></div>}
            <div><span>진행</span><b>{part || '-'}</b></div>
            <div><span>연락방식</span><b>{contact}</b></div>
          </div>
        </div>
      )}
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
function Header({ onBack }: { onBack: () => void }) {
  return <header className="qm-header"><button type="button" onClick={onBack} aria-label="뒤로"><Ic name="back" size={26} color="#191F28" /></button></header>;
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
/* 등장 애니메이션: 타이틀 페이드업 → 서브타이틀 → 카드 우→좌 슬라이드 */
@keyframes qm-fadeup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes qm-slidein{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
@keyframes qm-pagefade{from{opacity:0}to{opacity:1}}
.qm-a-title{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) both;}
.qm-a-sub{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) .18s both;}
.qm-a-item{animation:qm-slidein .46s cubic-bezier(.22,.61,.36,1) both;}
.qm-header{height:56px;display:flex;align-items:center;padding:0 8px;flex:none;}
.qm-header button{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:20px;cursor:pointer;}
.qm-header button:active{background:var(--divider);}
.qm-main{flex:1;padding:8px 24px 24px;}
.qm-main.tight{padding:8px 16px 24px;}
.qm-h1{font-size:24px;font-weight:600;line-height:1.4;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h1 .blue{color:var(--blue);}
.qm-h2{font-size:21px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h2.center{margin-top:26px;}
.qm-sub{font-size:15px;color:var(--t-ph);margin:10px 0 0;line-height:1.5;}
.qm-datefield{position:relative;display:flex;align-items:center;gap:12px;height:60px;margin-top:28px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;}
.qm-datefield:focus-within{border-color:var(--blue);}
.qm-datefield .ph{color:var(--t-ph);font-size:16px;}
.qm-datefield .val{color:var(--t-strong);font-size:16px;font-weight:600;}
.qm-datefield input{position:absolute;inset:0;opacity:0;width:100%;height:100%;border:0;background:none;}
.qm-list{margin-top:26px;display:flex;flex-direction:column;gap:10px;}
.qm-opt{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s;text-align:left;}
.qm-opt:active{background:#F8F9FA;}
.qm-opt.on{border-color:var(--blue);background:var(--blue-bg);}
.qm-opt.icon,.qm-opt.sub{padding:14px 18px;}
.qm-opt-ic{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--divider);}
.qm-opt-ic.on{background:#DCEBFF;}
.qm-opt-t{flex:1;font-size:17px;font-weight:600;color:var(--t);}
.qm-opt.on .qm-opt-t{color:var(--blue);font-weight:600;}
.qm-opt-tt{flex:1;display:flex;flex-direction:column;gap:3px;}
.qm-opt-hint{font-size:13px;font-weight:400;color:var(--t-ph);}
.qm-chk-line{width:24px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;}
.qm-optwrap{display:block;}
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
.qm-cta{width:100%;height:56px;border:0;border-radius:14px;background:var(--blue);color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:transform .05s,background .15s;font-family:inherit;}
.qm-cta:active:not(:disabled){transform:scale(.99);background:var(--blue-press);}
.qm-cta:disabled{background:var(--bg-gray);color:var(--t-dis);cursor:default;}
/* 번호 입력 (큰 숫자 + 밑줄 + 키패드) */
.qm-bignum{margin-top:44px;padding-bottom:16px;border-bottom:2px solid var(--border);transition:border-color .15s;}
.qm-bignum.on{border-color:var(--blue);}
.qm-bignum-t{display:flex;align-items:center;font-size:28px;font-weight:600;letter-spacing:.5px;line-height:1;}
.qm-bignum-t b{color:var(--t-strong);font-weight:600;}
.qm-bignum-t i{color:var(--t-dis);font-style:normal;font-weight:600;}
.qm-caret{width:2px;height:28px;background:var(--blue);margin-left:2px;animation:qm-blink 1s step-end infinite;}
@keyframes qm-blink{50%{opacity:0}}
.qm-phone-bottom{margin-top:auto;flex:none;}
.qm-cta-pad{padding:0 20px 10px;}
.qm-keypad{display:grid;grid-template-columns:repeat(3,1fr);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6px);}
.qm-key{height:62px;display:flex;align-items:center;justify-content:center;border:0;background:none;font-size:26px;font-weight:500;color:var(--t-strong);cursor:pointer;font-family:inherit;transition:background .1s;border-radius:14px;margin:2px 6px;}
.qm-key:active:not(.empty){background:var(--divider);}
.qm-key.empty{pointer-events:none;}
.qm-ringwrap{position:relative;width:80px;height:80px;}
.qm-ring{width:80px;height:80px;}
.qm-ring-ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.qm-pct{margin:14px 0 0;font-size:15px;font-weight:600;color:var(--blue);}
.qm-searchlist{margin-top:34px;width:100%;max-width:280px;display:flex;flex-direction:column;gap:16px;}
.qm-searchrow{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--t-dis);transition:color .3s;}
.qm-searchrow.done{color:var(--t);font-weight:600;}
.qm-searchrow-ic{width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex:none;}
.qm-spin{width:15px;height:15px;border-radius:50%;border:2px solid #E5E8EB;border-top-color:var(--blue);animation:qm-spin .7s linear infinite;}
@keyframes qm-spin{to{transform:rotate(360deg)}}
.qm-resbar{display:flex;align-items:center;justify-content:space-between;margin:18px 4px 0;}
.qm-resbar>span{font-size:13px;font-weight:600;color:var(--t-sub);}
.qm-reroll{display:flex;align-items:center;gap:6px;border:1px solid var(--border);background:#fff;color:var(--t-sub);font-size:13px;font-weight:600;padding:8px 14px;border-radius:999px;cursor:pointer;font-family:inherit;}
.qm-reroll:active{background:var(--divider);}
.qm-reroll:disabled{opacity:.4;cursor:default;}
.qm-pros{margin-top:14px;display:flex;flex-direction:column;gap:12px;}
.qm-pro{border:1.5px solid var(--border);border-radius:18px;overflow:hidden;background:#fff;transition:border-color .15s,box-shadow .15s;}
.qm-pro.on{border-color:var(--blue);box-shadow:0 0 0 1.5px var(--blue);}
.qm-pro-video{position:relative;aspect-ratio:16/9;background:#000;}
.qm-pro-video iframe,.qm-pro-video button,.qm-pro-video img{position:absolute;inset:0;width:100%;height:100%;border:0;}
.qm-pro-video img{object-fit:cover;}
.qm-pro-video button{background:none;cursor:pointer;padding:0;}
.qm-pro-noimg{display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.4);font-size:14px;}
.qm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;}
.qm-pro-info{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:none;border:0;cursor:pointer;text-align:left;}
.qm-pro-ava{width:46px;height:46px;flex:none;border-radius:50%;overflow:hidden;background:var(--divider);}
.qm-pro-ava img{width:100%;height:100%;object-fit:cover;}
.qm-pro-body{flex:1;min-width:0;}
.qm-pro-name{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:600;color:var(--t-strong);}
.qm-pro-rate{display:flex;align-items:center;gap:2px;font-size:13px;font-weight:600;color:var(--t-strong);}
.qm-pro-rate em{color:var(--t-ph);font-style:normal;font-weight:500;}
.qm-pro-desc{display:block;margin-top:2px;font-size:13px;color:var(--t-weak);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qm-chk{width:26px;height:26px;flex:none;border-radius:50%;border:2px solid #D1D6DB;display:flex;align-items:center;justify-content:center;}
.qm-chk.on{border-color:var(--blue);background:var(--blue);}
.qm-err{margin-top:40px;text-align:center;color:var(--t-ph);font-size:14px;line-height:1.6;}
.qm-err button{margin-top:12px;background:var(--divider);color:var(--t-sub);font-weight:600;border:0;border-radius:12px;padding:9px 16px;cursor:pointer;font-family:inherit;}
.qm-done-ic{width:84px;height:84px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;}
.qm-done-sub{margin-top:14px;font-size:15px;line-height:1.6;color:var(--t-weak);}
.qm-done-sub .blue,.blue{color:var(--blue);}
.qm-summary{margin-top:30px;width:100%;max-width:330px;background:#F9FAFB;border-radius:16px;padding:6px 18px;}
.qm-summary>div{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--divider);}
.qm-summary>div:last-child{border-bottom:0;}
.qm-summary span{font-size:14px;color:var(--t-ph);}
.qm-summary b{font-size:14px;font-weight:600;color:var(--t);}
`;
