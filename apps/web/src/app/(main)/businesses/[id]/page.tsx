'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Share2, MapPin, Phone, Globe, Instagram } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import {
  deriveBusinessTagSuggestions,
  extractBusinessTagsFromHtml,
  normalizeBusinessTags,
  stripBusinessTagMarker,
} from '@/lib/business-tags';
import {
  getWeddingPartnerImageSet,
  getWeddingPartnerSectionCategories,
  mergeWeddingPartnerImages,
} from '@/lib/wedding-partner-images';
import { getRelevantBusinessCategories, isBusinessRelevantToAnyCategory, sanitizeBusinessImageUrls } from '@/lib/business-quality';

interface BizDetail {
  id: string;
  businessName: string;
  address: string | null;
  addressDetail?: string | null;
  phone: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  descriptionHtml?: string | null;
  businessType?: string | null;
  tags?: string[];
  categories: Array<{ category: { name: string } }>;
  images: Array<{ imageUrl: string }>;
}

export default function BusinessDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [activeImage, setActiveImage] = useState(0);
  const [biz, setBiz] = useState<BizDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<BizDetail>(`/api/v1/business/${id}`)
      .then((r) => {
        if (!isBusinessRelevantToAnyCategory(r.data)) {
          setBiz(null);
          return;
        }
        const partnerImageSet = getWeddingPartnerImageSet(r.data.businessName);
        const apiImages = Array.isArray(r.data.images) ? r.data.images.map((i) => i.imageUrl).filter(Boolean) : [];
        const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(partnerImageSet?.images, apiImages));
        if (mergedImages.length === 0) {
          setBiz(null);
          return;
        }
        setBiz(r.data);
      })
      .catch(() => setBiz(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-24">
        <div className="pt-12 aspect-[3/2] bg-gray-100 animate-pulse" />
        <div className="px-4 pt-4 space-y-3">
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-500 text-[14px] mb-3">업체를 찾을 수 없습니다</p>
        <button onClick={() => router.back()} className="text-[13px] text-primary-500 font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  const partnerImageSet = getWeddingPartnerImageSet(biz.businessName);
  const apiImages = Array.isArray(biz.images) ? biz.images.map((i) => i.imageUrl).filter(Boolean) : [];
  const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(partnerImageSet?.images, apiImages));
  const images = mergedImages.length > 0 ? mergedImages : ['/images/default-profile.png'];
  const categoryNames = Array.from(new Set([
    ...getRelevantBusinessCategories(biz),
    ...getWeddingPartnerSectionCategories(partnerImageSet),
  ]));
  const category = categoryNames[0] || partnerImageSet?.category || '웨딩파트너';
  const markerTags = extractBusinessTagsFromHtml(biz.descriptionHtml);
  const tags = normalizeBusinessTags(
    Array.isArray(biz.tags) && biz.tags.length > 0
      ? biz.tags
      : markerTags.length > 0
        ? markerTags
        : deriveBusinessTagSuggestions({
          businessName: biz.businessName,
          businessType: biz.businessType,
          address: biz.address,
          categoryNames,
        }),
    6,
  );
  const descriptionHtml = stripBusinessTagMarker(biz.descriptionHtml);

  return (
    <div className="bg-white min-h-screen pb-24">
      <div data-native-back-header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <div className="flex items-center gap-2">
            <button className="p-2"><Share2 size={20} className="text-gray-600" /></button>
          </div>
        </div>
      </div>

      <div className="pt-12">
        <div className="relative aspect-[3/2] bg-gray-100 overflow-hidden">
          <img
            src={images[activeImage]}
            alt={biz.businessName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (!target.dataset.fallback) {
                target.dataset.fallback = '1';
                target.src = '/images/default-profile.png';
              }
            }}
          />
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
            {activeImage + 1} / {images.length}
          </div>
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === activeImage ? 'border-primary-500' : 'border-transparent'
                }`}
              >
                <img
                  src={img}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = '1';
                      target.src = '/images/default-profile.png';
                    }
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 border-b border-gray-100">
        <span className="text-xs text-primary-500 font-bold">{category}</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{biz.businessName}</h1>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#F2F7FF] px-2.5 py-1 text-[11px] font-bold text-[#3180F7]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2 mt-4">
          {biz.address && (
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700">{biz.address}</p>
                {biz.addressDetail && <p className="text-xs text-gray-400">{biz.addressDetail}</p>}
              </div>
            </div>
          )}
          {biz.phone && (
            <div className="flex items-center gap-2.5">
              <Phone size={16} className="text-gray-400 shrink-0" />
              <a href={`tel:${biz.phone}`} className="text-sm text-primary-500 font-medium">{biz.phone}</a>
            </div>
          )}
        </div>

        {(biz.instagramUrl || biz.websiteUrl) && (
          <div className="flex gap-3 mt-4">
            {biz.instagramUrl && (
              <a href={biz.instagramUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                <Instagram size={14} /> Instagram
              </a>
            )}
            {biz.websiteUrl && (
              <a href={biz.websiteUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                <Globe size={14} /> 웹사이트
              </a>
            )}
          </div>
        )}
      </div>

      {descriptionHtml && (
        <div className="px-4 py-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">소개</h3>
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </div>
      )}

      {/* 전화 문의 버튼 — 일시 비활성화 (오류 이슈로 잠시 숨김) */}
      {/*
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 px-4 py-3 z-40">
        <div className="flex items-center gap-3">
          {biz.phone && (
            <a href={`tel:${biz.phone}`} className="flex-1">
              <button className="btn-primary flex items-center justify-center gap-2 w-full">
                <Phone size={18} /> 전화 문의
              </button>
            </a>
          )}
        </div>
      </div>
      */}
    </div>
  );
}
