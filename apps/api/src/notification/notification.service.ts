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

  private async sendOneSignalPush(userId: string, title: string, body: string, data?: Record<string, any>) {
    const appId = this.config.get<string>('ONESIGNAL_APP_ID');
    const apiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY');
    if (!appId || !apiKey) {
      this.logger.warn(`[OneSignal] skip — appId=${!!appId} apiKey=${!!apiKey}`);
      return;
    }

    try {
      const res = await axios.post('https://onesignal.com/api/v1/notifications', {
        app_id: appId,
        target_channel: 'push',
        include_aliases: { external_id: [userId] },
        headings: { en: title, ko: title },
        contents: { en: body, ko: body },
        data: data || {},
      }, {
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      });
      this.logger.log(`[OneSignal] sent to external_id=${userId} → id=${res.data?.id} recipients=${res.data?.recipients ?? 'n/a'} errors=${JSON.stringify(res.data?.errors ?? null)}`);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      this.logger.error(`[OneSignal] FAIL external_id=${userId} status=${err.response?.status} data=${JSON.stringify(err.response?.data)} msg=${err.message}`);
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
