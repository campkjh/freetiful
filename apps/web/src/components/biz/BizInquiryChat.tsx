'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import BubbleTail, { TAIL_CORNER_CLASS } from '@/components/chat/BubbleTail';
import { ArrowBackIcon, PlusIcon, DocumentIcon } from '@/components/icons/chat';
import { ChevronRightIcon, CheckIcon } from '@/components/icons/mono';
import { useBizLang, useT, type BizLangCode, type Translations } from '@/lib/biz/i18n';
import { popItemDelay } from '@/lib/pop-menu';
import { useTabEntrance } from '@/lib/hooks/useTabEntrance';
import BizInquiryPros, { cleanPicked, isMcInquiry, prefetchBizInquiryPros, warmBizInquiryPros, type McInquiryKind, type PickedPro } from '@/components/biz/BizInquiryPros';

/*
 * 비즈 상담 채팅(/biz/inquiry, 261009 사장 '문의하기 누르면 문의 섹션으로 내려가지 말고, 타임키퍼 키키 상담처럼 —
 * 문의유형을 알려주세요(목록) → 회사명 → 담당자명 → 연락처 → 문의 내용 → 첨부하실 파일이 있으신가요? → 접수가 완료되었습니다.
 * 말풍선은 프리티풀 채팅이랑 똑같이, 애니메이션도').
 *
 *  · 흐름은 타임키퍼 키키 상담(rocketdan support/KikiSupport)처럼 한 단계씩 묻고, 고를 것은 목록 · 칩, 쓸 것은 아래 입력 줄로 받는다.
 *    다만 AI 가 아니라 정해진 질문 순서다(사실만 — 없는 약속 · 숫자를 말하지 않게). 상대는 '프리티풀 비즈'(프로필 = 프리티풀 f 마크).
 *  · 생김새 · 움직임은 프리티풀 채팅방((main)/chat/[id]/page.tsx — 당근식)과 같은 값: 머리줄 h-14 · 뒤로 · 가운데 이름 + 파란 알약 · 부제,
 *    내 말풍선 #3180F7 / 상대 #F2F3F5 · 모서리 20 · 16px/1.4 · 안쪽 16×10, 묶음(같은 사람 연달아)은 프사 첫 줄 · 시간 같은 분 마지막 줄 ·
 *    꼬리(BubbleTail) 마지막 말풍선, 새 말풍선 bubbleGrow(0.42s), 상대 '입력 중' 점 3개(typingDot), 입력 줄 = 회색 알약 + 보내기 아이콘,
 *    칩 줄 = 채팅방 '답장 추천' 줄(pop-menu-item 촤라락), 키보드는 visualViewport 로 컨테이너 바닥을 올린다(채팅방과 같은 계산).
 *    채팅방 파일은 고치지 않고 같은 값을 여기서 다시 쓴다(bubbleGrow keyframes 도 그 파일 안에만 있어 아래 <style> 에 같은 값으로 둔다).
 *  · 보낸 답(회사명 · 담당자명 · 연락처 · 문의 내용 · 문의유형)은 말풍선을 눌러 고칠 수 있다(보내기 전까지). 고치면 그 말풍선이 제자리에서 바뀐다.
 *  · 전송 = POST /api/inquiry FormData(company · name · phone · email(빈 값) · type · message · file) — 기존 /biz 문의 폼과 같은 길.
 *    실패하면 '다시 보내기'. 접수 뒤엔 sessionStorage 에 완료를 남겨 새로 고침해도 다시 보내지 않고 접수 화면을 그대로 보여 준다(30분).
 *    중간에 새로 고침하면 쓰던 답까지 이어서(첨부 파일은 브라우저가 다시 줄 수 없어 파일 질문부터 다시).
 *  · 첨부는 4MB 까지 — 웹은 Vercel 함수라 요청 본문이 4.5MB 를 넘으면 문의 전체가 413 으로 실패한다(10MB 로 안내하면 큰 파일은 접수가 통째로 안 됨).
 *  · 사회자 고르기(261009 사장 '사회자섭외 부분 누르면 사회자 리스트 주르륵 나오게끔') — 기업행사 · 결혼식 사회자 섭외 · 축제 · 체육대회를 고르면
 *    유형 다음에 'pros' 단계: '이런 사회자들이 함께해요 · 원하는 분을 골라 주세요(여러 명 가능)' 말풍선 아래 사회자 카드 가로 줄(BizInquiryPros) → 칩 '선택 완료(N명)' · '아직 모르겠어요'.
 *    고른 사람은 내 말풍선 '희망 사회자: 이름, 이름'으로 쌓이고(눌러서 다시 고르기), 접수 때 message 맨 앞에 '[희망 사회자] 이름(프로필 id), …' 줄로 붙는다
 *    (서버 /api/inquiry 는 그대로 — message 로만). 고르는 중인 사람(pick)도 저장본에 남겨 사회자 상세에 다녀와도 그대로.
 */

const STEPS = ['type', 'pros', 'company', 'name', 'phone', 'message', 'file'] as const;
type Step = (typeof STEPS)[number];
/** 이 문의유형에서 묻는 순서 — 'pros'(사회자 고르기)는 사회자 섭외 유형(기업행사 · 결혼식 · 축제 · 체육대회)만 */
const flowOf = (type: InquiryType | null): Step[] => STEPS.filter((s) => s !== 'pros' || isMcInquiry(type));
/** unsure = 보내는 중에 새로 고침 · 화면을 떠났다 돌아옴 — 서버는 이미 접수했을 수 있어 첨부 질문부터 그냥 다시 묻지 않는다(같은 문의 두 번 방지) */
type Phase = Step | 'sending' | 'failed' | 'unsure' | 'done';
const isStep = (p: unknown): p is Step => typeof p === 'string' && (STEPS as readonly string[]).includes(p);
const TEXT_STEPS: readonly Step[] = ['company', 'name', 'phone', 'message'];
const isTextStep = (p: unknown): p is Step => isStep(p) && TEXT_STEPS.includes(p);

/** 문의유형 — 값은 /api/inquiry · 어드민 라벨(admin/inquiries)과 같은 것만 */
const INQUIRY_TYPES = ['wedding-hall', 'enterprise', 'festival', 'wedding', 'partnership', 'other'] as const;
type InquiryType = (typeof INQUIRY_TYPES)[number];
const TYPE_LABEL: Record<InquiryType, Translations> = {
  'wedding-hall': { ko: '웨딩홀 전속 사회자 제휴', en: 'Resident MC partnership for wedding halls', ja: '式場専属司会者の提携', zh: '婚礼堂专属主持合作' },
  enterprise: { ko: '기업행사 사회자 섭외', en: 'MC for a corporate event', ja: '企業イベントの司会者手配', zh: '企业活动主持人预约' },
  festival: { ko: '축제 · 체육대회', en: 'Festival / Sports day', ja: 'フェスティバル / 体育大会', zh: '节庆 / 体育赛事' },
  wedding: { ko: '결혼식 사회자 섭외', en: 'Wedding MC booking', ja: '結婚式司会者の依頼', zh: '婚礼主持人预约' },
  partnership: { ko: '제휴 · 파트너십', en: 'Partnership', ja: '提携 / パートナーシップ', zh: '合作 / 合作伙伴' },
  other: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' },
};
const isInquiryType = (v: unknown): v is InquiryType => typeof v === 'string' && (INQUIRY_TYPES as readonly string[]).includes(v);
/** 회사가 당연히 있는 유형 — 이때만 회사명 '개인 문의예요' 칩을 안 보이고 꼭 받는다 */
const needsCompany = (type: InquiryType | null) => type === 'wedding-hall' || type === 'enterprise';

const MAX_FILE_MB = 4;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

type BotKey = 'greet' | Step | 'fileTooBig' | 'failed' | 'unsure' | 'done';
type FailKind = 'net' | 'server';
/** qt = 그 질문을 할 때의 문의유형 — 나중에 유형을 고쳐도 지나간 질문('웨딩홀 이름을 알려주세요')이 바뀌지 않게(그 밑의 답과 어긋나 보였다) */
type BotMsg = { id: string; from: 'bot'; key: BotKey; at: number; fail?: FailKind; qt?: InquiryType | null };
type MeMsg = { id: string; from: 'me'; step: Step; at: number; fileName?: string; fileSize?: number };
type Msg = BotMsg | MeMsg;
/** pros = 고른 희망 사회자(선택 완료), prosSkipped = '아직 모르겠어요' */
type Answers = { type: InquiryType | null; pros: PickedPro[]; prosSkipped: boolean; company: string; companySkipped: boolean; name: string; phone: string; message: string };
const EMPTY_ANSWERS: Answers = { type: null, pros: [], prosSkipped: false, company: '', companySkipped: false, name: '', phone: '', message: '' };

/* ───────────── 문구(4개 언어) ───────────── */

