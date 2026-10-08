/*
 * CEO 인사말(/biz/ceo) 문구 · 소재(261009 사장 '기업소개는 CEO 인사말로 — 비즈 고급 인터랙션 스타일로 리디자인').
 * 문구 · 사람 · 직함은 예전 CEO 인사말 화면(4개 언어)을 한 글자도 빼지 않고 옮긴 것 — 새 사실 · 숫자 · 약속은 넣지 않는다.
 *   (‘1,000여 명’ · ‘KBS · SBS · MBC’ 숫자 칸은 인사말 셋째 문단에 있는 사실을 크게 보여 줄 뿐이다.)
 *   중국어는 비즈 다른 화면처럼 전각 문장부호(，)로만 고쳤다.
 * 그림 = /images/biz-v2/ceo(기존 사진을 sharp 로 줄이고 같은 틀로 자른 것) · 행사 사진 · 앱 실제 캡처(/images/biz-v2).
 * 부품(components/biz/ceo/*.tsx)은 이 파일만 읽는다.
 */

export type Tr = { ko: string; en: string; ja: string; zh: string };
const tr = (ko: string, en: string, ja: string, zh: string): Tr => ({ ko, en, ja, zh });

/** 문단 조각 — hl = 형광펜(채워지면 밑줄이 그어진다) · strong = 파랑 굵게 */
export type Seg = { s: string; k?: 'hl' | 'strong' };
export type TrSegs = { ko: Seg[]; en: Seg[]; ja: Seg[]; zh: Seg[] };

const IMG = '/images/biz-v2/ceo';
const V2 = '/images/biz-v2';

export const CEO_NAME = tr('서나웅', 'Naung Seo', '徐ナウン', '徐娜雄');
export const CEO_ROLE = tr('대표이사', 'CEO', '代表取締役', '代表理事');
/**
 * 서명 줄 회사 이름 — 인사말 첫 문장('프리티풀 대표이사 서나웅입니다')과 같은 브랜드 이름만 쓴다(261009 검증).
 * 예전 CEO 화면의 '주식회사 프리티풀'은 법인명이 아니다 — 법인은 '주식회사 커넥트풀'(연혁 · 뉴스 · 앱 바닥글 사업자 정보)이라
 * 같은 비즈 안에서 법인명이 화면마다 달라 보였다.
 */
export const COMPANY = tr('프리티풀', 'Freetiful', 'Freetiful', 'Freetiful');

/* ① 첫 화면 */
export const HERO = {
  eyebrow: tr('CEO 인사말', "CEO's Message", 'CEO 挨拶', 'CEO 致辞'),
  /** 인사말 첫 문장 '안녕하세요. 프리티풀 대표이사 서나웅입니다.' — 큰 제목은 줄을 나눠 보여 준다(261009 사장 '안녕하세요, 프리티풀 대표이사 서나웅입니다') */
  title: [
    tr('안녕하세요,', 'Hello.', 'こんにちは。', '您好，'),
    tr('프리티풀 대표이사', 'I am Naung Seo,', 'Freetiful 代表取締役の', '我是 Freetiful'),
    tr('서나웅입니다', 'CEO of Freetiful.', '徐ナウンです。', '代表理事徐娜雄。'),
  ],
  /** 읽기 프로그램용 — 원문 그대로 */
  titleFull: tr('안녕하세요. 프리티풀 대표이사 서나웅입니다.', 'Hello. I am Naung Seo, CEO of Freetiful.', 'こんにちは。Freetiful 代表取締役の徐ナウンです。', '您好，我是 Freetiful 代表理事徐娜雄。'),
  sub: tr('프리티풀의 비전과 철학을 소개합니다', 'Our vision and philosophy', 'Freetiful のビジョンと哲学', 'Freetiful 的愿景与理念'),
  /** 대표 한마디(예전 인사말 큰 제목) */
  motto: tr('검증되지 않은 사람은 연결하지 않는다', "We don't connect anyone who isn't verified", '検証されていない人は繋がない', '未经认证者，绝不连接'),
  portrait: { lg: `${IMG}/ceo-portrait-1700.webp`, sm: `${IMG}/ceo-portrait-1000.webp`, aspect: 2066 / 3288 },
  face: `${IMG}/ceo-face-240.webp`,
  alt: tr('서나웅 대표이사', 'CEO Naung Seo', '代表取締役 徐ナウン', '代表理事 徐娜雄'),
  scrollHint: tr('아래로 내려 인사말 보기', 'Scroll to read', 'スクロールして読む', '向下滚动阅读'),
};

