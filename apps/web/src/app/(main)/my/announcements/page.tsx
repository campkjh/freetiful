'use client';

import { useState, useEffect } from 'react';
import { announcementApi, type Announcement } from '@/lib/api/announcement.api';
import { ChevronDownIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { MY_CARD, MyDetailHeader } from '../_components/detail-ui';

const TAG_COLORS: Record<string, string> = {
  '필독': 'bg-[#FFF0F0] text-[#E5484D]',
  '업데이트': 'bg-[#EAF2FF] text-[#3182F6]',
  '안내': 'bg-[#F2F3F5] text-[#51535C]',
  '이벤트': 'bg-[#FFF6E5] text-[#D98A00]',
  '점검': 'bg-[#FFF1E8] text-[#E8730C]',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  } catch {
    return '';
  }
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await announcementApi.getList();
        setItems(data);
      } catch (e) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="공지사항" />

      {/* 공지 리스트 */}
      <div className="space-y-2.5 px-4 pt-2">
        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[84px] animate-pulse rounded-[24px] bg-[#F7F8FA]" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <EmptyDocumentIcon size={64} className="mb-3" />
            <p className="text-[15px] font-bold text-[#2B313D]">등록된 공지사항이 없습니다</p>
            <p className="mt-1.5 text-[13px] text-[#A4ABBA]">새로운 소식이 생기면 이곳에 알려드릴게요.</p>
          </div>
        )}
        {items.map((a) => {
          const isOpen = openId === a.id;
          const tag = a.tag || '안내';
          const date = formatDate(a.publishedAt || a.createdAt);
          return (
            <div key={a.id} className={MY_CARD}>
              <button
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="flex w-full items-start gap-3 rounded-[24px] px-5 py-4 text-left transition-colors active:bg-[#FBFCFD] lg:hover:bg-[#FBFCFD]"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-[3px] text-[11px] font-bold ${TAG_COLORS[tag] || 'bg-[#F2F3F5] text-[#51535C]'}`}>
                      {tag}
                    </span>
                    {a.isPinned && (
                      <span className="rounded-full bg-[#FDF0F7] px-2 py-[3px] text-[11px] font-bold text-[#E255A1]">고정</span>
                    )}
                    <span className="text-[12px] text-[#A4ABBA]">{date}</span>
                  </div>
                  <p className={`text-[15px] leading-snug ${isOpen ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#51535C]'}`}>
                    {a.title}
                  </p>
                </div>
                <ChevronDownIcon
                  size={18}
                  className={`mt-1 shrink-0 text-[#C8CEDA] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-400 ease-out"
                style={{ maxHeight: isOpen ? 9999 : 0, opacity: isOpen ? 1 : 0 }}
              >
                <div className="mx-5 border-t border-[#F5F6F8]" />
                <p className="whitespace-pre-line px-5 pb-5 pt-3.5 text-[14px] leading-[1.8] text-[#51535C]">
                  {a.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
