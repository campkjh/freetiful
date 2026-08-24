'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  autoReplyApi,
  type AutoReplyItem,
  type Persona,
  type PersonaCall,
  type PersonaEmoji,
  type PersonaGuard,
  type PersonaLength,
  type PersonaTone,
  type PreviewResult,
} from '@/lib/api/auto-reply.api';
import { CloseIcon } from '@/components/icons/mono';
import { MY_CARD, MySectionTitle, MyDetailHeader } from '../../my/_components/detail-ui';

/**
 * 사회자 자동응답 관리.
 *
 * 고객이 문의를 열면 여기 적어 둔 인사말이 먼저 나가고, 질문 목록은 고객 화면에
 * 버튼으로 떠서 누르면 바로 답이 간다. 아무것도 안 적어도 인사말은 기본 문구로 나간다.
 */
const TONE_OPTIONS: { v: PersonaTone; label: string; hint: string }[] = [
  { v: 'trust', label: '단정하게', hint: '군더더기 없이 정중하게' },
  { v: 'warm', label: '다정하게', hint: '안심시키는 따뜻한 말투' },
  { v: 'bright', label: '밝게', hint: '유쾌하고 활기차게' },
  { v: 'plain', label: '담백하게', hint: '인사 최소, 사실 위주' },
];
const CALL_OPTIONS: { v: PersonaCall; label: string }[] = [
  { v: 'customer', label: '고객님' },
  { v: 'couple', label: '신랑신부님' },
  { v: 'name', label: '○○님' },
];
const LENGTH_OPTIONS: { v: PersonaLength; label: string }[] = [
  { v: 'short', label: '짧게' },
  { v: 'normal', label: '보통' },
  { v: 'long', label: '자세히' },
];
const EMOJI_OPTIONS: { v: PersonaEmoji; label: string }[] = [
  { v: 'none', label: '안 씀' },
  { v: 'some', label: '가끔' },
  { v: 'many', label: '자주' },
];
const GUARD_OPTIONS: { v: PersonaGuard; label: string }[] = [
  { v: 'price', label: '금액은 적어 둔 그대로만 말하기' },
  { v: 'date', label: '날짜는 확정하지 않기' },
  { v: 'promise', label: '계약·환불 약속 안 하기' },
  { v: 'other', label: '다른 사회자 이야기 안 하기' },
];

