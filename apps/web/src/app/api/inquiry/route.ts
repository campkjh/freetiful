import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
      },
    }),
  });
  if (!res.ok) throw new Error(`Inquiry API ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const company = formData.get('company') as string || '';
    const name = formData.get('name') as string || '';
    const phone = formData.get('phone') as string || '';
    const email = formData.get('email') as string || '';
    const type = formData.get('type') as string || '';
    const message = formData.get('message') as string || '';
    const file = formData.get('file') as File | null;
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

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlBody = `
      <h2>기업 문의</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;width:120px;">회사명</td><td style="padding:8px;border:1px solid #eee;">${company || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">담당자</td><td style="padding:8px;border:1px solid #eee;">${name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">연락처</td><td style="padding:8px;border:1px solid #eee;">${phone}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">이메일</td><td style="padding:8px;border:1px solid #eee;">${email || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">문의 유형</td><td style="padding:8px;border:1px solid #eee;">${type || '-'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;vertical-align:top;">문의 내용</td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap;">${message}</td></tr>
      </table>
    `;

    const attachments: any[] = [];
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer,
      });
    }

    // DB 저장 + 이메일 + 시트 기록을 병렬로 — 하나가 실패해도 나머지는 시도
    const results = await Promise.allSettled([
      saveInquiryToApi(req, inquiryPayload),
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

    const dbFailed = results[0].status === 'rejected';
    const emailFailed = results[1].status === 'rejected';
    const sheetFailed = results[2].status === 'rejected';
    if (dbFailed) console.error('Inquiry DB error:', (results[0] as PromiseRejectedResult).reason);
    if (emailFailed) console.error('Inquiry email error:', (results[1] as PromiseRejectedResult).reason);
    if (sheetFailed) console.error('Inquiry sheet error:', (results[2] as PromiseRejectedResult).reason);

    // 전부 실패해야만 에러 반환 — 하나라도 성공하면 접수 처리
    if (dbFailed && emailFailed && sheetFailed) {
      return NextResponse.json({ error: '문의 접수에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      saved: !dbFailed,
      emailed: !emailFailed,
      sheetLogged: !sheetFailed,
    });
  } catch (err: any) {
    console.error('Inquiry route error:', err);
    return NextResponse.json({ error: '이메일 발송에 실패했습니다' }, { status: 500 });
  }
}
