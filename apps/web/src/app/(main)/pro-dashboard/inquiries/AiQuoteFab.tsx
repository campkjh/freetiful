'use client';

// 새요청 'AI 자동매칭' 플로팅 버튼(260926 사장 "네비게이션 바 위에 AI 자동매칭 플로팅 — 견적가·출장비 등 추가 비용을 적어 두면
// 고객이 '견적 얼마예요?' 할 때 자동 답장").
//  · 저장 = 자동응답 '견적' 항목(quoteReply·quoteAmount·quoteEnabled). 인사말·질문 답변·자동 승인은 받아 온 그대로 다시 보낸다(PUT 이 통째 교체라서).
//  · 답장 문장은 사회자가 적은 값으로만 만들고, 저장 전에 그대로 보여 준다 — 런타임엔 이 문장이 글자 그대로 나간다(AI 가 금액을 지어내지 않는다).
//  · 기본 견적가는 견적서 카드 금액으로도 쓰인다(고객이 견적을 물으면 답장 뒤에 카드가 붙는다).
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { autoReplyApi, type AutoReplySettings } from '@/lib/api/auto-reply.api';
import AiIcon from '@/components/icons/AiIcon';

type Extra = { name: string; price: string };

const EXTRA_PRESETS = ['출장비', '2부 진행', '야간 진행', '리허설 참석', '영어 진행'];
const MAX_EXTRAS = 6;

const onlyDigits = (v: string) => v.replace(/[^\d]/g, '').slice(0, 5);

/** 사회자가 적은 값으로만 답장 문장을 만든다(문단은 빈 줄로 — 사람처럼 문단마다 나눠 보낸다) */
function composeQuoteReply(base: string, extras: Extra[]) {
  const lines = extras
    .map((e) => ({ name: e.name.trim(), price: onlyDigits(e.price) }))
    .filter((e) => e.name)
    .map((e) => (e.price ? `· ${e.name} ${Number(e.price)}만원` : `· ${e.name}`));
  return [
    `기본 진행 견적은 ${Number(base)}만원이에요.`,
    lines.length ? ['추가 비용', ...lines].join('\n') : '',
    '행사 날짜와 장소를 알려주시면 더 정확하게 안내드릴게요!',
  ].filter(Boolean).join('\n\n');
}

/** 이 화면에서 만든 문장이면 값으로 되돌린다(직접 쓴 문장이면 null) */
function parseQuoteReply(text: string): { base: string; extras: Extra[] } | null {
  const base = text.match(/^기본 진행 견적은 (\d+)만원이에요\./);
  if (!base) return null;
  const extras = text
    .split('\n')
    .map((line) => line.match(/^· (.+?)(?: (\d+)만원)?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ name: m[1], price: m[2] || '' }));
  return { base: base[1], extras };
}

