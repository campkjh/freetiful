/*
 * 프리티풀 뉴스(비즈 '뉴스·소식' 탭) 기사 목록 — 정적 데이터(261009 사장 '뉴스소식은 공지사항으로 이동하는 게 아니라 따로 프리티풀 뉴스 페이지로,
 * 디자인은 공지사항처럼'). 공지(앱 사용 안내)가 아니라 웨딩홀 · 기업행사 담당자가 볼 회사 소식이라 DB 공지와 따로 둔다.
 *
 * 사실만 쓴다 — 없는 숫자 · 실적 · 제휴 · 약속 · 인용을 지어내지 않는다. 기사마다 근거:
 *  · 연혁 = biz/page.tsx HISTORY_DATA · biz/history/page.tsx(설명 줄). 연혁은 '달'까지만 있어 날짜도 달까지만 쓴다(날을 지어내지 않게).
 *  · 서비스 소식 = 이미 게시된 공지(GET /api/v1/announcements — 제목 · 날짜 · 본문 그대로 줄인 것).
 *  · 송년회 = components/biz/toss/content.ts STAGE('한국여성사회자협회와 프리티풀이 함께한 2025 송년회') +
 *    현수막 · 배너 글자('2025 Year-End RECEPTION · 한국여성사회자협회 X 프리티풀 · 2025.11.24 17:30', 영상 첫머리 'Hosted by Freetiful & WMAK').
 *    영상 = STAGE.fullVideo. (예전엔 '한국웨딩사회자협회'로 잘못 옮겨 적혀 있었다 — 261009 영상 프레임으로 확인해 바로잡음)
 *  · 안전결제 '행사가 끝난 뒤 대금 전달' = content.ts BOOK, '결혼식 사회 13,000회 이상' · '검증을 마친 진행자만' = content.ts EVENTS · SCALE.
 *  · 연혁의 '2026.03 정식 서비스 운영 개시'와 공지의 '5월 6일 정식 오픈'이 서로 달라, 5월 6일 공지 기사는 '정식 오픈'이라 부르지 않고
 *    공지 본문의 내용(사회자 찾기 · 상담 · 결제를 프리티풀 안에서)만 전한다 — 같은 비즈 안에서 '정식 오픈' 날짜가 둘로 보이지 않게(261009 검증).
 * 그림 = 저장소에 있는 것만(공지 그림 notices/v2 · 비즈 행사 사진 biz-v2/photos · 송년회 무대 · 빌라드지디 배너).
 * 화면 글은 4개 언어(비즈 i18n — 없는 언어는 한국어로 떨어진다).
 */
import { noticeArtTint } from '@/lib/notice-art';

export type Tr = { ko: string; en: string; ja: string; zh: string };
const tr = (ko: string, en: string, ja: string, zh: string): Tr => ({ ko, en, ja, zh });

/** 거르기 칸 — 비즈 두 축(웨딩홀 · 기업행사) + 회사 소식 */
export type BizNewsTag = 'hall' | 'event' | 'company';

export const BIZ_NEWS_TAGS: { id: 'all' | BizNewsTag; label: Tr }[] = [
  { id: 'all', label: tr('전체', 'All', 'すべて', '全部') },
  { id: 'hall', label: tr('웨딩홀', 'Wedding halls', '式場', '婚礼堂') },
  { id: 'event', label: tr('기업행사', 'Corporate events', '企業イベント', '企业活动') },
  { id: 'company', label: tr('회사 소식', 'Company', '会社ニュース', '公司动态') },
];

/** 카드 · 시트에 찍는 태그 이름(거르기 칸과 같은 말, '전체' 빼고) */
export const BIZ_NEWS_TAG_LABEL: Record<BizNewsTag, Tr> = {
  hall: BIZ_NEWS_TAGS[1].label,
  event: BIZ_NEWS_TAGS[2].label,
  company: BIZ_NEWS_TAGS[3].label,
};

