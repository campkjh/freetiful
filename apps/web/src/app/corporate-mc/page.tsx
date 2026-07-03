'use client';

/**
 * 전문행사(기업행사) 사회자 랜딩 — 홈 "전문행사 사회자 찾기" 진입.
 * 디자인 원본: corporate-mc-landing.html (CSS 는 .cmc 스코프로 이식)
 * 폼 제출: wedding-mc 와 동일하게 matchApi quickRequest/createRequest (source: landing_corporate_mc_v1)
 */

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

// ─── 미디어 슬롯 (드라이브 자산 수급 후 채움 — onError 로 없으면 자동 숨김) ───
const MEDIA_DIR = '/images/corporate-mc';
const HERO_IMG = `${MEDIA_DIR}/hero.jpg`;
const PROFILE_SLIDES: { src: string; role: string; name: string }[] = [
  { src: `${MEDIA_DIR}/profile-01.jpg`, role: '시상식 · 컨퍼런스', name: '아나운서 출신 MC' },
  { src: `${MEDIA_DIR}/profile-02.jpg`, role: '브랜드 · 론칭 행사', name: '아나운서 출신 MC' },
  { src: `${MEDIA_DIR}/profile-03.jpg`, role: '포럼 · 기념식 · 의전', name: '공식행사 전문 MC' },
  { src: `${MEDIA_DIR}/profile-04.jpg`, role: '글로벌 컨퍼런스', name: '영어 진행 가능 MC' },
  { src: `${MEDIA_DIR}/profile-05.jpg`, role: '제품 발표회', name: '쇼호스트 출신 MC' },
  { src: `${MEDIA_DIR}/profile-06.jpg`, role: '송년회 · 사내행사', name: '아나운서 출신 MC' },
];
const SCENE_SLIDES: { src: string; cap: string }[] = [
  { src: `${MEDIA_DIR}/scene-01.jpg`, cap: '사내 시상식 진행' },
  { src: `${MEDIA_DIR}/scene-02.jpg`, cap: '기업 컨퍼런스 진행' },
  { src: `${MEDIA_DIR}/scene-03.jpg`, cap: '브랜드 론칭 행사' },
  { src: `${MEDIA_DIR}/scene-04.jpg`, cap: '송년회 진행' },
  { src: `${MEDIA_DIR}/scene-05.jpg`, cap: '기념식 · 의전 진행' },
];
// 레퍼런스 영상 — /uploads URL(직접 업로드) 또는 유튜브 embed URL
const VIDEOS: { src: string; cap: string }[] = [];

const EVENT_TYPES = ['사내 시상식', '송년회·신년회', '컨퍼런스·세미나', '브랜드·론칭 행사', '공공·기념식·의전', '투자설명회·데모데이', '아직 정해지지 않았어요 / 기타'];
const BENEFITS = ['예상 견적 안내', 'MC 진행 영상·프로필', '대본·큐시트 가이드', '의전·식순 체크리스트'];

