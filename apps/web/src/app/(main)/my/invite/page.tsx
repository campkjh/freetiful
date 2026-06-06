'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, Copy, Loader2, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi, type ReferralEventStatus } from '@/lib/api/users.api';
import { useAuthStore } from '@/lib/store/auth.store';

const ASSET_BASE = '/images/referral-event';

function claimStatusText(status?: string | null) {
  if (status === 'approved') return '승인됨';
  if (status === 'paid') return '지급완료';
  if (status === 'rejected') return '반려됨';
  return '접수중';
}

function isAuthExpiredError(error: any) {
  const message = error?.response?.data?.message;
  const text = Array.isArray(message) ? message.join(' ') : String(message || '');
  return error?.response?.status === 401 || /invalid|expired|token|인증|로그인/i.test(text);
}

function Avatar({ src, alt, size = 68 }: { src: string; alt: string; size?: number }) {
  const responsiveSize = `clamp(${Math.round(size * 0.68)}px, ${((size / 603) * 100).toFixed(2)}vw, ${size}px)`;
  return (
    <img
      src={`${ASSET_BASE}/${src}`}
      alt={alt}
      className="shrink-0 object-contain"
      style={{ width: responsiveSize, height: responsiveSize }}
    />
  );
}

type RewardButtonProps = {
  step: number;
  eligible: boolean;
  claimed: boolean;
  loading: boolean;
  onClaim: (step: number) => void;
};

function RewardButton({ step, eligible, claimed, loading, onClaim }: RewardButtonProps) {
  const canClaim = eligible && !claimed && !loading;

  return (
    <div className="relative flex shrink-0 justify-center">
      {canClaim && (
        <span className="claim-bubble pointer-events-none absolute -top-[36px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
          지금 받기
        </span>
      )}
      <button
        type="button"
        onClick={() => canClaim && onClaim(step)}
        disabled={!canClaim}
        className={[
          'inline-flex items-center justify-center gap-1.5 px-4 font-bold tracking-[-0.035em] text-white transition',
          canClaim ? 'bg-[#4482FF] shadow-[0_10px_22px_rgba(68,130,255,0.25)] active:scale-[0.98]' : '',
          claimed ? 'bg-[#8FAEFF]' : '',
          !eligible && !claimed ? 'bg-[#D6E1FF]' : '',
        ].join(' ')}
        style={{
          minWidth: 'clamp(84px, 20.56vw, 124px)',
          height: 'clamp(36px, 7.46vw, 45px)',
          borderRadius: 'clamp(10px, 2.16vw, 13px)',
          fontSize: 'clamp(15px, 3.15vw, 20px)',
        }}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : claimed ? (
          <>
            <Check size={17} strokeWidth={2.7} />
            완료
          </>
        ) : (
          '+1,000원'
        )}
      </button>
    </div>
  );
}

type MilestoneRowProps = {
  step: number;
  label: string;
  avatar: string;
  avatarAlt: string;
  reverse?: boolean;
  eligible: boolean;
  claimed: boolean;
  loading: boolean;
  onClaim: (step: number) => void;
};

function MilestoneRow({
  step,
  label,
  avatar,
  avatarAlt,
  reverse = false,
  eligible,
  claimed,
  loading,
  onClaim,
}: MilestoneRowProps) {
  const title = (
    <p className="min-w-0 flex-1 text-center font-bold tracking-[-0.04em] text-[#343944]" style={{ fontSize: 'clamp(17px, 3.65vw, 23px)' }}>
      {label}
    </p>
  );
  const reward = <RewardButton step={step} eligible={eligible} claimed={claimed} loading={loading} onClaim={onClaim} />;
  const character = <Avatar src={avatar} alt={avatarAlt} size={72} />;

  return (
    <div
      className="relative flex items-center justify-between gap-3 bg-[#FAFAFA]"
      style={{
        minHeight: 'clamp(78px, 17.24vw, 104px)',
        borderRadius: 'clamp(28px, 6.63vw, 40px)',
        paddingInline: 'clamp(18px, 4.64vw, 28px)',
        paddingBlock: 'clamp(14px, 3.15vw, 19px)',
      }}
    >
      {reverse ? reward : character}
      {title}
      {reverse ? character : reward}
    </div>
  );
}

