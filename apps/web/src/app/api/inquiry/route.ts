import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * 메일 HTML 에 넣는 글은 이스케이프한다(261009 검증) — 비즈 상담 채팅(/biz/inquiry)은 누구나 이 길로 보낼 수 있어서
 * 회사명 · 담당자 · 문의 내용에 태그 · 링크를 넣으면 직원 메일함에 그대로 그려졌다.
 */
function escapeHtml(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 같은 요청 번호(requestId — 상담 채팅이 문의마다 만든다)는 한 번만 처리한다(261009 검증: 보내는 중 새로 고침 → 다시 보내기로
 * 같은 문의가 메일 2통 · DB 2줄 들어가던 것). 서버리스라 같은 인스턴스 안에서만 기억하는 최선 노력 — 채팅 화면도
 * 새로 고침 뒤엔 '접수됐을 수 있어요' 안내부터 해서 바로 다시 보내지 않는다. 앞 요청이 아직 처리 중이면 그 결과를 같이 기다린다.
 */
const RECENT_TTL = 30 * 60 * 1000;
const recentRequests = new Map<string, { at: number; done: Promise<boolean> }>();
function sweepRecent(now: number) {
  recentRequests.forEach((v, k) => { if (now - v.at > RECENT_TTL) recentRequests.delete(k); });
  // 너무 많이 쌓이면 오래된 것부터
  while (recentRequests.size > 500) {
    const first = recentRequests.keys().next().value;
    if (first === undefined) break;
    recentRequests.delete(first);
  }
}

// 구글 시트(Apps Script 웹앱) 에도 병렬 기록. 이메일 실패해도 시트 기록은 시도하고 반대도 마찬가지.
async function logToGoogleSheet(payload: {
  company: string; name: string; phone: string; email: string;
  type: string; message: string; fileName: string;
}) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.INQUIRY_SECRET;
  if (!url) return { skipped: true };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: secret || '', timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Sheet webhook ${res.status}`);
  return { ok: true };
}

function getApiBaseUrl(req: NextRequest) {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const normalized = raw
    ?.trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '')
    .replace(/\/api$/, '');
  return normalized || req.nextUrl.origin;
}

async function saveInquiryToApi(req: NextRequest, payload: {
  company: string; name: string; phone: string; email: string;
  type: string; message: string; fileName: string; fileSize?: number; fileType?: string;
  metadata?: Record<string, unknown>;
}) {
  const baseUrl = getApiBaseUrl(req);
  const res = await fetch(`${baseUrl}/api/v1/business-inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: payload.company,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      type: payload.type,
      message: payload.message,
      fileName: payload.fileName,
      fileSize: payload.fileSize || null,
      fileType: payload.fileType || null,
      source: 'biz_page',
      metadata: {
        origin: req.headers.get('origin') || '',
        referer: req.headers.get('referer') || '',
        ...(payload.metadata || {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Inquiry API ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  /** 이 요청이 잡아 둔 요청 번호를 놓는다 — ok=false(저장 전 실패)면 번호를 지워 다시 보내기가 통하게. 두 번 불려도 처음 한 번만 */
  let finish: (ok: boolean) => void = () => {};
  try {
    const formData = await req.formData();
    const company = formData.get('company') as string || '';
    const name = formData.get('name') as string || '';
    const phone = formData.get('phone') as string || '';
    const email = formData.get('email') as string || '';
    const type = formData.get('type') as string || '';
    const message = formData.get('message') as string || '';
    const file = formData.get('file') as File | null;
    const rawRequestId = formData.get('requestId');
    const requestId = typeof rawRequestId === 'string' && /^[\w-]{6,64}$/.test(rawRequestId) ? rawRequestId : '';
    const inquiryPayload = {
      company,
      name,
      phone,
      email,
      type,
      message,
      fileName: file?.name || '',
      fileSize: file?.size || 0,
      fileType: file?.type || '',
    };

    if (!name || !phone || !message) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
    }

    // 같은 요청 번호가 이미 접수됐으면(또는 접수 중이면 그 결과를 기다려) 다시 저장 · 메일하지 않는다
    if (requestId) {
      const now = Date.now();
      sweepRecent(now);
      const prev = recentRequests.get(requestId);
      if (prev && (await prev.done)) {
        return NextResponse.json({ ok: true, saved: true, duplicate: true });
      }
      let settle: (ok: boolean) => void = () => {};
      const entry = { at: now, done: new Promise<boolean>((resolve) => { settle = resolve; }) };
      recentRequests.set(requestId, entry);
      let settled = false;
      finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        settle(ok);
        if (!ok && recentRequests.get(requestId) === entry) recentRequests.delete(requestId);
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const esc = (v: string) => escapeHtml(v || '-');
    const htmlBody = `
      <h2>기업 문의</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;width:120px;">회사명</td><td style="padding:8px;border:1px solid #eee;">${esc(company)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">담당자</td><td style="padding:8px;border:1px solid #eee;">${esc(name)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">연락처</td><td style="padding:8px;border:1px solid #eee;">${esc(phone)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">이메일</td><td style="padding:8px;border:1px solid #eee;">${esc(email)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">문의 유형</td><td style="padding:8px;border:1px solid #eee;">${esc(type)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;vertical-align:top;">문의 내용</td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap;">${esc(message)}</td></tr>
      </table>
    `;

    const attachments: any[] = [];
    let attachmentMetadata: Record<string, unknown> | undefined;
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer,
      });
      attachmentMetadata = {
        attachment: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          dataUrl: `data:${file.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`,
        },
      };
    }

    let savedInquiry: unknown;
    try {
      savedInquiry = await saveInquiryToApi(req, {
        ...inquiryPayload,
        metadata: { ...(attachmentMetadata || {}), ...(requestId ? { requestId } : {}) },
      });
    } catch (error) {
      console.error('Inquiry DB error:', error);
      finish(false);
      return NextResponse.json({ error: '문의 저장에 실패했습니다' }, { status: 502 });
    }
    // 저장이 끝났으면 접수 완료 — 같은 번호로 다시 와도 메일 · 저장을 되풀이하지 않는다
    finish(true);

    // 관리자 DB 저장 후 이메일 + 시트 기록을 병렬로 보조 처리
    const results = await Promise.allSettled([
      transporter.sendMail({
        from: process.env.SMTP_USER,
        to: 'support@freetiful.com, jaicylab2009@gmail.com, freetiful2025@gmail.com',
        subject: `[Biz 문의] ${type || '기업 문의'} - ${company || name}`,
        html: htmlBody,
        replyTo: email || undefined,
        attachments,
      }),
      logToGoogleSheet({
        company, name, phone, email, type, message,
        fileName: file?.name || '',
      }),
    ]);

    const emailFailed = results[0].status === 'rejected';
    const sheetFailed = results[1].status === 'rejected';
    if (emailFailed) console.error('Inquiry email error:', (results[0] as PromiseRejectedResult).reason);
    if (sheetFailed) console.error('Inquiry sheet error:', (results[1] as PromiseRejectedResult).reason);

    return NextResponse.json({
      ok: true,
      saved: true,
      inquiry: savedInquiry,
      emailed: !emailFailed,
      sheetLogged: !sheetFailed,
    });
  } catch (err: any) {
    console.error('Inquiry route error:', err);
    // 저장 전에 터졌으면 번호를 놓아 준다(이미 finish 됐으면 아무 일 없음) — 안 놓으면 같은 번호의 다음 요청이 영영 기다린다
    finish(false);
    return NextResponse.json({ error: '이메일 발송에 실패했습니다' }, { status: 500 });
  }
}