/* ② 인사말 본문(첫 문장은 첫 화면 큰 제목) */
export const LETTER: TrSegs[] = [
  {
    ko: [
      { s: '여러분의 결혼식, 기업 행사, 공식 의전, 그리고 인생의 중요한 순간들. 특별한 자리에는 언제나 그 순간의 품격과 분위기를 완성하는 사람이 있습니다. 프리티풀은 바로 그 가치를 누구보다 잘 알기에, ' },
      { s: '전문 진행자와 고객을 가장 정확하고 신뢰도 높게 연결하는 플랫폼', k: 'hl' },
      { s: '을 만들고 있습니다.' },
    ],
    en: [
      { s: "Weddings, corporate events, official ceremonies, and life's most important moments — every special occasion needs someone who elevates its tone and atmosphere. Because we understand that value better than anyone, Freetiful is building " },
      { s: 'the most accurate and trustworthy platform connecting professional hosts with clients', k: 'hl' },
      { s: '.' },
    ],
    ja: [
      { s: '結婚式、企業イベント、公式行事、そして人生の大切な瞬間。特別な場には、その瞬間の品格と雰囲気を完成させる人が必要です。Freetiful はその価値を誰よりもよく理解しているからこそ、' },
      { s: 'プロ司会者とお客様を最も正確かつ信頼できる形で結ぶプラットフォーム', k: 'hl' },
      { s: 'を構築しています。' },
    ],
    zh: [
      { s: '婚礼、企业活动、官方典礼，以及人生中重要的时刻。特别的场合总需要能够成就品格与氛围的人。Freetiful 比任何人都更理解这一价值，因此我们正在打造 ' },
      { s: '以最准确、最值得信赖的方式连接专业主持人与客户的平台', k: 'hl' },
      { s: '。' },
    ],
  },
  {
    ko: [
      { s: '프리티풀은 KBS, SBS, MBC 등 주요 방송사 출신을 비롯해, 풍부한 현장 경험과 전문성을 갖춘 아나운서, MC, 쇼호스트를 엄선하여 ' },
      { s: '전국 1,000여 명의 전문 진행자 네트워크', k: 'strong' },
      { s: '를 구축해왔습니다.' },
    ],
    en: [
      { s: 'Freetiful carefully selects announcers, MCs, and show hosts — including alumni of KBS, SBS, and MBC — with extensive field experience and proven expertise, building a ' },
      { s: 'nationwide network of over 1,000 professional hosts', k: 'strong' },
      { s: '.' },
    ],
    ja: [
      { s: 'Freetiful は KBS、SBS、MBC 等の主要放送局出身をはじめ、豊富な現場経験と専門性を持つアナウンサー、MC、ショーホストを厳選し、' },
      { s: '全国 1,000 名以上のプロ司会者ネットワーク', k: 'strong' },
      { s: 'を築いてきました。' },
    ],
    zh: [
      { s: 'Freetiful 精心挑选来自 KBS、SBS、MBC 等主要广播公司的主播、MC、购物主持人，他们拥有丰富的现场经验与专业能力，已建成 ' },
      { s: '覆盖全国 1,000 余名专业主持人的网络', k: 'strong' },
      { s: '。' },
    ],
  },
  {
    ko: [
      { s: '이를 바탕으로 고객의 소중한 시간을 가장 아름다운 순간으로 완성하고, 프리랜서 진행자들이 더욱 안정적으로 성장할 수 있는 환경을 조성해 ' },
      { s: '모두가 함께 성장하는 건강한 생태계', k: 'hl' },
      { s: '를 만들어가고자 합니다.' },
    ],
    en: [
      { s: "On this foundation, we complete our clients' precious moments as truly beautiful memories, while creating an environment where freelance hosts can grow more stably — building " },
      { s: 'a healthy ecosystem where everyone grows together', k: 'hl' },
      { s: '.' },
    ],
    ja: [
      { s: 'これを基盤に、お客様の大切な時間を最も美しい瞬間に仕上げ、フリーランス司会者がより安定的に成長できる環境を整え ' },
      { s: '皆が共に成長する健全なエコシステム', k: 'hl' },
      { s: 'を築いていきます。' },
    ],
    zh: [
      { s: '以此为基础，我们将客户珍贵的时光打造为最美的回忆，同时为自由主持人创造更稳定的成长环境，构建 ' },
      { s: '共同成长的健康生态', k: 'hl' },
      { s: '。' },
    ],
  },
  {
    ko: [{ s: '단순히 사람을 연결하는 것을 넘어, 고객이 원하는 분위기와 목적에 가장 적합한 검증된 진행자를 제안하는 것, 그것이 프리티풀의 역할이라고 믿습니다.' }],
    en: [{ s: "Beyond simply connecting people, our role is to recommend the verified host that best matches each client's desired atmosphere and purpose." }],
    ja: [{ s: '単に人を繋ぐだけでなく、お客様が望む雰囲気と目的に最も適した認証済み司会者を提案すること、それが Freetiful の役割だと信じています。' }],
    zh: [{ s: '不仅仅是连接人与人，更是向客户推荐最契合期望氛围与目的的认证主持人——这才是 Freetiful 的使命。' }],
  },
  {
    ko: [
      { s: '앞으로도 체계적인 품질 관리 시스템을 바탕으로, 고객이 행사진행의 모든 순간을 ' },
      { s: '믿고 맡길 수 있는 최고의 서비스', k: 'hl' },
      { s: '를 제공하겠습니다.' },
    ],
    en: [
      { s: 'Going forward, backed by a systematic quality management system, we will deliver ' },
      { s: 'the best service that clients can trust with every moment of their event', k: 'hl' },
      { s: '.' },
    ],
    ja: [
      { s: '今後も体系的な品質管理システムを基に、お客様がイベント進行のすべての瞬間を ' },
      { s: '安心して任せられる最高のサービス', k: 'hl' },
      { s: 'をご提供いたします。' },
    ],
    zh: [
      { s: '未来，我们将基于体系化的品质管理系统，为客户提供 ' },
      { s: '可以放心托付每一个活动瞬间的顶级服务', k: 'hl' },
      { s: '。' },
    ],
  },
];

