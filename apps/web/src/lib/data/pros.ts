// 프리티풀 인증 전문가 (가입 → 심사 → 승인 완료)
// 실제 사회자 회원 데이터

export interface RegisteredPro {
  id: string;
  name: string;
  role: '사회자' | '쇼호스트' | '축가/연주';
  category: string;
  region: string;
  image: string;
  images: string[];
  intro: string;
  career: string;
  price: number;
  experience: number;
  rating: number;
  reviews: number;
  youtubeId?: string;
  languages?: string[];
  specialties: string[]; // 전문영역
  plan: ('premium' | 'superior' | 'enterprise')[];
  verified: true; // 프리티풀 인증
  registeredAt: string;
  lastActiveAt: string;
}

export const REGISTERED_PROS: RegisteredPro[] = [
  { id: '1', name: '강도현', role: '사회자', category: 'MC', region: '서울/경기', image: '/images/강도현/10000133881772850005043.avif', images: ['/images/강도현/10000133881772850005043.avif', '/images/강도현/10000269161772850296005.avif', '/images/강도현/55111772850244842.avif', '/images/강도현/9041772850314846.avif'], intro: '신뢰감 있는 보이스로 현직 아나운서, 레크, 운동회, 쇼호스트 모두 가능한 남자!', career: '1억 상금 쇼호스트 오디션 방송 <보고스타워즈> 우승', price: 500000, experience: 14, rating: 4.6, reviews: 117, languages: ['영어'], specialties: ['결혼식', '기업행사', '체육대회', '레크리에이션'], plan: ['premium', 'superior'], verified: true, registeredAt: '2025-06-15', lastActiveAt: '2026-04-11' },
  { id: '2', name: '김동현', role: '사회자', category: 'MC', region: '서울/경기', image: '/images/김동현/10000365351773046135169.avif', images: ['/images/김동현/10000365351773046135169.avif', '/images/김동현/10000795161773046194452.avif', '/images/김동현/10000855971773046164403.avif', '/images/김동현/10000864531773046178640.avif'], intro: '안녕하세요 MC 김동현 입니다 :)', career: 'K리그 수원삼성블루윙즈 장외아나운서', price: 400000, experience: 8, rating: 4.7, reviews: 165, languages: ['영어'], specialties: ['결혼식', '기업행사', '체육대회'], plan: ['premium', 'superior', 'enterprise'], verified: true, registeredAt: '2025-07-20', lastActiveAt: '2026-04-11' },
  { id: '3', name: '김민지', role: '사회자', category: 'MC', region: '서울/경기', image: '/images/김민지/IMG_06781773894450803.avif', images: ['/images/김민지/IMG_06781773894450803.avif', '/images/김민지/IMG_17531773894460574.avif', '/images/김민지/IMG_44861773894475916.avif', '/images/김민지/IMG_96081773894468666.avif'], intro: '꼼꼼하고 부드러운 진행', career: 'SBS Sports 야구 아나운서 / SBS Golf 골프 아나운서', price: 550000, experience: 4, rating: 4.8, reviews: 96, languages: ['일본어'], specialties: ['결혼식', '공식행사'], plan: ['premium', 'superior'], verified: true, registeredAt: '2025-09-01', lastActiveAt: '2026-04-10' },
  { id: '4', name: '김솔', role: '사회자', category: 'MC', region: '전국', image: '/images/김솔/IMG_23601771788594274.avif', images: ['/images/김솔/IMG_23601771788594274.avif', '/images/김솔/IMG_31471771788581868.avif', '/images/김솔/IMG_33241771788569381.avif', '/images/김솔/IMG_44921771788602280.avif'], intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', career: '웨딩 전문 MC', price: 450000, experience: 8, rating: 4.7, reviews: 36, specialties: ['결혼식', '돌잔치'], plan: ['premium'], verified: true, registeredAt: '2025-08-10', lastActiveAt: '2026-04-09' },
  { id: '5', name: '김유석', role: '사회자', category: 'MC', region: '전국', image: '/images/김유석/10000029811773033474612.avif', images: ['/images/김유석/10000029811773033474612.avif', '/images/김유석/10000044951773033401063.avif', '/images/김유석/10000135061773033420087.avif', '/images/김유석/10000263401773033544287.avif'], intro: '최고의 진행자 아나운서 김유석입니다.', career: '전남CBS 앵커 / SBS광주전남(KBC) 리포터 / KBS 책들아놀자 MC', price: 550000, experience: 8, rating: 4.7, reviews: 65, youtubeId: '6R7r1tbMbTY', languages: ['영어'], specialties: ['결혼식', '기업행사', '컨퍼런스'], plan: ['premium', 'superior', 'enterprise'], verified: true, registeredAt: '2025-06-01', lastActiveAt: '2026-04-11' },
  { id: '6', name: '김재성', role: '사회자', category: 'MC', region: '충청', image: '/images/김재성/10000602271772960706687.avif', images: ['/images/김재성/10000602271772960706687.avif', '/images/김재성/10000625401772960688608.avif', '/images/김재성/10000653321772960487396.avif', '/images/김재성/10000666071772960530192.avif'], intro: '순간을 기억으로 만드는 사회자', career: 'MBC+ 트롯챔피언 트롯869 셀럽챔프 사회자', price: 450000, experience: 7, rating: 4.5, reviews: 235, specialties: ['결혼식', '송년회', '축제'], plan: ['premium', 'superior'], verified: true, registeredAt: '2025-07-05', lastActiveAt: '2026-04-10' },
  { id: '7', name: '김진아', role: '사회자', category: 'MC', region: '경상', image: '/images/김진아/IMG_53011772965035335.avif', images: ['/images/김진아/IMG_53011772965035335.avif', '/images/김진아/IMG_61401772965618286.avif', '/images/김진아/IMG_66501772965804174.avif', '/images/김진아/IMG_78451772965478053.avif'], intro: '아나운서 김진아입니다', career: '한국경제TV 아나운서', price: 300000, experience: 6, rating: 4.6, reviews: 170, specialties: ['결혼식', '기업행사'], plan: ['premium'], verified: true, registeredAt: '2025-08-20', lastActiveAt: '2026-04-08' },
  { id: '8', name: '김호중', role: '사회자', category: 'MC', region: '전라', image: '/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', images: ['/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', '/images/김호중/10E595A9-B36C-4A54-BE94-F6AFAA258E7D1773045761972.avif', '/images/김호중/8CAA6337-E752-4EDF-8B1D-86C32DDCB5811773045691817.avif', '/images/김호중/IMG_06101773045870594.avif'], intro: '기획에서 진행까지, 무대를 완성하다', career: '기업행사·공식행사 전문 MC', price: 300000, experience: 12, rating: 4.6, reviews: 232, specialties: ['기업행사', '공식행사', '체육대회', '팀빌딩'], plan: ['premium', 'superior', 'enterprise'], verified: true, registeredAt: '2025-05-10', lastActiveAt: '2026-04-11' },
  { id: '9', name: '나연지', role: '사회자', category: 'MC', region: '강원', image: '/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif', images: ['/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif', '/images/나연지/Facetune_26-12-2025-23-11-081772438046927.avif', '/images/나연지/Facetune_26-12-2025-23-47-461772438096422.avif', '/images/나연지/Facetune_28-12-2025-16-00-271772438073263.avif'], intro: '공식행사 전문 MC', career: '공공기관 및 대기업 세미나 진행', price: 300000, experience: 3, rating: 4.9, reviews: 239, youtubeId: 'Hue7ZLJM7oo', specialties: ['공식행사', '컨퍼런스', '기업행사'], plan: ['premium', 'superior'], verified: true, registeredAt: '2025-10-01', lastActiveAt: '2026-04-11' },
  { id: '10', name: '노유재', role: '사회자', category: 'MC', region: '제주', image: '/images/노유재/10000016211774440274171.avif', images: ['/images/노유재/10000016211774440274171.avif', '/images/노유재/10000080011774440452164.avif', '/images/노유재/10000086141774440497085.avif', '/images/노유재/10000096111774440365370.avif'], intro: '무대에서 다진 표현력과 방송에서 쌓은 전달력으로 신뢰와 감동이 공존하는 진행을 완성합니다.', career: 'SSG랜더스 장외 아나운서 / 롯데면세점 LDF 쇼호스트', price: 600000, experience: 16, rating: 4.7, reviews: 197, languages: ['중국어'], specialties: ['결혼식', '기업행사', '라이브커머스'], plan: ['premium', 'superior', 'enterprise'], verified: true, registeredAt: '2025-04-15', lastActiveAt: '2026-04-11' },
];

// 전체 41명 중 나머지는 간략화 (위 10명이 핵심 샘플)
// 실제 서비스에서는 DB에서 조회