export default function CorporateMcPage() {
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // 폼 상태
  const [step, setStep] = useState<number | 'done'>(1);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState<string | null>(null);
  const [dateText, setDateText] = useState('');
  const [region, setRegion] = useState('');
  const [size, setSize] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 통계 카운트업
  const statsRef = useRef<HTMLDivElement>(null);
  const counted = useRef(false);
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || counted.current) return;
        counted.current = true;
        el.querySelectorAll<HTMLElement>('.num[data-target]').forEach((n) => {
          const target = Number(n.dataset.target || 0);
          const suffix = n.dataset.suffix || '';
          if (!target) { n.textContent = `0${suffix}`; return; }
          const start = performance.now();
          const dur = 1100;
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            n.textContent = Math.floor(target * eased).toLocaleString('ko-KR') + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else n.textContent = target.toLocaleString('ko-KR') + suffix;
          };
          requestAnimationFrame(tick);
        });
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const slide = (id: string, dir: number) => {
    const t = document.getElementById(id);
    if (!t) return;
    t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: 'smooth' });
  };

  const goNext = (from: number) => {
    if (from === 1 && (!name.trim() || !phone.trim())) { toast.error('성함과 연락처를 입력해주세요.'); return; }
    if (from === 2 && !eventType) { toast.error('행사 유형을 선택해주세요.'); return; }
    setStep(from + 1);
  };

  const submit = async () => {
    if (submitting) return;
    if (!consent) { toast.error('개인정보 수집·이용에 동의해주세요.'); return; }
    setSubmitting(true);
    const digits = phone.replace(/\D/g, '');
    const rawUserInput = {
      source: 'landing_corporate_mc_v1',
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      eventType,
      dateText: dateText.trim(),
      region: region.trim(),
      size: size.trim(),
      benefits,
      landing_url: typeof window !== 'undefined' ? window.location.href : '',
    };
    try {
      let res: any;
      if (authUser) {
        res = await matchApi.createRequest({
          categoryId: '전문행사사회자',
          type: 'multi',
          eventLocation: region.trim() || undefined,
          rawUserInput,
        } as any);
      } else {
        res = await matchApi.quickRequest({
          name: name.trim() || undefined,
          phone: digits,
          categoryId: '전문행사사회자',
          type: 'multi',
          eventLocation: region.trim() || undefined,
          rawUserInput,
        });
        if (res?.accessToken && res?.refreshToken && res?.user) {
          setAuth(res.user, res.accessToken, res.refreshToken);
        }
      }
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      try { (window as any).webkit?.messageHandlers?.nativeMCSearch?.postMessage({ action: 'start', category: '행사 사회자' }); } catch {}
      setStep('done');
    } catch (err: any) {
      toast.error(`제출에 실패했어요. ${err?.response?.data?.message || err?.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pct = step === 'done' ? 100 : (step as number) * 25;

  return (
    <div className="cmc">
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav>
        <div className="wrap">
          <div className="brand"><b>프리티풀</b><span>CORPORATE MC</span></div>
          <a href="#apply" className="btn btn-brass nav-cta">가능 MC 확인하기 →</a>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <div className="hero-copy">
            <div className="eyebrow">Corporate Event MC</div>
            <h1>중요한 행사의 완성도는<br /><span className="hl">사회자</span>에 따라 달라집니다</h1>
            <p className="lead"><b>KBS · SBS · MBC 아나운서 출신.</b><br />중요한 행사일수록 검증된 사회자가 필요합니다!</p>
            <div className="hero-cta">
              <a href="#apply" className="btn btn-brass">행사일 기준 가능 MC 확인하기 →</a>
            </div>
            <div className="hero-badge">
              <span><b>시상식 · 컨퍼런스 · 브랜드 행사</b> 진행 경험</span>
              <span><b>공식행사 · 의전</b> 대응 가능</span>
            </div>
          </div>
          <div className="hero-media">
            <div className="ph"><span className="ic">🎤</span>행사 진행 사진</div>
            <img src={HERO_IMG} alt="기업행사를 진행 중인 프리티풀 전문 사회자" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>
      </header>

      {/* STATS */}
      <section className="stats" ref={statsRef}>
        <div className="wrap">
          <div className="stat"><div className="num" data-target="1200" data-suffix="+">1,200+</div><div className="lbl">기업행사 진행</div></div>
          <div className="stat"><div className="num" data-target="99" data-suffix="%">99%</div><div className="lbl">담당자 재섭외 의향</div></div>
          <div className="stat"><div className="num" data-target="0" data-suffix="건">0건</div><div className="lbl">의전·진행 사고</div></div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem divider">
        <div className="wrap">
          <div className="head">
            <div className="eyebrow" style={{ color: 'var(--danger)' }}>Real Voices</div>
            <h2>&ldquo;이 사회자, <span className="danger">누가 섭외했어?&rdquo;</span></h2>
            <p style={{ marginTop: 16 }}>행사가 어색해지는 건 한순간입니다. 그리고 그 책임은 사회자가 아니라 담당자에게 돌아옵니다.</p>
          </div>
          <div className="pain-grid">
            <div className="pain"><div className="tag">어색한 침묵</div><p>발표 사이에 정적이 흐르는데 사회자가 받아주질 못해서, 행사장 분위기가 그대로 가라앉았어요.</p></div>
            <div className="pain"><div className="tag">잘못된 호칭</div><p>임원 직함을 잘못 부르는 바람에, 식이 끝나고도 한참 사과하고 다녔습니다.</p></div>
            <div className="pain"><div className="tag">밀리는 식순</div><p>시간 조율을 못 해서 식순이 계속 밀렸고, 결국 대표님 다음 일정까지 꼬여버렸어요.</p></div>
            <div className="pain"><div className="tag">맞지 않는 톤</div><p>시상식인데 너무 가벼운 진행이라, 회사 이미지가 우스워 보일까 봐 내내 조마조마했습니다.</p></div>
          </div>
          <p className="pivot">기업행사는 다시 할 수 없습니다.<br /><span className="danger">사회자 한 명이 회사 이미지를 결정합니다.</span></p>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="solution divider">
        <div className="wrap">
          <div className="head">
            <div className="eyebrow">Verified MCs</div>
            <h2>그래서 검증된 전문 MC가 필요합니다</h2>
            <p>방송사 아나운서 출신, 공식행사·브랜드행사 경험이 검증된 진행자를 만나보세요.</p>
          </div>
          <div className="slider-block">
            <div className="slider-label">사회자 프로필</div>
            <div className="slider">
              <button className="slider-btn prev" aria-label="이전" onClick={() => slide('profileTrack', -1)}>‹</button>
              <div className="slider-track" id="profileTrack">
                {PROFILE_SLIDES.map((s, i) => (
                  <div key={s.src} className="slide portrait">
                    <div className="ph"><span className="ic">👤</span>프로필 {String(i + 1).padStart(2, '0')}</div>
                    <img src={s.src} alt={`사회자 프로필 ${i + 1}`} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="cap">{s.name}<small>{s.role}</small></div>
                  </div>
                ))}
              </div>
              <button className="slider-btn next" aria-label="다음" onClick={() => slide('profileTrack', 1)}>›</button>
            </div>
          </div>

          <div className="slider-block">
            <div className="slider-label">행사 진행 모습</div>
            <div className="slider">
              <button className="slider-btn prev" aria-label="이전" onClick={() => slide('actionTrack', -1)}>‹</button>
              <div className="slider-track" id="actionTrack">
                {SCENE_SLIDES.map((s, i) => (
                  <div key={s.src} className="slide land">
                    <div className="ph"><span className="ic">🎤</span>진행 모습 {String(i + 1).padStart(2, '0')}</div>
                    <img src={s.src} alt={`행사 진행 모습 ${i + 1}`} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="cap">{s.cap}</div>
                  </div>
                ))}
              </div>
              <button className="slider-btn next" aria-label="다음" onClick={() => slide('actionTrack', 1)}>›</button>
            </div>
          </div>
          <div className="ticker">
            <div className="ticker-track">
              <span><b>KBS</b> · <b>SBS</b> · <b>MBC</b> · <b>YTN</b> · <b>JTBC</b> · 홈쇼핑 쇼호스트 · 호텔·컨벤션 행사 경험 ·&nbsp;</span>
              <span><b>KBS</b> · <b>SBS</b> · <b>MBC</b> · <b>YTN</b> · <b>JTBC</b> · 홈쇼핑 쇼호스트 · 호텔·컨벤션 행사 경험 ·&nbsp;</span>
            </div>
          </div>
        </div>
      </section>

      {/* REFERENCE VIDEOS */}
      {VIDEOS.length > 0 && (
        <section className="videos divider">
          <div className="wrap">
            <div className="head">
              <div className="eyebrow">Reference Films</div>
              <h2>프리티풀의 사회자와<br />함께 해야 하는 이유</h2>
              <p>사진보다 확실한 건 실제 진행 영상입니다. 직접 보고 판단하세요.</p>
            </div>
            <div className="video-grid">
              {VIDEOS.map((v) => (
                <div key={v.src} className="video-card">
                  {v.src.includes('youtube.com') ? (
                    <iframe src={v.src} title={v.cap} allowFullScreen />
                  ) : (
                    <video src={`${v.src}#t=0.1`} controls playsInline preload="metadata" />
                  )}
                  <div className="vcap">{v.cap}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHY */}
      <section className="why divider" id="why">
        <div className="wrap">
          <div className="head">
            <div className="eyebrow">Why Freetiful</div>
            <h2>중요한 행사는<br />재미보다 안정감이 중요합니다</h2>
            <p>방송 3사 출신, 풍부한 경력의 검증된 사회자.</p>
          </div>
          <div className="why-grid">
            <div className="why-card"><div className="no">01</div><h3>철저하게 검증된 MC</h3><p>방송사 아나운서 출신 또는 충분한 공식행사 경력이 검증된 진행자만 선별해 안내합니다. 프로필·진행 영상까지 함께 드려 내부 보고도 수월합니다.</p></div>
            <div className="why-card"><div className="no">02</div><h3>행사 성격에 맞는 추천</h3><p>시상식은 품격 있게, 송년회는 밝게, 컨퍼런스는 차분하게. 행사 톤앤매너를 이해하고 어울리는 MC를 골라서 제안해드립니다.</p></div>
            <div className="why-card"><div className="no">03</div><h3>대본·큐시트 사전 조율</h3><p>당일 즉흥이 아니라, 대본과 큐시트를 미리 확인하고 리허설까지 맞춥니다. 발표 지연·순서 변경 같은 현장 변수에도 안정적으로 대응합니다.</p></div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="reviews divider">
        <div className="wrap">
          <div className="head">
            <div className="eyebrow">Reviews</div>
            <h2>잘 끝난 행사는,<br />담당자를 돋보이게 합니다</h2>
          </div>
          <div className="rev-grid">
            <div className="rev"><div className="stars">★★★★★</div><p className="quote">&ldquo;임원분들 호칭 하나 안 틀리고 깔끔하게 끝나서, 제가 칭찬을 들었어요.&rdquo;</p><div className="who">대기업 인사팀 · 사내 시상식</div></div>
            <div className="rev"><div className="stars">★★★★★</div><p className="quote">&ldquo;브랜드 톤을 정확히 잡아주셔서, VIP·기자분들 앞에서 안심이 됐습니다.&rdquo;</p><div className="who">패션 브랜드 마케팅팀 · 신제품 발표회</div></div>
            <div className="rev"><div className="stars">★★★★★</div><p className="quote">&ldquo;견적·프로필·영상을 빠르게 받아서 클라이언트 컨펌이 수월했어요.&rdquo;</p><div className="who">행사대행사 · 기업 컨퍼런스</div></div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="process divider">
        <div className="wrap">
          <div className="head">
            <div className="eyebrow">Process</div>
            <h2>섭외, 이렇게 간편하게 진행됩니다</h2>
            <p>행사일과 유형만 남겨주세요. 나머지는 프리티풀이 정리해드립니다.</p>
          </div>
          <div className="steps">
            <div className="step"><div className="bar"></div><div className="no">STEP 01</div><h3>행사 정보 접수</h3><p>전문 MD가 행사 일정·유형·규모·예산·식순을 확인합니다.</p></div>
            <div className="step"><div className="bar"></div><div className="no">STEP 02</div><h3>MC 제안 &amp; 선택</h3><p>가능한 진행자를 프로필·진행 영상으로 비교해 직접 고르고, 내부 보고용 자료까지 받습니다.</p></div>
            <div className="step"><div className="bar"></div><div className="no">STEP 03</div><h3>계약 · 사전 조율</h3><p>대본·큐시트를 사전에 맞추고, 세금계산서·정산 조건까지 깔끔하게 정리합니다.</p></div>
            <div className="step"><div className="bar"></div><div className="no">STEP 04</div><h3>당일 진행 &amp; 마무리</h3><p>리허설부터 현장 변수 대응, 정산·세금계산서까지 책임지고 마무리합니다.</p></div>
          </div>
        </div>
      </section>

      {/* SCALE */}
      <section className="scale divider">
        <div className="wrap">
          <p className="big">이미 <b>1,200개 기업</b>의 행사가<br />프리티풀의 MC와 함께였습니다.</p>
          <p className="sub">이제 담당자님 차례입니다.</p>
        </div>
      </section>

      {/* LEAD / FORM */}
      <section className="lead divider" id="apply">
        <div className="wrap">
          <div className="pitch">
            <div className="eyebrow">지금 바로 확인하세요</div>
            <h2>행사 일정이 없어도 괜찮아요.<br />미리 확인해두세요.</h2>
            <p>담당자라면 언젠가 한 번은 맡게 되는 게 기업행사입니다. 미리 가능 MC와 견적 기준을 알아두면, 막상 행사가 잡혔을 때 훨씬 덜 불안합니다.</p>
            <p className="cta-note">📅 기업행사는 보통 5~6개월 전부터 섭외가 되고 있습니다.</p>
            <div className="gift">
              <div className="item"><span className="ic">🎯</span><div><b>가능 MC · 예상 견적 안내</b><small>행사일·유형에 맞춰 가능한 진행자와 예상 견적을 1영업일 내 안내</small></div></div>
              <div className="item"><span className="ic">🎬</span><div><b>진행 영상 · 프로필 제공</b><small>내부 보고·클라이언트 컨펌에 바로 쓰는 MC 프로필과 진행 레퍼런스</small></div></div>
              <div className="item"><span className="ic">🗂</span><div><b>행사 성격별 MC 추천</b><small>시상식·컨퍼런스·송년회 등 톤에 맞는 진행자를 골라서 제안</small></div></div>
            </div>
          </div>

          <div className="formcard">
            <div className="progress"><span className="ptext">{step === 'done' ? '완료 · 100%' : `${step} / 4 단계 · ${pct}% 완료`}</span></div>
            <div className="pbar"><i style={{ width: `${pct}%` }} /></div>

            {step === 1 && (
              <div className="fstep active">
                <h3>먼저 담당자님 정보를 알려주세요</h3>
                <p className="desc">가능 MC와 견적을 안내드릴 연락처예요.</p>
                <div className="field"><label>성함 / 직함</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 김OO 대리" /></div>
                <div className="field"><label>회사명 (선택)</label><input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="예) OO기업 인사팀" /></div>
                <div className="field"><label>연락처</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" /></div>
                <div className="fnav"><button className="btn btn-primary" onClick={() => goNext(1)}>다음 →</button></div>
                <p className="consent">입력하신 정보는 MC 안내 목적으로만 사용됩니다.</p>
              </div>
            )}

            {step === 2 && (
              <div className="fstep active">
                <h3>어떤 행사를 준비하고 계신가요?</h3>
                <p className="desc">행사 성격에 맞는 MC를 추천해드릴게요.</p>
                <div className="opt-grid">
                  {EVENT_TYPES.map((t, i) => (
                    <button key={t} className={`opt ${i === EVENT_TYPES.length - 1 ? 'full' : ''} ${eventType === t ? 'sel' : ''}`} onClick={() => setEventType(t)}>{t}</button>
                  ))}
                </div>
                <div className="fnav"><button className="btn btn-ghost back" onClick={() => setStep(1)}>← 이전</button><button className="btn btn-primary" onClick={() => goNext(2)}>다음 →</button></div>
              </div>
            )}

            {step === 3 && (
              <div className="fstep active">
                <h3>행사 정보를 알려주세요</h3>
                <p className="desc">행사일·지역·규모를 알면 더 잘 맞는 분을 추천할 수 있어요.</p>
                <div className="field"><label>행사 예정일</label><input type="text" value={dateText} onChange={(e) => setDateText(e.target.value)} placeholder="예) 2026년 12월 중순 / 미정" /></div>
                <div className="field"><label>행사 지역</label><input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예) 서울 강남 / 호텔 미정" /></div>
                <div className="field"><label>예상 참석 인원 (선택)</label><input type="text" value={size} onChange={(e) => setSize(e.target.value)} placeholder="예) 100명 내외" /></div>
                <div className="fnav"><button className="btn btn-ghost back" onClick={() => setStep(2)}>← 이전</button><button className="btn btn-primary" onClick={() => goNext(3)}>다음 →</button></div>
              </div>
            )}

            {step === 4 && (
              <div className="fstep active">
                <h3>마지막이에요!</h3>
                <p className="desc">필요한 자료를 함께 보내드릴게요. (복수 선택)</p>
                <div className="check-grid">
                  {BENEFITS.map((b) => (
                    <div key={b} className={`chk ${benefits.includes(b) ? 'sel' : ''}`} onClick={() => setBenefits((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])}>
                      <span className="box">✓</span> {b}
                    </div>
                  ))}
                </div>
                <div className={`chk ${consent ? 'sel' : ''}`} style={{ marginBottom: 6 }} onClick={() => setConsent(!consent)}>
                  <span className="box">✓</span> 개인정보 수집·이용에 동의합니다
                </div>
                <div className="fnav">
                  <button className="btn btn-ghost back" onClick={() => setStep(3)}>← 이전</button>
                  <button className="btn btn-brass" disabled={submitting} onClick={submit}>{submitting ? '접수 중…' : '가능 MC · 견적 신청 🎯'}</button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="done active">
                <div className="mark">🎯</div>
                <h3>신청 완료!</h3>
                <p>1영업일 내에 행사에 맞는 가능 MC와<br />예상 견적을 안내드릴게요.</p>
                <p style={{ marginTop: 20, fontSize: 13, color: 'var(--muted-2)' }}>가능 MC·견적은 문의목록과 입력하신 연락처로 안내됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p className="fcta"><b>1,200개 기업</b>이 프리티풀의 MC와 함께 행사를 마쳤습니다.</p>
          <a href="#apply" className="btn btn-brass">🎯 가능 MC · 견적 무료로 확인하기</a>
          <small>© FREETIFUL · CORPORATE MC<br />본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.</small>
        </div>
      </footer>
    </div>
  );
}

