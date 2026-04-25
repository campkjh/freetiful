import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { AuthProvider, User } from '@prisma/client';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SocialUserInfo {
  providerUserId: string;
  providerEmail?: string;
  name?: string;
  profileImageUrl?: string;
}

export interface LoginDeviceInfo {
  platform?: string;
  source?: string;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private notificationService: NotificationService,
  ) {}

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private normalizeDevicePlatform(value?: string, userAgent?: string) {
    const raw = `${value || ''} ${userAgent || ''}`.toLowerCase();
    if (/iphone|ipad|ipod|\bios\b/.test(raw)) return 'ios';
    if (/android/.test(raw)) return 'android';
    if (/web|browser|chrome|safari|firefox|edge|mozilla/.test(raw)) return 'web';
    if (/native|app/.test(raw)) return 'app';
    return 'web';
  }

  private buildSessionDeviceInfo(deviceInfo?: LoginDeviceInfo | null) {
    const platform = this.normalizeDevicePlatform(deviceInfo?.platform, deviceInfo?.userAgent);
    return {
      platform,
      source: deviceInfo?.source || 'web',
      userAgent: deviceInfo?.userAgent || null,
    };
  }

  /**
   * 레거시 합성 이메일 유저(fromUserId)의 데이터를 현재 유저(toUserId) 로 이관.
   * 카카오 앱 초기 /auth/kakao/mobile 쉼이 만든 별도 유저가 native 로그인 후
   * 새 유저로 분리된 경우, 채팅방/멤버/결제 내역 등이 끊기지 않도록 병합.
   */
  private async mergeLegacyUserData(fromUserId: string, toUserId: string) {
    // ChatRoom.userId 재매핑 (고객 측)
    await this.prisma.chatRoom.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    // ChatRoomMember 재매핑 — 중복(toUserId 가 이미 멤버) 은 먼저 삭제
    const dupMembers = await this.prisma.chatRoomMember.findMany({
      where: { userId: fromUserId },
      select: { roomId: true },
    });
    if (dupMembers.length > 0) {
      const roomIds = dupMembers.map((m) => m.roomId);
      const existingToMembers = await this.prisma.chatRoomMember.findMany({
        where: { userId: toUserId, roomId: { in: roomIds } },
        select: { roomId: true },
      });
      const alreadyIn = new Set(existingToMembers.map((m) => m.roomId));
      // to 가 이미 멤버인 룸에 대해서는 from 의 레코드를 제거
      if (alreadyIn.size > 0) {
        await this.prisma.chatRoomMember.deleteMany({
          where: { userId: fromUserId, roomId: { in: Array.from(alreadyIn) } },
        });
      }
      // 나머지는 userId 를 toUserId 로 교체
      await this.prisma.chatRoomMember.updateMany({
        where: { userId: fromUserId },
        data: { userId: toUserId },
      });
    }
    // Message.senderId 재매핑
    await this.prisma.message.updateMany({
      where: { senderId: fromUserId },
      data: { senderId: toUserId },
    });
    // Payment.userId 재매핑 (있으면)
    await this.prisma.payment.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }).catch(() => {});
    // Quotation.userId 재매핑 (있으면)
    await this.prisma.quotation.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    }).catch(() => {});
  }

  private async issueTokens(userId: string, deviceInfo?: LoginDeviceInfo | null) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '7d') },
    );
    const refreshToken = uuid();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const normalizedDeviceInfo = this.buildSessionDeviceInfo(deviceInfo);

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceInfo: normalizedDeviceInfo,
        ipAddress: deviceInfo?.ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  // Finds and deletes a session matching the given refresh token; returns it or null.
  private async popSession(refreshToken: string, userId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        ...(userId ? { userId } : {}),
        expiresAt: { gt: new Date() },
      },
      include: { user: !userId },
    });

    for (const session of sessions) {
      if (await bcrypt.compare(refreshToken, session.refreshTokenHash)) {
        await this.prisma.session.delete({ where: { id: session.id } });
        return session;
      }
    }
    return null;
  }

  private async createUser(
    provider: AuthProvider,
    info: SocialUserInfo,
    extras: { email?: string; phone?: string; passwordHash?: string } = {},
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: info.name ?? extras.email ?? '',
        email: extras.email,
        phone: extras.phone,
        profileImageUrl: info.profileImageUrl,
        referralCode: this.generateReferralCode(),
        authProviders: {
          create: {
            provider,
            providerUserId: info.providerUserId,
            providerEmail: extras.email,
            ...(extras.passwordHash ? { accessToken: extras.passwordHash } : {}),
          },
        },
        notificationSettings: { create: {} },
      },
    });
  }

  private async normalizeProRole(user: User): Promise<User> {
    if (user.role !== 'pro') return user;
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });
    if (profile?.status === 'approved') return user;
    return this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'general' },
    });
  }

  private async buildLoginResponse(
    user: User,
    tokens: Awaited<ReturnType<typeof this.issueTokens>>,
    isNewUser: boolean,
  ) {
    const normalizedUser = await this.normalizeProRole(user);
    return {
      user: normalizedUser,
      tokens,
      isNewUser,
      needsPhone: !normalizedUser.phone,
      needsName: !normalizedUser.name,
    };
  }

  private resolveOAuthRedirectUri(configKey: string, redirectUri?: string) {
    const fallback = this.config.get<string>(configKey);
    const candidate = redirectUri?.trim() || fallback;
    if (!candidate) return fallback;

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
      return candidate.replace(/\/+$/, '');
    } catch {
      return fallback;
    }
  }

  private async socialLogin(provider: AuthProvider, info: SocialUserInfo, deviceInfo?: LoginDeviceInfo) {
    // 이메일 정규화 (대소문자/공백 차이로 중복 유저가 생기는 문제 방지)
    const normalizedEmail = info.providerEmail?.trim().toLowerCase() || undefined;

    const authRecord = await this.prisma.authProviderRecord.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: info.providerUserId } },
      include: { user: true },
    });

    let isNewUser = false;
    let user: User;

    if (authRecord) {
      user = authRecord.user;
      // 레거시 합성 이메일이 아직 남아있으면 실제 이메일로 정정
      const isLegacyEmail =
        provider === AuthProvider.kakao &&
        user.email === `kakao_${info.providerUserId}@kakao.freetiful.com`;
      if (isLegacyEmail && normalizedEmail) {
        const conflict = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!conflict || conflict.id === user.id) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { email: normalizedEmail },
          });
        }
      }
      // 구 /auth/kakao/mobile 쉼 이후 native 로그인으로 별도 유저가 만들어진 케이스 →
      // 레거시 유저(synthetic email)에 남아있는 채팅방/멤버 레코드를 현재 유저로 이관
      if (provider === AuthProvider.kakao) {
        const legacyEmail = `kakao_${info.providerUserId}@kakao.freetiful.com`;
        const legacyUser = await this.prisma.user.findUnique({ where: { email: legacyEmail } });
        if (legacyUser && legacyUser.id !== user.id) {
          await this.mergeLegacyUserData(legacyUser.id, user.id).catch(() => {});
        }
      }
    } else {
      // 구 /auth/kakao/mobile 쉼(shim)이 만든 합성 이메일 유저를 먼저 찾아 실제 이메일로 마이그레이션
      // (kakao_{providerUserId}@kakao.freetiful.com 형식)
      const legacyEmail =
        provider === AuthProvider.kakao
          ? `kakao_${info.providerUserId}@kakao.freetiful.com`
          : undefined;
      const legacyUser = legacyEmail
        ? await this.prisma.user.findUnique({ where: { email: legacyEmail } })
        : null;

      if (legacyUser) {
        user = await this.prisma.user.update({
          where: { id: legacyUser.id },
          data: {
            email: normalizedEmail ?? null,
            ...(info.name && !legacyUser.name ? { name: info.name } : {}),
            ...(info.profileImageUrl && !legacyUser.profileImageUrl
              ? { profileImageUrl: info.profileImageUrl }
              : {}),
          },
        });
        await this.prisma.authProviderRecord.create({
          data: {
            userId: user.id,
            provider,
            providerUserId: info.providerUserId,
            providerEmail: normalizedEmail,
          },
        });
      } else if (normalizedEmail) {
        // 1차: 정규화된 이메일로 정확히 일치하는 유저 검색
        let existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        // 2차: 대소문자 무관하게 검색 (기존 DB 의 대소문자 혼재 대응)
        if (!existing) {
          existing = await this.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          });
        }
        if (existing) {
          await this.prisma.authProviderRecord.create({
            data: { userId: existing.id, provider, providerUserId: info.providerUserId, providerEmail: normalizedEmail },
          });
          user = existing;
        } else {
          user = await this.createUser(provider, { ...info, providerEmail: normalizedEmail }, { email: normalizedEmail });
          isNewUser = true;
        }
      } else {
        user = await this.createUser(provider, info);
        isNewUser = true;
      }
    }

    const tokens = await this.issueTokens(user.id, deviceInfo);
    if (isNewUser) {
      this.notificationService.createNotification(
        user.id, 'system' as any,
        '프리티풀에 오신 것을 환영합니다! 🎉',
        '전문 사회자를 쉽고 빠르게 찾아보세요.',
      ).catch(() => {});
    }
    return this.buildLoginResponse(user, tokens, isNewUser);
  }

  async kakaoLogin(code: string, redirectUri?: string, deviceInfo?: LoginDeviceInfo) {
    const params: Record<string, string | undefined> = {
      grant_type: 'authorization_code',
      client_id: this.config.get('KAKAO_CLIENT_ID') || 'dca1b472188890116c81a55eff590885',
      redirect_uri: this.resolveOAuthRedirectUri('KAKAO_REDIRECT_URI', redirectUri),
      code,
    };
    const clientSecret = this.config.get<string>('KAKAO_CLIENT_SECRET');
    if (clientSecret) params.client_secret = clientSecret;

    const { data: tokenData } = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params,
    });
    const { data: kakaoUser } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    return this.socialLogin(AuthProvider.kakao, {
      providerUserId: String(kakaoUser.id),
      providerEmail: kakaoUser.kakao_account?.email,
      name: kakaoUser.kakao_account?.profile?.nickname,
      profileImageUrl: kakaoUser.kakao_account?.profile?.profile_image_url,
    }, deviceInfo);
  }

  async kakaoNativeLogin(accessToken: string, deviceInfo?: LoginDeviceInfo) {
    const { data: kakaoUser } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return this.socialLogin(AuthProvider.kakao, {
      providerUserId: String(kakaoUser.id),
      providerEmail: kakaoUser.kakao_account?.email,
      name: kakaoUser.kakao_account?.profile?.nickname,
      profileImageUrl: kakaoUser.kakao_account?.profile?.profile_image_url,
    }, deviceInfo);
  }

  async googleLogin(idToken: string, deviceInfo?: LoginDeviceInfo) {
    const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    return this.socialLogin(AuthProvider.google, {
      providerUserId: data.sub,
      providerEmail: data.email,
      name: data.name,
      profileImageUrl: data.picture,
    }, deviceInfo);
  }

  async naverLogin(code: string, state: string, redirectUri?: string, deviceInfo?: LoginDeviceInfo) {
    const { data: tokenData } = await axios.get('https://nid.naver.com/oauth2.0/token', {
      params: {
        grant_type: 'authorization_code',
        client_id: this.config.get('NAVER_CLIENT_ID'),
        client_secret: this.config.get('NAVER_CLIENT_SECRET'),
        code,
        state,
        redirect_uri: this.resolveOAuthRedirectUri('NAVER_REDIRECT_URI', redirectUri),
      },
    });
    return this.naverProfileLogin(tokenData.access_token, deviceInfo);
  }

  /** iOS/Android 네이티브 SDK에서 이미 발급받은 access token으로 로그인 */
  async naverNativeLogin(accessToken: string, deviceInfo?: LoginDeviceInfo) {
    return this.naverProfileLogin(accessToken, deviceInfo);
  }

  private async naverProfileLogin(accessToken: string, deviceInfo?: LoginDeviceInfo) {
    const { data: profile } = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = profile.response;
    return this.socialLogin(AuthProvider.naver, {
      providerUserId: u.id,
      providerEmail: u.email,
      name: u.name,
      profileImageUrl: u.profile_image,
    }, deviceInfo);
  }

  // NOTE: In production, verify Apple's JWT signature using Apple's public keys.
  async appleLogin(identityToken: string, fullName?: string, deviceInfo?: LoginDeviceInfo) {
    const payload = JSON.parse(Buffer.from(identityToken.split('.')[1], 'base64').toString());
    return this.socialLogin(AuthProvider.apple, {
      providerUserId: payload.sub,
      providerEmail: payload.email,
      name: fullName,
    }, deviceInfo);
  }

  async emailRegister(dto: { email: string; password: string; name: string; phone?: string }, deviceInfo?: LoginDeviceInfo) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.createUser(
      AuthProvider.email,
      { providerUserId: dto.email, name: dto.name },
      { email: dto.email, phone: dto.phone, passwordHash },
    );
    this.notificationService.createNotification(
      user.id, 'system' as any,
      '프리티풀에 오신 것을 환영합니다! 🎉',
      '전문 사회자를 쉽고 빠르게 찾아보세요.',
    ).catch(() => {});
    return this.buildLoginResponse(user, await this.issueTokens(user.id, deviceInfo), true);
  }

  async emailLogin(email: string, password: string, deviceInfo?: LoginDeviceInfo) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { authProviders: { where: { provider: AuthProvider.email } } },
    });
    if (!user?.authProviders[0]) throw new UnauthorizedException('Invalid credentials');
    if (!await bcrypt.compare(password, user.authProviders[0].accessToken!)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildLoginResponse(user, await this.issueTokens(user.id, deviceInfo), false);
  }

  async refresh(refreshToken: string, deviceInfo?: LoginDeviceInfo) {
    const session = await this.popSession(refreshToken);
    if (!session) throw new UnauthorizedException('Invalid or expired refresh token');
    const user = await this.normalizeProRole((session as any).user);
    return { user, tokens: await this.issueTokens(session.userId, deviceInfo || (session.deviceInfo as LoginDeviceInfo)) };
  }

  async logout(userId: string, refreshToken: string) {
    await this.popSession(refreshToken, userId);
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, isActive: true, isBanned: false } });
    return user ? this.normalizeProRole(user) : null;
  }
}
