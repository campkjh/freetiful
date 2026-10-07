/**
 * 페이지별 인사이트(261007) — 경로 틀(서버 normalizePagePath 와 같은 모양, 아이디 칸 = :id)마다 한글 이름 · 어떤 화면인지 · 그림.
 *  그림 = public/admin/pages/{slug}.webp — 폰 화면(390 폭) 위쪽을 찍은 것. 로그인해야 보이는 화면은 빈 계정으로 찍어 목록이 비어 있다.
 *  새 화면을 만들면 여기에 한 줄 + 그림 한 장(스크래치 pv-shots.mjs). 여기 없는 경로는 '기타 화면'으로 주소만 보인다.
 */
export interface PageMeta {
  path: string;
  name: string;
  desc: string;
  /** 그림 파일 이름(확장자 없이) — 없으면 경로로 만든 이름 */
  thumb?: string;
  /** 그룹 — 엑셀·목록 보조 표시 */
  group: '고객' | '사회자' | '마이' | '랜딩' | '비즈' | '계정' | '약관';
}

export const PAGE_REGISTRY: PageMeta[] = [
  { path: '/main', name: '홈', desc: '첫 화면 · 배너 · 퀵매칭 · 카테고리 · BEST 사회자', group: '고객' },
  { path: '/quick-match', name: '퀵매칭', desc: '조건 몇 가지로 결혼식 사회자 견적을 한 번에 요청', group: '고객' },
  { path: '/pros', name: '사회자 목록', desc: '결혼식 사회자 전체 목록 · 정렬 · 필터', group: '고객' },
  { path: '/pros/:id', name: '사회자 상세', desc: '사회자 프로필 · 영상 · 리뷰 · 문의하기', group: '고객' },
  { path: '/pros/:id/reviews', name: '사회자 리뷰 전체', desc: '한 사회자의 리뷰 모아 보기', group: '고객' },
  { path: '/pros/:id/reviews/write', name: '리뷰 쓰기', desc: '행사를 마친 고객의 리뷰 작성', group: '고객' },
  { path: '/pros/:id/checkout', name: '결제하기', desc: '견적 금액 안전결제', group: '고객' },
  { path: '/search', name: '검색', desc: '사회자 · 업체 검색', group: '고객' },
  { path: '/businesses', name: '웨딩 파트너', desc: '웨딩홀 · 스드메 · 예물 등 제휴 업체 목록', group: '고객' },
  { path: '/businesses/:id', name: '웨딩 파트너 상세', desc: '업체 사진 · 정보 · 지도 · 문의', group: '고객' },
  { path: '/community', name: '웨딩숲', desc: '예비부부 커뮤니티 피드', group: '고객' },
  { path: '/community/:id', name: '웨딩숲 글', desc: '커뮤니티 글 상세 · 댓글', group: '고객' },
  { path: '/community/write', name: '웨딩숲 글쓰기', desc: '커뮤니티 글 작성', group: '고객' },
  { path: '/forest', name: '결혼의 숲', desc: '아바타로 숲을 가꾸는 3D 게임', group: '고객' },
  { path: '/chat', name: '채팅 목록', desc: '사회자 · 고객과의 대화방 목록', group: '고객' },
  { path: '/chat/:id', name: '채팅방', desc: '1:1 대화 · 견적서 · 사진', group: '고객' },
  { path: '/inquiries', name: '매칭', desc: '내 견적 요청과 사회자 답장(매칭 탭)', group: '고객' },
  { path: '/notifications', name: '알림', desc: '받은 알림 모아 보기', group: '고객' },
  { path: '/quote/:id', name: '견적서 링크', desc: '알림 속 견적서 링크 — 열면 그 채팅방으로 넘겨 줘요', thumb: 'chat-id', group: '고객' },
  { path: '/payment/success', name: '결제 완료', desc: '결제를 마친 뒤 안내', group: '고객' },
  { path: '/payment/fail', name: '결제 실패', desc: '결제가 안 됐을 때 안내', group: '고객' },
  { path: '/safe-payment', name: '안전결제 안내', desc: '프리티풀 안전결제 설명', group: '고객' },

  { path: '/wedding-mc', name: '웨딩MC 랜딩', desc: '광고로 들어오는 결혼식 사회자 랜딩 · 견적 신청', group: '랜딩' },
  { path: '/corporate-mc', name: '비즈MC 랜딩', desc: '광고로 들어오는 전문행사 사회자 랜딩 · 견적 신청', group: '랜딩' },

  { path: '/biz', name: '프리티풀 비즈', desc: '기업 행사 MC 섭외 소개', group: '비즈' },
  { path: '/biz/ceo', name: '비즈 · CEO 인사말', desc: '대표 인사말', group: '비즈' },
  { path: '/biz/clients', name: '비즈 · 고객사', desc: '함께한 기업 · 기관', group: '비즈' },
  { path: '/biz/history', name: '비즈 · 연혁', desc: '프리티풀 연혁', group: '비즈' },
  { path: '/biz/faq', name: '비즈 · 자주 묻는 질문', desc: '기업 행사 섭외 FAQ', group: '비즈' },
  { path: '/biz/complete', name: '비즈 · 문의 접수 완료', desc: '기업 행사 문의를 보낸 뒤', group: '비즈' },
  { path: '/careers', name: '채용', desc: '프리티풀 채용 안내', group: '비즈' },

  { path: '/my', name: '마이', desc: '내 정보 · 메뉴', group: '마이' },
  { path: '/my/settings', name: '프로필 설정', desc: '이름 · 사진 · 연락처', group: '마이' },
  { path: '/my/notifications', name: '알림 설정', desc: '채팅 · 예약 알림 켜고 끄기', group: '마이' },
  { path: '/my/purchase-history', name: '구매 내역', desc: '결제한 행사 · 행사 예정', group: '마이' },
  { path: '/my/payment-history', name: '결제 내역', desc: '결제 · 환불 기록', group: '마이' },
  { path: '/my/invite', name: '친구 초대', desc: '초대 보상 · 현금 지급 신청', group: '마이' },
  { path: '/my/announcements', name: '공지사항', desc: '프리티풀 공지', group: '마이' },
  { path: '/my/faq', name: '자주 묻는 질문', desc: '이용 FAQ', group: '마이' },
  { path: '/my/support', name: '고객센터', desc: '전화 · 이메일 문의', group: '마이' },
  { path: '/my/terms', name: '약관 · 정책', desc: '약관 모아 보기', group: '마이' },

  { path: '/pro-dashboard/inquiries', name: '사회자 문의함', desc: '받은 견적 요청 · 답장 관리', group: '사회자' },
  { path: '/pro-dashboard/auto-reply', name: '자동응답 관리', desc: '문의 첫 인사말 · 자동 답변 설정', group: '사회자' },
  { path: '/my/pro-edit', name: '사회자 프로필 수정', desc: '소개 · 사진 · 영상 · 가격', group: '사회자' },
  { path: '/my/reviews', name: '내 리뷰 관리', desc: '받은 리뷰 · 답글', group: '사회자' },
  { path: '/my/revenue', name: '매출 내역', desc: '달마다 매출', group: '사회자' },
  { path: '/my/settlement', name: '정산 내역', desc: '정산 예정 · 완료', group: '사회자' },
  { path: '/my/settlement/:id', name: '정산 명세서', desc: '정산 한 건 빌지', group: '사회자' },
  { path: '/my/bank', name: '계좌 관리', desc: '정산 받을 계좌', group: '사회자' },
  { path: '/pro-register', name: '파트너 등록', desc: '사회자 등록 시작', group: '사회자' },
  { path: '/pro-register/profile', name: '파트너 등록 · 프로필', desc: '등록 단계 — 소개', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/photos', name: '파트너 등록 · 사진', desc: '등록 단계 — 사진', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/pricing', name: '파트너 등록 · 가격', desc: '등록 단계 — 가격', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/regions', name: '파트너 등록 · 지역', desc: '등록 단계 — 활동 지역', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/personal-info', name: '파트너 등록 · 개인 정보', desc: '등록 단계 — 본인 정보', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/promo-code', name: '파트너 등록 · 추천 코드', desc: '등록 단계 — 추천 코드', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/terms', name: '파트너 등록 · 약관 동의', desc: '등록 단계 — 약관', thumb: 'pro-register', group: '사회자' },
  { path: '/pro-register/handover', name: '기존 프로필 인수', desc: '예전 프로필을 내 계정으로', thumb: 'pro-register', group: '사회자' },

  { path: '/email/login', name: '이메일 로그인', desc: '이메일 · 비밀번호 로그인', group: '계정' },
  { path: '/email/signup', name: '이메일 회원가입', desc: '이메일로 가입', group: '계정' },
  { path: '/onboarding', name: '시작하기', desc: '첫 실행 안내 · 로그인', group: '계정' },

  { path: '/terms/service', name: '이용약관', desc: '서비스 이용약관', thumb: 'terms', group: '약관' },
  { path: '/terms/privacy', name: '개인정보 처리방침', desc: '개인정보 처리방침', thumb: 'terms', group: '약관' },
  { path: '/terms/refund', name: '환불 정책', desc: '결제 환불 규정', thumb: 'terms', group: '약관' },
  { path: '/terms/marketing', name: '마케팅 수신 동의', desc: '마케팅 정보 수신 약관', thumb: 'terms', group: '약관' },
  { path: '/terms/third-party', name: '제3자 제공 동의', desc: '개인정보 제3자 제공', thumb: 'terms', group: '약관' },
  { path: '/terms/electronic-finance', name: '전자금융 약관', desc: '전자금융거래 이용약관', thumb: 'terms', group: '약관' },
  { path: '/terms/meta-ads', name: '광고 정보 동의', desc: '메타 광고 관련 안내', thumb: 'terms', group: '약관' },
];

const BY_PATH = new Map(PAGE_REGISTRY.map((p) => [p.path, p]));

/** 경로 틀 → 그림 파일 이름(/pros/:id/reviews → pros-id-reviews) */
export const thumbSlug = (path: string) => path.replace(/^\//, '').replace(/:id/g, 'id').replace(/\//g, '-') || 'main';

export function pageMeta(path: string): PageMeta & { known: boolean; thumbUrl: string | null } {
  const hit = BY_PATH.get(path);
  if (hit) return { ...hit, known: true, thumbUrl: `/admin/pages/${hit.thumb || thumbSlug(hit.path)}.webp` };
  // 약관 슬러그(/terms/xxx) — 약관 그림
  if (path.startsWith('/terms/')) return { path, name: '약관', desc: '약관 · 정책', group: '약관', known: true, thumbUrl: '/admin/pages/terms.webp' };
  return { path, name: '기타 화면', desc: '목록에 없는 주소', group: '고객', known: false, thumbUrl: null };
}

/** 화면에 보일 주소 — 아이디 칸은 그대로 :id(실제 주소는 사람마다 다름) */
export const displayUrl = (path: string) => `freetiful.com${path}`;
