import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'support@freetiful.com, jaicylab2009@gmail.com, freetiful2025@gmail.com',
      subject: `[Biz 문의] ${type || '기업 문의'} - ${company || name}`,
      html: htmlBody,
      replyTo: email || undefined,
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Inquiry email error:', err);
    return NextResponse.json({ error: '이메일 발송에 실패했습니다' }, { status: 500 });
  }
}