export type BizNewsItem = {
  /** 주소 #id 로 바로 열 때 쓰는 이름 */
  id: string;
  /** '2026.09.28' 또는 달까지만 '2026.06' — 최신순 정렬도 이 글자 그대로(같은 꼴이라 문자열 비교로 충분) */
  date: string;
  tag: BizNewsTag;
  title: Tr;
  /** 첫 문단 — 기사 요지 */
  lead: Tr;
  /** 핵심 줄(점 목록) */
  points?: Tr[];
  /** 맺음 문단 */
  body?: Tr;
  /**
   * 카드 그림. bg = 그림 아래쪽 색(카드 아래 막 색 — 공지 그림은 lib/notice-art 값), position = 칸 가득 그림의 기준점,
   * veil = 아래 막 짙기(숫자 = 맨 아래, [가운데, 맨 아래]) — 어둡고 복잡한 행사 사진은 글자 줄이 읽히게 올린다(공지 그림은 기본값).
   */
  image: { src: string; bg: string; position?: string; veil?: number | [number, number] };
  /** 시트 맨 위에 그림 대신 띄울 영상(누르면 재생 — 미리 받지 않는다) */
  video?: string;
  /** 시트 아래 파란 단추 */
  cta?: { label: Tr; href: string };
  /** 연혁에 있는 일 — 시트 아래에 '프리티풀이 걸어온 길'(연혁 기사들)을 이어 보여 준다 */
  milestone?: Tr;
};

const N = (n: string) => {
  const src = `/images/notices/v2/${n}.webp`;
  return { src, bg: noticeArtTint(src) };
};
const PHOTO = '/images/biz-v2/photos';
/** 행사 사진 카드의 아래 막 — 사진은 위쪽 절반에서 또렷하고, 글자 줄(태그 · 날짜 · 제목) 뒤는 거의 불투명한 젖빛으로 */
const PHOTO_VEIL: [number, number] = [0.82, 0.95];

const CTA_INQUIRY_HALL = { label: tr('웨딩홀 제휴 문의', 'Hall partnership', '式場提携のご相談', '婚礼堂合作咨询'), href: '/biz/inquiry' };
const CTA_HISTORY = { label: tr('연혁 보기', 'View milestones', '沿革を見る', '查看发展历程'), href: '/biz/history' };

