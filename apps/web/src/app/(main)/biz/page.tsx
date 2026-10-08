'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Shield, Briefcase, Download, MapPin, Phone, Mail,
  Clock, FileText, Send, X, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useT, useBizLang } from '@/lib/biz/i18n';
import LanguageToggle from '@/components/biz/LanguageToggle';
import { FadeUp } from '@/components/biz/biz-motion';
import { SmoothScroll, scrollToElement } from '@/components/biz/toss/scene';
import { BizFooter, BizNav, DockIndicator } from '@/components/biz/toss/TossChrome';
import SceneIntro from '@/components/biz/toss/SceneIntro';
import SceneMatch from '@/components/biz/toss/SceneMatch';
import SceneCareer from '@/components/biz/toss/SceneCareer';
import SceneDoor from '@/components/biz/toss/SceneDoor';
import SceneBook from '@/components/biz/toss/SceneBook';
import SceneEvents from '@/components/biz/toss/SceneEvents';
import SceneScale from '@/components/biz/toss/SceneScale';
import SceneClients from '@/components/biz/toss/SceneClients';
import SceneStage from '@/components/biz/toss/SceneStage';
import SceneMoments from '@/components/biz/toss/SceneMoments';

/*
 * 프리티풀 비즈(261008 사장 '토스 홈페이지 완전 똑같이 — 애니메이션 · 카드 · 폰트 · CSS') — 토스 홈을 장면마다 실측해(크기 · 글자 · 모서리 ·
 *  그림자 · 그라데이션 · 장면 길이 · 스크롤 연출) 우리 코드로 다시 짠 것. 토스의 코드 · CSS · 글꼴(Toss Product Sans) · 그림 · 영상은 쓰지 않았다 —
 *  글꼴은 Pretendard, 소재는 프리티풀 것(송년회 영상 · 행사 사진 · 앱 실제 캡처, 채팅은 가상 대화). 장면 = components/biz/toss/Scene*.tsx,
 *  문구 = toss/content.ts(4개 언어), 스크롤 엔진 = toss/scene.tsx(framer useScroll + Lenis).
 *  아래쪽 연혁 · 자료실 · 오시는길 · 문의 폼은 그대로. 섹션 id(회사소개 · 핵심서비스 · 연혁 · 자료실 · 오시는길 · 문의폼)는 iOS 네이티브 하단 네비(__freetifulBizScroll)가 쓴다.
 */

