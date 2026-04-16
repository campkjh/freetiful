'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Phone, Share2, Heart, Play, ChevronDown, ChevronRight, ArrowUpRight, X, Check, Copy, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi } from '@/lib/api/discovery.api';
import { favoriteApi } from '@/lib/api/favorite.api';

// ─── Brand Color ────────────────────────────────────────────
const BRAND = '#3180F7';
const BRAND_LIGHT = '#EAF3FF';

// ─── Reveal Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── CountUp ────────────────────────────────────────────────
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal(0.3);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const dur = 1200;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

// ─── 사회자 데이터 맵 (id → 실제 데이터) ────────────────────
const PRO_MAP: Record<string, { name: string; image: string; images: string[]; intro: string; career: string; price: number; experience: number; youtubeId?: string }> = {
  '1': { name: '강도현', image: '/images/pro-01/10000133881772850005043.avif', images: ['/images/pro-01/10000133881772850005043.avif', '/images/pro-01/10000269161772850296005.avif', '/images/pro-01/55111772850244842.avif', '/images/pro-01/9041772850314846.avif'], intro: '신뢰감 있는 보이스로 현직 아나운서,레크,운동회,쇼호스트 모두 가능한 남자!', career: '1억 상금 쇼호스트 오디션 방송 <보고스타워즈> 우승', price: 450000, experience: 14 },
  '2': { name: '김동현', image: '/images/pro-02/10000365351773046135169.avif', images: ['/images/pro-02/10000365351773046135169.avif', '/images/pro-02/10000795161773046194452.avif', '/images/pro-02/10000855971773046164403.avif', '/images/pro-02/10000864531773046178640.avif'], intro: '안녕하세요 MC 김동현 입니다 :)', career: 'K리그 수원삼성블루윙즈 장외아나운서', price: 450000, experience: 8 },
  '3': { name: '김민지', image: '/images/pro-03/IMG_06781773894450803.avif', images: ['/images/pro-03/IMG_06781773894450803.avif', '/images/pro-03/IMG_17531773894460574.avif', '/images/pro-03/IMG_44861773894475916.avif', '/images/pro-03/IMG_96081773894468666.avif'], intro: '꼼꼼하고 부드러운 진행', career: 'SBS Sports 야구 아나운서 / SBS Golf 골프 아나운서 등', price: 450000, experience: 4 },
  '4': { name: '김솔', image: '/images/pro-04/IMG_23601771788594274.avif', images: ['/images/pro-04/IMG_23601771788594274.avif', '/images/pro-04/IMG_31471771788581868.avif', '/images/pro-04/IMG_33241771788569381.avif', '/images/pro-04/IMG_44921771788602280.avif'], intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', career: '웨딩 전문 MC', price: 450000, experience: 8 },
  '5': { name: '김유석', image: '/images/pro-05/10000029811773033474612.avif', images: ['/images/pro-05/10000029811773033474612.avif', '/images/pro-05/10000044951773033401063.avif', '/images/pro-05/10000135061773033420087.avif', '/images/pro-05/10000263401773033544287.avif'], intro: '최고의 진행자 아나운서 김유석입니다.', career: '전남CBS 앵커 / SBS광주전남(KBC) 리포터 / KBS 책들아놀자 MC', price: 450000, experience: 8, youtubeId: '6R7r1tbMbTY' },
  '6': { name: '김재성', image: '/images/pro-06/10000602271772960706687.avif', images: ['/images/pro-06/10000602271772960706687.avif', '/images/pro-06/10000625401772960688608.avif', '/images/pro-06/10000653321772960487396.avif', '/images/pro-06/10000666071772960530192.avif'], intro: '순간을 기억으로 만드는 사회자', career: 'MBC+ 트롯챔피언 트롯869 셀럽챔프 사회자', price: 450000, experience: 7 },
  '7': { name: '김진아', image: '/images/pro-07/IMG_53011772965035335.avif', images: ['/images/pro-07/IMG_53011772965035335.avif', '/images/pro-07/IMG_61401772965618286.avif', '/images/pro-07/IMG_66501772965804174.avif', '/images/pro-07/IMG_78451772965478053.avif'], intro: '아나운서 김진아입니다', career: '한국경제TV 아나운서', price: 450000, experience: 6 },
  '8': { name: '김호중', image: '/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', images: ['/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', '/images/pro-08/10E595A9-B36C-4A54-BE94-F6AFAA258E7D1773045761972.avif', '/images/pro-08/8CAA6337-E752-4EDF-8B1D-86C32DDCB5811773045691817.avif', '/images/pro-08/IMG_06101773045870594.avif'], intro: '기획에서 진행까지, 무대를 완성하다', career: '기업행사·공식행사 전문 MC', price: 450000, experience: 12 },
  '9': { name: '나연지', image: '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', images: ['/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', '/images/pro-09/Facetune_26-12-2025-23-11-081772438046927.avif', '/images/pro-09/Facetune_26-12-2025-23-47-461772438096422.avif', '/images/pro-09/Facetune_28-12-2025-16-00-271772438073263.avif'], intro: '공식행사 전문 MC', career: '공공기관 및 대기업 세미나 진행', price: 450000, experience: 3, youtubeId: 'Hue7ZLJM7oo' },
  '10': { name: '노유재', image: '/images/pro-10/10000016211774440274171.avif', images: ['/images/pro-10/10000016211774440274171.avif', '/images/pro-10/10000080011774440452164.avif', '/images/pro-10/10000086141774440497085.avif', '/images/pro-10/10000096111774440365370.avif'], intro: '무대에서 다진 표현력과 방송에서 쌓은 전달력으로 신뢰와 감동이 공존하는 진행을 완성합니다.', career: 'SSG랜더스 장외 아나운서 / 롯데면세점 LDF 쇼호스트', price: 450000, experience: 16 },
  '11': { name: '도준석', image: '/images/pro-11/1-1231772850030951.avif', images: ['/images/pro-11/1-1231772850030951.avif', '/images/pro-11/3-1231772850058559.avif', '/images/pro-11/IMG_02501772849985994.avif', '/images/pro-11/IMG_35941772850008495.avif'], intro: '격 있는 사회자입니다.', career: '충남도청 아나운서', price: 450000, experience: 2, youtubeId: '72RX9prME4I' },
  '12': { name: '문정은', image: '/images/pro-12/IMG_27221772621229571.avif', images: ['/images/pro-12/IMG_27221772621229571.avif', '/images/pro-12/IMG_31821772621337651.avif', '/images/pro-12/IMG_61001772621448507.avif'], intro: '신랑신부님 맞춤! 품격있고 고급스러운 진행', career: '서울경제TV 앵커 / CJ온스타일+ 쇼호스트 / 정부 및 지자체 공식행사 MC', price: 450000, experience: 10, youtubeId: 'D5Mx42ArNOY' },
  '13': { name: '박상설', image: '/images/pro-13/10000077391773050357628.avif', images: ['/images/pro-13/10000077391773050357628.avif', '/images/pro-13/10000119741773050332437.avif', '/images/pro-13/10000152851773050374131.avif', '/images/pro-13/10000345831773050337824.avif'], intro: '10년 경력, 2000번의 행사 경력으로 함께하겠습니다.', career: 'G1방송국 전국 TOP10 가요쇼 행사 MC / 연예인·기업·축제 500회 이상', price: 450000, experience: 10, youtubeId: 'P04peAmLV7c' },
  '14': { name: '박은결', image: '/images/pro-14/IMG_02661773035503788.avif', images: ['/images/pro-14/IMG_02661773035503788.avif', '/images/pro-14/IMG_25661773035575396.avif', '/images/pro-14/IMG_31641773035613744.avif', '/images/pro-14/IMG_74881773035596478.avif'], intro: '안녕하세요! 아나운서 사회자 박은결입니다', career: 'SBS강원(G1) 리포터 / 팍스경제TV 앵커 / 삼성바이오로직스 아나운서', price: 450000, experience: 9 },
  '15': { name: '박인애', image: '/images/pro-15/IMG_0196.avif', images: ['/images/pro-15/IMG_0196.avif', '/images/pro-15/IMG_7549.avif', '/images/pro-15/IMG_7552.avif', '/images/pro-15/IMG_8517.avif'], intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자', career: '연합뉴스TV / SK브로드밴드 Btv / 충주MBC', price: 450000, experience: 13, youtubeId: 'UIbfieXAT0U' },
  '16': { name: '박주은', image: '/images/pro-16/IMG_01621772973118334.avif', images: ['/images/pro-16/IMG_01621772973118334.avif', '/images/pro-16/IMG_83991772973146317.avif', '/images/pro-16/IMG_98851772973174980.avif', '/images/pro-16/IMG_98891772973162789.avif'], intro: 'SBS Sports 아나운서', career: 'SBS전북·JTV전주방송 앵커', price: 450000, experience: 4, youtubeId: '_207ch4oFnU' },
  '17': { name: '배유정', image: '/images/pro-17/IMG_21541773026472716.avif', images: ['/images/pro-17/IMG_21541773026472716.avif', '/images/pro-17/IMG_25041773026570198.avif', '/images/pro-17/IMG_30041773026515891.avif', '/images/pro-17/IMG_54931773026493813.avif'], intro: '안녕하십니까, 믿고 맏기는 행사입니다!', career: 'kt HCN 충북방송', price: 450000, experience: 4 },
  '18': { name: '성연채', image: '/images/pro-18/20161016_161406_IMG_5921.avif', images: ['/images/pro-18/20161016_161406_IMG_5921.avif', '/images/pro-18/20161121_141359_IMG_6072.avif', '/images/pro-18/20180311_161359_IMG_8925.avif', '/images/pro-18/20180406_135859_IMG_9103.avif'], intro: '따뜻하고 다정한 아나운서 성연채입니다', career: 'KCN금강방송 아나운서', price: 450000, experience: 10, youtubeId: '6YEw574Gvg8' },
  '19': { name: '송지은', image: '/images/pro-19/IMG_60741772092494350.avif', images: ['/images/pro-19/IMG_60741772092494350.avif', '/images/pro-19/IMG_70171772092524815.avif', '/images/pro-19/IMG_86861772092348488.avif'], intro: '믿고 맡기는 아나운서', career: '현대자동차 앰배서더 / 광복절 80주년 기념식 진행 / KBS 넥스트 라이콘 mc', price: 450000, experience: 10 },
  '20': { name: '유하늘', image: '/images/pro-20/IMG_05351773030634574.avif', images: ['/images/pro-20/IMG_05351773030634574.avif', '/images/pro-20/IMG_06591773030512344.avif', '/images/pro-20/IMG_50451773030183819.avif'], intro: '고품격 따뜻하고 사랑스러운 분위기의 결혼식 전문 사회자', career: '매년 180건 이상 결혼식 진행', price: 450000, experience: 4 },
  '21': { name: '유하영', image: '/images/pro-21/IMG_40271772967046036.avif', images: ['/images/pro-21/IMG_40271772967046036.avif', '/images/pro-21/IMG_40281772967049484.avif'], intro: 'KBS 캐스터 유하영 입니다', career: 'KBS 캐스터 / 도로교통공단 TBN 교통방송 캐스터 / MBC 라디오 광고 성우', price: 450000, experience: 9 },
  '22': { name: '이강문', image: '/images/pro-22/10000353831773035180593.avif', images: ['/images/pro-22/10000353831773035180593.avif', '/images/pro-22/10000353841773035166256.avif', '/images/pro-22/10000353851773035190777.avif', '/images/pro-22/10000529141773035412786.avif'], intro: '10년차 베테랑 사회자', career: '오은영박사 콘서트 진행', price: 450000, experience: 11 },
  '23': { name: '이승진', image: '/images/pro-23/IMG_46511771924269213.avif', images: ['/images/pro-23/IMG_46511771924269213.avif', '/images/pro-23/IMG_46591771924566302.avif', '/images/pro-23/IMG_75131771924219656.avif', '/images/pro-23/IMG_96001771924190664.avif'], intro: '따뜻하고 깔끔한 진행의 사회자 이승진 입니다 :)', career: '춘천MBC 라디오 리포터', price: 450000, experience: 4, youtubeId: 'Nqe3UioEV8E' },
  '24': { name: '이용석', image: '/images/pro-24/10001176941772847263491.avif', images: ['/images/pro-24/10001176941772847263491.avif', '/images/pro-24/10001176951772847270433.avif', '/images/pro-24/10001176961772847283258.avif', '/images/pro-24/10001176971772847277083.avif'], intro: '1000회 이상의 결혼식사회, 공식행사, 방송진행', career: 'HD현대건설기계·한국은행·대한민국 소방정책 국제 심포지엄 MC', price: 450000, experience: 11, youtubeId: 'nZhdGrZaBKU' },
  '25': { name: '이우영', image: '/images/pro-25/2-11772248201484.avif', images: ['/images/pro-25/2-11772248201484.avif', '/images/pro-25/IMG_58821772248170290.avif'], intro: '현직 아나운서의 고품격 진행', career: '남인천방송·YTN FM 아나운서 / KBS 라디오 기상캐스터 / 현대HCN 경북방송 뉴스 앵커', price: 450000, experience: 8, youtubeId: 'plGBzTNsdiM' },
  '26': { name: '이원영', image: '/images/pro-26/1-1231772531708677.avif', images: ['/images/pro-26/1-1231772531708677.avif', '/images/pro-26/IMG_27231772531852387.avif', '/images/pro-26/IMG_27981772531758751.avif', '/images/pro-26/IMG_77151772531739607.avif'], intro: 'KBS 춘천방송총국 기상캐스터', career: 'KBC(SBS 광주전남) 기상캐스터·리포터', price: 450000, experience: 6 },
  '27': { name: '이재원', image: '/images/pro-27/17230390916981773388202648.avif', images: ['/images/pro-27/17230390916981773388202648.avif', '/images/pro-27/17366775813661773388237802.avif'], intro: '영어MC / 영어아나운서 이재원 (Jay - Bilingual MC)', career: '국제결혼식 전문 한/영사회 700건 이상, 국제행사 100건 이상', price: 450000, experience: 11, youtubeId: 'oXBGQziegWc' },
  '28': { name: '이한나', image: '/images/pro-28/IMG_002209_01772081523241.avif', images: ['/images/pro-28/IMG_002209_01772081523241.avif', '/images/pro-28/IMG_004350_01772081494500.avif', '/images/pro-28/IMG_010628_01772081478994.avif', '/images/pro-28/IMG_08631772081467465.avif'], intro: '생방송 4년차, 현직 아나운서 이한나', career: 'TBN경인교통방송 MC / CPBC부산가톨릭평화방송 아나운서', price: 450000, experience: 4, youtubeId: 'v1Rz8N2AV28' },
  '29': { name: '임하람', image: '/images/pro-29/10000118841772968813129.avif', images: ['/images/pro-29/10000118841772968813129.avif', '/images/pro-29/10000118851772968842632.avif', '/images/pro-29/10000118861772968791354.avif', '/images/pro-29/10000292381772968967622.avif'], intro: '남들과 다른 특별한 예식을 진행해드립니다', career: '프리티풀 대표 사회자', price: 450000, experience: 8 },
  '30': { name: '장윤영', image: '/images/pro-30/IMG_27051772976548211.avif', images: ['/images/pro-30/IMG_27051772976548211.avif', '/images/pro-30/IMG_27831772976505642.avif', '/images/pro-30/IMG_55911772976529887.avif', '/images/pro-30/IMG_55941772976566963.avif'], intro: '아나운서 장윤영입니다 :)', career: 'IB SPORTS·팍스경제TV 아나운서 / 중소벤처기업부·한국걸스카우트 행사 MC', price: 450000, experience: 1 },
  '31': { name: '전해별', image: '/images/pro-31/IMG_73341772850094485.avif', images: ['/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', '/images/pro-31/IMG_73341772850094485.avif', '/images/pro-31/IMG_73391772850088429.avif', '/images/pro-31/IMG_92281772850158117.avif'], intro: '탄탄한 발성의 아나운서가 여러분을 빛내 드리겠습니다.', career: '인천공항 아나운서 / 부평구청 아나운서 / <청중을 이끄는 스피치> 집필', price: 450000, experience: 10, youtubeId: 'Aooj1e0Wu2I' },
  '32': { name: '전혜인', image: '/images/pro-32/IMG_19181773027236141.avif', images: ['/images/pro-32/IMG_19181773027236141.avif', '/images/pro-32/IMG_19191773027254756.avif', '/images/pro-32/IMG_19201773027246152.avif', '/images/pro-32/IMG_49261773027106589.avif'], intro: '믿고 맡기는 아나운서 전혜인', career: '한국경제TV 아나운서', price: 450000, experience: 3 },
  '33': { name: '정미정', image: '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', images: ['/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', '/images/pro-33/0cbe948eaed4fdb569f7e202960cc01a2dc22ff91772100447466.avif'], intro: '경력 13년차 아나운서 및 사회자', career: 'MBC충북 아나운서 / SPOTV 스포츠 아나운서 / 부산경남SBS(KNN)', price: 450000, experience: 13 },
  '34': { name: '정애란', image: '/images/pro-34/IMG_2920.avif', images: ['/images/pro-34/IMG_2920.avif', '/images/pro-34/IMG_5670.avif', '/images/pro-34/IMG_5841.avif', '/images/pro-34/IMG_5842.avif'], intro: '임기응변에 강한 따뜻한 목소리', career: '경기도의회·송파구·남동구청 뉴스 / CMB광주방송 아나운서 / DBS동아방송 아나운서', price: 450000, experience: 10, youtubeId: 'uZCpxPN8I0Y' },
  '35': { name: '정이현', image: '/images/pro-35/44561772622988798.avif', images: ['/images/pro-35/44561772622988798.avif', '/images/pro-35/44571772623001970.avif', '/images/pro-35/44611772622968203.avif', '/images/pro-35/56791772622891895.avif'], intro: '정이현 사회자입니다', career: '10년차 전문사회자', price: 450000, experience: 10 },
  '36': { name: '조하늘', image: '/images/pro-36/IMG_27041773036338469.avif', images: ['/images/pro-36/IMG_27041773036338469.avif', '/images/pro-36/IMG_32021773036578352.avif', '/images/pro-36/IMG_42491773036546456.avif', '/images/pro-36/IMG_77011773036564503.avif'], intro: '아나돌: 아이돌 같은 아나운서 조하늘', career: 'KTV국민방송 / JTBC골프 MC / KBS 유튜브 MC 등', price: 450000, experience: 5 },
  '37': { name: '최진선', image: '/images/pro-37/10001059551772371340253.avif', images: ['/images/pro-37/10001059551772371340253.avif', '/images/pro-37/10001101721772371303174.avif', '/images/pro-37/10001101751772371254806.avif', '/images/pro-37/10001127141772371327596.avif'], intro: '사회자 최진선', career: '웨딩·행사 전문 MC', price: 450000, experience: 5 },
  '38': { name: '한가람', image: '/images/pro-38/IMG_34281772111635068.avif', images: ['/images/pro-38/IMG_34281772111635068.avif', '/images/pro-38/IMG_3429.avif', '/images/pro-38/IMG_3432.avif', '/images/pro-38/IMG_3433.avif'], intro: '고급스럽고 따뜻한 보이스 사회자 한가람 입니다', career: '결혼식·공식행사 전문 MC', price: 450000, experience: 8, youtubeId: 'H-u5iHpbxds' },
  '39': { name: '함현지', image: '/images/pro-39/11773004544652.avif', images: ['/images/pro-39/11773004544652.avif', '/images/pro-39/IMG_12081773004575812.avif', '/images/pro-39/IMG_68091773004557667.avif', '/images/pro-39/IMG_76701773004528766.avif'], intro: '깔끔하고 격식있는 진행, 함현지입니다.', career: '연합뉴스TV 뉴스캐스터', price: 450000, experience: 4 },
  '40': { name: '허수빈', image: '/images/pro-40/IMG_01991772961130928.avif', images: ['/images/pro-40/IMG_01991772961130928.avif', '/images/pro-40/IMG_02001772961175115.avif', '/images/pro-40/IMG_02021772961211905.avif', '/images/pro-40/IMG_02031772961191961.avif'], intro: '순간을 놓치지 않는 센스와 따뜻한 진행', career: '결혼식 전문 사회자 / 기업행사·공식행사 진행 / 라이브커머스 쇼호스트', price: 450000, experience: 8 },
  '41': { name: '홍현미', image: '/images/pro-41/IMG_12201772513865121.avif', images: ['/images/pro-41/IMG_12201772513865121.avif', '/images/pro-41/IMG_19021772514066029.avif', '/images/pro-41/IMG_57741772513914924.avif', '/images/pro-41/IMG_60161772513816986.avif'], intro: '정부|기업 공식행사 전문아나운서의 고급스러운 진행', career: 'KTV국민방송 앵커 / 국가공무원인재개발원 MC / 부평구청·인천국제공항 아나운서', price: 450000, experience: 10 },
};

// ─── Mock Data (fallback) ──────────────────────────────────

const MOCK_PRO = {
  id: '31',
  name: '전해별',
  level: 'Level 1',
  profileImage: '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif',
  mainImage: '/images/pro-31/IMG_73341772850094485.avif',
  images: [
    '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif',
    '/images/pro-31/IMG_73341772850094485.avif',
    '/images/pro-31/IMG_73391772850088429.avif',
    '/images/pro-31/IMG_92281772850158117.avif',
  ],
  title: '사회자 전해별',
  isPrime: true,
  youtubeId: 'Aooj1e0Wu2I',
  youtubeVideos: [
    { id: 'Aooj1e0Wu2I', title: '전해별 아나운서 웨딩 MC 진행 영상' },
    { id: 'yjF1Im350yE', title: '기업 행사 진행 하이라이트' },
    { id: 'h9ckGqJHJJM', title: '공식 행사 MC 진행 영상' },
    { id: 'aGt6EZQmmOk', title: '이벤트 진행 영상' },
  ],
  rating: 4.9,
  reviewCount: 79,
  plans: [
    { id: 'premium', label: 'Premium', price: 450000, duration: '1시간', title: '행사 1시간 진행', desc: ['사회 진행', '사전 미팅'], workDays: 14, revisions: 1 },
    { id: 'superior', label: 'Superior', price: 800000, duration: '2시간', title: '행사 2시간 진행', desc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'], workDays: 14, revisions: 2 },
    { id: 'enterprise', label: 'Enterprise', price: 1700000, duration: '6시간', title: '6시간 풀타임 진행', desc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'], workDays: 14, revisions: 3 },
  ],
  description: `안녕하세요. 아나운서 전해별입니다.

탄탄한 발성의 아나운서가 여러분을 빛내 드리겠습니다.

신뢰감 있는 목소리, 탄탄한 발성, 센스 있는 진행으로
첫 문장부터 시선을 이끌겠습니다.

주요 경력:
• 인천공항 아나운서
• 부평구청 아나운서
• <청중을 이끄는 스피치> 집필
• 크몽 Prime 전문가
• 영어 MC 가능`,
  expertStats: {
    totalDeals: 89,
    satisfaction: 100,
    memberType: '기업',
    taxInvoice: '프리티풀 발행',
    responseTime: '1시간 이내',
    contactTime: '언제나 가능',
  },
  otherServices: [
    { id: 'os1', title: '전문 아나운서가 특별한 날을 품격있게 꾸며드리...', price: 450000, rating: 5.0, reviewCount: 3, image: '/images/pro-31/IMG_92281772850158117.avif' },
  ],
  reviews: [
    {
      id: 'r1',
      name: '나른********',
      rating: 5.0,
      date: '26.02.09 13:18',
      scores: { 경력: 5.0, 만족도: 5.0, 구성력: 5.0, 위트: 4.5, 발성: 5.0, 이미지: 5.0 },
      content: '상담과정부터 행사 진행, 마무리까지 모두 빠르고 친절하게 응대해 주셨어요! 진행도 상황에 맞게 톤 바꿔가시면서 잘 진행해 주셨습니다! 추운데 고생 많으셨습니다. 감사합니다!',
      workDays: 13,
      orderRange: '100만원 ~ 200만원',
      badge: '대행사/에이전시',
      proReply: {
        date: '26.02.09',
        content: '어머 매니저님 빠른 후기 감사합니다 +_+!!\n이런 큰 행사의 진행을 맡을 수 있어 기뻤고 영광이었습니다.\n다음에도 불러주시면 정말 기쁜 마음으로 달려가겠습니다 :)\n그럼 오늘 남은 하루도 행복하게 보내시기 바랍니다.\n새해 복 많이 받으세요!ㅎㅎ',
      },
    },
    {
      id: 'r2',
      name: '스트********',
      rating: 5.0,
      date: '25.06.10 12:00',
      scores: { 경력: 4.5, 만족도: 5.0, 구성력: 5.0, 위트: 5.0, 발성: 4.5, 이미지: 5.0 },
      content: '꼼꼼하고 안정적으로 촬영 잘 마쳤습니다~',
      workDays: 3,
      orderRange: '80만원 ~ 90만원',
      badge: 'Biz·기업',
    },
  ],
  recommendedPros: [
    { id: '15', name: '박인애', role: '사회자', rating: 4.7, reviews: 134, experience: 13, image: '/images/pro-15/IMG_0196.avif', tags: ['전국가능', '격식있는'], isPartner: true },
    { id: '23', name: '이승진', role: '사회자', rating: 4.8, reviews: 211, experience: 4, image: '/images/pro-23/IMG_46511771924269213.avif', tags: ['서울/경기', '유머러스한'], isPartner: true },
    { id: '12', name: '문정은', role: '사회자', rating: 4.6, reviews: 216, experience: 10, image: '/images/pro-12/IMG_27221772621229571.avif', tags: ['전국가능', '감동적인'], isPartner: true },
  ],
  alsoViewed: [
    { id: '25', title: '현직 아나운서의 고품격 진행', price: 450000, author: '이우영', image: '/images/pro-25/2-11772248201484.avif' },
    { id: '35', title: '정이현 사회자 - 청춘의 에너지를 담은 MC', price: 450000, rating: 5.0, reviewCount: 34, author: '정이현', image: '/images/pro-35/44561772622988798.avif' },
    { id: '5', title: '최고의 진행자 아나운서 김유석입니다', price: 450000, rating: 4.7, reviewCount: 65, author: '김유석', image: '/images/pro-05/10000029811773033474612.avif' },
  ],
};

// ─── Components ─────────────────────────────────────────────

function RadarChart({ scores }: { scores: { label: string; value: number }[] }) {
  const { ref, visible } = useReveal(0.3);
  const cx = 130;
  const cy = 130;
  const r = 95;
  const n = scores.length;
  const total = scores.reduce((sum, s) => sum + s.value * (100 / 5), 0);
  const maxValue = Math.max(...scores.map((s) => s.value));
  const bestIndices = scores.map((s, i) => s.value === maxValue ? i : -1).filter((i) => i >= 0);

  const getPoint = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * scale, y: cy + Math.sin(angle) * r * scale };
  };

  const bgPath = scores.map((_, i) => { const p = getPoint(i, 1); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
  const dataPath = scores.map((s, i) => { const p = getPoint(i, visible ? s.value / 5 : 0); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';

  return (
    <div ref={ref} className="bg-gray-50 rounded-2xl p-5 mb-3">
      <div className="flex items-center gap-3">
        {/* Left: total + tags */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-500">총 포텐셜점수</p>
          <p className="text-[28px] font-bold text-[#3180F7] leading-tight">{Math.round(total)}점</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {scores.map((s) => (
              <span key={s.label} className="px-2 h-[26px] rounded-full bg-white text-[10px] font-medium text-gray-600 flex items-center gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {s.label} <span className="font-bold text-[#3180F7]">{s.value.toFixed(1)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: radar chart SVG */}
        <div className="shrink-0">
          <svg width={160} height={160} viewBox="0 0 260 260" style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
              const path = scores.map((_, i) => { const p = getPoint(i, scale); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
              return <path key={scale} d={path} fill="none" stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Axis lines */}
            {scores.map((_, i) => {
              const p = getPoint(i, 1);
              return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Data fill */}
            <path
              d={dataPath}
              fill="rgba(49,128,247,0.2)"
              stroke="#3180F7"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />

            {/* Data dots */}
            {scores.map((s, i) => {
              const p = getPoint(i, visible ? s.value / 5 : 0);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="#3180F7"
                  style={{ transition: `all 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms` }}
                />
              );
            })}

            {/* Labels + BEST badge */}
            {scores.map((s, i) => {
              const p = getPoint(i, 1.22);
              const isBest = bestIndices.includes(i);
              return (
                <g key={i}>
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[13px] font-semibold"
                    fill={isBest ? '#1a1a1a' : '#6B7280'}
                  >
                    {s.label}
                  </text>
                  {isBest && visible && (
                    <g style={{ animation: `bestBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.8 + i * 0.1}s both` }}>
                      <g style={{ animation: 'bestFloat 2s ease-in-out infinite', transformOrigin: `${p.x}px ${p.y - 22}px` }}>
                        <rect x={p.x - 24} y={p.y - 32} width={48} height={22} rx={11} fill="#1a1a1a" />
                        <polygon points={`${p.x - 5},${p.y - 10} ${p.x + 5},${p.y - 10} ${p.x},${p.y - 5}`} fill="#1a1a1a" />
                        <text x={p.x} y={p.y - 21} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">BEST</text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

      </div>
    </div>
  );
}

function ScoreBars() {
  const { ref, visible } = useReveal(0.3);
  const items = [
    { label: '경력', value: 5.0 },
    { label: '만족도', value: 4.9 },
    { label: '구성력', value: 5.0 },
    { label: '위트', value: 4.8 },
    { label: '발성', value: 5.0 },
    { label: '이미지', value: 4.9 },
  ];
  return (
    <div ref={ref} className="mb-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500 w-14 shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: visible ? `${(item.value / 5) * 100}%` : '0%',
                  background: 'linear-gradient(90deg, #3180F7, #6BA5FA)',
                  transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold text-gray-900 tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 기존 사회자별 기업로고 매핑 (각 사회자가 함께한 기업)
const PRO_COMPANY_LOGOS: Record<string, string[]> = {
  '1': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg'],
  '2': ['/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '5': ['/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '8': ['/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg', '/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg'],
  '9': ['/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg', '/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg'],
  '10': ['/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '12': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg'],
  '13': ['/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '15': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg'],
  '23': ['/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '24': ['/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg'],
  '25': ['/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '31': ['/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg', '/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg'],
  '34': ['/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '35': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg'],
  '37': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '38': ['/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg'],
};

function CompanyLogoCarousel({ proId }: { proId?: string }) {
  const [logos, setLogos] = useState<string[]>([]);
  useEffect(() => {
    // 1. 해당 프로의 매핑된 로고 확인
    if (proId && PRO_COMPANY_LOGOS[proId]) {
      setLogos(PRO_COMPANY_LOGOS[proId]);
      return;
    }
    // 2. localStorage에서 읽기 (본인 프로필)
    try {
      const saved = localStorage.getItem('proRegister_companyLogos') || localStorage.getItem('proRegister_selectedCategories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('/images/')) {
          setLogos(parsed);
        }
      }
    } catch {}
  }, [proId]);

  if (logos.length === 0) return null;

  const repeated = [...logos, ...logos, ...logos];

  return (
    <div className="overflow-hidden mb-4 -mx-2.5 px-2.5">
      <div
        className="flex items-center gap-5"
        style={{
          width: 'max-content',
          animation: `logoScroll ${logos.length * 3}s linear infinite`,
        }}
      >
        {repeated.map((logo, i) => (
          <div key={i} className="shrink-0 h-[28px] w-[72px] flex items-center justify-center opacity-40 grayscale">
            <img src={encodeURI(logo)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      <style>{`@keyframes logoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-${logos.length * 92}px); } }`}</style>
    </div>
  );
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0" style={{ fontSize: size }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < Math.floor(value) ? BRAND : '#E5E7EB'}>
          <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// localStorage에 저장된 파트너 등록 데이터로 DB 응답 모양의 객체 생성 (미승인/DB 저장 전 상태용)
function buildLocalStoragePro(user: any): any | null {
  if (typeof window === 'undefined') return null;
  const name = user?.name || localStorage.getItem('proRegister_name');
  if (!name) return null;
  const photos: string[] = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
  const mainIdx = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
  const ordered = photos.length > 0 ? [photos[mainIdx], ...photos.filter((_, i) => i !== mainIdx)] : [];
  return {
    id: 'my-pro',
    user: { name, profileImageUrl: user?.profileImageUrl || ordered[0] || '' },
    images: ordered.map((url) => ({ imageUrl: url })),
    services: [],
    avgRating: 5.0,
    reviewCount: 0,
    careerYears: parseInt(localStorage.getItem('proRegister_careerYears') || '1') || 1,
    shortIntro: localStorage.getItem('proRegister_intro') || '',
    mainExperience: localStorage.getItem('proRegister_career') || '',
    youtubeUrl: localStorage.getItem('proRegister_youtubeUrl') || null,
  };
}

// ─── Page ───────────────────────────────────────────────────

export default function ProDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const proData = id && PRO_MAP[id] ? PRO_MAP[id] : null;
  const [apiRating, setApiRating] = useState<number | null>(null);
  const [apiReviewCount, setApiReviewCount] = useState<number | null>(null);
  const [apiProfileViews, setApiProfileViews] = useState<number | null>(null);
  const [dbPro, setDbPro] = useState<any>(null);

  // API에서 실제 평점/리뷰수 가져오기
  useEffect(() => {
    if (!id) return;
    discoveryApi.getProList({ search: proData?.name, limit: 1 })
      .then((res) => {
        const found = res.data?.[0];
        if (found) {
          setApiRating(found.avgRating);
          setApiReviewCount(found.reviewCount);
        }
      })
      .catch(() => {});
  }, [id, proData?.name]);

  // PRO_MAP에 없는 UUID는 DB에서 상세 조회
  useEffect(() => {
    if (!id || PRO_MAP[id]) return;
    // 'my-pro' sentinel: 로그인 사용자의 실제 proProfile이 있으면 UUID로 교체, 없으면 localStorage 데이터로 직접 구성
    if (id === 'my-pro') {
      // 파트너 신청 직후 localStorage 기반 카드 — 로컬 데이터로 즉시 구성 (서버 호출 시 401 → 홈 리다이렉트 위험)
      setDbPro(buildLocalStoragePro(null));
      return;
    }
    discoveryApi.getProDetail(id).then((res: any) => {
      if (res) setDbPro(res);
    }).catch(() => {});
  }, [id, router]);

  const dbProBuilt = dbPro ? (() => {
    const name = dbPro.user?.name || '전문가';
    const profileImg = dbPro.user?.profileImageUrl || dbPro.images?.[0]?.imageUrl || '';
    const imgs = (dbPro.images || []).map((i: any) => i.imageUrl).filter(Boolean);
    const ytMatch = (dbPro.youtubeUrl || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    const youtubeId = ytMatch?.[1];
    const experience = dbPro.careerYears || 1;
    const careerLines = (dbPro.mainExperience || '').split(/[\n\/]/).map((s: string) => s.trim()).filter(Boolean);

    // services → plans 매핑 (DB 서비스가 있으면 DB 기준, 없으면 기본 1개)
    const dbServices: any[] = dbPro.services || [];
    const plans = dbServices.length > 0
      ? dbServices.map((svc: any, i: number) => ({
          id: svc.id || `plan-${i}`,
          label: svc.title || `Plan ${i + 1}`,
          price: svc.basePrice || 0,
          duration: svc.description || '',
          title: svc.title || '',
          desc: svc.description ? [svc.description] : ['사회 진행'],
          workDays: 14,
          revisions: i + 1,
        }))
      : [{ id: 'default', label: 'Premium', price: 450000, duration: '1시간', title: '행사 진행', desc: ['사회 진행', '사전 미팅'], workDays: 14, revisions: 1 }];

    // faqs → DB 기반
    const dbFaqs: any[] = dbPro.faqs || [];

    // reviews → DB 기반
    const dbReviews: any[] = (dbPro.reviews || []).map((r: any) => ({
      id: r.id,
      name: r.reviewer?.name?.slice(0, 2) + '********' || '익명',
      rating: r.rating || 5.0,
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : '',
      scores: {},
      content: r.content || '',
      workDays: 0,
      orderRange: '',
    }));

    // description: DB detailHtml 우선, 없으면 shortIntro+경력으로 구성
    const description = dbPro.detailHtml
      || `안녕하세요. 사회자 ${name}입니다.\n\n${dbPro.shortIntro || ''}${careerLines.length > 0 ? `\n\n주요 경력:\n• ${careerLines.join('\n• ')}` : ''}`;

    return {
      ...MOCK_PRO,
      id: dbPro.id,
      name,
      level: '',
      profileImage: profileImg,
      mainImage: imgs[0] || profileImg,
      images: imgs.length > 0 ? imgs : [profileImg].filter(Boolean),
      title: `사회자 ${name}`,
      isPrime: false,
      rating: Number(dbPro.avgRating) || 0,
      reviewCount: dbPro.reviewCount || 0,
      youtubeId,
      youtubeVideos: youtubeId ? [{ id: youtubeId, title: `${name} 사회자 진행 영상` }] : [],
      description,
      plans,
      expertStats: {
        totalDeals: experience * 8 + 10,
        satisfaction: 100,
        memberType: '개인',
        taxInvoice: '발행 가능',
        responseTime: '24시간 이내',
        contactTime: '평일 10:00 ~ 18:00',
      },
      reviews: dbReviews.length > 0 ? dbReviews : [],
      otherServices: [],
      recommendedPros: [],
      alsoViewed: [],
    };
  })() : null;

  const pro = dbProBuilt ? dbProBuilt : proData ? {
    ...MOCK_PRO,
    id: id || MOCK_PRO.id,
    name: proData.name,
    profileImage: proData.image,
    mainImage: proData.images[0] || proData.image,
    images: proData.images,
    title: `사회자 ${proData.name}`,
    rating: apiRating ?? proData.price / 100000,
    reviewCount: apiReviewCount ?? 0,
    youtubeId: proData.youtubeId || undefined,
    youtubeVideos: proData.youtubeId ? [{ id: proData.youtubeId, title: `${proData.name} 사회자 진행 영상` }] : [],
    description: `안녕하세요. 사회자 ${proData.name}입니다.\n\n${proData.intro}\n\n${proData.career ? `주요 경력:\n• ${proData.career.split('/').map((s: string) => s.trim()).join('\n• ')}` : ''}`,
    plans: MOCK_PRO.plans.map((p: any) => ({ ...p, price: p.id === 'premium' ? 450000 : p.id === 'superior' ? 800000 : 1700000 })),
    expertStats: { ...MOCK_PRO.expertStats, totalDeals: proData.experience * 8 + 10 },
  } : { ...MOCK_PRO, id: id || MOCK_PRO.id };

  const [activeImage, setActiveImage] = useState(0);
  const [activePlan, setActivePlan] = useState(1); // default deluxe
  const [activeSection, setActiveSection] = useState<'desc' | 'info' | 'reviews'>('desc');
  const [headerSolid, setHeaderSolid] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const authUser = useAuthStore((s) => s.user);
  const [isFavorited, setIsFavorited] = useState(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      return stored.includes(id);
    } catch { return false; }
  });

  // Check favorite status from API
  useEffect(() => {
    if (authUser && id) {
      favoriteApi.check(id).then((res) => setIsFavorited(res.isFavorited)).catch(() => {});
    }
  }, [authUser, id]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const lastTapRef = useRef(0);
  const [shareModal, setShareModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [reviewsModal, setReviewsModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [reviewMenu, setReviewMenu] = useState<string | null>(null);

  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const plan = pro.plans[activePlan];

  // 방문 기록 저장
  useEffect(() => {
    try {
      const key = 'viewed-pros';
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as { id: string; time: number }[];
      const filtered = stored.filter((v) => v.id !== id);
      filtered.unshift({ id, time: Date.now() });
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
    } catch {}
  }, [id]);

  // Active section auto-tracking on scroll + header solid bg
  useEffect(() => {
    const sections: Array<{ id: 'desc' | 'info' | 'reviews'; ref: React.RefObject<HTMLDivElement> }> = [
      { id: 'desc', ref: descRef },
      { id: 'info', ref: infoRef },
      { id: 'reviews', ref: reviewsRef },
    ];
    const onScroll = () => {
      const scrollY = window.scrollY + 120;
      let current: 'desc' | 'info' | 'reviews' = 'desc';
      sections.forEach(({ id, ref }) => {
        if (ref.current && ref.current.offsetTop <= scrollY) current = id;
      });
      setActiveSection(current);
      setScrollY(window.scrollY);
      // Solid header when gallery's bottom passes the top of viewport
      if (galleryRef.current) {
        const galleryBottom = galleryRef.current.offsetTop + galleryRef.current.offsetHeight;
        setHeaderSolid(window.scrollY > galleryBottom - 60);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock when modals open
  useEffect(() => {
    const anyModal = imageModal || shareModal || purchaseModal || reviewsModal || phoneModal;
    if (anyModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [imageModal, shareModal, purchaseModal, reviewsModal, phoneModal]);

  // Toggle carousel favorite
  const toggleCarouselFav = (id: string) => {
    setFavoriteItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('찜 해제', { icon: '💙' });
      } else {
        next.add(id);
        toast('찜 목록에 추가됨', { icon: '❤️' });
      }
      return next;
    });
  };

  // Handlers
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: pro.title, url: window.location.href });
      } catch {
        setShareModal(true);
      }
    } else {
      setShareModal(true);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('링크가 복사되었습니다');
      setShareModal(false);
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorited((v) => {
      const newVal = !v;
      toast(v ? '찜 해제' : '찜 목록에 추가됨', { icon: v ? '💙' : '❤️' });
      // Sync to API
      if (authUser) {
        favoriteApi.toggle(pro.id).catch(() => {});
      }
      try {
        const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
        if (newVal) {
          if (!stored.includes(pro.id)) stored.push(pro.id);
        } else {
          const idx = stored.indexOf(pro.id);
          if (idx !== -1) stored.splice(idx, 1);
        }
        localStorage.setItem('freetiful-favorites', JSON.stringify(stored));
      } catch {}
      return newVal;
    });
  };

  const handlePurchase = () => {
    router.push(`/pros/${pro.id}/booking`);
  };

  const confirmPurchase = () => {
    setPurchaseModal(false);
    router.push(`/pros/${pro.id}/booking`);
  };

  const scrollToSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = section === 'desc' ? descRef.current : section === 'info' ? infoRef.current : reviewsRef.current;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const [loading, setLoading] = useState(() => typeof window !== 'undefined' ? !sessionStorage.getItem('visited-pro-detail') : true);
  useEffect(() => { if (!loading) return; const t = setTimeout(() => { setLoading(false); sessionStorage.setItem('visited-pro-detail', '1'); }, 300); return () => clearTimeout(t); }, [loading]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
        {/* Gallery skeleton */}
        <div className="skeleton" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 0 }} />
        {/* Info skeleton */}
        <div className="px-4 pt-4">
          <div className="skeleton mb-2" style={{ width: 60, height: 20, borderRadius: 10 }} />
          <div className="skeleton mb-2" style={{ width: '80%', height: 22 }} />
          <div className="skeleton mb-3" style={{ width: '50%', height: 14 }} />
          <div className="skeleton mb-2" style={{ width: '60%', height: 28 }} />
          <div className="flex gap-2 mt-4 mb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ width: 70, height: 32, borderRadius: 16 }} />
            ))}
          </div>
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white pb-24 lg:max-w-5xl lg:mx-auto lg:px-8" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Top Header (Floating → Solid with thumbnail on scroll) ─── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-3 transition-all duration-300 ${
          headerSolid ? 'bg-white border-b border-gray-100 h-[60px] py-0' : 'justify-between pt-3 pb-3 px-4'
        }`}
      >
        <button
          onClick={() => router.back()}
          className={`flex items-center justify-center shrink-0 active:scale-90 transition-all ${
            headerSolid
              ? 'w-9 h-9 text-gray-900'
              : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
          }`}
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>

        {/* Scrolled state: Thumbnail + Title + Price */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2.5 transition-all duration-300 ${
            headerSolid ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            transform: headerSolid ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <img
            src={pro.images[0]}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">
              <span className="text-[#3180F7]">{pro.plans[activePlan].label}</span> {pro.title}
            </p>
            <p className="text-[12px] leading-tight mt-0.5">
              <span className="font-bold text-gray-900">{pro.plans[activePlan].price.toLocaleString()}원</span>
              <span className="text-gray-400 ml-1">(VAT 포함)</span>
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 shrink-0 ${headerSolid ? '' : 'ml-auto'}`}>
          <button
            onClick={handleShare}
            className={`flex items-center justify-center active:scale-90 transition-all ${
              headerSolid
                ? 'w-9 h-9 text-gray-900'
                : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
            }`}
          >
            <Share2 size={18} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* ─── Image Gallery with swipe ─── */}
      <div
        ref={galleryRef}
        className="relative w-full aspect-square lg:aspect-auto lg:h-[500px] bg-gray-100 overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 50) setActiveImage((i) => Math.max(0, i - 1));
          if (dx < -50) setActiveImage((i) => Math.min(pro.images.length - 1, i + 1));
          touchStartX.current = null;
        }}
      >
        {/* Parallax wrapper: shrinks + moves up on scroll */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translateY(${scrollY * 0.35}px) scale(${Math.max(0.88, 1 - scrollY / 1600)})`,
            transformOrigin: 'center center',
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <div
            className="flex h-full transition-transform duration-[600ms] will-change-transform"
            style={{
              transform: `translateX(-${activeImage * 100}%)`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {pro.images.map((src, i) => (
              <button
                key={i}
                onClick={() => {
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    // Double tap → favorite
                    if (!isFavorited) setIsFavorited(true);
                    setShowDoubleTapHeart(true);
                    setTimeout(() => setShowDoubleTapHeart(false), 900);
                    lastTapRef.current = 0;
                  } else {
                    lastTapRef.current = now;
                  }
                }}
                className="relative w-full h-full shrink-0 block"
              >
                <Image src={src} alt={pro.name} fill className="object-cover" priority={i === 0} />
              </button>
            ))}
          </div>
        </div>

        {/* Double-tap heart overlay */}
        {showDoubleTapHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart
              size={80}
              className="fill-white text-white drop-shadow-lg"
              style={{ animation: 'doubleTapHeart 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            />
          </div>
        )}

        {/* Page indicator */}
        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[12px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
          {activeImage + 1} / {pro.images.length}
        </div>

        {/* Dot navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {pro.images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === activeImage ? 22 : 6,
                height: 6,
                backgroundColor: i === activeImage ? 'white' : 'rgba(255,255,255,0.5)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          ))}
        </div>

        {/* YouTube 영상 썸네일 (우측 하단) */}
        {pro.youtubeId && (
          <div
            className="absolute bottom-4 right-4 w-[130px] aspect-[5/3] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.4)] border-2 border-white/90 bg-black z-10"
          >
            <iframe
              className="w-full h-full pointer-events-none"
              src={`https://www.youtube.com/embed/${pro.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${pro.youtubeId}&playsinline=1&modestbranding=1&rel=0&showinfo=0`}
              title="YouTube preview"
              allow="autoplay; encrypted-media"
            />
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="px-2.5 pt-4">
        {/* Pro row + prime */}
        <Reveal>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <img src={pro.profileImage} alt="" className="w-10 h-10 rounded-xl object-cover" />
              <p className="text-[18px] font-bold text-gray-900">사회자 {pro.name}</p>
            </div>
            {pro.isPrime && (
              <span className="flex items-center gap-1 bg-[#3180F7]/10 text-[#3180F7] text-[11px] font-bold px-2.5 py-1 rounded-full">
                <img src="/images/verified-pro.svg" alt="" width={14} height={14} className="shrink-0" />
                인증 전문가
              </span>
            )}
          </div>
        </Reveal>

        {/* Rating */}
        <Reveal delay={100}>
          <div className="flex items-center gap-2 mb-4">
            <StarRating value={parseFloat(pro.rating.toFixed(1))} size={16} />
            <span className="text-[16px] font-bold text-gray-900">{pro.rating.toFixed(1)}</span>
            <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
          </div>
        </Reveal>

        {/* ─── 기업 로고 캐러셀 ─── */}
        <CompanyLogoCarousel proId={pro.id} />
      </div>
      {/* Close px-2.5 pt-4 div, start 2-column layout */}

      <div className="lg:flex lg:gap-8 lg:items-start">
      {/* ─── Plan/Booking section (right column on desktop) ─── */}
      <div className="px-2.5 lg:px-0 lg:w-1/3 lg:order-2 lg:sticky lg:top-20 lg:mt-4 lg:bg-white lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-sm lg:p-6">

        {/* ─── Plan Tabs ─── */}
        <div className="flex border-b border-gray-200 -mx-2.5 lg:mx-0 relative">
          {pro.plans.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePlan(i)}
              className={`flex-1 py-4 text-[14px] font-bold relative transition-colors duration-300 ${
                activePlan === i ? 'text-[#3180F7]' : 'text-gray-300 hover:text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
          {/* Animated indicator */}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(activePlan * 100) / pro.plans.length}%`,
              width: `${100 / pro.plans.length}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        {/* ─── Plan Content ─── */}
        <div className="py-5 lg:py-6 lg:space-y-4">
          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold text-gray-900 tabular-nums">
              {plan.price.toLocaleString()}원
            </span>
            <span className="text-[14px] text-gray-400">(VAT 포함)</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-1">결제 시 수수료 10%(VAT포함)가 추가돼요.</p>

          {/* Service title */}
          <div className="mt-6 lg:mt-0 mb-3">
            <h3 className="text-[17px] font-bold text-gray-900">{plan.title}</h3>
          </div>

          {/* Description */}
          <ul className="space-y-1 lg:space-y-2 text-[14px] text-gray-700 leading-relaxed">
            {plan.desc.map((line, i) => (
              <li key={i} className="whitespace-pre-line">{i === 0 ? '- ' : '* '}{line}</li>
            ))}
          </ul>

          {/* Custom options from localStorage (if pro registered them) */}
          {typeof window !== 'undefined' && (() => {
            try {
              const stored = localStorage.getItem('proRegister_customOptions');
              if (!stored) return null;
              const customOptions = JSON.parse(stored);
              const planOptions = customOptions[plan.id];
              if (!planOptions || planOptions.length === 0) return null;
              return (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold text-amber-600 mb-2">추가 옵션</p>
                  <ul className="space-y-1 text-[14px] text-gray-700 leading-relaxed">
                    {planOptions.map((opt: {name: string, price: number} | string, i: number) => {
                      const name = typeof opt === 'string' ? opt : opt.name;
                      const price = typeof opt === 'string' ? 0 : opt.price;
                      return (
                        <li key={i} className="flex items-center justify-between">
                          <span>+ {name}</span>
                          {price > 0 && <span className="text-[13px] font-semibold text-gray-500">{price.toLocaleString()}원</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            } catch { return null; }
          })()}

        </div>
      </div>
      {/* ─── End Plan/Booking right column ─── */}

      {/* ─── Left column: Description, Info, Reviews (on desktop) ─── */}
      <div className="lg:w-2/3 lg:order-1">

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 lg:hidden" />

      {/* ─── Section Tabs (Sticky below header) ─── */}
      <div className="sticky top-[60px] z-30 bg-white border-b border-gray-200">
        <div className="flex relative">
          {[
            { id: 'desc', label: '서비스 설명' },
            { id: 'info', label: '전문가 정보' },
            { id: 'reviews', label: `리뷰 (${pro.reviewCount})` },
          ].map((tab) => {
            const tabs = ['desc', 'info', 'reviews'];
            const idx = tabs.indexOf(activeSection);
            return (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id as 'desc' | 'info' | 'reviews')}
                className={`flex-1 py-4 text-[15px] font-semibold relative transition-colors duration-300 ${
                  activeSection === tab.id ? 'text-[#3180F7]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(['desc', 'info', 'reviews'].indexOf(activeSection) * 100) / 3}%`,
              width: `${100 / 3}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      {/* ─── 서비스 설명 Section ─── */}
      <div ref={descRef} className="px-2.5 pt-8">
        <Reveal>
          <h2 className="text-[20px] font-bold text-gray-900 mb-5">서비스 설명</h2>
        </Reveal>

        {pro.isPrime && (
          <Reveal delay={100}>
            <div className="relative overflow-hidden rounded-xl p-5 mb-6 border border-[#3180F7]/15 bg-gradient-to-br from-[#EAF3FF]/40 via-white to-white">
              {/* Glow accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#3180F7]/10 blur-3xl pointer-events-none" />
              <img src="/images/partners-badge.svg" alt="Partners" className="h-[26px] mb-3 relative" />
              <p className="text-[15px] font-bold text-gray-900 mb-3">
                이 서비스는 프리티풀 엄선 <span className="text-[#3180F7]">상위 2% 전문가</span>가 제공해요
              </p>
              <ul className="space-y-1.5">
                {['포트폴리오와 고객 후기로 검증된 퀄리티', '경력·이력 인증 심사를 통과한 서비스', '다양한 고객의 요청에 맞춘 전문성'].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[13px] text-gray-700 opacity-0"
                    style={{ animation: `slideInLeft 0.6s ease-out ${300 + i * 100}ms forwards` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3180F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Description text */}
        <div className={`whitespace-pre-line text-[15px] leading-[1.8] text-gray-800 text-center ${descExpanded ? '' : 'max-h-[400px] overflow-hidden relative'}`}>
          {pro.description}
          {!descExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>

        {!descExpanded && (
          <button
            onClick={() => setDescExpanded(true)}
            className="mt-4 w-full py-3.5 border border-gray-200 rounded-xl text-[18px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            더보기
          </button>
        )}

        {/* Image expand notice */}
        <div className="mt-8 bg-gray-50 rounded-xl py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400">
          이미지를 클릭해서 확대 할 수 있어요
          <ArrowUpRight size={14} />
        </div>

        {/* YouTube 영상 리스트 */}
        {pro.youtubeVideos && pro.youtubeVideos.length > 0 && (
          <Reveal delay={200}>
            <div className="mt-8">
              <h3 className="text-[16px] font-bold text-gray-900 mb-3">영상</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x ml-[-2.5px] pl-[2.5px] pr-4">
                {pro.youtubeVideos.map((video) => (
                  <div key={video.id} className="shrink-0 w-[260px] snap-start">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${video.id}?modestbranding=1&rel=0&playsinline=1`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-gray-700 leading-tight line-clamp-1">{video.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ─── 프리티풀의 다른 검증된 전문가 ─── */}
      <div className="px-4 pt-10">
        <Reveal>
          <h3 className="text-[17px] font-bold text-gray-900 leading-tight mb-4"><span className="text-[#3180F7]">프리티풀</span>의 다른<br />검증된 전문가를 살펴보세요</h3>
        </Reveal>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x pr-4">
          {pro.alsoViewed.map((item) => (
            <Link
              key={item.id}
              href={`/pros/${item.id}`}
              className="shrink-0 w-[130px] snap-start group"
            >
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                <img src="/images/partners-badge.svg" alt="Partners" className="h-[18px] mb-0.5" />
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">사회자 {item.author}</p>
                {item.rating && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <StarRating value={parseFloat(item.rating.toFixed(1))} size={10} />
                    <span className="text-[11px] font-bold text-gray-900">{item.rating.toFixed(1)}</span>
                    <span className="text-[10px] text-gray-400">({item.reviewCount})</span>
                  </div>
                )}
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{item.price.toLocaleString()}원~</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-8" />

      {/* ─── 전문가 정보 Section ─── */}
      <div ref={infoRef} className="px-2.5 pt-8">
        <h2 className="text-[20px] font-bold text-gray-900 mb-5">전문가 정보</h2>

        <div className="flex items-center gap-4 mb-5">
          <img src={pro.profileImage} alt="" className="w-[60px] h-[60px] rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StarRating value={parseFloat(pro.rating.toFixed(1))} size={12} />
              <span className="text-[12px] font-semibold text-gray-900">{pro.rating.toFixed(1)} ({pro.reviewCount + 3})</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">연락 가능 시간: {pro.expertStats.contactTime}</p>
            <p className="text-[11px] text-gray-400">평균 응답 시간: {pro.expertStats.responseTime}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* 총 거래 건수 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">총 거래 건수</p>
            <div className="flex items-end gap-1 h-[32px] mb-1.5">
              {[35, 52, 68, 75, 82, 89].map((v, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${(v / 89) * 100}%`, background: i === 5 ? '#3180F7' : '#E5E7EB' }} />
              ))}
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.totalDeals}건</p>
          </div>
          {/* 만족도 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">만족도</p>
            <div className="relative w-full h-[32px] flex items-center justify-center mb-1.5">
              <svg width="48" height="32" viewBox="0 0 48 32">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="5" strokeDasharray="94.2 125.7" transform="rotate(-210 24 24)" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#3180F7" strokeWidth="5" strokeDasharray={`${94.2 * (pro.expertStats.satisfaction / 100)} 125.7`} strokeLinecap="round" transform="rotate(-210 24 24)" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.satisfaction}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">회원구분</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.memberType}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">세금계산서</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.taxInvoice}</p>
          </div>
        </div>

      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-10" />

      {/* ─── 리뷰 Section ─── */}
      <div ref={reviewsRef} className="px-2.5 pt-6">
        <h2 className="text-[20px] font-bold text-gray-900 mb-2">리뷰</h2>

        <div className="flex items-center gap-2 mb-2">
          <StarRating value={parseFloat(pro.rating.toFixed(1))} size={20} />
          <span className="text-[24px] font-bold text-gray-900">{pro.rating.toFixed(1)}</span>
          <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
        </div>

        {/* Radar Chart */}
        <RadarChart scores={[
          { label: '경력', value: 5.0 },
          { label: '만족도', value: 4.9 },
          { label: '위트', value: 4.8 },
          { label: '발성', value: 5.0 },
          { label: '이미지', value: 4.9 },
          { label: '구성력', value: 5.0 },
        ]} />

        {/* Score bars */}
        <ScoreBars />


        {/* Reviews list */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-gray-900">전체 리뷰 {pro.reviewCount}건</h3>
          <button><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          {pro.reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                  <span className="text-[14px] text-gray-600">{review.name}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setReviewMenu(reviewMenu === review.id ? null : review.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-[16px] text-gray-400 leading-none">⋯</span>
                  </button>
                  {reviewMenu === review.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
                      <button onClick={() => { toast('리뷰를 신고했습니다', { icon: '🚨' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">신고하기</button>
                      <button onClick={() => { toast('리뷰를 차단했습니다', { icon: '🚫' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">차단하기</button>
                      <button onClick={() => { navigator.clipboard.writeText(review.content); toast.success('복사됨'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">복사하기</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                <span className="text-[13px] font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                <span className="text-[12px] text-gray-300">|</span>
                <span className="text-[12px] text-gray-400">{review.date}</span>
              </div>
              {(review as typeof review & { scores?: Record<string, number> }).scores && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>
                      {key} <span className="font-bold text-[#3180F7] ml-1">{String(val)}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
              <p className="text-[12px] text-gray-400 mb-2">
                행사일 : {review.workDays}일 | 주문 금액 : <span className="font-bold text-gray-600">{review.orderRange}</span>
              </p>
              {review.badge && (
                <span className="inline-block text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{review.badge}</span>
              )}
              {review.proReply && (
                <div className="mt-3 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-gray-800">{pro.name}</span>
                    <span className="text-[12px] text-gray-400">{review.proReply.date}</span>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-gray-700 whitespace-pre-line">{review.proReply.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push(`/pros/${pro.id}/reviews`)}
          className="w-full py-3.5 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all mt-5"
        >
          리뷰 전체보기
        </button>
      </div>

      {/* ─── Expandable panels ─── */}
      <div className="px-2.5 pt-8">
        {[
          { id: 'info', label: '서비스 정보', content: `• 카테고리: MC / 아나운서\n• 평균 작업 기간: 20일 이내\n• 커뮤니케이션: 1시간 이내 응답\n• 수정 횟수: 1회 포함\n• 취소·환불 정책: 환불 규정 참고` },
          { id: 'revision', label: '수정 및 재진행', content: `• 상품 구매 후 수정 횟수는 1회입니다.\n• 수정 요청은 작업 완료 전 요청 가능합니다.\n• 추가 수정이 필요한 경우 별도 협의가 필요합니다.` },
          { id: 'cancel', label: '취소 및 환불 규정', content: `• 작업 시작 전: 100% 환불\n• 작업 진행 중: 진행률에 따른 일부 환불\n• 작업 완료 후: 환불 불가\n※ 상세 규정은 프리티풀 이용약관을 따릅니다.` },
          { id: 'notice', label: '상품정보고시', content: `• 제공자: ${pro.name}\n• 서비스 제공방식: 온/오프라인\n• 결제 후 계약 내용 변경은 상호 협의에 의해서만 가능합니다.` },
        ].map((panel) => {
          const isOpen = expandedPanel === panel.id;
          return (
            <div key={panel.id} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => setExpandedPanel(isOpen ? null : panel.id)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <span className="text-[15px] font-medium text-gray-900">{panel.label}</span>
                <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#3180F7]' : ''}`} />
              </button>
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: isOpen ? 400 : 0,
                  opacity: isOpen ? 1 : 0,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div className="pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">{panel.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-2" />

      {/* ─── 추천 사회자 ─── */}
      <div className="px-2.5 pt-8 pb-10">
        <h2 className="text-[17px] font-bold text-gray-900 leading-tight mb-4">사회자<br />인기 전문가 어때요?</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-2.5 px-2.5">
          {pro.recommendedPros.map((item) => (
            <Link key={item.id} href={`/pros/${item.id}`} className="shrink-0 w-[130px] group">
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt={item.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                {item.isPartner && <img src="/images/partners-badge.svg" alt="Partners" className="h-[18px] mb-0.5" />}
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">{item.role} {item.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRating value={parseFloat(item.rating.toFixed(1))} size={10} />
                  <span className="text-[11px] font-bold text-gray-900">{item.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-gray-400">({item.reviews})</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[9px] font-bold px-1.5 rounded-[4px] bg-primary-50 text-primary-600 flex items-center" style={{ height: 18 }}>경력{item.experience}년</span>
                  {item.tags.slice(0, 1).map((tag) => (
                    <span key={tag} className="text-[9px] font-medium px-1.5 rounded-[4px] bg-gray-100 text-gray-500 flex items-center" style={{ height: 18 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      </div>
      {/* ─── End left column ─── */}
      </div>
      {/* ─── End lg:flex 2-column wrapper ─── */}

      {/* ─── Bottom Fixed Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}
      >
        {/* 블러 배경 (별도 레이어로 분리) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, white 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0) 100%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
          }}
        />
      <div className="relative pointer-events-auto pt-10">
        <div className="flex items-center gap-3 max-w-[680px] mx-auto">
          {/* Heart (원형) */}
          <button
            onClick={handleToggleFavorite}
            className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center active:scale-90 transition-transform shrink-0 shadow-sm"
          >
            <Heart
              size={20}
              className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-400'}
              style={{ animation: isFavorited ? 'heartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined }}
            />
          </button>

          {/* 문의하기 + 구매하기 묶음 (알약) */}
          <div className="relative flex-1">
            {/* 말풍선 — overflow-hidden 바깥 */}
            {showTooltip && (
              <div
                className="absolute -top-8 left-[25%] -translate-x-1/2 z-10"
                style={{ animation: 'tooltipBounce 2s ease-in-out infinite' }}
              >
                <div className="bg-[#3180F7] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap relative shadow-[0_4px_16px_rgba(49,128,247,0.4)]">
                  평균 응답 1시간 이내
                  <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#3180F7] rotate-45" />
                </div>
              </div>
            )}
            <div className="flex h-12 rounded-full overflow-hidden shadow-sm">
              <button
                onClick={() => { setShowTooltip(false); if (localStorage.getItem('freetiful-logged-in') !== 'true') { setLoginModal(true); return; } router.push(`/chat/${pro.id}`); }}
                className="flex-1 bg-white border border-gray-200 border-r-0 rounded-l-full text-[14px] font-semibold text-gray-700 active:bg-gray-50 transition-colors"
              >
                문의하기
              </button>
              <button
                onClick={handlePurchase}
                className="flex-1 bg-[#3180F7] rounded-r-full text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                구매하기
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ─── Image Modal (확대) ─── */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setImageModal(null)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <Image src={imageModal} alt="" width={1200} height={1200} className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {shareModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShareModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-5">공유하기</h3>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#EAF3FF] flex items-center justify-center">
                <Link2 size={20} className="text-[#3180F7]" />
              </div>
              <span className="text-[15px] font-medium text-gray-900">링크 복사</span>
            </button>
            <button
              onClick={() => setShareModal(false)}
              className="w-full mt-2 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ─── Phone Modal ─── */}
      {phoneModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPhoneModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#EAF3FF] flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-[#3180F7]" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">전화 상담</h3>
              <p className="text-[14px] text-gray-500 mb-6">
                채팅으로 먼저 문의하시면<br />더 빠른 답변을 받을 수 있어요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhoneModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => { setPhoneModal(false); router.push(`/chat/${pro.id}`); }}
                  className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
                >
                  채팅 문의
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Purchase Modal ─── */}
      {purchaseModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPurchaseModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-4">구매 확인</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-[12px] text-gray-400 mb-1">{plan.label}</p>
              <p className="text-[15px] font-bold text-gray-900 mb-2">{plan.title}</p>
              <div className="flex items-end justify-between pt-3 border-t border-gray-200">
                <span className="text-[13px] text-gray-500">결제 금액</span>
                <span className="text-[22px] font-bold text-[#3180F7]">{plan.price.toLocaleString()}원</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-400 mb-5 text-center">결제 시 수수료 10%(VAT포함)가 추가돼요</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPurchaseModal(false)}
                className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews Full Modal ─── */}
      {reviewsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setReviewsModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-[17px] font-bold text-gray-900">전체 리뷰 ({pro.reviewCount})</h3>
              <button onClick={() => setReviewsModal(false)}>
                <X size={22} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-6">
              {pro.reviews.map((review) => (
                <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                    <span className="text-[14px] text-gray-600">{review.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                    <span className="text-[13px] font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                    <span className="text-[12px] text-gray-300">|</span>
                    <span className="text-[12px] text-gray-400">{review.date}</span>
                  </div>
                  <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
                  <p className="text-[12px] text-gray-400">행사일 : {review.workDays}일 | 주문 금액 : {review.orderRange}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium animations */}
      {/* Login Modal */}
      {loginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setLoginModal(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-1">로그인이 필요합니다</h2>
            <p className="text-[14px] text-gray-500 text-center mb-6">이 기능을 사용하려면 로그인해주세요</p>
            <div className="space-y-2.5">
              {['kakao', 'naver', 'google'].map((p) => (
                <button key={p} onClick={() => { localStorage.setItem('freetiful-logged-in', 'true'); localStorage.setItem('freetiful-user', JSON.stringify({ name: '', provider: p, createdAt: Date.now() })); localStorage.setItem('userRole', 'general'); window.location.href = '/onboarding'; }}
                  className={`w-full flex items-center justify-center gap-3 font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-transform ${p === 'kakao' ? 'bg-[#FEE500] text-[#191919]' : p === 'naver' ? 'bg-[#03C75A] text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                >{p === 'kakao' ? '카카오로 계속하기' : p === 'naver' ? '네이버로 계속하기' : 'Google로 계속하기'}</button>
              ))}
            </div>
            <button onClick={() => setLoginModal(false)} className="w-full mt-4 text-[14px] text-gray-400 font-medium py-2 text-center">나중에 하기</button>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes tooltipBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes priceFadeUp {
          0% { opacity: 0; transform: translateY(8px); filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes slideInLeft {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes primeShine {
          0%, 100% { box-shadow: 0 0 0 rgba(49,128,247,0); }
          50% { box-shadow: 0 0 16px rgba(49,128,247,0.4); }
        }
        @keyframes primeShineMove {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(400%); }
        }
        @keyframes playPulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
          100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
        }
        @keyframes bestBounce {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bestFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes doubleTapHeart {
          0% { transform: scale(0); opacity: 0; }
          15% { transform: scale(1.3); opacity: 1; }
          30% { transform: scale(1); opacity: 1; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes buttonShine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(450%) skewX(-15deg); }
        }
      `}} />
    </div>
  );
}
