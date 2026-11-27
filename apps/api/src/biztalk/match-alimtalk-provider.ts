import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NCP_MATCH_TEMPLATES, matchTemplateVariables, type MatchAlimtalkContext, type MatchAlimtalkKind } from './match-alimtalk-policy';
import { ncpAlimtalkConfig, ncpSensHeaders } from './ncp-alimtalk';

type NcpButton = Partial<Record<'type' | 'name' | 'linkMobile' | 'linkPc' | 'schemeIos' | 'schemeAndroid', string>>;
type NcpItemText = { title: string; description: string };
type NcpTemplate = {
  templateCode: string;
  channelId: string;
  templateStatus: string;
  templateInspectionStatus: string;
  isBlock?: boolean;
  isDormant?: boolean;
  content: string;
  title?: string;
  headerContent?: string;
  itemHighlight?: NcpItemText;
  item?: { list?: NcpItemText[]; summary?: NcpItemText };
  buttons?: NcpButton[];
};

@Injectable()
export class MatchAlimtalkProvider {
  private readonly templates = new Map<string, { at: number; pending: Promise<NcpTemplate | undefined> }>();

  constructor(private readonly config: ConfigService) {}

  templateCode(kind: MatchAlimtalkKind) {
    const { key, fallback } = NCP_MATCH_TEMPLATES[kind];
    const value = this.config.get<string>(key)?.trim() || fallback;
    return /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : null;
  }

  missingSettings() {
    const { accessKey, secretKey, serviceId, channelId } = ncpAlimtalkConfig(this.config);
    return [
      !accessKey && 'NCP_ACCESS_KEY',
      !secretKey && 'NCP_SECRET_KEY',
      !serviceId && 'NCP_ALIMTALK_SERVICE_ID',
      !channelId && 'NCP_ALIMTALK_CHANNEL_ID',
      !/^(1|true|on)$/i.test(this.config.get<string>('NCP_MATCH_ALIMTALK_ENABLED')?.trim() || '') && 'NCP_MATCH_ALIMTALK_ENABLED',
    ].filter(Boolean);
  }

  private approved(root: string, cfg: ReturnType<typeof ncpAlimtalkConfig>, code: string) {
    const path = `${root}/templates?channelId=${encodeURIComponent(cfg.channelId!)}&templateCode=${encodeURIComponent(code)}`;
    const cacheKey = cfg.host + path;
    const cached = this.templates.get(cacheKey);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached.pending;
    const pending = axios.get<NcpTemplate[] | NcpTemplate>(cacheKey, {
      headers: ncpSensHeaders('GET', path, cfg.accessKey!, cfg.secretKey!), timeout: 5000, maxRedirects: 0,
    }).then(({ data }) => (Array.isArray(data) ? data : [data]).find(t =>
      t && t.templateCode === code && t.channelId === cfg.channelId &&
      t.templateStatus === 'ACTIVE' && t.templateInspectionStatus === 'COMPLETE' &&
      !t.isBlock && !t.isDormant && typeof t.content === 'string' && t.content.length > 0,
    )).catch(() => undefined);
    this.templates.set(cacheKey, { at: Date.now(), pending });
    return pending;
  }

  async send(kind: MatchAlimtalkKind, to: string, context: MatchAlimtalkContext, stillAllowed: () => Promise<boolean>) {
    const cfg = ncpAlimtalkConfig(this.config);
    if (this.missingSettings().length) return { status: 'failed', reason: 'disabled' } as const;
    const code = this.templateCode(kind);
    if (!code) return { status: 'skipped', reason: 'template_not_configured' } as const;
    const root = `/alimtalk/v2/services/${encodeURIComponent(cfg.serviceId!)}`;
    const template = await this.approved(root, cfg, code);
    if (!template) return { status: 'failed', reason: 'template_unavailable' } as const;
    const fields = {
      content: template.content, title: template.title, headerContent: template.headerContent,
      itemHighlight: template.itemHighlight, item: template.item, buttons: template.buttons,
    };
    const { variables, unknown } = matchTemplateVariables(fields, context);
    if (unknown.length) return { status: 'failed', reason: 'unmapped_template_variable', unknown } as const;
    const render = (s: string) => s.replace(/#\{[^{}]+\}/g, key => variables[key] ?? key);
    const renderText = (v: NcpItemText) => ({ title: render(v.title), description: render(v.description) });
    const buttons = Array.isArray(fields.buttons) ? fields.buttons.map(button => {
      const keys = ['type', 'name', 'linkMobile', 'linkPc', 'schemeIos', 'schemeAndroid'] as const;
      return Object.fromEntries(keys.flatMap(key => typeof button[key] === 'string' && button[key] ? [[key, render(button[key]!)]] : []));
    }) : [];
    const message = {
      countryCode: '82', to, content: render(fields.content), useSmsFailover: false,
      ...(fields.title ? { title: render(fields.title) } : {}),
      ...(fields.headerContent ? { headerContent: render(fields.headerContent) } : {}),
      ...(fields.itemHighlight ? { itemHighlight: renderText(fields.itemHighlight) } : {}),
      ...(fields.item ? { item: { list: fields.item.list?.map(renderText), summary: fields.item.summary && renderText(fields.item.summary) } } : {}),
      ...(buttons.length ? { buttons } : {}),
    };
    if (!(await stillAllowed())) return { status: 'skipped', reason: 'recipient_or_state_changed' } as const;
    const path = `${root}/messages`;
    try {
      const { data } = await axios.post(cfg.host + path, { plusFriendId: cfg.channelId, templateCode: code, messages: [message] }, {
        headers: ncpSensHeaders('POST', path, cfg.accessKey!, cfg.secretKey!), timeout: 8000, maxRedirects: 0,
      });
      const result = data?.messages?.[0];
      if (String(data?.statusCode) === '202' && result?.requestStatusCode === 'A000' && result?.messageId) {
        return { status: 'accepted', providerId: String(result.messageId) } as const;
      }
      const status = String(result?.requestStatusCode || '');
      return { status: 'failed', reason: /^[A-Z0-9]{4,8}$/.test(status) ? `ncp_${status}` : 'not_accepted' } as const;
    } catch {
      // Never replay a request that may already have been accepted and charged.
      return { status: 'failed', reason: 'provider_error_or_timeout' } as const;
    }
  }
}