/** 숫자 칸을 끼워 넣을 문단(0부터) — 방송사 · 1,000여 명 문단 바로 뒤 */
export const STAT_AFTER = 1;

/** 셋째 문단의 사실을 크게(새 숫자 아님) */
export const STAT = {
  value: 1000,
  suffix: tr('여 명', '+', '名以上', '余名'),
  label: tr('전국 전문 진행자 네트워크', 'Nationwide network of professional hosts', '全国のプロ司会者ネットワーク', '覆盖全国的专业主持人网络'),
  chips: ['KBS', 'SBS', 'MBC'],
  chipsLabel: tr('주요 방송사 출신 진행자', 'Hosts from major broadcasters', '主要放送局出身の司会者', '主要广播公司出身的主持人'),
};

export const THANKS = tr('감사합니다.', 'Thank you.', 'ありがとうございます。', '感谢您的支持。');
/** 맺음말 — 페이지 마지막 장면의 큰 문장 */
export const TAGLINE = tr(
  '여러분의 소중한 시간을 아름다운 순간으로. 프리티풀.',
  'Turning your precious moments into beautiful memories. Freetiful.',
  '皆様の大切な時間を美しい瞬間へ。Freetiful.',
  '将您珍贵的时光化为美好回忆。Freetiful。',
);
export const SIGNATURE = '/images/ceo-signature.svg';

