export const NCP_MATCH_TEMPLATES = {
  request_received: { key: 'NCP_MATCH_TEMPLATE_RECEIPT', fallback: '' },
  pro_message: { key: 'NCP_MATCH_TEMPLATE_PRO_MESSAGE', fallback: 'A0009' },
  unread_reminder: { key: 'NCP_MATCH_TEMPLATE_UNREAD', fallback: '' },
  no_reply_reminder: { key: 'NCP_MATCH_TEMPLATE_NO_REPLY', fallback: '' },
  new_quote_request: { key: 'NCP_MATCH_TEMPLATE_NEW_QUOTE', fallback: 'A0003' },
  customer_reply: { key: 'NCP_MATCH_TEMPLATE_CUSTOMER_REPLY', fallback: 'A00051' },
} as const;

export type MatchAlimtalkKind = keyof typeof NCP_MATCH_TEMPLATES;

export function isMatchAlimtalkKind(value: string): value is MatchAlimtalkKind {
  return Object.prototype.hasOwnProperty.call(NCP_MATCH_TEMPLATES, value);
}

export function chatAlimtalkKind(sender: string, recipient: string, customer: string, pro: string) {
  if (customer !== pro && sender === pro && recipient === customer) return 'pro_message';
  if (customer !== pro && sender === customer && recipient === pro) return 'customer_reply';
  return null;
}

export function isReminder(kind: MatchAlimtalkKind) {
  return kind === 'unread_reminder' || kind === 'no_reply_reminder';
}

export function reminderDecision(kind: MatchAlimtalkKind, readAt: Date | null, now: Date, replyDelayMs: number) {
  if (kind === 'unread_reminder') return readAt ? 'skip' : 'send';
  if (kind !== 'no_reply_reminder') return 'send';
  if (!readAt) return 'skip';
  const at = new Date(readAt.getTime() + replyDelayMs);
  return at > now ? at : 'send';
}

export function nextReminderHour(now: Date): Date | null {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  const hour = kst.getUTCHours();
  if (hour >= 9 && hour < 21) return null;
  if (hour >= 21) kst.setUTCDate(kst.getUTCDate() + 1);
  kst.setUTCHours(9, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60_000);
}

export function koreanMobile(phone: string | null | undefined) {
  const digits = (phone || '').replace(/\D/g, '').replace(/^82(?=10)/, '0');
  return /^010\d{8}$/.test(digits) ? digits : null;
}

export type MatchAlimtalkContext = {
  recipientName: string;
  customerName: string;
  proName: string;
  category: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  requestId: string;
  roomId: string;
  notice: string;
  path: string;
};

// Use the approved template as the source of truth, including button and header variables.
export function matchTemplateVariables(template: unknown, context: MatchAlimtalkContext) {
  const values = new Map<string, string>();
  const alias = (value: string, ...keys: string[]) => keys.forEach(key => values.set(key, value));
  alias(context.recipientName, '이름', '회원명', '닉네임', '수신자명', '수신자이름', 'username', 'name', 'recipientname');
  alias(context.customerName, '고객', '고객명', '고객이름', '고객닉네임', '신청자명', '신청자이름', '신청자', 'customername');
  alias(context.proName, '사회자', '사회자명', '사회자닉네임', '사회자이름', '전문가명', '파트너명', 'proname', 'mcname');
  alias(context.category, '행사명', '행사종류', '행사유형', '카테고리', '문의유형', '신청유형', '서비스유형', 'eventname', 'category');
  alias(context.eventDate, '행사일', '행사날짜', '행사일자', '예식일', '예식일자', 'eventdate');
  alias(context.eventTime, '행사시간', '예식시간', 'eventtime');
  alias([context.eventDate, context.eventTime].filter(Boolean).join(' '), '행사일시', '예식일시', 'eventdatetime');
  alias(context.eventLocation, '행사장소', '예식장소', '장소', '웨딩홀', 'eventlocation');
  alias(context.requestId, '요청번호', '신청번호', '접수번호', '요청id', '신청id', 'requestid', 'matchrequestid');
  alias(context.roomId, '채팅방id', '채팅방번호', 'roomid', 'chatroomid');
  alias(context.notice, '메시지', '메세지', '내용', 'message');
  alias('프리티풀', '서비스명', '브랜드명', 'servicename');
  const linkKeys = new Set(['url', 'link', '링크', '바로가기', '바로가기url', '버튼링크', '버튼url', '채팅링크', '채팅방링크', '채팅url', '채팅방url', '요청링크', '견적링크', '상세url']);
  const variables: Record<string, string> = {};
  const unknown = new Set<string>();
  const visit = (part: unknown) => {
    if (typeof part === 'string') {
      for (const match of part.matchAll(/#\{([^{}]+)\}/g)) {
        const [placeholder, key] = match;
        const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
        const prefix = part.slice(0, match.index);
        const value = linkKeys.has(normalized)
          ? /https?:\/\/(?:www\.)?freetiful\.com\/?$/i.test(prefix)
            ? (prefix.endsWith('/') ? context.path.slice(1) : context.path)
            : /https?:\/\/$/i.test(prefix)
              ? `freetiful.com${context.path}`
              : `https://freetiful.com${context.path}`
          : values.get(normalized);
        const clean = value?.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 200);
        if (!clean || (variables[placeholder] !== undefined && variables[placeholder] !== clean)) unknown.add(placeholder);
        else variables[placeholder] = clean;
      }
    } else if (Array.isArray(part)) part.forEach(visit);
    else if (part && typeof part === 'object') Object.values(part).forEach(visit);
  };
  visit(template);
  return { variables, unknown: [...unknown] };
}
