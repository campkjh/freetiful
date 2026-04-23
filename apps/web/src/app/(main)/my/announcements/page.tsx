'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { announcementApi, type Announcement } from '@/lib/api/announcement.api';

const TAG_COLORS: Record<string, string> = {
  '필독': 'bg-red-50 text-red-500',
  '업데이트': 'bg-blue-50 text-blue-500',
  '안내': 'bg-gray-100 text-gray-600',
  '이벤트': 'bg-amber-50 text-amber-600',
  '점검': 'bg-orange-50 text-orange-500',
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
  const router = useRouter();
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
    <div className="bg-white min-h-screen max-w-lg mx-auto pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold ml-2 text-gray-900">공지사항</h1>
        </div>
      </div>

      {/* 공지 리스트 */}
      <div className="px-4 pt-4 space-y-2">
        {loading && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">불러오는 중...</p>
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">등록된 공지사항이 없습니다</p>
          </div>
        )}
        {items.map((a) => {
          const isOpen = openId === a.id;
          const tag = a.tag || '안내';
          const date = formatDate(a.publishedAt || a.createdAt);
          return (
            <div
              key={a.id}
              className={`rounded-2xl border transition-all duration-300 ${
                isOpen ? 'border-gray-200 shadow-sm' : 'border-gray-100'
              } bg-white`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="flex items-start gap-3 w-full px-4 py-4 text-left active:bg-gray-50/60 rounded-2xl transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_COLORS[tag] || 'bg-gray-100 text-gray-500'}`}>
                      {tag}
                    </span>
                    <span className="text-[11px] text-gray-400">{date}</span>
                    {a.isPinned && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-500">고정</span>
                    )}
                  </div>
                  <p className={`text-[14px] leading-snug ${
                    isOpen ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                  }`}>
                    {a.title}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 shrink-0 mt-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-400 ease-out"
                style={{
                  maxHeight: isOpen ? 9999 : 0,
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="mx-4 border-t border-gray-100" />
                <p className="px-4 pt-3 pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">
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
