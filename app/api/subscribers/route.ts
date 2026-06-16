import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const db = getDb();
  const subscribers = db.prepare(
    "SELECT * FROM subscribers ORDER BY subscribed_at DESC"
  ).all();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END) as active
    FROM subscribers
  `).get() as { total: number; active: number };

  return NextResponse.json({ subscribers, stats });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { name, email, department } = await request.json();
  if (!name || !email) {
    return NextResponse.json({ error: "이름과 이메일을 입력해주세요." }, { status: 400 });
  }

  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO subscribers (name, email, department) VALUES (?, ?, ?)"
    ).run(name, email, department || "");
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
  }
}
