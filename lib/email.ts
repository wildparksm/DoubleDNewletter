import nodemailer from "nodemailer";

const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "192.168.6.112",
  port: parseInt(process.env.SMTP_PORT || "25"),
  secure: false,
  // 내부 Exchange 릴레이: 계정 정보 없으면 익명 릴레이 사용
  ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
  tls: {
    // 내부 사설 IP는 인증서 검증 불필요
    rejectUnauthorized: false,
  },
});

const FROM = `"대덕.it" <${process.env.SMTP_FROM || process.env.SMTP_USER || "newsletter@daeduck.com"}>`;

const EMAIL_BASE = `
<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f6fb;font-family:'Apple SD Gothic Neo',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#fff}
  .hd{background:linear-gradient(135deg,#0d1b8e 0%,#1a2fa8 100%);padding:28px 40px}
  .logo{color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px}
  .logo span{color:#00a3ff}
  .tag{color:rgba(255,255,255,.6);font-size:12px;margin-top:3px}
  .body{padding:36px 40px;color:#1a1a2e;line-height:1.75;font-size:15px}
  .ft{background:#f4f6fb;padding:20px 40px;text-align:center;color:#999;font-size:12px}
  .ft a{color:#0d1b8e;text-decoration:none}
  h1,h2,h3{color:#0d1b8e}
  p.subtitle{font-size:16px;color:#555;font-style:italic;margin-bottom:24px;line-height:1.6}
  a{color:#00a3ff}
  hr{border:none;border-top:1px solid #e8ecf4;margin:28px 0}
  blockquote{border-left:4px solid #0d1b8e;padding-left:16px;color:#555;font-style:italic;margin:16px 0}
  img{max-width:100%;border-radius:8px}
  code{background:#f0f4ff;padding:2px 6px;border-radius:4px;font-size:.875em}
  pre{background:#1a1a2e;color:#e0e0ff;padding:16px;border-radius:8px;overflow-x:auto}
  @media(max-width:600px){.body,.hd,.ft{padding-left:20px;padding-right:20px}}
</style></head><body>`;

const EMAIL_HEADER = `<div class="wrap">
  <div class="hd"><div class="logo">대덕<span>.it</span></div><div class="tag">대덕의 IT, 소식을 잇다</div></div>`;

const emailFooter = (unsubUrl: string) =>
  `<div class="ft"><p>대덕전자 | IT인프라그룹</p><p>담당자: 윤종민 프로</p><p><a href="${unsubUrl}">구독 취소</a></p></div></div></body></html>`;

// ── Newsletter send ──────────────────────────────────────────────
export interface SendNewsletterOptions {
  to: string;
  subscriberName: string;
  newsletterId: number;
  subscriberId: number;
  title: string;
  content: string;
  baseUrl: string;
}

export async function sendNewsletter(opts: SendNewsletterOptions) {
  const { to, subscriberName, newsletterId, subscriberId, title, content, baseUrl } = opts;
  const pixel = `<img src="${baseUrl}/api/track/open?n=${newsletterId}&s=${subscriberId}" width="1" height="1" style="display:none" alt="">`;
  const unsubUrl = `${baseUrl}/unsubscribe?s=${subscriberId}`;

  const html =
    EMAIL_BASE +
    EMAIL_HEADER +
    `<div class="body">
      <p style="color:#555;margin-bottom:20px">안녕하세요, <strong>${subscriberName}</strong>님!</p>
      <h1 style="font-size:22px;margin-bottom:20px">${title}</h1>
      <hr>${content}<hr>
      <p style="font-size:13px;color:#aaa">웹에서 읽기: <a href="${baseUrl}/newsletter/${newsletterId}">보기 →</a></p>
    </div>` +
    emailFooter(unsubUrl) +
    pixel;

  await transporter.sendMail({ from: FROM, to, subject: `[대덕.it] ${title}`, html });
}

// ── Welcome email ────────────────────────────────────────────────
export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  baseUrl: string;
  recentNewsletters?: { id: number; title: string }[];
}) {
  const { to, name, baseUrl, recentNewsletters = [] } = opts;

  const recentLinks = recentNewsletters
    .slice(0, 3)
    .map(
      (n) =>
        `<li style="margin:8px 0"><a href="${baseUrl}/newsletter/${n.id}" style="color:#0d1b8e;font-weight:600">${n.title}</a></li>`
    )
    .join("");

  const html =
    EMAIL_BASE +
    EMAIL_HEADER +
    `<div class="body">
      <h2 style="font-size:20px;margin-bottom:16px">🎉 구독해 주셔서 감사합니다, ${name}님!</h2>
      <p>대덕전자 IT 뉴스레터 <strong>대덕.it</strong>에 오신 것을 환영합니다.<br>
      앞으로 대덕전자의 IT 소식과 인사이트를 정기적으로 보내드리겠습니다.</p>
      <div style="background:#f0f4ff;border-radius:12px;padding:20px 24px;margin:24px 0">
        <p style="font-weight:700;color:#0d1b8e;margin:0 0 12px">📬 대덕.it이란?</p>
        <ul style="margin:0;padding-left:20px;color:#555;line-height:1.8">
          <li>최신 IT 트렌드와 기술 인사이트</li>
          <li>사내 IT 프로젝트 소식</li>
          <li>업계 동향 및 유용한 도구 소개</li>
        </ul>
      </div>
      ${
        recentLinks
          ? `<p style="font-weight:700;color:#333;margin-bottom:8px">📚 최근 발행 뉴스레터</p>
             <ul style="margin:0;padding-left:20px">${recentLinks}</ul>`
          : ""
      }
      <hr>
      <p style="font-size:13px;color:#aaa">
        구독을 원치 않으시면 <a href="${baseUrl}/unsubscribe" style="color:#aaa">여기서 구독 취소</a>하실 수 있습니다.
      </p>
    </div>` +
    emailFooter(`${baseUrl}/unsubscribe`);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[대덕.it] 구독을 환영합니다! 🎉`,
    html,
  });
}

// ── Confirmation email (Double Opt-in) ──────────────────────────
export async function sendConfirmationEmail(opts: {
  to: string;
  name: string;
  token: string;
  baseUrl: string;
}) {
  const { to, name, token, baseUrl } = opts;
  const confirmUrl = `${baseUrl}/subscribe/confirm?token=${token}`;

  const html =
    EMAIL_BASE +
    EMAIL_HEADER +
    `<div class="body">
      <h2 style="font-size:20px;margin-bottom:16px">구독 신청 확인</h2>
      <p>안녕하세요, <strong>${name}</strong>님!<br>
      대덕.it 뉴스레터 구독 신청을 완료하려면 아래 버튼을 클릭해 주세요.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${confirmUrl}" style="display:inline-block;background:#0d1b8e;color:#fff;padding:14px 36px;border-radius:50px;font-weight:700;font-size:15px;text-decoration:none">
          구독 확인하기 →
        </a>
      </div>
      <p style="font-size:13px;color:#aaa">이 링크는 24시간 동안 유효합니다.<br>
      구독을 신청하지 않으셨다면 이 이메일을 무시해 주세요.</p>
    </div>` +
    emailFooter(`${baseUrl}/unsubscribe`);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[대덕.it] 구독 확인 이메일`,
    html,
  });
}

export async function verifyTransporter() {
  return transporter.verify();
}
