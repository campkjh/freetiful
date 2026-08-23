'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { DEFAULT_POLICIES } from '@/lib/policies/default-policies';
import { ChevronRightIcon } from '@/components/icons/mono';
import { MY_CARD, MyDetailHeader } from '../_components/detail-ui';

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
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="약관 및 정책" onBack={() => router.back()} />

      <div className="px-4 pt-2">
        <div className={`${MY_CARD} overflow-hidden`}>
          {items.map((item, i) => (
            <Link
              key={item.slug}
              href={`/terms/${item.slug}`}
              className={`flex items-center justify-between gap-3 px-5 py-4 transition-colors active:bg-[#FBFCFD] lg:hover:bg-[#FBFCFD] ${
                i > 0 ? 'border-t border-[#F5F6F8]' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-[#2B313D]">{item.title}</span>
                <span className="mt-0.5 block text-[12px] text-[#A4ABBA]">
                  시행일 {formatDate(item.effectiveDate) || '-'}
                </span>
              </span>
              <ChevronRightIcon size={16} className="shrink-0 text-[#D8DDE4]" />
            </Link>
          ))}
        </div>

        <p className="px-2 pt-6 text-center text-[12px] leading-[1.9] text-[#A4ABBA]">
          프리티풀 | 대표 서나웅<br />
          개인정보 보호책임자 김정훈 이사 (운영관리팀)<br />
          고객문의 Jaicylab0110@gmail.com
        </p>
      </div>
    </div>
  );
}
