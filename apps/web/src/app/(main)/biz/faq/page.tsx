'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Mail, Search, X } from 'lucide-react';
import { useT, type Translations } from '@/lib/biz/i18n';
import BizHeader, { BizPageFooter } from '@/components/biz/BizHeader';
import { FadeUp } from '@/components/biz/biz-motion';
import { cameByHistory } from '@/components/biz/scroll-to';

/*
 * 비즈 자주 묻는 질문(261009 사장 '비즈의 모든 페이지를 프리티풀 톤앤매너 · 애니메이션으로 이쁘고 일관성 있게 · 비즈 내용은 웨딩홀과 기업행사 위주').
 *  · 머리줄 = 비즈 공통 BizHeader(옛 반투명 알약 머리줄 · 햄버거 메뉴 시트 삭제).
 *  · 맨 앞 묶음 '웨딩홀 · 기업행사' — 문의하기(/biz/inquiry 상담 채팅)의 문의 유형(웨딩홀 전속 사회자 제휴 · 기업행사 사회자 섭외)으로 가는 길을 안내.
 *    나머지 문답은 예전 그대로(환불 = 플랫폼 환불 규정 260928 통일본), 말머리만 '결혼식 · 기업행사' 중심으로 다듬었다(새 숫자 · 약속 없음).
 *  · 움직임: 묶음을 바꾸면 질문 카드가 오른쪽에서 차례로 들어온다(퀵매칭 qd-a-item 어법), 답은 높이가 스르르 열린다. 줄인 움직임이면 바로.
 *  · 문의 단추는 문의 섹션(#문의폼, 삭제됨)이 아니라 상담 채팅 /biz/inquiry 로.
 */

type Cat = 'biz' | 'service' | 'matching' | 'payment' | 'expert';
type Faq = { id: string; category: Cat; q: Translations; a: Translations };

const CATEGORIES: { id: 'all' | Cat; label: Translations }[] = [
  { id: 'all', label: { ko: '전체', en: 'All', ja: '全体', zh: '全部' } },
  { id: 'biz', label: { ko: '웨딩홀 · 기업행사', en: 'Halls & corporate', ja: '式場・企業イベント', zh: '婚礼堂 · 企业活动' } },
  { id: 'service', label: { ko: '서비스 이용', en: 'Service', ja: 'サービス利用', zh: '服务使用' } },
  { id: 'matching', label: { ko: '매칭 · 예약', en: 'Matching', ja: 'マッチング', zh: '匹配 · 预约' } },
  { id: 'payment', label: { ko: '결제 · 환불', en: 'Payment', ja: '決済・返金', zh: '支付 · 退款' } },
  { id: 'expert', label: { ko: '사회자 관련', en: 'Hosts', ja: '司会者', zh: '主持人' } },
];

