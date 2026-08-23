'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { autoReplyApi, type AutoReplyItem } from '@/lib/api/auto-reply.api';
import { CloseIcon } from '@/components/icons/mono';
import { MY_CARD, MySectionTitle, MyDetailHeader } from '../../my/_components/detail-ui';

/**
 * 사회자 자동응답 관리.
 *
 * 고객이 문의를 열면 여기 적어 둔 인사말이 먼저 나가고, 질문 목록은 고객 화면에
 * 버튼으로 떠서 누르면 바로 답이 간다. 아무것도 안 적어도 인사말은 기본 문구로 나간다.
 */
export default function AutoReplyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [greetingEnabled, setGreetingEnabled] = useState(true);
  const [defaultGreeting, setDefaultGreeting] = useState('');
  const [items, setItems] = useState<AutoReplyItem[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [quoteReply, setQuoteReply] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteEnabled, setQuoteEnabled] = useState(true);

  useEffect(() => {
    autoReplyApi
      .getMine()
      .then((data) => {
        setGreeting(data.greeting || '');
        setGreetingEnabled(data.greetingEnabled);
        setDefaultGreeting(data.defaultGreeting || '');
        setSuggested(data.suggestedQuestions || []);
        setQuoteReply(data.quoteReply || '');
        setQuoteAmount(data.quoteAmount ? String(data.quoteAmount) : '');
        setQuoteEnabled(data.quoteEnabled !== false);
        // 자동응답이 비어 있으면 이미 써 둔 프로필 FAQ 를 그대로 채워 준다
        setItems(
          data.items.length > 0
            ? data.items
            : (data.faqSuggestions || []).map((faq) => ({ question: faq.question, answer: faq.answer })),
        );
      })
      .catch(() => toast.error('불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await autoReplyApi.saveMine({
        greeting,
        greetingEnabled,
        items,
        quoteReply,
        quoteAmount: quoteAmount ? Number(quoteAmount.replace(/[^\d]/g, '')) : null,
        quoteEnabled,
      });
      toast.success('저장했어요');
    } catch {
      toast.error('저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const update = (index: number, patch: Partial<AutoReplyItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const inputCls =
    'w-full rounded-[14px] bg-[#F2F3F5] px-4 py-3 text-[15px] font-medium text-[#2B313D] outline-none transition-colors placeholder:font-normal placeholder:text-[#A4ABBA] focus:bg-[#EDEFF2]';

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-16" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="자동응답 관리" />

      <div className="space-y-5 px-4 pt-2">
        <p className="px-1 text-[13px] leading-[1.7] text-[#8B95A1]">
          고객이 문의를 보내면 인사말이 먼저 나가고, 이후 고객이 보낸 말에서 아래 키워드가 잡히면 답이 바로 나갑니다.
          질문들은 고객 화면에 버튼으로도 떠서 눌러 물어볼 수 있습니다. 사회자가 최근 3분 안에 직접 답한 방에는 끼어들지 않고,
          같은 답은 방마다 한 번만 나갑니다. 자동응답은 응답률과 평균 응답시간에 영향을 주지 않습니다.
        </p>

        {/* 인사말 */}
        <div>
          <MySectionTitle>첫 인사말</MySectionTitle>
          <div className={`${MY_CARD} p-5`}>
            <label className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold text-[#2B313D]">인사말 자동 발송</span>
              <input
                type="checkbox"
                checked={greetingEnabled}
                onChange={(e) => setGreetingEnabled(e.target.checked)}
                className="h-5 w-5 accent-[#3180F7]"
              />
            </label>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={7}
              placeholder={defaultGreeting}
              className={`${inputCls} resize-none leading-[1.7]`}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[12px] text-[#A4ABBA]">비워 두면 위 기본 문구가 나갑니다</p>
              {defaultGreeting && greeting !== defaultGreeting && (
                <button
                  type="button"
                  onClick={() => setGreeting(defaultGreeting)}
                  className="shrink-0 text-[13px] font-bold text-[#3180F7]"
                >
                  기본 문구 넣기
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 견적 문의 자동응답 */}
        <div>
          <MySectionTitle>견적 문의가 오면</MySectionTitle>
          <div className={`${MY_CARD} p-5`}>
            <label className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold text-[#2B313D]">견적 자동응답</span>
              <input
                type="checkbox"
                checked={quoteEnabled}
                onChange={(e) => setQuoteEnabled(e.target.checked)}
                className="h-5 w-5 accent-[#3180F7]"
              />
            </label>
            <p className="mb-2 text-[13px] leading-[1.7] text-[#8B95A1]">
              &quot;견적이 얼마인가요?&quot; 처럼 비용을 묻는 말이 오면 이 답이 바로 나갑니다.
              <br />
              <span className="font-semibold text-[#51535C]">{'{고객명}'}</span> 이라고 쓰면 고객 이름이 들어갑니다.
            </p>
            <textarea
              value={quoteReply}
              onChange={(e) => setQuoteReply(e.target.value)}
              rows={6}
              placeholder={'안녕하세요 {고객명}님, 문의 주셔서 감사합니다.\n\n결혼식 사회는 20만원 ~ 30만원 선이며, 수도권과 비수도권에 따라 편차가 있습니다.\n행사 날짜와 장소를 알려주시면 정확한 견적을 보내드릴게요.'}
              className={`${inputCls} resize-none leading-[1.7]`}
            />

            <div className="mt-4">
              <p className="mb-1.5 text-[13px] font-bold text-[#A4ABBA]">견적서 자동 발송 금액</p>
              <div className="relative">
                <input
                  value={quoteAmount ? Number(quoteAmount).toLocaleString() : ''}
                  onChange={(e) => setQuoteAmount(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="비워 두면 답변만 나갑니다"
                  className={`${inputCls} pr-10`}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#A4ABBA]">원</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-[1.6] text-[#A4ABBA]">
                금액을 적으면 답변과 함께 견적서까지 자동으로 발송됩니다. 방마다 한 번만 나갑니다.
              </p>
            </div>
          </div>
        </div>

        {/* 질문 목록 */}
        <div>
          <MySectionTitle>자주 묻는 질문 답변</MySectionTitle>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className={`${MY_CARD} p-5`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#A4ABBA]">질문 {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="삭제"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#C8CEDA] active:bg-[#F2F3F5]"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                <input
                  value={item.question}
                  onChange={(e) => update(index, { question: e.target.value })}
                  placeholder="예) 견적이 어떻게 되나요?"
                  className={inputCls}
                />
                <input
                  value={item.keywords || ''}
                  onChange={(e) => update(index, { keywords: e.target.value })}
                  placeholder="이 말이 오면 답한다 (쉼표로, 예: 대본, 멘트, 식순)"
                  className={`${inputCls} mt-2`}
                />
                <textarea
                  value={item.answer}
                  onChange={(e) => update(index, { answer: e.target.value })}
                  rows={4}
                  placeholder="고객에게 나갈 답변을 적어주세요"
                  className={`${inputCls} mt-2 resize-none leading-[1.7]`}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { question: '', answer: '' }])}
              className="h-12 w-full rounded-[14px] border border-dashed border-[#C8CEDA] text-[14px] font-bold text-[#51535C] transition-colors active:bg-[#F7F8FA]"
            >
              + 질문 추가
            </button>
          </div>
        </div>

        {/* 추천 질문 */}
        {suggested.length > 0 && (
          <div>
            <MySectionTitle>많이 받는 질문 — 눌러서 추가</MySectionTitle>
            <div className="flex flex-wrap gap-2">
              {suggested
                .filter((q) => !items.some((item) => item.question === q))
                .map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setItems((prev) => [...prev, { question: q, answer: '' }])}
                    className="rounded-full bg-[#F2F3F5] px-3.5 py-2 text-[13px] font-semibold text-[#51535C] transition-colors active:bg-[#E4E7EB]"
                  >
                    {q}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* 저장 — 하단 네비에 가리지 않도록 흐름 안에 둔다 */}
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="h-[52px] w-full rounded-[14px] bg-[#3180F7] text-[15px] font-bold text-white transition-colors active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
