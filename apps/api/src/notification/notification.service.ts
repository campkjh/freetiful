import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationType } from '@prisma/client';
import axios from 'axios';

type PushSettingKey =
  | 'chatPush'
  | 'bookingPush'
  | 'paymentPush'
  | 'reviewPush'
  | 'systemPush'
  | 'marketingPush';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pushService: PushService,
  ) {}

  private getOneSignalConfig() {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID');
    const apiKey =
      this.config.get<string>('ONESIGNAL_REST_API_KEY') ||
      this.config.get<string>('ONESIGNAL_API_KEY') ||
      this.config.get<string>('ONESIGNAL_REST_KEY');
    return { appId, apiKey };
  }

  private settingKeyForType(type: NotificationType): PushSettingKey {
    const map: Record<string, PushSettingKey> = {
      chat: 'chatPush',
      booking: 'bookingPush',
      payment: 'paymentPush',
      review: 'reviewPush',
      system: 'systemPush',
      marketing: 'marketingPush',
    };
    return map[String(type)] || 'systemPush';
  }

  private async isPushAllowed(userId: string, type: NotificationType) {
    const settingKey = this.settingKeyForType(type);
    const settings = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    if (!settings) return settingKey !== 'marketingPush';
    return settings[settingKey] !== false;
  }

  private withClickTarget(type: NotificationType, data?: Record<string, any>) {
    const next = { ...(data || {}) };
    if (next.url || next.deepLink) return next;
    if (next.roomId) next.url = `/chat/${next.roomId}`;
    else if (next.quotationId) next.url = `/quote/${next.quotationId}`;
    else if (next.proProfileId) next.url = `/pros/${next.proProfileId}`;
    else if (String(type) === 'chat') next.url = '/chat';
    else if (String(type) === 'booking') next.url = '/schedule';
    else if (String(type) === 'payment') next.url = '/my/payment-history';
    else if (String(type) === 'review') next.url = '/my/reviews';
    else next.url = '/notifications';
    return next;
  }

  /**
   * OneSignal 푸시 발송 — 2단계 폴백 패턴 (onelinesolution에서 이식)
   * 1차: external_id로 시도 (재설치·토큰갱신에 강함)
   * 2차: 1차 실패 시 DB의 subscription_id로 재시도
   */
  private async sendOneSignalPush(userId: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    const { appId, apiKey } = this.getOneSignalConfig();
    if (!appId || !apiKey) {
      this.logger.warn(`[OneSignal] skip — appId=${!!appId} apiKey=${!!apiKey}`);
      return false;
    }

    const payloadBase = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: title, ko: title },
      contents: { en: body, ko: body },
      data: data || {},
      ...(data?.url ? { url: data.url } : {}),
    };

    // 1차: external_id 경로
    try {
      const res = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payloadBase, include_aliases: { external_id: [userId] } },
        { headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' } },
      );
      const hasId = !!res.data?.id;
      const recipients = Number(res.data?.recipients || 0);
      this.logger.log(
        `[OneSignal] external_id=${userId} → id=${res.data?.id} recipients=${recipients} errors=${JSON.stringify(res.data?.errors ?? null)}`,
      );
      // id가 있어도 recipients=0이면 실제 수신자가 없으므로 subscription_id fallback을 탄다.
      if (res.status >= 200 && res.status < 300 && hasId && recipients > 0) return true;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      this.logger.warn(
        `[OneSignal] external_id FAIL ${userId} status=${err.response?.status} data=${JSON.stringify(err.response?.data)} — trying subscription_id fallback`,
      );
    }

    // 2차: subscription_id 폴백
    const subscriptionIds = await this.pushService.getOneSignalSubscriptionIds([userId]);
    if (!subscriptionIds.length) {
      this.logger.warn(`[OneSignal] no subscription_id in DB for ${userId} — bridge never delivered playerId`);
      return false;
    }

    try {
      const res = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payloadBase, include_subscription_ids: subscriptionIds },
        { headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(
        `[OneSignal] subscription_id fallback ${userId} subs=${subscriptionIds.length} → id=${res.data?.id} recipients=${res.data?.recipients ?? 'n/a'}`,
      );
      return Number(res.data?.recipients || 0) > 0 || !!res.data?.id;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      this.logger.error(
        `[OneSignal] subscription_id FAIL ${userId} status=${err.response?.status} data=${JSON.stringify(err.response?.data)}`,
      );
      return false;
    }
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot access this notification');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  async deleteNotification(userId: string, notificationId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    return { ok: true };
  }

  async deleteAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });
    return { deletedCount: result.count };
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    this.logger.log(`[createNotification] userId=${userId} type=${type} title="${title}"`);
    const pushData = this.withClickTarget(type, data);
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: pushData,
      },
    });

    void this.dispatchPush(userId, type, title, body, pushData, notification.id);
    return notification;
  }

  private async dispatchPush(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any>,
    notificationId: string,
  ) {
    try {
      if (!(await this.isPushAllowed(userId, type))) return;
      const settingKey = this.settingKeyForType(type);
      const [oneSignalSent, webResult] = await Promise.all([
        this.sendOneSignalPush(userId, title, body, data),
        this.pushService.sendWebPush({
          userIds: [userId],
          title,
          body,
          settingKey: settingKey as any,
          event: String(type),
          data,
        }).catch(() => ({ sent: 0, targets: 0 })),
      ]);
      if (oneSignalSent || webResult.sent > 0) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { sentPush: true },
        }).catch(() => undefined);
      }
    } catch (e) {
      this.logger.warn(`[dispatchPush] failed notification=${notificationId} ${String(e).slice(0, 200)}`);
    }
  }
}
