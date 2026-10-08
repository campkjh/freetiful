/*
 * 비즈 페이지 장면 문구 · 소재(261008 토스 홈 어법 재구현). 문구는 전부 프리티풀이 새로 쓴 것(토스 문장 틀을 옮기지 않음),
 * 사실만 — 검증 입점 · 방송사 출신 · 1,000여 명 · 결혼식 13,000회+ · 영어 진행 · 전국 · 안전결제(행사 뒤 대금 전달)는 기존 비즈 페이지 · 앱 화면에 있는 내용.
 * 그림은 /images/biz-v2 아래 프리티풀 소재(앱 실제 캡처 · 행사 사진 · 송년회 영상 프레임). 장면 컴포넌트는 이 파일만 읽고 고치지 않는다.
 */

export type Tr = { ko: string; en: string; ja: string; zh: string };
const tr = (ko: string, en: string, ja: string, zh: string): Tr => ({ ko, en, ja, zh });

const V2 = '/images/biz-v2';
export const PRO_PROFILE_ID = '6fb8f628-7549-44e6-8136-71d74c937d75';

/** 왼쪽 세로 눈금(장면 목차) — id 는 장면 뿌리 요소의 id(data-dock) */
export const DOCK = [
  { id: 'dock-intro', label: tr('프리티풀', 'Freetiful', 'Freetiful', 'Freetiful') },
  { id: 'dock-chat', label: tr('섭외', 'Booking', '依頼', '预约') },
  { id: 'dock-hosts', label: tr('진행자', 'Hosts', '司会者', '主持人') },
  { id: 'dock-match', label: tr('매칭', 'Matching', 'マッチング', '匹配') },
  { id: 'dock-career', label: tr('경력', 'Career', '経歴', '经历') },
  { id: 'dock-door', label: tr('현장', 'On site', '現場', '现场') },
  { id: 'dock-book', label: tr('예약', 'Reserve', '予約', '预订') },
  { id: 'dock-events', label: tr('행사', 'Events', 'イベント', '活动') },
  { id: 'dock-scale', label: tr('규모', 'Network', '規模', '规模') },
  { id: 'dock-clients', label: tr('고객사', 'Clients', '取引先', '客户') },
  { id: 'dock-stage', label: tr('무대', 'Stage', 'ステージ', '舞台') },
  { id: 'dock-moments', label: tr('순간', 'Moments', '瞬間', '瞬间') },
] as const;

