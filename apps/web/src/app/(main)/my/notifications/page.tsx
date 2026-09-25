'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { usersApi, type NotificationSettings } from '@/lib/api/users.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { syncPushRegistration } from '@/lib/utils/push';
import { MyDetailHeader } from '../_components/detail-ui';

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
  const authUser = useAuthStore((s) => s.user);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
    let cancelled = false;
    usersApi.getNotificationSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings((prev) => prev.map((s) => ({
          ...s,
          enabled: Boolean(data[s.key as keyof NotificationSettings]),
        })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const requestPushPermission = async () => {
    await syncPushRegistration(authUser?.id);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
      if (Notification.permission === 'granted') toast.success('푸시 알림이 활성화되었습니다');
      else if (Notification.permission === 'denied') toast.error('브라우저 설정에서 알림 권한을 허용해주세요');
    }
  };

  const toggle = async (key: string) => {
    const current = settings.find((s) => s.key === key);
    if (!current || savingKey) return;
    const nextEnabled = !current.enabled;
    setSavingKey(key);
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: nextEnabled } : s)));
    try {
      const saved = await usersApi.updateNotificationSettings({ [key]: nextEnabled } as Partial<NotificationSettings>);
      setSettings((prev) => prev.map((s) => ({
        ...s,
        enabled: Boolean(saved[s.key as keyof NotificationSettings]),
      })));
      if (nextEnabled && key.endsWith('Push')) void syncPushRegistration(authUser?.id);
    } catch {
      setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: current.enabled } : s)));
      toast.error('알림 설정 저장에 실패했습니다');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="알림 설정" sub="받고 싶은 알림만 골라 받으세요" />

      <div className="qd-body space-y-2.5 px-6 pb-10 pt-1">
        <div
          className="flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] border-[1.5px] border-[#C9DFFF] bg-[#EDF4FF] px-[18px] py-3.5"
        >
          <div>
            <p className="text-[17px] font-semibold text-[#333D4B]">푸시 알림 권한</p>
            <p className="mt-[3px] text-[13px] text-[#6B7684]">
              {pushPermission === 'granted'
                ? '이 기기에서 푸시 수신 가능'
                : pushPermission === 'denied'
                  ? '브라우저/앱 설정에서 권한 허용 필요'
                  : '알림을 받으려면 권한을 허용해주세요'}
            </p>
          </div>
          <button
            onClick={requestPushPermission}
            className="h-9 shrink-0 rounded-[12px] bg-[#3182F6] px-3.5 text-[14px] font-semibold text-white transition-transform active:scale-95 disabled:bg-[#DCEBFF] disabled:text-[#3182F6]"
            disabled={pushPermission === 'granted'}
          >
            {pushPermission === 'granted' ? '활성화됨' : '허용'}
          </button>
        </div>

        {settings.map((s) => (
          <div
            key={s.key}
            className="qd-card flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5"
          >
            <div>
              <p className="text-[17px] font-semibold text-[#333D4B]">{s.label}</p>
              <p className="mt-[3px] text-[13px] text-[#8B95A1]">{s.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={s.enabled}
              aria-label={s.label}
              onClick={() => toggle(s.key)}
              disabled={savingKey === s.key}
              className="relative h-7 w-12 shrink-0 rounded-full p-[3px] transition-[background-color,box-shadow,opacity] duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-[#3180F7]/15 disabled:opacity-45"
              style={{
                backgroundColor: s.enabled ? '#3180F7' : '#D1D6DB',
                boxShadow: s.enabled
                  ? 'inset 0 0 0 1px rgba(49,128,247,0.18)'
                  : 'inset 0 0 0 1px rgba(0,0,0,0.05)',
              }}
            >
              <span
                className={`block h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(25,31,40,0.22)] transition-transform duration-200 ease-out ${
                  s.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
