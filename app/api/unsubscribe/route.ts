import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: NextRequest) {
  const { subscriberId, email } = await request.json();

  const db = getDb();

  let subscriber: { id: number; unsubscribed_at: string | null } | undefined;

  if (subscriberId) {
    subscriber = db.prepare("SELECT id, unsubscribed_at FROM subscribers WHERE id = ?").get(subscriberId) as typeof subscriber;
  } else if (email) {
    subscriber = db.prepare("SELECT id, unsubscribed_at FROM subscribers WHERE email = ?").get(email) as typeof subscriber;
  }

  if (!subscriber) {
    return NextResponse.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (subscriber.unsubscribed_at) {
    return NextResponse.json({ success: true, message: "이미 구독이 취소된 상태입니다." });
  }

  db.prepare("UPDATE subscribers SET unsubscribed_at = CURRENT_TIMESTAMP WHERE id = ?").run(subscriber.id);

  return NextResponse.json({ success: true, message: "구독이 취소되었습니다." });
}
