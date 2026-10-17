/*
 * 프리티풀 뉴스(비즈 '뉴스·소식' 탭) 기사 목록 — 정적 데이터(261009 사장 '뉴스소식은 공지사항으로 이동하는 게 아니라 따로 프리티풀 뉴스 페이지로,
 * 디자인은 공지사항처럼'). 공지(앱 사용 안내)가 아니라 웨딩홀 · 기업행사 담당자가 볼 회사 소식이라 DB 공지와 따로 둔다.
 *
 * 사실만 쓴다 — 없는 숫자 · 실적 · 제휴 · 약속 · 인용을 지어내지 않는다. 기사마다 근거:
 *  · 연혁 = biz/page.tsx HISTORY_DATA · biz/history/page.tsx(설명 줄). 연혁은 '달'까지만 있어 날짜도 달까지만 쓴다(날을 지어내지 않게).
 *  · 송년회 = components/biz/toss/content.ts STAGE('한국여성사회자협회와 프리티풀이 함께한 2025 송년회') +
 *    현수막 · 배너 글자('2025 Year-End RECEPTION · 한국여성사회자협회 X 프리티풀 · 2025.11.24 17:30', 영상 첫머리 'Hosted by Freetiful & WMAK').
 *    영상 = STAGE.fullVideo. (예전엔 '한국웨딩사회자협회'로 잘못 옮겨 적혀 있었다 — 261009 영상 프레임으로 확인해 바로잡음)
 * 그림 = 저장소에 있는 것만(공지 그림 notices/v2 · 비즈 행사 사진 biz-v2/photos · 송년회 무대 · 빌라드지디 배너).
 * 261016 행사·제휴 일정은 운영자 제공 자료로 보강했다. 공개 보도는 sources 에 별도로 연결하고, 날짜가 다른 보도는 같은 행사로 취급하지 않는다.
 * 261017 앱 기능·시스템 업데이트 소식은 제외하고 행사와 기업 활동만 다룬다. 앱 공지 원본은 변경하지 않는다.
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
  image: { src: string; bg: string; position?: string; veil?: number | [number, number]; caption?: Tr; description?: Tr; aspectRatio?: string };
  photos?: { src: string; caption: Tr; description?: Tr; width: number; height: number }[];
  videos?: { src: string; poster: string; caption: Tr; description?: Tr; width: number; height: number }[];
  /** 직접 확인한 관련 자료. 원문을 복제하지 않고 출처와 적용 범위를 표시한다. */
  sources?: { title: Tr; href: string; note?: Tr }[];
  sourceNote?: Tr;
  /** 시트 맨 위에 그림 대신 띄울 영상(누르면 재생 — 미리 받지 않는다) */
  video?: string;
  /** 시트 아래 파란 단추 */
  cta?: { label: Tr; href: string };
  /** 연혁에 있는 일 — 시트 아래에 '프리티풀이 걸어온 길'(연혁 기사들)을 이어 보여 준다 */
  milestone?: Tr;
};

const N = (n: string) => {
  const src = `/images/notices/v2/${n}.webp`;
  return { src, bg: noticeArtTint(src), caption: tr('프리티풀 뉴스 일러스트', 'Freetiful news illustration', 'Freetifulニュースのイラスト', 'Freetiful 新闻插画') };
};
/** 행사 사진 카드의 아래 막 — 사진은 위쪽 절반에서 또렷하고, 글자 줄(태그 · 날짜 · 제목) 뒤는 거의 불투명한 젖빛으로 */
const PHOTO_VEIL: [number, number] = [0.82, 0.95];

const CTA_INQUIRY_HALL = { label: tr('웨딩홀 제휴 문의', 'Hall partnership', '式場提携のご相談', '婚礼堂合作咨询'), href: '/biz/inquiry' };
const CTA_HISTORY = { label: tr('연혁 보기', 'View milestones', '沿革を見る', '查看发展历程'), href: '/biz/history' };
const CTA_EVENT = { label: tr('행사 문의하기', 'Event inquiry', 'イベントのご相談', '活动咨询'), href: '/biz/inquiry' };
const COMPANY_SOURCE = tr('일정과 참여 범위는 프리티풀 제공 자료를 기준으로 작성했습니다.', 'Dates and Freetiful\'s role are based on information supplied by Freetiful.', '日程と参加範囲はFreetiful提供資料に基づきます。', '日期与参与范围依据 Freetiful 提供的资料。');
const LISTENING_SOURCE = tr('일정과 참여 범위는 프리티풀 제공 자료를, 프로그램·참가 규모·사진은 프리티풀이 배포한 보도자료를 기준으로 작성했습니다.', 'The schedule and Freetiful\'s role are based on Freetiful\'s information; the programme, attendance and photos are based on the press release Freetiful distributed.', '日程と参加範囲はFreetiful提供資料、プログラム・参加規模・写真はFreetifulが配布したプレスリリースに基づきます。', '日程与参与范围依据 Freetiful 提供的资料，活动内容、参与规模与照片依据 Freetiful 发布的新闻稿。');
const RECEPTION_SOURCE = tr('일정은 프리티풀 제공 자료를, 참석 규모·식순·협찬·현장 협약은 아래 언론 보도를 기준으로 작성했습니다.', 'The schedule is based on Freetiful\'s information; attendance, programme, sponsors and the on-site agreement are based on the press coverage below.', '日程はFreetiful提供資料、参加規模・式次第・協賛・現場での協約は下記の報道に基づきます。', '日程依据 Freetiful 提供的资料，出席规模、流程、赞助及现场协议依据下列媒体报道。');
const PARTNERSHIP_SOURCE = tr('제휴 시점과 전속 사회자 파트너십 내용은 프리티풀 제공 자료를 기준으로 작성했습니다. 제휴사명은 일부 가려 표기했습니다.', 'Partnership dates and resident-MC arrangements are based on information supplied by Freetiful. Partner names are partially masked.', '提携時期と専属司会者の提携内容はFreetiful提供資料に基づき、社名は一部伏せ字で表記しています。', '合作时间与专属主持人合作内容依据 Freetiful 提供的资料，合作方名称以部分遮蔽方式呈现。');