function ClaimModal({
  open,
  status,
  form,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  status: ReferralEventStatus | null;
  form: { bankName: string; accountHolder: string; accountNumber: string };
  submitting: boolean;
  onChange: (next: { bankName: string; accountHolder: string; accountNumber: string }) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 px-4 pb-4 pt-10 backdrop-blur-[2px]">
      <div className="w-full max-w-[520px] rounded-[30px] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wallet size={22} className="text-[#4482FF]" />
              <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[#2B313D]">현금 지급 신청</h2>
            </div>
            <p className="mt-1.5 text-[14px] font-medium leading-[1.45] tracking-[-0.03em] text-[#8A93A5]">
              5,000원 보상을 모두 받았어요. 지급 받을 계좌를 입력해주세요.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F5F8] text-[#7C8494]">
            <X size={19} />
          </button>
        </div>

        {status?.claim?.status && (
          <div className="mt-4 rounded-2xl bg-[#F2F6FF] px-4 py-3 text-[14px] font-semibold text-[#4482FF]">
            현재 상태: {claimStatusText(status.claim.status)}
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          <input
            value={form.bankName}
            onChange={(e) => onChange({ ...form, bankName: e.target.value })}
            placeholder="은행명"
            className="h-[52px] w-full rounded-[16px] border border-[#E4E9F0] bg-white px-4 text-[16px] font-medium text-[#111318] outline-none placeholder:text-[#B0B8C4] focus:border-[#4482FF]"
          />
          <input
            value={form.accountHolder}
            onChange={(e) => onChange({ ...form, accountHolder: e.target.value })}
            placeholder="예금주"
            className="h-[52px] w-full rounded-[16px] border border-[#E4E9F0] bg-white px-4 text-[16px] font-medium text-[#111318] outline-none placeholder:text-[#B0B8C4] focus:border-[#4482FF]"
          />
          <input
            value={form.accountNumber}
            onChange={(e) => onChange({ ...form, accountNumber: e.target.value })}
            placeholder="계좌번호"
            inputMode="numeric"
            className="h-[52px] w-full rounded-[16px] border border-[#E4E9F0] bg-white px-4 text-[16px] font-medium text-[#111318] outline-none placeholder:text-[#B0B8C4] focus:border-[#4482FF]"
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="mt-4 inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#4482FF] text-[18px] font-bold tracking-[-0.035em] text-white disabled:opacity-60"
        >
          {submitting && <Loader2 size={19} className="animate-spin" />}
          {status?.claim ? '계좌정보 저장하기' : '5,000원 신청하기'}
        </button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const hasAuthSession = Boolean(accessToken || refreshToken);
  const isLoggedIn = hasAuthSession;

  const [loading, setLoading] = useState(true);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimingStep, setClaimingStep] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [status, setStatus] = useState<ReferralEventStatus | null>(null);
  const [claimForm, setClaimForm] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
  });

  const milestones = useMemo(() => {
    const byStep = new Map((status?.milestones || []).map((milestone) => [milestone.step, milestone]));
    return [
      { step: 1, label: '가입완료보상', avatar: 'avatar-girl-main.png', avatarAlt: '가입완료보상', reverse: false },
      { step: 2, label: '친구 2명 초대', avatar: 'avatar-boy-main.png', avatarAlt: '친구 2명 초대', reverse: true },
      { step: 3, label: '친구 3명 초대', avatar: 'avatar-girl.png', avatarAlt: '친구 3명 초대', reverse: false },
      { step: 4, label: '친구 4명 초대', avatar: 'avatar-boy.png', avatarAlt: '친구 4명 초대', reverse: true },
      { step: 5, label: '친구 5명 초대', avatar: 'avatar-woman.png', avatarAlt: '친구 5명 초대', reverse: false },
    ].map((item) => {
      const milestone = byStep.get(item.step);
      return {
        ...item,
        eligible: item.step === 1 && isLoggedIn ? true : Boolean(milestone?.eligible),
        claimed: Boolean(milestone?.claimed),
      };
    });
  }, [isLoggedIn, status]);

  const myReferralCode = status?.referralCode || authUser?.referralCode || '';
  const claimedRewardAmount = status?.claimedRewardAmount || 0;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.getReferralEventStatus();
      setStatus(data);
      if (data.claim) {
        setClaimForm({
          bankName: data.claim.bankName || '',
          accountHolder: data.claim.accountHolder || '',
          accountNumber: data.claim.accountNumber || '',
        });
      }
    } catch (error: any) {
      if (isAuthExpiredError(error)) {
        toast.error('로그인이 만료됐어요. 다시 로그인 후 보상을 받을 수 있어요.');
      } else {
        toast.error(error?.response?.data?.message || '이벤트 정보를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (authUser && !hasAuthSession) {
      useAuthStore.getState().logout();
      window.dispatchEvent(new Event('freetiful:show-login'));
      setLoading(false);
      return;
    }
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    loadStatus();
  }, [authHydrated, authUser, hasAuthSession, isLoggedIn, loadStatus]);

  const handleCopyCode = async () => {
    if (!myReferralCode) {
      toast.error('로그인 후 초대코드를 확인할 수 있어요.');
      return;
    }
    try {
      await navigator.clipboard.writeText(myReferralCode);
      setCopied(true);
      toast.success('초대코드를 복사했어요.');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('초대코드 복사에 실패했어요.');
    }
  };

  const handleClaimReward = async (step: number) => {
    if (!isLoggedIn) {
      toast.error('로그인 후 보상을 받을 수 있어요.');
      return;
    }
    const wasEligibleForCash = Boolean(status?.claimEligible);
    setClaimingStep(step);
    try {
      const next = await usersApi.claimReferralEventReward(step);
      setStatus(next);
      toast.success('1,000원 보상을 받았어요.');
      if (!wasEligibleForCash && next.claimEligible && !next.claim) {
        setClaimModalOpen(true);
      }
    } catch (error: any) {
      if (isAuthExpiredError(error)) {
        toast.error('로그인이 만료됐어요. 다시 로그인 후 보상을 받을 수 있어요.');
      } else {
        toast.error(error?.response?.data?.message || '보상 수령에 실패했어요.');
      }
    } finally {
      setClaimingStep(null);
    }
  };

  const handleClaim = async () => {
    if (!isLoggedIn) {
      toast.error('로그인 후 신청할 수 있어요.');
      return;
    }
    if (!claimForm.bankName.trim() || !claimForm.accountHolder.trim() || !claimForm.accountNumber.trim()) {
      toast.error('은행명, 예금주, 계좌번호를 모두 입력해주세요.');
      return;
    }
    setSubmittingClaim(true);
    try {
      const next = await usersApi.submitReferralEventClaim({
        bankName: claimForm.bankName.trim(),
        accountHolder: claimForm.accountHolder.trim(),
        accountNumber: claimForm.accountNumber.trim(),
      });
      setStatus(next);
      setClaimModalOpen(false);
      toast.success('이벤트 현금 지급 신청이 접수됐어요.');
    } catch (error: any) {
      if (isAuthExpiredError(error)) {
        toast.error('로그인이 만료됐어요. 다시 로그인 후 신청할 수 있어요.');
      } else {
        toast.error(error?.response?.data?.message || '신청에 실패했어요.');
      }
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="뒤로가기"
        className="fixed left-4 top-[calc(env(safe-area-inset-top)+14px)] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#2B313D] shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-md active:scale-95"
      >
        <ChevronLeft size={24} strokeWidth={2.4} />
      </button>

      <main className="mx-auto w-full max-w-[603px] bg-white pt-[calc(env(safe-area-inset-top)+54px)]">
        <section className="bg-white">
          <img src={`${ASSET_BASE}/hero-top.png`} alt="친구 초대 이벤트" className="block h-auto w-full" />
        </section>

        <section className="space-y-[24px] px-[25px] pb-[42px] pt-[20px]">
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.step}
              step={milestone.step}
              label={milestone.label}
              avatar={milestone.avatar}
              avatarAlt={milestone.avatarAlt}
              reverse={milestone.reverse}
              eligible={milestone.eligible}
              claimed={milestone.claimed}
              loading={claimingStep === milestone.step}
              onClaim={handleClaimReward}
            />
          ))}
        </section>

        <section className="px-[25px] pb-[30px]">
          <div className="rounded-[28px] bg-[#F8FAFF] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold tracking-[-0.03em] text-[#8F98AA]">받은 보상</p>
                <p className="mt-1 text-[24px] font-bold tracking-[-0.04em] text-[#4482FF]">
                  {claimedRewardAmount.toLocaleString()}원
                  <span className="ml-1 text-[14px] font-semibold text-[#A4ABBA]">/ 5,000원</span>
                </p>
              </div>
              {status?.claimEligible && (
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(true)}
                  className="h-[44px] rounded-[14px] bg-[#4482FF] px-4 text-[15px] font-bold tracking-[-0.03em] text-white shadow-[0_10px_22px_rgba(68,130,255,0.22)]"
                >
                  지급신청
                </button>
              )}
            </div>
            {status?.claim?.status && (
              <p className="mt-2 text-[13px] font-semibold tracking-[-0.03em] text-[#8A93A5]">
                신청 상태: {claimStatusText(status.claim.status)}
              </p>
            )}
          </div>
        </section>

        <section className="px-[25px] pb-[30px]">
          <p className="text-[16px] font-semibold tracking-[-0.035em] text-[#A4ABBA]">내 초대코드</p>
          <div className="mt-[10px] flex items-center gap-[10px]">
            <p className="min-w-0 flex-1 truncate text-[26px] font-bold tracking-[-0.045em] text-black">
              {loading ? '불러오는 중' : myReferralCode || '로그인 후 확인'}
            </p>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!myReferralCode}
              className="inline-flex h-[46px] shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-[#F1F3F6] px-[18px] text-[17px] font-bold tracking-[-0.04em] text-[#2B313D] disabled:text-[#B7BFCC]"
            >
              <Copy size={19} strokeWidth={2.4} />
              {copied ? '완료' : '복사'}
            </button>
          </div>
        </section>

        <section className="px-[25px] pb-[30px]">
          <h2 className="text-[20px] font-bold tracking-[-0.04em] text-[#2B313D]">유의사항</h2>
          <div className="mt-[12px] space-y-[3px] text-[16px] font-medium leading-[1.5] tracking-[-0.035em] text-[#A8B3C7]">
            <p>추천 코드를 통해 친구가 가입을 완료하면 현금이 쌓입니다.</p>
            <p>자기 자신을 추천할 수 없습니다.</p>
            <p>마지막 1,000원까지 받은 뒤 본인 계좌로 5,000원이 지급됩니다.</p>
            <p>부정한 방법으로 초대할 경우 회수될 수 있습니다.</p>
          </div>
        </section>

      </main>

      <ClaimModal
        open={claimModalOpen}
        status={status}
        form={claimForm}
        submitting={submittingClaim}
        onChange={setClaimForm}
        onClose={() => setClaimModalOpen(false)}
        onSubmit={handleClaim}
      />

      <style>{`
        @keyframes inviteClaimBubbleFloat {
          0%, 100% {
            transform: translate(-50%, 0);
          }
          50% {
            transform: translate(-50%, -6px);
          }
        }

        .claim-bubble {
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(226, 232, 240, 0.9);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
          color: #2B313D;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.03em;
          padding: 7px 12px;
          backdrop-filter: blur(14px);
          animation: inviteClaimBubbleFloat 2.8s ease-in-out infinite;
        }

        .claim-bubble::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -5px;
          width: 10px;
          height: 10px;
          transform: translateX(-50%) rotate(45deg);
          background: rgba(255, 255, 255, 0.9);
          border-right: 1px solid rgba(226, 232, 240, 0.9);
          border-bottom: 1px solid rgba(226, 232, 240, 0.9);
        }
      `}</style>
    </div>
  );
}
