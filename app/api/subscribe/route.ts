import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import getDb from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const { name, email, department } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "이름과 이메일을 입력해주세요." }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "올바른 이메일 형식을 입력해주세요." }, { status: 400 });
  }

  const db = getDb();

  try {
    const existing = db.prepare("SELECT * FROM subscribers WHERE email = ?").get(email) as {
      id: number; unsubscribed_at: string | null; confirmed_at: string | null;
    } | undefined;

    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3001";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    if (existing) {
      if (existing.unsubscribed_at) {
        // Re-subscribe flow
        const token = crypto.randomBytes(32).toString("hex");
        db.prepare(
          "UPDATE subscribers SET unsubscribed_at = NULL, name = ?, department = ?, confirm_token = ?, confirmed_at = NULL, confirm_token_created_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(name, department || "", token, existing.id);
        try {
          await sendConfirmationEmail({ to: email, name, token, baseUrl });
        } catch (err) {
          console.error("[subscribe] 확인 이메일 발송 실패:", err);
        }
        return NextResponse.json({ success: true, message: "확인 이메일을 발송했습니다. 이메일을 확인해주세요." });
      }
      if (!existing.confirmed_at) {
        return NextResponse.json({ error: "이미 구독 신청 중입니다. 이메일의 확인 링크를 클릭해주세요." }, { status: 409 });
      }
      return NextResponse.json({ error: "이미 구독 중인 이메일입니다." }, { status: 409 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO subscribers (name, email, department, confirm_token, confirm_token_created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
    ).run(name, email, department || "", token);

    try {
      await sendConfirmationEmail({ to: email, name, token, baseUrl });
    } catch (err) {
      console.error("[subscribe] 확인 이메일 발송 실패:", err);
    }

    return NextResponse.json({ success: true, message: "확인 이메일을 발송했습니다. 이메일의 확인 링크를 클릭해주세요." });
  } catch {
    return NextResponse.json({ error: "구독 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
