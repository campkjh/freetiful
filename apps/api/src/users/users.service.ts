import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { NotificationService } from '../notification/notification.service';
import { ImageService } from '../image/image.service';
import { ChatRealtimeService } from '../chat/chat-realtime.service';
import { randomUUID } from 'crypto';

const NOTIFICATION_SETTING_FIELDS = [
  'chatPush',
  'bookingPush',
  'paymentPush',
  'reviewPush',
  'systemPush',
  'marketingPush',
  'marketingSms',
  'marketingEmail',
] as const;

const REFERRAL_EVENT_CAMPAIGN_KEY = 'friend-invite-cash-2026';
const REFERRAL_EVENT_MAX_REWARD = 5000;
const REFERRAL_EVENT_REQUIRED_REFERRALS = 4;
const REFERRAL_EVENT_STEP_REWARD = 1000;
const REFERRAL_EVENT_TOTAL_STEPS = 5;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly notificationService: NotificationService,
    private readonly imageService: ImageService,
    private readonly chatRealtime: ChatRealtimeService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        proProfile: true,
        businessProfile: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; profileImageUrl?: string; profileImageDataUrl?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let profileImageUrl = data.profileImageUrl;
    if (data.profileImageDataUrl?.startsWith('data:image/')) {
      profileImageUrl = await this.saveProfileImageFromDataUrl(data.profileImageDataUrl);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(profileImageUrl !== undefined && {
          profileImageUrl,
        }),
      },
    });
    if (data.name !== undefined || profileImageUrl !== undefined) {
      this.chatRealtime.emitProfileUpdatedForUser(userId, {
        name: updated.name,
        profileImageUrl: updated.profileImageUrl,
      }).catch(() => undefined);
      await this.invalidateDiscoveryForUser(userId);
    }
    return updated;
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    await this.ensureUser(userId);
    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    const processed = await this.imageService.processImage(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
      requireFace: false,
    });

    const profileImageUrl = processed.webpPath || processed.path;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl },
    });
    this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl }).catch(() => undefined);
    await this.invalidateDiscoveryForUser(userId);

    return {
      profileImageUrl,
      width: processed.width,
      height: processed.height,
      size: processed.size,
      mimeType: processed.mimeType,
    };
  }

  private async saveProfileImageFromDataUrl(dataUrl: string): Promise<string> {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('지원하지 않는 이미지 데이터입니다.');
    const [, mimeType, base64] = match;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('파일 크기는 10MB를 초과할 수 없습니다.');
    }
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const processed = await this.imageService.processImage({
      buffer,
      mimetype: mimeType,
      originalname: `profile.${ext}`,
      size: buffer.length,
    } as Express.Multer.File, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
      requireFace: false,
    });
    return processed.webpPath || processed.path;
  }

  async getNotificationSettings(userId: string) {
    await this.ensureUser(userId);
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateNotificationSettings(
    userId: string,
    data: Partial<Record<(typeof NOTIFICATION_SETTING_FIELDS)[number], boolean>>,
  ) {
    await this.ensureUser(userId);
    const next: Record<string, boolean> = {};
    for (const field of NOTIFICATION_SETTING_FIELDS) {
      if (data[field] !== undefined) next[field] = Boolean(data[field]);
    }
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...next },
      update: next,
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // 해당 유저가 사회자면 디스커버리 캐시(상세+리스트) 무효화 — 이름/이미지/활성상태가 노출되므로
  private async invalidateDiscoveryForUser(userId: string) {
    try {
      const pro = await this.prisma.proProfile.findUnique({ where: { userId }, select: { id: true } });
      if (pro) this.discovery.invalidateCache(pro.id);
    } catch {}
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Soft delete — mark inactive and anonymize
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        name: '탈퇴한 회원',
        email: null,
        phone: null,
        profileImageUrl: null,
      },
    });

    await this.invalidateDiscoveryForUser(userId);
    // Delete all sessions
    await this.prisma.session.deleteMany({ where: { userId } });

    return { success: true };
  }

  private async generateUniqueReferralCode() {
    for (let i = 0; i < 10; i++) {
      const code = `FT${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return `FT${Date.now().toString(36).toUpperCase()}`;
  }

  private async ensureReferralCode(user: { id: string; referralCode: string | null }) {
    const current = String(user.referralCode || '').trim().toUpperCase();
    if (current && current !== 'FREETIFUL2026') return current;

    const referralCode = await this.generateUniqueReferralCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { referralCode },
    });
    return referralCode;
  }

  async getReferralEventStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        referralCode: true,
        referredByUserId: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const referralCode = await this.ensureReferralCode(user);

    const [referralCount, rewards, claim, inviter] = await Promise.all([
      this.prisma.user.count({
        where: {
          referredByUserId: userId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.referralEventReward.findMany({
        where: {
          userId,
          campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
        },
        orderBy: { step: 'asc' },
      }),
      this.prisma.referralEventClaim.findUnique({
        where: {
          userId_campaignKey: {
            userId,
            campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
          },
        },
      }),
      user.referredByUserId
        ? this.prisma.user.findUnique({
            where: { id: user.referredByUserId },
            select: { id: true, name: true, referralCode: true },
          })
        : Promise.resolve(null),
    ]);

    const eligibleSteps = Math.min(
      REFERRAL_EVENT_TOTAL_STEPS,
      1 + Math.min(referralCount, REFERRAL_EVENT_REQUIRED_REFERRALS),
    );
    const claimedSteps = new Set(rewards.map((reward) => reward.step));
    const claimedRewardAmount = rewards.reduce((sum, reward) => sum + reward.rewardAmount, 0);

    const milestones = Array.from({ length: REFERRAL_EVENT_TOTAL_STEPS }, (_, index) => {
      const step = index + 1;
      const eligible = step <= eligibleSteps;
      const claimed = claimedSteps.has(step);
      return {
        step,
        rewardAmount: REFERRAL_EVENT_STEP_REWARD,
        completed: eligible,
        eligible,
        claimed,
        label:
          step === 1
            ? '가입완료보상'
            : `친구 ${step}명 초대`,
      };
    });

    return {
      campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
      referralCode,
      referralCount,
      requiredReferrals: REFERRAL_EVENT_REQUIRED_REFERRALS,
      totalRewardAmount: REFERRAL_EVENT_MAX_REWARD,
      stepRewardAmount: REFERRAL_EVENT_STEP_REWARD,
      completedRewardAmount: Math.min(eligibleSteps * REFERRAL_EVENT_STEP_REWARD, REFERRAL_EVENT_MAX_REWARD),
      claimedRewardAmount,
      availableRewardAmount: Math.max(0, Math.min(eligibleSteps * REFERRAL_EVENT_STEP_REWARD, REFERRAL_EVENT_MAX_REWARD) - claimedRewardAmount),
      claimEligible: claimedSteps.size >= REFERRAL_EVENT_TOTAL_STEPS,
      hasEnteredReferralCode: !!user.referredByUserId,
      enteredReferralCode: inviter?.referralCode || null,
      inviterName: inviter?.name || null,
      claim,
      milestones,
    };
  }

  async claimReferralEventReward(userId: string, step: number) {
    const normalizedStep = Number(step);
    if (!Number.isInteger(normalizedStep) || normalizedStep < 1 || normalizedStep > REFERRAL_EVENT_TOTAL_STEPS) {
      throw new BadRequestException('유효하지 않은 보상 단계입니다.');
    }

    await this.ensureUser(userId);

    const referralCount = await this.prisma.user.count({
      where: {
        referredByUserId: userId,
        deletedAt: null,
        isActive: true,
      },
    });
    const eligibleSteps =
      normalizedStep === 1
        ? 1
        : Math.min(
            REFERRAL_EVENT_TOTAL_STEPS,
            1 + Math.min(referralCount, REFERRAL_EVENT_REQUIRED_REFERRALS),
          );

    if (normalizedStep > eligibleSteps) {
      throw new BadRequestException('아직 받을 수 없는 보상입니다.');
    }

    await this.prisma.referralEventReward.upsert({
      where: {
        userId_campaignKey_step: {
          userId,
          campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
          step: normalizedStep,
        },
      },
      create: {
        userId,
        campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
        step: normalizedStep,
        rewardAmount: REFERRAL_EVENT_STEP_REWARD,
        claimedAt: new Date(),
      },
      update: {},
    });

    return this.getReferralEventStatus(userId);
  }

  async applyReferralEventCode(userId: string, code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('초대코드를 입력해주세요.');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        referredByUserId: true,
        referralCode: true,
      },
    });
    if (!currentUser) throw new NotFoundException('User not found');
    if (currentUser.referredByUserId) {
      throw new BadRequestException('이미 초대코드를 등록하셨습니다.');
    }
    if (currentUser.referralCode === normalizedCode) {
      throw new BadRequestException('본인 초대코드는 등록할 수 없습니다.');
    }

    const inviter = await this.prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true, name: true, referralCode: true, isActive: true, deletedAt: true },
    });
    if (!inviter || !inviter.isActive || inviter.deletedAt) {
      throw new BadRequestException('유효하지 않은 초대코드입니다.');
    }
    if (inviter.id === userId) {
      throw new BadRequestException('본인 초대코드는 등록할 수 없습니다.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { referredByUserId: inviter.id },
    });

    const referralCount = await this.prisma.user.count({
      where: {
        referredByUserId: inviter.id,
        deletedAt: null,
        isActive: true,
      },
    });

    this.notificationService
      .createNotification(
        inviter.id,
        'system' as any,
        '친구 초대가 반영됐어요',
        `${referralCount}명의 친구가 초대코드로 참여했어요.`,
        {
          type: 'referral_event_joined',
          referralCount,
          joinedUserId: userId,
        },
      )
      .catch(() => undefined);

    return this.getReferralEventStatus(userId);
  }

  async submitReferralEventClaim(
    userId: string,
    data: { bankName?: string; accountHolder?: string; accountNumber?: string },
  ) {
    const bankName = String(data.bankName || '').trim();
    const accountHolder = String(data.accountHolder || '').trim();
    const accountNumber = String(data.accountNumber || '').trim();

    if (!bankName || !accountHolder || !accountNumber) {
      throw new BadRequestException('은행명, 예금주, 계좌번호를 모두 입력해주세요.');
    }

    const [referralCount, rewardCount] = await Promise.all([
      this.prisma.user.count({
        where: {
          referredByUserId: userId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.referralEventReward.count({
        where: {
          userId,
          campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
          step: { gte: 1, lte: REFERRAL_EVENT_TOTAL_STEPS },
        },
      }),
    ]);
    if (rewardCount < REFERRAL_EVENT_TOTAL_STEPS) {
      throw new BadRequestException('마지막 1,000원까지 받은 후 신청할 수 있습니다.');
    }

    const claim = await this.prisma.referralEventClaim.upsert({
      where: {
        userId_campaignKey: {
          userId,
          campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
        },
      },
      create: {
        userId,
        campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
        referralCountSnapshot: referralCount,
        rewardAmount: REFERRAL_EVENT_MAX_REWARD,
        bankName,
        accountHolder,
        accountNumber,
        status: 'pending',
        submittedAt: new Date(),
      },
      update: {
        referralCountSnapshot: referralCount,
        rewardAmount: REFERRAL_EVENT_MAX_REWARD,
        bankName,
        accountHolder,
        accountNumber,
        status: 'pending',
        submittedAt: new Date(),
      },
    });

    this.notificationService
      .createNotification(
        userId,
        'system' as any,
        '정산 신청이 접수됐어요',
        '친구 초대 이벤트 현금 지급 신청이 접수되었습니다.',
        {
          type: 'referral_event_claim_submitted',
          claimId: claim.id,
        },
      )
      .catch(() => undefined);

    return this.getReferralEventStatus(userId);
  }

}
