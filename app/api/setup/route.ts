import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// One-time setup endpoint to create the first admin user
export async function POST(request: NextRequest) {
  const { setupKey, name, email, password } = await request.json();

  const expectedKey = process.env.SETUP_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "SETUP_KEY 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (setupKey !== expectedKey) {
    return NextResponse.json({ error: "유효하지 않은 설정 키입니다." }, { status: 403 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (existing.count > 0) {
    return NextResponse.json({ error: "이미 설정이 완료되었습니다." }, { status: 400 });
  }

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
  ).run(name, email, hashPassword(password));

  return NextResponse.json({ success: true, message: "관리자 계정이 생성되었습니다." });
}
