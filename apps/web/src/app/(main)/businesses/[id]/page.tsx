'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Share2, Heart, MapPin, Phone, Globe, Instagram, ExternalLink } from 'lucide-react';

const MOCK_BIZ = {
  id: '',
  name: '',
  category: '',
  address: '',
  addressDetail: '',
  phone: '',
  instagramUrl: '',
  websiteUrl: '',
  descriptionHtml: '',
  images: [] as string[],
  views: 0,
};

export default function BusinessDetailPage() {
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  const biz = MOCK_BIZ;

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <div className="flex items-center gap-2">
            <button className="p-2"><Share2 size={20} className="text-gray-600" /></button>
            <button className="p-2" onClick={() => setIsFavorited(!isFavorited)}>
              <Heart size={20} className={isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
            </button>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="pt-12">
        <div className="relative aspect-[3/2] bg-gray-100 overflow-hidden">
          <img src={biz.images[activeImage]} alt={biz.name} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
            {activeImage + 1} / {biz.images.length}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 overflow-x-auto">
          {biz.images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeImage ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pb-4 border-b border-gray-100">
        <span className="text-xs text-primary-500 font-bold">{biz.category}</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{biz.name}</h1>

        <div className="space-y-2 mt-4">
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700">{biz.address}</p>
              <p className="text-xs text-gray-400">{biz.addressDetail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone size={16} className="text-gray-400 shrink-0" />
            <a href={`tel:${biz.phone}`} className="text-sm text-primary-500 font-medium">{biz.phone}</a>
          </div>
        </div>

        {/* Social Links */}
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
      </div>

      {/* Description */}
      <div className="px-4 py-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">소개</h3>
        <div
          className="prose prose-sm max-w-none text-gray-600"
          dangerouslySetInnerHTML={{ __html: biz.descriptionHtml }}
        />
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 px-4 py-3 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-xl shrink-0"
          >
            <Heart size={22} className={isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          </button>
          <a href={`tel:${biz.phone}`} className="flex-1">
            <button className="btn-primary flex items-center justify-center gap-2">
              <Phone size={18} /> 전화 문의
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
