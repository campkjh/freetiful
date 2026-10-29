"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import MetaPixel, { META_PIXEL_ID } from "@/components/landing/MetaPixel";
import {
  captureUtm,
  trackLandingConversion,
  trackLandingVisit,
} from "@/lib/landing-track";
import { isTestLeadSubmission } from "@/lib/test-lead";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  parseWeddingQuickMatchPrefill,
  readWeddingQuickMatchPrefill,
  weddingPhone,
  weddingQuickMatchUrl,
  WEDDING_LEAD_SHEET_URL,
  WEDDING_QUICK_MATCH_KEY,
  WEDDING_REGIONS,
  type WeddingQuickMatchPrefill,
} from "@/lib/wedding-quick-match";
import styles from "./wedding-landing.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const photo = (n: number) => `/wedding_mc/wall/${pad(n)}.webp`;
const HERO = Array.from(
  { length: 48 },
  (_, i) => `/wedding_mc/hero/${pad(i + 1)}.webp`,
).concat([19, 20, 21, 22, 23].map(photo));
// A stable permutation keeps the supplied photo wall identical across hydration.
const WALL = Array.from(
  { length: HERO.length },
  (_, i) => HERO[(i * 17) % HERO.length],
);
const HALLS = [
  "더 신라 서울",
  "빌라드지디",
  "그랜드 하얏트 서울",
  "더채플앳청담",
  "웨스틴 조선 서울",
  "슈슈몽드",
  "아펠가모",
  "라움아트센터",
  "롯데호텔 서울",
  "루벨",
];
const GENDERS = [
  { code: "female", label: "여성 사회자" },
  { code: "male", label: "남성 사회자" },
  { code: "any", label: "둘 다 좋아요" },
] as const;
const ymd = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const pixel = () =>
  (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;

function PhotoWall() {
  const [columns, setColumns] = useState(5);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setColumns(mq.matches ? 3 : 5);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return (
    <div className="w-wall" aria-hidden="true">
      {Array.from({ length: columns }, (_, c) => {
        const images = WALL.filter((_, i) => i % columns === c);
        return (
          <div
            key={c}
            className={`w-col${c % 2 ? " down" : ""}`}
            style={{ "--d": `${60 + c * 11}s` } as CSSProperties}
          >
            {images.concat(images).map((src, i) => (
              <img key={`${src}-${i}`} src={src} alt="" decoding="async" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ProfileRail() {
  const rail = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const drag = useRef<{ start: number; x: number } | null>(null);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = performance.now(),
      visible = false,
      half = 0;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      half = (element.scrollWidth + 14) / 2;
    });
    resize.observe(element);
    const tick = (now: number) => {
      if (visible && !document.hidden) {
        if (!drag.current && !mq.matches)
          x.current -= 40 * Math.min(0.05, (now - last) / 1000);
        if (half) x.current = ((x.current % half) - half) % half;
        element.style.transform = `translateX(${x.current}px)`;
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  const release = () => {
    drag.current = null;
    rail.current?.classList.remove("dragging");
  };
  return (
    <div className="rail" aria-label="프리티풀 사회자 프로필">
      <div
        ref={rail}
        className="rail-track"
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          drag.current = { start: e.clientX, x: x.current };
          e.currentTarget.classList.add("dragging");
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            x.current = drag.current.x + e.clientX - drag.current.start;
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {Array.from({ length: 36 }, (_, i) => (
          <img
            key={i}
            src={photo((i % 18) + 1)}
            alt={i < 18 ? "프리티풀 전문 사회자 프로필" : ""}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}

function CeremonyCount() {
  const target = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(9000);
  useEffect(() => {
    if (
      !target.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1400);
          setCount(Math.round(9000 * (1 - (1 - t) ** 3)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(target.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return <span ref={target}>{count.toLocaleString("ko-KR")}</span>;
}

export default function WeddingMcLandingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [undecided, setUndecided] = useState(false);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("00");
  const [region, setRegion] = useState("");
  const [gender, setGender] = useState<WeddingQuickMatchPrefill["gender"] | "">(
    "",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const started = useRef(false);
  const picker = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    captureUtm();
    trackLandingVisit("wedding-mc");
  }, []);
  useEffect(() => {
    router.prefetch("/quick-match");
  }, [router]);
  useEffect(() => {
    try {
      const draft = readWeddingQuickMatchPrefill(sessionStorage);
      if (!draft) return;
      setDate(draft.date);
      setUndecided(draft.dateUndecided);
      setHour(draft.time.slice(0, 2));
      setMinute(draft.time.slice(3) || "00");
      setRegion(draft.region);
      setGender(draft.gender);
      setName(draft.name);
      setPhone(draft.phone);
      setAgree(true);
      setStep(2);
      started.current = true;
    } catch {}
  }, []);
  useEffect(() => {
    if (!calendar) return;
    const close = (e: globalThis.PointerEvent) => {
      if (!picker.current?.contains(e.target as Node)) setCalendar(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalendar(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [calendar]);
  useEffect(() => {
    if (step > 0)
      form.current
        ?.querySelector<HTMLElement>(
          "fieldset:not([hidden]) input:not([type=hidden]), fieldset:not([hidden]) button",
        )
        ?.focus({ preventScroll: true });
  }, [step]);

  const testSubmission = () => {
    const u = useAuthStore.getState().user;
    return isTestLeadSubmission(name || u?.name, u?.id);
  };
  const start = () => {
    if (started.current) return;
    started.current = true;
    if (!testSubmission())
      pixel()?.("trackSingle", META_PIXEL_ID, "InitiateCheckout", {
        content_name: "MC Hire Form Start",
      });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (submittingRef.current) return;
    if (step === 0) {
      if (!undecided && !date)
        return setError(
          "달력에서 예식일을 고르거나 아직 정해지지 않았어요를 선택해 주세요.",
        );
      if (!undecided && !hour) return setError("예식 시간을 선택해 주세요.");
      setCalendar(false);
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!region || !gender)
        return setError("예식 지역과 선호하는 사회자를 선택해 주세요.");
      setStep(2);
      return;
    }
    const normalized = weddingPhone(phone);
    if (!name.trim() || !normalized || !agree)
      return setError(
        "성함, 올바른 연락처와 개인정보 수집·이용 동의를 확인해 주세요.",
      );
    if (!undecided && date < ymd(today))
      return setError(
        "예식일이 지났습니다. 이전 단계에서 일정을 다시 선택해 주세요.",
      );
    submittingRef.current = true;
    setSubmitting(true);
    const test = testSubmission();
    const draft = parseWeddingQuickMatchPrefill({
      version: 1,
      createdAt: Date.now(),
      from: "wedding_mc",
      name,
      phone: normalized,
      date,
      time: hour ? `${hour}:${minute}` : "",
      dateUndecided: undecided,
      region,
      gender,
      consented: agree,
      sheetSubmitted: true,
      leadTracked: !test && typeof pixel() === "function",
    });
    if (!draft) {
      submittingRef.current = false;
      setSubmitting(false);
      setError("입력 정보를 다시 확인해 주세요.");
      return;
    }
    try {
      // The tab-only draft also supports refresh and portfolio back navigation; quick-match clears it on success.
      sessionStorage.setItem(WEDDING_QUICK_MATCH_KEY, JSON.stringify(draft));
      sessionStorage.removeItem("qm-return-v1");
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setError(
        "브라우저 저장소를 사용할 수 없습니다. 일반 브라우저에서 다시 시도해 주세요.",
      );
      return;
    }
    const utm = Object.fromEntries(
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "referrer",
        "landing_url",
      ].map((key) => [key, sessionStorage.getItem(key) || ""]),
    );
    const regionLabel = WEDDING_REGIONS.find((r) => r.code === region)!.label;
    const genderLabel = GENDERS.find((g) => g.code === gender)!.label;
    // Preserve the supplied sheet integration. A no-cors request is best-effort, not a delivery confirmation.
    void fetch(WEDDING_LEAD_SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        name: test ? `[테스트] ${draft.name}` : draft.name,
        phone: normalized,
        q1: `선호: ${genderLabel}`,
        weddingDate: draft.dateUndecided ? "미정" : draft.date,
        weddingTime: draft.time,
        region: regionLabel,
        benefits: [],
        couponCode: "",
        source: test ? "freetiful-mc-hire-test" : "freetiful-mc-hire",
        ...utm,
        landing_url: utm.landing_url || window.location.href,
      }),
    }).catch(() => undefined);
    if (!test) {
      pixel()?.("track", "Lead", {
        content_name: "MC Hire",
        content_category: "wedding-mc",
        currency: "KRW",
      });
      trackLandingConversion("wedding-mc");
    }
    router.push(weddingQuickMatchUrl(draft));
  };

  const dateLabel = date
    ? `${Number(date.slice(0, 4))}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`
    : "날짜를 선택해 주세요";
  const days = Array.from(
    {
      length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
  );
  return (
    <div
      className={styles.page}
      onClick={(e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
          'a[href^="#"]',
        );
        if (!link || link.hash === "") return;
        const target = document.getElementById(link.hash.slice(1));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          });
        }
      }}
    >
      <MetaPixel />
      <header className="top">
        <a className="logo" href="#">
          FREETIFUL
        </a>
        <nav>
          <a href="#lineup">사회자</a>
          <a className="ask" href="#apply">
            상담받기
          </a>
        </nav>
      </header>
      <main>
        <section className="w-hero" aria-label="프리티풀 사회자">
          <h1 className="w-title">
            결혼식 사회자,
            <br /> 아나운서로 구하세요.
          </h1>
          <div className="w-window">
            <div className="w-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>FREETIFUL</span>
            </div>
            <PhotoWall />
          </div>
          <a className="w-scroll" href="#intro" aria-label="아래로">
            <ArrowDown size={22} />
          </a>
        </section>
        <section id="intro" className="intro wrap">
          <h2>
            KBS·SBS·MBC 출신
            <br />
            아나운서 중심 사회자
          </h2>
          <p className="lead">지금 바로 사회자 리스트를 받아보세요.</p>
          <a className="btn" href="#apply">
            사회자 찾기 <ArrowRight size={18} />
          </a>
          <small>비회원 · 무료 상담</small>
        </section>
        <section className="count" aria-labelledby="count-title">
          <div className="wrap">
            <p className="num">
              <CeremonyCount />
              <em>+</em>
            </p>
            <p className="label">결혼식 사회 진행 횟수</p>
            <h2 id="count-title">결혼식은 라이브입니다.</h2>
            <p className="lead">안정감, 대처능력이 가장 중요합니다.</p>
            <p className="lead">
              식순이 밀려도, 마이크가 끊겨도,
              <br className="m-br" /> 하객석이 술렁여도.
              <br />
              9,000번의 예식이
              <br className="m-br" /> 그대로 대처 경험이 됐습니다.
            </p>
          </div>
        </section>
        <section className="venue" aria-labelledby="venue-title">
          <div className="wrap">
            <p className="eyebrow">레퍼런스</p>
            <h2 id="venue-title">
              어떤 예식장이든
              <br />
              진행해 봤습니다.
            </h2>
            <div className="kinds">
              {[
                {
                  image: 22,
                  name: "대형 웨딩홀",
                  detail: "대규모 하객 · 호텔 · 컨벤션",
                },
                {
                  image: 19,
                  name: "프리미엄 웨딩",
                  detail: "격식 있는 고급 예식",
                },
                {
                  image: 23,
                  name: "하우스 웨딩",
                  detail: "소규모 · 야외 · 스몰웨딩",
                },
              ].map((item) => (
                <figure key={item.name}>
                  <img
                    src={photo(item.image)}
                    alt={`${item.name}에서 진행하는 프리티풀 사회자`}
                    loading="lazy"
                  />
                  <figcaption>
                    <b>{item.name}</b>
                    <span>{item.detail}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div
            className="halls"
            aria-label={`진행한 웨딩홀: ${HALLS.join(", ")}`}
          >
            <div className="halls-track" aria-hidden="true">
              {HALLS.concat(HALLS).map((hall, i) => (
                <span key={i}>{hall}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="custom" aria-labelledby="custom-title">
          <div className="wrap">
            <p className="eyebrow">맞춤 진행</p>
            <h2 id="custom-title">
              정해진 대본이 아니라
              <br />두 분 예식에 맞춰 진행합니다.
            </h2>
            <div className="tags">
              {[
                "주례 없는 예식",
                "양가 어른 중심",
                "하우스 · 스몰웨딩",
                "유쾌한 분위기",
                "격식 있는 분위기",
                "식순 · 멘트 맞춤",
              ].map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="how wrap" aria-labelledby="how-title">
          <p className="eyebrow">진행 방법</p>
          <h2 id="how-title">
            아나운서 출신의
            <br />
            사회자 리스트를 받아보세요
          </h2>
          <ol className="steps">
            <li>
              <span>01</span>
              <b>세 단계 신청</b>
              <p>예식일, 지역, 연락처만 입력하면 30초면 끝나요.</p>
            </li>
            <li>
              <span>02</span>
              <b>사회자 5~9명 추천</b>
              <p>예식에 맞는 사회자를 골라 제안드려요.</p>
            </li>
            <li>
              <span>03</span>
              <b>사회자에게 바로 메시지</b>
              <p>대화해 보고 마음에 드는 사회자를 고르세요.</p>
            </li>
          </ol>
        </section>
        <section id="lineup" className="lineup" aria-labelledby="lineup-title">
          <div className="wrap">
            <p className="eyebrow">사회자</p>
            <h2 id="lineup-title">프리티풀 사회자</h2>
          </div>
          <ProfileRail />
        </section>
        <section id="apply" className="apply" aria-labelledby="apply-title">
          <div className="wrap">
            <p className="eyebrow" style={{ color: "#f06292" }}>
              사회자 찾기
            </p>
            <h2 id="apply-title">
              사회자를
              <br />
              실시간으로 추천받으세요.
            </h2>
            <p className="lead">5~9명의 사회자 리스트를 보내드려요!</p>
            <div className="flow">
              <div
                className="bar"
                role="progressbar"
                aria-label="신청 단계"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step + 1}
              >
                <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
              </div>
              <p className="step-no">{step + 1} / 3</p>
              <form ref={form} onSubmit={submit} onFocus={start} noValidate>
                <div className="stage">
                  <fieldset className="step" hidden={step !== 0}>
                    <legend>예식일이 언제인가요?</legend>
                    <div className="field">
                      <label htmlFor="date-btn">예식일</label>
                      <div className="picker-wrap" ref={picker}>
                        <button
                          type="button"
                          id="date-btn"
                          className={`in picker${date ? "" : " empty"}`}
                          aria-expanded={calendar}
                          aria-controls="wmc-calendar"
                          disabled={undecided}
                          onClick={() => setCalendar(!calendar)}
                        >
                          <span id="date-text">{dateLabel}</span>
                          <span aria-hidden="true">▾</span>
                        </button>
                        {calendar && (
                          <div id="wmc-calendar" className="cal">
                            <div className="cal-head">
                              <button
                                type="button"
                                aria-label="이전 달"
                                disabled={
                                  month <=
                                  new Date(
                                    today.getFullYear(),
                                    today.getMonth(),
                                    1,
                                  )
                                }
                                onClick={() =>
                                  setMonth(
                                    new Date(
                                      month.getFullYear(),
                                      month.getMonth() - 1,
                                      1,
                                    ),
                                  )
                                }
                              >
                                <ChevronLeft size={22} />
                              </button>
                              <b aria-live="polite">
                                {month.getFullYear()}년 {month.getMonth() + 1}월
                              </b>
                              <button
                                type="button"
                                aria-label="다음 달"
                                onClick={() =>
                                  setMonth(
                                    new Date(
                                      month.getFullYear(),
                                      month.getMonth() + 1,
                                      1,
                                    ),
                                  )
                                }
                              >
                                <ChevronRight size={22} />
                              </button>
                            </div>
                            <div className="cal-grid">
                              {"일월화수목금토".split("").map((day) => (
                                <span className="dow" key={day}>
                                  {day}
                                </span>
                              ))}
                              {Array.from(
                                { length: month.getDay() },
                                (_, i) => (
                                  <span key={`blank-${i}`} />
                                ),
                              )}
                              {days.map((day) => (
                                <button
                                  type="button"
                                  key={ymd(day)}
                                  disabled={day < today}
                                  aria-label={`${month.getMonth() + 1}월 ${day.getDate()}일`}
                                  aria-pressed={date === ymd(day)}
                                  onClick={() => {
                                    setDate(ymd(day));
                                    setCalendar(false);
                                  }}
                                >
                                  {day.getDate()}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={undecided}
                          onChange={(e) => {
                            setUndecided(e.target.checked);
                            setCalendar(false);
                            if (e.target.checked) {
                              setDate("");
                              setHour("");
                              setMinute("00");
                            }
                          }}
                        />
                        아직 정해지지 않았어요
                      </label>
                    </div>
                    <div className="field">
                      <label htmlFor="f-hour">예식 시간</label>
                      <div className="time-row">
                        <select
                          id="f-hour"
                          className="in"
                          disabled={undecided || !date}
                          value={hour}
                          onChange={(e) => setHour(e.target.value)}
                        >
                          <option value="">시 선택</option>
                          {Array.from({ length: 12 }, (_, i) => i + 9).map(
                            (h) => (
                              <option key={h} value={pad(h)}>
                                {pad(h)}시
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          className="in"
                          aria-label="분"
                          disabled={undecided || !date}
                          value={minute}
                          onChange={(e) => setMinute(e.target.value)}
                        >
                          <option value="00">00분</option>
                          <option value="30">30분</option>
                        </select>
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="step" hidden={step !== 1}>
                    <legend>어디서, 어떤 사회자를 원하세요?</legend>
                    <div className="field">
                      <p id="region-label">예식 지역</p>
                      <div
                        className="chips"
                        role="radiogroup"
                        aria-labelledby="region-label"
                      >
                        {WEDDING_REGIONS.map((r) => (
                          <label key={r.code}>
                            <input
                              type="radio"
                              name="region"
                              value={r.code}
                              checked={region === r.code}
                              onChange={() => setRegion(r.code)}
                            />
                            <span>{r.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <p id="gender-label">선호하는 사회자</p>
                      <div
                        className="chips trio"
                        role="radiogroup"
                        aria-labelledby="gender-label"
                      >
                        {GENDERS.map((g) => (
                          <label key={g.code}>
                            <input
                              type="radio"
                              name="gender"
                              value={g.code}
                              checked={gender === g.code}
                              onChange={() => setGender(g.code)}
                            />
                            <span>{g.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="step" hidden={step !== 2}>
                    <legend>
                      지금 바로 5~9명의
                      <br />
                      사회자 리스트를 받아보세요
                    </legend>
                    <div className="field">
                      <label htmlFor="f-name">성함</label>
                      <input
                        id="f-name"
                        className="in"
                        name="name"
                        autoComplete="name"
                        maxLength={80}
                        placeholder="홍길동"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-phone">연락처</label>
                      <input
                        id="f-phone"
                        className="in"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={18}
                        placeholder="010-0000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={agree}
                          onChange={(e) => setAgree(e.target.checked)}
                        />
                        개인정보 수집·이용에 동의합니다 (필수)
                      </label>
                      <details>
                        <summary>자세히</summary>수집 항목: 이름, 연락처, 예식
                        정보 · 이용 목적: 사회자 추천 및 사회자 연락 · 보관
                        기간: 상담 종료 후 1년
                      </details>
                    </div>
                  </fieldset>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="nav">
                  {step > 0 && (
                    <button
                      className="ghost"
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setError("");
                        setStep(step - 1);
                      }}
                    >
                      이전
                    </button>
                  )}
                  <button className="btn" type="submit" disabled={submitting}>
                    {submitting
                      ? "연결 중…"
                      : step === 2
                        ? "사회자 리스트 받기"
                        : "다음"}
                  </button>
                </div>
                <p className="trust">무료 · 비회원 · 30초면 끝나요</p>
              </form>
            </div>
          </div>
        </section>
      </main>
      <footer>© Freetiful · 프리티풀</footer>
    </div>
  );
}
