import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import axios from 'axios';

type OneSignalSub = {
  id?: string;
  type?: string;
  token?: string | null;
  enabled?: boolean;
  notification_types?: number;
};

type PushSettingKey =
  | 'chatPush'
  | 'bookingPush'
  | 'paymentPush'
  | 'reviewPush'
  | 'systemPush'
  | 'marketingPush';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getOneSignalConfig() {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID');
    const restKey =
      this.config.get<string>('ONESIGNAL_REST_API_KEY') ||
      this.config.get<string>('ONESIGNAL_API_KEY') ||
      this.config.get<string>('ONESIGNAL_REST_KEY');
    return { appId, restKey };
  }

  private ensureVapid(): boolean {
    if (this.vapidConfigured) return true;
    const publicKey =
      this.config.get<string>('NEXT_PUBLIC_VAPID_PUBLIC_KEY') ||
      this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('VAPID_SUBJECT') || 'mailto:noreply@freetiful.com';
    if (!publicKey || !privateKey) return false;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidConfigured = true;
    return true;
  }

  async saveSubscription(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      create: { userId, endpoint, p256dh, auth },
      update: { p256dh, auth, updatedAt: new Date() },
    });
  }

  async saveOneSignalPlayerId(
    userId: string,
    playerId: string,
    platform: string = 'iOS',
  ) {
    const normalizedPlayerId = playerId?.trim();
    const normalizedPlatform = platform?.trim() || 'native';
    if (!normalizedPlayerId) return null;

    // 1) 같은 플랫폼의 옛날 ghost 토큰 DB에서 제거 (재설치/토큰 갱신 케이스)
    await this.prisma.pushToken.deleteMany({
      where: {
        userId,
        platform: normalizedPlatform,
        NOT: { token: normalizedPlayerId },
      },
    });

    // 2) 최신 토큰 upsert
    const record = await this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token: normalizedPlayerId } },
      create: { userId, token: normalizedPlayerId, platform: normalizedPlatform, isActive: true },
      update: { platform: normalizedPlatform, isActive: true },
    });

    // 3) OneSignal에 external_id 강제 링크 (네이티브 OneSignal.login 실패해도 복구)
    // + 4) 같은 유저에 달린 ghost subscription 정리
    const { appId, restKey } = this.getOneSignalConfig();
    if (appId && restKey) {
      await this.linkExternalId(appId, restKey, normalizedPlayerId, userId);
      await this.cleanupGhostSubscriptions(appId, restKey, userId, normalizedPlayerId);
    }

    return record;
  }

  /** OneSignal 구독에 external_id 강제 연결 (v2 Identity API) */
  private async linkExternalId(
    appId: string,
    restKey: string,
    subscriptionId: string,
    externalId: string,
  ): Promise<void> {
    try {
      const res = await axios.patch(
        `https://api.onesignal.com/apps/${appId}/users/by/subscriptions/${subscriptionId}/identity`,
        { identity: { external_id: externalId } },
        { headers: { Authorization: `Key ${restKey}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(
        `[linkExternalId] ${externalId} → sub=${subscriptionId.slice(0, 12)} status=${res.status}`,
      );
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown } };
      this.logger.warn(
        `[linkExternalId] FAIL ${externalId} status=${err.response?.status} data=${JSON.stringify(err.response?.data)}`,
      );
    }
  }

  /** 재설치 등으로 stale된 ghost subscription 제거 — audience 왜곡 + 중복 알림 방지 */
  private async cleanupGhostSubscriptions(
    appId: string,
    restKey: string,
    externalId: string,
    keepSubscriptionId: string,
  ): Promise<void> {
    try {
      const userRes = await axios.get(
        `https://api.onesignal.com/apps/${appId}/users/by/external_id/${externalId}`,
        { headers: { Authorization: `Key ${restKey}` } },
      );
      const subs: OneSignalSub[] = userRes.data?.subscriptions || [];
      const keepSub = subs.find((s) => s.id === keepSubscriptionId);
      const keepType = keepSub?.type;

      const toDelete: string[] = [];
      for (const s of subs) {
        if (!s.id || s.id === keepSubscriptionId) continue;
        const isPush = !!s.type && /Push|iOS|Android|Huawei/i.test(s.type);
        if (!isPush) continue;
        const noToken = !s.token;
        const disabled = s.enabled === false;
        const samePlatformOlder = keepType && s.type === keepType;
        if (noToken || disabled || samePlatformOlder) {
          toDelete.push(s.id);
        }
      }

      let removed = 0;
      for (const subId of toDelete) {
        try {
          await axios.delete(
            `https://api.onesignal.com/apps/${appId}/subscriptions/${subId}`,
            { headers: { Authorization: `Key ${restKey}` } },
          );
          removed++;
        } catch {}
      }

      // DB에서도 동기화 (ghost 토큰 제거)
      if (toDelete.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { userId: externalId, token: { in: toDelete } },
        });
      }

      if (toDelete.length > 0) {
        this.logger.log(
          `[cleanupGhosts] ${externalId} attempted=${toDelete.length} removed=${removed}`,
        );
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err.response?.status !== 404) {
        this.logger.warn(`[cleanupGhosts] FAIL ${externalId} ${String(e).slice(0, 200)}`);
      }
    }
  }

  /** 주어진 userIds의 활성 OneSignal subscription ID 목록 (fallback용) */
  async getOneSignalSubscriptionIds(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });
    return Array.from(new Set(tokens.map((t) => t.token).filter(Boolean)));
  }

  /** 유저의 현재 푸시 상태 스냅샷 (DB + OneSignal 양쪽) */
  async debugStatus(userId: string) {
    const [webSubs, pushTokens] = await Promise.all([
      this.prisma.pushSubscription.findMany({
        where: { userId },
        select: { id: true, endpoint: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true, platform: true, isActive: true, createdAt: true },
      }),
    ]);

    const { appId, restKey } = this.getOneSignalConfig();
    let oneSignalUser: unknown = null;
    if (appId && restKey) {
      try {
        const res = await axios.get(
          `https://api.onesignal.com/apps/${appId}/users/by/external_id/${userId}`,
          { headers: { Authorization: `Key ${restKey}` } },
        );
        oneSignalUser = res.data;
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: unknown } };
        oneSignalUser = { error: `status=${err.response?.status}`, data: err.response?.data };
      }
    }

    return {
      userId,
      env: {
        oneSignalAppId: !!appId,
        oneSignalRestKey: !!restKey,
        vapid: this.ensureVapid(),
      },
      db: {
        webPushSubscriptions: webSubs.length,
        pushTokens: pushTokens.map((t) => ({
          token: t.token.slice(0, 12) + '...',
          platform: t.platform,
          isActive: t.isActive,
        })),
      },
      oneSignal: oneSignalUser,
    };
  }

  /** 테스트 푸시 발송 — 진단용 */
  async sendOneSignalTest(userId: string) {
    const { appId, restKey } = this.getOneSignalConfig();
    if (!appId || !restKey) return { error: 'missing env' };
    const payloadBase = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: 'Debug push test', ko: '디버그 테스트 🧪' },
      contents: { en: 'If you see this, push works', ko: '이 알림 보이면 푸시 작동' },
      data: { event: 'debug_test', url: '/notifications' },
    };
    try {
      const res = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payloadBase, include_aliases: { external_id: [userId] } },
        { headers: { Authorization: `Key ${restKey}`, 'Content-Type': 'application/json' } },
      );
      const recipients = Number(res.data?.recipients || 0);
      if (recipients > 0) return { status: res.status, data: res.data, path: 'external_id' };

      const subscriptionIds = await this.getOneSignalSubscriptionIds([userId]);
      if (!subscriptionIds.length) {
        return { status: res.status, data: res.data, path: 'external_id', warning: 'recipients=0 and no DB subscription fallback' };
      }
      const fallback = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payloadBase, include_subscription_ids: subscriptionIds },
        { headers: { Authorization: `Key ${restKey}`, 'Content-Type': 'application/json' } },
      );
      return { status: fallback.status, data: fallback.data, path: 'subscription_id', external: res.data };
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      return { error: err.message, status: err.response?.status, data: err.response?.data };
    }
  }

  async sendWebPush(params: {
    userIds: string[];
    title: string;
    body: string;
    settingKey?: PushSettingKey;
    event?: string;
    data?: Record<string, unknown>;
  }): Promise<{ sent: number; targets: number }> {
    const { userIds, title, body, settingKey, event, data } = params;
    if (!userIds.length) return { sent: 0, targets: 0 };
    if (!this.ensureVapid()) {
      this.logger.warn('VAPID keys not configured — skipping web push');
      return { sent: 0, targets: 0 };
    }

    let enabledIds = userIds;
    if (settingKey) {
      const settings = await this.prisma.notificationSettings.findMany({
        where: { userId: { in: userIds } },
      });
      const settingsMap = new Map(settings.map((s) => [s.userId, s]));
      enabledIds = userIds.filter((id) => {
        const s = settingsMap.get(id);
        if (!s) return true;
        return s[settingKey] !== false;
      });
    }
    if (!enabledIds.length) return { sent: 0, targets: 0 };

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: enabledIds } },
    });

    const payload = JSON.stringify({
      title,
      body,
      event: event || '',
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent++;
      } catch (e: unknown) {
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
        } else {
          this.logger.warn(`Push send failed (${statusCode}): ${String(e)}`);
        }
      }
    }

    return { sent, targets: subs.length };
  }
}
