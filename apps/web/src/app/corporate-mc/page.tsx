'use client';

/**
 * 전문행사(기업행사) MC 랜딩 — 홈 "전문행사 사회자 찾기" 진입.
 * 톤앤매너: wedding-mc 페이지 기준(화이트 + 블루 #3182F6, 라운드 카드, 스크롤 리빌).
 * 히어로: 풀스크린 배경 영상 + 카피 오버레이 → 스크롤 시 하단 콘텐츠.
 * 폼 제출: /api/inquiry (BusinessInquiry) → 어드민 /admin/inquiries 에 첨부파일까지 노출 + 이메일/시트 기록.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronDown, Check, X, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import GlobalMcNetwork from './GlobalMcNetwork';
import { captureUtm, readUtm, trackLandingVisit, trackLandingConversion } from '@/lib/landing-track';

// ─── 미디어 슬롯 (드라이브 자산 수급 후 채움 — 없으면 자동 숨김) ───
const MEDIA_DIR = '/images/corporate-mc';
const HERO_VIDEO = '/videos/corporate-mc-hero.mp4';
// '프리티풀은 검증된 아나운서 출신 풀을 보유하고 있습니다' 섹션의 사회자 프로필 마퀴(캐러셀)
const PROFILE_SLIDES: { src: string }[] = [
  { src: `${MEDIA_DIR}/profile-01.webp` },
  { src: `${MEDIA_DIR}/profile-02.webp` },
  { src: `${MEDIA_DIR}/profile-03.webp` },
  { src: `${MEDIA_DIR}/profile-04.webp` },
  { src: `${MEDIA_DIR}/profile-05.webp` },
];
// 레퍼런스 영상 — /uploads(직접 업로드) 또는 유튜브 embed URL. 비면 섹션 숨김.
const VIDEOS: { src: string; cap: string }[] = [];
const PREMIUM_VIDEO = '/videos/premium-events.mp4';
// 함께한 기업 로고 (70) — 5줄 캐러셀
const LOGO_NAMES = ['GS칼텍스','JTBC','JW메리어트','KBS','KT','LG','MBC','S-OIL','SBS','SK','SPC그룹','YTN','강남구청','경기도','고려대학교','교보생명','구글코리아','국민은행','기업은행','나이키','네이버','농협은행','대구광역시','대한무역투자진흥공사','대한상공회의소','대한항공','롯데','롯데백화점','매일유업','메리츠화재','문화체육관광부','보건복지부','빙그레','산업은행','산업통상자원부','삼성','삼양식품','새마을금고','새마을회','서울시','신한은행','아디다스','아모레퍼시픽','올리브영','우리은행','유한양행','이랜드','이마트','인천광역시','전라북도','제주항공','진에어','카카오모빌리티','코레일','코엑스','코오롱','코웨이','키움증권','포스코','풀무원','하나은행','한국관광공사','한국장학재단','한국전력공사','한미약품','한샘','현대','현대백화점','현대오일뱅크','현대카드'];
const LOGO_SRC = (n: string) => `${MEDIA_DIR}/logos/${encodeURIComponent(n)}.svg`;
// 8줄로 분배
const LOGO_ROWS: string[][] = [[], [], [], [], [], [], [], []];
LOGO_NAMES.forEach((n, i) => LOGO_ROWS[i % 8].push(n));
// biz 고객사 페이지의 '파트너사' 로고 (/images/partners/) — 영상 아래 캐러셀용
const PARTNER_LOGOS = [
  'frame-1707490594.svg', 'frame-1707490595.svg', 'frame-1707490596.svg', 'frame-1707490598.svg',
  'frame-1707490599.svg', 'frame-1707490618.svg', 'frame-1707490619.svg', 'frame-1707490620.svg',
  'frame-1707490621.svg', 'frame-1707490622.svg', 'frame-1707490623.svg', 'frame-1707490624.svg',
  'frame-1707490625.svg', 'frame-1707490626.svg', 'frame-1707490627.svg', 'frame-1707490628.svg',
  'frame-1707490629.svg', 'frame-1707490630.svg', 'frame-1707490631.svg', 'frame-1707490632.svg',
];
// 교차 섹션 스크롤 시 흩뿌려지는 "행사" 사진(PC) — 프로필(사회자 얼굴)은 제외, 행사 장면만.
// 정방향·똑같은 크기(cross 상/하단 이미지 사이즈 300px)·4:5 비율·좌우 가장자리 배치.
const SCATTER: { src: string; style: CSSProperties }[] = [
  { src: `${MEDIA_DIR}/scatter-01.webp`, style: { top: '20%', left: '-1%', '--fx': '80px', '--fy': '54px' } as unknown as CSSProperties },
  { src: `${MEDIA_DIR}/scatter-03.jpg`, style: { top: '63%', left: '6%', '--fx': '70px', '--fy': '-56px' } as unknown as CSSProperties },
  { src: `${MEDIA_DIR}/scatter-02.png`, style: { top: '6%', left: '76%', '--fx': '-80px', '--fy': '48px' } as unknown as CSSProperties },
  { src: `${MEDIA_DIR}/scatter-04.jpg`, style: { top: '58%', left: '75%', '--fx': '-82px', '--fy': '-46px' } as unknown as CSSProperties },
];
const SCATTER_W = '300px';

// 후기 카드 아바타(귀여운 물범 캐릭터) — 5종 순환. 파일 없으면 avatar 이모지로 폴백.
const AVATAR_IMGS = [
  `${MEDIA_DIR}/avatars/av-1.png`, `${MEDIA_DIR}/avatars/av-2.png`, `${MEDIA_DIR}/avatars/av-3.png`,
  `${MEDIA_DIR}/avatars/av-4.png`, `${MEDIA_DIR}/avatars/av-5.png`,
];
// 후기 카드 캐러셀 — body 의 **...** 는 하이라이트. avatar 이모지 + demo(담당자 역할·행사).
const REVIEWS: { title: string; body: string; avatar: string; demo: string }[] = [
  { title: '완벽한 진행 장악', body: '발표 사이 정적이 흐를 뻔한 순간에도 **자연스럽게 흐름을 이어**주셔서, 행사장 분위기가 끝까지 살아있었어요.', avatar: '🧑‍💼', demo: '대기업 인사팀 · 사내 시상식' },
  { title: '임원 의전까지 완벽', body: '**임원분 호칭 하나 안 틀리고** 깔끔하게 진행해주셔서, 끝나고 제가 칭찬을 들었습니다.', avatar: '👨‍💼', demo: 'IT기업 총무팀 · 창립기념식' },
  { title: '브랜드 톤 정확히', body: '**브랜드 톤앤매너를 정확히** 잡아주셔서, VIP·기자분들 앞에서도 내내 안심이 됐어요.', avatar: '👩', demo: '패션 브랜드 마케팅팀 · 신제품 발표회' },
  { title: '빠른 자료 제공', body: '견적·프로필·**진행 영상까지 하루 만에** 받아서, 클라이언트 컨펌이 정말 수월했습니다.', avatar: '🧑', demo: '행사대행사 · 기업 컨퍼런스' },
  { title: '식순 완벽 소화', body: '순서가 갑자기 바뀌었는데도 **당황 없이 매끄럽게** 대응해주셔서 감탄했어요.', avatar: '👨', demo: '제조사 홍보팀 · 준공식' },
  { title: '차분한 진행 톤', body: '시상식 격에 맞게 **품격 있고 차분하게** 진행해주셔서 회사 이미지가 한층 좋아 보였어요.', avatar: '👩‍💼', demo: '금융사 인사팀 · 우수사원 시상식' },
  { title: '리허설부터 꼼꼼', body: '당일 즉흥이 아니라 **대본·큐시트를 미리 맞춰**주셔서, 현장에서 전혀 불안하지 않았어요.', avatar: '🧑‍💼', demo: '공공기관 · 기념식' },
  { title: '분위기 메이커', body: '송년회를 **적당한 텐션으로 유쾌하게** 이끌어주셔서 직원들 반응이 최고였어요.', avatar: '👨', demo: '스타트업 대표 · 송년회' },
  { title: '영어 진행 능숙', body: '글로벌 컨퍼런스라 걱정했는데 **한·영 진행을 자연스럽게** 오가며 매끄럽게 마무리해주셨어요.', avatar: '🧑', demo: '외국계 기업 · 글로벌 포럼' },
  { title: '돌발상황 대처', body: '음향 사고가 났는데도 **관객이 눈치 못 채게** 자연스럽게 넘어가주셔서 정말 프로답다 느꼈어요.', avatar: '👩', demo: '유통사 · 브랜드 론칭 행사' },
  { title: '정산까지 깔끔', body: '진행은 물론 **세금계산서·정산 조건까지** 깔끔하게 정리돼서 사후 처리가 편했어요.', avatar: '👨‍💼', demo: '대기업 구매팀 · 협력사 간담회' },
  { title: '대표님도 만족', body: '대표님이 직접 **"이 사회자 또 부르자"**고 하실 만큼 진행 만족도가 높았습니다.', avatar: '🧑‍💼', demo: '중견기업 비서실 · 창립기념식' },
  { title: '섬세한 큐 조율', body: '무대 뒤 스태프와 **큐 사인을 정확히 맞춰**주셔서 영상·조명 전환이 완벽했어요.', avatar: '👩‍💼', demo: '이벤트사 PM · 시상식' },
  { title: '내부 보고도 수월', body: '**프로필과 진행 영상**을 함께 주셔서 윗선 보고와 예산 승인이 한 번에 통과됐어요.', avatar: '👨', demo: '제약사 마케팅팀 · 심포지엄' },
  { title: '재섭외 확정', body: '올해 행사가 너무 좋아서 **내년 행사도 미리 예약**했습니다. 믿고 맡길 수 있어요.', avatar: '👩', demo: '금융지주 · 정기 주주총회' },
];
// 개인정보 수집·이용 동의 (모달)
const PRIVACY_SECTIONS: { heading: string; body: string }[] = [
  { heading: '1. 수집하는 개인정보 항목', body: '수집 항목: 담당자명, 기관명, 연락처, 이메일, 행사 예정일, 행사 지역, 행사 진행에 필요한 사항을 수집합니다.' },
  { heading: '2. 개인정보 수집·이용 목적', body: '프리티풀 서비스 제공 및 회원 관리, 기업ㆍ기관ㆍ단체ㆍ행사대행사 등 섭외 문의 접수ㆍ상담ㆍ견적 제공ㆍ계약 체결 및 이행ㆍ행사 운영 관련 커뮤니케이션ㆍ정산 및 분쟁 대응을 목적으로 개인정보를 수집합니다.' },
  { heading: '3. 개인정보 보유·이용 기간', body: '회원 탈퇴 시 또는 서비스 종료 시까지 보유하며, 관련 법령에 따라 일정 기간 보관될 수 있습니다.' },
  { heading: '4. 개인정보의 제3자 제공', body: '회사는 원칙적으로 정보주체의 개인정보를 외부에 제공하지 않습니다. 다만, 행사전문사회자 섭외 및 프리티풀 서비스 제공에 필요한 경우, 행사 진행에 필요한 최소한의 정보를 회사의 협력업체 및 배정 예정 또는 확정된 사회자에게 제공할 수 있습니다.' },
  { heading: '5. 처리 위탁', body: '회사는 서비스 운영, 고객 상담, 알림 발송, 데이터 보관, 결제 및 정산 등 업무 수행을 위해 필요한 경우 개인정보 처리 업무의 일부를 외부 업체에 위탁할 수 있으며, 위탁 시 관련 법령에 따라 개인정보가 안전하게 처리되도록 관리·감독합니다.' },
  { heading: '6. 동의 거부 권리 및 불이익', body: '개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의를 거부하실 경우 서비스 안내 및 이용이 제한될 수 있습니다.' },
];

// 행사 사회자 섭외 유의사항
const BOOKING_NOTICES: string[] = [
  '기업·기관 행사는 행사일 기준 3개월 전에 사회자 섭외가 시작되므로, 선호도가 높은 사회자는 일정이 조기 마감될 수 있습니다.',
  '행사 진행 초안 및 확정된 행사 일시ㆍ장소 등 기타 사항을 전달해주시면, 상세한 견적 안내 및 행사에 적합한 사회자를 신속히 안내드립니다.',
  '섭외 완료 기간은 상담 후 가급적 빠른 시일 내 확정됩니다.',
  '프리티풀을 통해 소개받은 사회자와 별도 직거래를 진행하거나 우회하여 섭외하는 행위는 추가 서비스 이용이 제한될 수 있습니다.',
  '제공해주신 첨부 자료ㆍ파일은 프리티풀 서비스 제공 및 견적 안내 목적으로만 사용됩니다.',
];

const STEPS = [
  { no: 'STEP 01', title: '행사 정보 접수', body: '전문 MD가 행사 일정·유형·규모·예산·식순을 확인합니다.' },
  { no: 'STEP 02', title: 'MC 제안 & 선택', body: '가능한 진행자를 프로필·진행 영상으로 비교해 직접 고르고, 내부 보고용 자료까지 받습니다.' },
  { no: 'STEP 03', title: '계약 · 사전 조율', body: '대본·큐시트를 사전에 맞추고, 세금계산서·정산 조건까지 깔끔하게 정리합니다.' },
  { no: 'STEP 04', title: '당일 진행 & 마무리', body: '리허설부터 현장 변수 대응, 정산·세금계산서까지 책임지고 마무리합니다.' },
];

// 스크롤 다이얼 스탯 — 각 항목이 뷰포트 중앙으로 차례로 스냅되며 나타난다.
const STATS: { text: string; label: string }[] = [
  { text: '1,200+건',      label: '기업행사 진행' },
  { text: '99%',           label: '담당자 재섭외 의향' },
  { text: '0건',           label: '의전 진행 사고' },
  { text: '100명 이상',    label: '검증된 행사가능 사회자' },
  { text: '365일 24시간',  label: '상담가능시간' },
];

export default function CorporateMcPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const crossRef = useRef<HTMLElement>(null);
  const vidRef = useRef<HTMLElement>(null);
  const bspreadRef = useRef<HTMLDivElement>(null); // 방송 3사 이미지 — 덱→양옆 펼침
  const globalRef = useRef<HTMLDivElement>(null); // Global MC Network(블랙 섹션) 래퍼 — 헤더 다크존 판정
  const statsSecRef = useRef<HTMLElement>(null); // 성장 지표 다이얼 섹션
  const [scrolled, setScrolled] = useState(false);
  const [darkZone, setDarkZone] = useState(false); // 영상/블랙 섹션이 헤더를 덮는 동안 히어로 헤더 유지
  const [fabTipOpen, setFabTipOpen] = useState(true); // 우하단 플로팅 버튼 위 글래스 툴팁 노출 여부
  const [fabOverDark, setFabOverDark] = useState(true); // 플로팅 버튼이 다크 배경 위에 있는지 (흰 배경이면 글자/아이콘 검정)
  const fabWrapRef = useRef<HTMLDivElement>(null);

  // 폼
  const [step, setStep] = useState<number | 'done'>(1);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [dateText, setDateText] = useState('');
  const [region, setRegion] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [policyModal, setPolicyModal] = useState<null | 'privacy' | 'notice'>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttach = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('8MB 이하 파일만 첨부할 수 있어요.'); return; }
    setAttachment(file);
  };

  // UTM 보존 + 방문 추적
  useEffect(() => {
    captureUtm();
    trackLandingVisit('corporate-mc');
  }, []);

  // 자동재생 보장(iOS WebView)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  // 화면 밖 영상은 일시정지 — 스크롤 중 백그라운드 디코딩이 모바일 버벅임을 유발
  useEffect(() => {
    const vids = Array.from(document.querySelectorAll<HTMLVideoElement>('.cmc video'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) { v.muted = true; v.play().catch(() => {}); }
        else v.pause();
      });
    }, { rootMargin: '160px' });
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  // 헤더 배경 전환(히어로 지나면 흰 배경) + 교차 이미지 스크롤 벌어짐
  useEffect(() => {
    let raf = 0;
    // 텍스트 블록 높이 절반 + 여유 = 벌어질 거리(--open)
    const measureOpen = () => {
      const el = crossRef.current;
      if (!el) return;
      const txt = el.querySelector<HTMLElement>('.cmc-cross-text');
      if (txt) el.style.setProperty('--open', `${Math.round(txt.offsetHeight * 0.5 + 28)}px`);
    };
    // 모바일 WKWebView 스크롤 버벅임 방지 — 값이 실제로 바뀔 때만 스타일을 기록하고,
    // querySelectorAll 은 매 프레임이 아니라 마운트/리사이즈 시 1회만 수행한다.
    const last = { spread: -1, vp: -1, bsp: -1, statsP: -1 };
    let statRows: HTMLElement[] = [];
    let darkEls: HTMLElement[] = [];
    const cacheEls = () => {
      statRows = statsSecRef.current ? Array.from(statsSecRef.current.querySelectorAll<HTMLElement>('.cmc-stat-row')) : [];
      darkEls = Array.from(document.querySelectorAll<HTMLElement>('[data-cmc-dark]'));
    };
    const apply = () => {
      raf = 0;
      setScrolled(window.scrollY > window.innerHeight * 0.7);
      const vh = window.innerHeight;
      // 교차 섹션: 섹션 중앙이 화면 중앙에 가까워질수록 벌어짐(0=겹침 → 1=벌어짐)
      // 섹션 상단이 화면의 55% 지점에 오면 시작, 25% 지점 통과 시 완료 → 스크롤 내리는 게 확실히 보임
      const el = crossRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const start = vh * 0.62;   // r.top 이 이 값일 때 p=0
        const end = vh * 0.12;     // r.top 이 이 값일 때 p=1
        const p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
        if (Math.abs(p - last.spread) > 0.001) { last.spread = p; el.style.setProperty('--spread', String(p)); }
      }
      // 영상 섹션: 섹션 상단이 화면 상단을 지난 뒤 0.8화면 스크롤하는 동안 풀스크린으로 채워짐(이후 유지)
      const vs = vidRef.current;
      if (vs) {
        const vr = vs.getBoundingClientRect();
        // 섹션 상단이 화면 55%지점 → 최상단으로 오는 동안 카드→풀스크린으로 채워지고(도착 시 꽉 참),
        // 이후 sticky 로 풀스크린 유지. (예전엔 상단을 지난 뒤에야 채워져 과하게 스크롤 필요)
        const vp = Math.min(1, Math.max(0, (vh * 0.55 - vr.top) / (vh * 0.55)));
        if (Math.abs(vp - last.vp) > 0.001) { last.vp = vp; vs.style.setProperty('--vp', String(vp)); }
      }
      // 방송 3사 이미지: 컨테이너가 화면 88% 지점에 들어오면 겹친 덱에서 양옆으로 펼쳐짐
      const bs = bspreadRef.current;
      if (bs) {
        const br = bs.getBoundingClientRect();
        const sp = Math.min(1, Math.max(0, (vh * 0.88 - br.top) / (vh * 0.5)));
        if (Math.abs(sp - last.bsp) > 0.001) { last.bsp = sp; bs.style.setProperty('--bsp', String(sp)); }
      }
      // 성장 지표 다이얼: sticky 영역 안에서의 스크롤 진행률(0→1) 을 계산해 각 수치 row 의 위치/투명도/스케일 결정.
      const ss = statsSecRef.current;
      if (ss) {
        const sr = ss.getBoundingClientRect();
        const total = ss.offsetHeight - vh;
        const scrolled = Math.min(Math.max(-sr.top, 0), total);
        const p = total > 0 ? scrolled / total : 0;
        const visible = sr.bottom > 0 && sr.top < vh;
        if (visible && Math.abs(p - last.statsP) > 0.0005) {
        last.statsP = p;
        const activeF = p * (STATS.length - 1);
        const rows = statRows;
        const gap = Math.min(96, Math.max(72, vh * 0.11)); // 90 근처, 화면 높이에 따라 살짝 가변
        rows.forEach((row, idx) => {
          const dist = idx - activeF;
          const absD = Math.abs(dist);
          const y = dist * gap;
          const o = Math.max(0, 1 - absD * 0.42);
          const s = Math.max(0.6, 1 - absD * 0.12);
          // 다이얼 원근: 중앙보다 위(dist<0)면 뒤로 눕고, 아래(dist>0)면 앞으로 눕는다.
          // 중앙에서 멀수록 더 크게 기울이되(최대 ±58도) 캡을 둔다.
          const rx = Math.max(-58, Math.min(58, -dist * 26));
          row.style.setProperty('--y', `${y}px`);
          row.style.setProperty('--o', String(o));
          row.style.setProperty('--s', String(s));
          row.style.setProperty('--rx', `${rx}deg`);
          row.classList.toggle('is-active', absD < 0.4);
        });
        }
      }
      // 헤더 다크존: 영상 섹션·블랙 글로벌 섹션·성장지표(우주 배경) 섹션이 헤더 라인을 덮는 동안 히어로 헤더로 전환
      const HEADER_Y = 56;
      const dark = [vidRef.current, globalRef.current, statsSecRef.current].some((el) => {
        if (!el) return false;
        const dr = el.getBoundingClientRect();
        return dr.top <= HEADER_Y && dr.bottom >= HEADER_Y + 20;
      });
      setDarkZone(dark);

      // 플로팅 버튼 배경 판정: 버튼 중심점에 다크 섹션([data-cmc-dark])이 걸리면 흰 글자, 아니면 검정.
      const fabEl = fabWrapRef.current;
      if (fabEl) {
        const fr = fabEl.getBoundingClientRect();
        const px = fr.left + fr.width / 2;
        const py = fr.bottom - 38; // 원형 버튼(76px)의 대략 중심
        const overDark = darkEls.some((del) => {
          const r = del.getBoundingClientRect();
          return r.left <= px && r.right >= px && r.top <= py && r.bottom >= py;
        });
        setFabOverDark(overDark);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onResize = () => { measureOpen(); cacheEls(); apply(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    measureOpen();
    cacheEls();
    apply();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // 스크롤 리빌 (섹션 슬라이드 + 텍스트 팝 + 마퀴 순차 등장)
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.cmc-reveal, .cmc-pop, .cmc-riser'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('cmc-in');
        // 요소가 뷰포트 아래로 벗어나면(위로 스크롤해 지나침) 리셋 → 다시 내려오면 재생.
        // 위로 벗어날 때(top<0)는 유지해서 스크롤다운 중 역방향 페이드가 안 생기게.
        else if (e.boundingClientRect.top > 0) e.target.classList.remove('cmc-in');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollToApply = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });

  const [showErrors, setShowErrors] = useState(false);
  const formValid = !!(name.trim() && phone.trim() && consent);

  const submit = async () => {
    if (submitting) return;
    if (!formValid) {
      setShowErrors(true);
      if (!name.trim() || !phone.trim()) toast.error('성함과 연락처를 입력해주세요.');
      else if (!consent) toast.error('개인정보 수집·이용에 동의해주세요.');
      return;
    }
    setSubmitting(true);

    // 어드민(Biz 문의)으로 전송 — 이미 완성된 /admin/inquiries 화면에 첨부파일까지 그대로 노출됨.
    // 모든 폼 값을 message 로 조합하고, 파일은 multipart 로 붙인다. (biz 페이지와 동일한 /api/inquiry 경로)
    const utm = readUtm();
    const utmLine = [utm.utm_source && `source=${utm.utm_source}`, utm.utm_medium && `medium=${utm.utm_medium}`, utm.utm_campaign && `campaign=${utm.utm_campaign}`]
      .filter(Boolean).join(' · ');

    // ── 구글시트(Apps Script) 리드 적재 — 유입/전환 분석용. fire-and-forget(no-cors) ──
    // UTM/landing_url 은 이 앱에서 sessionStorage 에 보존됨(landing-track). localStorage 가 비어도
    // landing_url(=UTM 포함 최초 접속 주소)로 유입 복구 가능.
    try {
      const ssGet = (k: string) => { try { return window.sessionStorage.getItem(k) || ''; } catch { return ''; } };
      const sheetPayload = {
        formType: 'corporate-mc',                    // ★ 시트 분류 키 — 수정/삭제 금지
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim(),                     // corporate-mc 실제 필드(회사/단체명)
        q1: '',                                      // corporate-mc 폼에 해당 항목 없음
        weddingDate: dateText.trim(),                // 행사 예정일
        region: region.trim(),                       // 행사 지역
        benefits: [] as string[],                    // corporate-mc 폼에 해당 항목 없음
        description: description.trim(),             // 행사 기획 설명
        couponCode: '',
        source: 'freetiful-corporate-mc',
        utm_source: utm.utm_source || '',
        utm_medium: utm.utm_medium || '',
        utm_campaign: utm.utm_campaign || '',
        utm_term: utm.utm_term || '',
        utm_content: utm.utm_content || '',
        referrer: utm.referrer || ssGet('referrer'),
        landing_url: ssGet('landing_url') || window.location.href,
      };
      fetch('https://script.google.com/macros/s/AKfycbwGOi4e1J2Q1w8x-5UEe-czB3uy6mET90xBhP9OG82fl4jRPEyYdBfqJkmDZuYJMFuc/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(sheetPayload),
        keepalive: true,
      }).catch(() => {});
    } catch {}

    const messageLines = [
      `행사 예정일: ${dateText.trim() || '미정'}`,
      `행사 지역: ${region.trim() || '미정'}`,
      '',
      '[행사 기획 설명]',
      description.trim() || '(작성 없음)',
      ...(utmLine ? ['', `[유입경로] ${utmLine}`] : []),
    ];
    const fd = new FormData();
    fd.append('company', company.trim());
    fd.append('name', name.trim());
    fd.append('phone', phone.trim());
    fd.append('email', '');
    fd.append('type', '전문 행사 사회자 섭외');
    fd.append('message', messageLines.join('\n'));
    if (attachment) fd.append('file', attachment);

    try {
      const res = await fetch('/api/inquiry', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `요청 실패 (${res.status})`);
      }
      trackLandingConversion('corporate-mc');
      setStep('done');
    } catch (err: any) {
      toast.error(`제출에 실패했어요. ${err?.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="cmc bg-white text-[#191F28]">
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* iOS 앱 네이티브 하단 네비 숨김 마커 — 앱 주입 스크립트의 readState 가
          [role="dialog"]/[aria-modal="true"] 존재 시 hasBlockingOverlay=true 를 보내고,
          Swift renderNativeNavigation 이 그동안 네비바를 숨긴다. display:none 이라
          접근성 트리/화면에는 안 잡히고 querySelector 에만 걸림. (앱 재빌드 없이 즉효) */}
      <div role="dialog" aria-modal="true" style={{ display: 'none' }} aria-hidden="true" />

      {/* 헤더 (히어로/다크섹션 위 투명 → 그 외 스크롤 시 흰 배경) */}
      <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled && !darkZone ? 'bg-white/90 backdrop-blur border-b border-[#EEF1F4]' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-3">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => { if (window.history.length > 1) router.back(); else router.push('/main'); }}
            className={`flex h-10 w-10 items-center justify-center -ml-1 rounded-full transition ${scrolled && !darkZone ? 'text-[#191F28] hover:bg-black/5' : 'text-white hover:bg-white/10'}`}
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <FreetifulLogo className={`h-[22px] w-auto transition-colors duration-300 ${scrolled && !darkZone ? 'text-[#1B1B1B]' : 'text-white'}`} />
          <div className="w-10" />
        </div>
      </header>

      {/* ───────── 히어로 (풀스크린 영상) ───────── */}
      <section data-cmc-dark className="relative flex h-[100svh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="cmc-hero-video absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          autoPlay muted loop playsInline preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/75" />
        {/* 살짝의 딤드 — 전체 균일 어둡게 */}
        <div className="pointer-events-none absolute inset-0 bg-black/25" />
        {/* 첫 진입 커튼 — 고급스럽게 걷히는 오프닝 */}
        <div className="cmc-hero-curtain pointer-events-none absolute inset-0 z-20 bg-black" />
        <div className="relative z-10 px-5 text-center">
          <p className="cmc-hero-eyebrow cmc-condor mb-4 text-[13px] uppercase tracking-[0.16em] text-white/75 md:mb-5 md:text-[15px]">Corporate Event MC</p>
          <h1 className="font-extrabold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]">
            <span className="cmc-hero-line cmc-line-1 block text-[24px] md:text-[44px]">중요한 행사의 완성도는</span>
            <span className="cmc-hero-line cmc-line-2 mt-1 block text-[24px] md:text-[44px]">
              사회자에 따라 달라집니다
            </span>
          </h1>
          <p className="cmc-hero-sub mt-6 text-[14px] font-medium leading-relaxed text-white/80 md:mt-7 md:text-[18px]">
            KBS · SBS · MBC 아나운서 출신<br />검증된 전문 MC를 행사 성격에 맞춰
          </p>
          <div className="cmc-hero-cta mt-8 flex items-center justify-center md:mt-10">
            <button onClick={scrollToApply} className="cmc-glass inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-bold text-white transition active:scale-95 md:px-10 md:py-4 md:text-[17px]">
              비즈니스 문의
              <ChevronRight size={18} strokeWidth={2.4} className="opacity-80" />
            </button>
          </div>
        </div>
        {/* 스크롤 힌트 */}
        <button onClick={() => window.scrollTo({ top: window.innerHeight - 56, behavior: 'smooth' })} aria-label="아래로" className="cmc-scrollhint absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-white/70">
          <ChevronDown size={30} strokeWidth={2} />
        </button>
      </section>

      {/* ───────── ANNOUNCER POOL (히어로 직후) ───────── */}
      <section className="cmc-reveal px-5 py-14 text-center md:py-24">
        <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.18em] leading-none text-[#B7C0CC]">Certified announcer</p>
        <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#1B2A4A]">프리티풀은 방송사출신<br className="md:hidden" /> 아나운서들과 함께합니다</h2>
        <p className="cmc-pop cmc-d2 mx-auto mt-5 max-w-[600px] text-[15px] md:text-[19px] leading-[1.7] text-[#8B95A1]"><b className="text-[#3182F6]">KBS · SBS · MBC · YTN · JTBC</b> · 홈쇼핑 쇼호스트<span className="hidden md:inline"> · </span><br className="md:hidden" />호텔·컨벤션 경험</p>
        {/* 방송 3사 — 겹친 덱에서 스크롤에 따라 양옆으로 펼쳐짐(아나운서 캐러셀과 동일 264px·3:4) */}
        <div ref={bspreadRef} className="cmc-bspread relative mx-auto mt-10 h-[352px] md:mt-14">
          <div className="cmc-bcard cmc-bc-l"><img src={`${MEDIA_DIR}/broadcast-sbs.jpg`} alt="SBS 사옥" /></div>
          <div className="cmc-bcard cmc-bc-r"><img src={`${MEDIA_DIR}/broadcast-mbc.jpg`} alt="MBC 사옥" /></div>
          <div className="cmc-bcard cmc-bc-c"><img src={`${MEDIA_DIR}/broadcast-kbs.jpg`} alt="KBS 사옥" /></div>
        </div>
      </section>

      {/* ───────── 성장 지표 — 스크롤 다이얼 (수치들이 중앙에 하나씩 스냅) ───────── */}
      {/* 스탯 하나 전환당 스크롤 거리 = --stats-per * 화면높이 (모바일 0.55, 데스크톱 0.7). 작을수록 예민. */}
      <section
        ref={statsSecRef}
        data-cmc-dark
        className="cmc-stats-sec relative bg-black text-white"
        style={{ height: `calc((${STATS.length} - 1) * var(--stats-per, 0.55) * 100vh + 100vh)` }}
      >
        <div className="cmc-stats-sticky">
          <div className="cmc-stats-bg" aria-hidden="true" />
          <div className="cmc-stats-inner">
            <p className="cmc-condor mb-4 text-[13px] uppercase tracking-[0.16em] text-white/75 md:mb-5 md:text-[15px]">Verified announcer</p>
            <h2 className="cmc-stats-heading font-extrabold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]">
              <span className="block text-[24px] md:text-[44px]">프리티풀의 신뢰는</span>
              <span className="mt-1 block text-[24px] md:text-[44px]">숫자로 검증됩니다</span>
            </h2>
            <div className="cmc-stats-dial">
              {STATS.map((s, i) => (
                <div key={i} className="cmc-stat-row">
                  <span className="cmc-stat-val">{s.text}</span>
                  <span className="cmc-stat-lbl">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── 교차 이미지 (품격) — 스크롤 시 위에서 겹쳤다가 텍스트 여백만큼 벌어짐 ───────── */}
      <section ref={crossRef} className="cmc-cross-sec relative bg-white px-5 py-28 md:py-44">
        {/* PC 전용 — 스크롤 시 흩뿌려지는 행사 사진(촤라락) */}
        <div className="cmc-riser pointer-events-none absolute inset-0 z-0 hidden md:block">
          {SCATTER.map((s, i) => (
            <div key={s.src} className={`cmc-scatter cmc-d${i + 1} absolute aspect-[4/5] overflow-hidden`} style={{ ...s.style, width: SCATTER_W }}>
              <img src={s.src} alt="" loading="lazy" className="block h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ))}
        </div>
        <div className="cmc-cross relative z-[1] mx-auto flex max-w-md flex-col items-center md:max-w-lg">
          {/* 상단 — 영상 (규격은 이미지와 동일: aspect-[4/5] w-[62%] object-cover) */}
          <div className="cmc-cross-img cmc-cross-a relative aspect-[4/5] w-[62%] self-start overflow-hidden bg-gradient-to-br from-[#EDEFF3] to-[#DDE1E8]">
            <video src="/videos/cross-top.mp4" autoPlay muted loop playsInline preload="auto" className="relative h-full w-full object-cover" />
          </div>
          {/* 텍스트 */}
          <div className="cmc-cross-text relative z-[2] -my-8 px-2 text-center">
            <h2 className="cmc-pop text-[24px] md:text-[44px] font-extrabold leading-[1.35] tracking-[-0.02em] text-[#111]">중요한 순간, 행사의<br /><span className="cmc-flow">품격</span>을 결정하는 사회자</h2>
            <p className="cmc-pop cmc-d2 mt-4 text-[16px] md:text-[20px] leading-[1.7] text-[#6B7684]">첫 인사의 설렘부터 마지막 박수의 감동까지.<br />프리티풀은 품격 있는 사회와 안정적인 진행으로<br />기업의 특별한 순간을 완벽하게 완성합니다.</p>
          </div>
          {/* 하단 — kt cloud SUMMIT 사회 진행 사진 (가로 원본이라 좌측 기준 크롭 — 사회자 구도 유지) */}
          <div className="cmc-cross-img cmc-cross-b relative aspect-[4/5] w-[62%] self-end overflow-hidden bg-gradient-to-br from-[#F3EFEC] to-[#E6DED8]">
            <img src={`${MEDIA_DIR}/cross-bottom.jpg`} alt="kt cloud SUMMIT 행사 사회 진행" className="relative h-full w-full object-cover object-left" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md md:max-w-2xl">

        {/* ───────── SOLUTION (슬라이더) ───────── */}
        <section className="px-5 py-12 md:py-20 text-center">
          <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">Trusted announcer</p>
          <h2 className="cmc-pop cmc-d1 mt-3 text-[24px] md:text-[44px] font-extrabold leading-[1.32] tracking-[-0.02em]">고급스러운 행사,<br />프리티풀의 검증된 사회자가 보장합니다.</h2>
          <p className="cmc-pop cmc-d2 mx-auto mt-4 max-w-[640px] text-[15px] md:text-[19px] leading-[1.7] text-[#6B7684]">행사 규모와 성격에 맞는 사회자를, 검증이 끝난 풀 안에서 바로 연결해드립니다.</p>

          {/* 프로필 마퀴 — 자동 흐름 + 하단에서 순차 등장. PC 에선 max-w 컨테이너 벗어나 가로 풀블리드. 모바일은 더 빠르게(cmc-profile-track) */}
          <div className="cmc-marquee cmc-bleed-md cmc-riser mt-9">
            <div className="cmc-marquee-track cmc-profile-track">
              {[...PROFILE_SLIDES, ...PROFILE_SLIDES].map((s, i) => (
                <div key={`${s.src}-${i}`} className={`cmc-rise cmc-d${(i % 5) + 1} relative aspect-[3/4] w-[264px] flex-none overflow-hidden`}>
                  <img src={s.src} alt="" loading="lazy" className="relative z-[2] h-full w-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="cmc-blur-fade absolute inset-x-0 bottom-0 z-[3] h-[38%]" />
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* ───────── PREMIUM EVENTS ───────── */}
        <section className="px-5 pt-12 md:pt-20 text-center">
          <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">The Art of Premium Events</p>
          <h2 className="cmc-pop cmc-d1 mt-3 text-[24px] md:text-[44px] font-extrabold leading-[1.32] tracking-[-0.02em]">프리티풀은 행사 기획 및<br />현장 운영 역량을 갖추고 있습니다.</h2>
          <p className="cmc-pop cmc-d2 mx-auto mt-5 max-w-[540px] text-[16px] md:text-[20px] leading-[1.7] text-[#6B7684]">전국 각 지역 행사장 &amp; 웨딩홀에서<br />행사 기획부터 진행까지 모두 가능합니다</p>
        </section>

        {/* 스크롤 시 전체화면으로 채워지는 영상 (풀스크린 도달 후 홀드 최소화 → 아래 gap 축소) */}
        <section ref={vidRef} className="cmc-vidsec relative h-[112vh]">
          <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
            <div data-cmc-dark className="cmc-vidbox relative overflow-hidden bg-black shadow-[0_40px_90px_-40px_rgba(0,0,0,0.5)]">
              <video src={PREMIUM_VIDEO} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
              {/* 후원사 로고 — 영상 안 글래스 오버레이(프로스트) 플로팅 캐러셀 (하단 고정 CTA 위로 띄움) */}
              <div className="pointer-events-none absolute inset-x-0 bottom-[calc(94px+env(safe-area-inset-bottom))] z-[2] px-4 md:px-10">
                <div className="mx-auto max-w-[1100px]">
                  <p className="pt-3 text-center text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70 md:text-[11px]">Trusted Partners</p>
                  <div className="cmc-marquee px-3 pb-5 pt-2">
                    <div className="cmc-marquee-track" style={{ animationDuration: '42s' }}>
                      {[...PARTNER_LOGOS, ...PARTNER_LOGOS].map((logo, i) => (
                        <div key={`${logo}-${i}`} className="flex h-12 w-[150px] flex-none items-center justify-center px-3 md:h-14 md:w-[190px]">
                          <img src={`/images/partners-mono/${encodeURIComponent(logo)}`} alt="후원사 로고" loading="lazy" className="max-h-9 max-w-full object-contain opacity-90 md:max-h-11" style={{ filter: 'brightness(0) invert(1)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ───────── REFERENCE VIDEOS (있을 때만) ───────── */}
        {VIDEOS.length > 0 && (
          <section className="cmc-reveal px-5 py-12 md:py-20 text-center">
            <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">Reference</p>
            <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">사진보다 확실한 건<br />실제 진행 영상입니다</h2>
            <div className="mt-6 space-y-3">
              {VIDEOS.map((v) => (
                <div key={v.src} className="relative overflow-hidden rounded-[20px] bg-black">
                  {v.src.includes('youtube.com') ? (
                    <iframe className="aspect-video w-full" src={v.src} title={v.cap} allowFullScreen />
                  ) : (
                    <video className="max-h-[440px] w-full object-contain" src={`${v.src}#t=0.1`} controls playsInline preload="metadata" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-left text-[13px] font-bold text-white">{v.cap}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ───────── GLOBAL MC NETWORK (블랙 테이크오버 — 언어 타이포 → 자전 지구본) ───────── */}
        <div ref={globalRef} data-cmc-dark>
          <GlobalMcNetwork />
        </div>

        {/* ───────── REVIEWS (카드 캐러셀 — 파란 그라데이션, PC 풀블리드, 카드 아래→위 촤라락 리빌) ───────── */}
        <section className="cmc-bleed-md relative overflow-hidden py-16 md:py-24">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(125deg, #DCEBFF 0%, #EDF4FF 40%, #E5EDFF 70%, #D6E4FF 100%)', zIndex: -1 }} />
          <div className="px-5 text-center">
            <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#7FA0D8]">Reviews</p>
            <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em] text-[#1B2A4A]">행사가 성공할수록,<br />담당자의 가치는 더 선명해집니다.</h2>
          </div>
          <div className="cmc-marquee cmc-riser mt-10">
            <div className="cmc-rev-track">
              {[...REVIEWS, ...REVIEWS].map((r, i) => (
                <article key={`${r.title}-${i}`} className={`cmc-rise cmc-d${(i % 8) + 1} flex w-[300px] flex-none flex-col rounded-[26px] border border-[#E9ECF0] bg-white px-7 py-8 text-left md:w-[344px]`}>
                  <h3 className="text-[19px] font-extrabold tracking-tight text-[#1B2331] md:text-[21px]">{r.title}</h3>
                  <p className="mt-4 flex-1 text-[15px] leading-[1.78] text-[#5A6472] md:text-[16px]"><Highlight text={r.body} /></p>
                  <div className="mt-7 flex items-center gap-3">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF1FB] text-[22px]">
                      {r.avatar}
                      <img src={AVATAR_IMGS[i % AVATAR_IMGS.length]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    </span>
                    <span className="text-[14px] font-medium text-[#8B95A1] md:text-[15px]">{r.demo}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── PROCESS ───────── */}
        <section className="cmc-reveal px-5 py-12 md:py-20">
          <div className="text-center">
            <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">Process</p>
            <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">섭외, 이렇게<br />간편하게 진행됩니다</h2>
          </div>
          <div className="mt-7 space-y-3">
            {STEPS.map((s, i) => (
              <div key={s.no} className={`cmc-reveal cmc-d${i + 1} flex gap-4 rounded-[22px] bg-[#F7F9FC] px-5 py-5`}>
                <span className="mt-0.5 shrink-0 text-[12px] font-bold tracking-[0.14em] text-[#3182F6]">{s.no}</span>
                <div>
                  <h3 className="text-[16px] font-bold">{s.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#6B7684]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── SCALE ───────── */}
        <section className="px-5 py-16 md:py-28 text-center">
          <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">Assured freetiful</p>
          <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.32] tracking-[-0.02em]">이미 <span className="text-[#3182F6]">1,200개 기업</span>의 행사가<br />프리티풀의 전문 사회자와 함께했습니다.</h2>
          <p className="cmc-pop cmc-d2 mt-3 text-[16px] md:text-[20px] text-[#8B95A1]">이제 담당자님 차례입니다.</p>

          {/* 함께한 기업 로고 — 8줄 캐러셀, 스크롤 진입 시 하단에서 딱딱 올라오며 흐름 */}
          <div className="cmc-logo-wall cmc-riser mt-12 space-y-7">
            {LOGO_ROWS.map((row, ri) => (
              <div key={ri} className={`cmc-logo-marquee cmc-rise cmc-d${(ri % 5) + 1}`}>
                <div className={`cmc-logo-track ${ri % 2 === 1 ? 'cmc-logo-rev' : ''}`} style={{ animationDuration: `${78 + ri * 7}s` }}>
                  {[...row, ...row].map((n, i) => (
                    <span key={`${n}-${i}`} className="cmc-logo-item">
                      <img src={LOGO_SRC(n)} alt={n} loading="lazy" className="h-full w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── LEAD / FORM ───────── */}
        <section id="apply" className="cmc-reveal px-5 py-14 md:py-24">
          <div className="text-center">
            <p className="cmc-pop cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.16em] leading-none text-[#B7C0CC]">Apply</p>
            <h2 className="cmc-pop cmc-d1 text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">행사 일정이 없어도<br />미리 확인해두세요</h2>
            <p className="cmc-pop cmc-d2 mt-3 inline-flex items-center justify-center gap-1.5 text-[17px] font-bold text-[#031228]/70">
              <img src={`${MEDIA_DIR}/icon-warn.svg`} alt="" width={20} height={20} className="shrink-0" />
              기업행사는 보통 5~6개월 전부터 섭외됩니다.
            </p>
          </div>

          {step === 'done' ? (
            <div className="cmc-fade mx-auto mt-7 max-w-md rounded-[24px] border border-[#EEF1F4] bg-white p-8 text-center shadow-[0_20px_44px_-28px_rgba(20,24,31,0.28)]">
              <div className="mb-3 text-[44px]">🎯</div>
              <h3 className="text-[21px] font-bold">신청 완료!</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#6B7684]">담당 매니저가 1영업일 내에<br />남겨주신 연락처로 안내드릴게요.</p>
              <button onClick={() => router.push('/main')} className="mt-6 h-[56px] w-full rounded-[16px] bg-[#3182F6] text-[17px] font-bold text-white transition active:scale-[0.98]">홈으로</button>
              <p className="mt-4 text-[12.5px] text-[#B0B8C1]">가능 MC·견적은 입력하신 연락처로 안내됩니다.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mx-auto mt-8 max-w-md space-y-6">
              {/* 성함 / 직함 */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">성함 / 직함</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 김OO 대리" autoComplete="name"
                  className={`mt-2 w-full border-b-2 bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none ${showErrors && !name.trim() ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#E5E8EE] focus:border-[#3182F6]'}`}
                />
                <p className={`mt-2.5 text-[14px] ${showErrors && !name.trim() ? 'text-[#FF4D4F]' : 'text-[#9AA3B0]'}`}>{showErrors && !name.trim() ? '담당자님 성함을 입력해주세요' : '가능 MC 안내를 받으실 담당자님 성함'}</p>
              </div>

              {/* 회사명 (선택) */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">회사명 <span className="text-[13px] font-medium text-[#9AA3B0]">(선택)</span></label>
                <input
                  type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="예) OO기업 인사팀"
                  className="mt-2 w-full border-b-2 border-[#E5E8EE] bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none focus:border-[#3182F6]"
                />
              </div>

              {/* 연락처 */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">연락처</label>
                <input
                  type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoComplete="tel"
                  className={`mt-2 w-full border-b-2 bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none ${showErrors && !phone.trim() ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#E5E8EE] focus:border-[#3182F6]'}`}
                />
                <p className={`mt-2.5 text-[14px] ${showErrors && !phone.trim() ? 'text-[#FF4D4F]' : 'text-[#9AA3B0]'}`}>{showErrors && !phone.trim() ? '연락처를 입력해주세요' : '가능 MC와 견적을 안내드릴 연락처'}</p>
              </div>

              {/* 행사 예정일 (데이트 피커) / 지역 */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">행사 예정일 <span className="text-[13px] font-medium text-[#9AA3B0]">(선택)</span></label>
                <input type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} className="mt-2 w-full border-b-2 border-[#E5E8EE] bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] outline-none focus:border-[#3182F6]" style={{ colorScheme: 'light' }} />
              </div>
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">행사 지역 <span className="text-[13px] font-medium text-[#9AA3B0]">(선택)</span></label>
                <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예) 서울 강남 / 호텔 미정" className="mt-2 w-full border-b-2 border-[#E5E8EE] bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none focus:border-[#3182F6]" />
              </div>

              {/* 행사 기획 설명 (멀티라인) */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">행사 기획 설명 <span className="text-[13px] font-medium text-[#9AA3B0]">(선택)</span></label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  placeholder={'행사 목적·규모·진행 순서·요청 사항 등\n자유롭게 적어주시면 더 정확히 안내드려요.'}
                  className="mt-2 w-full resize-none rounded-[16px] border-2 border-[#ECEEF2] bg-white px-[18px] py-4 text-[16px] leading-[1.6] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none transition focus:border-[#3182F6]"
                />
              </div>

              {/* 첨부파일 */}
              <div>
                <label className="block text-[15px] font-bold text-[#1A1A1A]">첨부파일 <span className="text-[13px] font-medium text-[#9AA3B0]">(선택)</span></label>
                <input
                  ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.hwp,.xls,.xlsx"
                  onChange={(e) => handleAttach(e.target.files?.[0])}
                />
                {attachment ? (
                  <div className="mt-2 flex items-center gap-3 rounded-[16px] border-2 border-[#3182F6] bg-[rgba(49,130,246,0.06)] px-[18px] py-3.5">
                    <Paperclip size={18} className="shrink-0 text-[#3182F6]" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#1F6FE5]">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="shrink-0 text-[#8B95A1] transition hover:text-[#4E5968]">
                      <X size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button" onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#D5DAE2] bg-[#FAFBFC] text-[15px] font-semibold text-[#4E5968] transition active:scale-[0.98] hover:border-[#3182F6] hover:text-[#3182F6]"
                  >
                    <Paperclip size={17} className="shrink-0" />
                    행사 기획서·참고 자료 첨부
                  </button>
                )}
                <p className="mt-2 text-[13px] text-[#9AA3B0]">이미지·PDF·문서 파일 · 8MB 이하</p>
              </div>

              {/* 개인정보 동의 */}
              <div>
                <label className="flex cursor-pointer items-center justify-center gap-3 pt-1">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="sr-only" />
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-colors" style={{ borderColor: consent ? '#3182F6' : (showErrors && !consent ? '#FF4D4F' : '#D5DAE2'), backgroundColor: consent ? '#3182F6' : 'transparent' }}>
                    {consent && <Check size={16} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className={`text-[16px] ${showErrors && !consent ? 'text-[#FF4D4F]' : 'text-[#3A3F49]'}`}>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPolicyModal('privacy'); }}
                      className="font-semibold text-[#3182F6] underline underline-offset-2"
                    >개인정보 수집·이용</button>에 동의합니다.
                  </span>
                </label>
                {showErrors && !consent && <p className="mt-1.5 text-center text-[14px] text-[#FF4D4F]">개인정보 수집·이용에 동의해주세요</p>}
              </div>

              {/* 제출 */}
              <button
                type="submit" disabled={submitting}
                className={`h-[56px] w-full rounded-[16px] text-[17px] font-bold transition active:scale-[0.98] disabled:opacity-60 ${formValid ? 'bg-[#3182F6] hover:bg-[#4E83F6] text-white' : 'bg-[#F2F4F6] text-[#333D4B]'}`}
              >
                {submitting ? '접수 중…' : '가능 MC · 견적 무료 신청'}
              </button>
              <p className="text-center text-[12px] text-[#B0B8C1]">입력하신 정보는 MC 안내 목적으로만 사용됩니다.</p>

              {/* 행사 사회자 섭외 유의사항 */}
              <div className="rounded-[16px] bg-[#F2F4F6] px-5 py-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold text-[#031228]/70">행사 사회자 섭외 유의사항</h3>
                  <button type="button" onClick={() => setPolicyModal('notice')} className="shrink-0 text-[13px] font-semibold text-[#031228]/46 underline underline-offset-2">전체보기</button>
                </div>
                <ol className="mt-3.5 space-y-2.5">
                  {BOOKING_NOTICES.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[14px] leading-[1.6] text-[#031228]/70">
                      <span className="shrink-0 font-bold text-[#031228]/46">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </form>
          )}
        </section>

        <footer className="border-t border-[#F0EEE9] px-5 py-10 text-center">
          <p className="text-[11px] leading-relaxed text-[#B0B8C1]">© FREETIFUL · CORPORATE MC<br />본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.</p>
        </footer>
      </div>

      {/* 우하단 플로팅 — 글래스 툴팁 + 원형 섭외/상담 버튼 */}
      <div ref={fabWrapRef} className="fixed right-4 z-40 flex flex-col items-end gap-3 bottom-[max(20px,env(safe-area-inset-bottom))]">
        {/* 글래스 툴팁 — 흰 배경 위에선 검정 글자/아이콘 */}
        {fabTipOpen && (
          <button
            onClick={scrollToApply}
            className={`cmc-glass cmc-fab-tip flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold active:scale-95 md:text-[15px] ${fabOverDark ? 'text-white' : 'cmc-fab-tip--light text-[#191F28]'}`}
          >
            프리미엄 사회자 섭외
            <span className="text-[15px] leading-none opacity-80">+</span>
            <span
              role="button"
              tabIndex={0}
              aria-label="툴팁 닫기"
              onClick={(e) => { e.stopPropagation(); setFabTipOpen(false); }}
              className={`-mr-1.5 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full transition ${fabOverDark ? 'text-white/70 hover:bg-white/15 hover:text-white' : 'text-[#191F28]/50 hover:bg-black/10 hover:text-[#191F28]'}`}
            >
              <X size={13} strokeWidth={2.5} />
            </span>
          </button>
        )}
        {/* 원형 섭외/상담 버튼 */}
        <button
          onClick={scrollToApply}
          className="cmc-fab flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full text-white active:scale-95"
          aria-label="섭외 상담"
        >
          <span className="text-[15px] font-bold leading-none">섭외</span>
          <span className="my-1 h-px w-6 bg-white/45" />
          <span className="text-[15px] font-bold leading-none">상담</span>
        </button>
      </div>

      {/* 정책 모달 — 개인정보 수집·이용 / 섭외 유의사항 */}
      {policyModal && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45 animate-[cmcOverlayIn_0.25s_ease]" onClick={() => setPolicyModal(null)} />
          <div className="relative flex max-h-[86vh] w-full max-w-[520px] flex-col rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px] animate-[cmcSheetIn_0.32s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
              <h2 className="text-[19px] font-bold leading-[1.35] text-[#191F28]">
                {policyModal === 'privacy' ? '개인정보 수집·이용 동의' : '행사 사회자 섭외 유의사항'}
              </h2>
              <button type="button" onClick={() => setPolicyModal(null)} aria-label="닫기" className="-mr-1.5 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition hover:bg-gray-100 hover:text-[#4E5968]">
                <X size={20} strokeWidth={2.4} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {policyModal === 'privacy' ? (
                <div className="space-y-4 pb-4">
                  {PRIVACY_SECTIONS.map((s, i) => (
                    <div key={i}>
                      <p className="text-[14.5px] font-bold text-[#031228]/85">{s.heading}</p>
                      <p className="mt-1 text-[14px] leading-[1.65] text-[#031228]/62">{s.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="space-y-3 pb-4">
                  {BOOKING_NOTICES.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[14.5px] leading-[1.65] text-[#031228]/70">
                      <span className="shrink-0 font-bold text-[#031228]/46">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => { if (policyModal === 'privacy') setConsent(true); setPolicyModal(null); }}
                className="h-[54px] w-full rounded-[16px] bg-[#3182F6] text-[16px] font-bold text-white transition active:scale-[0.98]"
              >
                {policyModal === 'privacy' ? '동의하고 닫기' : '확인'}
              </button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes cmcOverlayIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes cmcSheetIn { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
          ` }} />
        </div>
      )}
    </main>
  );
}

// freetiful 로고 — 워드마크(reetiful)는 currentColor로 히어로=흰색 / 스크롤=검정 토글, f 마크는 브랜드 컬러 고정
function FreetifulLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 472 137" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="freetiful">
      <g fill="currentColor">
        <path d="M420.394 118.653C420.009 118.955 419.702 119.346 419.499 119.791C416.623 124.256 412.391 127.678 407.426 129.555C405.18 130.411 402.817 130.922 400.419 131.073C397.772 131.281 395.11 131.099 392.516 130.534C387.117 129.278 383.389 126.056 381.236 120.972C380.15 118.271 379.462 115.427 379.196 112.529C378.995 110.599 378.903 108.659 378.919 106.719C378.919 98.3711 378.919 90.0231 378.919 81.6751C378.894 80.7063 378.967 79.7375 379.139 78.7837C379.71 76.0113 381.29 73.5502 383.573 71.8782C385.856 70.2063 388.678 69.4428 391.491 69.736C394.304 70.0292 396.909 71.3581 398.798 73.4648C400.687 75.5715 401.727 78.3056 401.715 81.1363C401.738 83.2005 401.715 85.2685 401.715 87.3328C401.715 91.9293 401.715 96.5245 401.715 101.118C401.718 103.397 402.065 105.663 402.743 107.839C403.053 108.846 403.484 109.812 404.028 110.715C404.48 111.479 405.055 112.162 405.731 112.737C406.692 113.574 407.898 114.078 409.169 114.174C410.44 114.27 411.708 113.952 412.784 113.269C413.917 112.53 414.886 111.567 415.631 110.438C417.062 108.292 418.014 105.863 418.422 103.315C418.623 102.061 418.709 100.791 418.68 99.5209C418.68 93.3661 418.68 87.2114 418.68 81.0566C418.649 78.0375 419.817 75.1296 421.929 72.9727C424.04 70.8158 426.921 69.5865 429.938 69.5553C432.955 69.5241 435.861 70.6935 438.016 72.8063C440.172 74.9191 441.4 77.8022 441.431 80.8213C441.431 81.0756 441.431 81.3298 441.431 81.5802C441.431 97.0114 441.431 112.443 441.431 127.874C441.431 129.684 441.647 129.43 439.914 129.433C433.893 129.433 427.871 129.433 421.85 129.433H421.221C420.39 129.433 420.379 129.433 420.375 128.58C420.375 125.751 420.375 122.927 420.375 120.106L420.394 118.653Z"/>
        <path d="M227.76 105.131C223.297 105.131 218.834 105.131 214.371 105.131C213.112 105.131 213.234 105.203 213.31 106.224C213.373 108.123 213.758 109.998 214.447 111.768C214.743 112.511 215.125 113.216 215.585 113.87C216.193 114.76 216.978 115.513 217.892 116.083C218.806 116.654 219.828 117.028 220.893 117.183C224.12 117.726 227.436 117.147 230.289 115.544C231.165 115.039 232.009 114.48 232.815 113.87C233.425 113.422 234.047 112.99 234.676 112.565C238.468 110.007 243.8 111.772 245.536 116.211C246.201 117.825 246.296 119.618 245.805 121.293C245.315 122.968 244.267 124.426 242.837 125.425C239.872 127.52 236.554 129.063 233.042 129.978C230.105 130.732 227.088 131.133 224.056 131.173C220.182 131.298 216.31 130.897 212.544 129.982C207.557 128.722 203.087 126.48 199.325 122.92C196.359 120.143 194.075 116.717 192.652 112.91C189.447 104.354 189.353 95.7626 192.792 87.2552C194.758 82.2658 198.059 77.9149 202.334 74.6803C206.609 71.4458 211.693 69.4527 217.025 68.9199C222.36 68.3298 227.759 68.9591 232.815 70.7603C239.158 73.037 243.853 77.2566 246.954 83.2444C248.888 86.9546 250.098 90.9997 250.519 95.1631C250.871 98.6806 249.381 101.473 246.496 103.511C244.778 104.718 242.818 105.131 240.755 105.139C237.892 105.139 235.029 105.139 232.166 105.139L227.76 105.131ZM214.03 91.3989C214.335 91.5466 214.679 91.5918 215.012 91.5279H227.256C228.617 91.5279 228.393 91.5051 228.185 90.3516C227.89 88.5151 227.221 86.7586 226.221 85.191C225.049 83.4455 223.46 82.4058 221.322 82.2692C219.285 82.144 217.602 82.7928 216.343 84.4321C215.911 85.0048 215.551 85.6279 215.27 86.2876C214.785 87.4092 214.431 88.5832 214.216 89.7862C214.11 90.3175 213.886 90.8373 214.03 91.3989Z"/>
        <path d="M163.239 105.132H150.229C149.892 105.132 149.554 105.132 149.217 105.132C148.88 105.132 148.785 105.265 148.792 105.614C148.834 107.997 149.198 110.316 150.267 112.475C151.667 115.298 153.904 116.937 157.062 117.26C158.36 117.405 159.672 117.383 160.964 117.195C163.301 116.821 165.517 115.897 167.429 114.501C168.29 113.894 169.128 113.256 170.004 112.672C170.865 112.061 171.85 111.648 172.889 111.461C174.61 111.237 176.356 111.6 177.845 112.491C179.334 113.382 180.48 114.75 181.097 116.373C181.714 117.995 181.766 119.779 181.246 121.435C180.725 123.092 179.662 124.524 178.228 125.501C175.038 127.717 171.457 129.308 167.676 130.191C165.007 130.797 162.282 131.123 159.546 131.163C156.053 131.275 152.559 130.971 149.137 130.256C145.168 129.435 141.399 127.836 138.05 125.551C133.223 122.204 129.894 117.7 127.877 112.205C126.893 109.467 126.257 106.617 125.981 103.721C125.469 99.0973 125.925 94.418 127.319 89.9805C129.829 82.0765 134.607 76.0014 141.978 72.0892C145.381 70.3018 149.107 69.2154 152.937 68.8942C157.601 68.4485 162.306 68.915 166.792 70.2678C174.414 72.5749 179.828 77.4243 183.139 84.6492C184.619 87.9157 185.59 91.3902 186.017 94.9514C186.601 99.5807 183.362 104.058 178.509 104.946C177.679 105.093 176.838 105.164 175.995 105.159C171.74 105.136 167.489 105.127 163.239 105.132ZM156.573 91.5515H162.64C162.936 91.5515 163.232 91.5515 163.524 91.5515C163.816 91.5515 163.869 91.3655 163.827 91.1189C163.585 89.4046 163.073 87.7396 162.31 86.186C161.709 84.9223 160.759 83.8571 159.572 83.1162C158.248 82.2976 156.654 82.0376 155.139 82.3932C153.623 82.7488 152.311 83.6911 151.488 85.0134C150.294 86.9107 149.824 89.0471 149.482 91.2175C149.475 91.2593 149.477 91.3022 149.488 91.3431C149.5 91.3839 149.52 91.4217 149.548 91.4534C149.577 91.4852 149.611 91.5102 149.651 91.5265C149.69 91.5428 149.732 91.5501 149.774 91.5477C150.066 91.5666 150.362 91.5667 150.658 91.5667L156.573 91.5515Z"/>
        <path d="M360.985 106.384V127.88C360.985 128.26 360.985 128.639 360.985 129.018C360.988 129.07 360.981 129.122 360.963 129.171C360.945 129.219 360.918 129.264 360.882 129.302C360.847 129.339 360.804 129.369 360.756 129.39C360.709 129.41 360.658 129.421 360.606 129.421C360.356 129.421 360.102 129.421 359.847 129.421H339.372C338.181 129.421 338.234 129.519 338.234 128.244C338.234 113.744 338.234 99.2451 338.234 84.7474C338.234 84.368 338.234 83.9885 338.234 83.609C338.236 83.5458 338.225 83.4828 338.2 83.4245C338.175 83.3663 338.138 83.3141 338.091 83.2718C338.044 83.2295 337.988 83.198 337.928 83.1795C337.867 83.1611 337.804 83.1561 337.741 83.1651C337.237 83.1651 336.732 83.1651 336.224 83.1385C334.749 83.0963 333.329 82.5718 332.18 81.6453C331.031 80.7188 330.217 79.4412 329.862 78.0079C329.507 76.5746 329.632 75.0644 330.216 73.7084C330.8 72.3524 331.811 71.225 333.096 70.4988C334.05 69.9504 335.128 69.654 336.228 69.6375C336.732 69.6375 337.237 69.6375 337.745 69.6375C337.808 69.6465 337.872 69.6415 337.933 69.6228C337.993 69.6042 338.049 69.5723 338.096 69.5296C338.144 69.4868 338.181 69.4342 338.205 69.3754C338.229 69.3167 338.241 69.2533 338.238 69.1897C338.238 68.852 338.238 68.5143 338.238 68.1766C338.238 65.9871 338.238 63.7939 338.238 61.6006C338.228 59.1548 338.599 56.7224 339.337 54.391C340.911 49.5491 344.092 46.2365 348.844 44.4416C351.576 43.4333 354.466 42.9194 357.379 42.9238C360.913 42.8897 364.451 42.9466 367.996 42.9048C369.783 42.8822 371.506 43.5709 372.786 44.8194C374.065 46.068 374.797 47.7741 374.82 49.5624C374.842 51.3507 374.154 53.0748 372.906 54.3554C371.659 55.6359 369.954 56.368 368.167 56.3907C367.367 56.3952 366.571 56.4984 365.797 56.698C362.938 57.5101 361.413 59.8096 361.076 62.3595C361.029 62.8209 361.01 63.2847 361.019 63.7483C361.019 65.2244 361.019 66.7005 361.019 68.1766C361.019 69.7855 360.848 69.6261 362.536 69.6299C364.345 69.6299 366.157 69.6299 367.966 69.6299C369.025 69.608 370.073 69.8475 371.017 70.3274C371.962 70.8072 372.773 71.5125 373.381 72.381C374.939 74.5438 375.174 76.9116 374.018 79.3136C373.531 80.4238 372.736 81.3712 371.728 82.0437C370.72 82.7162 369.541 83.0856 368.33 83.1082C366.358 83.2106 364.375 83.1423 362.396 83.1537C360.921 83.1537 361.019 82.9829 361.019 84.4894L360.985 106.384Z"/>
        <path d="M259.744 97.7846V84.7617C259.744 84.4239 259.744 84.0862 259.744 83.7485C259.744 83.2742 259.638 83.1945 259.122 83.1793C258.607 83.1641 258.197 83.1793 257.735 83.1566C256.195 83.106 254.719 82.5304 253.551 81.5252C252.383 80.5201 251.593 79.1457 251.312 77.6298C251.032 76.1139 251.277 74.5476 252.008 73.1905C252.739 71.8333 253.911 70.7669 255.331 70.1678C256.067 69.8516 256.858 69.6803 257.659 69.6631C258.163 69.6631 258.671 69.6631 259.176 69.6404C259.68 69.6176 259.744 69.5265 259.744 69.0142C259.744 66.7375 259.744 64.4608 259.744 62.184C259.728 60.3234 260.154 58.4855 260.988 56.8224C262.072 54.6978 263.793 52.9665 265.911 51.8719C268.029 50.7773 270.437 50.3745 272.795 50.7199C275.153 51.0654 277.344 52.1419 279.06 53.798C280.775 55.4541 281.929 57.6066 282.359 59.9529C282.494 60.7844 282.554 61.6263 282.541 62.4686C282.564 64.4494 282.541 66.4302 282.541 68.4109C282.541 68.7069 282.541 69.0029 282.575 69.2951C282.578 69.3803 282.613 69.4613 282.674 69.5212C282.734 69.5812 282.816 69.6157 282.901 69.6176C283.193 69.6404 283.489 69.6441 283.785 69.6441H289.472C290.401 69.6236 291.324 69.8062 292.175 70.1791C293.027 70.552 293.786 71.1063 294.402 71.8032C296.298 73.913 296.76 76.3567 295.691 78.9674C295.253 80.1693 294.463 81.211 293.424 81.9558C292.385 82.7006 291.145 83.1139 289.867 83.1414C287.937 83.2552 285.995 83.1755 284.058 83.1907C282.438 83.1907 282.541 82.9706 282.541 84.644C282.541 92.4418 282.601 100.24 282.514 108.034C282.473 111.752 284.755 114.515 288.278 115.513C289.333 115.81 290.424 115.953 291.52 115.938C292.149 115.938 292.783 115.938 293.416 115.938C293.479 115.931 293.543 115.939 293.602 115.96C293.662 115.981 293.716 116.016 293.761 116.061C293.805 116.106 293.839 116.161 293.859 116.221C293.88 116.281 293.886 116.345 293.878 116.408C293.878 116.575 293.878 116.746 293.878 116.913V128.418C293.878 128.631 293.878 128.839 293.878 129.048C293.879 129.101 293.868 129.154 293.846 129.202C293.825 129.251 293.794 129.295 293.754 129.331C293.715 129.366 293.669 129.393 293.618 129.41C293.568 129.427 293.514 129.433 293.461 129.427H292.957C288.536 129.427 284.114 129.48 279.686 129.408C276.696 129.4 273.727 128.917 270.888 127.978C268.637 127.25 266.573 126.035 264.844 124.419C262.509 122.187 261.174 119.421 260.457 116.321C259.961 114.098 259.721 111.825 259.74 109.548C259.748 105.627 259.749 101.706 259.744 97.7846Z"/>
        <path d="M471.435 91.0004C471.435 103.31 471.435 115.618 471.435 127.925C471.435 129.621 471.621 129.443 469.983 129.443H450.155C449.859 129.443 449.567 129.443 449.272 129.443C448.779 129.424 448.71 129.352 448.692 128.836C448.692 128.54 448.692 128.244 448.692 127.948C448.692 103.546 448.692 79.1424 448.692 54.7358C448.634 52.5339 449.194 50.3599 450.307 48.4597C451.485 46.4955 453.226 44.9316 455.304 43.9717C457.383 43.0118 459.701 42.7003 461.959 43.0779C464.217 43.4554 466.309 44.5044 467.962 46.0883C469.616 47.6722 470.755 49.7176 471.23 51.9582C471.394 52.7851 471.468 53.6274 471.45 54.4702C471.437 66.6432 471.432 78.8199 471.435 91.0004Z"/>
        <path d="M94.7915 80.5492C95.1762 80.3373 95.4941 80.0218 95.7091 79.6385C97.8805 76.7781 100.545 74.3288 103.577 72.4061C107.559 69.8981 112.191 68.6192 116.894 68.7292C120.307 68.7937 123.006 70.2091 124.751 73.184C125.797 74.8908 126.224 76.9056 125.962 78.8905C125.7 80.8754 124.763 82.7097 123.31 84.0858C122.59 84.795 121.822 85.4543 121.012 86.0589C117.831 88.2939 114.517 88.3357 111.134 86.5257C110.404 86.1022 109.726 85.5926 109.117 85.0078C108.244 84.2056 107.176 83.6469 106.019 83.3876C104.006 82.955 102.273 83.5355 100.764 84.8636C99.8529 85.6861 99.1133 86.6803 98.5871 87.7892C97.5565 89.9647 96.9246 92.3077 96.7215 94.7067C96.5669 96.2195 96.496 97.7396 96.5092 99.2602C96.5092 108.873 96.5092 118.486 96.5092 128.099C96.5092 129.617 96.6381 129.461 95.1631 129.461H74.9526C73.6596 129.461 73.7089 129.567 73.7089 128.239C73.7089 115.844 73.7089 103.448 73.7089 91.0526C73.7089 87.258 73.7089 83.4634 73.7089 79.6689C73.6751 77.8065 74.1093 75.9655 74.9715 74.3148C76.0693 72.2638 77.8142 70.6338 79.9344 69.679C82.0546 68.7242 84.4309 68.4981 86.6928 69.0361C88.9548 69.5741 90.9754 70.8458 92.4396 72.6531C93.9038 74.4604 94.7294 76.7017 94.7877 79.0276C94.799 79.464 94.7915 79.9231 94.7915 80.5492Z"/>
        <path d="M324.335 104.663C324.335 112.417 324.335 120.169 324.335 127.92C324.335 129.631 324.502 129.438 322.886 129.438C316.238 129.438 309.59 129.438 302.941 129.438C301.425 129.438 301.554 129.665 301.554 127.996V106.746C301.554 98.2768 301.554 89.8086 301.554 81.3417C301.554 78.6855 302.228 76.238 303.882 74.151C306.892 70.3565 310.855 68.888 315.542 69.977C320.228 71.0661 323.015 74.151 324.119 78.7728C324.294 79.5969 324.373 80.4386 324.354 81.281C324.331 89.0725 324.325 96.8665 324.335 104.663Z"/>
        <path d="M312.914 42.9332C313.547 42.9332 314.177 42.9332 314.81 42.9332C318.86 42.8459 323.296 45.9233 324.184 50.9018C324.606 53.3105 324.104 55.7899 322.779 57.8447C321.454 59.8995 319.403 61.3783 317.036 61.9856C316.794 62.0536 316.549 62.1068 316.3 62.145C314.169 62.4024 312.014 62.4113 309.881 62.1716C307.644 61.8562 305.588 60.768 304.068 59.0955C302.549 57.4229 301.662 55.2713 301.561 53.0131C301.459 50.7549 302.15 48.5324 303.514 46.7304C304.878 44.9284 306.828 43.6603 309.028 43.1457C309.681 42.9924 310.351 42.916 311.022 42.918L312.914 42.9332Z"/>
      </g>
      <path d="M29.5977 98.7611C29.3892 99.1937 29.4954 99.6604 29.4954 100.108C29.4954 108.203 29.4954 116.298 29.4954 124.393C29.505 126.426 29.0002 128.429 28.0279 130.214C26.844 132.373 25.0078 134.101 22.7822 135.152C20.5567 136.202 18.056 136.521 15.6384 136.063C13.2207 135.604 11.0101 134.391 9.32328 132.598C7.63641 130.806 6.55979 128.525 6.24763 126.082C6.17689 125.498 6.14018 124.91 6.13766 124.321C6.13766 105.307 6.08079 86.2922 6.15662 67.2777C6.18696 58.7248 9.39864 51.4355 15.5793 45.5084C19.0906 42.1426 23.2047 39.7103 27.6829 37.8585C32.1755 36.0448 36.8711 34.7821 41.6672 34.0981C46.2508 33.4368 50.8763 33.1084 55.5073 33.1153C58.5258 33.1398 61.4174 34.3341 63.5745 36.4471C65.7316 38.5602 66.9864 41.4277 67.0752 44.4472C67.1641 47.4666 66.0801 50.403 64.0509 52.6394C62.0218 54.8759 59.2055 56.2383 56.1937 56.4405C54.9348 56.5088 53.6721 56.5088 52.4018 56.5543C48.1066 56.652 43.839 57.2686 39.6916 58.3909C37.9442 58.8695 36.2524 59.5322 34.6447 60.3678C33.7872 60.8191 32.9757 61.3529 32.2217 61.9615C30.4509 63.3921 29.4385 65.2097 29.4537 67.5282C29.4437 68.1619 29.4741 68.7956 29.5447 69.4254C29.7765 71.1135 30.6447 72.649 31.9714 73.7171C33.5419 74.998 35.3443 75.9642 37.28 76.563C40.1993 77.5364 43.2579 78.026 46.3349 78.0125C46.9226 78.0125 47.5104 77.9252 48.0981 77.8873C53.1526 77.5382 57.1227 79.4431 59.6101 83.8789C60.4888 85.4488 60.9917 87.2012 61.0791 88.9985C61.1666 90.7957 60.8363 92.5888 60.1142 94.2367C59.3921 95.8846 58.2978 97.3424 56.9175 98.4955C55.5372 99.6486 53.9084 100.466 52.1592 100.882C51.0513 101.136 49.9206 101.277 48.7844 101.303C46.002 101.443 43.213 101.367 40.4424 101.076C37.0977 100.697 33.7966 100 30.5836 98.9964C30.2739 98.8532 29.9387 98.7732 29.5977 98.7611Z" fill="#0B58FF"/>
      <path d="M15.7396 31.976C7.51127 32.124 -0.00414451 25.2749 0.00723099 16.2324C-0.0566679 14.1233 0.303467 12.0228 1.06626 10.0556C1.82906 8.08835 2.97897 6.29453 4.44777 4.78054C5.91656 3.26656 7.6743 2.06326 9.61667 1.24205C11.559 0.42085 13.6465 -0.00152127 15.7551 4.11696e-06C17.8637 0.0015295 19.9505 0.426917 21.8917 1.25093C23.8329 2.07494 25.5889 3.28078 27.0555 4.79689C28.5221 6.31301 29.6694 8.1085 30.4294 10.0768C31.1893 12.0451 31.5464 14.1461 31.4795 16.2552C31.4757 25.2862 24.0247 32.1316 15.7396 31.976Z" fill="#68DEFF"/>
    </svg>
  );
}

// 후기 본문 하이라이트 — **...** 를 연보라 배경 강조로 렌더
function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((s, i) => (i % 2 === 1
        ? <mark key={i} className="rounded-[5px] bg-[#E6EBFB] px-[3px] py-[1.5px] font-bold text-[#3A4353]">{s}</mark>
        : <span key={i}>{s}</span>))}
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Allura&display=swap');
@font-face{font-family:'Condor';src:url('/fonts/Condor-Regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Condor';src:url('/fonts/Condor-Medium.otf') format('opentype');font-weight:500;font-style:normal;font-display:swap}
.cmc{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Apple SD Gothic Neo',Pretendard,system-ui,sans-serif;overflow-x:clip}
/* 영어 subtitle — Condor 폰트(대문자·자간) */
.cmc .cmc-script{font-family:'Condor',-apple-system,sans-serif;font-weight:500;letter-spacing:0.04em}
.cmc .cmc-condor{font-family:'Condor',-apple-system,sans-serif;font-weight:400;text-transform:uppercase}
.cmc-reveal{opacity:0;transform:translateY(30px);transition:opacity 1s cubic-bezier(.22,1,.36,1),transform 1s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.cmc-reveal.cmc-in{opacity:1;transform:none}
/* 텍스트 팝 — opacity0 + 크게(scale1.18)였다가 적정크기로 자리잡으며 등장 */
.cmc-pop{opacity:0;transform:scale(1.18);transform-origin:center;transition:opacity .85s cubic-bezier(.22,1,.36,1),transform .85s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.cmc-pop.cmc-in{opacity:1;transform:none}
/* 마퀴 카드 — 섹션 진입 시 하단에서 순차적으로 촤라락 */
.cmc-rise{opacity:0;transform:translateY(70px);transition:opacity .75s cubic-bezier(.22,1,.36,1),transform .75s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.cmc-riser.cmc-in .cmc-rise{opacity:1;transform:none}
/* 교차 섹션 흩뿌림 사진 — 중앙에서 랜덤 위치로 촤라락 퍼짐 */
.cmc-scatter{opacity:0;transform:translate(var(--fx,0),var(--fy,0)) scale(.72);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .95s cubic-bezier(.34,1.28,.5,1);will-change:opacity,transform}
.cmc-riser.cmc-in .cmc-scatter{opacity:1;transform:translate(0,0) scale(1)}
/* 스태거 지연 — 카드/스텝이 순차적으로 떠오름 */
.cmc-d1{transition-delay:.07s}.cmc-d2{transition-delay:.14s}.cmc-d3{transition-delay:.21s}.cmc-d4{transition-delay:.28s}.cmc-d5{transition-delay:.35s}
.cmc-d6{transition-delay:.42s}.cmc-d7{transition-delay:.49s}.cmc-d8{transition-delay:.56s}
@media (prefers-reduced-motion:reduce){.cmc-reveal,.cmc-pop,.cmc-rise{opacity:1;transform:none;transition:none}}
.cmc-track{scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none}
.cmc-track::-webkit-scrollbar{display:none}
.cmc-track>*{scroll-snap-align:start}
.cmc-arrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;border:1px solid #EEF1F4;background:#fff;color:#191F28;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 6px 16px -8px rgba(0,0,0,.3)}
/* 글래스 버튼 — 고급 유리 질감 */
.cmc-glass{position:relative;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);box-shadow:0 8px 32px -8px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.4);overflow:hidden;transition:background .25s,border-color .25s,transform .15s}
.cmc-glass::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,0.35),transparent 42%);pointer-events:none;opacity:.7}
.cmc-glass:hover{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.42)}
.cmc-glass-primary{background:rgba(49,130,246,0.28);border-color:rgba(255,255,255,0.38);box-shadow:0 10px 34px -8px rgba(49,130,246,0.55),inset 0 1px 0 rgba(255,255,255,0.5)}
.cmc-glass-primary:hover{background:rgba(49,130,246,0.4)}
/* 우하단 플로팅 — 원형 섭외/상담 버튼(브랜드 블루) + 글래스 툴팁 */
.cmc-fab{background:linear-gradient(150deg,#3F8DFF 0%,#2F72E6 100%);box-shadow:0 14px 30px -8px rgba(49,128,247,0.6),0 4px 12px -4px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.35);transition:transform .15s,box-shadow .25s;animation:cmcFabPulse 2.8s ease-in-out infinite}
.cmc-fab:hover{box-shadow:0 18px 38px -8px rgba(49,128,247,0.7),0 4px 12px -4px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.4)}
@keyframes cmcFabPulse{0%,100%{box-shadow:0 14px 30px -8px rgba(49,128,247,0.6),0 0 0 0 rgba(49,128,247,0.32),inset 0 1px 0 rgba(255,255,255,0.35)}50%{box-shadow:0 14px 30px -8px rgba(49,128,247,0.6),0 0 0 12px rgba(49,128,247,0),inset 0 1px 0 rgba(255,255,255,0.35)}}
/* 툴팁: 등장 + 은은히 위아래로 떠 있는 느낌 */
.cmc-fab-tip{background:rgba(49,130,246,0.34);border-color:rgba(255,255,255,0.4);box-shadow:0 10px 30px -10px rgba(49,128,247,0.5),inset 0 1px 0 rgba(255,255,255,0.45);animation:cmcTipIn .5s cubic-bezier(.19,1,.22,1) both,cmcTipBob 3.2s ease-in-out .6s infinite;white-space:nowrap}
/* 흰 배경 위 툴팁 — 흰 글래스 + 검정 글자 */
.cmc-fab-tip--light{background:rgba(255,255,255,0.72);border-color:rgba(0,0,0,0.08);box-shadow:0 12px 30px -10px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.9)}
@keyframes cmcTipIn{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes cmcTipBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
/* 교차 이미지 섹션 — 처음엔 텍스트에 겹쳤다가 스크롤 내리며 텍스트 섹션 높이만큼 촥 벌어짐(--spread:0→1, --open=텍스트 높이 절반+여유) */
.cmc-cross-sec{--spread:0;--open:180px}
.cmc-cross-img{will-change:transform;transition:transform .12s linear}
.cmc-cross-a{transform:translateY(calc((1 - var(--spread)) * 84px - var(--spread) * var(--open)))}
.cmc-cross-b{transform:translateY(calc(-1 * ((1 - var(--spread)) * 84px - var(--spread) * var(--open))))}
/* 프로필 카드 하단 그라데이션 블러 — 아래는 살짝 흐리게, 위로 갈수록 선명(약하게) */
/* 카드 하단 페이드 — 모바일은 backdrop-filter 가 스크롤 버벅임의 주범이라 그라데이션으로 대체, PC 만 블러 */
.cmc-blur-fade{background:linear-gradient(to top,rgba(255,255,255,0.85),rgba(255,255,255,0) 80%);pointer-events:none}
@media(min-width:768px){.cmc-blur-fade{background:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);-webkit-mask-image:linear-gradient(to top,#000 0%,#000 12%,transparent 100%);mask-image:linear-gradient(to top,#000 0%,#000 12%,transparent 100%)}}
/* 프로필 마퀴 — 자동으로 흐르는 캐러셀 */
.cmc-marquee{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.cmc-marquee-track{display:flex;gap:14px;width:max-content;animation:cmcMarquee 32s linear infinite}
/* 사회자 프로필 캐러셀 — 모바일에선 더 빠르게 흐름 */
@media (max-width:767px){.cmc-profile-track{animation-duration:19s}}
.cmc-marquee:hover .cmc-marquee-track{animation-play-state:paused}
@keyframes cmcMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* 후기 카드 캐러셀 — 큰 카드가 천천히 흐름, 호버 시 정지 */
.cmc-rev-track{display:flex;gap:18px;width:max-content;padding:0 18px;align-items:stretch;animation:cmcMarquee 90s linear infinite}
.cmc-marquee:hover .cmc-rev-track{animation-play-state:paused}
/* PC 풀블리드 — max-w 컨테이너 벗어나 뷰포트 가로폭 전체 사용 */
@media(min-width:768px){.cmc-bleed-md{width:100vw;margin-left:calc(50% - 50vw)}}
/* 스크롤 시 전체화면으로 채워지는 영상 (--vp:0=작은 카드 → 1=풀스크린) */
.cmc-vidsec{--vp:0;width:100vw;margin-left:calc(50% - 50vw)}
.cmc-vidbox{width:calc(92vw + 8vw * var(--vp));height:calc(74svh + 26svh * var(--vp));max-width:100vw;border-radius:calc(22px * (1 - var(--vp)));transition:none;will-change:width,height,border-radius}
/* 방송 3사 덱 → 양옆 펼침 (--bsp:0=겹친 덱 → 1=펼쳐진 3장) */
.cmc-bspread{--bsp:0}
.cmc-bcard{position:absolute;left:50%;top:0;width:264px;height:100%;margin-left:-132px;overflow:hidden;will-change:transform;--bsx:min(calc(100% + 18px),31vw)}
.cmc-bcard img{display:block;width:100%;height:100%;object-fit:cover}
.cmc-bc-l{z-index:10;transform:translateX(calc(var(--bsx) * var(--bsp) * -1)) rotate(calc(-5deg * (1 - var(--bsp)))) scale(calc(0.96 + 0.04 * var(--bsp)))}
.cmc-bc-r{z-index:20;transform:translateX(calc(var(--bsx) * var(--bsp))) rotate(calc(5deg * (1 - var(--bsp)))) scale(calc(0.96 + 0.04 * var(--bsp)))}
.cmc-bc-c{z-index:30}
/* 성장 지표 다이얼 — 첨부 우주 이미지 배경 + 스크롤에 맞춰 수치가 중앙에 스냅 */
.cmc-stats-sec{position:relative;color:#fff;background:#000;--stats-per:0.55}
.cmc-stats-sticky{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;isolation:isolate;contain:paint}
.cmc-stats-bg{position:absolute;inset:0;overflow:hidden;background:#03060F url('/images/corporate-mc/stats-cosmos-bg.png') center center / cover no-repeat}
/* 중앙 텍스트 가독성용 은은한 딤 — 이미지 위 수치가 파묻히지 않게 */
.cmc-stats-bg::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 42% at 50% 50%,rgba(3,8,26,0.55) 0%,rgba(3,8,26,0.28) 45%,transparent 72%)}
.cmc-stats-inner{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;padding:calc(env(safe-area-inset-top,0px) + 8vh) 20px 8vh}
.cmc-stats-heading{text-align:center}
@media (min-width:768px){.cmc-stats-sec{--stats-per:0.7}}
.cmc-stats-dial{position:absolute;left:0;right:0;top:50%;height:0;pointer-events:none;perspective:620px;perspective-origin:50% 50%;transform-style:preserve-3d}
/* 스크롤 구동 값이라 transform 에는 transition 을 걸지 않는다(걸면 스크롤을 못 따라와 "두두둑" 랙 발생). opacity 만 살짝. */
.cmc-stat-row{position:absolute;left:50%;top:0;transform:translate(-50%,calc(var(--y,0px) - 50%)) rotateX(var(--rx,0deg)) scale(var(--s,1));transform-origin:center center;opacity:var(--o,0);text-align:center;white-space:nowrap;transition:opacity .12s linear;display:flex;flex-direction:column;align-items:center;gap:6px;backface-visibility:hidden;will-change:transform,opacity}
.cmc-stat-val{font-size:46px;font-weight:800;letter-spacing:-0.03em;color:rgba(210,225,255,0.52);line-height:1;text-shadow:0 1px 10px rgba(0,6,22,0.4)}
.cmc-stat-lbl{font-size:15px;font-weight:500;color:rgba(195,212,238,0.6);letter-spacing:-0.01em;text-shadow:0 1px 6px rgba(0,6,22,0.45)}
.cmc-stat-row.is-active .cmc-stat-val{color:#fff;text-shadow:0 1px 14px rgba(0,6,22,0.5),0 0 34px rgba(120,170,255,0.28)}
.cmc-stat-row.is-active .cmc-stat-lbl{color:rgba(225,234,248,0.98);text-shadow:0 1px 8px rgba(0,6,22,0.5)}
@media (min-width:768px){.cmc-stat-val{font-size:66px}.cmc-stat-row.is-active .cmc-stat-val{font-size:88px}.cmc-stat-lbl{font-size:18px}.cmc-stat-row.is-active .cmc-stat-lbl{font-size:19px}}
/* 기업 로고 5줄 캐러셀 — 천천히 흐르는 신뢰 월 */
.cmc-logo-wall{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.cmc-logo-marquee{overflow:hidden}
.cmc-logo-track{display:flex;align-items:center;gap:44px;width:max-content;animation:cmcLogo 46s linear infinite}
.cmc-logo-rev{animation-direction:reverse}
@keyframes cmcLogo{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.cmc-logo-item{flex:none;height:30px;display:flex;align-items:center;opacity:.5;filter:grayscale(1)}
.cmc-logo-item img{max-height:30px}
@media (min-width:768px){.cmc-logo-item{height:38px}.cmc-logo-item img{max-height:38px}}
/* 타이틀 내 파란색이 넓게 퍼져 천천히 흐르는 고급 애니메이션 */
.cmc-flow{background:linear-gradient(100deg,#111 0%,#111 22%,#5AA0F0 36%,#3182F6 50%,#5AA0F0 64%,#111 78%,#111 100%);background-size:340% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;animation:cmcFlow 8.5s linear infinite}
@keyframes cmcFlow{from{background-position:170% 0}to{background-position:-170% 0}}
.cmc-ticker{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.cmc-ticker-track{display:flex;white-space:nowrap;width:max-content;animation:cmcTicker 24s linear infinite}
@keyframes cmcTicker{to{transform:translateX(-50%)}}
@keyframes cmcRise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
/* 고급 진입: 블러가 걷히며 살짝 확대→정착하는 시네마틱 리빌 */
@keyframes cmcReveal{from{opacity:0;transform:translateY(34px) scale(1.06);filter:blur(18px)}to{opacity:1;transform:none;filter:blur(0)}}
/* 첫 진입 커튼: 검은 막이 위로 걷히며 배경(영상) 노출 */
@keyframes cmcCurtain{0%{opacity:1}60%{opacity:1}100%{opacity:0;clip-path:inset(0 0 100% 0)}}
/* 배경 영상 슬로우 줌(켄 번스) */
@keyframes cmcKen{from{transform:scale(1.12)}to{transform:scale(1)}}
.cmc-hero-curtain{animation:cmcCurtain 1.5s cubic-bezier(.65,0,.35,1) forwards}
.cmc-hero-video{animation:cmcKen 6s ease-out forwards;will-change:transform}
.cmc-hero-eyebrow{opacity:0;letter-spacing:.42em;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) .55s forwards,cmcTrackIn 1.4s cubic-bezier(.19,1,.22,1) .55s forwards}
@keyframes cmcTrackIn{to{letter-spacing:.1em}}
.cmc-hero-line{opacity:0;animation:cmcReveal 1.15s cubic-bezier(.19,1,.22,1) forwards}
.cmc-line-1{animation-delay:.7s}
.cmc-line-2{animation-delay:.92s}
.cmc-hero-sub{opacity:0;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) 1.3s forwards}
.cmc-hero-cta{opacity:0;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) 1.55s forwards}
@keyframes cmcBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
.cmc-scrollhint{opacity:0;animation:cmcRise .8s ease 1.9s forwards,cmcBounce 1.8s ease-in-out 1.9s infinite}
@keyframes cmcFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cmc-fade{animation:cmcFade .35s ease}
`;
