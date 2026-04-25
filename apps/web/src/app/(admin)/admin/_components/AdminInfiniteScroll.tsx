'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface AdminInfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  loaded: number;
  total: number;
  onLoadMore: () => void;
  itemLabel?: string;
}

export function appendUniqueById<T extends { id: string }>(prev: T[], next: T[]) {
  const seen = new Set(prev.map((item) => item.id));
  return [...prev, ...next.filter((item) => !seen.has(item.id))];
}

export function AdminInfiniteScroll({
  hasMore,
  loading,
  loaded,
  total,
  onLoadMore,
  itemLabel = '건',
}: AdminInfiniteScrollProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const onLoadMoreRef = useRef(onLoadMore);
  const throttleRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
    hasMoreRef.current = hasMore;
    onLoadMoreRef.current = onLoadMore;
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        if (!hasMoreRef.current || loadingRef.current || throttleRef.current) return;

        throttleRef.current = true;
        onLoadMoreRef.current();
        window.setTimeout(() => {
          throttleRef.current = false;
        }, 350);
      },
      { rootMargin: '420px 0px 640px 0px', threshold: 0.01 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (total <= 0) return <div ref={targetRef} className="h-1" />;

  return (
    <div ref={targetRef} className="border-t border-[#F2F4F6] px-4 py-4">
      <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-[#8B95A1]">
        {hasMore ? (
          loading ? (
            <>
              <Loader2 size={14} className="animate-spin text-[#3180F7]" />
              다음 데이터를 불러오는 중
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#3180F7]" />
              {loaded.toLocaleString()} / {total.toLocaleString()}{itemLabel} 표시 중
            </>
          )
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#B0B8C1]" />
            전체 {total.toLocaleString()}{itemLabel} 표시됨
          </>
        )}
      </div>
    </div>
  );
}
