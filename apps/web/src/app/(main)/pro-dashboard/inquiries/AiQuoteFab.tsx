'use client';

// 새요청 'AI 응답설정'(옛 'AI 자동매칭') 플로팅 버튼(260926 사장 "네비게이션 바 위에 AI 자동매칭 플로팅 — 견적가·출장비 등 추가 비용을 적어 두면
// 고객이 '견적 얼마예요?' 할 때 자동 답장").
//  · 저장 = 자동응답 '견적' 항목(quoteReply·quoteAmount·quoteEnabled). 인사말·질문 답변·자동 승인은 받아 온 그대로 다시 보낸다(PUT 이 통째 교체라서).
//  · 답장 문장은 사회자가 적은 값으로만 만들고, 저장 전에 그대로 보여 준다 — 런타임엔 이 문장이 글자 그대로 나간다(AI 가 금액을 지어내지 않는다).
//  · 기본 견적가는 견적서 카드 금액으로도 쓰인다(고객이 견적을 물으면 답장 뒤에 카드가 붙는다).
//  · 인터랙션(260927 사장 '뒤가 스크롤되면 안 됨, 모달 안 요소가 뚝 생김, 인풋도 자연스럽게 늘어나게 — 고급스럽게 전부'):
//    뒤 화면 잠금(useBodyScrollLock) · 시트는 스프링으로 올라오고 닫을 땐 내려간다 · 불러오기 뼈대 → 내용은 높이가 늘어나며 항목이 차례로 떠오름 ·
//    추가 비용 줄·미리보기는 높이 0 에서 펼쳐지고 접힘 · 미리보기 문장이 길어지면 높이도 따라 늘어남 · 칩은 빠질 때 나머지가 미끄러지듯 자리 이동.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, type Transition, type Variants } from 'framer-motion';
import toast from 'react-hot-toast';
import { autoReplyApi, type AutoReplySettings } from '@/lib/api/auto-reply.api';
import AiIcon from '@/components/icons/AiIcon';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useKeyboardInset } from '@/lib/useKeyboardInset';

type Extra = { id: number; name: string; price: string };

// 줄마다 고유 id — 빼거나 넣을 때 접힘·펼침 애니메이션이 제 줄에 붙게(순번 key 면 엉뚱한 줄이 접힌다)
let extraSeq = 0;
const newExtra = (name = '', price = ''): Extra => ({ id: ++extraSeq, name, price });

const SHEET_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };
const SOFT_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 };
// 불러오기 뼈대 칸 높이(윗여백 24 + 56 + 12 + 56) — 내용은 이 높이에서 출발해 제 높이로 늘어난다
const SKELETON_HEIGHT = 148;

const listVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 420, damping: 36 }, transitionEnd: { filter: 'none' } },
};

/** 안의 높이가 바뀌면(미리보기 문장이 한 줄 늘 때 등) 부드럽게 따라 늘고 준다 */
function AutoHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height }} transition={SOFT_SPRING} style={{ overflow: 'hidden' }}>
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

/** 높이 0 ↔ 제 높이로 펼쳐지고 접히는 칸(추가 비용 줄·미리보기·칩 묶음) */
function Collapse({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, y: -6 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -6 }}
      transition={SOFT_SPRING}
      style={{ overflow: 'hidden' }}
    >
      {children}
    </motion.div>
  );
}

