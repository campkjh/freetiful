'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { DEFAULT_POLICIES } from '@/lib/policies/default-policies';

interface PolicyListItem {
  id?: string;
  slug: string;
  title: string;
  effectiveDate?: string | null;
  displayOrder?: number;
}

const fallbackItems: PolicyListItem[] = DEFAULT_POLICIES.map((policy) => ({
  slug: policy.slug,
  title: policy.title,
  effectiveDate: policy.effectiveDate,
  displayOrder: policy.displayOrder,
}));

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace(/-/g, '.');
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default function TermsListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PolicyListItem[]>(fallbackItems);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<PolicyListItem[]>('/api/v1/policies')
      .then((res) => {
        if (!alive) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length > 0) setItems(rows);
      })
      .catch(() => {
        if (alive) setItems(fallbackItems);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white flex items-center px-4 h-[52px]">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold ml-2">약관 및 정책</h1>
      </div>

      {/* Section divider */}
      <div className="h-1.5 bg-gray-50" />

      {/* Terms list */}
      <div>
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/terms/${item.slug}`}
            className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100"
          >
            <div>
              <p className="text-sm text-gray-900">{item.title}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">시행일: {formatDate(item.effectiveDate) || '-'}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        ))}
      </div>

      <div className="px-4 py-6">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          프리티풀 | 대표: 서나웅<br />
          개인정보 보호책임자: 김정훈 이사 (운영관리팀)<br />
          고객문의: Jaicylab0110@gmail.com
        </p>
      </div>
    </div>
  );
}
