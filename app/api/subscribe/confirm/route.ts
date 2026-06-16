import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import getDb from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "토큰이 없습니다." }, { status: 400 });

  const db = getDb();
  const subscriber = db.prepare(
    "SELECT * FROM subscribers WHERE confirm_token = ? AND confirmed_at IS NULL"
  ).get(token) as { id: number; name: string; email: string; confirm_token: string; confirm_token_created_at: string | null } | undefined;

  if (!subscriber) {
    return NextResponse.json({ error: "유효하지 않거나 이미 사용된 링크입니다." }, { status: 400 });
  }

  // 24시간 만료 체크 (created_at이 없는 기존 토큰은 통과)
  if (subscriber.confirm_token_created_at) {
    const created = new Date(subscriber.confirm_token_created_at).getTime();
    if (Date.now() - created > 24 * 60 * 60 * 1000) {
      db.prepare("UPDATE subscribers SET confirm_token = NULL, confirm_token_created_at = NULL WHERE id = ?").run(subscriber.id);
      return NextResponse.json({ error: "확인 링크가 만료됐습니다. 다시 구독 신청해주세요." }, { status: 400 });
    }
  }

  db.prepare(
    "UPDATE subscribers SET confirmed_at = CURRENT_TIMESTAMP, confirm_token = NULL WHERE id = ?"
  ).run(subscriber.id);

  // Send welcome email after confirmation
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const recentNewsletters = db.prepare(
    "SELECT id, title FROM newsletters WHERE status = 'published' ORDER BY published_at DESC LIMIT 3"
  ).all() as { id: number; title: string }[];

  try {
    await sendWelcomeEmail({ to: subscriber.email, name: subscriber.name, baseUrl, recentNewsletters });
  } catch (err) {
    console.error("[subscribe/confirm] 웰컴 이메일 발송 실패:", err);
  }

  return NextResponse.json({ success: true, name: subscriber.name });
}
