'use client';

// 옛 알림 링크(/quote/:id) 받는 곳 — 예전 API 가 견적 알림(견적서 도착·수락·행사 D-3/당일·후기 요청)에 없는 /quote/:id 를 붙여
// 눌러도 404 였다(260928). 이미 발송돼 저장된 알림·푸시가 남아 있어서 여기서 견적의 채팅방으로 보내고,
// 방이 없으면 고객은 구매 내역, 사회자는 받은 결제 내역으로. (새 알림은 API 가 처음부터 올바른 목적지를 싣는다)
import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { quotationApi } from '@/lib/api/quotation.api';
import { useAuthStore } from '@/lib/store/auth.store';

export default function QuoteRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !id) return;
    startedRef.current = true;
    const fallback = () => router.replace(useAuthStore.getState().user?.role === 'pro' ? '/my/payment-history' : '/my/purchase-history');
    quotationApi
      .getDetail(id)
      .then((q: any) => {
        const roomId = q?.chatRoomId || q?.chatRoom?.id;
        if (roomId) router.replace(`/chat/${roomId}`);
        else fallback();
      })
      .catch(fallback);
  }, [id, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true" aria-label="이동하는 중">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#E5E8EB] border-t-[#3182F6]" />
    </div>
  );
}
