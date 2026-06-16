import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyTransporter } from "@/lib/email";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { to } = await request.json().catch(() => ({}));
  if (!to) return NextResponse.json({ error: "수신 이메일을 입력하세요." }, { status: 400 });

  // 1. 연결 확인
  try {
    await verifyTransporter();
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: "connect",
      error: `SMTP 서버 연결 실패: ${err instanceof Error ? err.message : String(err)}`,
      config: {
        host: process.env.SMTP_HOST || "192.168.6.112",
        port: process.env.SMTP_PORT || "25",
        user: process.env.SMTP_USER || "(인증 없음)",
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "newsletter@daeduck.com",
      },
    });
  }

  // 2. 테스트 메일 발송
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";
  const FROM = `"대덕.it" <${process.env.SMTP_FROM || smtpUser || "newsletter@daeduck.com"}>`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "192.168.6.112",
    port: parseInt(process.env.SMTP_PORT || "25"),
    secure: false,
    ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
    tls: { rejectUnauthorized: false },
  });

  const html = `
<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#0d1b8e,#1a2fa8);padding:28px 36px">
    <div style="color:#fff;font-size:24px;font-weight:900">대덕<span style="color:#00a3ff">.it</span></div>
    <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:4px">대덕의 IT, 소식을 잇다</div>
  </div>
  <div style="padding:36px">
    <p style="font-size:18px;font-weight:700;color:#0d1b8e;margin:0 0 16px">✅ SMTP 테스트 성공!</p>
    <p style="color:#555;line-height:1.7;margin:0 0 24px">
      이 메일이 보인다면 대덕.it 뉴스레터 발송 시스템이 정상적으로 연결된 것입니다.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:8px 12px;background:#f8f9ff;border-radius:6px 6px 0 0;color:#888">발송 서버</td><td style="padding:8px 12px;background:#f8f9ff;border-radius:6px 6px 0 0;font-weight:600">${process.env.SMTP_HOST || "192.168.6.112"}:${process.env.SMTP_PORT || "25"}</td></tr>
      <tr><td style="padding:8px 12px;color:#888">발신 주소</td><td style="padding:8px 12px;font-weight:600">${FROM}</td></tr>
      <tr><td style="padding:8px 12px;background:#f8f9ff;border-radius:0 0 6px 6px;color:#888">수신 주소</td><td style="padding:8px 12px;background:#f8f9ff;border-radius:0 0 6px 6px;font-weight:600">${to}</td></tr>
    </table>
  </div>
  <div style="padding:16px 36px;background:#f4f6fb;text-align:center;font-size:12px;color:#aaa">대덕전자 IT인프라그룹</div>
</div>
</body></html>`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "[대덕.it] SMTP 테스트 메일",
      html,
    });

    return NextResponse.json({
      ok: true,
      message: `${to} 으로 테스트 메일을 발송했습니다.`,
      config: {
        host: process.env.SMTP_HOST || "192.168.6.112",
        port: process.env.SMTP_PORT || "25",
        user: process.env.SMTP_USER || "(인증 없음)",
        from: FROM,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: "send",
      error: `메일 발송 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