/* ① 첫 화면 → 채팅 섭외 → 진행자 고르기(토스 '토스·송금·자산' 장면 자리) */
export const INTRO = {
  heroVideo: `${V2}/hero-loop.mp4`,
  heroPoster: `${V2}/hero-poster.jpg`,
  /** 첫 화면 큰 제목 — 세 덩어리가 한 줄에 양 끝 맞춤으로 */
  heroWords: [
    tr('검증된 진행자', 'Verified hosts,', '検証済みの司会者を', '认证主持人'),
    tr('가장 쉽게', 'made simple.', 'いちばん簡単に', '最简单的方式'),
    tr('프리티풀 비즈', 'Freetiful Biz', 'Freetiful Biz', 'Freetiful Biz'),
  ],
  chatTitle: [tr('견적 문의부터 섭외까지', 'From inquiry to booking,', '見積もり相談から依頼まで', '从询价到预约'), tr('채팅 한 번으로', 'in a single chat', 'チャットひとつで', '一次聊天就够了')],
  chatDesc: [
    tr('행사 날짜와 장소만 남기면', 'Share your event date and venue,', 'イベントの日程と会場を伝えるだけで、', '只需留下活动日期和地点，'),
    tr('진행자가 직접 견적을 보내요.', 'and hosts send you quotes directly.', '司会者が直接見積もりを送ります。', '主持人会直接发送报价。'),
  ],
  /** 폰 속 채팅(가상 대화 — 기업 송년회 섭외). me = 담당자(오른쪽 파란 말풍선) */
  chatHostName: tr('프리티풀 사회자', 'Freetiful Host', 'Freetiful 司会者', 'Freetiful 主持人'),
  chatMessages: [
    { me: true, text: tr('12월 19일 금요일 저녁, 회사 송년회 진행 가능하실까요? 300명 규모예요.', 'Are you available for our company year-end party on Friday evening, Dec 19? About 300 guests.', '12月19日（金）夜、会社の忘年会の司会は可能でしょうか？300名規模です。', '12月19日周五晚上的公司年会可以主持吗？大约300人。') },
    { me: false, text: tr('네, 가능합니다! 장소와 순서를 알려주시면 견적서 바로 보내드릴게요 😊', 'Yes, I’m available! Tell me the venue and program and I’ll send a quote right away 😊', 'はい、可能です！会場と進行順を教えていただければすぐに見積書をお送りします 😊', '可以的！告诉我场地和流程，我马上发报价单给您 😊') },
    { me: true, text: tr('강남 호텔 그랜드볼룸이고, 1부 시상식 · 2부 레크리에이션이에요.', 'It’s a hotel grand ballroom in Gangnam — awards first, recreation second.', '江南のホテルのグランドボールルームで、1部授賞式・2部レクリエーションです。', '在江南酒店宴会厅，第一部分颁奖，第二部分团建游戏。') },
    { me: false, text: tr('좋아요. 시상식과 레크리에이션까지 포함해서 견적서 보내드릴게요.', 'Great. I’ll send a quote that covers both the awards and the recreation.', '承知しました。授賞式とレクリエーションを含めた見積書をお送りします。', '好的，我会发送包含颁奖和团建游戏的报价单。') },
  ],
  chatQuoteCard: { title: tr('견적서가 도착했어요', 'Your quote has arrived', '見積書が届きました', '报价单已送达'), sub: tr('송년회 진행 · 1부 시상식 · 2부 레크리에이션', 'Year-end party · Awards · Recreation', '忘年会進行・授賞式・レクリエーション', '年会主持 · 颁奖 · 团建游戏') },
  chatInputPlaceholder: tr('메시지 보내기', 'Send a message', 'メッセージを送る', '发送消息'),

  listTitle: [tr('진행자를 고르는 일도', 'Choosing a host,', '司会者選びも', '挑选主持人'), tr('이제는 간단하게', 'now made simple', 'もっとシンプルに', '也变得简单')],
  /** 아코디언 4칸 — 폰 화면(긴 캡처)이 칸마다 바뀌며 위로 흐른다. pop = 폰 밖으로 튀어나오는 카드(캡처에서 잘라 낸 조각) */
  listItems: [
    {
      key: 'pros',
      screen: `${V2}/screens/pros-tall.webp`,
      title: tr('오직 검증된 진행자만', 'Only verified hosts', '検証済みの司会者だけ', '只有经过认证的主持人'),
      desc: tr('방송사 출신이거나 실제 진행 경력이 확인된 진행자만 프로필을 열 수 있어요.', 'Only hosts with a broadcasting background or confirmed event experience can open a profile.', '放送局出身、または実際の司会経歴が確認された司会者だけがプロフィールを公開できます。', '只有广播电视台出身或经核实拥有实际主持经验的主持人才能开设资料。'),
      cta: tr('진행자 보기', 'See hosts', '司会者を見る', '查看主持人'),
      href: '/pros',
    },
    {
      key: 'profile',
      screen: `${V2}/screens/profile-tall.webp`,
      title: tr('프로필로 꼼꼼하게 비교', 'Compare profiles in detail', 'プロフィールでじっくり比較', '通过资料仔细比较'),
      desc: tr('진행 영상과 사진, 경력과 진행 분야를 한 화면에서 보고 골라요.', 'See hosting videos, photos, career and specialties on a single screen.', '司会動画や写真、経歴や得意分野をひとつの画面で確認して選べます。', '在一个页面查看主持视频、照片、经历和擅长领域后再选择。'),
      cta: tr('프로필 보기', 'View profiles', 'プロフィールを見る', '查看资料'),
      href: '/pros',
    },
    {
      key: 'reviews',
      screen: `${V2}/screens/reviews-tall.webp`,
      title: tr('6가지 항목의 실제 후기', 'Real reviews on six criteria', '6項目のリアルな口コミ', '六个维度的真实评价'),
      desc: tr('경력 · 만족도 · 구성력 · 위트 · 발성 · 이미지, 행사를 마친 고객의 평가로 비교해요.', 'Career, satisfaction, structure, wit, voice and image — compare by ratings from clients after their events.', '経歴・満足度・構成力・ウィット・発声・イメージ。イベントを終えたお客様の評価で比較できます。', '经历、满意度、组织力、幽默感、发声、形象——依据活动结束后客户的评价进行比较。'),
      cta: tr('후기 보기', 'Read reviews', '口コミを見る', '查看评价'),
      href: '/pros',
    },
    {
      key: 'chat',
      screen: `${V2}/screens/chat.webp`,
      title: tr('채팅으로 바로 견적', 'Quotes right in chat', 'チャットですぐに見積もり', '聊天即可获取报价'),
      desc: tr('행사 날짜와 장소를 남기면 진행자가 직접 견적을 보내요. 일정 조율도 채팅 한 번이면 끝나요.', 'Leave your event date and venue, and hosts send quotes directly. Scheduling takes just one chat.', 'イベントの日程と会場を残すと、司会者が直接見積もりを送ります。日程調整もチャットひとつで完了します。', '留下活动日期和地点，主持人会直接发送报价。日程协调也只需一次聊天。'),
      cta: tr('문의하기', 'Contact us', 'お問合せ', '联系我们'),
      href: '#문의폼',
    },
  ],
  /** 폰 옆에 떠 있는 작은 칩 */
  chips: [tr('방송사 출신', 'Broadcast background', '放送局出身', '广播电视台出身'), tr('★ 4.9 실제 후기', '★ 4.9 real reviews', '★ 4.9 リアルな口コミ', '★ 4.9 真实评价'), tr('견적서 도착', 'Quote arrived', '見積書到着', '报价已送达')],
};