/* ③ 경영 철학 — 카드 4장이 쌓인다 */
export const VALUES_HEAD = { eyebrow: 'OUR PHILOSOPHY', title: tr('경영 철학', 'Management Philosophy', '経営哲学', '经营理念') };
export type ValueCard = { num: string; title: Tr; desc: Tr; photo?: { src: string; pos: string }; screens?: string[] };
export const VALUES: ValueCard[] = [
  {
    num: '01',
    title: tr('신뢰 중심 경영', 'Trust-First Management', '信頼中心の経営', '信任为本'),
    desc: tr('검증된 사회자만을 연결합니다. 시스템으로 신뢰를 설계하고, 데이터로 품질을 보장합니다.', 'We connect only verified professionals. Trust is designed through systems, quality assured through data.', '検証された専門家のみを繋ぎます。システムで信頼を設計し、データで品質を保証します。', '仅连接经过认证的专业人士。以系统构建信任，以数据保障质量。'),
    photo: { src: `${V2}/photos/event-11.webp`, pos: '28% 40%' },
  },
  {
    num: '02',
    title: tr('고객 가치 최우선', 'Customer Value First', 'お客様価値優先', '客户价值至上'),
    desc: tr('고객의 소중한 순간에 집중합니다. 결혼식, 기업행사 등 인생의 중요한 순간을 완벽하게 만드는 것이 우리의 사명입니다.', "We focus on our customers' precious moments. Making life's important events — weddings, corporate gatherings — perfect is our mission.", 'お客様の大切な瞬間に集中します。結婚式、企業イベントなど人生の大切な瞬間を完璧に仕上げることが我々の使命です。', '专注于客户珍贵的瞬间。将婚礼、企业活动等人生重要时刻做到完美，是我们的使命。'),
    photo: { src: `${V2}/photos/event-09.webp`, pos: '50% 26%' },
  },
  {
    num: '03',
    title: tr('상생의 생태계', 'Win-Win Ecosystem', '共生のエコシステム', '共生生态'),
    desc: tr('프리랜서 진행자가 안정적으로 활동하고 성장할 수 있는 환경을 만듭니다. 플랫폼과 사회자가 함께 성장합니다.', 'We build an environment where freelance hosts can work and grow stably. Platform and professionals grow together.', 'フリーランス司会者が安定して活動し成長できる環境を作ります。プラットフォームと専門家が共に成長します。', '为自由主持人打造稳定的工作与成长环境。平台与专业人士共同成长。'),
    photo: { src: `${V2}/photos/event-05.webp`, pos: '62% 55%' },
  },
  {
    num: '04',
    title: tr('기술 기반 혁신', 'Tech-Driven Innovation', '技術基盤の革新', '技术驱动创新'),
    desc: tr('AI 매칭, 데이터 분석 등 최신 기술을 활용하여 매칭의 정확도와 서비스 품질을 끊임없이 높여갑니다.', 'We leverage cutting-edge tech like AI matching and data analytics to continuously improve accuracy and service quality.', 'AI マッチング、データ分析等の最新技術を活用し、マッチング精度とサービス品質を絶えず向上させます。', '运用 AI 匹配、数据分析等前沿技术，持续提升匹配精准度与服务品质。'),
    // 앱 실제 캡처(진행자 목록 · 6가지 항목 후기)
    screens: [`${V2}/screens/pros.webp`, `${V2}/screens/reviews.webp`],
  },
];

/* ④ 이사진 소개 — 9명(261009 사장: 김도윤 부대표 COO · 차보경 마케팅실장 추가) */
export const LEADERS_HEAD = { eyebrow: 'LEADERSHIP', title: tr('이사진 소개', 'Leadership', '役員紹介', '董事会介绍') };
export type Leader = { key: string; name: Tr; role: Tr; badge: string; image: string };
export const LEADERS: Leader[] = [
  { key: 'seo-nw', name: CEO_NAME, role: CEO_ROLE, badge: 'CEO', image: `${IMG}/leader-seo-nw.webp` },
  { key: 'kim-dy', name: tr('김도윤', 'Doyun Kim', '金ドユン', '金度允'), role: tr('부대표', 'Vice President', '副代表', '副总裁'), badge: 'COO', image: `${IMG}/leader-kim-dy.webp` },
  { key: 'kim-mo', name: tr('김명옥', 'Myeongok Kim', '金明玉', '金明玉'), role: tr('최고재무책임자', 'Chief Financial Officer', '最高財務責任者', '首席财务官'), badge: 'CFO', image: `${IMG}/leader-kim-mo.webp` },
  { key: 'kim-jh', name: tr('김정훈', 'Jeonghun Kim', '金正勳', '金正勋'), role: tr('최고기술책임자', 'Chief Technology Officer', '最高技術責任者', '首席技术官'), badge: 'CTO', image: `${IMG}/leader-kim-jh.webp` },
  { key: 'lim-hr', name: tr('임하람', 'Haram Lim', '林ハラム', '林哈蓝'), role: tr('최고마케팅책임자', 'Chief Marketing Officer', '最高マーケティング責任者', '首席营销官'), badge: 'CMO', image: `${IMG}/leader-lim-hr.webp` },
  { key: 'kim-sy', name: tr('김수연', 'Suyeon Kim', '金秀妍', '金秀妍'), role: tr('최고인재책임자', 'Chief People Officer', '最高人事責任者', '首席人才官'), badge: 'CPO', image: `${IMG}/leader-kim-sy.webp` },
  { key: 'park-sy', name: tr('박수용', 'Suyong Park', '朴秀勇', '朴秀勇'), role: tr('마케팅본부장', 'Head of Marketing', 'マーケティング本部長', '营销部门负责人'), badge: 'HB', image: `${IMG}/leader-park-sy.webp` },
  { key: 'cha-bk', name: tr('차보경', 'Bokyung Cha', '車ボギョン', '车宝京'), role: tr('마케팅실장', 'Marketing Director', 'マーケティング室長', '营销室长'), badge: 'DIR', image: `${IMG}/leader-cha-bk.webp` },
  { key: 'hwang-ja', name: tr('황지애', 'Jiae Hwang', '黃志愛', '黄志爱'), role: tr('마케팅팀장', 'Marketing Team Lead', 'マーケティングチームリーダー', '营销团队负责人'), badge: 'TL', image: `${IMG}/leader-hwang-ja.webp` },
];

