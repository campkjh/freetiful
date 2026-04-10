'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Lock, Link2, Wallet } from 'lucide-react';
import ImageUploader from '@/components/ui/ImageUploader';

const MOCK_IMAGES = [
  { id: 'img-1', imageUrl: 'https://i.pravatar.cc/300?img=32', displayOrder: 0, hasFace: true, isPrimary: true },
  { id: 'img-2', imageUrl: 'https://i.pravatar.cc/300?img=33', displayOrder: 1, hasFace: true, isPrimary: false },
  { id: 'img-3', imageUrl: 'https://i.pravatar.cc/300?img=34', displayOrder: 2, hasFace: true, isPrimary: false },
  { id: 'img-4', imageUrl: 'https://i.pravatar.cc/300?img=35', displayOrder: 3, hasFace: false, isPrimary: false },
];

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState('홍길동');
  const [phone, setPhone] = useState('010-1234-5678');
  const [images, setImages] = useState(MOCK_IMAGES);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1"><ChevronLeft size={24} /></button>
          <h1 className="text-[18px] font-bold">프로필 설정</h1>
        </div>
      </div>

      {/* ─── Profile Images ──────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <ImageUploader
          images={images}
          onChange={setImages}
          maxImages={10}
          minImages={4}
          requireFace
        />
      </div>

      {/* ─── Section Divider ─────────────────────────────────────────── */}
      <div className="h-1.5 bg-gray-50" />

      {/* ─── Basic Info ──────────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-4">
        <p className="text-[13px] font-bold text-gray-500">기본 정보</p>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">이메일</label>
          <input type="email" value="hong@gmail.com" disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1"><Lock size={10} /> 이메일은 변경할 수 없습니다</p>
        </div>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">전화번호</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </div>
      </div>

      {/* ─── Section Divider ─────────────────────────────────────────── */}
      <div className="h-1.5 bg-gray-50" />

      {/* ─── Linked Accounts ─────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-3">
        <p className="text-[13px] font-bold text-gray-500 flex items-center gap-1"><Link2 size={12} /> 연결된 계정</p>
        {[
          { name: '카카오', connected: true, color: 'bg-[#FEE500] text-[#191919]' },
          { name: 'Google', connected: true, color: 'bg-gray-100 text-gray-700' },
          { name: 'Apple', connected: false, color: 'bg-gray-900 text-white' },
          { name: '네이버', connected: false, color: 'bg-[#03C75A] text-white' },
        ].map((acc) => (
          <div key={acc.name} className="flex items-center justify-between py-2">
            <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${acc.color}`}>{acc.name}</span>
            <button
              className={`text-[12px] font-bold px-3.5 py-1.5 rounded-full ${
                acc.connected ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {acc.connected ? '연결 해제' : '연결하기'}
            </button>
          </div>
        ))}
      </div>

      {/* ─── Section Divider ─────────────────────────────────────────── */}
      <div className="h-1.5 bg-gray-50" />

      {/* ─── Refund Account ──────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-3">
        <p className="text-[13px] font-bold text-gray-500 flex items-center gap-1"><Wallet size={12} /> 환불 계좌</p>
        <div className="border border-gray-100 p-4" style={{ borderRadius: 12 }}>
          <p className="text-[13px] text-gray-500">등록된 환불 계좌가 없습니다</p>
          <button className="text-[13px] text-gray-900 font-bold mt-2">계좌 등록하기</button>
        </div>
      </div>

      {/* ─── Save ────────────────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <button
          className="w-full h-[52px] text-white font-bold"
          style={{ backgroundColor: '#2B313D', borderRadius: 12 }}
        >
          저장하기
        </button>
      </div>

      <div className="px-4 pb-10 text-center">
        <button className="text-[12px] text-gray-400 underline">회원 탈퇴</button>
      </div>
    </div>
  );
}