/* ② 매칭 카드 3장(토스 '금융' 장면 자리) */
export const MATCH = {
  title: [tr('어떤 행사든', 'Whatever the event,', 'どんなイベントでも', '无论什么活动'), tr('딱 맞는 진행자로', 'the right host', 'ぴったりの司会者を', '都有合适的主持人')],
  /** 부제 — [알약][알약][알약] + 뒤 글 */
  subPills: [tr('공식행사', 'Ceremonies', '式典', '官方活动'), tr('체육대회', 'Sports days', '運動会', '运动会'), tr('팀빌딩', 'Team building', 'チームビルディング', '团建')],
  subPrefix: tr('', 'From', '', ''),
  subSuffix: tr('까지 진행자 고민은 끝', '— no more host worries', 'まで、司会者選びの悩みはおしまい', '——不再为主持人发愁'),
  cards: [
    {
      key: 'match',
      demoTitle: tr('진행자 찾는 중...', 'Finding hosts...', '司会者を検索中...', '正在寻找主持人...'),
      demoLabel: tr('행사 적합도', 'Event fit', 'イベント適合度', '活动匹配度'),
      rows: [tr('A 진행자', 'Host A', '司会者A', '主持人 A'), tr('B 진행자', 'Host B', '司会者B', '主持人 B'), tr('C 진행자', 'Host C', '司会者C', '主持人 C'), tr('D 진행자', 'Host D', '司会者D', '主持人 D'), tr('E 진행자', 'Host E', '司会者E', '主持人 E')],
      scores: [96, 91, 88, 84, 79],
      caption: [tr('행사 성격에 꼭 맞는 진행자를', 'We pick hosts that fit', 'イベントにぴったりの司会者を', '为您挑选最适合'), tr('골라서 보여드려요', 'your event', '選んでお見せします', '活动性质的主持人')],
      cta: tr('진행자 찾기', 'Find hosts', '司会者を探す', '寻找主持人'),
      href: '/pros',
      gradient: 'blue',
    },
    {
      key: 'flip',
      photo: '/images/pro-15/IMG_0196.avif',
      frontTags: [tr('기업행사', 'Corporate', '企業イベント', '企业活动'), tr('공식행사', 'Ceremony', '式典', '官方活动'), tr('영어 진행', 'English MC', '英語進行', '英语主持')],
      backTitle: tr('후기 6가지 항목', 'Six review criteria', '口コミ6項目', '六项评价'),
      backRows: [tr('경력', 'Career', '経歴', '经历'), tr('만족도', 'Overall', '満足度', '满意度'), tr('구성력', 'Structure', '構成力', '组织力'), tr('위트', 'Wit', 'ウィット', '幽默感'), tr('발성', 'Voice', '発声', '发声'), tr('이미지', 'Image', 'イメージ', '形象')],
      backScores: [4.9, 5.0, 4.8, 4.8, 5.0, 4.9],
      caption: [tr('영상 · 경력 · 진행 분야를', 'Videos, career and specialties', '動画・経歴・得意分野を', '视频、经历、擅长领域'), tr('한 장으로 비교해요', 'compared on one card', '一枚で比較できます', '一张卡片就能比较')],
      cta: tr('프로필 보기', 'View profiles', 'プロフィールを見る', '查看资料'),
      href: '/pros',
      gradient: 'peach',
    },
    {
      key: 'report',
      demoTitle: tr('진행자 리포트', 'Host report', '司会者レポート', '主持人报告'),
      analyzing: tr('후기 분석 중...', 'Analyzing reviews...', '口コミを分析中...', '正在分析评价...'),
      rows: [tr('경력', 'Career', '経歴', '经历'), tr('만족도', 'Overall', '満足度', '满意度'), tr('구성력', 'Structure', '構成力', '组织力'), tr('위트', 'Wit', 'ウィット', '幽默感'), tr('발성', 'Voice', '発声', '发声')],
      scores: [4.9, 5.0, 4.8, 4.8, 5.0],
      best: tr('최고', 'Top', '最高', '最高'),
      caption: [tr('행사를 마친 고객의 후기로', 'Reports built from reviews', 'イベントを終えたお客様の口コミで', '用活动结束后客户的评价'), tr('진행자 리포트를 만들어요', 'by clients after their events', '司会者レポートを作ります', '生成主持人报告')],
      cta: tr('후기 보기', 'Read reviews', '口コミを見る', '查看评价'),
      href: '/pros',
      gradient: 'lavender',
    },
  ],
};

