'use client';

import { ArrowLeft, Copy, Share2, Gift, Users, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MOCK_REFERRAL = {
  code: 'PRETTY2026',
  pointsPerInvite: 500,
  inviteCount: 3,
  earnedPoints: 1500,
};

export default function InvitePage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MOCK_REFERRAL.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: '프리티풀 - 웨딩 전문가 매칭',
        text: `프리티풀에서 웨딩 전문가를 찾아보세요! 추천코드 ${MOCK_REFERRAL.code} 입력 시 ${MOCK_REFERRAL.pointsPerInvite}P 적립!`,
        url: window.location.origin,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">친구 초대</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 혜택 배너 */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-white text-center">
          <Gift size={40} className="mx-auto mb-3" />
          <h2 className="text-lg font-black mb-1">친구 초대하고 포인트 받자!</h2>
          <p className="text-sm text-primary-100">
            친구 1명 초대할 때마다 <strong>{MOCK_REFERRAL.pointsPerInvite}P</strong> 적립
          </p>
          <p className="text-xs text-primary-200 mt-1">초대받은 친구에게도 {MOCK_REFERRAL.pointsPerInvite}P 지급</p>
        </div>

        {/* 추천 코드 */}
        <div className="bg-white rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-2">내 추천 코드</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-center">
              <span className="text-lg font-black text-gray-900 tracking-widest">{MOCK_REFERRAL.code}</span>
            </div>
            <button
              onClick={handleCopy}
              className={`p-3 rounded-xl transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
          <button
            onClick={handleShare}
            className="w-full mt-3 bg-primary-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Share2 size={16} /> 친구에게 공유하기
          </button>
        </div>

        {/* 통계 */}
        <div className="bg-white rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">초대 현황</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Users size={20} className="text-primary-500 mx-auto mb-1" />
              <p className="text-xl font-black text-gray-900">{MOCK_REFERRAL.inviteCount}명</p>
              <p className="text-[10px] text-gray-400">초대한 친구</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Gift size={20} className="text-primary-500 mx-auto mb-1" />
              <p className="text-xl font-black text-gray-900">{MOCK_REFERRAL.earnedPoints.toLocaleString()}P</p>
              <p className="text-[10px] text-gray-400">적립된 포인트</p>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-white rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-2">유의사항</h3>
          <ul className="text-xs text-gray-500 space-y-1.5 list-disc pl-4">
            <li>추천 코드를 통해 가입한 친구가 첫 결제를 완료해야 포인트가 적립됩니다.</li>
            <li>자기 자신을 추천할 수 없습니다.</li>
            <li>적립된 포인트는 서비스 결제 시 사용 가능합니다.</li>
            <li>부정한 방법으로 획득한 포인트는 회수될 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