/** 최신순 */
export const BIZ_NEWS: BizNewsItem[] = [
  {
    id: 'quick-match',
    date: '2026.09.28',
    tag: 'hall',
    title: tr('퀵매칭으로 결혼식 사회자를 1분 만에', 'Find a wedding MC in a minute with Quick Match', 'クイックマッチで結婚式の司会者を1分で', '用快速匹配，1分钟找到婚礼主持人'),
    lead: tr(
      '몇 가지 질문에 답하면 조건에 맞는 결혼식 사회자를 바로 추천해 주는 퀵매칭을 시작했어요. 예식 일시와 지역, 예식장만 알려 주면 돼요.',
      'Answer a few questions and Quick Match recommends wedding MCs that fit your conditions right away. All it takes is the date, region and venue.',
      'いくつかの質問に答えるだけで、条件に合う結婚式の司会者をすぐにおすすめする「クイックマッチ」を始めました。挙式の日時・地域・式場を伝えるだけです。',
      '只需回答几个问题，「快速匹配」就会立即推荐符合条件的婚礼主持人。告诉我们婚礼日期、地区和场地即可。',
    ),
    points: [
      tr('예식 일시 · 지역 · 예식장 · 원하는 분위기 · 진행 부(1부/2부) · 선호 성별만 고르면 돼요', 'Just pick the date, region, venue, mood, program (part 1/2) and preferred gender', '挙式日時・地域・式場・希望の雰囲気・進行パート（1部/2部）・希望の性別を選ぶだけ', '只需选择婚礼日期、地区、场地、想要的氛围、主持环节（第1部/第2部）和偏好性别'),
      tr('조건에 맞는 사회자를 소개 영상과 함께 추천해요', 'Matching MCs are recommended with their intro videos', '条件に合う司会者を紹介動画と一緒におすすめします', '附上介绍视频，推荐符合条件的主持人'),
      tr('마음에 드는 사회자만, 또는 추천된 사회자 모두에게 한 번에 신청할 수 있어요', 'Apply to the ones you like, or to all recommended MCs at once', '気に入った司会者だけ、またはおすすめの司会者全員にまとめて申し込めます', '可只申请心仪的主持人，也可一次申请全部推荐的主持人'),
      tr('로그인하지 않아도 연락받을 번호만 남기면 신청돼요', 'No login needed — just leave a number to be contacted', 'ログイン不要、連絡先の番号を残すだけで申し込めます', '无需登录，留下联系电话即可申请'),
    ],
    image: N('02'),
    cta: { label: tr('퀵매칭 시작하기', 'Start Quick Match', 'クイックマッチへ', '开始快速匹配'), href: '/quick-match' },
  },
  {
    id: 'wedding-forest',
    date: '2026.09.28',
    tag: 'company',
    title: tr('예비부부 커뮤니티 웨딩숲을 열었어요', 'Wedding Forest, a community for couples, is open', 'カップルのコミュニティ「ウェディングの森」をオープン', '备婚社区「婚礼森林」正式开放'),
    lead: tr(
      '결혼을 준비하는 예비부부들이 이야기를 나누는 커뮤니티 웨딩숲을 열었어요. 프리티풀 앱 하단 탭에서 바로 들어갈 수 있어요.',
      'We opened Wedding Forest, a community where couples preparing for their wedding share stories. Find it right in the bottom tab of the Freetiful app.',
      '結婚を準備するカップルが語り合うコミュニティ「ウェディングの森」をオープンしました。Freetifulアプリの下部タブからすぐに入れます。',
      '我们开放了备婚新人交流的社区「婚礼森林」，在 Freetiful 应用底部标签即可进入。',
    ),
    points: [
      tr('결혼준비 · 신혼생활 · 임신·육아 · 자유소통 · 정보·꿀팁 · 중고장터 게시판', 'Boards for wedding prep, newlywed life, pregnancy & parenting, free talk, tips and a used market', '結婚準備・新婚生活・妊娠/育児・自由トーク・情報/お役立ち・フリマの掲示板', '设有备婚、新婚生活、孕育、自由交流、资讯·技巧、二手市场等版块'),
      tr('사진은 최대 5장까지, 투표로 다른 예비부부의 의견도 물어요', 'Up to 5 photos per post, plus polls to ask other couples', '写真は最大5枚まで、投票で他のカップルの意見も聞けます', '每帖最多 5 张照片，还能发起投票征求其他新人的意见'),
      tr('AI가 글 내용에 맞는 카테고리와 태그를 추천해요', 'AI suggests categories and tags that fit your post', 'AIが投稿内容に合うカテゴリーとタグをおすすめします', 'AI 会根据内容推荐分类和标签'),
      tr('일반 회원은 랜덤 닉네임으로 표시돼 부담 없이 글을 써요', 'Members appear under random nicknames, so posting feels easy', '一般会員はランダムなニックネームで表示され、気軽に投稿できます', '普通会员以随机昵称显示，发帖更轻松'),
    ],
    image: N('01'),
    cta: { label: tr('웨딩숲 둘러보기', 'Visit Wedding Forest', 'ウェディングの森へ', '逛逛婚礼森林'), href: '/community' },
  },
  {
    id: 'wedding-partners',
    date: '2026.09.26',
    tag: 'hall',
    title: tr('웨딩홀 정보를 더 자세히 볼 수 있어요', 'See wedding hall details more fully', '式場の情報をより詳しく', '婚礼堂信息看得更详细'),
    lead: tr(
      '웨딩홀 · 드레스 · 스튜디오 등 웨딩 파트너의 상세 화면을 새로 꾸몄어요. 예식을 준비하는 손님이 웨딩홀을 더 자세히 살펴보고 바로 문의할 수 있어요.',
      'We redesigned the detail pages for wedding partners such as wedding halls, dress shops and studios. Couples preparing a ceremony can look closer at each hall and inquire right away.',
      '式場・ドレス・スタジオなどウェディングパートナーの詳細画面を新しくしました。挙式を準備するお客様が式場をじっくり見て、そのまま問い合わせできます。',
      '我们重新设计了婚礼堂、婚纱、摄影工作室等婚礼合作伙伴的详情页面。筹备婚礼的客户可以更仔细地了解婚礼堂并直接咨询。',
    ),
    points: [
      tr('사진을 넘겨 보거나 모아보기로 한 번에 봐요', 'Swipe through photos or view them all at once', '写真をめくって見たり、一覧でまとめて見たりできます', '可滑动浏览照片，也可一次查看全部'),
      tr('지도에서 위치를 확인하고 카카오맵 · 네이버 지도로 바로 길을 찾아요', 'Check the location on a map and get directions in Kakao Map or Naver Map', '地図で場所を確認し、カカオマップ・NAVER地図ですぐに経路を検索できます', '在地图上确认位置，可直接用 Kakao 地图 · Naver 地图导航'),
      tr('문의하기로 이름 · 연락처 · 문의 종류 · 희망 시기를 남겨요', 'Inquire with name, contact, inquiry type and preferred timing', 'お問い合わせで名前・連絡先・種類・希望時期を残せます', '通过咨询留下姓名、联系方式、咨询类型和期望时间'),
      tr('인스타그램 · 웹사이트 · 공유 버튼을 한곳에 모았어요', 'Instagram, website and share buttons in one place', 'Instagram・Webサイト・共有ボタンを一か所にまとめました', 'Instagram、网站和分享按钮集中在一处'),
    ],
    image: N('07'),
    cta: CTA_INQUIRY_HALL,
  },
  {
    id: 'safe-pay',
    date: '2026.08.23',
    tag: 'company',
    title: tr('안전결제 안내와 환불 규정을 정리했어요', 'Safe Pay guidance and refund policy, organized', '安全決済の案内と返金規定を整理しました', '整理了安全支付说明和退款规定'),
    lead: tr(
      '행사를 맡기는 손님이 안심하고 거래할 수 있도록 안전결제 안내를 강화하고, 환불 규정을 앱에서 바로 볼 수 있게 했어요. 프리티풀 안전결제는 행사가 끝난 뒤 대금이 진행자에게 전달돼요.',
      'To help clients book with peace of mind, we strengthened Safe Pay guidance and made the refund policy available right in the app. With Freetiful Safe Pay, payment reaches the host only after the event.',
      '安心して依頼できるよう安全決済の案内を強化し、返金規定をアプリですぐに確認できるようにしました。Freetifulの安全決済では、イベント終了後に代金が司会者へ渡ります。',
      '为了让客户放心交易，我们加强了安全支付说明，并可在应用内直接查看退款规定。使用 Freetiful 安全支付，活动结束后款项才会转给主持人。',
    ),
    points: [
      tr('견적서가 안전결제 카드로 — 제공 서비스 · 행사일 · 금액을 한눈에', 'Quotes arrive as Safe Pay cards showing the service, event date and amount', '見積書が安全決済カードに — サービス内容・イベント日・金額がひと目で', '报价单变为安全支付卡片，服务内容、活动日期、金额一目了然'),
      tr('결제를 마치면 결제 시각 · 상품 · 주문번호 · 금액이 담긴 카드가 대화에 남아요', 'After payment, a card with time, item, order number and amount stays in the chat', '決済後は決済時刻・商品・注文番号・金額のカードがトークに残ります', '付款后，包含付款时间、商品、订单号和金额的卡片会留在聊天中'),
      tr('안전결제가 아닌 직접 결제를 권유받으면 신고할 수 있게 채팅에서 안내해요', 'The chat explains how to report requests to pay outside Safe Pay', '安全決済以外の直接決済を勧められたら通報できるよう、チャットでご案内します', '如被要求绕过安全支付直接付款，聊天中会提示如何举报'),
      tr('플랫폼 환불 규정 페이지를 새로 만들어 사회자 상세 · FAQ에서 바로 열어요', 'A new refund policy page, linked from host profiles and the FAQ', '返金規定ページを新設し、司会者詳細・FAQからすぐに開けます', '新增平台退款规定页面，可从主持人详情和 FAQ 直接打开'),
    ],
    image: N('12'),
    cta: { label: tr('안전결제 알아보기', 'About Safe Pay', '安全決済について', '了解安全支付'), href: '/safe-payment' },
  },
  {
    id: 'corporate-mc',
    date: '2026.07.09',
    tag: 'event',
    title: tr('기업행사 사회자 섭외 페이지를 열었어요', 'Our corporate event MC booking page is open', '企業イベント司会者の依頼ページをオープン', '企业活动主持人预约页面上线'),
    lead: tr(
      '기업행사 · 국제 행사를 준비하는 담당자를 위해 행사 사회자 섭외 페이지를 새로 열었어요. 방송사 출신 아나운서 등 검증된 행사 사회자를 한곳에서 소개해요.',
      'For planners preparing corporate and international events, we opened a new event MC booking page. It introduces verified event MCs, including former broadcast announcers, in one place.',
      '企業イベント・国際イベントを準備するご担当者のために、イベント司会者の依頼ページを新しく開きました。放送局出身のアナウンサーなど、検証済みのイベント司会者を一か所でご紹介します。',
      '为筹备企业活动和国际活动的负责人，我们新开设了活动主持人预约页面，集中介绍广播电视台出身的主播等经过认证的活动主持人。',
    ),
    points: [
      tr('실제 행사 사진 · 영상과 담당자 후기를 볼 수 있어요', 'See real event photos, videos and reviews from planners', '実際のイベント写真・動画とご担当者のレビューを見られます', '可查看真实活动照片、视频和负责人评价'),
      tr('영어 · 중국어 · 일본어 등 국제 행사 사회자도 섭외해요', 'Book MCs for international events in English, Chinese, Japanese and more', '英語・中国語・日本語など国際イベントの司会者も依頼できます', '也可预约英语、中文、日语等国际活动主持人'),
      tr('문의서 한 장에 행사 예정일 · 기획 내용 · 첨부파일을 남기면 담당자가 확인 후 연락드려요', 'Leave the event date, plan and attachments in one form — our team gets back to you', '依頼書1枚にイベント予定日・企画内容・添付ファイルを残せば、担当者が確認後にご連絡します', '在一张咨询单中留下活动日期、策划内容和附件，负责人确认后联系您'),
    ],
    image: N('20'),
    cta: { label: tr('기업행사 문의하기', 'Event inquiry', '企業イベントのご相談', '企业活动咨询'), href: '/biz/inquiry' },
  },
  {
    id: 'villadegd',
    date: '2026.06',
    tag: 'hall',
    title: tr('빌라드지디 웨딩홀 · 한국웨딩협회와 제휴했어요', 'Partnered with Villa de GD Wedding Hall and the Korea Wedding Association', 'ヴィラ・ド・ジディ ウェディングホール・韓国ウェディング協会と提携', '与 Villa de GD 婚礼会馆、韩国婚礼协会签署合作'),
    lead: tr(
      '프리티풀이 빌라드지디 웨딩홀, 한국웨딩협회와 제휴를 맺었어요.',
      'Freetiful has partnered with Villa de GD Wedding Hall and the Korea Wedding Association.',
      'Freetifulはヴィラ・ド・ジディ ウェディングホール、韓国ウェディング協会と提携しました。',
      'Freetiful 与 Villa de GD 婚礼会馆、韩国婚礼协会签署了合作协议。',
    ),
    points: [
      tr('검증을 마친 진행자만 연결해요', 'We only connect verified hosts', '検証済みの司会者だけをおつなぎします', '只对接通过认证的主持人'),
      tr('프리티풀 진행자의 결혼식 사회 경력 13,000회 이상', 'Freetiful hosts bring 13,000+ weddings of experience', 'Freetifulの司会者による結婚式司会の実績は13,000回以上', 'Freetiful 主持人的婚礼主持经验超过 13,000 场'),
    ],
    body: tr(
      '프리티풀 비즈는 웨딩홀의 예식을 검증된 사회자가 맡는 웨딩홀 전속 사회자를 연결해요. 전속 사회자 제휴가 궁금한 웨딩홀은 언제든 문의해 주세요.',
      'Freetiful Biz connects wedding halls with resident MCs — verified hosts who lead the ceremonies in your hall. Wedding halls curious about a resident MC partnership are welcome to reach out anytime.',
      'Freetiful Bizは、検証済みの司会者が式場の挙式を担う「式場専属司会者」をおつなぎします。専属司会者の提携にご関心のある式場は、いつでもお問い合わせください。',
      'Freetiful Biz 为婚礼堂对接专属主持人——由经过认证的主持人负责婚礼堂的仪式。对专属主持人合作感兴趣的婚礼堂，欢迎随时咨询。',
    ),
    image: { src: '/images/banners/pc-hero-villadegd.webp', bg: '#E4DFD7', position: '50% 30%', veil: PHOTO_VEIL },
    cta: CTA_INQUIRY_HALL,
    milestone: tr('빌라드지디 웨딩홀 & 한국웨딩협회 제휴', 'Villa de GD Wedding Hall & Korea Wedding Association partnership', 'ヴィラ・ド・ジディ ウェディングホール&韓国ウェディング協会と提携', '与 Villa de GD 婚礼会馆和韩国婚礼协会合作'),
  },
  {
    id: 'grand-open',
    date: '2026.05.06',
    tag: 'company',
    title: tr('사회자 찾기부터 결제까지, 프리티풀 안에서', 'From finding an MC to paying, all in Freetiful', '司会者探しから決済まで、Freetifulの中で', '从寻找主持人到付款，都在 Freetiful 内完成'),
    lead: tr(
      '검증된 사회자를 찾고, 상담하고, 결제하는 과정을 프리티풀 안에서 안전하게 진행할 수 있어요.',
      'Finding verified MCs, consulting with them and paying can all be done safely within Freetiful.',
      '検証済みの司会者を探し、相談し、決済するまでをFreetiful内で安全に進められます。',
      '寻找认证主持人、咨询、付款的整个过程都可以在 Freetiful 内安全完成。',
    ),
    points: [
      tr('결혼식 · 행사 · 외국어 사회자의 프로필 · 영상 · 후기를 한곳에서 비교해요', 'Compare profiles, videos and reviews of wedding, event and foreign-language MCs in one place', '結婚式・イベント・外国語の司会者のプロフィール・動画・口コミを一か所で比較できます', '在一处比较婚礼、活动、外语主持人的资料、视频和评价'),
      tr('채팅으로 사회자와 직접 상담하고 견적서를 받아요', 'Consult MCs directly in chat and receive quotes', 'チャットで司会者に直接相談し、見積書を受け取れます', '通过聊天直接咨询主持人并获取报价单'),
      tr('받은 견적서는 프리티풀 안전결제로 결제해요', 'Pay quotes with Freetiful Safe Pay', '受け取った見積書はFreetiful安全決済で決済できます', '收到的报价单可用 Freetiful 安全支付付款'),
      tr('웨딩홀 · 드레스 · 스튜디오 등 웨딩 파트너 정보도 함께 봐요', 'Browse wedding partners like wedding halls, dress shops and studios', '式場・ドレス・スタジオなどウェディングパートナーの情報も見られます', '还能查看婚礼堂、婚纱、摄影工作室等婚礼合作伙伴信息'),
    ],
    image: N('29'),
    cta: { label: tr('프리티풀 둘러보기', 'Explore Freetiful', 'Freetifulを見る', '浏览 Freetiful'), href: '/main' },
  },
  {
    id: 'kodit',
    date: '2026.05',
    tag: 'company',
    title: tr('신용보증기금 성장지원 기업에 선정됐어요', 'Selected for the KODIT growth support program', '信用保証基金の成長支援企業に選定されました', '入选信用保证基金成长支持企业'),
    lead: tr(
      '프리티풀을 운영하는 주식회사 커넥트풀이 신용보증기금 성장지원 기업으로 선정됐어요.',
      'Connectful Inc., the company behind Freetiful, has been selected as a growth support company by the Korea Credit Guarantee Fund (KODIT).',
      'Freetifulを運営する株式会社 Connectfulが、信用保証基金の成長支援企業に選定されました。',
      '运营 Freetiful 的 Connectful 株式会社入选信用保证基金成长支持企业。',
    ),
    image: N('31'),
    cta: CTA_HISTORY,
    milestone: tr('신용보증기금 성장지원 기업 선정', 'Selected for KODIT growth support', '信用保証基金の成長支援企業に選定', '入选信用保证基金成长支持企业'),
  },
  {
    id: 'company-i18n',
    date: '2026.04.22',
    tag: 'event',
    title: tr('회사 소개를 4개 언어로 볼 수 있어요', 'Our company pages now come in 4 languages', '会社紹介を4か国語でご覧いただけます', '公司介绍支持 4 种语言'),
    lead: tr(
      '해외 고객사와 외국어 행사 담당자도 볼 수 있도록 회사 소개 페이지를 한국어 · 영어 · 일본어 · 중국어로 준비했어요.',
      'So overseas clients and planners of foreign-language events can read them too, our company pages are now available in Korean, English, Japanese and Chinese.',
      '海外のお取引先や外国語イベントのご担当者にもご覧いただけるよう、会社紹介ページを韓国語・英語・日本語・中国語でご用意しました。',
      '为了让海外客户和外语活动负责人也能阅读，我们准备了韩语、英语、日语、中文版的公司介绍页面。',
    ),
    points: [
      tr('회사 소개 · 대표 인사말 · 연혁 · 고객사 · 인재채용을 4개 언어로', 'Company intro, CEO message, milestones, clients and careers in 4 languages', '会社紹介・代表挨拶・沿革・取引先・採用を4か国語で', '公司简介、CEO 致辞、发展历程、客户、人才招聘均有 4 种语言'),
      // 비즈 머리줄은 KO · EN 두 칸(261009 사장 '프리티풀로 좌측엔 영어 한국어 번역 탭') — 예전 '언어 버튼으로 4개 언어' 안내는 지금 화면과 달랐다
      tr('화면 위쪽 KO · EN 탭으로 한국어와 영어를 바로 바꿔요', 'Switch between Korean and English with the KO · EN tabs at the top', '画面上部の KO・EN タブで韓国語と英語をすぐに切り替えられます', '可通过页面上方的 KO · EN 标签即时切换韩语和英语'),
      tr('기업 문의에 파일을 첨부하면 담당자에게 바로 전달돼요', 'Attach files to business inquiries — they go straight to our team', '法人のお問い合わせにファイルを添付すると、担当者へすぐに届きます', '企业咨询可附加文件，直接送达负责人'),
    ],
    image: N('34'),
    cta: { label: tr('기업소개 보기', 'About us', '会社紹介を見る', '查看公司介绍'), href: '/biz/ceo' },
  },
  {
    id: 'biz-open',
    date: '2026.04.09',
    tag: 'event',
    title: tr('행사 담당자를 위한 비즈 페이지를 열었어요', 'Our Biz page for event planners is open', 'イベントご担当者のためのBizページをオープン', '为活动负责人打造的 Biz 页面上线'),
    lead: tr(
      '프리티풀이 어떤 회사인지 한눈에 볼 수 있는 회사 소개(Biz) 페이지를 새로 열고, 기업행사 담당자를 위한 문의 창구를 만들었어요.',
      'We opened the Biz page, where you can see who Freetiful is at a glance, along with an inquiry channel for corporate event planners.',
      'Freetifulがどんな会社かひと目でわかる会社紹介（Biz）ページを新しく開き、企業イベントのご担当者向けのお問い合わせ窓口を設けました。',
      '我们新开设了可一目了然了解 Freetiful 的公司介绍（Biz）页面，并为企业活动负责人开设了咨询窗口。',
    ),
    points: [
      tr('회사 소개 · 대표 인사말 · 연혁 · 자료실 · 오시는 길을 한곳에', 'Company intro, CEO message, milestones, resources and directions in one place', '会社紹介・代表挨拶・沿革・資料室・アクセスを一か所に', '公司简介、CEO 致辞、发展历程、资料室、交通指南集中一处'),
      tr('프리티풀 홍보 영상과 송년회 현장 영상', 'Freetiful promo video and footage from our year-end reception', 'Freetiful のプロモーション動画と忘年会の現場映像', 'Freetiful 宣传视频和年会现场视频'),
      tr('함께 일할 동료를 찾는 인재채용 페이지', 'A careers page for future colleagues', '一緒に働く仲間を探す採用ページ', '寻找同事的人才招聘页面'),
    ],
    image: { src: `${PHOTO}/event-06.webp`, bg: '#DAD8D6', position: '50% 40%', veil: PHOTO_VEIL },
    cta: { label: tr('문의하기', 'Contact us', 'お問い合わせ', '联系我们'), href: '/biz/inquiry' },
  },
  {
    id: 'venture',
    date: '2026.03',
    tag: 'company',
    title: tr('벤처기업 인증을 받았어요', 'Certified as a venture company', 'ベンチャー企業認証を取得しました', '获得风险企业认证'),
    lead: tr(
      '프리티풀을 운영하는 주식회사 커넥트풀이 기술 혁신형 벤처기업으로 공식 인증을 받았어요.',
      'Connectful Inc., the company behind Freetiful, has been officially certified as a technology-innovation venture company.',
      'Freetifulを運営する株式会社 Connectfulが、技術革新型ベンチャー企業として公式認証を取得しました。',
      '运营 Freetiful 的 Connectful 株式会社获得了技术创新型风险企业官方认证。',
    ),
    image: N('28'),
    cta: CTA_HISTORY,
    milestone: tr('벤처기업 인증 획득', 'Certified as a venture company', 'ベンチャー企業認証取得', '获得风险企业认证'),
  },
  {
    id: 'partners-300',
    date: '2026.02',
    tag: 'company',
    title: tr('제휴업체 300여 곳과 파트너십을 맺었어요', 'Strategic partnerships with 300+ affiliates', '提携先約300社と戦略的パートナーシップを締結', '与 300 余家合作伙伴建立战略合作'),
    lead: tr(
      '프리티풀이 제휴업체 300여 곳과 전략적 파트너십을 맺고, 전국 단위 행사 인프라 네트워크를 갖췄어요.',
      'Freetiful formed strategic partnerships with more than 300 affiliates, building a nationwide event infrastructure network.',
      'Freetifulは提携先約300社と戦略的パートナーシップを締結し、全国単位のイベントインフラネットワークを構築しました。',
      'Freetiful 与 300 余家合作伙伴建立战略合作，构建了全国性的活动基础设施网络。',
    ),
    // 악수하는 짙은 소매가 글자 줄 뒤로 와서 막을 조금 더 짙게
    image: { ...N('38'), veil: [0.72, 0.88] },
    cta: CTA_HISTORY,
    milestone: tr('제휴업체 300여 곳과 전략적 파트너십', 'Strategic partnerships with 300+ affiliates', '提携先約300社と戦略的パートナーシップ', '与 300 余家合作伙伴建立战略合作'),
  },
  {
    id: 'seed',
    date: '2026.02',
    tag: 'company',
    title: tr('Seed 투자를 유치했어요', 'Secured Seed investment', 'シード投資を調達しました', '获得种子轮投资'),
    lead: tr(
      '프리티풀이 전문투자기관으로부터 시드 라운드 투자를 유치했어요.',
      'Freetiful secured seed-round investment from institutional investors.',
      'Freetifulは専門投資機関からシードラウンドの投資を調達しました。',
      'Freetiful 从专业投资机构获得了种子轮投资。',
    ),
    image: N('14'),
    cta: CTA_HISTORY,
    milestone: tr('전문투자기관 Seed 투자 유치', 'Seed investment secured', 'シード投資調達', '获得种子轮投资'),
  },
  {
    id: 'launch',
    date: '2026.01',
    tag: 'company',
    title: tr('프리티풀 브랜드를 론칭했어요', 'The Freetiful brand is launched', 'Freetifulブランドをローンチしました', 'Freetiful 品牌正式发布'),
    lead: tr(
      '프리티풀 브랜드를 공식 론칭하고, MC · 아나운서 · 쇼호스트 등 전문 행사인력을 연결하는 매칭 플랫폼을 출시했어요.',
      'We officially launched the Freetiful brand and released a matching platform that connects professional event talent such as MCs, announcers and show hosts.',
      'Freetifulブランドを公式ローンチし、MC・アナウンサー・ショーホストなどプロのイベント人材をつなぐマッチングプラットフォームを開始しました。',
      '我们正式发布 Freetiful 品牌，并推出了对接 MC、主播、购物主持人等专业活动人才的匹配平台。',
    ),
    image: N('33'),
    cta: CTA_HISTORY,
    milestone: tr('브랜드 론칭 · 매칭 플랫폼 출시', 'Brand launch & matching platform', 'ブランドローンチ・マッチング開始', '品牌发布 · 匹配平台上线'),
  },
  {
    id: 'founded',
    date: '2025.12',
    tag: 'company',
    title: tr('주식회사 커넥트풀을 설립했어요', 'Connectful Inc. is founded', '株式会社 Connectfulを設立しました', 'Connectful 株式会社成立'),
    lead: tr(
      '프리티풀을 운영하는 주식회사 커넥트풀이 법인을 설립하고 사업을 시작했어요.',
      'Connectful Inc., the company behind Freetiful, was incorporated and began operations.',
      'Freetifulを運営する株式会社 Connectfulが法人を設立し、事業を開始しました。',
      '运营 Freetiful 的 Connectful 株式会社完成法人设立并开始营业。',
    ),
    image: N('41'),
    cta: CTA_HISTORY,
    milestone: tr('주식회사 커넥트풀 설립', 'Connectful Inc. founded', '株式会社 Connectful 設立', 'Connectful 株式会社成立'),
  },
  {
    id: 'reception-2025',
    date: '2025.11.24',
    tag: 'event',
    title: tr('한국여성사회자협회와 2025 송년회를 함께했어요', 'The 2025 year-end reception with the Woman MC Association Korea', '韓国女性司会者協会と2025年の忘年会を開催', '与韩国女性主持人协会共同举办 2025 年会'),
    lead: tr(
      '한국여성사회자협회와 프리티풀이 함께한 2025 송년회. 그날 무대를 영상으로 담았어요.',
      'The 2025 year-end reception, held by the Woman MC Association Korea and Freetiful. Here is the stage from that night.',
      '韓国女性司会者協会とFreetifulによる2025年の忘年会。その日のステージを映像に収めました。',
      '韩国女性主持人协会与 Freetiful 共同举办的 2025 年会，我们用视频记录了当天的舞台。',
    ),
    image: { src: '/images/biz-v2/seq/stage-64.webp', bg: '#DCD8D4', position: '50% 30%', veil: PHOTO_VEIL },
    video: '/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4',
    cta: { label: tr('행사 문의하기', 'Event inquiry', 'イベントのご相談', '活动咨询'), href: '/biz/inquiry' },
  },
];

/** 연혁 기사(오래된 순) — 시트 아래 '프리티풀이 걸어온 길' */
export const BIZ_NEWS_MILESTONES = BIZ_NEWS.filter((n) => n.milestone).slice().reverse();