const FAQS: Faq[] = [
  {
    id: 'hall',
    category: 'biz',
    q: { ko: '웨딩홀 전속 사회자 제휴는 어떻게 하나요?', en: 'How do we partner for a resident wedding hall MC?', ja: '式場専属司会者の提携はどうすればいいですか?', zh: '如何洽谈婚礼堂专属主持人合作?' },
    a: {
      ko: '문의하기에서 문의 유형을 \'웨딩홀 전속 사회자 제휴\'로 고르고 웨딩홀 이름 · 담당자 · 연락처와 원하시는 내용을 남겨 주세요. 담당 매니저가 확인한 뒤 연락드려요.',
      en: 'In Contact, choose "Resident wedding hall MC partnership" and leave your hall name, contact person, phone number and what you have in mind. A dedicated manager will review it and get back to you.',
      ja: 'お問合せで種類「式場専属司会者の提携」を選び、式場名・ご担当者・連絡先とご要望をお残しください。担当マネージャーが確認のうえご連絡します。',
      zh: '请在“咨询”中选择“婚礼堂专属主持人合作”，留下婚礼堂名称、负责人、联系方式和需求。专属经理确认后会与您联系。',
    },
  },
  {
    id: 'enterprise',
    category: 'biz',
    q: { ko: '기업행사 사회자 섭외는 어떻게 문의하나요?', en: 'How do I book an MC for a corporate event?', ja: '企業イベントの司会者依頼はどう問い合わせますか?', zh: '如何咨询企业活动主持人预约?' },
    a: {
      ko: '문의하기에서 \'기업행사 사회자 섭외\'를 고르고 회사명 · 담당자 · 연락처와 행사 날짜 · 장소 · 규모 같은 행사 내용을 남겨 주세요. 담당 매니저가 행사 성격에 맞는 진행자와 예상 견적을 안내해드려요.',
      en: 'In Contact, choose "Corporate event MC booking" and leave your company, contact person, phone number and event details such as date, venue and size. A dedicated manager will suggest hosts that fit your event and an estimated quote.',
      ja: 'お問合せで「企業イベント司会者の依頼」を選び、会社名・ご担当者・連絡先と日程・会場・規模などイベント内容をお残しください。担当マネージャーがイベントに合う司会者と見積もりをご案内します。',
      zh: '请在“咨询”中选择“企业活动主持人预约”，留下公司名称、负责人、联系方式以及活动日期、地点、规模等信息。专属经理会为您推荐适合活动性质的主持人并提供预估报价。',
    },
  },
  {
    id: 'what',
    category: 'service',
    q: { ko: '프리티풀은 어떤 서비스인가요?', en: 'What service does Freetiful provide?', ja: 'Freetiful はどんなサービスですか?', zh: 'Freetiful 是什么服务?' },
    a: {
      ko: '프리티풀은 전문 진행자(MC, 아나운서, 쇼호스트 등)와 고객을 연결하는 매칭 플랫폼입니다. 웨딩홀 예식과 기업행사를 중심으로 컨퍼런스, 시상식, 축제 등 행사 성격에 맞는 전문 진행자를 매칭해드립니다.',
      en: 'Freetiful is a matching platform that connects clients with professional hosts (MCs, announcers, show hosts). Centered on wedding halls and corporate events, we also match the right host for conferences, award ceremonies, festivals and more.',
      ja: 'Freetiful は、プロ司会者(MC、アナウンサー、ショーホストなど)とお客様を繋ぐマッチングプラットフォームです。式場の挙式と企業イベントを中心に、カンファレンス、授賞式、フェスティバルなどイベントに合ったプロ司会者をマッチングします。',
      zh: 'Freetiful 是连接专业主持人(MC、主播、购物主持人等)与客户的匹配平台。以婚礼堂仪式和企业活动为中心，也为会议、颁奖典礼、庆典等活动匹配合适的专业主持人。',
    },
  },
  {
    id: 'events',
    category: 'service',
    q: { ko: '어떤 종류의 행사에 이용할 수 있나요?', en: 'What types of events can I use it for?', ja: 'どのような種類のイベントで利用できますか?', zh: '可以用于哪些活动?' },
    a: {
      ko: '결혼식 사회와 기업행사(송년회, 시상식, 컨퍼런스, 제품 런칭 등)를 중심으로 세미나, 축제, 체육대회 등 전문 진행자가 필요한 행사에 이용하실 수 있습니다. 행사 성격에 맞는 사회자를 매칭해드립니다.',
      en: 'Weddings and corporate events (year-end parties, award ceremonies, conferences, product launches) first, plus seminars, festivals, sports days — anywhere you need a professional host. We match the right MC to your event.',
      ja: '結婚式司会と企業イベント(忘年会、授賞式、カンファレンス、製品発表会など)を中心に、セミナー、フェスティバル、運動会などプロ司会者が必要なイベントに利用可能です。イベントに合った司会者をマッチングします。',
      zh: '以婚礼主持和企业活动(年会、颁奖典礼、会议、产品发布等)为主，研讨会、庆典、运动会等凡需要专业主持人的场合都可以使用。我们根据活动性质匹配合适的主持人。',
    },
  },
  {
    id: 'nationwide',
    category: 'service',
    q: { ko: '전국 어디서든 이용 가능한가요?', en: 'Is service available nationwide?', ja: '全国どこでも利用できますか?', zh: '全国各地都能使用吗?' },
    a: {
      ko: '네, 전국 1,000여 명의 전문 진행자 네트워크를 보유하고 있어 전국 어디서든 매칭이 가능합니다. 서울/수도권은 물론 지방 행사도 지원합니다.',
      en: 'Yes. With a network of 1,000+ professional hosts nationwide, we can match anywhere in Korea — from Seoul and the capital region to provincial cities.',
      ja: 'はい、全国 1,000 名以上のプロ司会者ネットワークがあり、全国どこでもマッチング可能です。ソウル・首都圏はもちろん地方イベントにも対応します。',
      zh: '是的,我们拥有全国 1,000 余名专业主持人网络,全国各地都能匹配。首尔和首都圈自不必说,地方活动也同样支持。',
    },
  },
  {
    id: 'process',
    category: 'matching',
    q: { ko: '매칭은 어떤 과정으로 진행되나요?', en: 'How does the matching process work?', ja: 'マッチングはどのように進みますか?', zh: '匹配流程是怎样的?' },
    a: {
      ko: '행사 정보(날짜, 장소, 유형, 예산 등)를 등록하시면, AI 기반 맞춤 매칭 시스템이 최적의 진행자를 추천합니다. 추천된 진행자의 프로필, 경력, 리뷰를 확인하신 후 원하는 분을 선택하시면 됩니다. 담당 매니저가 전 과정을 지원합니다.',
      en: 'Register your event info (date, venue, type, budget) and our AI-based system recommends optimal hosts. Review their profiles, careers, and reviews, then choose your preferred host. A dedicated manager supports you throughout the process.',
      ja: 'イベント情報(日時、場所、種類、予算など)を登録いただくと、AI ベースのマッチングシステムが最適な司会者を推薦します。推薦された司会者のプロフィール、経歴、レビューを確認し、お好みの方をお選びください。担当マネージャーが全過程をサポートします。',
      zh: '注册活动信息(日期、地点、类型、预算等)后,基于 AI 的匹配系统会推荐最合适的主持人。查看推荐主持人的简介、经历、评价后选择您喜欢的主持人。专属经理全程支持。',
    },
  },
  {
    id: 'time',
    category: 'matching',
    q: { ko: '매칭까지 얼마나 걸리나요?', en: 'How long does matching take?', ja: 'マッチングまでどのくらいかかりますか?', zh: '匹配需要多久?' },
    a: {
      ko: '일반적으로 문의 후 1~2영업일 내에 맞춤 진행자를 추천해드립니다. 긴급 매칭이 필요한 경우에도 최대한 빠르게 대응하고 있으며, 최소 1주일 전에 문의하시는 것을 권장합니다.',
      en: 'Typically we recommend a customized host within 1-2 business days. Even urgent matching is handled as quickly as possible — we recommend inquiring at least 1 week in advance.',
      ja: '通常、お問合せ後 1~2 営業日以内にカスタマイズされた司会者を推薦します。緊急マッチングにも可能な限り迅速に対応しており、最低 1 週間前のお問合せを推奨いたします。',
      zh: '通常咨询后 1-2 个工作日内推荐定制主持人。紧急匹配也会尽快处理,建议至少提前 1 周咨询。',
    },
  },
  {
    id: 'choose',
    category: 'matching',
    q: { ko: '진행자를 직접 선택할 수 있나요?', en: 'Can I choose the host directly?', ja: '司会者を直接選べますか?', zh: '我可以自己选择主持人吗?' },
    a: {
      ko: '물론입니다. AI가 추천한 진행자 목록에서 프로필, 경력 사항, 샘플 영상, 고객 리뷰를 확인하신 후 원하시는 진행자를 직접 선택하실 수 있습니다.',
      en: 'Of course. From the AI-recommended list of hosts, review profiles, experience, sample videos, and client reviews, then select your preferred host directly.',
      ja: 'もちろんです。AI が推薦した司会者リストからプロフィール、経歴、サンプル映像、顧客レビューを確認し、お好みの司会者を直接お選びいただけます。',
      zh: '当然可以。从 AI 推荐的主持人名单中查看简介、经历、视频样本、客户评价,然后直接选择您喜欢的主持人。',
    },
  },
  {
    id: 'price',
    category: 'payment',
    q: { ko: '비용은 어떻게 되나요?', en: 'How is pricing determined?', ja: '費用はどうなりますか?', zh: '费用如何计算?' },
    a: {
      ko: '비용은 행사 유형, 시간, 진행자 경력 등에 따라 달라집니다. 문의 시 행사 정보를 알려주시면 예상 견적을 안내해드립니다. 프리티풀은 투명한 가격 정책을 운영하며, 추가 비용 없이 명확한 견적을 제공합니다.',
      en: 'Pricing varies by event type, duration, and host experience. Share your event details when inquiring and we will provide an estimate. Freetiful operates transparent pricing — clear quotes with no hidden fees.',
      ja: '費用はイベントの種類、時間、司会者の経歴などにより異なります。お問合せの際にイベント情報をお知らせいただければ見積もりをご案内いたします。Freetiful は透明な価格ポリシーを運営し、追加費用なしの明確な見積もりを提供します。',
      zh: '费用因活动类型、时长、主持人经验等而异。咨询时告知活动信息,我们将提供预估报价。Freetiful 实行透明价格政策,提供明确报价,无额外费用。',
    },
  },
  {
    id: 'pay',
    category: 'payment',
    q: { ko: '결제는 어떻게 하나요?', en: 'How do I pay?', ja: '決済はどうしますか?', zh: '如何支付?' },
    a: {
      ko: '카드 결제, 계좌이체, 세금계산서 발행 등 다양한 결제 방법을 지원합니다. 기업행사의 경우 세금계산서 발행 및 후불 결제도 가능합니다.',
      en: 'We support various payment methods: credit card, bank transfer, and tax invoice issuance. For corporate events, tax invoices and deferred payment are also available.',
      ja: 'カード決済、口座振込、税金計算書発行など様々な決済方法に対応しています。企業イベントの場合、税金計算書発行及び後払いも可能です。',
      zh: '支持信用卡、银行转账、税务发票等多种支付方式。企业活动可开具税务发票并支持后付款。',
    },
  },
  {
    id: 'refund',
    category: 'payment',
    q: { ko: '취소 및 환불 정책이 궁금해요.', en: 'What is the cancellation and refund policy?', ja: 'キャンセル及び返金ポリシーを教えてください。', zh: '取消及退款政策是什么?' },
    // 환불 기준 = 「플랫폼 환불 규정」(260928 통일 — 예전엔 '행사 7일 전 전액' 식으로 규정과 달랐다)
    a: {
      ko: '환불은 프리티풀 플랫폼 환불 규정에 따라 입금일(예약 당일 포함)을 기준으로 해요. 입금일로부터 4일 이내에는 100%, 5~7일 이내에는 50% 환불되고, 7일이 지났거나 사전미팅을 진행한 뒤에는 환불이 어려워요. 행사일이 입금일로부터 7일 이내라면 환불이 어렵습니다. 사회자 사정으로 취소되면 전액 환불과 함께 규정에 따른 보상을 드리고, 고객 사정으로 취소하면 행사일 기준 위약금이 생길 수 있어요. 자세한 기준은 플랫폼 환불 규정에서 확인하거나 고객센터로 문의해주세요.',
      en: 'Refunds follow the Freetiful platform refund policy, counted from the payment date (including the booking day): 100% within 4 days of payment, 50% within 5-7 days, and no refund after 7 days or once a pre-event meeting has taken place. If the event is within 7 days of the payment date, the deposit cannot be refunded. If the MC cancels, you receive a full refund plus compensation under the policy; if you cancel, a cancellation fee may apply based on the event date. See the platform refund policy or contact customer support for details.',
      ja: '返金はフリティフルのプラットフォーム返金規定に基づき、入金日(予約当日を含む)を基準とします。入金日から4日以内は100%、5~7日以内は50%返金され、7日経過後または事前ミーティング実施後は返金できません。イベント日が入金日から7日以内の場合も返金できません。司会者の都合によるキャンセルは全額返金と規定に基づく補償を行い、お客様の都合によるキャンセルはイベント日を基準に違約金が発生する場合があります。詳細はプラットフォーム返金規定をご確認いただくか、カスタマーセンターにお問合せください。',
      zh: '退款依照Freetiful平台退款规定,以付款日(含预约当天)为准:付款后4天内退还100%,5~7天内退还50%,超过7天或已进行事前会议则不予退款。若活动日在付款日起7天内,定金不予退还。因主持人原因取消时,全额退款并依规定给予补偿;因客户原因取消时,可能依活动日期产生违约金。详情请查看平台退款规定或联系客服中心。',
    },
  },
  {
    id: 'verify',
    category: 'expert',
    q: { ko: '진행자들은 어떻게 검증되나요?', en: 'How are hosts verified?', ja: '司会者はどのように検証されますか?', zh: '主持人如何认证?' },
    a: {
      ko: '모든 진행자는 KBS, SBS, MBC 등 방송사 출신 경력 확인, 자격증/교육 이수 증명, 실제 행사 영상 리뷰, 인터뷰 평가 등 4단계 검증 절차를 거칩니다. 검증을 통과한 사회자만 프리티풀에 등록됩니다.',
      en: 'Every host goes through a 4-step verification: broadcaster career verification (KBS, SBS, MBC), certifications/training proofs, real event video review, and interview evaluation. Only verified professionals join Freetiful.',
      ja: 'すべての司会者は KBS、SBS、MBC 等の放送局出身経歴確認、資格証/教育修了証明、実イベント映像レビュー、インタビュー評価など 4 段階の検証手続きを経ます。検証を通過した専門家のみが Freetiful に登録されます。',
      zh: '所有主持人均经过 4 阶段认证:KBS、SBS、MBC 等广播公司经历验证、资格证/培训证明、实际活动视频审查、面试评估。仅通过认证的专业人士才能加入 Freetiful。',
    },
  },
  {
    id: 'join',
    category: 'expert',
    q: { ko: '진행자로 활동하고 싶어요.', en: 'I want to work as a host.', ja: '司会者として活動したいです。', zh: '我想成为主持人。' },
    a: {
      ko: '프리티풀 앱 또는 웹사이트에서 사회자 등록을 신청하실 수 있습니다. 경력 사항과 포트폴리오를 제출하시면 검증 절차 진행 후 승인 결과를 안내드립니다. 자세한 사항은 freetiful2025@gmail.com으로 문의해주세요.',
      en: 'Apply for expert registration through the Freetiful app or website. Submit your career and portfolio, and we will inform you of the result after verification. Contact freetiful2025@gmail.com for details.',
      ja: 'Freetiful アプリまたはウェブサイトで専門家登録を申請できます。経歴とポートフォリオを提出いただき、検証手続き後に承認結果をご案内いたします。詳細は freetiful2025@gmail.com までお問合せください。',
      zh: '可通过 Freetiful 应用或官网申请专家注册。提交经历与作品集后,经过认证流程将告知审核结果。详情请联系 freetiful2025@gmail.com。',
    },
  },
  {
    id: 'meet',
    category: 'expert',
    q: { ko: '진행자와 사전 미팅이 가능한가요?', en: 'Can I meet the host before the event?', ja: '司会者と事前ミーティングは可能ですか?', zh: '可以与主持人事先会面吗?' },
    a: {
      ko: '네, 매칭 확정 후 행사 전 진행자와 사전 미팅(대면 또는 비대면)을 진행하실 수 있습니다. 사전 미팅을 통해 행사 세부 사항을 조율하고, 진행자와의 케미를 확인하실 수 있습니다.',
      en: 'Yes. After matching is confirmed, you can hold a pre-event meeting (in-person or online) with the host to fine-tune event details and check rapport.',
      ja: 'はい、マッチング確定後、イベント前に司会者と事前ミーティング(対面またはオンライン)を行うことができます。事前ミーティングを通じてイベントの詳細を調整し、司会者との相性を確認いただけます。',
      zh: '可以。匹配确定后,您可在活动前与主持人进行会前会议(线下或线上),协调活动细节并确认默契。',
    },
  },
];

