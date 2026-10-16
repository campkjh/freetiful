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
 * 261016 행사·제휴 일정은 운영자 제공 자료로 보강했다. 공개 보도는 sources 에 별도로 연결하고, 날짜가 다른 보도는 같은 행사로 취급하지 않는다.
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
  image: { src: string; bg: string; position?: string; veil?: number | [number, number]; caption?: Tr };
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
const PHOTO = '/images/biz-v2/photos';
/** 행사 사진 카드의 아래 막 — 사진은 위쪽 절반에서 또렷하고, 글자 줄(태그 · 날짜 · 제목) 뒤는 거의 불투명한 젖빛으로 */
const PHOTO_VEIL: [number, number] = [0.82, 0.95];

const CTA_INQUIRY_HALL = { label: tr('웨딩홀 제휴 문의', 'Hall partnership', '式場提携のご相談', '婚礼堂合作咨询'), href: '/biz/inquiry' };
const CTA_HISTORY = { label: tr('연혁 보기', 'View milestones', '沿革を見る', '查看发展历程'), href: '/biz/history' };
const CTA_EVENT = { label: tr('행사 문의하기', 'Event inquiry', 'イベントのご相談', '活动咨询'), href: '/biz/inquiry' };
const COMPANY_SOURCE = tr('일정과 참여 범위는 프리티풀 제공 자료를 기준으로 작성했습니다.', 'Dates and Freetiful\'s role are based on information supplied by Freetiful.', '日程と参加範囲はFreetiful提供資料に基づきます。', '日期与参与范围依据 Freetiful 提供的资料。');
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
    title: tr('듣고 보고 경험한 예식, 슈슈몽드 웨딩 청음회', 'Hear, see and experience a ceremony at Chouchou Monde', '聞いて、見て、体験するシュシュモンドのウェディング試聴会', '听见、看见、体验婚礼：Chouchou Monde 婚礼试听会'),
    lead: tr('프리티풀이 8월 16일 강남 슈슈몽드에서 웨딩 청음회 진행을 맡았습니다. 정장·한복·드레스 쇼와 실제 예식 시연을 통해 웨딩의 소리와 장면을 함께 경험하는 자리였습니다.', 'Freetiful hosted a wedding listening event at Chouchou Monde in Gangnam on August 16. Suit, hanbok and wedding-dress presentations accompanied a ceremony demonstration, bringing the sounds and scenes of a wedding together.', 'Freetifulは8月16日、江南のシュシュモンドでウェディング試聴会の進行を担当しました。スーツ・韓服・ドレスショーと挙式実演で、音と場面を体験する機会となりました。', '8月16日，Freetiful 在江南 Chouchou Monde 主持婚礼试听会，通过西装、韩服、婚纱展示与婚礼仪式演示，呈现婚礼的声音与场景。'),
    points: [
      tr('일시: 2026년 8월 16일(일) 13:00~15:00', 'Date: Sun, August 16, 2026, 13:00–15:00 KST', '日時：2026年8月16日（日）13:00〜15:00（韓国時間）', '时间：2026年8月16日（周日）13:00至15:00（韩国时间）'),
      tr('장소: 강남 슈슈몽드', 'Venue: Chouchou Monde, Gangnam', '会場：江南シュシュモンド', '场地：江南 Chouchou Monde'),
      tr('프로그램: 웨딩 청음회, 정장·한복·드레스 쇼, 실제 예식 시연', 'Program: wedding listening session, suit/hanbok/dress shows and ceremony demonstration', '内容：ウェディング試聴会、スーツ・韓服・ドレスショー、挙式実演', '内容：婚礼试听、西装/韩服/婚纱展示及仪式演示'),
      tr('프리티풀 담당: 행사 진행', 'Freetiful\'s role: event hosting', 'Freetifulの担当：進行', 'Freetiful 职责：活动主持'),
    ],
    body: tr('예식의 분위기는 의상과 공간, 사회자의 말과 음악이 어우러질 때 구체적으로 다가옵니다. 이번 청음회는 서로 다른 웨딩 요소를 한자리에서 살펴보고 실제 예식의 흐름으로 연결해 보는 프로그램으로 구성됐습니다.', 'A ceremony\'s atmosphere becomes tangible when clothing, space, spoken words and music come together. The event brought wedding elements into one setting and connected them through a ceremony demonstration.', '衣装や空間、司会者の言葉と音楽が重なることで、挙式の雰囲気が具体的になります。さまざまな要素を一度に見て、挙式の流れへつなぐプログラムとなりました。', '当服装、空间、主持人的话语与音乐结合，婚礼氛围便具体可感。本次活动将不同婚礼元素集中展示，并通过仪式演示呈现整体流程。'),
    image: N('07'),
    sourceNote: COMPANY_SOURCE,
    sources: [
      { title: tr('슈슈몽드 공식 소개', 'Chouchou Monde official venue introduction', 'シュシュモンド公式紹介', 'Chouchou Monde 官方介绍'), href: 'https://www.chouchoumonde.co.kr/About' },
      { title: tr('국민일자리신문 · 프리티풀·슈슈몽드 웨딩 청음회 관련 보도', 'Kukmin Job · related coverage of Freetiful and Chouchou Monde', '国民雇用新聞・関連報道', '国民就业新闻：Freetiful 与 Chouchou Monde 相关报道'), href: 'https://www.kukminjob.com/news/457222', note: tr('이 보도는 7월 27일 청음회를 소개합니다. 본문의 8월 16일 행사와 구분해 참고 자료로 연결했습니다. 보도 속 참석 인원·경쟁률은 본 행사 실적으로 사용하지 않았습니다.', 'This report describes a July 27 event, not the August 16 event above. Its attendance and application figures are not attributed to this event.', 'この記事は7月27日の催しを扱います。本文の8月16日とは区別し、来場・応募人数は本催事の実績として使用していません。', '该报道介绍7月27日的活动，与本文8月16日活动区分引用，未将其中人数及报名数据作为本次活动实绩。') },
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
    image: N('07'),
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
      tr('장소: 청담 리베라호텔', 'Venue: Hotel Riviera Cheongdam', '会場：清潭リベラホテル', '场地：清潭里维埃拉酒店'),
      tr('함께한 곳: 프리티풀 · 한국여성사회자협회', 'Together: Freetiful and the Woman MC Association Korea', '共同開催：Freetiful・韓国女性司会者協会', '共同举办：Freetiful 与韩国女性主持人协会'),
    ],
    body: tr('행사는 무대에서의 만남을 넘어 새로운 협업을 이야기하는 교류의 장이었습니다. 한국시민방송의 관련 보도도 시상과 네트워킹이 함께한 현장을 소개했습니다. 프리티풀은 이날의 무대를 현장 영상과 함께 전합니다.', 'The reception offered a setting for meeting beyond the stage and discussing new collaboration. Related coverage by Korea Citizen Broadcasting described awards and networking at the event. Freetiful shares the occasion with its own event footage.', '新たな協業を語る交流の場となり、韓国市民放送の関連記事も表彰とネットワーキングを紹介しました。自社の現場映像と共にお届けします。', '年会让伙伴在舞台之外交流并探讨合作，韩国市民广播的相关报道亦介绍了表彰与交流环节。Freetiful 同时提供当天的现场视频。'),
    image: { src: '/images/biz-v2/seq/stage-64.webp', bg: '#DCD8D4', position: '50% 30%', veil: PHOTO_VEIL, caption: tr('2025 Year-End RECEPTION 현장 영상', '2025 Year-End RECEPTION event footage', '2025 Year-End RECEPTION現場映像', '2025 Year-End RECEPTION 现场视频') },
    video: '/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4',
    sourceNote: COMPANY_SOURCE,
    sources: [{ title: tr('한국시민방송 · 프리티풀·한국여성사회자협회 공동 송년회 보도', 'Korea Citizen Broadcasting · joint year-end reception coverage', '韓国市民放送・共同忘年会の報道', '韩国市民广播：联合年会报道'), href: 'https://kcbpaper.kr/post/8Q5iIaAb' }],
    cta: CTA_EVENT,
  },
];

export const BIZ_NEWS: BizNewsItem[] = NEWS_ITEMS.slice().sort((a, b) => b.date.localeCompare(a.date));

/** 연혁 기사(오래된 순) — 시트 아래 '프리티풀이 걸어온 길' */
export const BIZ_NEWS_MILESTONES = BIZ_NEWS.filter((n) => n.milestone).slice().reverse();
