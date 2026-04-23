import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationType } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pushService: PushService,
  ) {}

  /**
   * OneSignal 푸시 발송 — 2단계 폴백 패턴 (onelinesolution에서 이식)
   * 1차: external_id로 시도 (재설치·토큰갱신에 강함)
   * 2차: 1차 실패 시 DB의 subscription_id로 재시도
   */
  private async sendOneSignalPush(userId: string, title: string, body: string, data?: Record<string, any>) {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID');
    const apiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY');
    if (!appId || !apiKey) {
      this.logger.warn(`[OneSignal] skip — appId=${!!appId} apiKey=${!!apiKey}`);
      return;
    }

    const payloadBase = {
      app_id: appId,
      headings: { en: title, ko: title },
      contents: { en: body, ko: body },
      data: data || {},
    };

    // 1차: external_id 경로
    try {
      const res = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payloadBase, target_channel: 'push', include_aliases: { external_id: [userId] } },
        { headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' } },
      );
      const hasId = !!res.data?.id;
      const recipients = Number(res.data?.recipients || 0);
      this.logger.log(
        `[OneSignal] external_id=${userId} → id=${res.data?.id} recipients=${recipients} errors=${JSON.stringify(res.data?.errors ?? null)}`,
      );
      // 200 OK 또는 id 받으면 OneSignal이 이미 접수 — 중복 발송 방지
      if (res.status >= 200 && res.status < 300 && hasId) return;
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
      return;
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
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      this.logger.error(
        `[OneSignal] subscription_id FAIL ${userId} status=${err.response?.status} data=${JSON.stringify(err.response?.data)}`,
      );
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

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    this.logger.log(`[createNotification] userId=${userId} type=${type} title="${title}"`);
    const [notification] = await Promise.all([
      this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          data: data ?? undefined,
        },
      }),
      this.sendOneSignalPush(userId, title, body, data),
      this.pushService
        .sendWebPush({
          userIds: [userId],
          title,
          body,
          event: String(type),
          data,
        })
        .catch(() => undefined),
    ]);
    return notification;
  }
}
