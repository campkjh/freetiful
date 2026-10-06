/**
 * 자동응답 '주제' — 고객이 흔히 묻는 8가지(261006 사장 '사회자마다 말투·행사 가능 조건을 학습해서 자동답변').
 *
 *  · 지정 사회자(퀵매칭)는 주제마다 답이 하나씩 후보에 들어간다 — 학습한 그 사회자 말투의 답(learned)이 있으면 그것,
 *    없으면 플랫폼 기본 답(fallback, 7fec61ae 의 PLATFORM_DEFAULT_REPLIES 그대로). parts·region 은 기본 답이 없어 학습했을 때만.
 *  · ⚠ question 문구 = 안정 키(stableKeyOf) — 바꾸면 방마다 '이미 보낸 답' 기록과 어긋나 같은 답이 또 나간다. 기존 6개 문구는 그대로 둘 것.
 *  · followUp = 보내면서 사회자에게도 알린다(견적·미팅·일정은 결국 사람이 답해야 하는 주제).
 *    parts·region 은 학습한 답이 근거 있는 사실(known)이면 알리지 않고, 근거가 없어 되묻는 답이면 알린다.
 *  · holdable = AI 가 '사람이 답할 말'(needsHuman)이라 넘겨도, 이 주제 답(약속 없는 말)으로 받아 두고 사회자에게 알린다 —
 *    '확인하고 안내드릴게요' 한 줄이 방마다 한 번뿐이라 두 번째 질문부터 침묵하던 것(사장 테스트 261006 김솔 방).
 */
export type TopicId = 'price' | 'meeting' | 'contact' | 'portfolio' | 'style' | 'date' | 'parts' | 'region';

export interface AutoReplyTopic {
  id: TopicId;
  question: string;
  fallback: string | null;
  followUp: boolean;
  holdable: boolean;
  match: RegExp;
  /** AI 라우터 intent 와 같은 뜻 */
  intents: string[];
  /** 학습 지시 — 이 주제 답을 어떻게 쓰는지 */
  guide: string;
}