/* ③ 행사 용어 구름 + 검정 카드 3장(토스 '투자' 장면 자리) */
export const CAREER = {
  terms: [
    tr('개회사', 'Opening', '開会', '开幕致辞'), tr('축사', 'Speeches', '祝辞', '贺词'), tr('시상식', 'Awards', '授賞式', '颁奖'), tr('레크리에이션', 'Recreation', 'レクリエーション', '团建游戏'),
    tr('경품 추첨', 'Raffle', '景品抽選', '抽奖'), tr('큐시트', 'Script', '進行表', '流程单'), tr('리허설', 'Rehearsal', 'リハーサル', '彩排'), tr('오프닝', 'Intro', 'オープニング', '开场'),
    tr('폐회사', 'Closing', '閉会', '闭幕致辞'), tr('의전', 'Protocol', '儀典', '礼宾'), tr('건배 제의', 'Toast', '乾杯', '祝酒'), tr('팀빌딩', 'Team games', 'チーム作り', '团建'),
    tr('퀴즈', 'Quiz', 'クイズ', '问答'), tr('네트워킹', 'Mixer', '交流会', '交流'), tr('기념 촬영', 'Photo time', '記念撮影', '合影'), tr('질의응답', 'Q&A', '質疑応答', '问答环节'),
  ],
  sub: [tr('처음 맡기는 행사 진행도', 'Even your first event,', '初めてのイベント司会も', '第一次举办活动'), tr('자신 있게', 'with confidence', '自信をもって', '也能信心满满')],
  cards: [
    {
      key: 'translate',
      source: tr('오늘 송년회에 와 주신 여러분, 환영합니다', '오늘 송년회에 와 주신 여러분, 환영합니다', '오늘 송년회에 와 주신 여러분, 환영합니다', '오늘 송년회에 와 주신 여러분, 환영합니다'),
      // 배지가 '영어 진행'이라 결과 문장은 모든 언어에서 영어(원문은 한국어 진행 멘트)
      target: tr('Welcome, everyone, to tonight’s year-end party', 'Welcome, everyone, to tonight’s year-end party', 'Welcome, everyone, to tonight’s year-end party', 'Welcome, everyone, to tonight’s year-end party'),
      badge: tr('영어 진행', 'English MC', '英語進行', '英语主持'),
      caption: [tr('영어 진행이 필요한 행사도', 'Events that need English hosting,', '英語進行が必要なイベントも', '需要英语主持的活动'), tr('외국어 가능한 진행자와 함께', 'with bilingual hosts', '外国語ができる司会者と', '交给会外语的主持人')],
    },
    {
      key: 'cuesheet',
      title: tr('오늘의 식순', 'Tonight’s program', '本日の式次第', '今日流程'),
      steps: [
        { time: '18:00', label: tr('개회', 'Opening', '開会', '开幕') },
        { time: '18:10', label: tr('대표 인사', 'CEO remarks', '代表挨拶', '代表致辞') },
        { time: '18:30', label: tr('시상식', 'Awards', '授賞式', '颁奖') },
        { time: '19:20', label: tr('레크리에이션', 'Recreation', 'レクリエーション', '团建游戏') },
        { time: '20:10', label: tr('경품 추첨', 'Lucky draw', '景品抽選', '抽奖') },
        { time: '20:40', label: tr('폐회', 'Closing', '閉会', '闭幕') },
      ],
      now: tr('진행 중', 'Now', '進行中', '进行中'),
      caption: [tr('식순에 맞춰', 'Following the program', '式次第に沿って', '按照流程'), tr('처음부터 끝까지 진행해요', 'from start to finish', '最初から最後まで進行します', '从头到尾主持')],
    },
    {
      key: 'map',
      cities: [tr('서울', 'Seoul', 'ソウル', '首尔'), tr('인천', 'Incheon', '仁川', '仁川'), tr('대전', 'Daejeon', '大田', '大田'), tr('대구', 'Daegu', '大邱', '大邱'), tr('광주', 'Gwangju', '光州', '光州'), tr('부산', 'Busan', '釜山', '釜山'), tr('제주', 'Jeju', '済州', '济州')],
      pill: tr('전국 진행 가능', 'Nationwide', '全国対応', '全国可约'),
      caption: [tr('서울부터 제주까지', 'From Seoul to Jeju,', 'ソウルから済州まで', '从首尔到济州'), tr('전국 어디서든', 'anywhere in Korea', '全国どこでも', '全国各地都可以')],
    },
  ],
};

/* ④ 연회장 문 열기 — 스크롤로 넘기는 사진 60장(토스 '쇼핑 상자' 장면 자리) */
export const DOOR = {
  frames: Array.from({ length: 60 }, (_, i) => `${V2}/seq/hall-${String(i).padStart(2, '0')}.webp`),
  line1: tr('중요한 행사의 문을', 'Open the door to', '大切なイベントの扉を', '与 Freetiful 一起'),
  line2: tr('프리티풀과 함께 열어요', 'your big event with Freetiful', 'Freetifulと一緒に開きましょう', '开启重要活动的大门'),
};

/* ⑤ 문의 → 안전결제 → 예약 완료 폰(토스 '결제' 장면 자리) */
export const BOOK = {
  screens: { profile: `${V2}/screens/profile.webp`, checkout: `${V2}/screens/checkout.webp`, paid: `${V2}/screens/paid.webp` },
  thumbs: ['/images/pro-01/10000133881772850005043.avif', '/images/pro-05/10000029811773033474612.avif', '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', '/images/pro-12/IMG_27221772621229571.avif', '/images/pro-23/IMG_46511771924269213.avif', '/images/pro-15/IMG_7549.avif'],
  steps: [
    { title: [tr('마음에 드는 진행자에게', 'Message the host', '気に入った司会者に', '向心仪的主持人'), tr('바로 문의하고', 'you like', 'すぐに問い合わせて', '直接咨询')], desc: tr('프로필을 보고 바로 문의하면 진행자가 일정과 견적을 알려드려요.', 'Ask right from the profile and the host replies with availability and a quote.', 'プロフィールからすぐに問い合わせると、司会者が日程と見積もりをお知らせします。', '看完资料直接咨询，主持人会告诉您档期和报价。') },
    { title: [tr('안전결제로', 'Book safely', '安全決済で', '用安全支付'), tr('예약까지 한 번에', 'in one go', '予約まで一度に', '一次完成预订')], desc: tr('행사가 끝난 뒤 대금이 진행자에게 전달되는 프리티풀 안전결제로 예약하세요.', 'With Freetiful Safe Pay, payment reaches the host only after your event.', 'イベント終了後に代金が司会者へ渡るFreetiful安全決済で予約できます。', '使用 Freetiful 安全支付，活动结束后款项才会转给主持人。') },
  ],
  slideLabel: tr('밀어서 결제하기', 'Slide to pay', 'スライドして決済', '滑动支付'),
  done: tr('예약이 완료됐어요', 'Your booking is confirmed', '予約が完了しました', '预订已完成'),
};