const S = {
  back: { ko: '뒤로', en: 'Back', ja: '戻る', zh: '返回' },
  title: { ko: '프리티풀 비즈', en: 'Freetiful Business', ja: 'Freetiful ビジネス', zh: 'Freetiful 企业服务' },
  pill: { ko: '상담', en: 'Chat', ja: '相談', zh: '咨询' },
  sub: { ko: '접수 후 영업일 1~2일 내 연락드려요', en: 'We reply within 1–2 business days', ja: '受付後、営業日1~2日以内にご連絡します', zh: '提交后 1~2 个工作日内与您联系' },
  introSub: { ko: '웨딩홀 · 기업행사 사회자 상담', en: 'MCs for wedding halls & corporate events', ja: '式場・企業イベント司会者のご相談', zh: '婚礼堂 · 企业活动主持咨询' },
  editHint: { ko: '보낸 답을 누르면 고칠 수 있어요', en: 'Tap an answer to edit it', ja: '送った回答をタップすると修正できます', zh: '点击已发送的回答即可修改' },
  editing: { ko: '고치는 중', en: 'Editing', ja: '修正中', zh: '修改中' },
  cancel: { ko: '취소', en: 'Cancel', ja: 'キャンセル', zh: '取消' },
  editAria: { ko: '눌러서 고치기', en: 'Tap to edit', ja: 'タップして修正', zh: '点击修改' },
  send: { ko: '보내기', en: 'Send', ja: '送信', zh: '发送' },
  attach: { ko: '파일 첨부', en: 'Attach a file', ja: 'ファイル添付', zh: '添加附件' },
  skipCompany: { ko: '개인 문의예요', en: "It's a personal inquiry", ja: '個人のお問合せです', zh: '个人咨询' },
  pickFile: { ko: '파일 선택', en: 'Choose a file', ja: 'ファイルを選択', zh: '选择文件' },
  noFile: { ko: '없어요', en: 'No file', ja: 'ありません', zh: '没有' },
  retry: { ko: '다시 보내기', en: 'Send again', ja: '再送信', zh: '重新发送' },
  again: { ko: '다시 문의하기', en: 'New inquiry', ja: 'もう一度お問合せ', zh: '再次咨询' },
  typingAria: { ko: '입력 중', en: 'Typing', ja: '入力中', zh: '正在输入' },
  logAria: { ko: '상담 대화', en: 'Conversation', ja: '相談の会話', zh: '咨询对话' },
  typeListAria: { ko: '문의유형', en: 'Inquiry types', ja: 'お問合せの種類', zh: '咨询类型' },
  home: { ko: '비즈 홈으로', en: 'Business home', ja: 'ビジネスホームへ', zh: '返回企业首页' },
  // 입력 칸 안내
  phType: { ko: '위 목록에서 골라 주세요', en: 'Pick one from the list above', ja: '上のリストから選んでください', zh: '请从上方列表中选择' },
  phTypeEdit: { ko: '위에서 문의유형을 다시 골라 주세요', en: 'Pick the inquiry type again above', ja: '上で種類を選び直してください', zh: '请在上方重新选择咨询类型' },
  phCompany: { ko: '회사명', en: 'Company name', ja: '会社名', zh: '公司名称' },
  phHall: { ko: '웨딩홀 이름', en: 'Wedding hall name', ja: '式場名', zh: '婚礼堂名称' },
  phName: { ko: '담당자명', en: 'Contact name', ja: 'ご担当者名', zh: '联系人姓名' },
  phMessage: { ko: '문의 내용', en: 'Your message', ja: 'お問合せ内容', zh: '咨询内容' },
  // 일본어는 360 에서 끝이 잘려 짧게(261009 검증)
  phPros: { ko: '위에서 사회자를 골라 주세요', en: 'Pick MCs from the cards above', ja: '上で司会者を選んでください', zh: '请在上方选择主持人' },
  // 일본어는 360 · 390 입력 칸(256 · 286px)을 넘어 끝이 잘려 짧게(261009 검증)
  phFile: { ko: "파일을 고르거나 '없어요'를 눌러 주세요", en: "Choose a file or tap 'No file'", ja: 'ファイルを選ぶか「ありません」', zh: '请选择文件或点击“没有”' },
  phSending: { ko: '보내는 중…', en: 'Sending…', ja: '送信中…', zh: '发送中…' },
  phFailed: { ko: "'다시 보내기'를 눌러 주세요", en: "Tap 'Send again'", ja: '「再送信」を押してください', zh: '请点击“重新发送”' },
  phWait: { ko: '메시지 보내기', en: 'Message', ja: 'メッセージ', zh: '发送消息' },
  // 잘못 쓴 답
  errCompany: { ko: '회사명을 입력해 주세요', en: 'Please enter your company name', ja: '会社名を入力してください', zh: '请输入公司名称' },
  errHall: { ko: '웨딩홀 이름을 입력해 주세요', en: 'Please enter the wedding hall name', ja: '式場名を入力してください', zh: '请输入婚礼堂名称' },
  errName: { ko: '담당자명을 입력해 주세요', en: 'Please enter the contact name', ja: 'ご担当者名を入力してください', zh: '请输入联系人姓名' },
  errPhone: { ko: '전화번호를 확인해 주세요 (예: 010-1234-5678)', en: 'Please check the phone number (e.g. 010-1234-5678)', ja: '電話番号をご確認ください（例：010-1234-5678）', zh: '请确认电话号码（例：010-1234-5678）' },
  errMessage: { ko: '문의 내용을 입력해 주세요', en: 'Please enter your message', ja: 'お問合せ内容を入力してください', zh: '请输入咨询内容' },
  // 고칠 항목 이름
  fType: { ko: '문의유형', en: 'Inquiry type', ja: 'お問合せ種類', zh: '咨询类型' },
  fPros: { ko: '희망 사회자', en: 'MC picks', ja: '希望司会者', zh: '心仪主持' },
  fCompany: { ko: '회사명', en: 'Company', ja: '会社名', zh: '公司' },
  fHall: { ko: '웨딩홀', en: 'Wedding hall', ja: '式場', zh: '婚礼堂' },
  fName: { ko: '담당자', en: 'Contact', ja: 'ご担当者', zh: '联系人' },
  fPhone: { ko: '연락처', en: 'Phone', ja: '連絡先', zh: '电话' },
  fMessage: { ko: '문의 내용', en: 'Message', ja: 'お問合せ内容', zh: '咨询内容' },
  fFile: { ko: '첨부', en: 'File', ja: '添付', zh: '附件' },
  personal: { ko: '개인 문의', en: 'Personal', ja: '個人', zh: '个人' },
  none: { ko: '없음', en: 'None', ja: 'なし', zh: '无' },
  receipt: { ko: '접수 완료', en: 'Received', ja: '受付完了', zh: '已受理' },
  // 사회자 고르기(261009 사장)
  // 일본어 칩은 360 에서 '選択完了（2名）'가 화면 밖으로 잘려 짧게(261009 검증)
  prosUnsure: { ko: '아직 모르겠어요', en: 'Not sure yet', ja: 'まだ未定', zh: '还没想好' },
  reprosHead: { ko: '희망 사회자 다시 고르기', en: 'Choose your MCs again', ja: '希望の司会者を選び直す', zh: '重新选择心仪主持人' },
} satisfies Record<string, Translations>;

/** 칩 '선택 완료(N명)' */
const prosDoneOf = (n: number): Translations => ({ ko: `선택 완료(${n}명)`, en: `Done (${n})`, ja: `決定（${n}名）`, zh: `选好了（${n}位）` });
/** 내 말풍선 '희망 사회자: 이름, 이름' */
const prosAnswerOf = (names: string): Translations => ({ ko: `희망 사회자: ${names}`, en: `Preferred MCs: ${names}`, ja: `希望の司会者：${names}`, zh: `心仪的主持人：${names}` });
/** 접수 message 맨 앞 줄 — 어드민 · 메일에서 읽는 줄이라 언어와 상관없이 한국어(이름(프로필 id)) */
const prosMessageLine = (pros: PickedPro[]) => (pros.length ? `[희망 사회자] ${pros.map((p) => `${p.name}(${p.id})`).join(', ')}` : '');

/** 상대(프리티풀 비즈) 말 */
function botTextOf(key: BotKey, type: InquiryType | null, fail: FailKind | undefined): Translations {
  switch (key) {
    case 'greet':
      return {
        ko: '안녕하세요, 프리티풀 비즈예요.\n웨딩홀 전속 사회자 제휴부터 기업행사 사회자 섭외까지 편하게 물어보세요.',
        en: 'Hi, this is Freetiful Business.\nFrom resident MCs for wedding halls to MCs for corporate events — feel free to ask.',
        ja: 'こんにちは、Freetiful ビジネスです。\n式場の専属司会者の提携から企業イベントの司会者手配まで、お気軽にご相談ください。',
        zh: '您好，这里是 Freetiful 企业服务。\n从婚礼堂专属主持合作到企业活动主持人预约，欢迎随时咨询。',
      };
    case 'type':
      return { ko: '문의유형을 알려주세요', en: 'What would you like to ask about?', ja: 'お問合せの種類を教えてください', zh: '请告诉我们咨询类型' };
    case 'pros':
      return {
        // 줄마다 폰 말풍선 한 줄에 들어가게 짧게 — '함께하고 있어요'는 '있어요'만, '마음에 드는 분을 골라 주세요'는 360 에서 '주세요'만
        // 홀로 내려갔다. 괄호 안은 줄이 안 갈리게(390 에서 '(여러 / 명 가능)'으로 갈렸다) 띄어쓰기는 NBSP.
        // 일 · 중은 띄어쓰기가 없어 아무 글자에서나 갈린다 — 말 덩어리('選んでください' · '在籍中です' · '主持人')를 낱자 사이 WORD JOINER 로 묶어
        // 줄 끝 'ます' · 'い' 만 홀로 떨어지지 않게(261009 검증, 일본어 360). 일본어 둘째 줄은 360 말풍선 한 줄(12자)에 들어가게 '好きな方を…'
        ko: '이런 사회자들이 함께해요\n원하는 분을 골라 주세요 (여러\u00A0명\u00A0가능)',
        en: 'Meet some of our MCs.\nPick any you like (several\u00A0is\u00A0fine).',
        ja: 'こんな\u2060司\u2060会\u2060者\u2060が在\u2060籍\u2060中\u2060で\u2060す\n好\u2060き\u2060な\u2060方\u2060を選\u2060ん\u2060で\u2060く\u2060だ\u2060さ\u2060い（\u2060複\u2060数\u2060選\u2060択\u2060可\u2060）',
        zh: '这些\u2060主\u2060持\u2060人\u2060与\u2060我\u2060们\u2060合\u2060作\n请选择您喜欢的\u2060主\u2060持\u2060人（\u2060可\u2060多\u2060选\u2060）',
      };
    case 'company':
      if (type === 'wedding-hall') return { ko: '웨딩홀 이름을 알려주세요', en: 'What is the name of your wedding hall?', ja: '式場名を教えてください', zh: '请告诉我们婚礼堂名称' };
      if (needsCompany(type)) return { ko: '회사명을 알려주세요', en: 'What is your company name?', ja: '会社名を教えてください', zh: '请告诉我们公司名称' };
      return {
        ko: '회사명을 알려주세요\n개인 문의라면 건너뛰셔도 돼요.',
        en: "What is your company name?\nIf it's a personal inquiry, you can skip this.",
        ja: '会社名を教えてください\n個人のお問合せならスキップしても大丈夫です。',
        zh: '请告诉我们公司名称\n如果是个人咨询，可以跳过。',
      };
    case 'name':
      return { ko: '담당자명을 알려주세요', en: "What is the contact person's name?", ja: 'ご担当者名を教えてください', zh: '请告诉我们联系人姓名' };
    case 'phone':
      return { ko: '연락처는 어떻게 되시나요?', en: 'What phone number can we reach you at?', ja: 'ご連絡先の電話番号を教えてください', zh: '请问您的联系电话是？' };
    case 'message':
      if (type === 'wedding-hall') return {
        ko: '문의 내용을 입력해 주세요\n웨딩홀 위치와 원하시는 운영 방식을 함께 적어 주시면 좋아요.',
        en: "Please tell us about your inquiry.\nIt helps to include the hall's location and how you'd like it to run.",
        ja: 'お問合せ内容を入力してください\n式場の所在地とご希望の運営方法も書いていただけると助かります。',
        zh: '请输入咨询内容\n如能一并写上婚礼堂位置和希望的合作方式就更好了。',
      };
      if (type === 'enterprise' || type === 'festival') return {
        ko: '문의 내용을 입력해 주세요\n행사 날짜 · 장소 · 규모를 함께 적어 주시면 좋아요.',
        en: 'Please tell us about your inquiry.\nIt helps to include the event date, venue and size.',
        ja: 'お問合せ内容を入力してください\nイベントの日程・会場・規模も書いていただけると助かります。',
        zh: '请输入咨询内容\n如能一并写上活动日期、地点和规模就更好了。',
      };
      if (type === 'wedding') return {
        ko: '문의 내용을 입력해 주세요\n예식 날짜와 웨딩홀을 함께 적어 주시면 좋아요.',
        en: 'Please tell us about your inquiry.\nIt helps to include the wedding date and venue.',
        ja: 'お問合せ内容を入力してください\n挙式日と式場も書いていただけると助かります。',
        zh: '请输入咨询内容\n如能一并写上婚礼日期和婚礼堂就更好了。',
      };
      return { ko: '문의 내용을 입력해 주세요', en: 'Please tell us about your inquiry.', ja: 'お問合せ内容を入力してください', zh: '请输入咨询内容' };
    case 'file':
      return {
        ko: `첨부하실 파일이 있으신가요?\n행사 기획안 · 큐시트 등 ${MAX_FILE_MB}MB 이하 파일 1개를 보낼 수 있어요.`,
        en: `Do you have a file to attach?\nYou can send one file up to ${MAX_FILE_MB}MB, such as an event plan or cue sheet.`,
        ja: `添付するファイルはありますか？\n企画書・キューシートなど ${MAX_FILE_MB}MB 以下のファイルを1つ送れます。`,
        zh: `有需要附上的文件吗？\n可发送 1 个 ${MAX_FILE_MB}MB 以下的文件，如活动策划案、流程表等。`,
      };
    case 'fileTooBig':
      return {
        ko: `${MAX_FILE_MB}MB가 넘는 파일은 보낼 수 없어요.\n더 작은 파일을 고르시거나 '없어요'를 눌러 주세요.`,
        en: `Files over ${MAX_FILE_MB}MB can't be sent.\nPlease choose a smaller file or tap 'No file'.`,
        ja: `${MAX_FILE_MB}MB を超えるファイルは送れません。\n小さいファイルを選ぶか「ありません」を押してください。`,
        zh: `超过 ${MAX_FILE_MB}MB 的文件无法发送。\n请选择更小的文件或点击“没有”。`,
      };
    case 'failed':
      if (fail === 'net') return {
        ko: '인터넷 연결이 불안정해 접수하지 못했어요.\n연결을 확인하고 다시 보내 주세요.',
        en: "We couldn't receive it because the connection is unstable.\nPlease check your connection and send again.",
        ja: '接続が不安定なため受付できませんでした。\n接続をご確認のうえ再送信してください。',
        zh: '网络连接不稳定，未能受理。\n请检查网络后重新发送。',
      };
      return {
        ko: '앗, 지금은 접수하지 못했어요.\n잠시 후 다시 보내 주세요.',
        en: "Sorry, we couldn't receive it just now.\nPlease try again in a moment.",
        ja: '申し訳ありません、ただいま受付できませんでした。\nしばらくしてから再送信してください。',
        zh: '抱歉，暂时未能受理。\n请稍后重新发送。',
      };
    case 'unsure':
      return {
        ko: '보내던 문의가 이미 접수됐을 수도 있어요.\n같은 문의가 두 번 들어가지 않게, 영업일 1~2일 안에 연락이 없을 때 다시 보내 주세요.',
        en: 'Your inquiry may already have been received.\nTo avoid a duplicate, please send it again only if we haven’t contacted you within 1–2 business days.',
        ja: '送信中だったお問合せは、すでに受け付けられている可能性があります。\n重複を避けるため、営業日1~2日以内にご連絡がない場合に再送信してください。',
        zh: '您刚才发送的咨询可能已被受理。\n为避免重复，如 1~2 个工作日内未收到联系，再重新发送即可。',
      };
    case 'done':
      return {
        ko: '접수가 완료되었습니다.\n영업일 기준 1~2일 내 담당자가 연락드릴게요.',
        en: 'Your inquiry has been received.\nWe will get back to you within 1–2 business days.',
        ja: '受付が完了しました。\n営業日1~2日以内に担当者よりご連絡いたします。',
        zh: '已完成受理。\n我们将在 1~2 个工作日内与您联系。',
      };
  }
}