export const AUTO_REPLY_TOPICS: AutoReplyTopic[] = [
  {
    id: 'price',
    question: '견적·가격·비용이 얼마인지 묻는 말(숫자 없이)',
    fallback: '행사 정보 확인하고 견적서로 정확하게 안내드릴게요. 원하시는 진행 순서나 분위기가 있으면 같이 말씀해 주세요!',
    followUp: true,
    holdable: true,
    match: /견적|가격|비용|금액|얼마/,
    intents: ['quote'],
    guide: '금액 숫자는 절대 쓰지 않는다. 시간·장소·진행 범위에 따라 달라서 확인 후 견적서로 안내드린다는 뜻 + 필요한 정보를 묻는다.',
  },
  {
    id: 'meeting',
    question: '사전 미팅·통화로 미리 맞춰 볼 수 있는지 묻는 말',
    fallback: '미리 맞춰 보면 훨씬 편하게 진행할 수 있어요. 편하신 방법(전화·화상·대면)을 말씀해 주시면 확인해서 안내드릴게요.',
    followUp: true,
    holdable: true,
    match: /미팅|만나|만날|상담|통화/,
    intents: ['process'],
    guide: '이 사회자가 실제로 하는 사전 협의 방식(통화·대면·카톡 아님 — 프리티풀 채팅)을 근거 있을 때만 말하고, 일정은 확인해서 잡겠다고 한다. 시간 약속 금지.',
  },
  {
    id: 'contact',
    question: '연락처·전화번호·카톡을 묻는 말',
    fallback: '프리티풀 채팅으로 편하게 말씀 주세요. 확인하는 대로 바로 답장드릴게요!',
    followUp: false,
    holdable: true,
    match: /전화|연락처|번호|카톡|카카오/,
    intents: [],
    guide: '연락처·카톡 아이디·외부 메신저를 주지 않는다. 프리티풀 채팅으로 편하게 말씀 달라는 뜻.',
  },
  {
    id: 'portfolio',
    question: '경력·진행 영상·후기를 보고 싶다는 말',
    fallback: '제 프로필에 경력과 진행 모습을 정리해 두었어요. 보시고 궁금한 점 있으면 편하게 물어봐 주세요!',
    followUp: false,
    holdable: false,
    match: /영상|경력|후기|포트폴리오|사진/,
    intents: ['portfolio'],
    guide: '링크·주소는 쓰지 않는다. 프로필에 진행 영상·경력을 올려 두었다는 뜻(근거 있으면 경력 연수·진행 분야 한마디).',
  },
  {
    id: 'style',
    question: '진행 스타일·분위기·멘트·순서를 묻는 말',
    fallback: '원하시는 분위기에 맞춰 준비해요. 꼭 넣고 싶은 순서나 피하고 싶은 멘트가 있으면 편하게 말씀해 주세요.',
    followUp: false,
    holdable: false,
    match: /스타일|분위기|멘트|순서|대본|컨셉|콘셉트/,
    intents: ['script'],
    guide: '이 사회자가 메시지에서 실제로 말한 진행 스타일·준비 방식(대본·식순 맞추기 등)을 근거로 쓴다.',
  },
  {
    id: 'date',
    question: '그날 일정이 되는지(가능 여부) 묻는 말',
    fallback: '요청 주신 날짜와 시간 확인하고 있어요. 일정 확인되는 대로 바로 안내드릴게요!',
    followUp: true,
    holdable: true,
    match: /일정|날짜|그날|되시나|가능(하|한|할|여부)/,
    intents: ['schedule'],
    guide: "날짜 가능 여부를 확답하지 않는다('가능합니다·비어 있어요·잡아 둘게요·확정' 금지). 날짜·시간·장소를 확인해서 바로 알려 드린다는 뜻.",
  },
  {
    id: 'parts',
    question: '1부(본식)·2부(피로연·이벤트) 진행 범위를 묻는 말',
    fallback: null,
    followUp: false,
    holdable: true,
    match: /1부|2부|본식|피로연|연회|이벤트\s*진행/,
    intents: [],
    guide: '이 사회자가 1부·2부(피로연·이벤트)를 하는지 메시지·프로필에 근거가 있으면 그대로, 없으면 필요한 진행 범위를 되묻는다. 추가 금액 숫자 금지.',
  },
  {
    id: 'region',
    question: '지역·출장·이동이 되는지 묻는 말',
    fallback: null,
    followUp: false,
    holdable: true,
    match: /지역|지방|출장|교통비|거리|멀어|멀리|부산|대구|광주|대전|울산|세종|제주|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|경기|인천/,
    intents: ['region'],
    guide: '활동 지역·전국 가능 여부·출장비 별도 여부를 근거 있을 때만(금액 숫자 금지). 근거 없으면 예식장 위치를 묻는다.',
  },
];

export const TOPIC_BY_ID = new Map(AUTO_REPLY_TOPICS.map((t) => [t.id, t]));

/** 후보 행 id — 'default:<주제>' 플랫폼 기본 답 · 'learned:<주제>[:known]' 학습한 답(DB 행 id 와 섞이지 않는다) */
export const TOPIC_ROW_PREFIXES = ['default:', 'learned:'] as const;

export function isTopicRowId(id: string) {
  return TOPIC_ROW_PREFIXES.some((p) => id.startsWith(p));
}

export function topicOfRowId(id: string): AutoReplyTopic | null {
  if (!isTopicRowId(id)) return null;
  const topicId = id.split(':')[1] as TopicId;
  return TOPIC_BY_ID.get(topicId) || null;
}

/** 보내면서 사회자에게 알릴 주제인가 — parts·region 은 학습한 답이 근거 없는(되묻는) 답일 때만 */
export function topicNeedsFollowUp(id: string) {
  const topic = topicOfRowId(id);
  if (!topic) return false;
  if (topic.followUp) return true;
  return (topic.id === 'parts' || topic.id === 'region') && id.startsWith('learned:') && !id.endsWith(':known');
}

/** 날짜·시간 확답, 무상 약속 — 학습한 답에도 넣지 않는다(발송 직전 검사와 같은 뜻) */
export const COMMIT_WORDS = /가능합니다|가능해요|가능하세요|비어\s*있|비워\s*두|잡아\s*두|잡아둘|열려\s*있|문제\s*없|예약\s*가능|확정|무료|공짜|서비스로\s*(해|드)|할인해\s*드릴|깎아\s*드릴/;
