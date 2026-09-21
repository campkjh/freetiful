'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { captureUtm } from '@/lib/landing-track';

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
function matchesRegion(p: ProListItem, group?: { match: string[] }) {
  if (!group) return true;
  if (p.isNationwide) return true;
  const rs = p.regions || [];
  return rs.includes('전국가능') || rs.some((r) => group.match.includes(r));
}
const stag = (i: number) => ({ animationDelay: `${0.3 + i * 0.07}s` });

/* ── 사회자 카드 ─────────────────────────────────────────── */
function VideoSlide({ id, name }: { id: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="qm-pro-slide">
      {playing ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`} title={`${name} 소개영상`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`${name} 소개영상 재생`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={name} loading="lazy" />
          <span className="qm-play"><Ic name="play" size={22} color="#fff" /></span>
        </button>
      )}
    </div>
  );
}
function ProCard({ pro, selected, onToggle, style }: { pro: ProListItem; selected: boolean; onToggle: () => void; style?: React.CSSProperties }) {
  const ytIds = useMemo(() => extractYoutubeIds(pro.youtubeUrl), [pro.youtubeUrl]);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActive((prev) => (prev === i ? prev : i));
  };
  return (
    <div className={`qm-pro qm-a-item ${selected ? 'on' : ''}`} style={style}>
      <div className="qm-pro-video">
        {ytIds.length > 0 ? (
          <>
            <div className="qm-pro-track" ref={trackRef} onScroll={onScroll}>
              {ytIds.map((id) => <VideoSlide key={id} id={id} name={pro.name} />)}
            </div>
            {ytIds.length > 1 && (
              <div className="qm-pro-dots">
                {ytIds.map((id, i) => <span key={id} className={`qm-pro-dot ${i === active ? 'on' : ''}`} />)}
              </div>
            )}
          </>
        ) : (
          <div className="qm-pro-track">
            <div className="qm-pro-slide">
              {pro.profileImageUrl ? <img src={pro.profileImageUrl} alt={pro.name} /> : <div className="qm-pro-noimg">소개영상 준비중</div>}
            </div>
          </div>
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
        <span className={`qm-pro-chk ${selected ? 'on' : ''}`}>
          {selected && (
            <svg viewBox="0 0 26 26" width="26" height="26" fill="none" aria-hidden="true">
              <path d="M5 13.5 L10.5 19 L21 7.5" stroke="#3182F6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
            </svg>
          )}
        </span>
      </button>
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
      await matchApi.quickRequest({ phone: digits, categoryId: '결혼식사회자', type: 'single', selectedProProfileIds: [...selected], eventDate: date || undefined, eventTime: time || undefined, eventLocation: [group?.label, venue.trim()].filter(Boolean).join(' ') || undefined, rawUserInput: { source: 'landing_quick_match', eventDate: date, eventTime: time, region: group?.label, venue: venue.trim(), mood: [...moods].join(', '), part, genderPref: gender, contactMethod: contact, phone: digits, selectedCount: selected.size, ...utm } });
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
            <h1 className="qm-h1 qm-a-title">예식 일시가<br />언제인가요?</h1>
            <p className="qm-sub qm-a-sub">날짜와 시간에 맞춰 가능한 사회자만 찾아드려요.</p>
            <label className="qm-datefield qm-a-item" style={stag(0)}>
              <Ic name="calendar" size={22} color={date ? '#3182F6' : '#8B95A1'} />
              <span className={date ? 'val' : 'ph'}>{date ? formatKDate(date) : '예식일을 선택해주세요'}</span>
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="qm-datefield qm-a-item" style={stag(1)}>
              <Ic name="clock" size={22} color={time ? '#3182F6' : '#8B95A1'} />
              <span className={time ? 'val' : 'ph'}>{time ? formatKTime(time) : '예식 시간을 선택해주세요 (선택)'}</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </main>
          <Cta disabled={!date} onClick={() => setStep('region')}>다음</Cta>
        </div>
      )}

      {step === 'region' && (
        <div className="qm-page" key="region">
          <Header onBack={() => back('date')} />
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
          <Header onBack={() => back('region')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장 이름을<br />알려주세요</h1>
            <p className="qm-sub qm-a-sub">예식장을 알면 더 잘 맞는 사회자를 찾아드려요. (선택)</p>
            <input className="qm-textinput qm-a-item" style={stag(0)} type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="예: 빌라드지디 청담" enterKeyHint="next" />
          </main>
          <Cta disabled={false} onClick={() => setStep('mood')}>{venue.trim() ? '다음' : '건너뛰기'}</Cta>
        </div>
      )}

      {step === 'mood' && (
        <div className="qm-page" key="mood">
          <Header onBack={() => back('venue')} />
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
          <Header onBack={() => back('mood')} />
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
          <div className="qm-ctawrap qm-btnrow">
            <button type="button" className="qm-cta ghost" onClick={() => back('gender')}>이전으로</button>
            <button type="button" className="qm-cta" onClick={() => { setSelected(new Set(displayed.map((p) => p.id))); setStep('contact'); }}>전체선택</button>
          </div>
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
.qm-cta{width:100%;height:56px;border:0;border-radius:14px;background:var(--blue);color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:transform .05s,background .15s;font-family:inherit;}
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
.qm-pro{border-radius:36px;overflow:hidden;background:#fff;box-shadow:0 14px 44px rgba(17,24,39,.12),0 4px 14px rgba(17,24,39,.05);transition:box-shadow .18s,transform .18s;}
.qm-pro.on{box-shadow:0 0 0 2px var(--blue),0 14px 44px rgba(49,130,246,.20),0 4px 14px rgba(49,130,246,.08);}
.qm-pro-video{position:relative;aspect-ratio:16/9;background:#000;}
.qm-pro-track{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.qm-pro-track::-webkit-scrollbar{display:none;}
.qm-pro-slide{position:relative;flex:0 0 100%;height:100%;scroll-snap-align:start;background:#000;}
.qm-pro-video iframe,.qm-pro-video button,.qm-pro-video img{position:absolute;inset:0;width:100%;height:100%;border:0;}
.qm-pro-video img{object-fit:cover;}
.qm-pro-video button{background:none;cursor:pointer;padding:0;}
.qm-pro-video button::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;background:linear-gradient(to top,rgba(255,255,255,1) 0%,rgba(255,255,255,.96) 9%,rgba(255,255,255,.72) 20%,rgba(255,255,255,.38) 36%,rgba(255,255,255,.12) 50%,rgba(255,255,255,0) 66%);}
.qm-pro-noimg{display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.4);font-size:14px;}
.qm-pro-dots{position:absolute;left:0;right:0;bottom:9px;z-index:3;display:flex;justify-content:center;gap:5px;pointer-events:none;}
.qm-pro-dot{width:6px;height:6px;border-radius:50%;background:rgba(25,31,40,.28);transition:width .2s,background .2s;}
.qm-pro-dot.on{width:16px;border-radius:3px;background:var(--blue);}
.qm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;}
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
.qm-pro-chk{width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;}
.qm-pro-chk path{stroke-dasharray:1;stroke-dashoffset:1;animation:qm-check-draw .36s .02s cubic-bezier(.65,0,.35,1) forwards;}
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
  .qm-reroll:hover{background:var(--divider);}
  .qm-header button:hover{background:var(--divider);}
}
`;