/*
 * ⑤ 조직도 — 예전 화면의 구조 그대로(대표 → C레벨 5 → 산하 팀).
 * 김도윤 부대표(COO)는 산하 팀 · 보고 체계 자료가 없어 조직도 칸을 지어내지 않고 이사진 소개에만 둔다(261009).
 */
export const ORG_HEAD = { eyebrow: 'ORGANIZATION', title: tr('조직도', 'Organization Chart', '組織図', '组织架构') };
export const ORG_CEO = { badge: 'CEO', name: CEO_NAME, role: CEO_ROLE };
export type OrgUnit = { badge: string; name: Tr; role: Tr; teams: Tr[] };
export const ORG_UNITS: OrgUnit[] = [
  {
    badge: 'CFO',
    name: tr('김명옥', 'Myeongok Kim', '金明玉', '金明玉'),
    role: tr('최고재무책임자', 'CFO', '最高財務責任者', '首席财务官'),
    teams: [tr('재무회계팀', 'Finance', '財務会計チーム', '财务会计'), tr('경영지원팀', 'Admin', '経営支援チーム', '经营支援')],
  },
  {
    badge: 'CTO',
    name: tr('김정훈', 'Jeonghun Kim', '金正勳', '金正勋'),
    role: tr('최고기술책임자', 'CTO', '最高技術責任者', '首席技术官'),
    teams: [tr('개발팀', 'Engineering', '開発チーム', '开发'), tr('인프라팀', 'Infrastructure', 'インフラチーム', '基础设施')],
  },
  {
    badge: 'CMO',
    name: tr('임하람', 'Haram Lim', '林ハラム', '林哈蓝'),
    role: tr('최고마케팅책임자', 'CMO', '最高マーケティング責任者', '首席营销官'),
    teams: [tr('마케팅팀', 'Marketing', 'マーケティングチーム', '营销'), tr('콘텐츠팀', 'Content', 'コンテンツチーム', '内容')],
  },
  {
    badge: 'CPO',
    name: tr('김수연', 'Suyeon Kim', '金秀妍', '金秀妍'),
    role: tr('최고인재책임자', 'CPO', '最高人事責任者', '首席人才官'),
    teams: [tr('인재개발팀', 'Talent Dev', '人材開発チーム', '人才发展'), tr('사회자지원팀', 'Host Support', '専門家支援チーム', '专家支援')],
  },
  {
    badge: 'HB',
    name: tr('박수용', 'Suyong Park', '朴秀勇', '朴秀勇'),
    role: tr('마케팅본부장', 'Head of Marketing', 'マーケティング本部長', '营销部门负责人'),
    teams: [tr('퍼포먼스팀', 'Performance', 'パフォーマンスチーム', '效果营销'), tr('브랜드팀', 'Brand', 'ブランドチーム', '品牌')],
  },
];
/** 조직도 설명 — 두 줄(모바일에선 쉼표 뒤에서 줄바꿈) */
export const ORG_CAPTION: [Tr, Tr] = [
  tr('각 부문별 전문 임원이 독립적으로 책임을 맡아,', 'Each domain is led independently by a specialized executive,', '各部門の専門役員が独立して責任を負い、', '各部门由专业高管独立负责，'),
  tr('빠른 의사결정과 실행력 있는 조직 운영을 지향합니다.', 'enabling fast decisions and agile execution.', '迅速な意思決定と実行力のある組織運営を目指します。', '追求快速决策与高效执行的组织运营。'),
];

