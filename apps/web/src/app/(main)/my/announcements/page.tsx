'use client';

// 공지사항 — 홈 사회자 카드(사진 색 카드)처럼 2열 카드(260928 사장 "공지사항 UI 사회자 카드랑 비슷하게, 2*n 으로").
//  · 카드 = 모서리 20 · 테두리, 위 1:1 그림 칸(주제 색 그라데이션 + 토스 컬러 아이콘 크게, 아래쪽이 카드 색으로 녹는다) +
//    왼쪽 위 검은 반투명 유리 배지(업데이트·안내…) · 제목 2줄 · 날짜 · 첫 문장 한 줄.
//  · 색·아이콘 = 제목의 주제(웨딩숲·퀵매칭·채팅·결제…)로 고른다 — 사회자 사진마다 색이 다르듯 카드마다 결이 달라진다.
//  · 누르면 아래에서 스프링으로 올라오는 시트에 본문(뒤 화면 잠금, 닫을 땐 내려간다). 카드는 순서대로 떠오른다.
import { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { announcementApi, type Announcement } from '@/lib/api/announcement.api';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { MyDetailHeader } from '../_components/detail-ui';

type Palette = { bg: string; line: string; sub: string; cover: string };

const PALETTES: Record<string, Palette> = {
  blue: { bg: '#EEF4FF', line: '#DCE7FA', sub: '#5470A0', cover: '#D6E4FF' },
  amber: { bg: '#FFF6E6', line: '#FBE8C6', sub: '#98722F', cover: '#FFE5B3' },
  orange: { bg: '#FFF1E8', line: '#FCDDC8', sub: '#A0613A', cover: '#FFDBC2' },
  purple: { bg: '#F4F0FF', line: '#E5DDFB', sub: '#6F5FA5', cover: '#E3D8FF' },
  mint: { bg: '#EAF8F4', line: '#D2EFE6', sub: '#3F8572', cover: '#CDEFE4' },
  green: { bg: '#EDF8EE', line: '#D7EFD9', sub: '#4E8456', cover: '#D2F0D6' },
  pink: { bg: '#FFF0F5', line: '#FBDCE7', sub: '#A5587A', cover: '#FFD8E6' },
  teal: { bg: '#EAF6F8', line: '#D1EBF0', sub: '#3F7E8A', cover: '#CDEDF3' },
  sky: { bg: '#EBF6FF', line: '#D3E9FB', sub: '#4A7BA6', cover: '#CFE8FF' },
  coral: { bg: '#FFF1EE', line: '#FBDDD6', sub: '#A45F52', cover: '#FFD9D0' },
  gray: { bg: '#F2F4F6', line: '#E5E8EB', sub: '#6B7684', cover: '#E3E7EB' },
  gold: { bg: '#FFF8E6', line: '#F8EAC2', sub: '#94792F', cover: '#FCE8AE' },
  indigo: { bg: '#EFF1FF', line: '#DDE1FA', sub: '#5A63A3', cover: '#D9DEFF' },
};

const TOSS = (n: string) => `/icons/toss/${n}.svg`;
const EMOJI = (n: string) => `/icons/community/cat/${n}.svg`;

/** 제목 주제 → 아이콘·색(먼저 맞는 것) */
const TOPICS: { re: RegExp; icon: string; palette: keyof typeof PALETTES }[] = [
  { re: /웨딩숲|커뮤니티/, icon: EMOJI('ring'), palette: 'pink' },
  { re: /퀵매칭|매칭/, icon: TOSS('star'), palette: 'gold' },
  { re: /채팅|대화/, icon: TOSS('chat'), palette: 'blue' },
  { re: /결제|정산|환불|금액|견적/, icon: TOSS('coin'), palette: 'amber' },
  { re: /알림|푸시/, icon: TOSS('alarm'), palette: 'orange' },
  { re: /리뷰|후기/, icon: TOSS('star'), palette: 'gold' },
  { re: /동영상|영상|사진|이모티콘/, icon: TOSS('picture'), palette: 'mint' },
  { re: /웨딩 파트너|웨딩홀|업체/, icon: EMOJI('store'), palette: 'teal' },
  { re: /홈/, icon: EMOJI('home'), palette: 'green' },
  { re: /로그인|계정|회원/, icon: TOSS('account'), palette: 'indigo' },
  { re: /검색|찾기/, icon: TOSS('search'), palette: 'sky' },
  { re: /마이페이지/, icon: TOSS('user'), palette: 'purple' },
  { re: /자동응답|AI/, icon: TOSS('headphone'), palette: 'purple' },
  { re: /사회자|프로필|파트너/, icon: TOSS('medal-check'), palette: 'purple' },
  { re: /오픈/, icon: TOSS('crown-gold'), palette: 'gold' },
  { re: /문의/, icon: TOSS('question'), palette: 'sky' },
  { re: /회사 소개|기업|언어/, icon: TOSS('document'), palette: 'gray' },
  { re: /안전|규정/, icon: TOSS('check-circle'), palette: 'green' },
];

const TAG_DEFAULT: Record<string, { icon: string; palette: keyof typeof PALETTES }> = {
  이벤트: { icon: TOSS('gift'), palette: 'coral' },
  점검: { icon: TOSS('setting'), palette: 'gray' },
  안내: { icon: TOSS('loudspeaker'), palette: 'green' },
  필독: { icon: TOSS('siren'), palette: 'coral' },
};

function lookOf(a: Announcement): { icon: string; palette: Palette } {
  const tag = a.tag || '안내';
  if (tag === '이벤트' || tag === '점검' || tag === '필독') {
    const d = TAG_DEFAULT[tag];
    return { icon: d.icon, palette: PALETTES[d.palette] };
  }
  const t = TOPICS.find((x) => x.re.test(a.title));
  if (t) return { icon: t.icon, palette: PALETTES[t.palette] };
  const d = TAG_DEFAULT[tag] || { icon: EMOJI('bulb'), palette: 'blue' as const };
  return { icon: d.icon, palette: PALETTES[d.palette] };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 본문 첫 문장 — 카드의 '소개 한 줄' 자리 */
function firstLine(content: string) {
  return (content || '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('•') && !l.startsWith('[')) || '';
}

const GLASS = { backgroundColor: 'rgba(0, 0, 0, 0.36)', WebkitBackdropFilter: 'blur(10px) saturate(140%)', backdropFilter: 'blur(10px) saturate(140%)', boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)' } as const;

function NoticeCard({ a, index, onOpen }: { a: Announcement; index: number; onOpen: () => void }) {
  const { icon, palette } = lookOf(a);
  const tag = a.tag || '안내';
  return (
    <button
      type="button"
      onClick={onOpen}
      // button 은 줄 높이만큼 늘면 내용을 세로 가운데로 모아 그림 칸이 내려간다 → flex 세로로 위부터
      className="qd-a-item group card-press flex h-full flex-col overflow-hidden rounded-[20px] border text-left"
      style={{ backgroundColor: palette.bg, borderColor: palette.line, animationDelay: `${0.3 + Math.min(index, 12) * 0.05}s` }}
    >
      <div className="relative flex items-center justify-center" style={{ aspectRatio: '1 / 1', background: `linear-gradient(165deg, ${palette.cover} 0%, ${palette.bg} 88%)` }}>
        {/* 아이콘 뒤 흰 빛 — 그림 칸에 깊이 */}
        <span aria-hidden className="absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 blur-[18px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={icon}
          alt=""
          draggable={false}
          className="relative h-[44%] w-[44%] object-contain transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          style={{ filter: 'drop-shadow(0 10px 18px rgba(25, 31, 40, 0.10))' }}
        />
        <span className="absolute left-2 top-2 flex items-center gap-1">
          <span className="inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white" style={GLASS}>{tag}</span>
          {a.isPinned && <span className="inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white" style={GLASS}>고정</span>}
        </span>
      </div>
      <div className="relative -mt-2 px-3 pb-3.5">
        <p className="line-clamp-2 break-keep text-[16px] font-bold leading-[1.4] tracking-[-0.4px] text-[#191F28]">{a.title}</p>
        <p className="mt-1 text-[13px] leading-[1.5] tracking-[-0.2px]" style={{ color: palette.sub }}>{formatDate(a.publishedAt || a.createdAt)}</p>
        {firstLine(a.content) && (
          <p className="mt-0.5 line-clamp-1 break-all text-[13px] leading-[1.6] tracking-[-0.2px]" style={{ color: palette.sub }}>{firstLine(a.content)}</p>
        )}
      </div>
    </button>
  );
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((x) => x.id === openId) || null;
  useBodyScrollLock(!!open);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await announcementApi.getList();
        setItems(Array.isArray(data) ? data : []); // 배열이 아니면(오류 응답 등) 빈 목록 — map 에서 화면이 죽지 않게
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openLook = open ? lookOf(open) : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="공지사항" sub="프리티풀의 새 소식을 알려 드려요" />

      <div className="px-5 pt-1">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-[20px] bg-[#F7F8FA]">
                <div className="bg-[#F2F4F6]" style={{ aspectRatio: '1 / 1' }} />
                <div className="h-[86px]" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <EmptyDocumentIcon size={64} className="mb-3" />
            <p className="text-[15px] font-bold text-[#2B313D]">등록된 공지사항이 없습니다</p>
            <p className="mt-1.5 text-[13px] text-[#A4ABBA]">새로운 소식이 생기면 이곳에 알려드릴게요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((a, i) => (
              <NoticeCard key={a.id} a={a} index={i} onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
        )}
      </div>

      {/* 공지 본문 시트 — 아래에서 스프링으로 올라오고, 닫을 땐 내려간다 */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && openLook && (
            <motion.div
              key="notice-scrim"
              className="ft-scrim"
              style={{ animation: 'none' }}
              initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
              exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setOpenId(null)}
            >
              <motion.div
                className="ft-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={open.title}
                style={{ animation: 'none', overscrollBehavior: 'contain' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ft-grab" aria-hidden="true" />
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: `linear-gradient(165deg, ${openLook.palette.cover}, ${openLook.palette.bg})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openLook.icon} alt="" className="h-7 w-7 object-contain" />
                  </span>
                  <span className="min-w-0 text-[13px] leading-[1.5]" style={{ color: openLook.palette.sub }}>
                    <b className="font-semibold">{open.tag || '안내'}</b> · {formatDate(open.publishedAt || open.createdAt)}
                  </span>
                </div>
                <h2 className="mt-4 text-[21px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28]">{open.title}</h2>
                <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.75] text-[#4E5968]">{open.content}</p>
                <div className="ft-actions">
                  <button type="button" className="ft-btn secondary" onClick={() => setOpenId(null)}>닫기</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