export default function AiQuoteFab() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutoReplySettings | null>(null);
  const [base, setBase] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [hadCustom, setHadCustom] = useState(false);

  const openSheet = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const mine = await autoReplyApi.getMine();
      setSettings(mine);
      const parsed = parseQuoteReply(mine.quoteReply || '');
      const fromAmount = mine.quoteAmount && mine.quoteAmount > 0 ? String(Math.round(mine.quoteAmount / 10000)) : '';
      setBase(parsed?.base || fromAmount);
      setExtras(parsed?.extras || []);
      setEnabled(mine.quoteReply ? mine.quoteEnabled : true);
      setHadCustom(Boolean(mine.quoteReply) && !parsed);
    } catch {
      toast.error('설정을 불러오지 못했어요');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const preview = useMemo(() => (base ? composeQuoteReply(base, extras) : ''), [base, extras]);

  const addExtra = (name = '') => {
    setExtras((prev) => (prev.length >= MAX_EXTRAS ? prev : [...prev, { name, price: '' }]));
  };

  const save = async () => {
    if (!settings || saving) return;
    if (!base || Number(base) <= 0) {
      toast.error('기본 견적가를 적어 주세요');
      return;
    }
    setSaving(true);
    try {
      const next = await autoReplyApi.saveMine({
        greeting: settings.greeting,
        greetingEnabled: settings.greetingEnabled,
        items: settings.items,
        quoteReply: composeQuoteReply(base, extras),
        quoteAmount: Number(base) * 10000,
        quoteEnabled: enabled,
        autoApprove: settings.autoApprove,
      });
      // 'AI 자동매칭' 이니 AI 도 같이 켠다 — '견적 얼마예요?' 의 다른 표현('페이가 어느 정도예요?')까지 알아듣게(끄면 같이 끈다)
      await autoReplyApi.savePersona({ aiEnabled: enabled }).catch(() => undefined);
      setSettings(next);
      setOpen(false);
      toast.success(enabled ? 'AI 자동 답장을 켰어요' : '저장했어요 (자동 답장은 꺼 둠)');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* 하단 탭 바로 위에 떠 있는 버튼(PC 는 오른쪽 아래) */}
      <button
        type="button"
        onClick={openSheet}
        className="fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#3182F6] to-[#6B5CFF] pl-2 pr-5 text-[15px] font-semibold tracking-[-0.2px] text-white transition active:scale-95 bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] lg:bottom-8 lg:right-8"
      >
        <AiIcon size={32} />
        AI 자동매칭
      </button>

      {open && (
        <div className="ft-scrim" onClick={() => !saving && setOpen(false)}>
          <div className="ft-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="ft-grab" aria-hidden="true" />
            <h2 className="ft-title flex items-center gap-2"><AiIcon size={28} />AI 자동매칭</h2>
            <p className="ft-desc">견적을 적어 두면 고객이 &lsquo;견적 얼마예요?&rsquo; 하고 물을 때 바로 답해 드려요.</p>

            {loading ? (
              <div className="mt-6 space-y-3">
                <div className="h-14 animate-pulse rounded-[17px] bg-[#F2F4F6]" />
                <div className="h-14 animate-pulse rounded-[17px] bg-[#F2F4F6]" />
              </div>
            ) : (
              <>
                {/* 기본 견적가 */}
                <label className="mt-6 block text-[15px] font-semibold text-[#4E5968]">기본 견적가</label>
                <div className="relative mt-2">
                  <input
                    className="ft-input pr-16"
                    inputMode="numeric"
                    placeholder="예) 45"
                    value={base}
                    onChange={(e) => setBase(onlyDigits(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[17px] text-[#8B95A1]">만원</span>
                </div>

                {/* 추가 비용 */}
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-[#4E5968]">추가 비용</span>
                  <span className="text-[13px] text-[#B0B8C1]">최대 {MAX_EXTRAS}개</span>
                </div>
                <div className="mt-2 space-y-2">
                  {extras.map((extra, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="ft-input min-w-0 flex-[1.4]"
                        placeholder="항목 (예: 출장비)"
                        value={extra.name}
                        maxLength={20}
                        onChange={(e) => setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      />
                      <div className="relative min-w-0 flex-1">
                        <input
                          className="ft-input pr-12"
                          inputMode="numeric"
                          placeholder="금액"
                          value={extra.price}
                          onChange={(e) => setExtras((prev) => prev.map((x, j) => (j === i ? { ...x, price: onlyDigits(e.target.value) } : x)))}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-[#8B95A1]">만원</span>
                      </div>
                      <button
                        type="button"
                        aria-label="항목 빼기"
                        onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px] text-[#B0B8C1] active:bg-[#F2F4F6]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {extras.length < MAX_EXTRAS && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EXTRA_PRESETS.filter((name) => !extras.some((e) => e.name.trim() === name)).map((name) => (
                      <button key={name} type="button" className="ft-chip" onClick={() => addExtra(name)}>+ {name}</button>
                    ))}
                    <button type="button" className="ft-chip" onClick={() => addExtra('')}>+ 직접 입력</button>
                  </div>
                )}

                {/* 미리보기 — 이 문장이 글자 그대로 나간다 */}
                {preview && (
                  <div className="mt-6">
                    <p className="text-[15px] font-semibold text-[#4E5968]">고객에게 이렇게 답해요</p>
                    <p className="mt-2 whitespace-pre-line rounded-[17px] bg-[#F2F4F6] px-4 py-3.5 text-[15px] leading-[1.6] text-[#191F28]">{preview}</p>
                    {hadCustom && (
                      <p className="mt-2 text-[13px] leading-5 text-[#8B95A1]">직접 써 둔 견적 답장이 있어요. 저장하면 이 문장으로 바뀌어요.</p>
                    )}
                  </div>
                )}

                {/* 켜기 */}
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  className="mt-5 flex w-full items-center justify-between py-2 text-left"
                  aria-pressed={enabled}
                >
                  <span className="text-[16px] font-semibold text-[#191F28]">AI 자동 답장</span>
                  <span className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'}`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              </>
            )}

            <div className="ft-actions">
              <button type="button" className="ft-btn secondary" onClick={() => setOpen(false)} disabled={saving}>닫기</button>
              <button type="button" className="ft-btn primary" onClick={save} disabled={loading || saving || !base}>
                {saving ? '저장 중' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