/* ───────────── 작은 도우미 ───────────── */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const coarsePointer = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } };
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** 전화번호 하이픈 — 휴대폰 010-1234-5678 · 서울 02-123-4567 · 지역 031-123-4567 · 대표번호 1588-1234. + 로 시작하면(해외) 숫자만 */
export function formatBizPhone(raw: string): string {
  const s = raw.replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return `+${s.slice(1).replace(/\+/g, '').slice(0, 15)}`;
  const d = s.replace(/\+/g, '').slice(0, 11);
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (/^1[5-9]/.test(d)) return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
export function isValidBizPhone(v: string): boolean {
  if (v.startsWith('+')) { const n = v.replace(/\D/g, '').length; return n >= 8 && n <= 15; }
  const d = v.replace(/\D/g, '');
  if (d.startsWith('02')) return d.length === 9 || d.length === 10;
  if (d.startsWith('010')) return d.length === 11;
  if (d.startsWith('0')) return d.length === 10 || d.length === 11;
  if (/^1[5-9]/.test(d)) return d.length === 8;
  return false;
}

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

const LOCALE: Record<BizLangCode, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };
/** 말풍선 옆 시간 — 채팅방과 같은 'KST 오후 8:43'(한국어 · 영어는 12시간, 일 · 중은 그 나라 표기) */
const fmtTime = (at: number, lang: BizLangCode) =>
  new Date(at).toLocaleTimeString(LOCALE[lang], { hour: 'numeric', minute: '2-digit', hour12: lang === 'ko' || lang === 'en', timeZone: 'Asia/Seoul' });
const fmtDay = (at: number, lang: BizLangCode) =>
  new Date(at).toLocaleDateString(LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
const minuteKey = (at: number) => Math.floor(at / 60_000);
const GROUP_GAP = 3 * 60 * 1000;

/* ───────────── 새로 고침에도 이어지게(sessionStorage) ───────────── */

const STORE_KEY = 'biz-inquiry-chat-v1';
const STORE_TTL = 30 * 60 * 1000;
/** rid = 이 문의의 요청 번호 — 다시 보내기 · 새로 고침 뒤 다시 보내도 같은 번호라 서버(/api/inquiry)가 겹친 요청을 한 번만 처리할 수 있다 */
/** pick = 사회자 줄에서 고르는 중인 사람(선택 완료 전), editPros = 희망 사회자를 다시 고르는 중 — 사회자 상세에 다녀와도 그대로(261009 사장) */
type Stored = { v: 1; savedAt: number; msgs: Msg[]; answers: Answers; phase: Phase; rid?: string; pick?: PickedPro[]; editPros?: boolean };

function readStore(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || s.v !== 1 || !Array.isArray(s.msgs) || !s.msgs.length || Date.now() - s.savedAt > STORE_TTL) return null;
    if (!s.answers || (s.answers.type !== null && !isInquiryType(s.answers.type))) return null;
    // 사회자 고르기 전(예전) 저장본에도 맞게 — 모양이 어긋난 고른 사람은 버린다
    s.answers = { ...EMPTY_ANSWERS, ...s.answers, pros: cleanPicked(s.answers.pros), prosSkipped: s.answers.prosSkipped === true };
    s.pick = cleanPicked(s.pick);
    return s;
  } catch {
    return null;
  }
}
function writeStore(s: Omit<Stored, 'v' | 'savedAt'>) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...s })); } catch { /* 저장 불가(사생활 모드 등)는 무시 */ }
}
function clearStore() {
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* noop */ }
}

/** 상대 프로필 — 프리티풀 f 마크(app/icon.svg 와 같은 도형) */
function BizBotAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
      style={{ width: size, height: size, boxShadow: 'inset 0 0 0 1px #EEF0F3' }}
    >
      <svg width={size} height={size} viewBox="-4.2 -4.1 24.4 24.4" fill="none">
        <path
          d="M7.64696 10.8332C7.62831 10.8719 7.63781 10.9137 7.63781 10.9537C7.63781 11.6777 7.63781 12.4018 7.63781 13.1258C7.63867 13.3076 7.59352 13.4867 7.50656 13.6464C7.40067 13.8395 7.23644 13.9941 7.03739 14.088C6.83834 14.182 6.61468 14.2105 6.39844 14.1695C6.18221 14.1284 5.9845 14.02 5.83363 13.8596C5.68275 13.6993 5.58646 13.4953 5.55854 13.2768C5.55222 13.2245 5.54893 13.172 5.54871 13.1193C5.54871 11.4187 5.54362 9.71803 5.5504 8.01739C5.55312 7.25242 5.84037 6.60046 6.39316 6.07035C6.70721 5.76932 7.07517 5.55177 7.4757 5.38615C7.87752 5.22393 8.29749 5.111 8.72644 5.04982C9.1364 4.99068 9.5501 4.9613 9.9643 4.96192C10.2343 4.96411 10.4929 5.07092 10.6858 5.25992C10.8788 5.44891 10.991 5.70538 10.9989 5.97543C11.0069 6.24549 10.9099 6.50812 10.7284 6.70815C10.547 6.90817 10.2951 7.03003 10.0257 7.04811C9.91309 7.05422 9.80016 7.05422 9.68655 7.05829C9.30239 7.06703 8.92069 7.12218 8.54975 7.22255C8.39347 7.26536 8.24216 7.32463 8.09836 7.39937C8.02167 7.43973 7.94909 7.48747 7.88165 7.54191C7.72327 7.66986 7.63272 7.83242 7.63408 8.03979C7.63319 8.09647 7.63591 8.15314 7.64221 8.20948C7.66295 8.36046 7.74061 8.49779 7.85926 8.59332C7.99973 8.70789 8.16093 8.7943 8.33406 8.84786C8.59516 8.93492 8.86872 8.97871 9.14392 8.9775C9.19649 8.9775 9.24906 8.96969 9.30162 8.9663C9.7537 8.93508 10.1088 9.10545 10.3313 9.50219C10.4098 9.6426 10.4548 9.79933 10.4626 9.96008C10.4705 10.1208 10.4409 10.2812 10.3763 10.4286C10.3118 10.576 10.2139 10.7064 10.0904 10.8095C9.96697 10.9126 9.82129 10.9857 9.66484 11.023C9.56575 11.0456 9.46463 11.0583 9.36301 11.0606C9.11415 11.0731 8.86471 11.0663 8.6169 11.0403C8.31776 11.0064 8.02251 10.9441 7.73514 10.8543C7.70744 10.8415 7.67746 10.8343 7.64696 10.8332Z"
          fill="#0B58FF"
        />
        <path
          d="M6.40774 4.85992C5.6718 4.87315 4.99963 4.26057 5.00065 3.45182C4.99493 3.26318 5.02714 3.07531 5.09537 2.89936C5.16359 2.72342 5.26644 2.56298 5.39781 2.42757C5.52917 2.29216 5.68638 2.18454 5.86011 2.11109C6.03383 2.03764 6.22053 1.99986 6.40913 2C6.59772 2.00014 6.78436 2.03818 6.95798 2.11188C7.1316 2.18558 7.28865 2.29343 7.41983 2.42903C7.551 2.56463 7.65361 2.72522 7.72158 2.90126C7.78955 3.07731 7.82149 3.26522 7.81551 3.45386C7.81517 4.26159 7.14876 4.87383 6.40774 4.85992Z"
          fill="#00C1FF"
        />
      </svg>
    </span>
  );
}

/** 채팅방 TintIcon 과 같은 마스크 아이콘(보내기 화살표 — 채팅방 입력 줄과 같은 그림 · 같은 색) */
function TintIcon({ src, color, size = 24 }: { src: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundColor: color,
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
        WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        transition: 'background-color .15s ease',
      }}
    />
  );
}