/** 검색어를 옅은 파랑으로 칠한다(대소문자 무시) */
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${esc})`, 'ig'));
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded-[4px] bg-[#E8F3FF] px-0.5 text-[#1B64DA]">{p}</mark> : p));
}

function FaqItem({ faq, open, onToggle, query, index }: { faq: { id: string; q: string; a: string }; open: boolean; onToggle: () => void; query: string; index: number }) {
  const uid = useId();
  const btnId = `${uid}-q`;
  const panelId = `${uid}-a`;
  return (
    <li
      className={`qd-a-item rounded-[24px] transition-[background-color,box-shadow] duration-300 ${open ? 'bg-white shadow-[0_0_0_1.5px_#E5E8EB,0_12px_32px_-18px_rgba(0,27,55,0.18)]' : 'bg-[#F9FAFB] hover:bg-[#F2F4F6]'}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <h3 className="m-0">
        <button
          id={btnId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start gap-3 rounded-[24px] px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3182F6]/40 lg:gap-4 lg:px-7 lg:py-6"
        >
          <span aria-hidden className={`mt-[1px] text-[17px] font-bold leading-[1.5] transition-colors lg:text-[19px] ${open ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}>Q</span>
          <span className="min-w-0 flex-1 break-keep text-[17px] font-semibold leading-[1.5] tracking-[-0.3px] text-[#191F28] lg:text-[19px]">{highlight(faq.q, query)}</span>
          <ChevronDown
            aria-hidden
            className={`mt-[3px] h-5 w-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'rotate-180 text-[#3182F6]' : 'text-[#B0B8C1]'}`}
            strokeWidth={2.2}
          />
        </button>
      </h3>
      {/* 높이 0 → 내용 높이로 스르르(grid 행 0fr → 1fr). 닫힌 동안은 읽기 프로그램에서도 숨긴다 */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        aria-hidden={!open}
        className="grid transition-[grid-template-rows,opacity] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <p className="m-0 break-keep px-5 pb-6 pl-[46px] text-[16px] font-medium leading-[1.75] tracking-[-0.2px] text-[#4E5968] lg:px-7 lg:pb-7 lg:pl-[60px] lg:text-[17px]">
            {highlight(faq.a, query)}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function FaqPage() {
  const t = useT();
  const [cat, setCat] = useState<'all' | Cat>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>('hall');

  useEffect(() => {
    if (!cameByHistory()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const q = query.trim();
  // 15개뿐이라 그릴 때마다 거른다(언어를 바꾸면 그 언어 글자로 검색)
  const lower = q.toLowerCase();
  const list = FAQS.filter((f) => cat === 'all' || f.category === cat)
    .map((f) => ({ id: f.id, q: t(f.q), a: t(f.a) }))
    .filter((f) => !lower || f.q.toLowerCase().includes(lower) || f.a.toLowerCase().includes(lower));

  const chipsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  /**
   * 묶음 고르기 — 고른 칩을 칩 줄 가운데로 옮기고(오른쪽 끝 칩을 골라도 보이게, 홈 글자 탭과 같은 손맛),
   * 내려와 있었다면(칩 줄이 머리줄 아래 붙은 상태) 목록 맨 위가 칩 줄 바로 아래에 오게 올려 준다(짧아진 목록 아래 빈칸에 서 있지 않게)
   */
  const pickCat = (id: 'all' | Cat, el: HTMLButtonElement) => {
    setCat(id);
    setOpenId(null);
    const row = el.parentElement;
    if (row) row.scrollTo({ left: Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
    requestAnimationFrame(() => {
      const chips = chipsRef.current?.getBoundingClientRect();
      const list = listRef.current?.getBoundingClientRect();
      if (!chips || !list || list.top >= chips.bottom) return;
      window.scrollTo({ top: window.scrollY + list.top - chips.bottom - 4, behavior: 'smooth' });
    });
  };

  return (
    <div data-no-natural-reveal className="min-h-screen bg-white pt-14 text-[#191F28] md:pt-16" style={{ letterSpacing: '-0.02em' }}>
      <BizHeader />

      {/* ═══ 큰 제목 ═══ */}
      <section className="mx-auto max-w-[880px] px-6 pb-8 pt-10 sm:px-8 lg:pb-12 lg:pt-24">
        <FadeUp y={20}>
          <p className="m-0 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] lg:text-[18px]">
            {t({ ko: '자주 묻는 질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' })}
          </p>
        </FadeUp>
        <FadeUp y={28} delay={80}>
          <h1 className="m-0 mt-3 break-keep text-[34px] font-bold leading-[1.3] tracking-[-1px] lg:mt-4 lg:text-[60px] lg:tracking-[-2px]">
            {t({
              ko: <>궁금한 점을<br />먼저 확인해 보세요</>,
              en: <>Find your answer<br />before you ask</>,
              ja: <>気になることを<br />まず確認してください</>,
              zh: <>先在这里<br />找找答案吧</>,
            })}
          </h1>
        </FadeUp>
        <FadeUp y={24} delay={160}>
          <p className="m-0 mt-5 break-keep text-[17px] font-medium leading-[1.6] tracking-[-0.3px] text-[#4E5968] lg:mt-6 lg:text-[20px]">
            {t({
              ko: '웨딩홀 · 기업행사 사회자 섭외부터 결제와 환불까지, 자주 묻는 질문을 모았어요.',
              en: 'From booking MCs for wedding halls and corporate events to payment and refunds — the questions we hear most.',
              ja: '式場・企業イベントの司会者依頼から決済・返金まで、よくある質問をまとめました。',
              zh: '从婚礼堂、企业活动主持人预约到支付与退款，为您整理了常见问题。',
            })}
          </p>
        </FadeUp>

        {/* 검색 */}
        <FadeUp y={24} delay={240}>
          <label className="relative mt-8 flex h-[56px] items-center rounded-[18px] bg-[#F2F4F6] pl-12 pr-3 transition-shadow focus-within:shadow-[0_0_0_2px_#3182F6] lg:mt-10 lg:h-[60px]">
            <span className="sr-only">{t({ ko: '질문 검색', en: 'Search questions', ja: '質問を検索', zh: '搜索问题' })}</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 h-5 w-5 text-[#8B95A1]" strokeWidth={2.2} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t({ ko: '궁금한 내용을 검색해 보세요', en: 'Search for a question', ja: '気になる内容を検索', zh: '搜索您想了解的内容' })}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[#191F28] outline-none placeholder:text-[#8B95A1] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t({ ko: '검색어 지우기', en: 'Clear search', ja: '検索語を消す', zh: '清除搜索' })}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#8B95A1] transition-colors hover:bg-[#E5E8EB]"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}
          </label>
        </FadeUp>
      </section>

      {/* ═══ 묶음 칩 — 내려도 머리줄 아래 붙어 있다 ═══ */}
      <div ref={chipsRef} className="sticky top-14 z-10 bg-white md:top-16">
        <div className="mx-auto max-w-[880px]">
          <div role="group" aria-label={t({ ko: '질문 묶음', en: 'Question categories', ja: '質問カテゴリ', zh: '问题分类' })} className="relative flex gap-2 overflow-x-auto px-6 py-3 sm:px-8" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map((c) => {
              const on = cat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={(e) => pickCat(c.id, e.currentTarget)}
                  className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-semibold tracking-[-0.2px] transition-[background-color,color,transform] duration-200 active:scale-[0.96] ${
                    on ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {t(c.label)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ 질문 목록 ═══ */}
      <section ref={listRef} className="mx-auto max-w-[880px] px-5 pt-3 sm:px-8">
        {list.length > 0 ? (
          <ul key={`${cat}|${q ? 'q' : ''}`} className="m-0 flex list-none flex-col gap-3 p-0">
            {list.map((f, i) => (
              <FaqItem key={f.id} faq={f} index={i} query={q} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} />
            ))}
          </ul>
        ) : (
          <div className="qd-a-item rounded-[24px] bg-[#F9FAFB] px-6 py-14 text-center">
            <p className="m-0 text-[17px] font-semibold text-[#191F28]">
              {t({ ko: '찾는 질문이 없어요', en: 'No matching questions', ja: '該当する質問がありません', zh: '没有找到相关问题' })}
            </p>
            <p className="m-0 mt-1.5 text-[15px] text-[#8B95A1]">
              {t({ ko: '다른 말로 검색하거나 바로 문의해 주세요', en: 'Try other words, or ask us directly', ja: '別の言葉で検索するか、直接お問合せください', zh: '换个关键词搜索，或直接咨询我们' })}
            </p>
          </div>
        )}
      </section>

      {/* ═══ 문의 ═══ */}
      <section className="mx-auto max-w-[880px] px-5 pt-14 sm:px-8 lg:pt-20">
        <FadeUp y={32}>
          <div className="relative overflow-hidden rounded-[28px] bg-[#F2F7FF] px-6 py-9 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-12 lg:py-12">
            <div>
              <p className="m-0 break-keep text-[22px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28] lg:text-[28px]">
                {t({ ko: '찾으시는 답변이 없나요?', en: "Can't find your answer?", ja: 'お探しの回答が見つかりませんか?', zh: '没找到您想要的答案吗?' })}
              </p>
              <p className="m-0 mt-2 break-keep text-[15px] font-medium leading-[1.6] text-[#4E5968] lg:text-[17px]">
                {t({
                  ko: '웨딩홀 · 기업행사 담당자라면 상담 채팅으로 바로 남겨 주세요.',
                  en: 'Wedding hall or corporate event planner? Leave a note in our chat.',
                  ja: '式場・企業イベントのご担当者様はチャットでお気軽にどうぞ。',
                  zh: '婚礼堂或企业活动负责人，请直接在咨询聊天中留言。',
                })}
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row lg:mt-0 lg:shrink-0">
              <Link href="/biz/inquiry" className="inline-flex h-14 items-center justify-center gap-1.5 rounded-[16px] bg-[#3182F6] px-6 text-[17px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-[#2272EB] active:scale-[0.98]">
                {t({ ko: '문의하기', en: 'Contact us', ja: 'お問合せ', zh: '联系我们' })}
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
              </Link>
              <a href="mailto:freetiful2025@gmail.com" className="inline-flex h-14 items-center justify-center gap-1.5 rounded-[16px] bg-white px-6 text-[17px] font-semibold text-[#4E5968] transition-[transform,background-color] duration-150 hover:bg-[#F9FAFB] active:scale-[0.98]">
                <Mail className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
                {t({ ko: '이메일 보내기', en: 'Send email', ja: 'メール送信', zh: '发送邮件' })}
              </a>
            </div>
          </div>
        </FadeUp>
      </section>

      <BizPageFooter current="faq" />
    </div>
  );
}