/* ⑥ 행사 성격 카드(토스 '판매·광고' 장면 자리) */
export const EVENTS = {
  typing: [tr('행사 성격에 따라', 'Every event is different,', 'イベントに合わせて', '活动性质不同'), tr('진행 스타일도 다르게', 'and so is the hosting', '進行も変わります', '主持风格也随之不同')],
  cards: [
    { photo: `${V2}/photos/event-03.webp`, title: tr('공식행사 · 기업행사', 'Official & corporate', '式典・企業イベント', '官方 · 企业活动'), desc: tr('격에 맞는 진행으로 품격을 더해요', 'Dignified, formal hosting', '格式に合う品格ある進行', '得体的主持提升活动格调') },
    { photo: `${V2}/photos/event-05.webp`, title: tr('송년회 · 레크리에이션', 'Parties & games', '忘年会・レク', '年会 · 团建游戏'), desc: tr('모두가 함께 즐기는 시간을 만들어요', 'Fun for everyone, together', 'みんなで楽しむ時間に', '打造大家一起享受的时光') },
    { photo: `${V2}/photos/event-10.webp`, title: tr('체육대회', 'Sports days', '運動会', '运动会'), desc: tr('함께 뛰고 응원하는 역동적인 진행', 'Energetic hosting for all', '一緒に盛り上がる熱い進行', '一起奔跑加油的活力主持') },
    { photo: `${V2}/photos/event-13.webp`, title: tr('대학 · 지역 축제', 'Festivals', '大学・地域フェス', '校园 · 地区庆典'), desc: tr('대규모 무대도 자신 있게', 'At home on big stages', '大舞台も自信をもって', '大型舞台也从容应对') },
    { photo: `${V2}/photos/event-11.webp`, title: tr('컨퍼런스 · 기업 PT', 'Conferences & PT', 'カンファレンス・企業PT', '会议 · 企业演示'), desc: tr('비전을 전하는 정확한 진행', 'Clear hosting for your vision', 'ビジョンを伝える正確な進行', '准确传达愿景的主持') },
    { photo: `${V2}/photos/event-09.webp`, title: tr('결혼식', 'Weddings', '結婚式', '婚礼'), desc: tr('결혼식 사회 13,000회 이상의 경력', '13,000+ weddings hosted', '結婚式司会13,000回以上の実績', '超过 13,000 场婚礼主持经验') },
  ],
  tag: tr('행사 성격', 'Event type', 'イベントの種類', '活动类型'),
  /** 모바일 마키 뒤 두 번째 제목(첫 제목 typing 을 되풀이하지 않게 — 토스 seg9 도 이 자리는 다른 제목). 배지(tag)는 마지막 줄 뒤 */
  secondTitle: [tr('행사마다 다른 분위기,', 'Every room has its mood,', '行事ごとに違う空気、', '每场活动氛围不同，'), tr('진행도 맞춤으로', 'and hosting to match', '進行もオーダーメイド', '主持也量身定制')],
  /** 카드 윗줄용 짧은 한 줄(설명이 칸보다 길 때 쓰는 대안) */
  eyebrows: [tr('격식 있는 자리라면', 'For formal occasions', '格式ある場なら', '正式场合'), tr('다 함께 즐기려면', 'For fun together', 'みんなで楽しむなら', '一起欢乐'), tr('뛰고 응원하려면', 'For active days', '体を動かすなら', '运动日'), tr('큰 무대라면', 'For big stages', '大舞台なら', '大型舞台'), tr('비전을 전하려면', 'For your message', 'ビジョンを伝えるなら', '传达愿景'), tr('평생 한 번이라면', 'For once in a lifetime', '一生に一度なら', '一生一次')],
};

/* ⑦ 점 지형 + 숫자(토스 '광고' 장면 자리) */
export const SCALE = {
  title: [tr('전국 1,000여\u00A0명의 진행자가', '1,000+ hosts nationwide', '全国1,000名以上の司会者が', '全国 1,000 余名主持人'), tr('행사를 기다리고 있어요', 'are ready for your event', 'イベントをお待ちしています', '正在等待您的活动')],
  leadTitle: tr('방송사 출신부터 행사 전문 MC까지', 'From broadcasters to event specialists', '放送局出身からイベント専門MCまで', '从广播电视台出身到活动专业主持'),
  leadDesc: tr('KBS · SBS · MBC 출신 아나운서부터 레크리에이션 전문 MC까지, 검증을 마친 진행자만 연결해요.', 'From KBS · SBS · MBC announcers to recreation specialists — we only connect verified hosts.', 'KBS・SBS・MBC出身のアナウンサーからレクリエーション専門MCまで、検証済みの司会者だけをおつなぎします。', '从 KBS · SBS · MBC 出身的主播到团建专业主持，只为您对接通过认证的主持人。'),
  stats: [
    { value: 1000, suffix: tr('+', '+', '+', '+'), label: tr('검증된 진행자', 'Verified hosts', '認証済み司会者', '认证主持人') },
    { value: 13000, suffix: tr('+', '+', '+', '+'), label: tr('결혼식 사회 경력', 'Weddings hosted', '結婚式司会実績', '婚礼主持经验') },
    { value: 3, suffix: tr('사', '', '局', '家'), label: tr('지상파 방송사 출신', 'Major broadcasters', '地上波放送局出身', '主流电视台出身') },
  ],
};

