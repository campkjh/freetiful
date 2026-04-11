'use client';

import { ChevronLeft, Copy, Share2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const REFERRAL = {
  code: 'FREETIFUL2026',
  pointsPerInvite: 500,
  inviteCount: 3,
  earnedPoints: 1500,
};

export default function InvitePage() {
  const router = useRouter();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(REFERRAL.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: '프리티풀 - 전문가 매칭',
        text: `프리티풀에서 전문가를 찾아보세요! 추천코드 ${REFERRAL.code} 입력 시 ${REFERRAL.pointsPerInvite}P 적립!`,
        url: window.location.origin,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">친구 초대</h1>
        </div>
      </div>

      {/* 메인 텍스트 */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-[24px] font-bold text-gray-900 leading-tight">
          친구 초대하면<br />
          <span style={{ color: '#2B313D' }}>{REFERRAL.pointsPerInvite}P</span>씩 드려요
        </p>
        <p className="text-[14px] text-gray-400 mt-2">초대받은 친구에게도 {REFERRAL.pointsPerInvite}P가 지급돼요</p>
      </div>

      {/* 추천 코드 */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 px-4 py-3.5 text-center" style={{ borderRadius: 10 }}>
            <span className="text-[16px] font-medium text-gray-900 tracking-[0.1em]">{REFERRAL.code}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`w-[48px] h-[48px] flex items-center justify-center shrink-0 transition-all active:scale-90 ${
              copied ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-500'
            }`}
            style={{ borderRadius: 10 }}
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>

        <button
          onClick={handleShare}
          className="w-full mt-3 text-white py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#2B313D', borderRadius: 12 }}
        >
          <Share2 size={16} /> 친구에게 공유하기
        </button>
      </div>

      <div className="h-1.5 bg-gray-50" />

      {/* 초대 현황 */}
      <div className="px-5 py-4">
        <p className="text-[14px] font-bold text-gray-900 mb-3">초대 현황</p>
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 py-4 text-center" style={{ borderRadius: 12 }}>
            <p className="text-[22px] font-bold text-gray-900">{REFERRAL.inviteCount}<span className="text-[14px] font-medium text-gray-400">명</span></p>
            <p className="text-[12px] text-gray-400 mt-0.5">초대한 친구</p>
          </div>
          <div className="flex-1 bg-gray-50 py-4 text-center" style={{ borderRadius: 12 }}>
            <p className="text-[22px] font-bold text-gray-900">{REFERRAL.earnedPoints.toLocaleString()}<span className="text-[14px] font-medium text-gray-400">P</span></p>
            <p className="text-[12px] text-gray-400 mt-0.5">적립 포인트</p>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-gray-50" />

      {/* 유의사항 */}
      <div className="px-5 py-4">
        <p className="text-[14px] font-bold text-gray-900 mb-2">유의사항</p>
        <ul className="text-[13px] text-gray-400 space-y-1.5">
          <li className="flex gap-1.5"><span className="text-gray-300">·</span>추천 코드를 통해 가입한 친구가 첫 결제를 완료하면 포인트가 적립됩니다.</li>
          <li className="flex gap-1.5"><span className="text-gray-300">·</span>자기 자신을 추천할 수 없습니다.</li>
          <li className="flex gap-1.5"><span className="text-gray-300">·</span>적립된 포인트는 서비스 결제 시 사용 가능합니다.</li>
          <li className="flex gap-1.5"><span className="text-gray-300">·</span>부정한 방법으로 획득한 포인트는 회수될 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}