/* ─── Map (OpenStreetMap iframe, no API key needed) ──────── */
/** 지도 칸 — 외부 지도가 늦거나 막혀도(시간 초과 실측) 빈 상자가 되지 않게 뒤에 주소 카드를 깔고, 지도가 다 뜨면 그 위로 서서히 덮는다 */
function BizKakaoMap({ address, openLabel }: { address: string; openLabel: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full">
      <a
        href="https://www.openstreetmap.org/?mlat=37.56029&mlon=126.99376#map=17/37.56029/126.99376"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#3182F6] shadow-[0_2px_10px_rgba(0,0,0,0.06)]"><MapPin className="h-5 w-5" /></span>
        <span className="text-[16px] font-semibold leading-[1.5] text-[#333D4B]">{address}</span>
        <span className="text-[14px] font-medium text-[#3182F6]">{openLabel}</span>
      </a>
      <iframe
        title="프리티풀 오시는길"
        src="https://www.openstreetmap.org/export/embed.html?bbox=126.9863%2C37.5553%2C127.0013%2C37.5653&layer=mapnik&marker=37.56029%2C126.99376"
        className="absolute inset-0 h-full w-full border-0 transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0, pointerEvents: loaded ? 'auto' : 'none' }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

/* ─── 정보 줄(주소 · 전화 · 이메일 · 업무시간) — 복사 단추 ─────── */
function CopyableCard({ icon, label, value, copyable }: { icon: React.ReactNode; label: string; value: string; copyable: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-start gap-4 rounded-[20px] bg-[#F9FAFB] p-5 md:p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#3182F6]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#8B95A1]">{label}</p>
        {/* break-all 은 '충|무로관' · '휴|무)' 처럼 낱말 가운데서 끊었다 — 한국어는 keep-all(상속), 넘칠 때만 아무 데서나 */}
        <p lang={/[가-힣]/.test(value) ? 'ko' : undefined} className="mt-1 text-[16px] font-medium leading-[1.5] text-[#333D4B] [overflow-wrap:anywhere]">{value}</p>
      </div>
      {copyable && (
        <button
          onClick={handleCopy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[#B0B8C1] transition-colors hover:bg-white hover:text-[#3182F6]"
          title="복사"
          aria-label={`${label} 복사`}
        >
          {copied ? <Check className="h-4 w-4 text-[#03B26C]" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/* ─── Constants ───────────────────────────────────────────── */
const COMPANY_INFO = {
  name: '프리티풀',
  nameEn: 'Freetiful',
  ceo: '서나웅',
  established: '2024년',
  business: '프리랜서 진행자 매칭 플랫폼',
  experts: '1,000여 명',
  address: '서울시 중구 퇴계로36길 2, 충무로관 본관 130호',
  phone: '02-765-8882',
  email: 'freetiful2025@gmail.com',
  website: 'https://freetiful.com',
  blog: 'https://blog.naver.com/freetiful2025',
  instagram: 'freetiful_',
  youtube: 'https://www.youtube.com/@freetiful',
  tiktok: 'https://www.tiktok.com/@freetiful',
};

const NAV_SECTION_IDS = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의'] as const;

const NAV_SECTION_LABELS = {
  '회사소개':   { ko: '회사소개',   en: 'About',     ja: '会社紹介', zh: '公司简介' },
  '핵심서비스': { ko: '핵심서비스', en: 'Services',  ja: 'サービス', zh: '核心服务' },
  '연혁':       { ko: '연혁',       en: 'Milestones',ja: '沿革',     zh: '发展历程' },
  '자료실':     { ko: '자료실',     en: 'Resources', ja: '資料',     zh: '资料库' },
  '오시는길':   { ko: '오시는길',   en: 'Location',  ja: 'アクセス', zh: '地址' },
  '문의':       { ko: '문의',       en: 'Contact',   ja: 'お問合せ', zh: '联系' },
} as const;

const HISTORY_DATA = [
  { year: '2026', events: [
    { ko: '01월 프리티풀 브랜드 공식 론칭', en: 'Jan · Official brand launch',                ja: '1月 Freetiful ブランド公式ローンチ',      zh: '1月 Freetiful 品牌正式发布' },
    { ko: '01월 전문 행사인력 매칭 플랫폼 출시', en: 'Jan · Event talent matching platform launched', ja: '1月 プロイベント人材マッチングプラットフォーム開始', zh: '1月 专业活动人才匹配平台上线' },
    { ko: '02월 전문투자기관으로부터 Seed 투자 유치', en: 'Feb · Secured Seed investment from VC', ja: '2月 専門投資機関よりシード投資調達',      zh: '2月 从专业投资机构获得种子轮投资' },
    { ko: '02월 제휴업체 300여 곳과 전략적 파트너십 체결', en: 'Feb · Strategic partnerships with 300+ affiliates', ja: '2月 提携先 300 社と戦略的パートナーシップ締結', zh: '2月 与 300 余家合作伙伴建立战略合作' },
    { ko: '03월 벤처기업 인증 획득',          en: 'Mar · Certified as Venture Company',     ja: '3月 ベンチャー企業認証取得',               zh: '3月 获得风险企业认证' },
    { ko: '03월 프리티풀 정식 서비스 운영 개시', en: 'Mar · Official service operation begins', ja: '3月 Freetiful 正式サービス運営開始',     zh: '3月 Freetiful 正式运营' },
    { ko: '05월 신용보증기금 성장지원 기업 선정', en: 'May · Selected for KODIT growth support program', ja: '5月 信用保証基金の成長支援企業に選定', zh: '5月 入选信用保证基金成长支持企业' },
    { ko: '06월 빌라드지디 웨딩홀 & 한국웨딩협회 제휴 체결', en: 'Jun · Partnership with Villa de GD Wedding Hall & Korea Wedding Association', ja: '6月 ヴィラ・ド・ジディ ウェディングホール&韓国ウェディング協会と提携', zh: '6月 与Villa de GD婚礼会馆和韩国婚礼协会签署合作' },
  ]},
  { year: '2025', events: [
    { ko: '12월 주식회사 커넥트풀 설립', en: 'Dec · Connectful Inc. founded', ja: '12月 株式会社 Connectful 設立', zh: '12月 Connectful 株式会社成立' },
  ]},
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const t = useT();
  const { lang } = useBizLang();
  const htmlLang = lang === 'zh' ? 'zh-CN' : lang;
  const router = useRouter();
  const [inquiry, setInquiry] = useState({ company: '', name: '', phone: '', email: '', type: '', message: '' });
  const [inquiryFile, setInquiryFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [bizNavExpanding, setBizNavExpanding] = useState(false);
  const [bizNavCollapsing, setBizNavCollapsing] = useState(false);
  const [inquiryBubbleHidden, setInquiryBubbleHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /** 메뉴 칸은 닫힐 때 0.15s 서서히 사라진 뒤 내린다 */
  const [menuMounted, setMenuMounted] = useState(false);
  /** 메뉴 머리줄 — 머리줄 로고 · 햄버거 자리를 그대로 따라 그린다(햄버거가 × 로 바뀐 것처럼) */
  const [menuGeo, setMenuGeo] = useState({ logoL: 20, logoT: 16, logoH: 24, xR: 8, xT: 7, headH: 56 });
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  /** 자료실 파일 중 서버에 없는 것(404) — 깨진 미리보기 · HTML 404 를 내려받는 대신 목록에서 뺀다(파일이 돌아오면 다시 보인다) */
  const [missingFiles, setMissingFiles] = useState<string[]>([]);

  // 문서 언어 — 일본어 · 중국어 글꼴(한자 글자꼴)과 줄바꿈 규칙(:lang)이 이걸 본다. 비즈를 떠나면 원래대로
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.lang;
    el.lang = htmlLang;
    return () => { el.lang = prev; };
  }, [htmlLang]);

  // 메뉴 · 파일 미리보기가 떠 있는 동안 뒤 페이지 잠금(휠 = Lenis 멈춤, 터치 = 문서 overflow + touchmove 막기) + Esc 로 닫기
  const overlayOpen = mobileMenuOpen || !!previewFile;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sbw > 0) html.style.paddingRight = `${sbw}px`;
    window.__bizLenis?.stop();
    const onTouchMove = (e: TouchEvent) => {
      const box = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-scroll-inside]') : null;
      if (box && box.scrollHeight > box.clientHeight + 1) return; // 미리보기 안쪽처럼 실제로 스크롤되는 칸은 그대로
      if (e.cancelable) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPreviewFile(null);
      setMobileMenuOpen(false);
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
      window.__bizLenis?.start();
    };
  }, [overlayOpen]);

  // 메뉴 열기 · 닫기(닫힘은 0.15s 페이드 뒤 내림)
  useEffect(() => {
    if (mobileMenuOpen) {
      const logo = document.querySelector('.tc-logo img')?.getBoundingClientRect();
      const burger = document.querySelector('.tc-burger')?.getBoundingClientRect();
      const head = document.querySelector('.tc-nav')?.getBoundingClientRect();
      if (logo && burger && head && burger.width > 0 && burger.top >= 0) {
        setMenuGeo({ logoL: logo.left, logoT: logo.top, logoH: logo.height, xR: window.innerWidth - burger.right, xT: burger.top, headH: head.bottom });
      }
      setMenuMounted(true);
      return undefined;
    }
    const tm = window.setTimeout(() => setMenuMounted(false), 160);
    return () => window.clearTimeout(tm);
  }, [mobileMenuOpen]);

  // 열린 창의 닫기 단추로 초점(키보드 · 화면 읽기 프로그램)
  useEffect(() => {
    if (menuMounted && mobileMenuOpen) menuCloseRef.current?.focus({ preventScroll: true });
  }, [menuMounted, mobileMenuOpen]);
  useEffect(() => {
    if (previewFile) previewCloseRef.current?.focus({ preventScroll: true });
  }, [previewFile]);

  // 자료실 파일 확인 — 첫 화면을 다 그린 뒤에
  useEffect(() => {
    let alive = true;
    const tm = window.setTimeout(() => {
      Promise.all(['/images/CI.svg', '/images/freetiful_bi.pdf'].map((f) =>
        fetch(f, { method: 'HEAD' }).then((r) => (r.ok && !(r.headers.get('content-type') || '').includes('text/html') ? null : f)).catch(() => null),
      )).then((r) => { if (alive) setMissingFiles(r.filter((x): x is string => !!x)); });
    }, 2500);
    return () => { alive = false; window.clearTimeout(tm); };
  }, []);


  // 플랫폼에서 비즈로 왔을 때 펼쳐지는 애니메이션
  useEffect(() => {
    const from = sessionStorage.getItem('nav-transition');
    if (from === 'from-platform') {
      setBizNavExpanding(true);
      sessionStorage.removeItem('nav-transition');
      const timer = setTimeout(() => setBizNavExpanding(false), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // Lenis 부드러운 스크롤과 섞이지 않게 scrollToElement(머리줄 64 만큼 위 여백)
    scrollToElement(el, id === '문의폼' ? -20 : 0);
  }
  /** 메뉴를 닫고(뒤 페이지 잠금이 풀린 다음) 섹션으로 — 잠긴 동안엔 Lenis 가 scrollTo 를 무시한다 */
  function closeMenuThenScroll(id: string) {
    setMobileMenuOpen(false);
    window.setTimeout(() => scrollTo(id), 60);
  }

  // 네이티브(iOS) 비즈 하단 네비 → 섹션 스크롤 브리지
  useEffect(() => {
    (window as unknown as { __freetifulBizScroll?: (id: string) => void }).__freetifulBizScroll = (id: string) => {
      try { scrollTo(id); } catch { /* noop */ }
    };
    return () => { try { delete (window as unknown as { __freetifulBizScroll?: unknown }).__freetifulBizScroll; } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiry.name || !inquiry.phone || !inquiry.message) {
      toast.error(t({ ko: '필수 항목을 입력해주세요', en: 'Please fill in the required fields', ja: '必須項目を入力してください', zh: '请填写必填项' }));
      return;
    }
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('company', inquiry.company);
      formData.append('name', inquiry.name);
      formData.append('phone', inquiry.phone);
      formData.append('email', inquiry.email);
      formData.append('type', inquiry.type);
      formData.append('message', inquiry.message);
      if (inquiryFile) formData.append('file', inquiryFile);

      const res = await fetch('/api/inquiry', { method: 'POST', body: formData });
      if (res.ok) {
        setInquiry({ company: '', name: '', phone: '', email: '', type: '', message: '' });
        setInquiryFile(null);
        router.push('/biz/complete');
        return;
      } else {
        const data = await res.json();
        toast.error(data.error || t({ ko: '문의 접수에 실패했습니다', en: 'Failed to submit inquiry', ja: 'お問合せの送信に失敗しました', zh: '咨询提交失败' }));
      }
    } catch {
      toast.error(t({ ko: '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.', en: 'Failed to submit inquiry. Please try again shortly.', ja: 'お問合せの送信に失敗しました。しばらくしてから再度お試しください。', zh: '咨询提交失败，请稍后再试。' }));
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'h-14 w-full rounded-[14px] border border-transparent bg-[#F2F4F6] px-4 text-[16px] text-[#191F28] outline-none transition-all placeholder-[#B0B8C1] focus:border-[#3182F6] focus:bg-white focus:ring-4 focus:ring-[#3182F6]/10';
  const eyebrowCls = 'text-[15px] font-semibold text-[#3182F6] md:text-[17px]';
  const h2Cls = 'text-[32px] font-bold leading-[1.32] tracking-[-0.035em] text-[#191F28] md:text-[56px]';
  const leadCls = 'break-keep text-[17px] leading-[1.7] text-[#4E5968] md:text-[20px]';

  return (
    // overflow-x: clip — hidden 이면 이 칸이 스크롤 칸이 돼 앱 기능 칸의 따라오는 폰(sticky)이 멈추지 않는다
    <div lang={htmlLang} className="biz-root relative min-h-screen overflow-x-clip bg-white text-[#191F28]">

      <SmoothScroll />
      <BizNav
        items={NAV_SECTION_IDS.filter((n) => n !== '문의').map((n) => ({ id: n, label: t(NAV_SECTION_LABELS[n]) }))}
        onNavigate={(id) => (id === '__menu__' ? setMobileMenuOpen((v) => !v) : scrollTo(id))}
        ctaLabel={t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
        onCta={() => scrollTo('문의폼')}
        // 1024 아래(햄버거가 보이는 폭)에서는 언어 선택이 메뉴 안 아래쪽으로 간다(토스 모바일과 같은 자리)
        right={<div className="hidden lg:block"><LanguageToggle tone="inherit" /></div>}
      />
      <DockIndicator />

      {/* ═══ 모바일 메뉴(토스 seg9 어법: 화면 전체 젖빛 유리 + 줄이 위에서 차례로 흐림→선명) ═══ */}
      {menuMounted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t({ ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单' })}
          data-lenis-prevent
          data-state={mobileMenuOpen ? 'open' : 'closed'}
          className="biz-menu fixed inset-0 z-[60] lg:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-prettyful.svg" alt="" aria-hidden className="pointer-events-none absolute" style={{ left: menuGeo.logoL, top: menuGeo.logoT, height: menuGeo.logoH }} />
          <button
            ref={menuCloseRef}
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-[#333840]"
            style={{ right: menuGeo.xR, top: menuGeo.xT }}
            aria-label={t({ ko: '메뉴 닫기', en: 'Close menu', ja: 'メニューを閉じる', zh: '关闭菜单' })}
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
              <path d="M5.5 5.5l15 15M20.5 5.5l-15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <ul className="biz-menu-list" style={{ paddingTop: menuGeo.headH + 28 }}>
            {[
              { label: t({ ko: 'CEO 인사말', en: "CEO's Message", ja: 'CEO 挨拶', zh: 'CEO 致辞' }), href: '/biz/ceo' },
              { label: t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' }), href: '/biz/history' },
              { label: t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' }), href: '/careers' },
              { label: t({ ko: '주요소식', en: 'News', ja: 'お知らせ', zh: '主要消息' }), action: () => closeMenuThenScroll('자료실') },
              { label: t({ ko: '자주묻는질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' }), href: '/biz/faq' },
              { label: t({ ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' }), href: '/biz/clients' },
            ].map((item, i) => (
              <li key={item.label} className="biz-menu-row" style={{ ['--i' as string]: i }}>
                {item.href ? (
                  <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>{item.label}</Link>
                ) : (
                  <button type="button" onClick={item.action}>{item.label}</button>
                )}
              </li>
            ))}
          </ul>
          <div className="biz-menu-foot">
            <div className="text-[#333840]"><LanguageToggle tone="inherit" placement="up" /></div>
            <button type="button" className="biz-menu-cta" onClick={() => closeMenuThenScroll('문의폼')}>
              {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
            </button>
          </div>
        </div>
      )}

      {/* ═══ 토스식 장면들 ═══════════════════════════════════ */}
      <div id="회사소개"><SceneIntro /></div>
      <div id="핵심서비스"><SceneMatch /></div>
      <SceneCareer />
      <SceneDoor />
      <SceneBook />
      <SceneEvents />
      <SceneScale />
      <SceneClients />
      <SceneStage />
      <SceneMoments />

      {/* ═══ 연혁 ═══════════════════════════════════════════════ */}
      <section id="연혁" className="bg-white py-[120px] md:py-[180px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>MILESTONES</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '성장의 발자취', en: 'Our Growth Journey', ja: '成長の足跡', zh: '成长足迹' })}</h2>
          </FadeUp>

          <div className="mt-14 md:mt-20">
            {HISTORY_DATA.map((h) => (
              <div key={h.year} className="grid gap-6 border-t border-[#E5E8EB] py-12 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10 md:py-16">
                <FadeUp>
                  <p className="text-[52px] font-bold leading-none tracking-[-0.04em] text-[#3182F6] tabular-nums md:sticky md:top-28 md:text-[72px]">{h.year}</p>
                </FadeUp>
                <ul className="space-y-5 md:space-y-6">
                  {h.events.map((event, i) => (
                    <FadeUp key={i} delay={Math.min(i, 6) * 60}>
                      <li className="flex gap-4">
                        <span className="mt-[11px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#C4CAD1] md:mt-[13px]" />
                        <span className="break-keep text-[17px] font-medium leading-[1.6] text-[#333D4B] md:text-[20px]">{t(event)}</span>
                      </li>
                    </FadeUp>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 로드맵 */}
          <FadeUp className="mt-20 md:mt-28">
            <p className={eyebrowCls}>ROADMAP</p>
          </FadeUp>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { phase: '01', title: t({ ko: '사회자 매칭 플랫폼 고도화', en: 'Matching Platform Upgrade', ja: 'マッチングプラットフォーム高度化', zh: '专家匹配平台升级' }), desc: t({ ko: 'AI 매칭 정확도 향상, 사회자 카테고리 확장', en: 'Improve AI matching accuracy and expand expert categories', ja: 'AIマッチング精度向上、専門家カテゴリー拡大', zh: '提高AI匹配准确度，扩展专家类别' }) },
              { phase: '02', title: t({ ko: '전국 서비스 확대', en: 'Nationwide Service Expansion', ja: '全国サービス拡大', zh: '全国服务扩展' }), desc: t({ ko: '수도권 중심에서 전국 서비스 커버리지 확장', en: 'Expand coverage from capital region to nationwide', ja: '首都圏中心から全国サービスへ拡大', zh: '从首都圈扩展至全国服务覆盖' }) },
              { phase: '03', title: t({ ko: '종합 행사 솔루션', en: 'Total Event Solution', ja: '総合イベントソリューション', zh: '综合活动解决方案' }), desc: t({ ko: '기획·공간·사회자·장비까지 원스톱 행사 플랫폼으로 진화', en: 'Evolve into a one-stop event platform covering planning, venues, experts, and equipment', ja: '企画・会場・専門家・機材まで、ワンストップイベントプラットフォームへ進化', zh: '发展为涵盖策划、场地、专家、设备的一站式活动平台' }) },
            ].map((p, i) => (
              <FadeUp key={p.phase} delay={i * 100}>
                <div className="h-full rounded-[28px] bg-[#F9FAFB] p-7 md:p-9">
                  <span className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[#D1D6DB] tabular-nums md:text-[44px]">{p.phase}</span>
                  <h3 className="mt-6 break-keep text-[20px] font-bold tracking-[-0.02em] text-[#191F28] md:text-[22px]">{p.title}</h3>
                  <p className="mt-2 break-keep text-[15px] leading-[1.65] text-[#6B7684] md:text-[16px]">{p.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 자료실 ═══════════════════════════════════════════ */}
      <section id="자료실" className="bg-[#F9FAFB] py-[120px] md:py-[160px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>RESOURCES</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '자료실', en: 'Resources', ja: '資料室', zh: '资料库' })}</h2>
          </FadeUp>

          <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-2 md:gap-4">
            {[
              { icon: <Download className="h-5 w-5" />, title: 'CI', desc: 'SVG', file: '/images/CI.svg' },
              { icon: <Download className="h-5 w-5" />, title: t({ ko: 'BI 가이드라인', en: 'BI Guideline', ja: 'BI ガイドライン', zh: 'BI 指南' }), desc: 'PDF', file: '/images/freetiful_bi.pdf' },
              { icon: <FileText className="h-5 w-5" />, title: t({ ko: '서비스 이용가이드', en: 'Service Guide', ja: 'サービス利用ガイド', zh: '服务使用指南' }), desc: t({ ko: '웹 가이드', en: 'Web Guide', ja: 'Webガイド', zh: '网页指南' }), file: '#핵심서비스' },
              { icon: <Briefcase className="h-5 w-5" />, title: t({ ko: '파트너 제안서', en: 'Partner Proposal', ja: 'パートナー提案書', zh: '合作伙伴提案' }), desc: t({ ko: '제휴 안내', en: 'Partnership', ja: '提携案内', zh: '合作指南' }), file: '#문의폼' },
              { icon: <Shield className="h-5 w-5" />, title: t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' }), desc: '', file: 'privacy' },
            ].filter((item) => !missingFiles.includes(item.file)).map((item, i) => (
              <FadeUp key={item.file} delay={i * 70}>
                <button
                  onClick={() => {
                    if (item.file === 'privacy') { router.push('/terms/privacy'); return; }
                    if (item.file.startsWith('#')) {
                      // 네이티브 smooth 는 Lenis 와 섞여 끊긴다 — 페이지 도우미로(문의폼 -20 여백 포함)
                      scrollTo(item.file.slice(1));
                      return;
                    }
                    setPreviewFile(item.file);
                  }}
                  className="group flex w-full items-center gap-4 rounded-[20px] bg-white p-5 text-left transition-colors hover:bg-white/70 md:p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#E8F3FF] text-[#3182F6]">{item.icon}</div>
                  <p className="flex-1 text-[17px] font-semibold text-[#191F28]">{item.title}</p>
                  {item.desc && <span className="text-[13px] font-medium text-[#8B95A1]">{item.desc}</span>}
                  <ChevronRight className="h-5 w-5 text-[#C4CAD1] transition-transform group-hover:translate-x-1" />
                </button>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 오시는길 ═══════════════════════════════════════════ */}
      <section id="오시는길" className="bg-white py-[120px] md:py-[160px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>LOCATION</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '오시는길', en: 'How to Find Us', ja: 'アクセス', zh: '地理位置' })}</h2>
          </FadeUp>

          <FadeUp delay={100} className="mt-12 md:mt-16">
            <div className="h-[300px] w-full overflow-hidden rounded-[28px] bg-[#F2F4F6] md:h-[420px]">
              <BizKakaoMap address={COMPANY_INFO.address} openLabel={t({ ko: '지도에서 보기', en: 'Open in map', ja: '地図で見る', zh: '在地图中查看' })} />
            </div>
          </FadeUp>

          <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
            {[
              { icon: <MapPin className="h-5 w-5" />, label: t({ ko: '주소', en: 'Address', ja: '住所', zh: '地址' }), value: COMPANY_INFO.address, copyable: true },
              { icon: <Phone className="h-5 w-5" />, label: t({ ko: '대표전화', en: 'Phone', ja: '代表電話', zh: '代表电话' }), value: COMPANY_INFO.phone, copyable: true },
              { icon: <Mail className="h-5 w-5" />, label: t({ ko: '이메일', en: 'Email', ja: 'メール', zh: '邮箱' }), value: COMPANY_INFO.email, copyable: true },
              { icon: <Clock className="h-5 w-5" />, label: t({ ko: '업무시간', en: 'Business Hours', ja: '営業時間', zh: '营业时间' }), value: t({ ko: '평일 09:00 - 18:00 (주말/공휴일 휴무)', en: 'Weekdays 09:00 - 18:00 (Closed weekends/holidays)', ja: '平日 09:00 - 18:00（週末・祝日休み）', zh: '工作日 09:00 - 18:00（周末及节假日休息）' }), copyable: false },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 70}>
                <CopyableCard icon={item.icon} label={item.label} value={item.value} copyable={item.copyable} />
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={150}>
            <div className="mt-4 rounded-[20px] bg-[#F9FAFB] p-6">
              <p className="mb-4 text-[13px] font-semibold text-[#8B95A1]">{t({ ko: '교통편 안내', en: 'GETTING HERE', ja: '交通案内', zh: '交通指南' })}</p>
              <div className="space-y-3 text-[15px] text-[#4E5968] md:text-[16px]">
                <p><span className="font-bold text-[#3182F6]">{t({ ko: '지하철', en: 'Subway', ja: '地下鉄', zh: '地铁' })}</span> — {t({ ko: '1호선·3호선·5호선 종로3가역 도보 5분', en: '5-min walk from Jongno 3-ga Station (Lines 1·3·5)', ja: '1号線・3号線・5号線 鍾路3街駅 徒歩5分', zh: '1号线·3号线·5号线 钟路3街站步行5分钟' })}</p>
                <p><span className="font-bold text-[#03B26C]">{t({ ko: '버스', en: 'Bus', ja: 'バス', zh: '公交' })}</span> — {t({ ko: '종로6가 정류장 하차', en: 'Get off at Jongno 6-ga stop', ja: '鍾路6街バス停下車', zh: '钟路6街站下车' })}</p>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══ 문의 폼 ═══════════════════════════════════════════ */}
      <section id="문의폼" className="bg-white py-[120px] md:py-[160px]">
        <div id="문의" className="mx-auto max-w-[640px] px-6">
          <FadeUp className="text-center">
            <p className={eyebrowCls}>INQUIRY FORM</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '기업 문의', en: 'Business Inquiry', ja: '法人お問合せ', zh: '企业咨询' })}</h2>
          </FadeUp>

          <FadeUp delay={120}>
            {/* noValidate — 브라우저 기본 말풍선(브라우저 언어) 대신 handleInquiry 의 4개 언어 안내가 뜨게 */}
            <form onSubmit={handleInquiry} noValidate className="mt-12 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder={t({ ko: '회사명', en: 'Company', ja: '会社名', zh: '公司名称' })} value={inquiry.company} onChange={(e) => setInquiry({ ...inquiry, company: e.target.value })} />
                <input className={inputCls} placeholder={t({ ko: '담당자명 *', en: 'Contact Name *', ja: '担当者名 *', zh: '联系人 *' })} value={inquiry.name} onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder={t({ ko: '연락처 *', en: 'Phone *', ja: '連絡先 *', zh: '联系电话 *' })} value={inquiry.phone} onChange={(e) => setInquiry({ ...inquiry, phone: e.target.value })} required />
                <input className={inputCls} placeholder={t({ ko: '이메일', en: 'Email', ja: 'メール', zh: '邮箱' })} value={inquiry.email} onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })} />
              </div>
              <select
                value={inquiry.type}
                onChange={(e) => setInquiry({ ...inquiry, type: e.target.value })}
                className={`${inputCls} ${inquiry.type ? '' : 'text-[#B0B8C1]'}`}
              >
                <option value="">{t({ ko: '문의유형 선택', en: 'Select inquiry type', ja: 'お問合せ種別を選択', zh: '选择咨询类型' })}</option>
                <option value="wedding">{t({ ko: '결혼식 사회자 섭외', en: 'Wedding MC Booking', ja: '結婚式司会者の依頼', zh: '婚礼主持人预约' })}</option>
                <option value="enterprise">{t({ ko: '기업행사 / 공식행사', en: 'Corporate / Official Event', ja: '企業イベント / 公式行事', zh: '企业活动 / 官方活动' })}</option>
                <option value="festival">{t({ ko: '축제 / 체육대회', en: 'Festival / Sports Event', ja: 'フェスティバル / 体育大会', zh: '节庆 / 体育赛事' })}</option>
                <option value="broadcast">{t({ ko: '방송 / 라이브커머스', en: 'Broadcast / Live Commerce', ja: '放送 / ライブコマース', zh: '广播 / 直播电商' })}</option>
                <option value="partnership">{t({ ko: '제휴 / 파트너십', en: 'Partnership', ja: '提携 / パートナーシップ', zh: '合作 / 合作伙伴' })}</option>
                <option value="other">{t({ ko: '기타', en: 'Other', ja: 'その他', zh: '其他' })}</option>
              </select>
              <textarea className={`${inputCls} h-36 resize-none py-4`} placeholder={t({ ko: '문의 내용 *', en: 'Message *', ja: 'お問合せ内容 *', zh: '咨询内容 *' })} value={inquiry.message} onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })} required />
              {/* 파일 첨부 */}
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-[12px] bg-[#F2F4F6] px-4 py-3 text-[15px] font-medium text-[#4E5968] transition-colors hover:bg-[#E5E8EB]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                  {t({ ko: '파일 첨부', en: 'Attach File', ja: 'ファイル添付', zh: '附件' })}
                  <input type="file" className="hidden" onChange={(e) => setInquiryFile(e.target.files?.[0] || null)} />
                </label>
                {inquiryFile && (
                  <div className="flex items-center gap-2 rounded-[10px] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#4E5968]">
                    <span className="max-w-[200px] truncate">{inquiryFile.name}</span>
                    <button type="button" onClick={() => setInquiryFile(null)} className="text-[#B0B8C1] hover:text-[#F04452]" aria-label="첨부 지우기">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={sending}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] active:scale-[0.99] disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {sending ? t({ ko: '전송 중...', en: 'Sending...', ja: '送信中...', zh: '发送中...' }) : t({ ko: '문의하기', en: 'Submit', ja: 'お問合せ', zh: '提交' })}
              </button>
              <p className="pt-1 text-center text-[13px] text-[#8B95A1]">{t({
                ko: '문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다',
                en: 'We will get back to you within 1-2 business days',
                ja: 'お問合せ後、営業日 1~2 日以内に担当者よりご連絡いたします',
                zh: '收到咨询后，我们将在 1-2 个工作日内回复您。',
              })}</p>
            </form>
          </FadeUp>
        </div>
      </section>

      <BizFooter
        links={[
          { label: t({ ko: 'CEO 인사말', en: "CEO's Message", ja: 'CEO 挨拶', zh: 'CEO 致辞' }), href: '/biz/ceo' },
          { label: t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' }), href: '/biz/history' },
          { label: t({ ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' }), href: '/biz/clients' },
          { label: t({ ko: '자주묻는질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' }), href: '/biz/faq' },
          { label: t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' }), href: '/careers' },
          { label: t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' }), href: '/terms/privacy' },
          { label: t({ ko: '블로그', en: 'Blog', ja: 'ブログ', zh: '博客' }), href: COMPANY_INFO.blog, external: true },
          { label: 'Instagram', href: `https://instagram.com/${COMPANY_INFO.instagram}`, external: true },
          { label: 'YouTube', href: COMPANY_INFO.youtube, external: true },
          { label: 'TikTok', href: COMPANY_INFO.tiktok, external: true },
          { label: t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' }), href: '/main' },
        ]}
        company={[
          `${t({ ko: COMPANY_INFO.name, en: COMPANY_INFO.nameEn, ja: COMPANY_INFO.nameEn, zh: COMPANY_INFO.nameEn })} | ${t({ ko: '대표', en: 'CEO', ja: '代表', zh: '代表' })} ${COMPANY_INFO.ceo}`,
          `T ${COMPANY_INFO.phone} | E ${COMPANY_INFO.email}`,
          COMPANY_INFO.address,
          'Copyright © Freetiful Inc. All rights reserved.',
        ]}
      />

      {/* ═══ 모바일 바텀 네비게이션 ═══════════════════════════ */}
      <nav
        data-native-biz-nav
        className="pb-safe fixed bottom-0 left-0 right-0 z-50 px-4 md:hidden"
      >
        <div className="mx-auto mb-2 max-w-lg" style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            className="border border-gray-100/60 bg-white/90 shadow-[0_-4px_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-all duration-500"
            style={{
              width: bizNavCollapsing ? 60 : '100%',
              maxWidth: bizNavCollapsing ? 60 : 512,
              height: 60,
              borderRadius: 9999,
              // 접힘 애니메이션 때만 클립 — 평소엔 visible 라야 문의 버튼 위 말풍선이 안 잘림
              overflow: bizNavCollapsing ? 'hidden' : 'visible',
              transition: bizNavCollapsing
                ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'none',
              ...(bizNavExpanding ? { animation: 'bizPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
            }}
          >
            <div className="flex h-full items-center px-2">
              {/* 홈 이동 버튼 */}
              <button
                onClick={() => {
                  sessionStorage.setItem('nav-transition', 'from-biz');
                  setBizNavCollapsing(true);
                  setTimeout(() => router.push('/main'), 500);
                }}
                className={`-ml-1 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full transition-all duration-500 active:scale-90 ${bizNavCollapsing ? 'bg-transparent text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                aria-label={t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* 네비 아이템들 */}
              <div className="flex flex-1 items-center justify-around">
                {[
                  { id: '회사소개', iconSrc: '/images/company-intro.svg', label: t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' }) },
                  { id: '핵심서비스', iconSrc: '/images/service.svg', label: t({ ko: '서비스', en: 'Services', ja: 'サービス', zh: '服务' }) },
                  { id: '자료실', iconSrc: '/images/resources.svg', label: t({ ko: '자료실', en: 'Resources', ja: '資料', zh: '资料' }) },
                  { id: '문의', iconSrc: '/images/inquiry.svg', label: t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系咨询' }) },
                ].map((item, idx) => {
                  const isInquiry = item.id === '문의';
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        scrollTo(isInquiry ? '문의폼' : item.id);
                        if (isInquiry) setInquiryBubbleHidden(true);
                      }}
                      className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all active:scale-90 ${isInquiry ? '' : 'text-gray-400 hover:text-gray-700'}`}
                      style={{
                        opacity: bizNavCollapsing ? 0 : 1,
                        transform: bizNavCollapsing ? 'scale(0.5)' : (bizNavExpanding ? undefined : 'scale(1)'),
                        filter: bizNavCollapsing ? 'blur(4px)' : 'blur(0px)',
                        transition: bizNavCollapsing
                          ? `opacity 0.25s ease ${idx * 0.03}s, transform 0.25s ease ${idx * 0.03}s, filter 0.25s ease ${idx * 0.03}s`
                          : 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease',
                        ...(bizNavExpanding ? { animation: `bizIconAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.25 + idx * 0.08}s both` } : {}),
                      }}
                    >
                      {isInquiry ? (
                        <div
                          className="relative h-5 w-5"
                          style={{
                            WebkitMask: `url(${item.iconSrc}) no-repeat center / contain`,
                            mask: `url(${item.iconSrc}) no-repeat center / contain`,
                            background: 'linear-gradient(90deg, #0052B5, #111111, #0052B5)',
                            backgroundSize: '200% 100%',
                            animation: 'iconGradientShift 2s linear infinite',
                          }}
                        />
                      ) : (
                        <Image src={item.iconSrc} alt={item.label} width={20} height={20} className="opacity-60" />
                      )}
                      <span
                        className="whitespace-nowrap text-[9px] font-medium"
                        style={isInquiry ? {
                          background: 'linear-gradient(90deg, #0052B5, #111111, #0052B5)',
                          backgroundSize: '200% 100%',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          animation: 'textGradientShift 2s linear infinite',
                          fontWeight: 700,
                        } : {}}
                      >
                        {item.label}
                      </span>
                      {/* 문의하기 말풍선 — 문의 버튼 위. 칸 폭 = 단추 폭이고 말풍선은 오른쪽 끝을 단추에 맞춰 왼쪽으로 자란다
                          (가운데 정렬이면 화면 오른쪽 끝을 넘어 테두리 · 그림자가 잘렸다 — 375 에서 1px, 320 에서 8px). 꼬리는 단추 가운데 */}
                      {isInquiry && !inquiryBubbleHidden && !bizNavCollapsing && (
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-end whitespace-nowrap"
                          style={{
                            animation: 'bubbleBoingOnce 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both, bubbleFloat 2.8s ease-in-out 1.5s infinite',
                            zIndex: 51,
                          }}
                        >
                          <div className="rounded-full border border-gray-100 bg-white px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                            <span
                              className="text-[11px] font-bold"
                              style={{
                                background: 'linear-gradient(90deg, #111111, #0052B5, #111111)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                animation: 'textGradientShift 2.5s ease-in-out infinite',
                              }}
                            >
                              {t({ ko: '문의하기', en: 'Contact us', ja: 'お問合せ', zh: '联系我们' })}
                            </span>
                          </div>
                          <div className="absolute -bottom-[4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-gray-100 bg-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Biz nav transition keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bizPillExpand {
          0% { width: 60px; max-width: 60px; filter: blur(0px); }
          15% { filter: blur(3px); }
          50% { filter: blur(1px); }
          70% { width: 105%; max-width: 530px; filter: blur(0px); }
          100% { width: 100%; max-width: 512px; filter: blur(0px); }
        }
        @keyframes bizIconAppear {
          0% { opacity: 0; transform: scale(0.3) translateY(4px); filter: blur(4px); }
          60% { opacity: 1; transform: scale(1.1) translateY(-1px); filter: blur(0px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes bubbleBoingOnce {
          0% { transform: scale(0) translateY(6px); opacity: 0; }
          50% { transform: scale(1.15) translateY(-2px); opacity: 1; }
          70% { transform: scale(0.95) translateY(0); }
          85% { transform: scale(1.05) translateY(-1px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes textGradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes iconGradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        /* framer useScroll 의 스크롤 칸(<html>)이 static 이면 개발 모드 경고 — 계산은 같다(offsetParent 는 body 에서 끝남) */
        html { position: relative; }
        /* 일본어 · 중국어 — 띄어쓰기가 없어 keep-all(전역 body · break-keep)이면 줄바꿈 기회가 0 이 돼 칸 밖으로 넘쳤다.
           글자 단위 줄바꿈 + 금칙(strict: ょ · ー · 。 등이 줄 머리에 안 옴). overflow-wrap:anywhere(첫 화면 말풍선)도 여기선 break-word 로 */
        .biz-root:lang(ja), .biz-root:lang(zh) { word-break: normal; line-break: strict; overflow-wrap: break-word; }
        .biz-root:lang(ja) *, .biz-root:lang(zh) * { word-break: normal !important; line-break: strict; overflow-wrap: break-word !important; }
        /* 일본어는 문절 단위로(Chrome 119+ auto-phrase — '以|上' · '進|行' 처럼 낱말 가운데서 안 끊음). 모르는 브라우저는 위 normal 그대로 */
        .biz-root:lang(ja), .biz-root:lang(ja) * { word-break: auto-phrase !important; }
        /* 언어별 한자 글자꼴 한 벌로(예전엔 한 낱말 안에 Apple SD Gothic Neo · PingFang SC 가 섞였다) — 라틴 · 가나는 Pretendard */
        .biz-root:lang(ja) { font-family: Pretendard, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif; }
        .biz-root:lang(zh) { font-family: Pretendard, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif; }
        /* 일 · 중 화면 안의 한국어(주소 · 대표 이름 · 통역 데모 원문)는 lang="ko" — 글자 단위로 끊지 않고 낱말 단위(keep-all)로 */
        .biz-root [lang="ko"], .biz-root [lang="ko"] * { word-break: keep-all !important; line-break: auto; }
        /* 모바일 메뉴 — 토스 seg9 실측: 화면 전체 rgba(255,255,255,.89)+blur(30) 0.2s ease-out, 줄 56 높이 · 간격 59.5 · 24px/600 #333840,
           줄마다 위에서(-20px) 흐림 10px → 선명, 0.25s, 100ms 간격 */
        .biz-menu { background: rgba(255,255,255,.89); -webkit-backdrop-filter: blur(30px); backdrop-filter: blur(30px); overflow-y: auto; overscroll-behavior: contain; animation: bizMenuIn .2s ease-out both; transition: opacity .15s ease-in; }
        .biz-menu[data-state="closed"] { opacity: 0; pointer-events: none; }
        .biz-menu-list { margin: 0; padding: 0 0 120px; list-style: none; }
        .biz-menu-row { height: 56px; margin-bottom: 3.5px; animation: bizMenuRow .25s ease-out both; animation-delay: calc(80ms + var(--i) * 100ms); }
        .biz-menu-row > a, .biz-menu-row > button { display: flex; align-items: center; width: 100%; height: 100%; padding: 0 20px; border: 0; background: none; text-align: left; font-family: inherit; font-size: 24px; font-weight: 600; line-height: 1.4; letter-spacing: -0.02em; color: #333840; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: opacity .15s ease; }
        .biz-menu-row > a:active, .biz-menu-row > button:active { opacity: .5; }
        .biz-menu-foot { position: fixed; left: 20px; right: 20px; bottom: calc(28px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: flex-start; gap: 14px; animation: bizMenuRow .25s ease-out both; animation-delay: 300ms; }
        .biz-menu-foot > div { margin-left: -12px; }
        .biz-menu-cta { height: 46px; padding: 0 22px; border: 1px solid rgba(2,32,71,.05); border-radius: 999px; background: rgba(242,244,246,.9); color: #333840; font-family: inherit; font-size: 14px; font-weight: 600; letter-spacing: -0.02em; cursor: pointer; transition: transform .12s ease, background-color .15s ease; }
        .biz-menu-cta:active { transform: scale(.97); }
        @keyframes bizMenuIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bizMenuRow { from { opacity: 0; transform: translateY(-20px); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
        @media (prefers-reduced-motion: reduce) {
          .biz-menu, .biz-menu-row, .biz-menu-foot { animation: none; }
        }
      `}} />

      {/* ═══ 파일 미리보기 모달 ═══════════════════════════════ */}
      {previewFile && (
        <div role="dialog" aria-modal="true" aria-label={previewFile.split('/').pop()} data-lenis-prevent className="fixed inset-0 z-[100] flex items-center justify-center overscroll-contain bg-black/50 p-4 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="relative flex max-h-[90vh] w-full max-w-[900px] animate-[scaleIn_0.2s_ease-out] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#F2F4F6] px-6 py-4">
              <p className="text-[16px] font-bold text-[#191F28]">{previewFile.split('/').pop()}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile}
                  download
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#3182F6] px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-[#1B64DA] active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t({ ko: '다운로드', en: 'Download', ja: 'ダウンロード', zh: '下载' })}
                </a>
                <button ref={previewCloseRef} onClick={() => setPreviewFile(null)} className="rounded-[10px] p-2 transition-colors hover:bg-[#F2F4F6]" aria-label={t({ ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' })}>
                  <X className="h-5 w-5 text-[#8B95A1]" />
                </button>
              </div>
            </div>
            <div data-scroll-inside className="flex min-h-[400px] flex-1 items-center justify-center overflow-auto overscroll-contain bg-[#F9FAFB] p-4">
              {previewFile.endsWith('.svg') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewFile} alt="CI" className="max-h-[70vh] max-w-full object-contain" />
              ) : previewFile.endsWith('.pdf') ? (
                <iframe src={previewFile} className="h-[70vh] w-full rounded-lg border-0" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewFile} alt="Preview" className="max-h-[70vh] max-w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