const GROW = 'animate-[bubbleGrow_0.42s_cubic-bezier(0.2,0.9,0.3,1)_both]';
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ───────────── 화면 ───────────── */

export default function BizInquiryChat() {
  const router = useRouter();
  const t = useT();
  const { lang } = useBizLang();
  const entrance = useTabEntrance('biz-inquiry');

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [phase, setPhase] = useState<Phase>('type');
  /** 상대 '입력 중' 점 3개 */
  const [typing, setTyping] = useState(false);
  /** 상대가 다음 말을 준비하는 중(질문이 아직 안 나옴) — 답 보내기만 막는다(입력 칸은 열어 둬 키보드가 내려가지 않게) */
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<Translations | null>(null);
  const [errorTick, setErrorTick] = useState(0);
  const [editing, setEditing] = useState<Step | null>(null);
  /** 사회자 줄에서 고르는 중인 사람 — '선택 완료'를 누르면 answers.pros 로(261009 사장) */
  const [pick, setPick] = useState<PickedPro[]>([]);
  const [ready, setReady] = useState(false); // 저장본을 읽은 뒤부터 저장
  const [headerH, setHeaderH] = useState(72);
  const [footerH, setFooterH] = useState(64);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 이 시각 뒤에 생긴 말풍선만 커지며 나온다(새로 고침으로 되살린 대화는 그냥 보인다) */
  const mountedAt = useRef(0);
  const seqRef = useRef(0);
  const aliveRef = useRef(true);
  const sendingRef = useRef(false);
  const doneRef = useRef(false);
  const fileRef = useRef<File | null>(null);
  const stashRef = useRef('');
  const firstScroll = useRef(true);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  /** 이 문의의 요청 번호(Stored.rid) — 처음 보낼 때 만들고 다시 보내기 · 새로 고침 뒤에도 그대로 쓴다. 다시 문의하기에서만 새로 */
  const ridRef = useRef('');
  /** 사회자 줄을 '주르륵' 흘러 들어오게 틀지 — 질문이 방금 나왔거나 말풍선을 눌러 다시 고를 때만(되살린 화면은 그냥 보인다) */
  const prosAnimRef = useRef(false);

  // 상대 말에는 그때의 문의유형을 같이 남긴다(qt) — 말풍선이 나오는 순간엔 고른 유형이 이미 answersRef 에 들어와 있다(say 의 쉼 동안 다시 그려짐)
  const pushBot = useCallback((key: BotKey, extra?: Partial<BotMsg>) => {
    setMsgs((prev) => [...prev, { id: uid(), from: 'bot', key, at: Date.now(), qt: answersRef.current.type, ...extra }]);
  }, []);

  /** 상대가 말한다 — 잠깐 쉬고 '입력 중' 점 3개 → 말풍선. 여러 개면 차례로. 새 말이 시작되면 앞 순서는 버린다 */
  const say = useCallback(async (items: Array<BotKey | { key: BotKey; extra?: Partial<BotMsg> }>) => {
    const my = ++seqRef.current;
    const quick = reducedMotion();
    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      const it = typeof items[i] === 'string' ? { key: items[i] as BotKey } : (items[i] as { key: BotKey; extra?: Partial<BotMsg> });
      await sleep(quick ? 0 : i === 0 ? 280 : 180);
      if (seqRef.current !== my || !aliveRef.current) return;
      setTyping(true);
      await sleep(quick ? 120 : it.key === 'greet' ? 900 : 680);
      if (seqRef.current !== my || !aliveRef.current) return;
      setTyping(false);
      pushBot(it.key, it.extra);
    }
    setBusy(false);
  }, [pushBot]);

  // 처음 — 저장본이 있으면 이어서, 없으면 인사부터
  useEffect(() => {
    aliveRef.current = true;
    mountedAt.current = Date.now();
    const saved = readStore();
    if (saved) {
      setMsgs(saved.msgs);
      setAnswers({ ...EMPTY_ANSWERS, ...saved.answers });
      ridRef.current = typeof saved.rid === 'string' ? saved.rid : '';
      // 사회자 상세에 다녀옴 — 고르던 사람 · 다시 고르던 중인지 그대로(줄 위치는 BizInquiryPros 가 되살린다)
      setPick(saved.pick || []);
      if (saved.editPros && saved.phase !== 'done' && saved.phase !== 'sending' && saved.phase !== 'unsure') setEditing('pros');
      const last = saved.msgs[saved.msgs.length - 1];
      if (saved.phase === 'done') {
        doneRef.current = true;
        setPhase('done');
        setBusy(false);
      } else if (saved.phase === 'sending' || saved.phase === 'unsure') {
        // 보내는 중에 새로 고침 — 앞 요청이 서버에서 이미 처리됐을 수 있다(메일 · DB 한 번 더 들어가던 것).
        // 첨부 질문부터 그냥 다시 묻지 않고 '접수됐을 수 있어요' 안내 + 다시 보내기(고를 때만 첨부 질문부터)로(261009 검증)
        setPhase('unsure');
        if (last && last.from === 'bot' && last.key === 'unsure') setBusy(false);
        else void say(['unsure']);
      } else {
        // 실패에서 새로 고침 = 파일을 다시 받아야 한다(브라우저가 File 을 되살려 주지 않는다)
        let next: Step = isStep(saved.phase) ? saved.phase : 'file';
        // 사회자 고르기는 사회자 섭외 유형에서만 — 어긋난 저장본이면 다음 질문(회사명)으로
        if (next === 'pros' && !isMcInquiry(saved.answers.type)) next = 'company';
        setPhase(next);
        if (last && last.from === 'bot' && last.key === next) setBusy(false);
        else {
          if (next === 'pros') prosAnimRef.current = true; // 질문을 새로 하는 거라 줄도 새로 주르륵
          void say([next]);
        }
      }
    } else {
      setPhase('type');
      void say(['greet', 'type']);
    }
    setReady(true);
    // 사회자 목록 · 매칭 제외 명단을 미리 받아 둔다 — 사회자 섭외를 고를 즈음엔 와 있게(홈 · /pros 와 같은 캐시).
    // 접수 완료 화면을 되살렸거나 이미 사회자 섭외가 아닌 유형으로 진행 중이면 받지 않는다(유형을 고쳐 섭외로 바꾸면 줄이 그때 받는다, 261009 검증)
    const warmNeeded = !saved || (saved.phase !== 'done' && (saved.answers.type === null || isMcInquiry(saved.answers.type)));
    const warm = warmNeeded ? window.setTimeout(prefetchBizInquiryPros, 600) : 0;
    return () => {
      aliveRef.current = false;
      seqRef.current++;
      window.clearTimeout(warm);
    };
  }, [say]);

  // 쓰는 대로 저장(새로 고침 · 실수로 뒤로가기에도 이어지게)
  useEffect(() => {
    if (!ready || !msgs.length) return;
    writeStore({ msgs, answers, phase, rid: ridRef.current || undefined, pick, editPros: editing === 'pros' || undefined });
  }, [ready, msgs, answers, phase, pick, editing]);

  // 키보드 — 채팅방과 같은 계산: 보이는 영역(visualViewport)만큼 컨테이너 바닥을 올려 입력 줄이 키보드 위에 붙게(iOS · 안드 웹뷰 공통)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(next);
      if (next > 0) {
        const c = scrollRef.current;
        if (c) requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // 머리줄 · 입력 줄 높이 — 대화 칸 위아래 여백(칩 줄 · 고치는 중 띠가 붙었다 떨어져도 마지막 말이 안 가리게)
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      if (footerRef.current) setFooterH(footerRef.current.offsetHeight);
    });
    if (headerRef.current) ro.observe(headerRef.current);
    if (footerRef.current) ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  // 새 말 · 점 3개 · 칩이 생기면 맨 아래로(처음 · 되살린 대화는 바로)
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const instant = firstScroll.current || reducedMotion();
    firstScroll.current = false;
    requestAnimationFrame(() => c.scrollTo({ top: c.scrollHeight, behavior: instant ? 'auto' : 'smooth' }));
  }, [msgs.length, typing, busy, phase, footerH, headerH]);

  // 입력 칸 높이 — 채팅방처럼 쓰는 만큼 늘다가 120 에서 멈춘다
  const activeStep: Step | null = editing ?? (isStep(phase) ? phase : null);
  const textActive = isTextStep(activeStep);
  useIsoLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft, activeStep]);

  // PC 는 질문이 나오면 입력 칸에 바로 초점(폰은 키보드가 갑자기 올라오지 않게 — 이미 열려 있으면 그대로 이어서 쓴다)
  useEffect(() => {
    if (busy || editing || !isTextStep(phase) || coarsePointer()) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [busy, phase, editing]);

  /* ── 답 ── */

  /** 다음 질문 — type 을 주면 그 유형의 순서로(유형을 고른 바로 그 순간엔 answersRef 가 아직 옛 값이다) */
  const nextOf = (s: Step, type: InquiryType | null = answersRef.current.type): Step | null => {
    const flow = flowOf(type);
    const i = flow.indexOf(s);
    return i >= 0 ? flow[i + 1] ?? null : null;
  };

  const showError = (e: Translations) => {
    setError(e);
    setErrorTick((n) => n + 1);
  };

  /**
   * 보낸 뒤에도 입력 칸 초점을 지킨다 — 다음(또는 돌아갈) 단계가 글 단계면 같은 누름 안에서 다시 초점을 준다
   * (프리티풀 채팅방 handleSend 의 inputRef.focus() 와 같은 방식. 예전엔 보내기 단추가 초점을 가져간 뒤 비활성이 되며
   *  초점이 body 로 떨어져 폰 키보드가 회사명 → 담당자명 → 연락처마다 내려갔다, 261009 검증).
   * keep=false 면 PC 만 — 폰에서 닫혀 있던 키보드를 갑자기 올리지 않게(칩을 누른 경우 등)
   */
  const keepFocus = (next: Step | null, keep: boolean) => {
    if (!isTextStep(next)) return;
    if (!keep && coarsePointer()) return;
    inputRef.current?.focus({ preventScroll: true });
  };
  const inputFocused = () => typeof document !== 'undefined' && !!inputRef.current && document.activeElement === inputRef.current;

  /** 웨딩홀 · 기업행사인데 회사명(웨딩홀 이름)이 비어 있는지 — 유형을 바꾼 뒤 회사명을 다시 묻는 중이거나 그걸 빠져나간 경우 */
  const companyMissing = () => {
    const a = answersRef.current;
    return needsCompany(a.type)
      && (a.companySkipped || !a.company.trim())
      && msgsRef.current.some((m) => m.from === 'me' && m.step === 'company');
  };
  const companyErr = () => (answersRef.current.type === 'wedding-hall' ? S.errHall : S.errCompany);
  /** 보내기 직전 확인 — 회사명이 비었으면 보내지 않고 회사명 입력으로 돌린다('개인 문의'로 접수되지 않게) */
  const blockIfCompanyMissing = (): boolean => {
    if (!companyMissing()) return false;
    startEdit('company');
    showError(companyErr());
    return true;
  };

  /** 고친 답 말풍선을 한 번 톡 — 제자리에서 바뀐 걸 알게 */
  const pulseAnswer = (step: Step) => {
    requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>(`[data-answer="${step}"]`);
      const el = els[els.length - 1];
      if (!el || reducedMotion() || typeof el.animate !== 'function') return;
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(0.2,0.9,0.3,1)' });
    });
  };

  /** 이 유형 순서에서 아직 답하지 않은 첫 단계(문의유형 · skip 은 빼고) — 없으면 첨부(다시 보내기 자리, resendUnsure 와 같음) */
  const resumeStep = (type: InquiryType | null, skip: readonly Step[] = []): Step => {
    const answered = new Set(msgsRef.current.filter((m): m is MeMsg => m.from === 'me').map((m) => m.step));
    return flowOf(type).find((s) => s !== 'type' && !skip.includes(s) && !answered.has(s)) ?? 'file';
  };

  /** nextStep = 다음 질문을 정해서 줄 때(사회자 고르기를 중간에 끼워 넣은 뒤 하던 단계로 돌아가기 등) */
  const answer = (step: Step, patch: Partial<Answers>, extra?: Partial<MeMsg>, nextStep?: Step | null) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setMsgs((prev) => [...prev, { id: uid(), from: 'me', step, at: Date.now(), ...extra }]);
    // 사회자 고르기는 칩으로 답해 입력 칸 글과 상관없다 — 중간에 끼워 넣은 경우 쓰던 회사명 등이 지워지지 않게
    if (step !== 'pros') setDraft('');
    setError(null);
    const nx = nextStep !== undefined ? nextStep : nextOf(step, patch.type !== undefined ? patch.type : answersRef.current.type);
    if (nx) {
      if (nx === 'pros') prosAnimRef.current = true;
      setPhase(nx);
      void say([nx]);
    }
  };

  const pickType = (type: InquiryType) => {
    if (editing === 'type') {
      setAnswers((a) => ({ ...a, type }));
      setEditing(null);
      setDraft(stashRef.current);
      pulseAnswer('type');
      const prosAnswered = msgsRef.current.some((m) => m.from === 'me' && m.step === 'pros');
      // 사회자 섭외가 아닌 유형으로 시작했다가(또는 고르는 중에 비섭외로 바꿨다가) 사회자 섭외로 바꿨는데 아직 사회자를 안 골랐으면
      // 사회자 질문을 지금 끼워 넣는다 — 고르고 나면 하던 단계로 돌아간다(resumeStep). 예전엔 카드가 끝까지 안 나오고
      // 진행 막대도 100% 에 못 닿았다(261009 검증). 회사명을 다시 받아야 하는 경우는 사회자를 고른 뒤에 묻는다(finishPros)
      if (isMcInquiry(type) && !prosAnswered && phase !== 'pros' && phase !== 'type') {
        setPick([]);
        prosAnimRef.current = true;
        setPhase('pros');
        void say(['pros']);
        return;
      }
      // 웨딩홀 · 기업행사로 바꿨는데 회사명을 '개인 문의'로 건너뛰어 뒀으면 바로 회사명(웨딩홀 이름)을 다시 묻는다 — 접수증에 '개인 문의'로 남지 않게
      const answeredCompany = msgsRef.current.some((m) => m.from === 'me' && m.step === 'company');
      if (needsCompany(type) && answersRef.current.companySkipped && answeredCompany) { startEdit('company', true); return; }
      // 사회자를 고르던 중에 사회자 섭외가 아닌 유형으로 바꿨으면 고르기를 접고 아직 안 한 다음 질문으로(처음이면 회사명,
      // 중간에 끼워 넣은 사회자 질문이었으면 하던 단계 — 이미 답한 회사명을 또 묻지 않게)
      // 섭외 → 섭외(결혼식 → 기업행사 등)는 고른 사람을 그대로 둔다 — 새 줄에 없는 사람은 줄 맨 앞에 같이 보여 뺄 수 있다(BizInquiryPros)
      if (phase === 'pros' && !isMcInquiry(type)) {
        setPick([]);
        const nx = resumeStep(type);
        setPhase(nx);
        void say([nx]);
      }
      return;
    }
    if (phase !== 'type' || busy) return;
    // 사회자 섭외 — 상대 '입력 중' 동안 앞 카드 사진을 미리 받아 둔다
    if (isMcInquiry(type)) warmBizInquiryPros(type);
    answer('type', { type });
  };

  /* ── 사회자 고르기(261009 사장) ── */

  const prosOpen = editing === 'pros' || (!editing && !busy && phase === 'pros');
  // 줄이 닫히면 '주르륵' 표시도 끈다 — 다음에 열릴 땐 질문이 새로 나왔거나 다시 고를 때만 다시 켜진다
  useEffect(() => { if (!prosOpen) prosAnimRef.current = false; }, [prosOpen]);
  // 희망 사회자를 다시 고를 땐 줄이 대화 맨 아래에 열린다 — 그쪽으로 내려 준다
  useEffect(() => {
    if (editing !== 'pros') return;
    const c = scrollRef.current;
    if (c) requestAnimationFrame(() => c.scrollTo({ top: c.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }));
  }, [editing]);
  /** '선택 완료' · '아직 모르겠어요'를 한 번만 — 같은 틱에 두 번 오면(옛 값의 prosOpen 으로) '희망 사회자' 말풍선이 두 개 쌓였다(261009 검증) */
  const prosLockRef = useRef(false);
  useEffect(() => { if (prosOpen) prosLockRef.current = false; }, [prosOpen]);
  const togglePick = (p: PickedPro) => {
    if (!prosOpen || prosLockRef.current) return;
    setPick((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
  };
  /** 사회자 답 — 다시 고르기면 제자리에서 바꾸고, 아니면 말풍선을 붙이고 아직 안 한 다음 단계로(처음이면 회사명) */
  const finishPros = (patch: Pick<Answers, 'pros' | 'prosSkipped'>) => {
    prosLockRef.current = true;
    if (editing === 'pros') {
      setAnswers((a) => ({ ...a, ...patch }));
      setEditing(null);
      setDraft(stashRef.current);
      pulseAnswer('pros');
      return;
    }
    answer('pros', patch, undefined, resumeStep(answersRef.current.type, ['pros']));
    // 유형을 웨딩홀 · 기업행사로 바꾸며 끼워 넣은 사회자 질문이었고 회사명을 '개인 문의'로 건너뛰어 뒀으면 이어서 회사명을 다시 받는다
    if (companyMissing()) startEdit('company', true);
  };
  const confirmPros = () => {
    if (!prosOpen || !pick.length || prosLockRef.current) return;
    finishPros({ pros: pick, prosSkipped: false });
  };
  const skipPros = () => {
    if (!prosOpen || prosLockRef.current) return;
    setPick([]);
    finishPros({ pros: [], prosSkipped: true });
  };

  const skipCompany = () => {
    const keep = inputFocused();
    if (editing === 'company') {
      setAnswers((a) => ({ ...a, company: '', companySkipped: true }));
      setEditing(null);
      setDraft(stashRef.current);
      pulseAnswer('company');
      keepFocus(isStep(phase) ? phase : null, keep);
      return;
    }
    if (phase !== 'company' || busy) return;
    answer('company', { company: '', companySkipped: true });
    keepFocus(nextOf('company'), keep);
  };

  const submitText = () => {
    const step = activeStep;
    if (!isTextStep(step)) return;
    if (busy && !editing) return;
    const raw = draft.trim();
    const v = step === 'message' ? raw : raw.replace(/\s+/g, ' ');
    const type = answersRef.current.type;
    // 잘못 쓴 답도 고쳐 쓰게 키보드는 그대로(초점 유지)
    const fail = (e: Translations) => { showError(e); keepFocus(step, true); };
    let patch: Partial<Answers>;
    if (step === 'company') {
      if (!v) {
        if (needsCompany(type)) { fail(type === 'wedding-hall' ? S.errHall : S.errCompany); return; }
        skipCompany();
        return;
      }
      patch = { company: v.slice(0, 60), companySkipped: false };
    } else if (step === 'name') {
      if (!v) { fail(S.errName); return; }
      patch = { name: v.slice(0, 30) };
    } else if (step === 'phone') {
      const p = formatBizPhone(v);
      if (!isValidBizPhone(p)) { fail(S.errPhone); return; }
      patch = { phone: p };
    } else {
      if (!v) { fail(S.errMessage); return; }
      patch = { message: v.slice(0, 2000) };
    }
    if (editing) {
      setAnswers((a) => ({ ...a, ...patch }));
      setEditing(null);
      setDraft(stashRef.current);
      setError(null);
      pulseAnswer(step);
      keepFocus(isStep(phase) ? phase : null, true);
      return;
    }
    answer(step, patch);
    // 다음이 글 단계(회사명 → 담당자명 → 연락처 → 문의 내용)면 키보드를 내리지 않고 이어서 쓴다. 문의 내용 다음(첨부)은 칩이라 내려간다
    keepFocus(nextOf(step), true);
  };

  /** 보낸 답 말풍선을 누르면 그 답을 다시 입력(보내기 전까지) — 초점은 누른 그 순간에 줘야 폰 키보드가 올라온다(flushSync) */
  const startEdit = (step: Step, keepStash = false) => {
    if (phase === 'sending' || phase === 'done' || step === 'file') return;
    if (!editing && !keepStash) stashRef.current = draft;
    const a = answersRef.current;
    const v = step === 'company' ? (a.companySkipped ? '' : a.company) : step === 'type' || step === 'pros' ? '' : a[step];
    // 희망 사회자 다시 고르기 — 지금 고른 사람부터, 줄은 다시 주르륵
    if (step === 'pros') {
      setPick(a.pros);
      prosAnimRef.current = true;
    }
    flushSync(() => {
      setEditing(step);
      setDraft(v);
      setError(null);
    });
    if (step !== 'type' && step !== 'pros') {
      const el = inputRef.current;
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(v.length, v.length); } catch { /* noop */ }
      }
    }
  };
  const cancelEdit = () => {
    // 웨딩홀 · 기업행사로 바꿔 회사명(웨딩홀 이름)을 다시 묻는 중이면 취소 · Esc · 말풍선 다시 누름으로 빠져나갈 수 없다 —
    // 예전엔 빠져나가면 companySkipped 가 남은 채 회사명 없이 접수되고 접수증에도 '개인 문의'로 찍혔다(261009 검증)
    if (editing === 'company' && companyMissing()) {
      showError(companyErr());
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    // 희망 사회자 다시 고르기 취소 — 고르던 건 버리고 원래 고른 사람으로
    if (editing === 'pros') setPick(answersRef.current.pros);
    setEditing(null);
    setDraft(stashRef.current);
    setError(null);
  };

  // 문의유형 · 희망 사회자를 고칠 땐 입력 칸이 꺼져 있어 textarea 의 Esc 가 안 닿는다 — 화면 어디서든 Esc 로 취소(261009 검증)
  const cancelEditRef = useRef(cancelEdit);
  cancelEditRef.current = cancelEdit;
  useEffect(() => {
    if (editing !== 'type' && editing !== 'pros') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      e.preventDefault();
      cancelEditRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  /* ── 전송 ── */

  /**
   * locked = 부른 쪽(없어요 · 파일 고름)이 이미 sendingRef 를 세웠다 — 그쪽은 내 말풍선을 먼저 붙이므로, 같은 틱에 두 번 눌려도
   * 말풍선이 두 개 쌓이지 않게 붙이기 전에 잠근다(예전엔 '없어요\n없어요'가 쌓이고 전송만 한 번이었다)
   */
  const submit = async (file: File | null, locked = false) => {
    if (doneRef.current || (!locked && sendingRef.current)) return;
    sendingRef.current = true;
    fileRef.current = file;
    if (!ridRef.current) ridRef.current = uid();
    const my = ++seqRef.current;
    const quick = reducedMotion();
    setPhase('sending');
    setBusy(true);
    setEditing(null);
    setError(null);
    await sleep(quick ? 0 : 280);
    if (aliveRef.current && seqRef.current === my) setTyping(true);

    const a = answersRef.current;
    const fd = new FormData();
    fd.append('company', a.companySkipped ? '' : a.company);
    fd.append('name', a.name);
    fd.append('phone', a.phone);
    fd.append('email', '');
    fd.append('type', a.type || 'other');
    // 희망 사회자는 message 맨 앞 줄로(서버 · 어드민은 그대로 — 261009 사장).
    // 사회자 섭외 유형일 때만 — 고른 뒤 유형을 웨딩홀 전속 제휴 · 기타 등으로 바꿨으면 붙이지 않는다(접수증도 같은 조건, 261009 검증).
    // 고른 사람은 지우지 않아 다시 섭외 유형으로 바꾸면 그대로 돌아온다
    const prosLine = isMcInquiry(a.type) ? prosMessageLine(a.pros) : '';
    fd.append('message', prosLine ? `${prosLine}\n\n${a.message}` : a.message);
    // 요청 번호 — 다시 보내기 · 새로 고침 뒤 다시 보내도 같은 번호(서버가 같은 번호를 한 번만 처리)
    fd.append('requestId', ridRef.current);
    if (file) fd.append('file', file);

    const t0 = performance.now();
    let fail: FailKind | 'big' | null = null;
    try {
      const res = await fetch('/api/inquiry', { method: 'POST', body: fd });
      if (!res.ok) fail = res.status === 413 ? 'big' : 'server';
    } catch {
      fail = 'net';
    }
    // 점 3개가 너무 짧게 깜빡이지 않게 — 보내는 느낌이 들 만큼은 둔다
    await sleep(Math.max(0, (quick ? 150 : 1100) - (performance.now() - t0)));
    sendingRef.current = false;

    if (!fail) doneRef.current = true;
    if (!aliveRef.current || seqRef.current !== my) {
      // 접수는 됐는데 그 사이 화면을 떠났으면 완료만 남겨 둔다 — 돌아와도 다시 보내지 않게
      if (!fail) writeStore({ msgs: [...msgsRef.current, { id: uid(), from: 'bot', key: 'done', at: Date.now() }], answers: answersRef.current, phase: 'done', rid: ridRef.current });
      return;
    }
    setTyping(false);
    if (!fail) {
      pushBot('done');
      setPhase('done');
    } else if (fail === 'big') {
      pushBot('fileTooBig');
      setPhase('file');
    } else {
      pushBot('failed', { fail });
      setPhase('failed');
    }
    setBusy(false);
  };

  // 첨부 단계의 누름들 — phase · busy 는 다시 그리기 전까지 옛 값이라 같은 틱의 두 번째 누름을 못 막는다 → sendingRef 로 먼저 잠근다
  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = ''; // 같은 파일을 다시 골라도 change 가 오게
    if (!file || phase !== 'file' || busy || editing || sendingRef.current || doneRef.current) return;
    if (file.size > MAX_FILE_BYTES) {
      void say(['fileTooBig']);
      return;
    }
    if (blockIfCompanyMissing()) return;
    sendingRef.current = true;
    answer('file', {}, { fileName: file.name, fileSize: file.size });
    void submit(file, true);
  };
  const pickFile = () => {
    if (phase !== 'file' || busy || editing || sendingRef.current || doneRef.current) return;
    if (blockIfCompanyMissing()) return;
    fileInputRef.current?.click();
  };
  const noFile = () => {
    if (phase !== 'file' || busy || editing || sendingRef.current || doneRef.current) return;
    if (blockIfCompanyMissing()) return;
    sendingRef.current = true;
    answer('file', {});
    void submit(null, true);
  };
  const retry = () => {
    if (phase !== 'failed' || busy || editing) return;
    if (blockIfCompanyMissing()) return;
    void submit(fileRef.current);
  };
  /** '접수됐을 수 있어요' 뒤 다시 보내기 — 파일은 브라우저가 되살려 주지 않아 첨부 질문부터(요청 번호는 그대로라 서버가 겹친 요청을 거른다) */
  const resendUnsure = () => {
    if (phase !== 'unsure' || busy || editing) return;
    setPhase('file');
    void say(['file']);
  };

  const restart = () => {
    seqRef.current++;
    clearStore();
    doneRef.current = false;
    sendingRef.current = false;
    fileRef.current = null;
    ridRef.current = ''; // 새 문의 = 새 요청 번호
    mountedAt.current = Date.now();
    firstScroll.current = true;
    setMsgs([]);
    setAnswers(EMPTY_ANSWERS);
    setPick([]);
    setEditing(null);
    setDraft('');
    setError(null);
    setTyping(false);
    setPhase('type');
    void say(['greet', 'type']);
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.replace('/biz');
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && editing) { e.preventDefault(); cancelEdit(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return;
    // 한글 조합 중 Enter 는 마지막 글자 맺기라 보내면 글자가 남는다(채팅방과 같은 막음)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // 문의 내용은 여러 줄 — 폰 키보드의 줄바꿈은 줄바꿈 그대로(보내기는 화살표), PC 는 Enter 보내기 · Shift+Enter 줄바꿈(채팅방과 같음)
    if (activeStep === 'message' && coarsePointer()) return;
    e.preventDefault();
    submitText();
  };

  const onDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(activeStep === 'phone' ? formatBizPhone(v) : v);
    if (error) setError(null);
  };

  /* ── 그리기 ── */

  const type = answers.type;
  const answeredSteps = new Set(msgs.filter((m): m is MeMsg => m.from === 'me').map((m) => m.step));
  const flow = flowOf(type);
  const progress = phase === 'done' ? 100 : Math.round((flow.filter((s) => answeredSteps.has(s)).length / flow.length) * 100);
  const lastFileMsg = [...msgs].reverse().find((m): m is MeMsg => m.from === 'me' && m.step === 'file');
  /** 유형을 사회자 섭외가 아닌 것으로 바꾼 뒤 희망 사회자를 다시 고를 때 — 그 질문을 할 때의 유형으로 줄을 보인다 */
  const lastProsQ = [...msgs].reverse().find((m): m is BotMsg => m.from === 'bot' && m.key === 'pros');
  const lastProsKind: McInquiryKind = isMcInquiry(lastProsQ?.qt) ? lastProsQ.qt : 'enterprise';
  const firstEditableIdx = msgs.findIndex((m) => m.from === 'me' && m.step !== 'file');
  const canEdit = phase !== 'sending' && phase !== 'done';

  const answerText = (m: MeMsg): string => {
    switch (m.step) {
      case 'type': return type ? t(TYPE_LABEL[type]) : '';
      case 'pros': return answers.pros.length ? t(prosAnswerOf(answers.pros.map((p) => p.name).join(', '))) : t(S.prosUnsure);
      case 'company': return answers.companySkipped ? t(S.skipCompany) : answers.company;
      case 'name': return answers.name;
      case 'phone': return answers.phone;
      case 'message': return answers.message;
      case 'file': return t(S.noFile);
    }
  };
  const fieldLabel = (s: Step): string => {
    switch (s) {
      case 'type': return t(S.fType);
      case 'pros': return t(S.fPros);
      case 'company': return t(type === 'wedding-hall' ? S.fHall : S.fCompany);
      case 'name': return t(S.fName);
      case 'phone': return t(S.fPhone);
      case 'message': return t(S.fMessage);
      case 'file': return t(S.fFile);
    }
  };

  let placeholder: string;
  if (editing === 'type') placeholder = t(S.phTypeEdit);
  else if (editing === 'pros') placeholder = t(S.phPros);
  else if (activeStep === 'pros') placeholder = busy ? t(S.phWait) : t(S.phPros);
  else if (activeStep === 'company') placeholder = t(type === 'wedding-hall' ? S.phHall : S.phCompany);
  else if (activeStep === 'name') placeholder = t(S.phName);
  else if (activeStep === 'phone') placeholder = '010-1234-5678';
  else if (activeStep === 'message') placeholder = t(S.phMessage);
  else if (activeStep === 'type') placeholder = busy ? t(S.phWait) : t(S.phType);
  else if (activeStep === 'file') placeholder = busy ? t(S.phWait) : t(S.phFile);
  else if (phase === 'sending') placeholder = t(S.phSending);
  else if (phase === 'failed' || phase === 'unsure') placeholder = t(S.phFailed);
  else placeholder = t(S.phWait);

  const canSend = textActive && !!draft.trim() && (!busy || !!editing);

  // 칩 줄(채팅방 '답장 추천' 자리) — 지금 고를 수 있는 것
  type Chip = { key: string; label: string; onClick: () => void; icon?: 'clip'; selected?: boolean; primary?: boolean };
  let chips: Chip[] = [];
  let chipsKey = '';
  if (prosOpen) {
    // 사회자 고르기 — '아직 모르겠어요' 는 늘, '선택 완료(N명)' 는 한 명이라도 고르면 뒤에 붙는다(줄 key 는 그대로라 새 칩만 톡 나온다)
    chipsKey = editing === 'pros' ? 'edit-pros' : 'pros';
    chips = [{ key: 'unsure', label: t(S.prosUnsure), onClick: skipPros }];
    if (pick.length) chips.push({ key: 'done', label: t(prosDoneOf(pick.length)), onClick: confirmPros, primary: true });
  } else if (editing === 'type') {
    chipsKey = 'edit-type';
    chips = INQUIRY_TYPES.map((k) => ({ key: k, label: t(TYPE_LABEL[k]), onClick: () => pickType(k), selected: k === type }));
  } else if (editing === 'company' && !needsCompany(type)) {
    chipsKey = 'edit-company';
    chips = [{ key: 'skip', label: t(S.skipCompany), onClick: skipCompany }];
  } else if (!editing && !busy && phase === 'company' && !needsCompany(type)) {
    chipsKey = 'company';
    chips = [{ key: 'skip', label: t(S.skipCompany), onClick: skipCompany }];
  } else if (!editing && !busy && phase === 'file') {
    chipsKey = `file-${msgs.length}`;
    chips = [
      { key: 'pick', label: t(S.pickFile), onClick: pickFile, icon: 'clip' },
      { key: 'none', label: t(S.noFile), onClick: noFile },
    ];
  } else if (!editing && !busy && phase === 'failed') {
    chipsKey = `failed-${msgs.length}`;
    chips = [{ key: 'retry', label: t(S.retry), onClick: retry }];
  } else if (!editing && !busy && phase === 'unsure') {
    chipsKey = `unsure-${msgs.length}`;
    chips = [
      { key: 'resend', label: t(S.retry), onClick: resendUnsure },
      { key: 'home', label: t(S.home), onClick: () => router.push('/biz') },
    ];
  }
  /** 회사명을 꼭 받아야 하는데 비어 있는 채로 고치는 중 — '취소'를 감춘다(cancelEdit 도 막는다) */
  const companyForced = editing === 'company' && needsCompany(type) && (answers.companySkipped || !answers.company.trim());

  const done = phase === 'done';

  // 문의유형 고치기 칩 줄 — 지금 고른 유형이 화면 밖(가로 스크롤 뒤)에 있으면 가운데로 데려온다
  const chipsRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRowRef.current;
    const sel = row?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!row || !sel) return;
    row.scrollLeft = Math.max(0, sel.offsetLeft - (row.clientWidth - sel.offsetWidth) / 2);
  }, [chipsKey]);

  return (
    <div className="biz-inquiry-chat fixed inset-0 z-[40] flex flex-col overflow-hidden bg-white" style={{ bottom: keyboardOffset }}>
      {/* ─── 머리줄(채팅방과 같은 h-14 · 뒤로 · 가운데 이름 + 알약 / 부제) + 진행 막대 ─── */}
      <div ref={headerRef} className="absolute left-0 right-0 top-0 z-30 bg-white pt-safe">
        <div className="px-safe">
          <div className="mx-auto w-full max-w-[680px]">
            <div className="relative flex h-14 items-center px-1">
              <button
                type="button"
                onClick={goBack}
                aria-label={t(S.back)}
                className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#191F28] transition-colors active:bg-[#F2F3F5]"
              >
                <ArrowBackIcon size={24} />
              </button>
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-[66%] -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-tight">
                <span className={`flex min-w-0 max-w-full items-center gap-1.5 ${entrance ? 'qd-a-title' : ''}`}>
                  <span className="truncate text-[17px] font-bold text-[#191F28]">{t(S.title)}</span>
                  <span className="shrink-0 rounded-full bg-[#E8F3FF] px-2 py-[2px] text-[12.5px] font-bold text-[#3182F6]">{t(S.pill)}</span>
                </span>
                <span className={`mt-[3px] max-w-full truncate text-[12.5px] text-[#8B95A1] ${entrance ? 'qd-a-sub' : ''}`}>{t(S.sub)}</span>
              </div>
            </div>
          </div>
        </div>
        {/* 진행 막대 — 답한 단계만큼(파트너 신청 RegisterKit 의 N/5 막대와 같은 결) */}
        <div
          className="h-[2px] w-full bg-[#F2F4F6]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="bzq-progress h-full bg-[#3182F6]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ─── 대화 ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3"
        style={{ paddingTop: headerH + 4, paddingBottom: footerH + 16, overscrollBehaviorX: 'contain', overscrollBehaviorY: 'none' }}
      >
        <div className="mx-auto w-full max-w-[680px]">
          {/* 대화 시작 — 채팅방 빈 방 안내와 같은 자리 · 크기(상대 프로필 64 · 이름 · 한 줄) */}
          <div className={`flex flex-col items-center pb-2 pt-6 text-center ${entrance ? 'bzq-intro' : ''}`}>
            <BizBotAvatar size={64} />
            <p className="mt-3 text-[15px] font-bold text-[#191F28]">{t(S.title)}</p>
            <p className="mt-1 text-[13px] text-[#8B95A1]">{t(S.introSub)}</p>
          </div>
          {msgs.length > 0 && (
            <div className="py-4 text-center">
              <span className="text-[13px] text-[#8B95A1]">{fmtDay(msgs[0].at, lang)}</span>
            </div>
          )}

          {/* 말풍선 목록만 알림 칸(role=log) — 예전엔 대화 칸 전체(유형 목록 단추 · 접수증까지)가 aria-live 라 화면 읽기가 너무 많이 읽었다 */}
          <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t(S.logAria)}>
          {msgs.map((m, i) => {
            const prev = i > 0 ? msgs[i - 1] : null;
            const next = msgs[i + 1] || null;
            const mine = m.from === 'me';
            // 채팅방 묶음 규칙 그대로 — 같은 사람이 3분 안에 연달아 말하면 한 묶음: 프사는 첫 줄, 꼬리는 마지막 줄, 시간은 같은 분의 마지막 줄
            const groupStart = !prev || prev.from !== m.from || m.at - prev.at > GROUP_GAP;
            const groupEnd = !next || next.from !== m.from || next.at - m.at > GROUP_GAP;
            const showTime = !next || next.from !== m.from || minuteKey(next.at) !== minuteKey(m.at);
            const tailCorner = groupEnd ? ` ${mine ? TAIL_CORNER_CLASS.mine : TAIL_CORNER_CLASS.other}` : '';
            const fresh = mountedAt.current > 0 && m.at >= mountedAt.current;
            const grow = fresh ? GROW : '';
            const origin = { transformOrigin: mine ? 'right bottom' : 'left bottom' } as const;
            // 고른 뒤 유형을 사회자 섭외가 아닌 것으로 바꿨으면 희망 사회자는 접수에 안 붙는다 — 말풍선(+꼬리)도 흐리게 · 못 고치게(섭외로 되돌리면 다시 살아난다, 261009 검증)
            const unused = m.from === 'me' && m.step === 'pros' && !isMcInquiry(type);

            let bubble: ReactElement;
            if (m.from === 'bot') {
              bubble = (
                <div
                  className={`max-w-full whitespace-pre-wrap break-words rounded-[20px] bg-[#F2F3F5] text-[16px] leading-[1.4] text-[#191F28] [overflow-wrap:anywhere]${tailCorner} ${grow}`}
                  style={origin}
                >
                  <div className="px-4 py-[10px]">{t(botTextOf(m.key, m.qt !== undefined ? m.qt : type, m.fail))}</div>
                </div>
              );
            } else if (m.step === 'file' && m.fileName) {
              // 첨부 — 채팅방 파일 말풍선과 같은 모양(문서 아이콘 18 · 이름 15px)
              bubble = (
                <div
                  data-answer="file"
                  className={`flex max-w-full min-w-0 items-center gap-2 rounded-[20px] bg-[#3180F7] px-4 py-3 text-white${tailCorner} ${grow}`}
                  style={origin}
                >
                  <DocumentIcon size={18} />
                  <span className="min-w-0 break-all text-[15px]">{m.fileName}</span>
                  {m.fileSize ? <span className="shrink-0 text-[12px] font-semibold tabular-nums opacity-80">{fmtSize(m.fileSize)}</span> : null}
                </div>
              );
            } else {
              const editable = canEdit && m.step !== 'file' && !unused;
              const isEditingThis = editing === m.step;
              bubble = (
                // disabled 속성 대신 aria-disabled — iOS Safari 는 disabled 단추를 흐리게(opacity) 그려 보낸 뒤 말풍선이 바래 보인다
                <button
                  type="button"
                  data-answer={m.step}
                  aria-disabled={!editable}
                  tabIndex={editable ? 0 : -1}
                  onClick={() => { if (!editable) return; if (isEditingThis) cancelEdit(); else startEdit(m.step); }}
                  aria-label={editable ? `${fieldLabel(m.step)}: ${answerText(m)} · ${t(S.editAria)}` : undefined}
                  className={`block max-w-full whitespace-pre-wrap break-words rounded-[20px] bg-[#3180F7] text-left text-[16px] leading-[1.4] text-white [overflow-wrap:anywhere] transition-[box-shadow] ${editable ? 'cursor-pointer' : 'cursor-default'}${tailCorner} ${grow} ${isEditingThis ? 'ring-2 ring-[#3180F7]/40 ring-offset-2' : ''}`}
                  style={origin}
                >
                  <span className="block px-4 py-[10px]">{answerText(m)}</span>
                </button>
              );
            }

            return (
              <div key={m.id}>
                <div className={`relative flex ${mine ? 'justify-end' : 'justify-start'} ${groupStart && i > 0 ? 'mt-3.5' : 'mt-1'}`}>
                  {/* 프사는 채팅방처럼 움직임 없이 — 커지며 나오는 건 말풍선(+꼬리)만 */}
                  {!mine && (groupStart ? (
                    <span className="mr-2 self-start">
                      <BizBotAvatar size={40} />
                    </span>
                  ) : (
                    <span className="mr-2 w-10 shrink-0" aria-hidden="true" />
                  ))}
                  <div className={`flex min-w-0 max-w-[78%] items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className={`relative min-w-0 transition-opacity duration-300 ${unused ? 'opacity-40' : ''}`}>
                      {bubble}
                      {groupEnd && <BubbleTail mine={mine} color={mine ? '#3180F7' : '#F2F3F5'} pop={fresh} />}
                    </div>
                    {showTime && <span className="shrink-0 pb-[3px] text-[12px] tabular-nums text-[#8B95A1]">{fmtTime(m.at, lang)}</span>}
                  </div>
                </div>
                {i === firstEditableIdx && canEdit && (
                  <p className="bzq-fade mt-2 text-right text-[12.5px] text-[#B0B8C1]">{t(S.editHint)}</p>
                )}
              </div>
            );
          })}
          </div>

          {/* 문의유형 목록 — 질문 바로 아래(상대 말풍선 칸에 맞춰), 오른쪽→왼쪽 촤라락 */}
          {phase === 'type' && !busy && !editing && (
            <div className="mt-2 flex">
              <span className="mr-2 w-10 shrink-0" aria-hidden="true" />
              {/* 목록 → 항목 → 단추(단추에 listitem 역할을 주면 단추 역할이 사라져 화면 읽기가 누를 수 있는 것으로 안 읽었다) */}
              <div className="flex w-full max-w-[320px] flex-col gap-2" role="list" aria-label={t(S.typeListAria)}>
                {INQUIRY_TYPES.map((k, idx) => (
                  <div key={k} role="listitem" className="w-full">
                    <button
                      type="button"
                      onClick={() => pickType(k)}
                      className="pop-menu-item bzq-option flex min-h-[48px] w-full items-center justify-between gap-2 rounded-[16px] border border-[#EEF0F3] bg-white py-2.5 pl-4 pr-3 text-left text-[16px] font-semibold leading-[1.35] text-[#191F28] transition-[transform,background-color] active:scale-[0.98] active:bg-[#F7F8FA]"
                      style={popItemDelay(idx)}
                    >
                      <span className="min-w-0">{t(TYPE_LABEL[k])}</span>
                      <ChevronRightIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 사회자 카드 줄 — '이런 사회자들이…' 질문 아래(다시 고를 땐 대화 맨 아래), 채팅 칸 전체 폭(261009 사장) */}
          {/* 다시 고를 땐 줄이 그다음 질문('회사명을 알려주세요' 등) 밑에 열려 그 질문의 답처럼 읽혔다 — 작은 머리를 단다(261009 검증).
              답 말풍선 바로 밑에 넣지 않는 건 그 자리가 말풍선 알림 칸(role=log) 안이라 카드 12장을 화면 읽기가 다 읽어서 */}
          {prosOpen && editing === 'pros' && (
            <div className="bzq-fade mt-5 flex items-center gap-1.5 pl-12 text-[13px] font-semibold text-[#8B95A1]">
              <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[#B0B8C1]" />
              {t(S.reprosHead)}
            </div>
          )}
          {prosOpen && (
            <BizInquiryPros
              kind={isMcInquiry(type) ? type : lastProsKind}
              picked={pick}
              onToggle={togglePick}
              animate={prosAnimRef.current}
            />
          )}

          {/* 접수증 — 완료 말 아래 */}
          {done && (
            <div className="mt-2 flex">
              <span className="mr-2 w-10 shrink-0" aria-hidden="true" />
              <div className="bzq-receipt w-full max-w-[320px] rounded-[20px] border border-[#EEF0F3] bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-2">
                  <span className="bzq-check flex h-7 w-7 items-center justify-center rounded-full bg-[#3182F6] text-white">
                    <CheckIcon size={16} />
                  </span>
                  <span className="text-[16px] font-bold text-[#191F28]">{t(S.receipt)}</span>
                </div>
                <dl className="mt-4 space-y-2.5 text-[14px] leading-[1.45]">
                  {([
                    ['type', type ? t(TYPE_LABEL[type]) : '-'],
                    // 희망 사회자 — 보낸 message 와 같은 조건(사회자 섭외 유형일 때만)
                    ...(!isMcInquiry(type) ? []
                      : answers.pros.length ? [['pros', answers.pros.map((p) => p.name).join(', ')]]
                        : answeredSteps.has('pros') ? [['pros', t(S.prosUnsure)]] : []),
                    ['company', answers.companySkipped || !answers.company ? t(S.personal) : answers.company],
                    ['name', answers.name],
                    ['phone', answers.phone],
                    ['file', lastFileMsg?.fileName || t(S.none)],
                  ] as Array<[Step, string]>).map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-[72px] shrink-0 text-[#8B95A1]">{fieldLabel(k)}</dt>
                      <dd className="min-w-0 flex-1 break-words font-medium text-[#191F28] [overflow-wrap:anywhere]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* 상대 '입력 중' — 채팅방과 같은 점 3개 말풍선 */}
          {typing && (
            <div className={`${msgs.length && msgs[msgs.length - 1].from === 'bot' ? 'mt-1' : 'mt-3.5'} flex justify-start`}>
              <span className="mr-2 w-10 shrink-0" aria-hidden="true" />
              <div className="bzq-fade flex items-center gap-[5px] rounded-[20px] bg-[#F2F3F5] px-4 py-[14px]" role="status" aria-label={t(S.typingAria)}>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="block h-[7px] w-[7px] rounded-full bg-[#A4ABBA]"
                    style={{ animation: `typingDot 1.1s ease-in-out ${d * 0.16}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 대화가 입력 줄 뒤로 스며드는 흰 그라데이션(채팅방과 같은 자리) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16"
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0) 100%)' }}
      />

      {/* ─── 아래: 칩 줄 + 입력 줄(채팅방 구조 그대로) / 접수 뒤엔 두 단추 ─── */}
      <div ref={footerRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
        {chips.length > 0 && !done && (
          <div className="relative z-[1] sm:px-3">
            <div className="mx-auto w-full max-w-[680px]">
              <div
                key={chipsKey}
                ref={chipsRowRef}
                className="pointer-events-auto flex w-max max-w-full items-center gap-2 overflow-x-auto pb-1 pl-[max(1.5rem,calc(env(safe-area-inset-left)_+_0.75rem))] pr-[max(1.5rem,calc(env(safe-area-inset-right)_+_0.75rem))] pt-2.5 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden"
              >
                {chips.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    data-selected={c.selected ? 'true' : undefined}
                    aria-pressed={c.selected === undefined ? undefined : c.selected}
                    // 칩을 눌러도 입력 칸 초점(열린 키보드)은 그대로 — '개인 문의예요' 다음 담당자명을 이어서 쓰게
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={c.onClick}
                    className={`pop-menu-item pointer-events-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-5 text-[16px] font-semibold transition-[transform,background-color] active:scale-[0.97] ${
                      c.primary
                        ? 'border-[#3182F6] bg-[#3182F6] tabular-nums text-white active:bg-[#2272EB]'
                        : c.selected ? 'border-[#3182F6] bg-white text-[#3182F6] active:bg-[#F7F8FA]' : 'border-[#EEF0F3] bg-white text-[#191F28] active:bg-[#F7F8FA]'
                    }`}
                    style={popItemDelay(i)}
                  >
                    {c.icon === 'clip' && (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="-ml-1 text-[#3182F6]">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                      </svg>
                    )}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-auto relative bg-white pb-safe px-safe">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-full h-5 bg-gradient-to-b from-white/0 to-white" />
          {done ? (
            <div className="bzq-fade mx-auto flex w-full max-w-[680px] gap-2 bg-white px-2 pb-1.5 pt-2 sm:px-0">
              <button
                type="button"
                onClick={restart}
                className="h-14 flex-1 rounded-[17px] bg-[#F2F4F6] text-[17px] font-bold text-[#4E5968] transition-transform active:scale-[0.98]"
              >
                {t(S.again)}
              </button>
              <button
                type="button"
                onClick={() => router.push('/biz')}
                className="h-14 flex-[1.4] rounded-[17px] bg-[#3182F6] text-[17px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t(S.home)}
              </button>
            </div>
          ) : (
            <>
              {editing && (
                <div className="bzq-fade mx-auto flex w-full max-w-[680px] items-center justify-between px-3 pt-2 sm:px-1">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-[#3182F6]">
                    {fieldLabel(editing)} {t(S.editing)}
                  </span>
                  {/* 회사명을 꼭 다시 받아야 할 땐 취소가 없다(빠져나가면 회사명 없이 접수됐다) */}
                  {!companyForced && (
                    <button type="button" onClick={cancelEdit} className="shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold text-[#8B95A1] active:bg-[#F2F4F6]">
                      {t(S.cancel)}
                    </button>
                  )}
                </div>
              )}
              {error && (
                <p key={errorTick} role="alert" className="bzq-shake mx-auto w-full max-w-[680px] px-3 pt-2 text-[13px] font-medium text-[#F04452] sm:px-1">
                  {t(error)}
                </p>
              )}
              <div className="mx-auto flex w-full max-w-[680px] items-end gap-1 bg-white px-2 pb-1.5 pt-2 sm:px-0">
                {phase === 'file' && !busy && !editing && (
                  <button
                    type="button"
                    aria-label={t(S.attach)}
                    onClick={pickFile}
                    className="bzq-plus flex h-11 w-10 shrink-0 items-center justify-center text-[#4E5968] transition-opacity active:opacity-60"
                  >
                    <PlusIcon size={26} />
                  </button>
                )}
                <div className={`flex min-h-[44px] min-w-0 flex-1 items-end rounded-[22px] bg-[#F2F3F5] py-[6px] pl-4 pr-1 ${textActive ? '' : 'opacity-70'}`}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={textActive ? draft : ''}
                    onChange={onDraftChange}
                    onKeyDown={onKeyDown}
                    disabled={!textActive}
                    placeholder={placeholder}
                    aria-label={activeStep ? fieldLabel(activeStep) : placeholder}
                    maxLength={activeStep === 'message' ? 2000 : activeStep === 'phone' ? 20 : 60}
                    inputMode={activeStep === 'phone' ? 'tel' : 'text'}
                    autoComplete={activeStep === 'phone' ? 'tel' : activeStep === 'name' ? 'name' : activeStep === 'company' ? 'organization' : 'off'}
                    enterKeyHint={activeStep === 'message' ? 'enter' : 'send'}
                    className="max-h-[120px] min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent py-[3px] text-[16px] leading-[1.35] text-[#191F28] placeholder:text-[#8B95A1] focus:outline-none disabled:cursor-default disabled:opacity-100"
                  />
                </div>
                <button
                  type="button"
                  aria-label={t(S.send)}
                  // 누르는 순간 초점을 입력 칸에서 빼앗지 않는다 — 빼앗기면 보낸 뒤 단추가 비활성이 되며 초점이 body 로 떨어져 폰 키보드가 내려갔다
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={submitText}
                  disabled={!canSend}
                  className="flex h-11 w-10 shrink-0 items-center justify-center transition-transform active:scale-[0.9]"
                >
                  <TintIcon src="/icons/chat-kr/send.svg" color={canSend ? '#3182F6' : '#C4C9D0'} size={26} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFilePicked} tabIndex={-1} aria-hidden="true" />

      <style dangerouslySetInnerHTML={{ __html: `
        /* 새 말풍선 — 채팅방((main)/chat/[id]) bubbleGrow 와 같은 값(그 keyframes 는 채팅방 화면 안에만 있어 여기 같은 이름 · 같은 값으로 둔다.
           두 화면이 같이 떠도 내용이 같아 어느 쪽이 이겨도 같다): 꼬리 쪽 아래 모서리에서 작게 시작해 살짝 올라오며 커지고 넘치지 않고 제자리 */
        @keyframes bubbleGrow {
          0% { transform: translateY(10px) scale(0.62); opacity: 0; }
          45% { opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes bzqFade { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes bzqShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
        @keyframes bzqPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bzqRise { 0% { opacity: 0; transform: translateY(14px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bzqIntro { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
        .biz-inquiry-chat .bzq-fade { animation: bzqFade .28s cubic-bezier(.22,.61,.36,1) both; }
        .biz-inquiry-chat .bzq-shake { animation: bzqShake .42s cubic-bezier(.36,.07,.19,.97) both; }
        .biz-inquiry-chat .bzq-plus { animation: bzqPop .36s cubic-bezier(.2,.9,.3,1) both; }
        .biz-inquiry-chat .bzq-check { animation: bzqPop .5s cubic-bezier(.2,.9,.3,1) .18s both; }
        .biz-inquiry-chat .bzq-receipt { animation: bzqRise .5s cubic-bezier(.22,.61,.36,1) both; }
        .biz-inquiry-chat .bzq-intro { animation: bzqIntro .5s cubic-bezier(.22,.61,.36,1) both; }
        .biz-inquiry-chat .bzq-progress { transition: width .5s cubic-bezier(.22,.61,.36,1); }
        @media (hover: hover) { .biz-inquiry-chat .bzq-option:hover { background: #F9FAFB; } }
        /* 일 · 중 — 띄어쓰기가 없어 keep-all 이면 말풍선 밖으로 넘친다(비즈 첫 화면과 같은 처리) */
        .biz-inquiry-chat:lang(ja) *, .biz-inquiry-chat:lang(zh) * { word-break: normal; line-break: strict; }
        @media (prefers-reduced-motion: reduce) {
          .biz-inquiry-chat *, .biz-inquiry-chat *::before, .biz-inquiry-chat *::after { animation: none !important; transition: none !important; }
        }
      ` }} />
    </div>
  );
}
