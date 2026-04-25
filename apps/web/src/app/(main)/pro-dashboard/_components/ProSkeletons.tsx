import type { CSSProperties } from 'react';

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function SkeletonBlock({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function ProStatGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="px-4 mt-5 grid grid-cols-3 gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl bg-white p-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <SkeletonBlock className="mb-1.5 h-7 w-7 rounded-lg" />
          <SkeletonBlock className="mb-1.5 h-2.5 w-14 rounded" />
          <SkeletonBlock className="h-3.5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProMetricGridSkeleton({ count = 3, columns = 'grid-cols-3' }: { count?: number; columns?: string }) {
  return (
    <div className={`px-4 mt-5 grid ${columns} gap-2`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <SkeletonBlock className="mb-2 h-8 w-8 rounded-lg" />
          <SkeletonBlock className="mb-1.5 h-2.5 w-16 rounded" />
          <SkeletonBlock className="h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProCardListSkeleton({
  count = 3,
  avatar = true,
  actions = false,
  className = 'px-4 py-4',
}: {
  count?: number;
  avatar?: boolean;
  actions?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} space-y-3`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {avatar && <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <SkeletonBlock className="h-4 w-20 rounded" />
                <SkeletonBlock className="h-4 w-14 rounded-full" />
              </div>
              <SkeletonBlock className="mb-2 h-3 w-full rounded" />
              <SkeletonBlock className="h-3 w-2/3 rounded" />
            </div>
          </div>
          {actions && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-50 pt-3">
              <SkeletonBlock className="h-10 rounded-xl" />
              <SkeletonBlock className="h-10 rounded-xl" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProMiniCardGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="mb-2 flex items-center justify-between">
            <SkeletonBlock className="h-3.5 w-14 rounded" />
            <SkeletonBlock className="h-4 w-9 rounded-full" />
          </div>
          <SkeletonBlock className="mb-1.5 h-3 w-full rounded" />
          <SkeletonBlock className="h-2.5 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProReviewListSkeleton({ count = 2, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-3.5 w-16 rounded" />
              <SkeletonBlock className="h-3.5 w-20 rounded" />
              <SkeletonBlock className="h-4 w-9 rounded" />
            </div>
            <SkeletonBlock className="h-3 w-12 rounded" />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, chipIndex) => (
              <SkeletonBlock key={chipIndex} className="h-5 w-12 rounded" />
            ))}
          </div>
          <SkeletonBlock className="mb-2 h-3 w-full rounded" />
          <SkeletonBlock className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProRevenueSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className={index === 0 ? 'mb-4' : ''}>
          <div className="mb-1.5 flex items-center justify-between">
            <SkeletonBlock className="h-3 w-14 rounded" />
            <SkeletonBlock className="h-3.5 w-24 rounded" />
          </div>
          <SkeletonBlock className="h-3 w-full rounded-full" />
        </div>
      ))}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <SkeletonBlock className="h-3 w-16 rounded" />
        <SkeletonBlock className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}

export function ProChartSkeleton({ className = 'px-4 mt-6' }: { className?: string }) {
  return (
    <div className={className}>
      <SkeletonBlock className="mb-3 h-4 w-28 rounded" />
      <div className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex h-32 items-end gap-3">
          {[52, 76, 36, 88, 64, 46, 70].map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-1">
              <SkeletonBlock className="h-2.5 w-5 rounded" />
              <SkeletonBlock className="w-full rounded-t-lg" style={{ height: `${height}px` }} />
              <SkeletonBlock className="h-2.5 w-5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProRankingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
          <SkeletonBlock className="h-4 w-5 rounded" />
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <SkeletonBlock className="h-3.5 flex-1 rounded" />
          <SkeletonBlock className="h-3.5 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ProNotificationListSkeleton({ count = 5, className = 'px-4 mt-2' }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-gray-100 py-4">
          <SkeletonBlock className="mt-0.5 h-6 w-6 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="mb-2 h-3.5 w-32 rounded" />
            <SkeletonBlock className="mb-1.5 h-3 w-full rounded" />
            <SkeletonBlock className="h-2.5 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProCalendarSkeleton() {
  return (
    <div className="bg-white px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBlock className="h-6 w-6 rounded-full" />
        <SkeletonBlock className="h-4 w-24 rounded" />
        <SkeletonBlock className="h-6 w-6 rounded-full" />
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <SkeletonBlock key={index} className="mx-auto h-2.5 w-4 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, index) => (
          <SkeletonBlock key={index} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
