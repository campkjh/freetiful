'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { DEFAULT_POLICY_MAP, type PolicySeed } from '@/lib/policies/default-policies';

interface PolicyDocument {
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  contentHtml: string;
  version?: string | null;
  effectiveDate?: string | null;
  updatedAt?: string | null;
}

function toPolicy(seed: PolicySeed): PolicyDocument {
  return {
    slug: seed.slug,
    title: seed.title,
    summary: seed.summary,
    contentHtml: seed.contentHtml,
    version: seed.version,
    effectiveDate: seed.effectiveDate,
  };
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function PolicyPage({ slug }: { slug: string }) {
  const router = useRouter();
  const fallback = useMemo(() => {
    const seed = DEFAULT_POLICY_MAP[slug] || DEFAULT_POLICY_MAP.service;
    return toPolicy(seed);
  }, [slug]);
  const [policy, setPolicy] = useState<PolicyDocument>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiClient
      .get<PolicyDocument>(`/api/v1/policies/${slug}`)
      .then((res) => {
        if (alive) setPolicy(res.data);
      })
      .catch((error) => {
        if (!alive) return;
        if (error?.response?.status === 404) {
          setPolicy({
            slug,
            title: fallback.title,
            summary: '',
            contentHtml: '<p>현재 게시 중인 약관 문서가 없습니다.</p>',
          });
          return;
        }
        setPolicy(fallback);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [fallback, slug]);

  const dateText = formatDate(policy.effectiveDate || policy.updatedAt);

  return (
    <div className="min-h-screen bg-white" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex h-[52px] items-center px-4">
          <button onClick={() => router.back()} className="-ml-1 p-1 transition-transform active:scale-90" aria-label="뒤로가기">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">{policy.title}</h1>
        </div>
      </div>

      <main className="px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-[12px] text-gray-400">{dateText ? `마지막 업데이트 ${dateText}` : '약관 및 정책'}</p>
          {loading && <span className="h-2 w-2 animate-pulse rounded-full bg-[#3180F7]" />}
        </div>

        <article
          className="policy-content"
          dangerouslySetInnerHTML={{ __html: policy.contentHtml || fallback.contentHtml }}
        />
      </main>

      <style>{`
        .policy-content {
          color: #4b5563;
          font-size: 13px;
          line-height: 1.75;
        }
        .policy-content section {
          margin-bottom: 24px;
        }
        .policy-content h2 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.45;
        }
        .policy-content h3 {
          margin: 12px 0 6px;
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }
        .policy-content p {
          margin: 0 0 8px;
        }
        .policy-content .policy-subtitle {
          margin: -4px 0 8px;
          color: #9ca3af;
          font-size: 11px;
        }
        .policy-content ol {
          margin: 4px 0 0;
          padding-left: 18px;
        }
        .policy-content li {
          margin: 4px 0;
          padding-left: 2px;
        }
        .policy-content table {
          width: 100%;
          margin-top: 10px;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
        }
        .policy-content th {
          background: #f9fafb;
          color: #374151;
          font-weight: 700;
          text-align: left;
        }
        .policy-content th,
        .policy-content td {
          border-bottom: 1px solid #f3f4f6;
          padding: 8px 10px;
          vertical-align: top;
        }
        .policy-content tr:last-child td {
          border-bottom: 0;
        }
        .policy-content .policy-notice {
          margin-top: 12px;
          border-radius: 8px;
          background: #f9fafb;
          padding: 10px 12px;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.65;
        }
        .policy-content hr {
          margin: 24px 0 14px;
          border: 0;
          border-top: 1px solid #e5e7eb;
        }
        .policy-content .policy-footnote {
          color: #9ca3af;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