// .ft-chip 의 transform 전환(.1s)이 framer 가 매 프레임 바꾸는 transform 을 뒤늦게 따라가 끌린다 → 색 전환만 남긴다
const CHIP_STYLE = { transition: 'background-color .15s ease, color .15s ease' };

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
    .map((m) => newExtra(m[1], m[2] || ''));
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
  // 불러오기 뼈대 → 내용으로 높이가 다 늘어난 뒤엔 잘림(overflow) 풀기
  const [expanded, setExpanded] = useState(false);
  // PC(640 이상)는 가운데 카드로 떠오르고, 모바일은 아래에서 올라온다
  const [centered, setCentered] = useState(false);
  const scrimRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  const keyboardInset = useKeyboardInset(open, scrimRef);

  const openSheet = async () => {
    setCentered(window.matchMedia('(min-width: 640px)').matches);
    setExpanded(false);
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
    setExtras((prev) => (prev.length >= MAX_EXTRAS ? prev : [...prev, newExtra(name)]));
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
      toast.success(enabled ? 'AI 응답을 켰어요' : '저장했어요 (AI 응답은 꺼 둠)');
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
        // 흰 알약 + 얇은 테두리(260926 사장 '버튼이 어색함' — 파란 그라데이션 안의 옅은 타일이 따로 놀았다)
        className="fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-[#E5E8EB] bg-white pl-2 pr-[18px] text-[15px] font-semibold tracking-[-0.2px] text-[#191F28] shadow-[0_6px_20px_rgba(15,23,42,0.08)] transition active:scale-95 bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] lg:bottom-8 lg:right-8"
      >
        <AiIcon size={32} />
        AI 응답설정
      </button>

      {/* 동작 줄이기 설정이면 움직임(위치·크기)은 빼고 옅어짐만 */}
      <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            key="ai-quote-scrim"
            ref={scrimRef}
            className="ft-scrim"
            // CSS 등장(ftFade)은 끄고 여기서 — 닫을 때도 옅어지며 사라지게
            style={{ animation: 'none', paddingBottom: keyboardInset || undefined }}
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => !saving && setOpen(false)}
          >
            <motion.div
              className="ft-sheet"
              role="dialog"
              aria-modal="true"
              style={{ animation: 'none', overscrollBehavior: 'contain' }}
              initial={centered ? { opacity: 0, y: 18, scale: 0.97 } : { y: '100%' }}
              animate={centered ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={centered ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={SHEET_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title flex items-center gap-2"><AiIcon size={28} />AI 응답설정</h2>
              <p className="ft-desc">견적을 적어 두면 고객이 &lsquo;견적 얼마예요?&rsquo; 하고 물을 때 바로 답해 드려요.</p>

              <AnimatePresence initial={false} mode="popLayout">
                {loading ? (
                  <motion.div key="skeleton" className="space-y-3 pt-6" exit={{ opacity: 0, transition: { duration: 0.14 } }}>
                    <div className="h-14 animate-pulse rounded-[17px] bg-[#F2F4F6]" />
                    <div className="h-14 animate-pulse rounded-[17px] bg-[#F2F4F6]" />
                  </motion.div>
                ) : (
                  // 뼈대 높이에서 제 높이로 늘어나며, 안의 항목은 위에서부터 차례로 떠오른다
                  <motion.div
                    key="content"
                    initial={{ height: SKELETON_HEIGHT }}
                    animate={{ height: 'auto' }}
                    transition={SOFT_SPRING}
                    style={{ overflow: expanded ? 'visible' : 'hidden' }}
                    onAnimationComplete={() => setExpanded(true)}
                  >
                    <motion.div variants={listVariants} initial="hidden" animate="show">
                      {/* 기본 견적가 */}
                      <motion.div variants={itemVariants}>
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
                      </motion.div>

                      {/* 추가 비용 */}
                      <motion.div variants={itemVariants}>
                        <div className="mt-6 flex items-center justify-between">
                          <span className="text-[15px] font-semibold text-[#4E5968]">추가 비용</span>
                          <span className="text-[13px] text-[#B0B8C1]">최대 {MAX_EXTRAS}개</span>
                        </div>
                        <div className="mt-2">
                          <AnimatePresence initial={false}>
                            {extras.map((extra) => (
                              <Collapse key={extra.id}>
                                {/* 줄 사이 간격을 안쪽 여백으로 — 펼쳐지는 높이에 같이 실려 늘어난다 */}
                                <div className="flex items-center gap-2 pb-2">
                                  <input
                                    className="ft-input min-w-0 flex-[1.4]"
                                    placeholder="항목 (예: 출장비)"
                                    value={extra.name}
                                    maxLength={20}
                                    onChange={(e) => setExtras((prev) => prev.map((x) => (x.id === extra.id ? { ...x, name: e.target.value } : x)))}
                                  />
                                  <div className="relative min-w-0 flex-1">
                                    <input
                                      className="ft-input pr-12"
                                      inputMode="numeric"
                                      placeholder="금액"
                                      value={extra.price}
                                      onChange={(e) => setExtras((prev) => prev.map((x) => (x.id === extra.id ? { ...x, price: onlyDigits(e.target.value) } : x)))}
                                    />
                                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-[#8B95A1]">만원</span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    aria-label="항목 빼기"
                                    whileTap={{ scale: 0.88 }}
                                    onClick={() => setExtras((prev) => prev.filter((x) => x.id !== extra.id))}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px] text-[#B0B8C1] active:bg-[#F2F4F6]"
                                  >
                                    ×
                                  </motion.button>
                                </div>
                              </Collapse>
                            ))}
                          </AnimatePresence>
                        </div>
                        <AnimatePresence initial={false}>
                          {extras.length < MAX_EXTRAS && (
                            <Collapse key="chips">
                              <div className="relative flex flex-wrap gap-2 pt-1">
                                <AnimatePresence initial={false} mode="popLayout">
                                  {EXTRA_PRESETS.filter((name) => !extras.some((e) => e.name.trim() === name)).map((name) => (
                                    <motion.button
                                      key={name}
                                      layout
                                      type="button"
                                      className="ft-chip"
                                      style={CHIP_STYLE}
                                      initial={{ opacity: 0, scale: 0.85 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.85 }}
                                      whileTap={{ scale: 0.94 }}
                                      transition={SOFT_SPRING}
                                      onClick={() => addExtra(name)}
                                    >
                                      + {name}
                                    </motion.button>
                                  ))}
                                  <motion.button key="custom" layout type="button" className="ft-chip" style={CHIP_STYLE} whileTap={{ scale: 0.94 }} transition={SOFT_SPRING} onClick={() => addExtra('')}>
                                    + 직접 입력
                                  </motion.button>
                                </AnimatePresence>
                              </div>
                            </Collapse>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      {/* 미리보기 — 이 문장이 글자 그대로 나간다. 나타날 땐 펼쳐지고, 문장이 길어지면 높이도 따라 늘어난다 */}
                      <motion.div variants={itemVariants}>
                      <AnimatePresence initial={false}>
                        {preview && (
                          <Collapse key="preview">
                            <div className="pt-6">
                              <p className="text-[15px] font-semibold text-[#4E5968]">고객에게 이렇게 답해요</p>
                              <div className="mt-2 rounded-[17px] bg-[#F2F4F6]">
                                <AutoHeight>
                                  <p className="whitespace-pre-line px-4 py-3.5 text-[15px] leading-[1.6] text-[#191F28]">{preview}</p>
                                </AutoHeight>
                              </div>
                              {hadCustom && (
                                <p className="mt-2 text-[13px] leading-5 text-[#8B95A1]">직접 써 둔 견적 답장이 있어요. 저장하면 이 문장으로 바뀌어요.</p>
                              )}
                            </div>
                          </Collapse>
                        )}
                      </AnimatePresence>
                      </motion.div>

                      {/* 켜기 */}
                      <motion.div variants={itemVariants}>
                        <button
                          type="button"
                          onClick={() => setEnabled((v) => !v)}
                          className="mt-5 flex w-full items-center justify-between py-2 text-left"
                          aria-pressed={enabled}
                        >
                          <span className="text-[16px] font-semibold text-[#191F28]">AI 응답 켜기</span>
                          <span className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${enabled ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'}`}>
                            <motion.span
                              className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                              initial={false}
                              animate={{ x: enabled ? 22 : 2 }}
                              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                            />
                          </span>
                        </button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="ft-actions">
                <button type="button" className="ft-btn secondary" onClick={() => setOpen(false)} disabled={saving}>닫기</button>
                <button type="button" className="ft-btn primary" onClick={save} disabled={loading || saving || !base}>
                  {saving ? '저장 중' : '저장하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </MotionConfig>
    </>
  );
}