/** 원탭 칩 — 40~60대 사회자가 주 사용자라 터치 영역과 글자를 크게 잡았다 */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-[14px] px-4 text-[15px] font-bold transition-colors ${
        active ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#51535C] active:bg-[#E4E7EB]'
      }`}
    >
      {children}
    </button>
  );
}

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
  const [autoApprove, setAutoApprove] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [personaPresets, setPersonaPresets] = useState<string[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

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
        setAutoApprove(Boolean(data.autoApprove));
        // 자동응답이 비어 있으면 이미 써 둔 프로필 FAQ 를 그대로 채워 준다
        setItems(
          data.items.length > 0
            ? data.items
            : (data.faqSuggestions || []).map((faq) => ({ question: faq.question, answer: faq.answer })),
        );
      })
      .catch(() => toast.error('불러오지 못했어요'))
      .finally(() => setLoading(false));

    autoReplyApi
      .getPersona()
      .then((data) => {
        const { aiAvailable: avail, signaturePresets, ...rest } = data;
        setPersona(rest);
        setPersonaPresets(signaturePresets || []);
        setAiAvailable(Boolean(avail));
      })
      .catch(() => {});
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
        autoApprove,
      });
      if (persona) await autoReplyApi.savePersona(persona);
      toast.success('저장했어요');
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 내 말투로 다듬기 — 자아가 실제로 고객에게 닿는 주 경로.
   * 결과는 폼에만 반영되고 사회자가 저장을 눌러야 들어간다(사람이 반드시 눈으로 본다).
   */
  const rewriteWith = async (tag: string, text: string, apply: (next: string) => void) => {
    if (!text.trim()) { toast('먼저 문구를 적어주세요'); return; }
    setRewriting(tag);
    try {
      const r = await autoReplyApi.rewrite(text);
      if (!r.changed) { toast(r.reason || '고칠 부분이 없었어요'); return; }
      apply(r.text);
      toast.success('내 말투로 다듬었어요. 확인하고 저장해주세요');
    } catch {
      toast.error('다듬기에 실패했어요');
    } finally {
      setRewriting(null);
    }
  };

  const RewriteButton = ({ tag, text, apply }: { tag: string; text: string; apply: (v: string) => void }) => (
    <button
      type="button"
      disabled={rewriting !== null}
      onClick={() => rewriteWith(tag, text, apply)}
      className="shrink-0 text-[13px] font-bold text-[#3180F7] disabled:opacity-50"
    >
      {rewriting === tag ? '다듬는 중...' : '✨ 내 말투로 다듬기'}
    </button>
  );

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

        {/* 자동 승인 */}
        <div>
          <MySectionTitle>섭외 요청이 오면</MySectionTitle>
          <div className={`${MY_CARD} p-5`}>
            <label className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#2B313D]">자동 승인</span>
                <span className="mt-1 block text-[13px] leading-[1.7] text-[#8B95A1]">
                  켜 두면 새 요청을 수락하지 않아도 대화방이 바로 열리고 인사말이 나갑니다.
                  고객이 기다리지 않아도 되지만, 받을 수 없는 일정도 대화가 시작됩니다.
                </span>
              </span>
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#3180F7]"
              />
            </label>
          </div>
        </div>

        {/* 자아(말투) — 사회자가 "나답게" 를 심는 곳 */}
        {persona && (
          <div>
            <MySectionTitle>내 자아 — 어떻게 말할지</MySectionTitle>
            <div className={`${MY_CARD} p-5`}>
              <label className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[#2B313D]">AI가 알아서 답하기</span>
                  <span className="mt-1 block text-[13px] leading-[1.7] text-[#8B95A1]">
                    켜 두면 고객이 다르게 물어봐도 뜻이 같으면 알아서 맞는 답을 골라 보냅니다.
                    <b className="font-semibold text-[#51535C]"> 보내는 문장은 아래에 적어 두신 그대로</b>이고,
                    적어 두지 않은 금액·날짜는 절대 지어내지 않습니다.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={persona.aiEnabled}
                  onChange={(e) => setPersona({ ...persona, aiEnabled: e.target.checked })}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#3180F7]"
                />
              </label>
              {!aiAvailable && (
                <p className="mt-2 rounded-[10px] bg-[#FFF4F4] px-3 py-2 text-[12px] font-medium text-[#D14343]">
                  현재 AI 기능이 꺼져 있어 기존 키워드 방식으로만 답합니다.
                </p>
              )}

              <div className="mt-5 border-t border-[#F1F3F6] pt-4">
                <p className="mb-2 text-[13px] font-bold text-[#A4ABBA]">말투</p>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((o) => (
                    <Chip key={o.v} active={persona.tone === o.v} onClick={() => setPersona({ ...persona, tone: o.v })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] text-[#A4ABBA]">
                  {TONE_OPTIONS.find((o) => o.v === persona.tone)?.hint}
                </p>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[13px] font-bold text-[#A4ABBA]">고객을 부르는 말</p>
                <div className="flex flex-wrap gap-2">
                  {CALL_OPTIONS.map((o) => (
                    <Chip key={o.v} active={persona.call === o.v} onClick={() => setPersona({ ...persona, call: o.v })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-6">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[13px] font-bold text-[#A4ABBA]">답변 길이</p>
                  <div className="flex flex-wrap gap-2">
                    {LENGTH_OPTIONS.map((o) => (
                      <Chip key={o.v} active={persona.length === o.v} onClick={() => setPersona({ ...persona, length: o.v })}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[13px] font-bold text-[#A4ABBA]">이모지</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((o) => (
                      <Chip key={o.v} active={persona.emoji === o.v} onClick={() => setPersona({ ...persona, emoji: o.v })}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-[#F1F3F6] pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-[#A4ABBA]">나는 이런 사회자예요</p>
                  <button
                    type="button"
                    disabled={drafting}
                    onClick={async () => {
                      setDrafting(true);
                      try {
                        const d = await autoReplyApi.draftPersona();
                        if (d.needsProfile) {
                          toast(d.message || '프로필을 먼저 채워주세요');
                          return;
                        }
                        setPersona((prev) => (prev ? {
                          ...prev,
                          personaText: d.personaText || prev.personaText,
                          tone: d.tone || prev.tone,
                          length: d.length || prev.length,
                          signatures: d.signatures?.length ? d.signatures : prev.signatures,
                        } : prev));
                        toast.success('초안을 만들었어요. 고쳐서 쓰세요');
                      } catch {
                        toast.error('초안 작성에 실패했어요');
                      } finally {
                        setDrafting(false);
                      }
                    }}
                    className="shrink-0 text-[13px] font-bold text-[#3180F7] disabled:opacity-50"
                  >
                    {drafting ? '작성 중...' : '✨ 프로필로 자동 작성'}
                  </button>
                </div>
                <textarea
                  value={persona.personaText}
                  onChange={(e) => setPersona({ ...persona, personaText: e.target.value })}
                  rows={4}
                  placeholder="비워 두셔도 됩니다. 위 버튼을 누르면 프로필을 보고 대신 써 드려요."
                  className={`${inputCls} resize-none leading-[1.7]`}
                />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[13px] font-bold text-[#A4ABBA]">자주 쓰는 말 — 눌러서 고르기 (최대 3개)</p>
                <div className="flex flex-wrap gap-2">
                  {personaPresets.map((s) => {
                    const on = persona.signatures.includes(s);
                    return (
                      <Chip
                        key={s}
                        active={on}
                        onClick={() =>
                          setPersona({
                            ...persona,
                            signatures: on
                              ? persona.signatures.filter((v) => v !== s)
                              : persona.signatures.length >= 3
                                ? persona.signatures
                                : [...persona.signatures, s],
                          })
                        }
                      >
                        {s}
                      </Chip>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-[#F1F3F6] pt-4">
                <p className="mb-1 text-[13px] font-bold text-[#A4ABBA]">이건 하지 않기</p>
                <p className="mb-2 text-[12px] leading-[1.6] text-[#A4ABBA]">
                  분쟁이 되기 쉬운 것들이라 켜 두시길 권합니다.
                </p>
                {GUARD_OPTIONS.map((o) => (
                  <label key={o.v} className="flex h-12 items-center justify-between border-t border-[#F1F3F6] first:border-t-0">
                    <span className="text-[14px] font-medium text-[#2B313D]">{o.label}</span>
                    <input
                      type="checkbox"
                      checked={persona.guards.includes(o.v)}
                      onChange={(e) =>
                        setPersona({
                          ...persona,
                          guards: e.target.checked
                            ? [...persona.guards, o.v]
                            : persona.guards.filter((g) => g !== o.v),
                        })
                      }
                      className="h-5 w-5 shrink-0 accent-[#3180F7]"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 미리보기 — 내가 심어 둔 대로 정말 답하는지 바로 확인 */}
        <div>
          <MySectionTitle>이렇게 물어보면? — 미리 확인하기</MySectionTitle>
          <div className={`${MY_CARD} p-5`}>
            <div className="flex gap-2">
              <input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="예) 1부만 하면 얼마예요?"
                className={`${inputCls} flex-1`}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <button
                type="button"
                disabled={previewing || !previewText.trim()}
                onClick={async () => {
                  setPreviewing(true);
                  setPreview(null);
                  try {
                    setPreview(await autoReplyApi.preview(previewText));
                  } catch {
                    toast.error('미리보기에 실패했어요');
                  } finally {
                    setPreviewing(false);
                  }
                }}
                className="h-[46px] shrink-0 rounded-[14px] bg-[#2B313D] px-4 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {previewing ? '...' : '확인'}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-[#A4ABBA]">
              저장한 설정 기준입니다. 바꾼 내용을 확인하려면 먼저 저장해주세요.
            </p>
            {preview && (
              <div className="mt-3">
                {preview.willReply ? (
                  <>
                    <div className="rounded-[14px] rounded-tl-[4px] bg-[#F2F3F5] px-4 py-3 text-[14px] leading-[1.7] text-[#2B313D] whitespace-pre-wrap">
                      {preview.answer}
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#A4ABBA]">
                      {preview.aiUsed ? 'AI가 뜻을 보고 골랐어요' : '키워드로 찾았어요'}
                    </p>
                  </>
                ) : (
                  <div className="rounded-[14px] bg-[#FFF8E8] px-4 py-3 text-[13px] leading-[1.7] text-[#8A6A18]">
                    답장하지 않아요 — {preview.reason}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
              <RewriteButton tag="greeting" text={greeting} apply={setGreeting} />
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
            <div className="mb-2 flex justify-end">
              <RewriteButton tag="quote" text={quoteReply} apply={setQuoteReply} />
            </div>
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
                <div className="mt-2 flex justify-end">
                  <RewriteButton
                    tag={`qa-${index}`}
                    text={item.answer}
                    apply={(v) => update(index, { answer: v })}
                  />
                </div>
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