/* ⑥ 맺음 — 다른 비즈 화면으로 */
export const CLOSING = {
  photo: `${V2}/photos/event-14.webp`,
  cta: tr('문의하기', 'Contact Us', 'お問合せ', '联系我们'),
  ctaHref: '/biz/inquiry',
  links: [
    { label: tr('연혁', 'Milestones', '沿革', '发展历程'), href: '/biz/history' },
    { label: tr('고객사', 'Clients', '取引先', '客户'), href: '/biz/clients' },
    { label: tr('뉴스·소식', 'News', 'ニュース', '新闻资讯'), href: '/biz/news' },
    { label: tr('인재채용', 'Careers', '採用情報', '人才招聘'), href: '/careers' },
  ],
};

/* 바닥글(비즈 홈과 같은 링크 · 회사 정보 — 주소는 예전 CEO 화면의 4개 언어 표기) */
export const FOOTER = {
  phone: '02-765-8882',
  email: 'freetiful2025@gmail.com',
  address: tr('서울시 중구 퇴계로36길 2, 충무로관 본관 130호', 'Room 130, Chungmuro-gwan Main Building, 2 Toegye-ro 36-gil, Jung-gu, Seoul', 'ソウル特別市中区退渓路36ギル2, 忠武路館本館130号', '首尔市中区退溪路36街2号 忠武路馆本馆130号'),
  links: [
    // 비즈 홈 — 머리줄 · 하단 탭의 '기업소개(About)'는 이 화면(/biz/ceo)이라, 같은 'About' 이름으로 /biz 를 가리키면 헷갈렸다(261009 검증)
    { label: tr('비즈 홈', 'Biz home', 'ビズ ホーム', '企业首页'), href: '/biz' },
    { label: tr('연혁', 'Milestones', '沿革', '发展历程'), href: '/biz/history' },
    { label: tr('고객사', 'Clients', '取引先', '客户'), href: '/biz/clients' },
    { label: tr('뉴스·소식', 'News', 'ニュース', '新闻资讯'), href: '/biz/news' },
    { label: tr('자주묻는질문', 'FAQ', 'よくある質問', '常见问题'), href: '/biz/faq' },
    { label: tr('문의하기', 'Contact Us', 'お問合せ', '联系我们'), href: '/biz/inquiry' },
    { label: tr('인재채용', 'Careers', '採用情報', '人才招聘'), href: '/careers' },
    { label: tr('개인정보처리방침', 'Privacy Policy', 'プライバシーポリシー', '隐私政策'), href: '/terms/privacy' },
    { label: tr('블로그', 'Blog', 'ブログ', '博客'), href: 'https://blog.naver.com/freetiful2025', external: true },
    { label: tr('Instagram', 'Instagram', 'Instagram', 'Instagram'), href: 'https://instagram.com/freetiful_', external: true },
    { label: tr('YouTube', 'YouTube', 'YouTube', 'YouTube'), href: 'https://www.youtube.com/@freetiful', external: true },
    { label: tr('TikTok', 'TikTok', 'TikTok', 'TikTok'), href: 'https://www.tiktok.com/@freetiful', external: true },
    // 앱으로 나가는 길 — 비즈 머리줄 '프리티풀로' 글자 탭 · 비즈 홈 바닥글과 같은 이름(비즈에서 '홈'은 비즈 홈이라 '홈으로'면 헷갈린다, 261009 사장 '홈 클릭하면 비즈 홈으로')
    { label: tr('프리티풀로', 'To Freetiful', 'Freetifulへ', '前往 Freetiful'), href: '/main' },
  ],
};
