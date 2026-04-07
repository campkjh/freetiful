'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NotifSetting {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const INITIAL_SETTINGS: NotifSetting[] = [
  { key: 'chatPush', label: '채팅 알림', description: '새 메시지 수신 시 알림', enabled: true },
  { key: 'bookingPush', label: '예약 알림', description: '예약 확정, 변경, 취소 시 알림', enabled: true },
  { key: 'paymentPush', label: '결제 알림', description: '결제 완료, 환불 처리 시 알림', enabled: true },
  { key: 'reviewPush', label: '리뷰 알림', description: '리뷰 작성 요청 및 답변 알림', enabled: true },
  { key: 'systemPush', label: '시스템 알림', description: '서비스 공지, 업데이트 알림', enabled: true },
  { key: 'marketingPush', label: '마케팅 알림', description: '이벤트, 프로모션 정보', enabled: false },
  { key: 'marketingSms', label: '마케팅 SMS', description: 'SMS로 마케팅 정보 수신', enabled: false },
  { key: 'marketingEmail', label: '마케팅 이메일', description: '이메일로 마케팅 정보 수신', enabled: false },
];

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const toggle = (key: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">알림 설정</h1>
      </div>

      <div className="p-4 space-y-2">
        {settings.map((s) => (
          <div key={s.key} className="bg-white rounded-xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{s.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.description}</p>
            </div>
            <button
              onClick={() => toggle(s.key)}
              className={`relative w-11 h-6 rounded-full transition-colors ${s.enabled ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${s.enabled ? 'translate-x-5.5 left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