/** 최신순 */
const NEWS_ITEMS: BizNewsItem[] = [
  {
    id: 'wedding-showcase-pangyo-2026',
    date: '2026.11.05',
    tag: 'hall',
    title: tr('웨딩플래너·인플루언서 120명 초청, 판교 웨딩 쇼케이스 개최 예정', 'Pangyo wedding showcase planned for 120 planners and influencers', 'プランナー・インフルエンサー120名を招く板橋ウェディングショーケース開催予定', '拟邀请120位婚礼策划师与达人，板桥婚礼展示会即将举办'),
    lead: tr(
      '프리티풀이 11월 5일 판교에서 열리는 웨딩 쇼케이스의 기획과 진행을 맡습니다. 웨딩플래너와 인플루언서 120명을 초청 대상으로 준비하는 이번 자리는 웨딩 현장의 전문가와 콘텐츠를 만드는 이들이 만나는 행사입니다.',
      'Freetiful will plan and host a wedding showcase in Pangyo on November 5. The event is being prepared for an invited audience of 120 wedding planners and influencers, bringing together wedding professionals and content creators.',
      'Freetifulは11月5日に板橋で予定されるウェディングショーケースの企画・進行を担当します。ウェディングプランナーとインフルエンサー120名を招待対象として準備しています。',
      'Freetiful 将负责11月5日在板桥举行的婚礼展示会的策划与主持，活动正以120位婚礼策划师及达人为邀请对象筹备。',
    ),
    points: [
      tr('일시: 2026년 11월 5일(목) 12:00~15:00 · 개최 예정', 'Scheduled: Thu, November 5, 2026, 12:00–15:00 KST', '開催予定：2026年11月5日（木）12:00〜15:00（韓国時間）', '拟定时间：2026年11月5日（周四）12:00至15:00（韩国时间）'),
      tr('장소: 판교 · 세부 장소는 추후 안내', 'Location: Pangyo; specific venue to be announced', '場所：板橋、詳細会場は後日案内', '地点：板桥，具体场地另行通知'),
      tr('초청 계획: 웨딩플래너·인플루언서 120명', 'Invitation plan: 120 wedding planners and influencers', '招待計画：プランナー・インフルエンサー120名', '邀请计划：120位婚礼策划师与达人'),
      tr('프리티풀 담당: 행사 기획 및 진행', 'Freetiful\'s role: event planning and hosting', 'Freetifulの担当：イベント企画・進行', 'Freetiful 职责：活动策划与主持'),
    ],
    body: tr(
      '웨딩 쇼케이스는 예식의 가치를 현장에서 소개하고, 그 경험이 새로운 제안과 콘텐츠로 이어지는 접점입니다. 프리티풀은 기획과 진행을 통해 행사의 메시지를 전달할 예정입니다. 본 소식은 개최 전 안내이며, 세부 프로그램과 최종 참석 현황은 확정 후 별도로 전하겠습니다.',
      'A wedding showcase creates a meeting point between an in-person wedding experience, professional recommendations and new content. Freetiful will help communicate the event\'s message through its planning and hosting. This is a pre-event announcement; final programming and attendance will be shared once confirmed.',
      'ウェディング体験と新しい提案・コンテンツをつなぐ場として、企画と進行を通じてメッセージを届ける予定です。本記事は開催前の案内であり、詳細プログラムと実際の参加状況は確定後にお知らせします。',
      '展示会将连接婚礼体验、专业推荐与内容创作。Freetiful 将通过策划及主持传递活动信息。本篇为活动前预告，具体流程及实际出席情况将在确认后另行发布。',
    ),
    image: N('20'),
    sourceNote: COMPANY_SOURCE,
    cta: CTA_EVENT,
  },
  {
    id: 'thebom-partnership',
    date: '2026.10',
    tag: 'hall',
    title: tr('더*봄과 전속 사회자 파트너십을 맺었습니다', 'A resident-MC partnership with 더*봄', '더*봄と専属司会者パートナーシップを締結', '与더*봄建立专属主持人合作'),
    lead: tr('프리티풀이 2026년 10월 더*봄과 전속 사회자 파트너십을 맺었습니다. 웨딩 공간과 예식 진행을 연결하는 협업 소식을 전합니다.', 'Freetiful entered a resident-MC partnership with 더*봄 in October 2026, connecting wedding venues with ceremony hosting.', 'Freetifulは2026年10月、더*봄と専属司会者パートナーシップを締結しました。式場と挙式進行をつなぐ協業のお知らせです。', '2026年10月，Freetiful 与더*봄建立专属主持人合作，连接婚礼空间与仪式主持。'),
    points: [
      tr('파트너: 더*봄', 'Partner: 더*봄', '提携先：더*봄', '合作方：더*봄'),
      tr('제휴 시점: 2026년 10월', 'Partnership date: October 2026', '提携時期：2026年10月', '合作时间：2026年10月'),
      tr('협업 분야: 전속 사회자 파트너십', 'Scope: resident wedding MC partnership', '協業分野：専属司会者パートナーシップ', '合作领域：专属婚礼主持人'),
    ],
    body: tr('예식의 인상은 공간뿐 아니라 그 안에서 이어지는 말과 흐름으로도 완성됩니다. 전속 사회자 파트너십은 웨딩홀과 사회자가 예식 진행을 함께 논의할 수 있는 협력 관계입니다. 프리티풀은 이번 제휴를 통해 웨딩홀과 전문 사회자를 잇는 접점을 넓혀갑니다.', 'A ceremony is shaped not only by its venue but also by the words and rhythm within it. A resident-MC partnership creates a working relationship between a wedding hall and its hosts. This agreement adds another connection between wedding venues and Freetiful\'s professional MCs.', '挙式の印象は空間だけでなく、言葉と進行の流れによっても形づくられます。専属司会者の提携は、式場と司会者が進行を話し合う協力関係です。今回の提携で、その接点を広げます。', '婚礼的印象不仅来自空间，也来自现场的话语与节奏。专属主持人合作为婚礼场地与主持人建立沟通仪式流程的协作关系，本次合作将拓展双方的连接。'),
    image: { ...N('38'), veil: [0.72, 0.88] },
    sourceNote: PARTNERSHIP_SOURCE,
    cta: CTA_INQUIRY_HALL,
    milestone: tr('더*봄 전속 사회자 파트너십', 'Resident-MC partnership with 더*봄', '더*봄と専属司会者提携', '与더*봄建立专属主持人合作'),
  },
  {
    id: 'bexco-busan-2026',
    date: '2026.09.16',
    tag: 'event',
    title: tr('부산 벡스코 행사, 프리티풀이 총괄 운영을 맡았습니다', 'Freetiful managed event operations at BEXCO in Busan', '釜山BEXCOのイベント運営をFreetifulが統括', 'Freetiful 统筹运营釜山 BEXCO 活动'),
    lead: tr('프리티풀이 9월 16일부터 18일까지 부산 벡스코에서 열린 행사의 총괄 운영 및 대행을 맡았습니다. 사회자 섭외를 넘어 행사 운영을 함께하는 비즈니스 사례입니다.', 'Freetiful handled overall operations and event delivery at BEXCO in Busan from September 16 to 18. The project represents its event-operations work beyond MC booking.', 'Freetifulは9月16日から18日まで釜山BEXCOで開催されたイベントの統括運営・代行を担当しました。司会者の手配に加えた運営事例です。', '9月16日至18日，Freetiful 负责釜山 BEXCO 活动的整体运营及执行代理，体现了主持人预约之外的活动运营业务。'),
    points: [
      tr('기간: 2026년 9월 16일(수)~9월 18일(금)', 'Dates: September 16–18, 2026, Wednesday–Friday', '期間：2026年9月16日（水）〜18日（金）', '日期：2026年9月16日（周三）至18日（周五）'),
      tr('장소: 부산 벡스코(BEXCO)', 'Venue: BEXCO, Busan', '会場：釜山BEXCO', '场地：釜山 BEXCO'),
      tr('프리티풀 담당: 행사 총괄 운영 및 대행', 'Freetiful\'s role: overall event operations and delivery', '担当：イベントの統括運営・代行', 'Freetiful 职责：活动统筹运营与执行代理'),
    ],
    body: tr('여러 날 이어지는 행사에서는 개별 순서의 완성도와 전체 운영의 연결이 함께 중요합니다. 이번 프로젝트는 프리티풀이 행사 총괄 운영과 대행을 맡은 사례로, 전문 진행 인력의 연결에서 행사 운영으로 이어지는 비즈니스의 범위를 보여줍니다.', 'For a multi-day event, each session and the continuity of the overall operation both matter. This project records Freetiful\'s overall operations and event-delivery role, demonstrating the scope of its work from connecting professional hosts to managing events.', '複数日にわたるイベントでは、各プログラムと運営全体の連携が大切です。統括運営・代行を担当した今回の事例は、人材の接続からイベント運営へ広がる事業の範囲を示します。', '多日活动既需要每个环节的完成，也需要整体运营的衔接。本项目记录了 Freetiful 的统筹与执行职责，展现从连接专业人才到活动运营的业务范围。'),
    image: N('20'),
    sourceNote: COMPANY_SOURCE,
    cta: CTA_EVENT,
  },
  {
    id: 'chouchoumonde-wedding-listening-2026',
    date: '2026.08.16',
    tag: 'hall',
    title: tr('“내 결혼식 미리 듣고 본다”, 임하람 사회자와 함께한 슈슈몽드 웨딩 청음회', '“Hear and see your wedding in advance”: a wedding listening event with MC Lim Haram at Chouchou Monde', '「自分の結婚式を前もって聴いて見る」イム・ハラム司会のシュシュモンド・ウェディング試聴会', '“提前听见、看见自己的婚礼”：林夏蓝主持的 Chouchou Monde 婚礼试听会'),
    lead: tr('프리티풀이 8월 16일 강남 하우스웨딩홀 슈슈몽드와 함께 ‘임하람 사회자와 함께하는 웨딩 청음회’를 열었습니다. 정보를 나열하는 박람회 대신, 예비부부가 실제 예식을 직접 듣고 보며 미리 경험하는 몰입형 웨딩 시뮬레이션이었습니다.', 'On August 16 Freetiful and Gangnam house-wedding venue Chouchou Monde held a “Wedding Listening Event with MC Lim Haram.” Instead of a fair that lists information, it was an immersive wedding simulation where engaged couples heard and saw a real ceremony in advance.', 'Freetifulは8月16日、江南のハウスウェディング会場シュシュモンドと「イム・ハラム司会者と共にするウェディング試聴会」を開きました。情報を並べる博覧会ではなく、実際の挙式を聴いて見て前もって体験する没入型ウェディング・シミュレーションです。', '8月16日，Freetiful 与江南独栋婚礼场地 Chouchou Monde 共同举办“与林夏蓝主持人一起的婚礼试听会”。不同于罗列信息的婚博会，这是一场让新人亲耳听、亲眼看、提前体验真实仪式的沉浸式婚礼模拟。'),
    points: [
      tr('일시: 2026년 8월 16일(일) 13:00~15:00', 'Date: Sun, August 16, 2026, 13:00–15:00 KST', '日時：2026年8月16日（日）13:00〜15:00（韓国時間）', '时间：2026年8月16日（周日）13:00至15:00（韩国时间）'),
      tr('장소: 강남 슈슈몽드', 'Venue: Chouchou Monde, Gangnam', '会場：江南シュシュモンド', '场地：江南 Chouchou Monde'),
      tr('프로그램: 웨딩 청음회, 정장·한복·드레스 쇼, 실제 예식 시연', 'Program: wedding listening session, suit/hanbok/dress shows and ceremony demonstration', '内容：ウェディング試聴会、スーツ・韓服・ドレスショー、挙式実演', '内容：婚礼试听、西装/韩服/婚纱展示及仪式演示'),
      tr('주최·주관: 슈슈몽드 · 프리티풀 / 진행: 임하람 사회자', 'Organizers: Chouchou Monde and Freetiful / Host: MC Lim Haram', '主催・主管：シュシュモンド・Freetiful／司会：イム・ハラム', '主办与承办：Chouchou Monde、Freetiful／主持：林夏蓝'),
      tr('참가: 400명 넘게 신청해 약 5:1 경쟁, 50쌍(100명) 초청(보도자료 기준)', 'Attendance: over 400 applications, about 5:1, with 50 couples (100 guests) invited (per the press release)', '参加：400名超の応募で約5倍、50組（100名）を招待（プレスリリース基準）', '参与：报名超过400人、约5:1，最终邀请50对（100人）（依据新闻稿）'),
      tr('프리티풀 담당: 행사 기획·진행', 'Freetiful\'s role: event planning and hosting', 'Freetifulの担当：企画・進行', 'Freetiful 职责：活动策划与主持'),
    ],
    body: tr(
      '무대에서는 사계절 테마에 동갑내기·연상연하·장기연애 같은 커플 성향과 클래식·EDM·애니메이션 OST 같은 음악 취향을 더한 예식 장면을 차례로 선보였습니다. 장면마다 사회 멘트와 예복, 입장곡과 퇴장곡을 바꿔 같은 공간에서도 예식의 분위기가 얼마나 달라지는지 직접 비교할 수 있게 했습니다. 프리티풀 전속 사회자와 가상 커플 세 쌍이 예식을 연기했고, 혼주 역할 모델이 하객 한복 스타일링을 보여 주었습니다. 이어진 게임과 경품 추첨, 제휴사 부스의 1:1 상담은 현장 계약으로도 이어졌습니다. 프리티풀은 이번 청음회로 예비부부의 맞춤형 예식 수요를 확인했다며, 웨딩 청음회를 전국으로 넓혀 갈 계획이라고 밝혔습니다.',
      'On stage, ceremony scenes combined four seasonal themes with couple types such as same-age, older-younger and long-term relationships, and music tastes from classical and EDM to animation soundtracks. Each scene changed the MC script, wedding attire, entrance and exit music, letting guests compare how much one venue can change. A Freetiful resident MC and three couples performed the ceremonies, and models in the role of parents presented hanbok styling for families. Games, a prize draw and one-on-one consultations at partner booths followed, some leading to on-site contracts. Freetiful said the event confirmed demand for personalized ceremonies and announced plans to take the wedding listening event nationwide.',
      '舞台では四季のテーマに、同い年・年上年下・長い交際といったカップルの個性や、クラシック・EDM・アニメOSTといった音楽の好みを重ねた挙式場面を順に披露しました。場面ごとに司会の言葉、礼服、入場曲と退場曲を変え、同じ空間でも雰囲気がどれほど変わるかを比べられるようにしました。Freetiful専属司会者と仮想カップル3組が挙式を演じ、両家の親役のモデルが韓服スタイリングを見せました。ゲームと抽選、提携ブースの1対1相談は現場契約にもつながりました。Freetifulはオーダーメイドの挙式需要を確認したとして、試聴会を全国に広げる計画を明らかにしました。',
      '舞台上依次呈现了结合四季主题、同龄/姐弟/长跑等情侣类型以及古典、EDM、动画原声等音乐偏好的仪式场景。每个场景更换主持词、礼服以及入场与退场音乐，让来宾直观比较同一空间里婚礼氛围的变化。Freetiful 专属主持人与三对模拟情侣演绎仪式，扮演双方父母的模特展示了宾客韩服造型。随后的游戏、抽奖以及合作方展位的一对一咨询也促成了现场签约。Freetiful 表示通过本次活动确认了新人对定制婚礼的需求，并计划将婚礼试听会推广至全国。',
    ),
    image: {
      src: '/images/biz-news/wedding-listening-2026/group.webp', bg: '#DBDDD8',
      position: '50% 55%', veil: PHOTO_VEIL, aspectRatio: '4 / 3',
      caption: tr('슈슈몽드 웨딩 청음회 참가자 단체 사진', 'Group photo at the Chouchou Monde wedding listening event', 'シュシュモンド・ウェディング試聴会の集合写真', 'Chouchou Monde 婚礼试听会合影'),
      description: tr('천장을 채운 작은 조명과 나란히 놓인 의자 사이로, 청음회에 함께한 사람들이 한자리에 모였습니다. 이날의 단체 사진은 예식을 준비하는 공간이 잠시 서로 인사하고 경험을 나누는 만남의 장소가 된 순간을 담고 있습니다.', 'Beneath strings of lights, guests gathered between the rows of ceremony chairs. This group portrait records a moment when the wedding setting also became a place to meet and share the experience of the day.', '小さな照明が連なる天井の下、挙式用の椅子の間に参加者が集まりました。式場が互いに挨拶し、その日の体験を共有する場所にもなった瞬間を収めています。', '细密的灯串下，来宾在整齐的仪式座椅间相聚。这张合影记录了婚礼空间成为彼此问候、分享当天体验的相聚之所的瞬间。'),
    },
    // 보도자료(프리티풀 배포 — sources 의 A·B판)에 실린 현장 사진·포스터(261018 사장 '사진도 다 우리 것')
    photos: [
      { src: '/images/biz-news/wedding-listening-2026/press-poster.webp', width: 900, height: 1125, caption: tr('‘임하람 사회자와 함께하는 웨딩 청음회’ 공식 포스터', 'Official poster for the Wedding Listening Event with MC Lim Haram', '「イム・ハラム司会者と共にするウェディング試聴会」公式ポスター', '“与林夏蓝主持人一起的婚礼试听会”官方海报'),
        description: tr('마이크를 든 임하람 사회자와 함께 이날 선보일 진행 콘셉트를 한 장에 담은 포스터입니다. 동갑내기·연상연하·장기연애 같은 커플 성향과 계절, 클래식부터 애니메이션까지의 음악 테마가 적혀 있어 청음회가 어떤 장면들로 이어질지 미리 보여 줍니다.', 'Featuring MC Lim Haram with a microphone, the poster lays out the hosting concepts of the day. Couple types, seasons and music themes from classical to animation preview the scenes that the listening event would present.', 'マイクを持つイム・ハラム司会者と、この日披露する進行コンセプトを一枚にまとめたポスターです。カップルの個性や季節、クラシックからアニメまでの音楽テーマが書かれ、試聴会の場面を前もって伝えます。', '海报上是手持麦克风的林夏蓝主持人，以及当天将呈现的主持概念。情侣类型、季节和从古典到动画的音乐主题，提前展示了试听会将带来的场景。') },
      { src: '/images/biz-news/wedding-listening-2026/press-banner.webp', width: 900, height: 675, caption: tr('슈슈몽드 홀에 걸린 웨딩 청음회 현수막', 'The wedding listening event banner at Chouchou Monde', 'シュシュモンドに掲げられた試聴会の横断幕', 'Chouchou Monde 场内悬挂的婚礼试听会横幅'),
        description: tr('하얀 천장 아래 걸린 현수막에는 행사 이름과 함께 슈슈몽드 웨딩홀, 8월 16일 오후 1시라는 일시, 슈슈몽드와 프리티풀이 함께 주최·주관했다는 표기가 담겼습니다. 예비부부를 맞이한 청음회의 첫인상을 보여 주는 장면입니다.', 'Hanging beneath the white ceiling, the banner shows the event name, the Chouchou Monde venue, the date of August 16 at 1 p.m., and Chouchou Monde and Freetiful as organizers. It is the first impression that greeted engaged couples.', '白い天井の下の横断幕には催しの名前、シュシュモンド会場、8月16日午後1時という日時、シュシュモンドとFreetifulの主催・主管表記が記されています。来場した新郎新婦を迎えた第一印象です。', '白色天花板下的横幅写着活动名称、Chouchou Monde 场地、8月16日下午1点的时间，以及由 Chouchou Monde 与 Freetiful 共同主办承办。这是迎接新人们的第一印象。') },
      { src: '/images/biz-news/wedding-listening-2026/press-entrance.webp', width: 900, height: 675, caption: tr('유리 온실형 홀을 채운 예비부부와 신부 입장 시연', 'Engaged couples fill the glasshouse hall for a bridal entrance demonstration', 'ガラス温室のようなホールを埋めた来場者と新婦入場の実演', '玻璃温室般的大厅坐满新人，观看新娘入场演示'),
        description: tr('전구 조명이 길게 늘어진 유리 온실형 홀에 초청된 예비부부들이 자리를 채웠습니다. 객석 너머로 신부 입장 시연이 시작되고 촬영 스태프가 그 순간을 기록하는 모습에서, 실제 예식과 같은 동선으로 진행된 청음회의 현장감이 전해집니다.', 'Invited couples filled the glasshouse-style hall under strings of lights. Beyond the seats a bridal entrance begins while staff film the moment, conveying how the event followed the route of a real ceremony.', '電球の灯りが連なるガラス温室のようなホールを、招待された新郎新婦が埋めました。客席の向こうで新婦入場の実演が始まり、撮影スタッフが記録する様子から、実際の挙式と同じ動線で進んだ臨場感が伝わります。', '受邀的新人们坐满了挂着串灯的玻璃温室式大厅。观众席另一端开始新娘入场演示，摄影团队记录着这一刻，传达出按照真实仪式动线进行的现场感。') },
      { src: '/images/biz-news/wedding-listening-2026/press-cheer.webp', width: 900, height: 675, caption: tr('흰 천을 흔들며 호응하는 하객석', 'Guests wave white cloths in response', '白い布を振って応える客席', '挥舞白布回应的宾客席'),
        description: tr('객석의 예비부부들이 흰 천을 높이 들어 흔들며 무대 앞 커플을 축하합니다. 듣고 보기만 하는 자리가 아니라 하객의 자리에서 함께 참여해 보는 순서였다는 점이 드러나, 청음회가 만든 분위기를 생생하게 보여 줍니다.', 'Couples in the audience raise and wave white cloths to celebrate the pair at the front. It shows a segment where guests joined in from the seats rather than simply watching, capturing the mood the event created.', '客席の新郎新婦が白い布を高く振り、舞台前のカップルを祝福します。聴いて見るだけでなく、ゲストの立場で一緒に参加する場面だったことが分かり、試聴会の雰囲気を生き生きと伝えます。', '观众席上的新人们高举白布挥舞，祝福台前的新人。这显示出来宾不只是观看，而是以宾客身份一同参与，生动呈现了试听会的氛围。') },
      { src: '/images/biz-news/wedding-listening-2026/press-aisle.webp', width: 900, height: 675, caption: tr('꽃장식 버진로드를 따라 걷는 신부 입장 장면', 'A bride walks the flower-lined aisle', '花で飾られたバージンロードを進む新婦入場', '新娘沿着鲜花装饰的红毯入场'),
        description: tr('양옆을 꽃으로 장식한 버진로드 위로 신부가 걸어 들어오고, 하객석은 그 모습을 지켜봅니다. 장면마다 바뀐 입장곡과 사회 멘트가 같은 길 위에서 어떻게 다른 인상을 만드는지 예비부부가 직접 확인한 순간입니다.', 'A bride walks down an aisle lined with flowers as guests look on. Here couples could hear how changing entrance music and MC lines gives the same path a different impression in every scene.', '両脇を花で飾ったバージンロードを新婦が進み、客席が見守ります。場面ごとに変わる入場曲と司会の言葉が、同じ道でどれほど違う印象を生むかを確かめた瞬間です。', '新娘走上两侧装饰着鲜花的红毯，宾客们注视着这一幕。每个场景更换的入场曲与主持词，在同一条路上营造出不同印象，新人们在此亲身感受。') },
      { src: '/images/biz-news/wedding-listening-2026/press-couple.webp', width: 900, height: 675, caption: tr('흰 꽃장식 앞에 선 시연 커플', 'A demonstration couple in front of white floral décor', '白い花の装飾の前に立つ実演カップル', '站在白色花艺前的演示新人'),
        description: tr('흰 꽃으로 꾸민 무대 앞에 신랑·신부 역할의 커플이 나란히 섰고, 객석이 그 모습을 가까이에서 바라봅니다. 가상 커플 세 쌍이 번갈아 연기한 예식 장면 가운데 하나로, 공간과 진행이 함께 만드는 장면을 보여 줍니다.', 'A couple playing the bride and groom stand side by side before a stage decorated with white flowers as guests watch closely. It is one of the scenes performed in turn by three couples, showing how venue and hosting shape a ceremony together.', '白い花で飾った舞台の前に新郎新婦役のカップルが並び、客席が間近で見つめます。仮想カップル3組が交代で演じた場面の一つで、空間と進行が共につくる光景を伝えます。', '扮演新郎新娘的情侣并肩站在白色花艺装点的舞台前，观众近距离观看。这是三对模拟情侣轮流演绎的仪式场景之一，展现空间与主持共同塑造的画面。') },
      { src: '/images/biz-news/wedding-listening-2026/press-collage.webp', width: 900, height: 632, caption: tr('청음회의 여러 장면 · 하객 호응, 혼주 한복, 시연 커플', 'Moments from the event: guest participation, family hanbok and demonstration couples', '試聴会の場面集・ゲストの応援、両家の韓服、実演カップル', '试听会多个场景：宾客互动、父母韩服与演示新人'),
        description: tr('하객들의 호응과 혼주 역할 모델의 한복 스타일링, 서로 다른 예복을 입은 시연 커플들을 한데 모은 장면입니다. 계절과 테마에 따라 의상과 분위기를 바꿔 가며 이어진 청음회의 다양한 순서를 한눈에 돌아볼 수 있습니다.', 'This collage brings together guest participation, hanbok styling by models playing the parents, and couples in different wedding attire. It looks back on the variety of segments that changed costumes and atmosphere by season and theme.', 'ゲストの応援、両家の親役モデルによる韓服スタイリング、異なる礼服の実演カップルを一つに集めた場面です。季節とテーマに合わせて衣装と雰囲気を変えながら続いた多彩なプログラムを一目で振り返れます。', '画面汇集了宾客互动、扮演父母的模特所展示的韩服造型，以及身着不同礼服的演示新人，可一览随季节与主题变换服装和氛围的多样环节。') },
    ],
    videos: [
      { src: '/images/biz-news/wedding-listening-2026/ceremony-01.mp4', poster: '/images/biz-news/wedding-listening-2026/ceremony-01-poster.webp', width: 1280, height: 720, caption: tr('웨딩 청음회 · 예식 시연 1', 'Wedding listening event · ceremony demonstration 1', 'ウェディング試聴会・挙式実演1', '婚礼试听会：仪式演示1'),
        description: tr('버진로드를 따라 이어지는 입장 장면을 영상으로 담았습니다. 사진 한 장에서는 알기 어려운 걸음의 속도와 객석에서 무대까지의 거리가 드러나며, 예식의 한 순서가 공간 안에서 어떻게 이어지는지 살펴볼 수 있습니다.', 'The video follows an entrance along the aisle. The pace of the walk and the distance between the seating and stage become visible in motion, showing how one part of a ceremony unfolds within the venue.', 'バージンロードを進む入場の様子です。歩く速さや客席からステージまでの距離が映像で伝わり、挙式の一場面が空間の中でどう進むかを見ることができます。', '视频记录了沿仪式通道入场的画面。步行节奏以及观众席与舞台之间的距离在动态影像中更加清晰，呈现了一个仪式环节在场地中的展开过程。') },
      { src: '/images/biz-news/wedding-listening-2026/ceremony-02.mp4', poster: '/images/biz-news/wedding-listening-2026/ceremony-02-poster.webp', width: 1280, height: 720, caption: tr('웨딩 청음회 · 예식 시연 2', 'Wedding listening event · ceremony demonstration 2', 'ウェディング試聴会・挙式実演2', '婚礼试听会：仪式演示2'),
        description: tr('두 사람이 함께하는 예식 시연을 객석의 시선으로 기록했습니다. 꽃 장식과 조명, 입장 동선이 한 화면 안에 들어오면서 각각의 준비 요소가 실제 예식 장면으로 연결되는 모습을 보여줍니다.', 'Recorded from the seating area, this demonstration brings the couple, floral decorations, lighting and aisle into one frame. It shows how separate preparations come together as a ceremony scene.', '客席の目線から二人の挙式実演を記録しました。花や照明、入場の動線が一つの画面に収まり、それぞれの準備が挙式の場面につながる様子が伝わります。', '这段仪式演示以观众席的视角记录两人的身影。花艺、灯光与入场动线汇入同一画面，展示了不同准备元素如何共同构成婚礼场景。') },
    ],
    sourceNote: LISTENING_SOURCE,
    sources: [
      { title: tr('네오비즈뉴스 · “이런 결혼식 처음이야!” 프리티풀X슈슈몽드 ‘웨딩 청음회’ 성황리 마무리', 'Neo Biz News · Freetiful x Chouchou Monde “Wedding Listening Event” concludes', 'ネオビズニュース・FreetifulXシュシュモンド「ウェディング試聴会」盛況のうちに終了', 'Neo Biz News：Freetiful X Chouchou Monde“婚礼试听会”圆满落幕'), href: 'https://www.neobiznews.co.kr/news/457220',
        note: tr('프리티풀 보도자료(A판) — 20여 개 매체에 같은 글로 실렸습니다. 본문의 ‘지난 7월 27일’은 함께 실린 현수막 사진의 일시(8월 16일 오후 1시)와 달라 일시는 프리티풀 자료를 따랐습니다.', 'Freetiful press release (version A), carried by about 20 outlets. Its text says “July 27,” but the banner photo shows August 16 at 1 p.m., so the date follows Freetiful\'s records.', 'Freetifulのプレスリリース（A版）で、20余りの媒体に同じ文で掲載されました。本文の「7月27日」は同時掲載の横断幕写真の日時（8月16日13時）と異なるため、日時はFreetiful資料に従いました。', 'Freetiful 新闻稿（A版），以相同内容刊登于约20家媒体。正文写“7月27日”，与同刊横幅照片上的时间（8月16日下午1点）不同，日期以 Freetiful 资料为准。') },
      { title: tr('국민일자리신문 · “내 결혼식 미리 듣고 본다” 프리티풀, 슈슈몽드와 ‘몰입형 웨딩 시뮬레이션’', 'Kukmin Job · “Hear and see your wedding in advance”: Freetiful and Chouchou Monde', '国民雇用新聞・「自分の結婚式を前もって聴いて見る」Freetiful×シュシュモンド', '国民就业新闻：“提前听见、看见自己的婚礼”Freetiful 携手 Chouchou Monde'), href: 'https://www.kukminjob.com/news/457222',
        note: tr('프리티풀 보도자료(B판) — 30여 개 매체에 실렸습니다. 본문에는 ‘지난 7월 27일’로 적혀 있지만 첫 사진 포스터와 현장 현수막은 8월 16일 행사와 같습니다.', 'Freetiful press release (version B), carried by about 30 outlets. The text says “July 27,” but its poster and on-site banner match the August 16 event.', 'Freetifulのプレスリリース（B版）で、30余りの媒体に掲載されました。本文は「7月27日」ですが、ポスターと会場の横断幕は8月16日の催しと同じです。', 'Freetiful 新闻稿（B版），刊登于约30家媒体。正文写“7月27日”，但海报与现场横幅与8月16日活动一致。') },
      { title: tr('슈슈몽드 공식 소개', 'Chouchou Monde official venue introduction', 'シュシュモンド公式紹介', 'Chouchou Monde 官方介绍'), href: 'https://www.chouchoumonde.co.kr/About' },
    ],
    cta: CTA_EVENT,
  },
  {
    id: 'villadmont-partnership',
    date: '2026.08',
    tag: 'hall',
    title: tr('빌*드몽과 전속 사회자 파트너십을 시작했습니다', 'A resident-MC partnership with 빌*드몽', '빌*드몽と専属司会者パートナーシップを開始', '与빌*드몽开启专属主持人合作'),
    lead: tr('프리티풀이 2026년 8월 빌*드몽과 전속 사회자 파트너십을 시작했습니다. 웨딩 공간과 전문 진행 인력을 연결하는 제휴입니다.', 'Freetiful began a resident-MC partnership with 빌*드몽 in August 2026, connecting a wedding venue with professional hosts.', 'Freetifulは2026年8月、빌*드몽と専属司会者パートナーシップを開始しました。式場とプロの司会者をつなぐ提携です。', '2026年8月，Freetiful 与빌*드몽开启专属主持人合作，连接婚礼场地与专业主持人才。'),
    points: [
      tr('파트너: 빌*드몽', 'Partner: 빌*드몽', '提携先：빌*드몽', '合作方：빌*드몽'),
      tr('제휴 시점: 2026년 8월', 'Partnership date: August 2026', '提携時期：2026年8月', '合作时间：2026年8月'),
      tr('협업 분야: 전속 사회자 파트너십', 'Scope: resident wedding MC partnership', '協業分野：専属司会者パートナーシップ', '合作领域：专属婚礼主持人'),
    ],
    body: tr('같은 예식장에서도 신랑·신부가 바라는 분위기와 이야기의 결은 다릅니다. 전속 사회자 파트너십은 공간을 이해하는 진행과 각 예식의 개성을 함께 고민하는 협업의 기반입니다. 프리티풀은 빌*드몽과의 제휴 소식을 통해 웨딩홀과 사회자가 연결되는 현장을 소개합니다.', 'Even within one venue, each couple brings a different atmosphere and story. A resident-MC partnership provides a basis for considering both the space and the character of each ceremony. This update introduces Freetiful\'s connection with 빌*드몽.', '同じ式場でも、新郎新婦の望む雰囲気や物語は異なります。専属司会者の提携は、空間への理解と挙式ごとの個性を共に考える協業の土台です。今回、빌*드몽との提携をお知らせします。', '即使在同一场地，每对新人的氛围与故事也不相同。专属主持人合作为兼顾空间理解与仪式个性提供协作基础，本篇介绍与빌*드몽的合作。'),
    image: { ...N('38'), veil: [0.72, 0.88] },
    sourceNote: PARTNERSHIP_SOURCE,
    cta: CTA_INQUIRY_HALL,
    milestone: tr('빌*드몽 전속 사회자 파트너십', 'Resident-MC partnership with 빌*드몽', '빌*드몽と専属司会者提携', '与빌*드몽建立专属主持人合作'),
  },
  {
    id: 'chouchoumonde-partnership',
    date: '2026.07',
    tag: 'hall',
    title: tr('슈슈*드웨딩과 전속 사회자 파트너십을 맺었습니다', 'A resident-MC partnership with 슈슈*드웨딩', '슈슈*드웨딩と専属司会者パートナーシップを締結', '与슈슈*드웨딩建立专属主持人合作'),
    lead: tr('프리티풀이 2026년 7월 슈슈*드웨딩과 전속 사회자 파트너십을 맺었습니다. 웨딩 공간과 예식 진행을 잇는 협업을 이어갑니다.', 'Freetiful entered a resident-MC partnership with 슈슈*드웨딩 in July 2026, continuing its work connecting wedding spaces and ceremony hosting.', 'Freetifulは2026年7月、슈슈*드웨딩と専属司会者パートナーシップを締結しました。ウェディング空間と挙式進行をつなぐ協業です。', '2026年7月，Freetiful 与슈슈*드웨딩建立专属主持人合作，延续婚礼空间与仪式主持的连接。'),
    points: [
      tr('파트너: 슈슈*드웨딩', 'Partner: 슈슈*드웨딩', '提携先：슈슈*드웨딩', '合作方：슈슈*드웨딩'),
      tr('제휴 시점: 2026년 7월', 'Partnership date: July 2026', '提携時期：2026年7月', '合作时间：2026年7月'),
      tr('협업 분야: 전속 사회자 파트너십', 'Scope: resident wedding MC partnership', '協業分野：専属司会者パートナーシップ', '合作领域：专属婚礼主持人'),
    ],
    body: tr('웨딩홀과 사회자의 협력은 예식의 시작을 알리는 첫 인사부터 마지막 순간까지 이어집니다. 전속 사회자 파트너십은 그 흐름을 함께 논의할 수 있는 연결고리입니다. 프리티풀은 이번 제휴를 웨딩홀 비즈니스의 새로운 협업 소식으로 전합니다.', 'The relationship between a venue and its MC runs from the opening welcome to the final moment. A resident-MC partnership provides a connection for discussing that flow together. Freetiful shares this agreement as a new development in its wedding-hall collaborations.', '式場と司会者の協力は、最初の挨拶から最後の瞬間までつながります。専属司会者の提携は、その流れを共に話し合う接点です。式場との新たな協業としてお知らせします。', '婚礼场地与主持人的协作从开场问候延续到最后一刻。专属主持人合作让双方共同讨论仪式节奏，Freetiful 将其作为婚礼场地业务的新合作消息发布。'),
    image: { ...N('38'), veil: [0.72, 0.88] },
    sourceNote: PARTNERSHIP_SOURCE,
    cta: CTA_INQUIRY_HALL,
    milestone: tr('슈슈*드웨딩 전속 사회자 파트너십', 'Resident-MC partnership with 슈슈*드웨딩', '슈슈*드웨딩と専属司会者提携', '与슈슈*드웨딩建立专属主持人合作'),
  },
  {
    id: 'freetiful-show-anyang-2026',
    date: '2026.05.23',
    tag: 'hall',
    title: tr('빌라드지디 안양 말자쇼에 프리티풀이 협업했습니다', 'Freetiful collaborated on Villa de GD Anyang\'s Malja Show', 'ヴィラ・ド・ジディ安養のマルジャショーに協業参加', 'Freetiful 协作参与 Villa de GD 安养 Malja Show'),
    lead: tr('프리티풀이 5월 23일 빌라드지디 안양점에서 열린 말자쇼에 협업 파트너로 함께했습니다. 빌라드지디가 자체적으로 진행한 행사에 프리티풀이 참여한 현장 소식입니다.', 'Freetiful joined the Malja Show at Villa de GD Anyang on May 23 as a collaborating partner. The event was independently organized by Villa de GD.', 'Freetifulは5月23日、ヴィラ・ド・ジディが独自に開催した安養のマルジャショーに協業パートナーとして参加しました。', '5月23日，Freetiful 作为协作伙伴参与由 Villa de GD 自行举办的安养 Malja Show。'),
    points: [
      tr('일시: 2026년 5월 23일(토) 19:00~20:30', 'Date: Sat, May 23, 2026, 19:00–20:30 KST', '日時：2026年5月23日（土）19:00〜20:30（韓国時間）', '时间：2026年5月23日（周六）19:00至20:30（韩国时间）'),
      tr('장소: 빌라드지디 안양점', 'Venue: Villa de GD Anyang', '会場：ヴィラ・ド・ジディ安養', '场地：Villa de GD 安养'),
      tr('행사: 빌라드지디 자체 진행 말자쇼', 'Event: Malja Show, independently organized by Villa de GD', '催事：ヴィラ・ド・ジディによるマルジャショー', '活动：Villa de GD 自行举办的 Malja Show'),
      tr('프리티풀 참여: 행사 협업', 'Freetiful\'s role: event collaborator', 'Freetifulの参加範囲：協業', 'Freetiful 参与范围：活动协作'),
    ],
    body: tr('웨딩 공간에서 선보이는 콘텐츠는 다양한 파트너의 협업을 통해 관객과 만납니다. 이번 안양 일정은 프리티풀쇼의 현장 소식 가운데 협업 사례로 남았습니다. 프리티풀은 함께한 파트너로서 공간과 콘텐츠가 만나는 이번 자리를 소개합니다.', 'Wedding-venue content meets its audience through collaboration among different partners. The Anyang date forms part of Freetiful Show\'s event story as a collaboration. Freetiful shares this meeting of venue and content as a participating partner.', '式場のコンテンツは多様なパートナーの協業を通じて観客に届きます。今回の安養での参加は、Freetifulショーの協業事例として記録します。', '婚礼场地中的内容通过不同伙伴的协作与观众相遇。安养场作为 Freetiful Show 的协作案例记录，介绍空间与节目内容的结合。'),
    image: N('20'),
    sourceNote: COMPANY_SOURCE,
    cta: CTA_EVENT,
  },
  {
    id: 'freetiful-show-suseo-2026',
    date: '2026.03.28',
    tag: 'hall',
    title: tr('프리티풀쇼 수서, 빌라드지디에서 하람쇼를 진행했습니다', 'Freetiful Show Suseo: hosting Haram Show at Villa de GD', 'Freetifulショー水西、ヴィラ・ド・ジディでハラムショーを進行', 'Freetiful Show 水西：在 Villa de GD 主持 Haram Show'),
    lead: tr('프리티풀이 3월 28일 빌라드지디 수서점에서 프리티풀쇼 수서 일정으로 하람쇼 진행을 맡았습니다. 홍대에 이어 웨딩 공간으로 무대를 옮긴 프리티풀쇼의 소식입니다.', 'Freetiful hosted Haram Show at Villa de GD Suseo on March 28 as the Suseo edition of Freetiful Show, following the Hongdae event with a wedding-venue setting.', 'Freetifulは3月28日、ヴィラ・ド・ジディ水西でFreetifulショー水西としてハラムショーの進行を担当しました。弘大に続きウェディング空間へ舞台を移した開催です。', '3月28日，Freetiful 在 Villa de GD 水西主持 Haram Show，作为 Freetiful Show 水西场，继弘大活动后将舞台延伸至婚礼空间。'),
    points: [
      tr('일시: 2026년 3월 28일(토) 19:00~21:00', 'Date: Sat, March 28, 2026, 19:00–21:00 KST', '日時：2026年3月28日（土）19:00〜21:00（韓国時間）', '时间：2026年3月28日（周六）19:00至21:00（韩国时间）'),
      tr('장소: 빌라드지디 수서점', 'Venue: Villa de GD Suseo', '会場：ヴィラ・ド・ジディ水西', '场地：Villa de GD 水西'),
      tr('프로그램: 하람쇼', 'Program: Haram Show', 'プログラム：ハラムショー', '节目：Haram Show'),
      tr('프리티풀 담당: 행사 진행', 'Freetiful\'s role: event hosting', 'Freetifulの担当：進行', 'Freetiful 职责：活动主持'),
    ],
    body: tr('행사의 분위기는 장소가 달라지면 또 다른 인상을 만듭니다. 프리티풀쇼 수서는 웨딩 베뉴에서 진행 콘텐츠를 선보인 기록으로, 프리티풀이 하람쇼의 진행을 맡아 현장과 만난 사례입니다. 공간과 사회가 함께 만드는 행사 경험을 소개합니다.', 'A different setting gives an event a different character. The Suseo edition records Freetiful\'s hosting of Haram Show in a wedding venue, bringing event content and its setting together.', '場所が変わるとイベントの印象も変わります。水西のウェディング会場でハラムショーの進行を担当し、空間と司会が交わる体験となりました。', '不同场地会赋予活动不同印象。水西场记录了 Freetiful 在婚礼场地中主持 Haram Show，将节目内容与空间体验相连接。'),
    image: {
      src: '/images/biz-news/freetiful-show-suseo-2026/ceremony.webp', bg: '#DDDCD8',
      position: '50% 55%', veil: PHOTO_VEIL, aspectRatio: '4 / 3',
      caption: tr('프리티풀쇼 수서 · 빌라드지디 수서점 예식 시연 현장', 'Freetiful Show Suseo · ceremony demonstration at Villa de GD', 'Freetifulショー水西・ヴィラ・ド・ジディでの挙式実演', 'Freetiful Show 水西：Villa de GD 仪式演示现场'),
      description: tr('높은 천장의 샹들리에와 꽃으로 장식된 무대 사이에 예식 시연 장면이 펼쳐졌습니다. 신랑·신부 역할의 두 사람을 중심으로 양옆의 진행자들이 함께하는 구도는, 웨딩 공간과 사회자의 진행이 한 장면을 만드는 모습을 보여줍니다.', 'A ceremony demonstration unfolds beneath the chandeliers and among the stage flowers. With the couple at the center and hosts on either side, the scene brings the wedding setting and live hosting together.', 'シャンデリアと花に彩られたステージで挙式実演が行われました。新郎新婦役の二人を中心に両側の進行者が並び、式場と司会が一つの場面をつくる様子が見られます。', '高悬的吊灯与花艺舞台间呈现了一场仪式演示。扮演新人的两人位于中央，主持人分立两侧，展示了婚礼空间与现场主持共同构成一个场景的方式。'),
    },
    photos: [
      { src: '/images/biz-news/freetiful-show-suseo-2026/stage.webp', width: 1600, height: 1200, caption: tr('무대와 객석이 함께한 프리티풀쇼 수서 현장', 'Stage and audience at Freetiful Show Suseo', 'Freetifulショー水西のステージと客席', 'Freetiful Show 水西的舞台与观众席'),
        description: tr('붉은빛으로 채워진 대형 스크린과 원형 테이블에 앉은 관객들이 같은 공간을 채웠습니다. 무대만 따로 보여주는 사진이 아니라 객석까지 함께 담아, 하람쇼가 펼쳐진 빌라드지디 수서점의 규모와 현장 분위기를 전합니다.', 'A red-lit screen and guests seated at round tables share the frame. Including both stage and audience, the photograph conveys the setting and atmosphere of Haram Show at Villa de GD Suseo.', '赤く照らされた大型スクリーンと円卓に座る観客を一緒に収めました。ステージだけでなく客席も写すことで、ハラムショーが開かれた空間とその雰囲気を伝えます。', '红色大屏与圆桌旁的观众同处一个画面。照片没有单独截取舞台，而是将观众席一并记录，呈现 Haram Show 在 Villa de GD 水西举行时的空间与氛围。') },
      { src: '/images/biz-news/freetiful-show-suseo-2026/audience.webp', width: 1600, height: 1200, caption: tr('빌라드지디 수서점에서 열린 프리티풀쇼', 'Freetiful Show at Villa de GD Suseo', 'ヴィラ・ド・ジディ水西で開かれたFreetifulショー', 'Villa de GD 水西举行的 Freetiful Show'),
        description: tr('화면의 소개 장면을 바라보는 객석 위로 샹들리에와 조명이 길게 이어집니다. 꽃과 테이블, 무대가 한눈에 들어오는 이 장면은 예식 공간이 공연과 진행 콘텐츠를 만나는 프리티풀쇼 수서의 또 다른 표정을 담았습니다.', 'Chandeliers stretch above the audience facing the presentation screen. Flowers, tables and stage appear together, recording another view of a wedding venue hosting Freetiful Show Suseo.', '紹介画面に向かう客席の上にシャンデリアと照明が連なります。花やテーブル、ステージを一度に収め、式場とショーが出会った別の表情を記録しました。', '吊灯与灯光在面向介绍屏幕的观众席上方延伸。花艺、桌席和舞台尽收眼底，记录了婚礼空间与 Freetiful Show 水西相遇时的另一幅现场画面。') },
    ],
    sourceNote: COMPANY_SOURCE,
    cta: CTA_EVENT,
  },
  {
    id: 'freetiful-show-hongdae-2026',
    date: '2026.02.06',
    tag: 'event',
    title: tr('홍대에서 만난 프리티풀쇼, 90분의 무대를 열었습니다', 'Freetiful Show brought a 90-minute stage to Hongdae', '弘大で出会うFreetifulショー、90分のステージ', 'Freetiful Show 弘大场：90分钟的现场舞台'),
    lead: tr('프리티풀쇼가 2월 6일 홍대 K팝스테이지에서 열렸습니다. 금요일 저녁 7시 30분부터 9시까지, 프리티풀의 이름으로 관객과 만난 90분의 행사였습니다.', 'Freetiful Show took place at K-Pop Stage in Hongdae on February 6. The 90-minute event ran on Friday evening from 19:30 to 21:00.', 'Freetifulショーが2月6日、弘大Kポップステージで開催されました。金曜19時30分から21時まで、90分のイベントでした。', 'Freetiful Show 于2月6日在弘大 K-Pop Stage 举行，周五晚19:30至21:00带来90分钟的现场活动。'),
    points: [
      tr('일시: 2026년 2월 6일(금) 19:30~21:00', 'Date: Fri, February 6, 2026, 19:30–21:00 KST', '日時：2026年2月6日（金）19:30〜21:00（韓国時間）', '时间：2026年2月6日（周五）19:30至21:00（韩国时间）'),
      tr('장소: 홍대 K팝스테이지 B1', 'Venue: K-Pop Stage Hongdae, B1', '会場：弘大KポップステージB1', '场地：弘大 K-Pop Stage 地下一层'),
      tr('주소: 서울 마포구 와우산로21길 29 지하 1층', 'Address: B1, 29 Wausan-ro 21-gil, Mapo-gu, Seoul', '住所：ソウル麻浦区臥牛山路21ギル29 地下1階', '地址：首尔麻浦区卧牛山路21街29号地下一层'),
    ],
    body: tr('프로필과 영상으로 접하던 진행의 매력은 현장에서 다른 방식으로 전해집니다. 프리티풀쇼 홍대는 그 이름과 무대를 직접 만나는 접점이었습니다. 이후 수서와 안양에서 이어진 행사·협업 소식과 함께 프리티풀쇼의 현장 기록으로 남깁니다.', 'The appeal of live hosting reaches audiences differently from a profile or recording. The Hongdae show created an in-person meeting point with the Freetiful name and stage. It forms part of the event story alongside the later Suseo show and Anyang collaboration.', 'プロフィールや映像とは違う形で伝わる、現場の進行の魅力。弘大でのショーは、その名前と舞台に直接触れる機会でした。後の水西・安養の催しと共に記録します。', '现场主持的魅力不同于资料与视频。弘大场让观众直接感受 Freetiful 的舞台，与之后水西的活动及安养的协作共同构成现场记录。'),
    image: N('20'),
    sourceNote: COMPANY_SOURCE,
    cta: CTA_EVENT,
  },
  {
    id: 'villadegd',
    date: '2026.06',
    tag: 'hall',
    title: tr('빌라드*디와 전속 사회자 파트너십을 맺었습니다', 'A resident-MC partnership with 빌라드*디', '빌라드*디と専属司会者パートナーシップを締結', '与빌라드*디建立专属主持人合作'),
    lead: tr(
      '프리티풀이 2026년 6월 빌라드*디와 전속 사회자 파트너십을 맺었습니다. 웨딩홀과 전문 사회자가 예식의 진행을 함께 논의하는 협업의 소식입니다.',
      'Freetiful entered a resident-MC partnership with 빌라드*디 in June 2026, creating a connection between a wedding hall and professional ceremony hosts.',
      'Freetifulは2026年6月、빌라드*디と専属司会者パートナーシップを締結しました。式場とプロの司会者が進行を共に話し合う協業です。',
      '2026年6月，Freetiful 与빌라드*디建立专属主持人合作，连接婚礼场地与专业仪式主持。',
    ),
    points: [
      tr('파트너: 빌라드*디', 'Partner: 빌라드*디', '提携先：빌라드*디', '合作方：빌라드*디'),
      tr('제휴 시점: 2026년 6월', 'Partnership date: June 2026', '提携時期：2026年6月', '合作时间：2026年6月'),
      tr('협업 분야: 전속 사회자 파트너십', 'Scope: resident wedding MC partnership', '協業分野：専属司会者パートナーシップ', '合作领域：专属婚礼主持人'),
    ],
    body: tr(
      '웨딩 베뉴의 개성과 사회자의 진행은 한 예식 안에서 만납니다. 전속 사회자 파트너십은 공간을 운영하는 웨딩홀과 무대의 흐름을 이끄는 사회자가 협력할 수 있는 기반입니다. 프리티풀은 이번 제휴를 통해 웨딩홀 비즈니스와 전문 진행 인력을 연결하는 일을 이어갑니다.',
      'A venue\'s character and an MC\'s hosting come together within one ceremony. A resident-MC partnership provides a basis for collaboration between the wedding hall and its hosts. Freetiful continues to connect wedding-hall businesses with professional event talent through this agreement.',
      '式場の個性と司会者の進行は、一つの挙式で重なります。専属司会者の提携は、空間を運営する式場と進行を担う司会者の協力の土台です。今回の提携でその接点をつなぎます。',
      '场地的个性与主持人的引导在一场婚礼中交汇。专属主持人合作为运营场地的婚礼方与引导流程的主持人建立协作基础，Freetiful 将通过本次合作继续连接专业人才与婚礼业务。',
    ),
    image: { ...N('38'), veil: [0.72, 0.88] },
    sourceNote: PARTNERSHIP_SOURCE,
    cta: CTA_INQUIRY_HALL,
    milestone: tr('빌라드*디 전속 사회자 파트너십', 'Resident-MC partnership with 빌라드*디', '빌라드*디と専属司会者提携', '与빌라드*디建立专属主持人合作'),
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
    id: 'venture',
    date: '2026.03',
    tag: 'company',
    title: tr('주식회사 커넥트풀, 벤처기업 등록', 'Connectful Inc. registered as a venture company', '株式会社Connectful、ベンチャー企業登録', 'Connectful 株式会社完成风险企业登记'),
    lead: tr(
      '프리티풀을 운영하는 주식회사 커넥트풀이 2026년 3월 벤처기업으로 등록됐습니다. 사회자가 필요한 고객과 전문 진행 인력을 연결하는 플랫폼 사업의 기업 소식을 전합니다.',
      'Connectful Inc., the company operating Freetiful, registered as a venture company in March 2026. This marks a company milestone for the platform connecting clients with professional MCs.',
      'Freetifulを運営する株式会社Connectfulが、2026年3月にベンチャー企業として登録されました。顧客とプロの司会者をつなぐプラットフォームの企業ニュースです。',
      '运营 Freetiful 的 Connectful 株式会社于2026年3月完成风险企业登记，这是连接客户与专业主持人的平台企业动态。',
    ),
    points: [
      tr('등록 기업: 주식회사 커넥트풀', 'Registered company: Connectful Inc.', '登録企業：株式会社Connectful', '登记企业：Connectful 株式会社'),
      tr('시점: 2026년 3월', 'Date: March 2026', '時期：2026年3月', '时间：2026年3月'),
      tr('운영 서비스: 프리티풀(Freetiful)', 'Service: Freetiful', '運営サービス：Freetiful', '运营服务：Freetiful'),
    ],
    body: tr('프리티풀은 고객에게는 행사에 맞는 사회자를 찾는 접점을, 사회자에게는 자신의 역량을 소개할 공간을 제공합니다. 플랫폼의 서비스와 이를 운영하는 기업의 발자취를 함께 전하는 의미에서, 이번 벤처기업 등록을 주식회사 커넥트풀의 이력으로 기록합니다.', 'Freetiful gives clients a place to find MCs for their events and hosts a place to present their work. Alongside the service itself, this venture-company registration records another milestone in the story of Connectful Inc., its operating company.', '顧客には司会者を探す接点を、司会者には力量を紹介する場を提供しています。サービスと運営企業の歩みを共に伝える節目として、今回の登録をConnectfulの沿革に記録します。', 'Freetiful 为客户提供寻找主持人的渠道，也为主持人提供展示能力的空间。本次风险企业登记作为 Connectful 株式会社的发展节点，与平台服务的足迹一同记录。'),
    image: N('28'),
    sourceNote: tr('등록 시점은 프리티풀 제공 자료 기준입니다. 아래 공식 시스템 링크는 확인 제도 안내용이며, 개별 확인서 원본을 대신하지 않습니다.', 'The registration date is supplied by Freetiful. The official system below explains the verification program and does not replace the company\'s certificate.', '登録時期はFreetiful提供資料に基づきます。下記は制度案内用の公式システムで、個別確認書の代わりではありません。', '登记时间依据 Freetiful 提供的资料。下方官方系统用于制度说明，不替代企业确认书原件。'),
    sources: [{ title: tr('벤처기업확인종합관리시스템', 'Official Venture Company Verification System', 'ベンチャー企業確認総合管理システム', '风险企业确认综合管理系统'), href: 'https://www.smes.go.kr/venturein/home/viewHome' }],
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
    title: tr('프리티풀, 시드 투자 유치', 'Freetiful secured seed investment', 'Freetiful、シード投資を調達', 'Freetiful 获得种子轮投资'),
    lead: tr(
      '프리티풀이 2026년 2월 시드 투자를 유치했습니다. 결혼식과 기업행사 등 전문적인 진행이 필요한 순간에 고객과 사회자를 연결하는 플랫폼의 기업 소식입니다.',
      'Freetiful secured seed investment in February 2026. The platform connects clients with professional MCs for weddings, corporate functions and other occasions requiring skilled hosting.',
      'Freetifulは2026年2月にシード投資を調達しました。結婚式や企業イベントなど、専門的な進行を求める顧客と司会者をつなぐプラットフォームの企業ニュースです。',
      'Freetiful 于2026年2月获得种子轮投资。平台为婚礼、企业活动及其他需要专业主持的场景连接客户与主持人。',
    ),
    points: [
      tr('투자 단계: 시드(Seed)', 'Funding stage: Seed', '調達段階：シード', '融资阶段：种子轮'),
      tr('유치 시점: 2026년 2월', 'Date: February 2026', '調達時期：2026年2月', '融资时间：2026年2月'),
      tr('운영 법인: 주식회사 커넥트풀', 'Operating company: Connectful Inc.', '運営法人：株式会社Connectful', '运营法人：Connectful 株式会社'),
    ],
    body: tr('시드 투자는 기업의 초기 사업 전개 과정에서 이루어지는 투자 단계입니다. 프리티풀은 사회자의 프로필과 진행 경험을 고객의 행사 수요와 잇는 서비스를 운영하고 있습니다. 이번 투자 유치 소식을 서비스와 기업이 함께 걸어가는 과정의 한 장면으로 전합니다.', 'Seed funding is an early stage of business investment. Freetiful operates a service connecting MC profiles and experience with clients\' event needs. This funding announcement marks a moment in the shared development of the service and the company behind it.', 'シード投資は初期の事業展開における投資段階です。司会者の経験と顧客の需要を結ぶサービスと運営企業が共に歩む、その一つの節目として調達のニュースをお届けします。', '种子轮是企业早期发展中的融资阶段。Freetiful 运营连接主持人资料、经验与客户活动需求的服务，本次融资消息记录服务与运营企业共同发展的一幕。'),
    image: N('14'),
    sourceNote: tr('투자 시점과 단계는 프리티풀 제공 자료를 기준으로 작성했습니다.', 'The funding stage and date are based on information supplied by Freetiful.', '調達時期と段階はFreetiful提供資料に基づきます。', '融资时间及阶段依据 Freetiful 提供的资料。'),
    cta: CTA_HISTORY,
    milestone: tr('시드 투자 유치', 'Seed investment secured', 'シード投資調達', '获得种子轮投资'),
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
    title: tr('2025 Year-End RECEPTION, 한국여성사회자협회와 함께한 송년회', '2025 Year-End RECEPTION with the Woman MC Association Korea', '韓国女性司会者協会と共にした2025 Year-End RECEPTION', '携手韩国女性主持人协会举办2025 Year-End RECEPTION'),
    lead: tr(
      '프리티풀과 한국여성사회자협회가 2025년 11월 24일 청담 리베라호텔에서 2025 Year-End RECEPTION을 함께 열었습니다. 한 해의 활동을 돌아보고 사회자와 업계 관계자들이 교류하는 송년의 자리였습니다.',
      'Freetiful and the Woman MC Association Korea held the 2025 Year-End RECEPTION at Hotel Riviera Cheongdam on November 24, 2025, bringing MCs and industry colleagues together to reflect on the year and connect.',
      'Freetifulと韓国女性司会者協会は2025年11月24日、清潭リベラホテルで2025 Year-End RECEPTIONを共同開催しました。一年を振り返り、司会者と業界関係者が交流する会となりました。',
      '2025年11月24日，Freetiful 与韩国女性主持人协会在清潭里维埃拉酒店共同举办2025 Year-End RECEPTION，让主持人与行业伙伴回顾一年并交流。',
    ),
    points: [
      tr('일시: 2025년 11월 24일(월) 18:00~21:00', 'Date: Mon, November 24, 2025, 18:00–21:00 KST', '日時：2025年11月24日（月）18:00〜21:00（韓国時間）', '时间：2025年11月24日（周一）18:00至21:00（韩国时间）'),
      tr('장소: 청담 리베라호텔 3층 몽블랑홀', 'Venue: Mont Blanc Hall, 3F, Hotel Riviera Cheongdam', '会場：清潭リベラホテル3階モンブランホール', '场地：清潭里维埃拉酒店3层勃朗峰厅'),
      tr('참석: 방송인·업계 대표·제휴사 관계자 등 약 130명(보도 기준)', 'Attendance: about 130 broadcasters, industry leaders and partners (per coverage)', '参加：放送人・業界代表・提携先など約130名（報道基準）', '出席：主持人、行业代表及合作方等约130人（依据报道）'),
      tr('현장 협약: 프리티풀 · 한국여성사회자협회 · 차르와인 3자 MOU', 'On-site agreement: a three-way MOU among Freetiful, the Woman MC Association Korea and Char Wine', '現場での協約：Freetiful・韓国女性司会者協会・チャルワインの3者MOU', '现场签约：Freetiful、韩国女性主持人协会与 Char Wine 三方 MOU'),
      tr('함께한 곳: 프리티풀 · 한국여성사회자협회', 'Together: Freetiful and the Woman MC Association Korea', '共同開催：Freetiful・韓国女性司会者協会', '共同举办：Freetiful 与韩国女性主持人协会'),
    ],
    body: tr(
      '1부는 축하 공연으로 문을 열어 강남구의회와 법무법인 통, 봄온아나운서아카데미의 축하가 이어졌고, 두 기관의 임원 소개와 2026년 계획 발표, 파트너 사회자 감사패 전달이 진행됐습니다. 2부에서는 호텔 코스 만찬과 와인을 곁들인 테이블 토크와 현장 비즈니스 상담, 제휴사 소개, 약 1,000만 원 규모의 경품 추첨이 이어졌습니다. 세라미크의원·데이뷰의원·차르와인·스튜디오패스·법무법인 통 등 여러 협력사가 함께했고, 현장에서는 프리티풀과 한국여성사회자협회, 차르와인이 3자 업무협약을 맺었습니다. 프리티풀은 2026년 파트너 전용 교육과 브랜드 제휴 패키지를 넓혀 갈 계획이라고 밝혔습니다. 행사 전후의 언론 보도는 아래에 모았습니다.',
      'Part one opened with a celebratory performance, followed by congratulations from the Gangnam District Council, Tong Law Firm and Bomon Announcer Academy, introductions of both organizations\' leadership, 2026 plans and appreciation plaques for partner MCs. Part two continued with a hotel course dinner and wine, table talks, on-site business consultations, partner introductions and a prize draw worth about 10 million won. Partners including Ceramique Clinic, Dayview Clinic, Char Wine, Studio Pass and Tong Law Firm took part, and Freetiful, the Woman MC Association Korea and Char Wine signed a three-way agreement on site. Freetiful said it would expand partner-only training and brand partnership packages in 2026. Press coverage before and after the event is collected below.',
      '第1部は祝賀公演で幕を開け、江南区議会・法務法人トン・ボムオンアナウンサーアカデミーの祝辞、両団体の役員紹介と2026年計画の発表、パートナー司会者への感謝牌授与が行われました。第2部はホテルのコース料理とワインを囲むテーブルトーク、現場でのビジネス相談、提携先紹介、約1,000万ウォン規模の抽選会と続きました。セラミク医院・デイビュー医院・チャルワイン・スタジオパス・法務法人トンなど多くの協力会社が参加し、現場ではFreetiful・韓国女性司会者協会・チャルワインが3者協約を結びました。Freetifulは2026年にパートナー専用教育とブランド提携パッケージを広げる計画を明らかにしました。開催前後の報道は下にまとめました。',
      '第一部以祝贺演出开场，随后江南区议会、Tong 律师事务所与 Bomon 主持学院致贺，并进行了两家机构的高层介绍、2026年计划发布及合作主持人感谢牌颁发。第二部有酒店套餐晚宴与葡萄酒相伴的桌边交流、现场商务洽谈、合作方介绍以及约1,000万韩元规模的抽奖。Ceramique 医院、Dayview 医院、Char Wine、Studio Pass、Tong 律师事务所等多家合作方参与，Freetiful、韩国女性主持人协会与 Char Wine 在现场签署三方合作协议。Freetiful 表示2026年将扩大合作主持人专属培训与品牌合作套餐。活动前后的媒体报道汇总如下。',
    ),
    image: { src: '/images/biz-v2/seq/stage-64.webp', bg: '#DCD8D4', position: '50% 30%', veil: PHOTO_VEIL, caption: tr('2025 Year-End RECEPTION 현장 영상', '2025 Year-End RECEPTION event footage', '2025 Year-End RECEPTION現場映像', '2025 Year-End RECEPTION 现场视频'),
      description: tr('프리티풀과 한국여성사회자협회의 이름이 적힌 무대에서 두 진행자가 마이크를 들었습니다. 송년회 영상은 이 무대에서 시작해 객석의 만남과 기념 촬영까지, 한 해를 마무리하는 현장의 여러 장면을 이어 보여줍니다.', 'Two hosts hold microphones on a stage bearing the names of Freetiful and the Woman MC Association Korea. The reception film connects this stage with conversations in the audience and commemorative photographs from the gathering.', 'Freetifulと韓国女性司会者協会の名前を掲げたステージで、二人の進行者がマイクを持ちます。映像はこの舞台から客席の交流、記念撮影まで、年の締めくくりの場面をつなぎます。', '在写有 Freetiful 与韩国女性主持人协会名称的舞台上，两位主持人手持话筒。年会视频从这一舞台延伸至席间交流与纪念合影，串联起岁末相聚的多个场景。') },
    video: '/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4',
    photos: [
      { src: '/images/biz-news/reception-2025/poster.webp', width: 1080, height: 1350, caption: tr('2025 Year-End RECEPTION 공식 포스터', '2025 Year-End RECEPTION official poster', '2025 Year-End RECEPTION公式ポスター', '2025 Year-End RECEPTION 官方海报'),
        description: tr('2025년을 함께 마무리하자는 초대의 메시지를 담은 공식 포스터입니다. 프리티풀과 한국여성사회자협회의 공동주최 표기 아래, 11월 24일 청담 리베라호텔 3층 몽블랑홀에서의 만남을 안내했습니다.', 'The official poster invites guests to close out 2025 together. Bearing the names of joint hosts Freetiful and the Woman MC Association Korea, it announced the November 24 gathering in the Mont Blanc Hall on the third floor of Hotel Riviera Cheongdam.', '2025年を共に締めくくる招待のメッセージを伝える公式ポスターです。両主催者の名前と共に、11月24日、清潭リベラホテル3階モンブランホールでの集まりを案内しています。', '这张官方海报传递了共同辞别2025年的邀请。Freetiful 与韩国女性主持人协会的共同主办标识下，注明了11月24日在清潭里维埃拉酒店三层蒙布朗厅相聚的安排。') },
      { src: '/images/biz-news/reception-2025/program.webp', width: 1080, height: 1350, caption: tr('2025 Year-End RECEPTION 식순 · 17:30부터 등록 및 입장', '2025 Year-End RECEPTION program · registration and admission from 17:30', '2025 Year-End RECEPTION進行表・17:30から受付・入場', '2025 Year-End RECEPTION 流程：17:30起签到入场'),
        description: tr('안내된 식순에는 오후 5시 30분 등록을 시작으로 축하공연과 시상, 네트워킹 만찬, 레크리에이션이 담겼습니다. 무대를 바라보는 시간과 서로 이야기를 나누는 시간을 번갈아 배치한 송년회의 구성을 확인할 수 있습니다.', 'The published program begins with registration at 17:30 and includes performances, awards, a networking dinner and recreation. It outlines an evening alternating between time at the stage and time for conversation.', '進行表には17時30分の受付から、祝賀公演、表彰、交流ディナー、レクリエーションが並びます。舞台を見る時間と互いに話す時間を組み合わせた構成がわかります。', '公布的流程从17:30签到开始，包括庆祝表演、颁奖、交流晚宴与互动活动。流程展示了舞台观赏与席间交流交替展开的晚会安排。') },
      { src: '/images/biz-news/reception-2025/frame-026.webp', width: 1280, height: 720, caption: tr('참석자들이 함께한 교류의 시간 · 송년회 영상 캡처', 'Guests connecting at the reception · video still', '参加者の交流のひととき・忘年会映像より', '来宾交流时刻：年会视频截图'),
        description: tr('원형 테이블에 둘러앉은 참석자들이 서로를 바라보며 이야기를 나눕니다. 한쪽의 무대와 별개로 객석에서도 만남이 이어졌다는 점을 보여주는 장면으로, 송년회의 또 다른 중심이 테이블 사이에 있었음을 전합니다.', 'Guests turn toward one another in conversation around a round table. Alongside the stage program, the seating area had its own exchanges, making the tables another focal point of the reception.', '円卓を囲む参加者が互いに顔を向け、言葉を交わしています。舞台の進行と並んで客席でも交流が続き、テーブルの間にも会の中心があったことを伝える場面です。', '围坐圆桌的来宾面向彼此交谈。舞台节目之外，席间同样延续着交流，桌席也成为这场年会的另一处中心。') },
      { src: '/images/biz-news/reception-2025/frame-040.webp', width: 1280, height: 720, caption: tr('객석과 함께한 무대 · 송년회 영상 캡처', 'A stage shared with the audience · video still', '客席と共にしたステージ・忘年会映像より', '与观众共享舞台：年会视频截图'),
        description: tr('분홍색 정장을 입은 출연자가 마이크를 들고 무대에 섰습니다. 화면 앞쪽에는 객석의 모습도 함께 남아 있어, 무대에서 건네는 말이 참석자들을 향하고 있다는 현장의 구도를 그대로 보여줍니다.', 'A person in a pink suit stands on stage with a microphone. The audience remains in the foreground, preserving the relationship between the person speaking and the people gathered to listen.', 'ピンクのスーツの登壇者がマイクを手に舞台に立ちます。手前には客席も写り、舞台の言葉が参加者に向けられている会場の構図をそのまま残しています。', '一位身穿粉色西装的登台者手持话筒站在台上。前景保留了观众席的身影，呈现出台上发言者与现场听众之间的空间关系。') },
      { src: '/images/biz-news/reception-2025/frame-054.webp', width: 1280, height: 720, caption: tr('2025 Year-End RECEPTION 진행 현장 · 송년회 영상 캡처', 'Hosting the 2025 Year-End RECEPTION · video still', '2025 Year-End RECEPTIONの進行風景・映像より', '2025 Year-End RECEPTION 主持现场：视频截图'),
        description: tr('행사명이 적힌 현수막 아래, 단상 앞에서 진행을 이어가는 장면입니다. 같은 무대라도 진행자의 위치와 객석을 바라보는 방향이 달라지며, 송년회의 여러 순서를 연결하는 현장의 모습이 영상에 남았습니다.', 'Beneath the reception banner, the program continues at the lectern. The hosts change position and direction toward the audience, recording how different parts of the evening were connected on the same stage.', '会の名前を掲げた横断幕の下、演台で進行を続ける場面です。立ち位置や客席への向きを変えながら、さまざまな順序をつないでいく様子が映像に残っています。', '在年会横幅下，主持工作在讲台前继续展开。主持人调整站位与面向观众的方向，视频记录了同一舞台如何衔接晚会中的不同环节。') },
      { src: '/images/biz-news/reception-2025/frame-096.webp', width: 1280, height: 720, caption: tr('한 해를 기념하는 시상 장면 · 송년회 영상 캡처', 'An awards moment celebrating the year · video still', '一年を記念する表彰の場面・忘年会映像より', '纪念这一年的颁奖时刻：年会视频截图'),
        description: tr('트로피를 든 참석자들이 나란히 서서 기념 촬영을 했습니다. 한 해의 활동을 기념하는 시상 순서가 사진으로 남은 순간으로, 무대 위 세 사람의 표정과 손에 든 트로피가 그 장면을 전합니다.', 'Guests holding trophies stand together for a commemorative photograph. Their expressions and the awards in their hands preserve a moment from the reception\'s recognition of the year.', 'トロフィーを持った参加者が並んで記念撮影をしました。一年の活動を記念する表彰の一場面を、三人の表情と手にしたトロフィーが伝えています。', '手持奖杯的来宾并肩站立，留下纪念照片。三人的神情与手中的奖杯，共同记录了年会回顾年度活动的颁奖时刻。') },
      { src: '/images/biz-news/reception-2025/frame-138.webp', width: 1280, height: 720, caption: tr('함께 즐긴 레크리에이션 무대 · 송년회 영상 캡처', 'Enjoying the recreation stage together · video still', '共に楽しんだレクリエーション・忘年会映像より', '共同参与互动舞台：年会视频截图'),
        description: tr('공식적인 순서만으로 송년회를 채우지는 않았습니다. 무대에 올라 몸을 움직이고 서로 호흡을 맞추는 레크리에이션 장면은, 함께 참여하며 한 해를 마무리한 저녁의 다른 분위기를 보여줍니다.', 'The evening was not limited to formal proceedings. A recreation scene on stage shows a different side of the gathering, with participants moving and joining in together to close out the year.', '会は公式な順序だけで終わりません。舞台で体を動かし、息を合わせるレクリエーションの場面が、共に参加して一年を締めくくる夜の別の雰囲気を伝えます。', '这一晚并不只有正式流程。台上来宾通过动作与配合参与互动，展示了大家共同投入、一起辞别这一年的另一面。') },
      { src: '/images/biz-news/reception-2025/frame-166.webp', width: 1280, height: 720, caption: tr('참석자 단체 기념 촬영 · 송년회 영상 캡처', 'A group photo with the guests · video still', '参加者の集合記念撮影・忘年会映像より', '来宾集体留念：年会视频截图'),
        description: tr('마지막 기록은 행사 현수막 앞에 함께 선 참석자들의 단체 사진입니다. 무대와 객석을 나눠 채우던 사람들이 한 화면에 모여, 프리티풀과 한국여성사회자협회가 함께한 2025년 송년회의 모습을 남겼습니다.', 'The final still brings guests together in front of the reception banner. People who had filled the stage and seating area now share one frame, preserving the 2025 gathering of Freetiful and the Woman MC Association Korea.', '最後の記録は横断幕の前に集まった参加者の集合写真です。舞台と客席をそれぞれ彩った人たちが一つの画面に収まり、両団体が共にした2025年の会を残しました。', '最后一帧记录了来宾在年会横幅前的集体合影。此前分处舞台与观众席的人们汇入同一画面，留下 Freetiful 与韩国女性主持人协会共同举办2025年年会的记忆。') },
    ],
    sourceNote: RECEPTION_SOURCE,
    sources: [
      { title: tr('한국시민방송 · 프리티풀·한국여성사회자협회, 공동 송년회 성료 “프리랜서 사회자 네트워크 허브로 도약”', 'Korea Citizen Broadcasting · Freetiful and the Woman MC Association Korea conclude joint reception', '韓国市民放送・Freetiful・韓国女性司会者協会、共同忘年会を盛況のうちに終了', '韩国市民广播：Freetiful 与韩国女性主持人协会联合年会圆满落幕'), href: 'https://kcbpaper.kr/post/8Q5iIaAb', note: tr('2025.12.06 · 행사 후 현장 보도', 'Dec 6, 2025 · post-event report', '2025.12.06・開催後の現場報道', '2025.12.06：活动后现场报道') },
      { title: tr('브랜드뉴스 · [현장] 한국여성사회자협회·프리티풀, 공동 송년회 성료', 'Brand News · [On site] the joint reception concludes', 'ブランドニュース・［現場］共同忘年会を盛況のうちに終了', 'Brand News：［现场］联合年会圆满落幕'), href: 'https://www.ibrandnews.com/news/articleView.html?idxno=11293', note: tr('2025.12.08 · 행사 후 현장 보도', 'Dec 8, 2025 · post-event report', '2025.12.08・開催後の現場報道', '2025.12.08：活动后现场报道') },
      { title: tr('한국시민방송 · 프리티풀, 한국여성사회자협회와 공동 송년회 개최 “업계 네트워킹 허브될 것”', 'Korea Citizen Broadcasting · Freetiful to hold joint reception with the Woman MC Association Korea', '韓国市民放送・Freetiful、韓国女性司会者協会と共同忘年会を開催', '韩国市民广播：Freetiful 将与韩国女性主持人协会联合举办年会'), href: 'https://kcbpaper.kr/post/WSev6tKr', note: tr('2025.11.12 · 행사 전 안내 보도', 'Nov 12, 2025 · pre-event announcement', '2025.11.12・開催前の案内報道', '2025.11.12：活动前预告报道') },
      { title: tr('브랜드뉴스 · 한국여성사회자협회, 프리티풀 공동 송년회 개최', 'Brand News · the Woman MC Association Korea and Freetiful announce a joint reception', 'ブランドニュース・韓国女性司会者協会とFreetifulが共同忘年会を開催', 'Brand News：韩国女性主持人协会与 Freetiful 举办联合年会'), href: 'https://www.ibrandnews.com/news/articleView.html?idxno=11167', note: tr('2025.11.14 · 행사 전 안내 보도', 'Nov 14, 2025 · pre-event announcement', '2025.11.14・開催前の案内報道', '2025.11.14：活动前预告报道') },
    ],
    cta: CTA_EVENT,
  },
];

export const BIZ_NEWS: BizNewsItem[] = NEWS_ITEMS.slice().sort((a, b) => b.date.localeCompare(a.date));

/** 연혁 기사(오래된 순) — 시트 아래 '프리티풀이 걸어온 길' */
export const BIZ_NEWS_MILESTONES = BIZ_NEWS.filter((n) => n.milestone).slice().reverse();
