import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

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

  private ensureVapid(): boolean {
    if (this.vapidConfigured) return true;
    const publicKey = this.config.get<string>('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
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
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token: playerId } },
      create: { userId, token: playerId, platform, isActive: true },
      update: { platform, isActive: true },
    });
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
