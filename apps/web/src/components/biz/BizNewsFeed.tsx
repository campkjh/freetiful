'use client';

/*
 * 프리티풀 뉴스 — 비즈 '뉴스·소식' 탭의 기사 카드 목록 + 본문 시트(261009 사장 '뉴스소식은 공지사항으로 이동하는 게 아니라
 * 따로 프리티풀 뉴스 페이지로, 물론 디자인은 공지사항처럼').
 *  · 카드 = 공지사항(마이 > 공지사항)과 같은 뉴스룸 카드(AnnouncementFeed 의 NewsroomCard 를 그대로 같이 쓴다 — 4:3 · 큰 모서리 ·
 *    그림 가득 · 아래 그라데이션 블러 · '태그 | 날짜' · 굵은 제목 2줄). 모바일 1열 · 넓은 화면 2열, 차례 등장.
 *  · 위에 거르기 칩(전체 · 웨딩홀 · 기업행사 · 회사 소식) — 고른 칩 뒤 검은 알약이 칩 사이를 미끄러져 옮겨 가고(웨딩숲 분류 알약과 같은 손맛),
 *    목록은 새로 차례 등장한다.
 *  · 누르면 공지 시트와 같은 스프링 시트(ft-sheet) — 맨 위 큰 그림(송년회는 영상) · 태그 · 날짜 · 제목 · 요지 · 핵심 줄 · 맺음 ·
 *    연혁 기사면 '프리티풀이 걸어온 길'(눌러서 그 기사로 바로 넘어감) · 아래 단추(닫기 + 이어지는 곳). 손잡이를 끌어내려도 닫힌다.
 *  · 기사 데이터 = lib/biz/news.ts(정적 · 사실만). 주소에 #기사id 를 붙이면 그 기사 시트가 바로 열린다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useDragControls, type PanInfo } from 'framer-motion';
import { Check, Play } from 'lucide-react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { NewsroomCard } from '@/components/announcements/AnnouncementFeed';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { BIZ_NEWS, BIZ_NEWS_MILESTONES, BIZ_NEWS_TAGS, BIZ_NEWS_TAG_LABEL, type BizNewsItem, type BizNewsTag } from '@/lib/biz/news';

type Filter = 'all' | BizNewsTag;

/** 고른 칩 — 다른 화면에 갔다가 뒤로 돌아오면 그대로(모듈 변수: 새로 고침이면 '전체'로) */
let savedFilter: Filter = 'all';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function BizNewsFeed({ className = 'px-5 sm:px-8 lg:px-10' }: { className?: string }) {
  const t = useT();
  const { lang } = useBizLang();
  const [filter, setFilter] = useState<Filter>(() => savedFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  // 처음 그릴 땐 공지 카드와 같은 지연(큰 제목 뒤에 이어서), 칩을 바꾼 뒤엔 바로 차례 등장
  const [changed, setChanged] = useState(false);

  const items = useMemo(() => (filter === 'all' ? BIZ_NEWS : BIZ_NEWS.filter((n) => n.tag === filter)), [filter]);
  const rowRef = useRef<HTMLDivElement>(null);

  // 고른 칩이 칸 밖(영어 · 일본어처럼 칩이 길어 옆으로 밀린 때)이면 그 칩이 보이게 칩 줄만 옆으로 민다(화면은 그대로)
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !chip) return;
    const pad = 20;
    const left = chip.offsetLeft - pad;
    const right = chip.offsetLeft + chip.offsetWidth + pad - row.clientWidth;
    if (row.scrollLeft > left) row.scrollTo({ left, behavior: 'smooth' });
    else if (row.scrollLeft < right) row.scrollTo({ left: right, behavior: 'smooth' });
  }, [filter, lang]);
  const open = openId ? BIZ_NEWS.find((n) => n.id === openId) ?? null : null;

  // 닫으면 주소의 #기사id 도 지운다 — 남겨 두면 다른 화면에 갔다가 뒤로 왔을 때 시트가 또 열렸다
  const close = useCallback(() => {
    setOpenId(null);
    if (window.location.hash) {
      try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); } catch { /* noop */ }
    }
  }, []);

  const pick = (f: Filter) => {
    if (f === filter) return;
    savedFilter = f;
    setFilter(f);
    setChanged(true);
  };

  // 주소 #기사id → 그 기사 바로 열기(비즈 다른 화면 · 바깥 링크에서 한 기사를 가리킬 때). 이 화면에 있는 채 #만 바뀌어도 연다
  useEffect(() => {
    const fromHash = () => {
      let id = '';
      try { id = decodeURIComponent(window.location.hash.replace(/^#/, '')); } catch { /* 깨진 % 표기 */ }
      if (id && BIZ_NEWS.some((n) => n.id === id)) setOpenId(id);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  return (
    <>
      <div className={className}>
        {/* 거르기 칩 — 좁은 폭에서 넘치면(영어 등) 옆으로 밀린다. 바깥 여백까지 밀리게 -mx 로 칸을 넓힌다 */}
        <MotionConfig reducedMotion="user">
          <LayoutGroup id="biz-news-filter">
            <div
              ref={rowRef}
              role="tablist"
              aria-label={t({ ko: '소식 거르기', en: 'Filter news', ja: 'ニュースの絞り込み', zh: '筛选资讯' })}
              className="qd-a-title scrollbar-hide relative -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:mb-8 lg:px-10"
              style={{ animationDelay: '.14s' }}
            >
              {BIZ_NEWS_TAGS.map((c) => {
                const on = c.id === filter;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => pick(c.id)}
                    className={`relative h-[38px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[15px] font-semibold tracking-[-0.2px] transition-[color,transform] duration-200 active:scale-[0.96] lg:h-[42px] lg:px-[18px] lg:text-[16px] ${
                      on ? 'text-white' : 'bg-[#F2F4F6] text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="biz-news-chip"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-[#191F28]"
                        transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.8 }}
                      />
                    )}
                    <span className="relative">{t(c.label)}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </MotionConfig>

        {/* 카드 — 칩을 바꾸면 칸 묶음째 새로 그려 차례 등장을 다시 돈다 */}
        <div key={filter} role="tabpanel" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
          {items.map((n, i) => (
            <NewsroomCard
              key={n.id}
              art={{ src: n.image.src, bg: n.image.bg, cover: true, position: n.image.position, veil: n.image.veil }}
              tag={t(BIZ_NEWS_TAG_LABEL[n.tag])}
              date={n.date}
              title={t(n.title)}
              index={i}
              delay={changed ? 0.04 + Math.min(i, 10) * 0.05 : undefined}
              onOpen={() => setOpenId(n.id)}
            />
          ))}
        </div>
      </div>

      <NewsSheet item={open} lang={lang} onSelect={setOpenId} onClose={close} />
    </>
  );
}

/* ───────────────────────── 본문 시트 ───────────────────────── */

/** 넓은 화면(≥640)에선 시트가 가운데 카드라(globals .ft-sheet) 아래에서 올라오지 않고 살짝 떠오른다 */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(min-width: 640px)');
    } catch {
      return;
    }
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
}

function NewsSheet({
  item,
  lang,
  onSelect,
  onClose,
}: {
  item: BizNewsItem | null;
  lang: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const wide = useWide();
  const drag = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(!!item);

  // Esc 로 닫기 · 열리면 시트에 초점(화면 읽기 프로그램이 시트부터 읽게)
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);
  const itemId = item?.id;
  useEffect(() => {
    if (!itemId) return;
    scrollRef.current?.scrollTo({ top: 0 });
    sheetRef.current?.focus({ preventScroll: true });
  }, [itemId]);

  /** 손잡이를 아래로 끌어 놓으면 — 충분히 내렸거나 빠르게 튕기면 닫고, 아니면 제자리로 */
  const onDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 640) onClose();
  }, [onClose]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {item && (
          <motion.div
            key="biz-news-scrim"
            className="ft-scrim"
            style={{ animation: 'none' }}
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            onClick={onClose}
          >
            <motion.div
              ref={sheetRef}
              tabIndex={-1}
              // 시트 자체는 스크롤하지 않고(overflow hidden) 글 칸만 스크롤 — 아래 단추가 늘 보이게(긴 기사에서 '닫기'를 찾아 끝까지 내리지 않게)
              className="ft-sheet wide flex flex-col outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="biz-news-title"
              style={{ animation: 'none', overflow: 'hidden' }}
              initial={wide ? { opacity: 0, y: 28, scale: 0.98 } : { y: '100%' }}
              animate={wide ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={wide ? { opacity: 0, y: 18, scale: 0.985, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              drag={wide ? false : 'y'}
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 손잡이 — 여기서만 끌기 시작(본문은 스크롤이라) */}
              <div
                className="-mx-6 -mt-5 cursor-grab touch-none px-6 pt-5 active:cursor-grabbing sm:hidden"
                onPointerDown={(e) => drag.start(e)}
              >
                <div className="ft-grab" aria-hidden="true" />
              </div>

              <div ref={scrollRef} className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-2 sm:-mx-7 sm:px-7" style={{ overscrollBehavior: 'contain' }}>
                <SheetHero key={`hero-${item.id}`} item={item} />

                {/* 글 칸 — 퀵매칭 어법대로 한 줄씩 오른쪽 → 왼쪽(.qd-body). 다른 기사로 넘어가면 key 가 바뀌어 다시 돈다 */}
                <div key={`body-${item.id}-${lang}`} className="qd-body">
                  <div className="mt-5 flex items-center gap-2 text-[13px] leading-[1.5]">
                    <span className="inline-flex h-6 items-center rounded-[7px] bg-[#E8F3FF] px-2 font-semibold text-[#3182F6]">{t(BIZ_NEWS_TAG_LABEL[item.tag])}</span>
                    <span className="font-medium tabular-nums text-[#8B95A1]">{item.date}</span>
                  </div>
                  <h2 id="biz-news-title" className="mt-3 break-keep text-[22px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28]">
                    {t(item.title)}
                  </h2>
                  <p className="mt-3 break-keep text-[16px] leading-[1.75] tracking-[-0.2px] text-[#4E5968]">{t(item.lead)}</p>
                  {item.points && item.points.length > 0 && (
                    <ul className="m-0 mt-5 list-none space-y-3 rounded-[20px] bg-[#F9FAFB] p-0 px-[18px] py-[18px]">
                      {item.points.map((p, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span aria-hidden="true" className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#3182F6]">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </span>
                          <span className="break-keep text-[15px] leading-[1.6] tracking-[-0.2px] text-[#4E5968]">{t(p)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.body && <p className="mt-4 break-keep text-[16px] leading-[1.75] tracking-[-0.2px] text-[#4E5968]">{t(item.body)}</p>}
                  {item.milestone && <Milestones currentId={item.id} onSelect={onSelect} />}
                </div>
              </div>

              {/* 아래 단추 — 글 칸 위로 흰 그라데이션을 얹어 글이 단추 밑으로 스며들듯 끝난다 */}
              <div className="ft-actions relative !mt-0 pt-4 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-white before:to-white/0">
                {/* 이어지는 곳이 있으면 닫기는 좁게(⅓) · 파란 단추를 넓게 — 영어 · 일본어 단추 글이 두 줄로 꺾이지 않게 */}
                <button type="button" className={`ft-btn secondary ${item.cta ? '!flex-[0_0_32%]' : ''}`} onClick={onClose}>
                  {t({ ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' })}
                </button>
                {item.cta && (
                  <Link href={item.cta.href} className="ft-btn primary text-center !leading-[1.25]" onClick={onClose}>
                    {t(item.cta.label)}
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/** 시트 맨 위 큰 그림 — 살짝 크게 시작해 제자리로 가라앉는다. 영상 기사는 포스터 위 재생 단추(누르기 전엔 영상을 받지 않는다) */
function SheetHero({ item }: { item: BizNewsItem }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    setPlaying(true);
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => { /* 자동 재생이 막히면 기본 단추로 누르게 둔다 */ });
  };

  return (
    <div
      className="relative overflow-hidden rounded-[20px]"
      style={{ aspectRatio: '16 / 10', backgroundColor: item.image.bg, transform: 'translateZ(0)' }}
    >
      {item.video ? (
        <>
          <video
            ref={videoRef}
            src={item.video}
            poster={item.image.src}
            preload="none"
            playsInline
            controls={playing}
            className="absolute inset-0 h-full w-full bg-black object-cover"
            style={{ objectPosition: item.image.position ?? '50% 35%' }}
          />
          {!playing && (
            <button
              type="button"
              onClick={play}
              aria-label={t({ ko: '영상 보기', en: 'Watch video', ja: '動画を見る', zh: '观看视频' })}
              className="group absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.25 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform group-active:scale-95"
              >
                <Play className="ml-1 h-7 w-7 fill-[#191F28] text-[#191F28]" strokeWidth={1.5} />
              </motion.span>
            </button>
          )}
        </>
      ) : (
        <motion.img
          src={item.image.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: item.image.position ?? '50% 35%' }}
          initial={{ scale: 1.08, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        />
      )}
    </div>
  );
}

/** 연혁 기사 묶음 — 세로 줄 위 점(지금 기사 = 파란 점 · 굵은 글자), 누르면 그 기사로 넘어간다 */
function Milestones({ currentId, onSelect }: { currentId: string; onSelect: (id: string) => void }) {
  const t = useT();
  return (
    <div className="mt-7">
      <p className="m-0 text-[15px] font-bold tracking-[-0.3px] text-[#191F28]">
        {t({ ko: '프리티풀이 걸어온 길', en: 'Our journey so far', ja: 'Freetifulの歩み', zh: 'Freetiful 的足迹' })}
      </p>
      <ol className="relative m-0 mt-3 list-none p-0">
        {/* 세로 줄 — 첫 점에서 마지막 점까지 */}
        <span aria-hidden="true" className="absolute bottom-[22px] left-[5px] top-[22px] w-px bg-[#E5E8EB]" />
        {BIZ_NEWS_MILESTONES.map((m) => {
          const on = m.id === currentId;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => !on && onSelect(m.id)}
                aria-current={on ? 'true' : undefined}
                className={`relative flex w-full items-center gap-3 rounded-[12px] py-2.5 pr-2 text-left transition-colors ${on ? 'cursor-default' : 'hover:bg-[#F9FAFB] active:bg-[#F2F4F6]'}`}
              >
                <span
                  aria-hidden="true"
                  className={`relative z-[1] h-[11px] w-[11px] shrink-0 rounded-full border-2 ${on ? 'border-[#3182F6] bg-[#3182F6] shadow-[0_0_0_4px_#E8F3FF]' : 'border-[#D1D6DB] bg-white'}`}
                />
                <span className={`w-[62px] shrink-0 text-[13px] tabular-nums ${on ? 'font-semibold text-[#3182F6]' : 'font-medium text-[#8B95A1]'}`}>{m.date}</span>
                <span className={`min-w-0 break-keep text-[15px] leading-[1.45] tracking-[-0.2px] ${on ? 'font-bold text-[#191F28]' : 'font-medium text-[#6B7684]'}`}>
                  {m.milestone ? t(m.milestone) : t(m.title)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