/* ⑧ 함께한 기업 + 소개 영상(토스 '결제 대시보드' 장면 자리) */
export const CLIENTS = {
  title: [tr('프리티풀 진행자와', 'Companies that worked', 'Freetifulの司会者と', '与 Freetiful 主持人'), tr('함께한 기업', 'with our hosts', '共にした企業', '合作过的企业')],
  desc: tr('방송사와 기업, 공공기관의 중요한 자리에 프리티풀 진행자가 함께했어요.', 'Freetiful hosts have taken the stage for broadcasters, companies and public institutions.', '放送局や企業、公共機関の大切な場にFreetifulの司会者が立ちました。', 'Freetiful 主持人曾在电视台、企业和公共机构的重要场合登台。'),
  video: '/images/KakaoTalk_Video_2026-04-08-23-05-28.mp4',
  video2: '/images/KakaoTalk_Video_2026-04-13-10-12-55.mp4',
  blocks: [
    { title: tr('프리티풀 플랫폼 소개', 'Platform overview', 'プラットフォーム紹介', '平台简介'), desc: tr('검증된 진행자 1,000여 명과 함께하는 매칭 플랫폼', 'A matching platform with 1,000+ verified hosts', '認証済み司会者1,000名以上と歩むマッチングプラットフォーム', '汇聚 1,000 余名认证主持人的匹配平台') },
    { title: tr('프리티풀 앱 소개', 'App overview', 'アプリ紹介', '应用简介'), desc: tr('진행자를 직관적으로 비교하고 채팅으로 바로 섭외해요', 'Compare hosts intuitively and book them in chat', '司会者を直感的に比較し、チャットですぐに依頼', '直观比较主持人，通过聊天即刻预约') },
  ],
};

/* ⑨ 검은 무대(토스 '매장' 장면 자리) — 송년회 무대 사진 72장 스크롤 */
export const STAGE = {
  wordLeft: tr('가족 행사', 'Family events', '家族の行事', '家庭活动'),
  wordRight: tr('기업 행사', 'Corporate events', '企業イベント', '企业活动'),
  overlay: [tr('모든 무대의 진행을', 'Every stage,', 'すべてのステージの進行を', '每一个舞台'), tr('프리티풀 진행자에게', 'hosted by Freetiful', 'Freetifulの司会者に', '交给 Freetiful 主持人')],
  frames: Array.from({ length: 72 }, (_, i) => `${V2}/seq/stage-${String(i).padStart(2, '0')}.webp`),
  blocks: [
    { label: 'RECEPTION', title: tr('2025 송년회', '2025 Year-End Reception', '2025 忘年会', '2025 年会'), desc: tr('한국웨딩사회자협회와 프리티풀이 함께한 2025 송년회', 'The 2025 year-end reception by the Korea Wedding MC Association and Freetiful', '韓国ウェディング司会者協会とFreetifulによる2025年の忘年会', '韩国婚礼主持人协会与 Freetiful 共同举办的 2025 年会'), cta: tr('영상 보기', 'Watch video', '動画を見る', '观看视频') },
    { label: 'CEREMONY', title: tr('시상식과 협약식', 'Awards & signing', '授賞式と協約式', '颁奖与签约'), desc: tr('시상과 협약, 공식 순서도 격에 맞게 진행해요.', 'Awards, signings and formal moments, hosted with dignity.', '授賞や協約など、公式な進行も格式に合わせて。', '颁奖、签约等正式环节也得体主持。'), cta: tr('문의하기', 'Contact us', 'お問合せ', '联系我们') },
    { label: 'RECREATION', title: tr('모두가 함께하는 무대', 'A stage for everyone', 'みんなで楽しむステージ', '大家一起的舞台'), desc: tr('레크리에이션과 공연으로 행사장의 분위기를 이끌어요.', 'Recreation and performances that lift the whole room.', 'レクリエーションと公演で会場の雰囲気を盛り上げます。', '用团建游戏和表演带动全场气氛。'), cta: tr('문의하기', 'Contact us', 'お問合せ', '联系我们') },
  ],
  fullVideo: '/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4',
};

/* ⑩ 함께한 순간 사진 → 한 장이 화면 가득 → 마무리 문장(토스 '일상' 장면 자리) */
export const MOMENTS = {
  heading1: tr('프리티풀이 함께한 순간', 'Moments with Freetiful', 'Freetifulと共にした瞬間', 'Freetiful 陪伴的瞬间'),
  heading2: tr('프리티풀이 함께할 순간', 'Moments to come', 'Freetifulと共にする瞬間', 'Freetiful 将陪伴的瞬间'),
  desc: tr('공식 행사부터 축제와 체육대회까지, 프리티풀 진행자가 함께한 현장이에요.', 'From official ceremonies to festivals and sports days — scenes our hosts were part of.', '式典からフェスや運動会まで、Freetifulの司会者が立った現場です。', '从官方典礼到庆典和运动会，都有 Freetiful 主持人的身影。'),
  photos: [`${'/images/biz-v2/photos'}/event-01.webp`, `${'/images/biz-v2/photos'}/event-07.webp`, `${'/images/biz-v2/photos'}/event-02.webp`, `${'/images/biz-v2/photos'}/event-12.webp`],
  /** 마지막에 화면 가득 커지는 사진 */
  hero: `${'/images/biz-v2/photos'}/event-02.webp`,
  tiles: [tr('검증 완료', 'Verified', '検証済み', '已认证'), tr('★ 4.9', '★ 4.9', '★ 4.9', '★ 4.9'), tr('견적서 도착', 'Quote arrived', '見積書到着', '报价已送达'), tr('안전결제', 'Safe Pay', '安全決済', '安全支付'), tr('전국 진행', 'Anywhere', '全国対応', '全国可约'), tr('영어 진행', 'English MC', '英語進行', '英语主持')],
  closing: [tr('당신의 특별한 순간,', 'Your special moments,', 'あなたの特別な瞬間、', '您的特别时刻，'), tr('프리티풀과 함께하세요', 'with Freetiful', 'Freetifulと共に', '与 Freetiful 同行')],
  closingCta: tr('기업 문의하기', 'Business inquiry', '法人お問合せ', '企业咨询'),
};

