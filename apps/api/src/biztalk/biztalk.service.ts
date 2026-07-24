import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, User } from '@prisma/client';
import axios from 'axios';
import { createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type BizTalkTemplateKey =
  | 'GENERAL_SIGNUP_COMPLETE'
  | 'GENERAL_SMS_AUTH'
  | 'GENERAL_BOOKING_COMPLETE'
  | 'GENERAL_NEW_MESSAGE'
  | 'CUSTOMER_INQUIRY_ARRIVED'
  | 'PARTNER_APPROVED'
  | 'PARTNER_NEW_MESSAGE'
  | 'PARTNER_MATCH_CONFIRM'
  | 'PARTNER_EVENT_COMPLETED'
  | 'PARTNER_UPCOMING_EVENT_REMINDER'
  | 'PARTNER_QUOTE_REMINDER';

type BizTalkPayload = {
  userId: string;
  type: NotificationType;
  title?: string | null;
  body?: string | null;
  data?: Record<string, any> | null;
};

type BizTalkContext = {
  recipientName: string;
  customerName: string;
  proName: string;
  amount: string;
  eventDate: string;
  eventTime: string;
  eventDateTime: string;
  eventLocation: string;
  message: string;
  serviceName: string;
  inquiryType: string;
  company: string;
};

const DEFAULT_TEMPLATE_CODES: Record<BizTalkTemplateKey, string> = {
  GENERAL_SIGNUP_COMPLETE: 'A0004', // 가입환영 (프리티풀 알림톡 템플릿 A0004)
  GENERAL_SMS_AUTH: 'A0011',
  GENERAL_BOOKING_COMPLETE: 'A0010',
  GENERAL_NEW_MESSAGE: 'A0009', // 매칭완료(이탈 후 사회자 대화) / 새 메시지 (템플릿 A0009)
  CUSTOMER_INQUIRY_ARRIVED: 'A0003',
  PARTNER_APPROVED: 'A0002',
  PARTNER_NEW_MESSAGE: 'A00051',
  PARTNER_MATCH_CONFIRM: 'A00081',
  PARTNER_EVENT_COMPLETED: 'A0007',
  PARTNER_UPCOMING_EVENT_REMINDER: 'A0006',
  PARTNER_QUOTE_REMINDER: 'A0004',
};

function truthy(value?: string | null) {
  if (value == null) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function compactText(value: unknown, fallback = '') {
  return String(value ?? fallback)
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82')) return `0${digits.slice(2)}`;
  return digits;
}

function formatDate(value?: Date | string | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function formatTime(value?: Date | string | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

@Injectable()
export class BizTalkService implements OnModuleInit {
  private readonly logger = new Logger(BizTalkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 기동 시 알림톡 설정 상태를 로그로 남긴다.
   * (자격증명이 없으면 모든 발송이 조용히 skip 되므로 — 실제로 이 때문에 발송이 전혀 안 됐던 이력이 있음)
   */
  onModuleInit() {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      const missing = [
        !cfg.apiKey ? 'BIZTALK_API_KEY(또는 SOLAPI_API_KEY)' : null,
        !cfg.apiSecret ? 'BIZTALK_API_SECRET(또는 SOLAPI_API_SECRET)' : null,
        !cfg.pfId ? 'BIZTALK_PF_ID(또는 SOLAPI_PF_ID)' : null,
      ].filter(Boolean);
      this.logger.warn(
        `[알림톡 비활성] 카카오 알림톡이 발송되지 않습니다. 누락된 환경변수: ${missing.join(', ')}`,
      );
      return;
    }
    this.logger.log(`[알림톡 활성] pfId=${String(cfg.pfId).slice(0, 6)}… from=${cfg.from ? this.maskPhone(String(cfg.from)) : '(미설정)'}`);
  }

  private getConfig() {
    const apiKey = this.config.get<string>('BIZTALK_API_KEY') || this.config.get<string>('SOLAPI_API_KEY');
    const apiSecret =
      this.config.get<string>('BIZTALK_API_SECRET') || this.config.get<string>('SOLAPI_API_SECRET');
    const pfId = this.config.get<string>('BIZTALK_PF_ID') || this.config.get<string>('SOLAPI_PF_ID');
    const from =
      this.config.get<string>('BIZTALK_FROM') ||
      this.config.get<string>('SOLAPI_FROM') ||
      this.config.get<string>('SOLAPI_SENDER');
    const endpoint =
      this.config.get<string>('BIZTALK_ENDPOINT') ||
      this.config.get<string>('SOLAPI_ENDPOINT') ||
      'https://api.solapi.com/messages/v4/send-many/detail';
    const enabled = truthy(this.config.get<string>('BIZTALK_ENABLED')) || (!!apiKey && !!apiSecret && !!pfId);
    const disableSms = this.config.get<string>('BIZTALK_DISABLE_SMS');
    return {
      apiKey,
      apiSecret,
      pfId,
      from,
      endpoint,
      enabled,
      disableSms: disableSms == null ? true : truthy(disableSms),
    };
  }

  private templateCode(key: BizTalkTemplateKey) {
    return (
      this.config.get<string>(`BIZTALK_TEMPLATE_${key}`) ||
      this.config.get<string>(`SOLAPI_TEMPLATE_${key}`) ||
      DEFAULT_TEMPLATE_CODES[key]
    );
  }

  private buildAuthorization(apiKey: string, apiSecret: string) {
    const date = new Date().toISOString();
    const salt = randomUUID();
    const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex');
    return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  private maskPhone(phone: string) {
    return phone.length <= 4 ? '****' : `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  private resolveTemplate(payload: BizTalkPayload, user: Pick<User, 'role'> | null): BizTalkTemplateKey | null {
    const title = compactText(payload.title).toLowerCase();
    const body = compactText(payload.body).toLowerCase();
    const marker = compactText(payload.data?.bizTalkTemplate).toUpperCase() as BizTalkTemplateKey;
    if (marker && DEFAULT_TEMPLATE_CODES[marker]) return marker;

    const isPartner = user?.role === 'pro' || user?.role === 'business';
    if (title.includes('프리티풀에 오신 것을 환영')) return 'GENERAL_SIGNUP_COMPLETE';
    if (title.includes('파트너 신청이 승인')) return 'PARTNER_APPROVED';
    if (title.includes('새 매칭 요청') || body.includes('견적을 요청')) return 'PARTNER_MATCH_CONFIRM';
    if (title.includes('견적서가 도착')) return 'GENERAL_NEW_MESSAGE';
    if (title.includes('새 문의가 도착') || title.includes('님의 메시지') || body.includes('채팅')) {
      return isPartner ? 'PARTNER_NEW_MESSAGE' : 'GENERAL_NEW_MESSAGE';
    }
    if (title.includes('예약이 확정') || title.includes('결제가 완료')) {
      return isPartner ? null : 'GENERAL_BOOKING_COMPLETE';
    }
    if (title.includes('오늘 행사가') || title.includes('3일 뒤 행사')) {
      return isPartner ? 'PARTNER_UPCOMING_EVENT_REMINDER' : null;
    }
    return null;
  }

  private async buildContext(payload: BizTalkPayload, user: Pick<User, 'name'>): Promise<BizTalkContext> {
    const ctx: BizTalkContext = {
      recipientName: compactText(user.name, '회원'),
      customerName: compactText(payload.data?.customerName, '고객'),
      proName: compactText(payload.data?.proName, '사회자'),
      amount: compactText(payload.data?.amount),
      eventDate: compactText(payload.data?.eventDate),
      eventTime: compactText(payload.data?.eventTime),
      eventDateTime: compactText(payload.data?.eventDateTime),
      eventLocation: compactText(payload.data?.eventLocation),
      message: compactText(payload.body || payload.title),
      serviceName: '프리티풀',
      inquiryType: compactText(payload.data?.inquiryType, '문의'),
      company: compactText(payload.data?.company),
    };

    if (payload.data?.roomId) {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: payload.data.roomId },
        include: {
          user: { select: { name: true } },
          proProfile: { include: { user: { select: { name: true } } } },
        },
      }).catch(() => null);
      if (room?.user?.name) ctx.customerName = room.user.name;
      if (room?.proProfile?.user?.name) ctx.proName = room.proProfile.user.name;
    }

    if (payload.data?.paymentId) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: payload.data.paymentId },
        include: {
          quotations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { proProfile: { include: { user: { select: { name: true } } } } },
          },
        },
      }).catch(() => null);
      const quotation = payment?.quotations?.[0];
      if (payment?.amount) ctx.amount = `${Number(payment.amount).toLocaleString()}원`;
      if (quotation?.proProfile?.user?.name) ctx.proName = quotation.proProfile.user.name;
      if (quotation?.eventDate) ctx.eventDate = formatDate(quotation.eventDate);
      if (quotation?.eventTime) ctx.eventTime = formatTime(quotation.eventTime);
      if (quotation?.eventLocation) ctx.eventLocation = quotation.eventLocation;
    }

    if (payload.data?.quotationId) {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: payload.data.quotationId },
        include: { proProfile: { include: { user: { select: { name: true } } } } },
      }).catch(() => null);
      if (quotation?.amount) ctx.amount = `${Number(quotation.amount).toLocaleString()}원`;
      if (quotation?.eventDate) ctx.eventDate = formatDate(quotation.eventDate);
      if (quotation?.eventTime) ctx.eventTime = formatTime(quotation.eventTime);
      if (quotation?.eventLocation) ctx.eventLocation = quotation.eventLocation;
      if (quotation?.proProfile?.user?.name) ctx.proName = quotation.proProfile.user.name;
    }

    if (payload.data?.matchRequestId) {
      const request = await this.prisma.matchRequest.findUnique({
        where: { id: payload.data.matchRequestId },
        include: { user: { select: { name: true } }, category: { select: { name: true } } },
      }).catch(() => null);
      if (request?.user?.name) ctx.customerName = request.user.name;
      if (request?.category?.name) ctx.inquiryType = request.category.name;
      if (request?.eventDate) ctx.eventDate = formatDate(request.eventDate);
      if (request?.eventTime) ctx.eventTime = formatTime(request.eventTime);
      if (request?.eventLocation) ctx.eventLocation = request.eventLocation;
    }

    ctx.eventDateTime = compactText([ctx.eventDate, ctx.eventTime].filter(Boolean).join(' '), ctx.eventDateTime);
    return ctx;
  }

  private buildVariables(ctx: BizTalkContext) {
    return {
      '#{이름}': ctx.recipientName,
      '#{회원명}': ctx.recipientName,
      '#{고객명}': ctx.customerName,
      '#{신청자명}': ctx.customerName,
      '#{파트너명}': ctx.proName,
      '#{사회자명}': ctx.proName,
      '#{전문가명}': ctx.proName,
      '#{금액}': ctx.amount,
      '#{행사일}': ctx.eventDate,
      '#{행사날짜}': ctx.eventDate,
      '#{행사시간}': ctx.eventTime,
      '#{행사일시}': ctx.eventDateTime,
      '#{행사장소}': ctx.eventLocation,
      '#{장소}': ctx.eventLocation,
      '#{문의유형}': ctx.inquiryType,
      '#{카테고리}': ctx.inquiryType,
      '#{업체명}': ctx.company,
      '#{회사명}': ctx.company,
      '#{메시지}': ctx.message,
      '#{내용}': ctx.message,
      '#{서비스명}': ctx.serviceName,
    };
  }

  async sendForNotification(payload: BizTalkPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, phone: true, role: true },
    });
    if (!user?.phone) return { sent: false, reason: 'missing_user_phone' };

    const templateKey = this.resolveTemplate(payload, user);
    if (!templateKey) return { sent: false, reason: 'no_template_mapping' };

    const ctx = await this.buildContext(payload, user);
    return this.sendTemplateToPhone(user.phone, templateKey, ctx);
  }

  async sendBusinessInquiryToAdmins(inquiry: {
    id?: string;
    name: string;
    phone: string;
    company?: string | null;
    type?: string | null;
    message?: string | null;
  }) {
    const adminPhones = String(
      this.config.get<string>('BIZTALK_ADMIN_PHONES') ||
      this.config.get<string>('BIZTALK_OPS_PHONES') ||
      '',
    )
      .split(',')
      .map((phone) => normalizePhone(phone))
      .filter(Boolean);

    if (!adminPhones.length) return { sent: 0, reason: 'missing_admin_phones' };

    const ctx: BizTalkContext = {
      recipientName: '운영자',
      customerName: compactText(inquiry.name, '고객'),
      proName: '사회자',
      amount: '',
      eventDate: '',
      eventTime: '',
      eventDateTime: '',
      eventLocation: '',
      message: compactText(inquiry.message, '새 비즈 문의가 도착했습니다.'),
      serviceName: '프리티풀',
      inquiryType: compactText(inquiry.type, '비즈문의'),
      company: compactText(inquiry.company),
    };

    let sent = 0;
    await Promise.all(
      adminPhones.map(async (phone) => {
        const result = await this.sendTemplateToPhone(phone, 'CUSTOMER_INQUIRY_ARRIVED', ctx);
        if (result.sent) sent++;
      }),
    );
    return { sent };
  }

  async sendTemplateToPhone(phoneInput: string, templateKey: BizTalkTemplateKey, ctx: BizTalkContext) {
    const cfg = this.getConfig();
    const to = normalizePhone(phoneInput);
    if (!cfg.enabled) return { sent: false, reason: 'disabled_or_missing_env' };
    if (!cfg.apiKey || !cfg.apiSecret || !cfg.pfId) return { sent: false, reason: 'missing_solapi_env' };
    if (!to) return { sent: false, reason: 'invalid_phone' };

    const templateId = this.templateCode(templateKey);
    const message: Record<string, any> = {
      to,
      kakaoOptions: {
        pfId: cfg.pfId,
        templateId,
        variables: this.buildVariables(ctx),
        disableSms: cfg.disableSms,
      },
    };
    if (cfg.from) message.from = normalizePhone(cfg.from);

    try {
      const response = await axios.post(
        cfg.endpoint,
        { messages: [message] },
        {
          headers: {
            Authorization: this.buildAuthorization(cfg.apiKey, cfg.apiSecret),
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );
      this.logger.log(`[BizTalk] sent template=${templateKey}/${templateId} to=${this.maskPhone(to)}`);
      return { sent: true, data: response.data };
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      this.logger.warn(
        `[BizTalk] fail template=${templateKey}/${templateId} to=${this.maskPhone(to)} status=${err.response?.status} data=${JSON.stringify(err.response?.data || err.message)}`,
      );
      return { sent: false, reason: 'send_failed', status: err.response?.status, data: err.response?.data };
    }
  }
}
