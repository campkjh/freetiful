import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac, randomUUID } from 'crypto';
import { MATCH_ALIMTALK_CHANNEL, MATCH_ALIMTALK_TEMPLATES, matchTemplateVariables, type MatchAlimtalkContext, type MatchAlimtalkKind } from './match-alimtalk-policy';

const API = 'https://api.solapi.com';

type ApprovedTemplate = {
  templateId: string;
  channelId: string;
  status: string;
  content: string;
  buttons?: unknown;
  quickReplies?: unknown;
  highlight?: unknown;
  item?: unknown;
  header?: unknown;
  title?: unknown;
  isHidden?: boolean;
  isDeleted?: boolean;
};

@Injectable()
export class MatchAlimtalkProvider {
  private readonly templates = new Map<string, { at: number; pending: Promise<ApprovedTemplate | undefined> }>();

  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const key = this.config.get<string>('SOLAPI_API_KEY')?.trim();
    const secret = this.config.get<string>('SOLAPI_API_SECRET')?.trim();
    const from = (this.config.get<string>('SOLAPI_FROM') || this.config.get<string>('SOLAPI_SENDER') || '').replace(/\D/g, '');
    return { key, secret, from };
  }

  missingSettings() {
    const { key, secret, from } = this.credentials();
    return [
      !key && 'SOLAPI_API_KEY',
      !secret && 'SOLAPI_API_SECRET',
      !/^\d{8,11}$/.test(from) && 'SOLAPI_FROM',
      !/^(1|true|on)$/i.test(this.config.get<string>('SOLAPI_MATCH_ALIMTALK_ENABLED')?.trim() || '') && 'SOLAPI_MATCH_ALIMTALK_ENABLED',
    ].filter(Boolean);
  }

  private headers(key: string, secret: string) {
    const date = new Date().toISOString();
    const salt = randomUUID();
    const signature = createHmac('sha256', secret).update(date + salt).digest('hex');
    return { Authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}` };
  }

  private approved(templateId: string, key: string, secret: string) {
    const cached = this.templates.get(templateId);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached.pending;
    const pending = axios.get<ApprovedTemplate[]>(`${API}/kakao/v2/templates/sendable`, {
      params: { channelId: MATCH_ALIMTALK_CHANNEL, templateId },
      headers: this.headers(key, secret), timeout: 5000, maxRedirects: 0,
    }).then(({ data }) => Array.isArray(data) ? data.find(t =>
      t.templateId === templateId && t.channelId === MATCH_ALIMTALK_CHANNEL && t.status === 'APPROVED' &&
      !t.isHidden && !t.isDeleted && typeof t.content === 'string',
    ) : undefined).catch(() => undefined);
    this.templates.set(templateId, { at: Date.now(), pending });
    return pending;
  }

  async send(kind: MatchAlimtalkKind, to: string, context: MatchAlimtalkContext, stillAllowed: () => Promise<boolean>) {
    const { key, secret, from } = this.credentials();
    if (!key || !secret || this.missingSettings().length) return { status: 'failed', reason: 'disabled' } as const;
    const templateId = MATCH_ALIMTALK_TEMPLATES[kind];
    const template = await this.approved(templateId, key, secret);
    if (!template) return { status: 'failed', reason: 'template_unavailable' } as const;
    const { variables, unknown } = matchTemplateVariables({
      content: template.content, buttons: template.buttons, quickReplies: template.quickReplies,
      highlight: template.highlight, item: template.item, header: template.header, title: template.title,
    }, context);
    if (unknown.length) return { status: 'failed', reason: 'unmapped_template_variable', unknown } as const;
    if (!(await stillAllowed())) return { status: 'skipped', reason: 'recipient_or_state_changed' } as const;
    try {
      const { data } = await axios.post(`${API}/messages/v4/send-many/detail`, { messages: [{
        from, to, type: 'ATA',
        kakaoOptions: { pfId: MATCH_ALIMTALK_CHANNEL, templateId, disableSms: true, variables },
      }] }, { headers: this.headers(key, secret), timeout: 8000, maxRedirects: 0 });
      const result = data?.messageList?.[0];
      if (!data?.failedMessageList?.length && data?.groupInfo?.count?.registeredSuccess === 1 && result?.messageId) {
        return { status: 'accepted', providerId: String(result.messageId) } as const;
      }
      const code = String(data?.failedMessageList?.[0]?.statusCode || '');
      return { status: 'failed', reason: /^\d{4}$/.test(code) ? `provider_${code}` : 'not_accepted' } as const;
    } catch {
      // A timeout may have happened after acceptance. Do not replay a possibly charged send.
      return { status: 'failed', reason: 'provider_error_or_timeout' } as const;
    }
  }
}