/** 함께한 기업 로고(기존 비즈 페이지와 같은 52개) */
export const LOGOS: string[] = [
  '/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
  '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
  '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
  '/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg',
  '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
  '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
  '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
  '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
  '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg',
  '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
  '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
  '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
  '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
  '/images/company-logos/logo-qqb24.webp' /* 원본 svg 451KB(PNG 내장) → webp 7KB */,
  '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
  '/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg',
  '/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg',
  '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg',
  '/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg',
  '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg',
  '/images/company-logos/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg',
  '/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg',
  '/images/company-logos/SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
  '/images/company-logos/U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
  '/images/company-logos/-DYSKPXdCLcjcK4M44l9Za7ZgNQJR6-HT-yUvfPCCsoLqVEpndF3htzCH6cF_5sfNhc_KDDRXfbfTckyikUOuDYh8yGBlWNImoehI7PxTiNB8hj-MI7wj1cTbC7O98nRpdTYXkqgV3mqiKbSjKa9eQ.svg',
  '/images/company-logos/UdBMIeaNY-f9X2gSNVhgxANC0H0qiODudLXatPoQjcSUpWgdrsaFw_-L7EEU_0IhP1S6YHN3O4rm29ZOkM3P7fmR9rupS6eKviyXKfbKIMZ40EJnLVuAfhABaiEwPQUOHr5ElOSVFJSGfXQAf7FGBQ.svg',
  '/images/company-logos/W-Vzx_gdMaygn9LC-dNJuYIwz1dmiuk3LQMq9Pz692djzQ4OJeChfUYwkz393ioiyF0PUoh3aLTsw9qUs3hye41a8pueOhabVVgQxgrqfzN3uWlb6dIlJRracrtHx89cSXymXSF7gFOLl5BYrPXHcQ.svg',
  '/images/company-logos/WSvPMQh9MwaVyaaVkcJPXPAiHlt12lq_eWCs90KgbdOR6eMxcx2pcunmCoAYdAdKZfWiYd5v0k14ipyy2pulf9Eyks272dwhRCaso4mg63ZPh37yiQdgMnJGR-31GGXLA-zITyEy5h5LnReY7bc1zA.svg',
  '/images/company-logos/XXLbXSTUNd81exsQZBpIUQ1IC0deGb2wn7k8XnBs90slAobx4aULfeAyNNgktrdj-Xq-zHReZp5V_AQg1Xz4mKil6JqQnJx1Gvw4OBIbbCvxjBvL8MwFZ9inQ4rZ4vvwbuqdJ9hj2EN81Bv-LfLaFA.svg',
  '/images/company-logos/X_a20hnOPysVQ2Ybud5BiG9JsePpQUlAgZ7I7k75OlqQ8Jjbds4mEYR6MtxSN6BiigG6NX7zzA8FHq65y0En9A.svg',
  '/images/company-logos/Y2LNYrBudEa_mY0hs5l96vum89cGWqz6VURoh1IE9aw_IEhYDrXz6b0O06n5DLk-pt7_jWtOlsCTmoYb0PSN1kBJxv5LngLUpuC38B-CzvqNXaNJbkXxdlyswVkxGKHa2lZrq_7ciWKJCel_ddn_Fw.svg',
  '/images/company-logos/_U8AZPEKrsCgmI1EUdrRRU2o0rIak0dD3YcYb9E-mbUIWCJgySxaZrD1fFIwBaH-DJHTqeYAnL21qOcrduPq77vjh7JGHfC2z-BBrLrug3CL3njFD4x-xXDe89OAI5QCiMnKS3LN3RKFCmT8Yz_Yww.svg',
  '/images/company-logos/bTM6JHPFAd0TpQVfLybhadM48U9brNK0kr0RZPccZbU-8ZydayEHX19VoisuMNT4RXwlW4ReYpecuv-WALAmfUTxMg2UAA-dMPbuI4AExhpEY7ZgdiGAABBuc2VUpzXun8FdUeGryg7k6OJTfeaVLw.svg',
  '/images/company-logos/bzyX-bcOszBIyZp4I9fXQHBFCFJlDtVZ5NAQb3ipvPR8xehdx99F-xWHDTsVUbM8pEujQv1TQTTrXD7A3Xaaba9t-GOg2yNCBMg7hOg0SIPDGyOWqaSUu3VEY17h1JzvHNtpDPWW7Hs7aA6kUQ0MQw.svg',
  '/images/company-logos/ezX7tL2KZPta0ZvP1Lkh_OEXPbdgEfRygo9kCyM6vcb8JBEagUiFXb22DZl_vszRJjZO9skUXjyliiatyZDDrIrbcTzCCTYenibs7LacOErXMCZq_3C3GA6psClsFYu2Q9T_ioSus-WY3ie67qYG5w.svg',
  '/images/company-logos/fSD1BTd2CtrHz6EOr23a-JtJf_xlusDFuqwHTrrG_Ana3MZO0gD6Z0RxLLG56Wu26d5_eUAtRN71BnavVSNjVhvWQfUYxxFP6SpORqui38vEkw0pEBy9D8sPMnvKROtnKcz9JY7E4R13G-5-whvCvA.svg',
  '/images/company-logos/fSIkZyWM4rM1gidxaCFUQ18r872Dm4xWpkZ-rFUz89PpjWylA8hmh39lEg-29Z7Ok5k9BqXFXL8b95YAEJfChb5RCN6MDIdRxJWHrJVZ9r5Q6P-7SfXNt95Fkc6EGSveca4iFCOARq7mIJF_plvv_A.svg',
  '/images/company-logos/fx6sKNDVDFsbOENLe-xTfc1KM8m5bvpjGu6zacCGE9LmgG905q2XR7mqVwmYwhdTTNBOHguEhWr0O71Zyk8oFRDg3iXQp68IQ-v4oe1-1kSud1cDyCHESwPOEMRiZVjzMlImqZ3Y_6jwFrOH1PyfnA.svg',
  '/images/company-logos/gQQBEDoS4V9wEzN-pj8dTe3V90azRcnv9wEVO3sxVQ76hOji4FinhMT-BZExwiOFhthnYBwEZR98A1ledzfgGQuHMloSpNtMAJ2aEvwhvlB_gwIIfpE08qtHptw_EznuI4YicbPYt708m7jGGsrO0Q.svg',
  '/images/company-logos/hVgF57hJ3xB0lWARAqgbKzF11iF_jHKPcy54Eatniz_PFt7nn-VH2zQRz93Lrzr14E07XvB2NeeHPH9_Tlxe75PO0-Sm1eByKRVeSEh9CAz-vzvDx1S69XMAP8d5YC_8skzq_6gt2qzVNxtS0F_bxA.svg',
  '/images/company-logos/lJaLPyiCksy4rKDEV86j9XqTd1QnIaiSPRZseWCttzMNixmZoBoggD7_wObo5aWy-30Xq22vNOgK7iwlobpvnO_PQIhrntTuBobFXVSjz9whoeU1IBExjolEGGdMydMmqKS6urghRnD2XACePGbp0A.svg',
  '/images/company-logos/mrnlNZzBeFxCorw5B0VjguNwYyRwYOZeMdp_UjoG5y7mbvBrkiv7hm0F8fiFsuUuyo8B83Uqv1Gz-v5Oe0FvoWZcBLoKuuZ88v9TkwFFzEGmApWGQiCCCCpR8ykp5nOGhOpYHt7tiAAyDFiy8_GknQ.svg',
  '/images/company-logos/n8d4p6AMfV8YVZiX5mst1veEfo9S7-y2GSe9ar-wGOEIa7y9w2mHQGm-a7w4BKzArAwN-Mhhv_jkfZfh1gc4aQ.svg',
  '/images/company-logos/nzX7hfiNDhzsZ5CC1dEpPbS84Ic2VNMBA4KAv-MfUcyYAlE_xhBUMhNq35nxuu-spWifKWjVzP_Q1jBbUAL4faNd2JlExARVqQeJkhOFGYJy0ZzAMkDFYqT83_MiQS5Rj1bRHdE8I2yVdtpeQYYwAg.svg',
  '/images/company-logos/oGx8Lf-pK-fz_NQBIQ6z0pJB386NEHT88b0IbG-WIuBmV5uzV1Ryi958B1bU0C0djwVNOZ-J7McjnTTz5EiVajLJz9Vfp2_vc6sFQ_gWgzzh8vRe6Mk1SNiAwRtcP-L-uE8bkMOeK5DE0JRd-O3aRA.svg',
  '/images/company-logos/p-10BFRQN-_hRreerH2X6Y1rzrcspaEiODZ0m9n3VonlNG_3KoJbQQo_i_aIEr56siCqXNmeOcfLSReRQsdB0w.svg',
  '/images/company-logos/tURiQcsQ4gqf5yehCIeBxoqAPAp8kbvJCFHt3pnJy5cf2d27mEVfyAwQtWdTT1aJP1wjS_dJlZzdGEk7P9fcrHezTDlrqqIb-ZQnXIkOgcp-S37Yit2UBGVMPyf6eUae605-0LzI5GdO3wQ0GRxRjg.svg',
  '/images/company-logos/uDLH9KAZCQMK2nqJyLEVJ9UzXnKO7uVJYZ4mgZMRS7m8wy6u7X2et3QHKDwYKNdhKoqjDWdMrhzpPpC9H1_L8Q-KOZwPbdcd3WdTSgJs-6g5N0zlZj3D-hgnY0s-VcAcLRTR1zgAwbD_bByywC802Q.svg',
  '/images/company-logos/wIbC6OJ5H0FmZ5ljUXYISpzR8H-x7weQqVldRanCw9g64JL4tUoxQamNgG_w_byq-wfm_gU--v1HdcKRG-0OMCVkZ1GI3EVnpUQ0fQAByE-nRXkPxhtx8emKKE0MSgw5T3MNYJ3Gju1j_Iqf7oImSg.svg',
  '/images/company-logos/y1AlwExMBWcxyTKygmw8EVoS0g_9Y_pLgbPEhUkc25b_h-4yTyiaVLSkVL0HjhFbX6cyQML4Uvk2LQYndy2Cs8Cys7FcUr8PqXwh9fRC0h8GtKB8nCZwaSWx3AFt-TdtPpWzytnx9w6owHJcAjeFEQ.svg',
  '/images/company-logos/ywnQTrlMBh8nsZsYJ-5WCT1d26iSqwxByWYPRIUtq4s2vJKvt_U1BxswLhWhvPg1txioQ7jtlSQ020q6ox0FVPVb8QXxK6rRYUO1mPoU9jEDg2qqGJoES4flW6d3opZKTcO7T1214OlUS6ch_RCUBA.svg',
  '/images/company-logos/zO55rSFFBt8SWtnaLX8pZ4KB6WlImBmSYRCCEAteo5NEAPrOKqtDmSGRDk2EXZUmiyPhdFCOKnkaCZ2BstnHa-h_Xz49IZDf1_R7H4gVSBEzRF4gZkgC6riVGwIDJnBd_Y7JbT_454w-PswxOT1OVw.svg',
];
