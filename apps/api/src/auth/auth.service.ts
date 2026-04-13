import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private async issueTokens(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') },
    );
    const refreshToken = uuid();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.session.create({
      data: { userId, refreshTokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
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

  private buildLoginResponse(
    user: User,
    tokens: Awaited<ReturnType<typeof this.issueTokens>>,
    isNewUser: boolean,
  ) {
    return { user, tokens, isNewUser, needsPhone: !user.phone, needsName: !user.name };
  }

  private async socialLogin(provider: AuthProvider, info: SocialUserInfo) {
    const authRecord = await this.prisma.authProviderRecord.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: info.providerUserId } },
      include: { user: true },
    });

    let isNewUser = false;
    let user: User;

    if (authRecord) {
      user = authRecord.user;
    } else if (info.providerEmail) {
      const existing = await this.prisma.user.findUnique({ where: { email: info.providerEmail } });
      if (existing) {
        await this.prisma.authProviderRecord.create({
          data: { userId: existing.id, provider, providerUserId: info.providerUserId, providerEmail: info.providerEmail },
        });
        user = existing;
      } else {
        user = await this.createUser(provider, info, { email: info.providerEmail });
        isNewUser = true;
      }
    } else {
      user = await this.createUser(provider, info);
      isNewUser = true;
    }

    return this.buildLoginResponse(user, await this.issueTokens(user.id), isNewUser);
  }

  async kakaoLogin(code: string) {
    const { data: tokenData } = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: this.config.get('KAKAO_CLIENT_ID'),
        client_secret: this.config.get('KAKAO_CLIENT_SECRET'),
        redirect_uri: this.config.get('KAKAO_REDIRECT_URI'),
        code,
      },
    });
    const { data: kakaoUser } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    return this.socialLogin(AuthProvider.kakao, {
      providerUserId: String(kakaoUser.id),
      providerEmail: kakaoUser.kakao_account?.email,
      name: kakaoUser.kakao_account?.profile?.nickname,
      profileImageUrl: kakaoUser.kakao_account?.profile?.profile_image_url,
    });
  }

  async kakaoNativeLogin(accessToken: string) {
    const { data: kakaoUser } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return this.socialLogin(AuthProvider.kakao, {
      providerUserId: String(kakaoUser.id),
      providerEmail: kakaoUser.kakao_account?.email,
      name: kakaoUser.kakao_account?.profile?.nickname,
      profileImageUrl: kakaoUser.kakao_account?.profile?.profile_image_url,
    });
  }

  async googleLogin(idToken: string) {
    const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    return this.socialLogin(AuthProvider.google, {
      providerUserId: data.sub,
      providerEmail: data.email,
      name: data.name,
      profileImageUrl: data.picture,
    });
  }

  async naverLogin(code: string, state: string) {
    const { data: tokenData } = await axios.get('https://nid.naver.com/oauth2.0/token', {
      params: { grant_type: 'authorization_code', client_id: this.config.get('NAVER_CLIENT_ID'), client_secret: this.config.get('NAVER_CLIENT_SECRET'), code, state },
    });
    const { data: profile } = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const u = profile.response;
    return this.socialLogin(AuthProvider.naver, {
      providerUserId: u.id,
      providerEmail: u.email,
      name: u.name,
      profileImageUrl: u.profile_image,
    });
  }

  // NOTE: In production, verify Apple's JWT signature using Apple's public keys.
  async appleLogin(identityToken: string, fullName?: string) {
    const payload = JSON.parse(Buffer.from(identityToken.split('.')[1], 'base64').toString());
    return this.socialLogin(AuthProvider.apple, {
      providerUserId: payload.sub,
      providerEmail: payload.email,
      name: fullName,
    });
  }

  async emailRegister(dto: { email: string; password: string; name: string; phone?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.createUser(
      AuthProvider.email,
      { providerUserId: dto.email, name: dto.name },
      { email: dto.email, phone: dto.phone, passwordHash },
    );
    return this.buildLoginResponse(user, await this.issueTokens(user.id), true);
  }

  async emailLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { authProviders: { where: { provider: AuthProvider.email } } },
    });
    if (!user?.authProviders[0]) throw new UnauthorizedException('Invalid credentials');
    if (!await bcrypt.compare(password, user.authProviders[0].accessToken!)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildLoginResponse(user, await this.issueTokens(user.id), false);
  }

  async refresh(refreshToken: string) {
    const session = await this.popSession(refreshToken);
    if (!session) throw new UnauthorizedException('Invalid or expired refresh token');
    return { user: (session as any).user, tokens: await this.issueTokens(session.userId) };
  }

  async logout(userId: string, refreshToken: string) {
    await this.popSession(refreshToken, userId);
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId, isActive: true, isBanned: false } });
  }
}