// ─── 원본 랜딩 CSS (.cmc 스코프) ───────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap');
.cmc{
  --ink:#14181f; --ink-2:#2a2f38; --paper:#ffffff; --line:#e7e3d9; --line-soft:#f0ede5;
  --brass:#a9803f; --brass-deep:#8a6731; --muted:#5b5e63; --muted-2:#9a9da2; --danger:#9c3a2e;
  --radius:14px; --maxw:1100px;
  --sans:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;
  --serif:'Gowun Batang',serif;
  font-family:var(--sans); color:var(--ink); background:var(--paper); line-height:1.7;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.cmc *{margin:0;padding:0;box-sizing:border-box}
.cmc .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.cmc section{padding:96px 0}
.cmc .divider{border-top:1px solid var(--line-soft)}
.cmc .eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--brass);font-weight:600;margin-bottom:18px}
.cmc h2{font-size:clamp(28px,4.4vw,42px);font-weight:700;line-height:1.32;letter-spacing:-.02em;color:var(--ink)}
.cmc h3{font-size:20px;font-weight:600;line-height:1.45;color:var(--ink)}
.cmc p{color:var(--muted)}
.cmc a{color:inherit;text-decoration:none}
.cmc .btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:16px;font-weight:600;padding:16px 28px;border-radius:999px;border:none;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.cmc .btn:disabled{opacity:.6;cursor:default}
.cmc .btn-primary{background:var(--ink);color:#fff}
.cmc .btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 30px -12px rgba(20,24,31,.35)}
.cmc .btn-brass{background:var(--brass);color:#fff}
.cmc .btn-brass:hover{transform:translateY(-2px);background:var(--brass-deep);box-shadow:0 14px 30px -12px rgba(169,128,63,.45)}
.cmc .btn-ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.cmc .btn-ghost:hover{border-color:var(--ink)}
.cmc nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.cmc nav .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
.cmc .brand{display:flex;flex-direction:column;line-height:1.1}
.cmc .brand b{font-size:18px;font-weight:800;letter-spacing:.02em}
.cmc .brand span{font-size:10px;letter-spacing:.28em;color:var(--brass);font-weight:600}
.cmc .nav-cta{font-size:14px;padding:11px 20px}
.cmc .hero{position:relative;background:var(--paper);padding:88px 0 84px;text-align:left;border-bottom:1px solid var(--line-soft)}
.cmc .hero .wrap{position:relative;z-index:2;display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center}
.cmc .hero-media{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:4/5;border:1px solid var(--line);background:var(--line-soft)}
.cmc .hero-media img{width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:2}
.cmc .hero-media .ph{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:var(--muted-2);font-size:13px;padding:24px;line-height:1.6}
.cmc .hero-media .ph .ic{font-size:26px}
.cmc .hero h1{font-size:clamp(34px,6vw,58px);font-weight:800;line-height:1.24;letter-spacing:-.025em;color:var(--ink);margin-bottom:22px}
.cmc .hero h1 .hl{color:var(--brass)}
.cmc .hero .lead{font-size:clamp(16px,2.1vw,19px);color:var(--muted);max-width:680px;margin-bottom:34px}
.cmc .hero .lead b{color:var(--ink);font-weight:700}
.cmc .hero-cta{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.cmc .hero-badge{margin-top:30px;display:inline-flex;flex-wrap:wrap;gap:8px 16px;font-size:13px;color:var(--muted-2)}
.cmc .hero-badge b{color:var(--ink-2);font-weight:600}
.cmc .cta-note{margin-bottom:26px;font-size:16px;color:var(--danger);font-weight:700;line-height:1.5}
.cmc .stats{padding:0;border-bottom:1px solid var(--line-soft)}
.cmc .stats .wrap{display:grid;grid-template-columns:repeat(3,1fr)}
.cmc .stat{padding:52px 16px;text-align:center;border-right:1px solid var(--line-soft)}
.cmc .stat:last-child{border-right:none}
.cmc .stat .num{font-size:clamp(30px,5vw,48px);font-weight:800;color:var(--brass);letter-spacing:-.02em;font-family:var(--sans)}
.cmc .stat .lbl{font-size:14px;color:var(--muted);margin-top:6px}
.cmc .problem .head{text-align:center;max-width:760px;margin:0 auto 56px}
.cmc .problem h2 .danger{color:var(--danger)}
.cmc .pain-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;max-width:920px;margin:0 auto}
.cmc .pain{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:30px 28px;position:relative}
.cmc .pain .tag{font-size:13px;font-weight:700;color:var(--danger);letter-spacing:.02em;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.cmc .pain .tag::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--danger)}
.cmc .pain p{font-size:15.5px;color:#3d4148}
.cmc .problem .pivot{text-align:center;max-width:780px;margin:56px auto 0;font-family:var(--serif);font-size:clamp(20px,3vw,28px);line-height:1.5;color:var(--ink);font-weight:700}
.cmc .problem .pivot .danger{color:var(--danger)}
.cmc .solution .head{text-align:center;max-width:720px;margin:0 auto 50px}
.cmc .solution .head p{margin-top:14px}
.cmc .ticker{margin-top:46px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.cmc .ticker-track{display:flex;gap:34px;white-space:nowrap;animation:cmcScroll 26s linear infinite;width:max-content}
.cmc .ticker-track span{font-size:15px;color:var(--muted);letter-spacing:.04em}
.cmc .ticker-track b{color:var(--brass);font-weight:700}
@keyframes cmcScroll{to{transform:translateX(-50%)}}
.cmc .slider-block{margin-bottom:40px}
.cmc .slider-block:last-of-type{margin-bottom:0}
.cmc .slider-label{font-size:14px;font-weight:600;color:var(--brass);margin-bottom:16px;letter-spacing:.02em}
.cmc .slider{position:relative}
.cmc .slider-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:2px 2px 10px;scrollbar-width:none;-ms-overflow-style:none}
.cmc .slider-track::-webkit-scrollbar{display:none}
.cmc .slide{flex:0 0 auto;scroll-snap-align:start;position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--line-soft)}
.cmc .slide.portrait{width:200px;aspect-ratio:3/4}
.cmc .slide.land{width:330px;aspect-ratio:16/10}
.cmc .slide img{width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:2}
.cmc .slide .ph{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;color:var(--muted-2);font-size:12px;text-align:center;padding:14px;line-height:1.5}
.cmc .slide .ph .ic{font-size:22px}
.cmc .slide .cap{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:18px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff;font-size:13px;font-weight:600;line-height:1.4}
.cmc .slide .cap small{display:block;font-weight:500;color:#e7d7b8;font-size:11.5px;margin-top:2px}
.cmc .slider-btn{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 6px 16px -8px rgba(0,0,0,.35);transition:all .15s}
.cmc .slider-btn:hover{border-color:var(--brass);color:var(--brass)}
.cmc .slider-btn.prev{left:-10px}
.cmc .slider-btn.next{right:-10px}
.cmc .videos .head{text-align:center;max-width:720px;margin:0 auto 52px}
.cmc .videos .head p{margin-top:14px}
.cmc .video-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.cmc .video-card{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#0d0f12}
.cmc .video-card iframe{width:100%;aspect-ratio:16/9;border:0;display:block;position:relative;z-index:2}
.cmc .video-card video{width:100%;max-height:420px;border:0;display:block;position:relative;z-index:2;object-fit:contain;background:#0d0f12}
.cmc .video-card .vcap{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:16px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff;font-size:13px;font-weight:600;pointer-events:none}
.cmc .why .head{text-align:center;max-width:680px;margin:0 auto 56px}
.cmc .why .head p{margin-top:12px}
.cmc .why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.cmc .why-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:38px 30px}
.cmc .why-card .no{font-family:var(--serif);font-size:42px;font-weight:700;color:var(--brass);line-height:1;margin-bottom:18px}
.cmc .why-card h3{margin-bottom:12px}
.cmc .why-card p{font-size:15px}
.cmc .reviews .head{text-align:center;max-width:680px;margin:0 auto 52px}
.cmc .rev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.cmc .rev{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:30px 28px}
.cmc .rev .quote{font-family:var(--serif);font-size:17px;line-height:1.6;color:var(--ink);margin-bottom:18px}
.cmc .rev .who{font-size:13px;color:var(--muted-2)}
.cmc .rev .stars{color:var(--brass);font-size:13px;letter-spacing:2px;margin-bottom:14px}
.cmc .process .head{text-align:center;max-width:720px;margin:0 auto 56px}
.cmc .process .head p{margin-top:14px}
.cmc .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.cmc .step{position:relative;padding-top:28px}
.cmc .step .no{font-size:13px;letter-spacing:.2em;color:var(--brass);font-weight:700;margin-bottom:14px}
.cmc .step .bar{height:2px;background:var(--line);position:absolute;top:6px;left:0;right:0}
.cmc .step .bar::before{content:"";position:absolute;left:0;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--brass)}
.cmc .step h3{font-size:18px;margin-bottom:10px}
.cmc .step p{font-size:14.5px;color:var(--muted)}
.cmc .scale{text-align:center}
.cmc .scale .big{font-family:var(--serif);font-size:clamp(30px,5vw,46px);font-weight:700;line-height:1.4;color:var(--ink);max-width:820px;margin:0 auto}
.cmc .scale .big b{color:var(--brass)}
.cmc .scale .sub{margin-top:18px;font-size:17px}
.cmc .lead .wrap{display:grid;grid-template-columns:1fr 1.05fr;gap:54px;align-items:start}
.cmc .lead .pitch h2{margin-bottom:20px}
.cmc .lead .pitch p{margin-bottom:30px}
.cmc .gift{display:flex;flex-direction:column;gap:14px}
.cmc .gift .item{display:flex;gap:14px;align-items:flex-start;background:var(--line-soft);border:1px solid var(--line);padding:18px 20px;border-radius:12px}
.cmc .gift .item .ic{font-size:20px;flex-shrink:0;line-height:1.4}
.cmc .gift .item b{color:var(--ink);display:block;font-size:15px;font-weight:600}
.cmc .gift .item small{color:var(--muted);font-size:13px}
.cmc .formcard{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:34px 32px;color:var(--ink);box-shadow:0 24px 50px -30px rgba(0,0,0,.25)}
.cmc .progress{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.cmc .progress .ptext{font-size:12px;color:var(--muted-2);font-weight:600}
.cmc .pbar{height:6px;background:var(--line-soft);border-radius:999px;overflow:hidden;margin-bottom:26px}
.cmc .pbar i{display:block;height:100%;background:var(--brass);width:25%;transition:width .35s ease;border-radius:999px}
.cmc .fstep.active{display:block;animation:cmcFade .35s ease}
@keyframes cmcFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cmc .fstep h3{font-size:19px;margin-bottom:6px}
.cmc .fstep .desc{font-size:14px;color:var(--muted);margin-bottom:22px}
.cmc .field{margin-bottom:16px}
.cmc .field label{display:block;font-size:13px;font-weight:600;margin-bottom:7px;color:#3d4148}
.cmc .field input{width:100%;font-family:var(--sans);font-size:15px;padding:13px 15px;border:1px solid var(--line);border-radius:10px;background:#fcfbf8;transition:border .15s}
.cmc .field input:focus{outline:none;border-color:var(--brass)}
.cmc .opt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
.cmc .opt{border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:14.5px;cursor:pointer;background:#fcfbf8;transition:all .15s;font-weight:500;text-align:left;color:var(--ink)}
.cmc .opt:hover{border-color:var(--brass)}
.cmc .opt.sel{border-color:var(--brass);background:#faf4e8;color:var(--brass-deep);font-weight:600}
.cmc .opt.full{grid-column:1/-1}
.cmc .check-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.cmc .chk{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:10px;padding:13px 15px;cursor:pointer;font-size:14px;background:#fcfbf8;transition:all .15s;color:var(--ink)}
.cmc .chk:hover{border-color:var(--brass)}
.cmc .chk.sel{border-color:var(--brass);background:#faf4e8}
.cmc .chk .box{width:18px;height:18px;border:1.5px solid var(--muted-2);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff}
.cmc .chk.sel .box{background:var(--brass);border-color:var(--brass)}
.cmc .fnav{display:flex;gap:10px;margin-top:24px}
.cmc .fnav .btn{flex:1;justify-content:center;font-size:15px;padding:14px}
.cmc .fnav .back{flex:0 0 auto;padding:14px 20px}
.cmc .consent{font-size:12px;color:var(--muted-2);margin-top:14px;text-align:center}
.cmc .done{text-align:center;display:none}
.cmc .done.active{display:block;animation:cmcFade .4s ease}
.cmc .done .mark{font-size:46px;margin-bottom:10px}
.cmc .done h3{font-size:22px;margin-bottom:10px}
.cmc .done p{font-size:15px;color:var(--muted)}
.cmc footer{background:var(--paper);border-top:1px solid var(--line);padding:48px 0;text-align:center}
.cmc footer .fcta{margin-bottom:24px;color:var(--muted)}
.cmc footer .fcta b{color:var(--ink)}
.cmc footer small{display:block;font-size:12px;color:var(--muted-2);margin-top:14px;line-height:1.7}
@media(max-width:860px){
  .cmc section{padding:72px 0}
  .cmc .video-grid{grid-template-columns:1fr}
  .cmc .slider-btn{width:34px;height:34px}
  .cmc .pain-grid{grid-template-columns:1fr}
  .cmc .why-grid{grid-template-columns:1fr}
  .cmc .rev-grid{grid-template-columns:1fr}
  .cmc .steps{grid-template-columns:1fr 1fr}
  .cmc .lead .wrap{grid-template-columns:1fr;gap:40px}
  .cmc .hero{padding:64px 0 60px}
  .cmc .hero .wrap{grid-template-columns:1fr;gap:36px}
  .cmc .hero-media{aspect-ratio:16/10;max-height:340px}
  .cmc .stats .wrap{grid-template-columns:repeat(3,1fr)}
  .cmc .stat{padding:36px 8px}
}
@media(max-width:520px){
  .cmc .steps{grid-template-columns:1fr}
  .cmc .opt-grid,.cmc .check-grid{grid-template-columns:1fr}
  .cmc .nav-cta{display:none}
  .cmc .stat .num{font-size:26px}
  .cmc .stat .lbl{font-size:12px}
}
`;
