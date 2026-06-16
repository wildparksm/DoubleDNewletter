import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendNewsletter } from "@/lib/email";
import { headers } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Optional segment filters from request body
  let segmentDepartment: string | undefined;
  let segmentTags: string[] = [];
  try {
    const body = await request.json().catch(() => ({}));
    segmentDepartment = body.department;
    segmentTags = body.tags || [];
  } catch { /* no body */ }

  const newsletter = db.prepare("SELECT * FROM newsletters WHERE id = ?").get(id) as {
    id: number; title: string; content: string; status: string;
  } | undefined;

  if (!newsletter) {
    return NextResponse.json({ error: "뉴스레터를 찾을 수 없습니다." }, { status: 404 });
  }

  // Build subscriber query with segment filters
  let query = "SELECT * FROM subscribers WHERE unsubscribed_at IS NULL";
  const queryParams: string[] = [];

  if (segmentDepartment) {
    query += " AND department = ?";
    queryParams.push(segmentDepartment);
  }

  const subscribers = db.prepare(query).all(...queryParams) as {
    id: number; name: string; email: string; tags: string;
  }[];

  // Filter by tags client-side (SQLite doesn't have array contains)
  const filteredSubscribers = segmentTags.length > 0
    ? subscribers.filter((s) => {
        const subTags = (s.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
        return segmentTags.some((tag) => subTags.includes(tag));
      })
    : subscribers;

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  for (const subscriber of filteredSubscribers) {
    try {
      // INSERT OR IGNORE: UNIQUE 제약으로 race condition을 원자적으로 처리
      const result = db.prepare(
        "INSERT OR IGNORE INTO email_sends (newsletter_id, subscriber_id) VALUES (?, ?)"
      ).run(newsletter.id, subscriber.id);

      if (result.changes === 0) continue; // 이미 발송된 구독자

      await sendNewsletter({
        to: subscriber.email,
        subscriberName: subscriber.name,
        newsletterId: newsletter.id,
        subscriberId: subscriber.id,
        title: newsletter.title,
        content: newsletter.content,
        baseUrl,
      });

      sent++;
    } catch {
      failed++;
      failedEmails.push(subscriber.email);
      db.prepare("DELETE FROM email_sends WHERE newsletter_id = ? AND subscriber_id = ?").run(newsletter.id, subscriber.id);
    }
  }

  // 발송 성공 1건 이상이거나 구독자가 0명이면 published로 업데이트
  if (newsletter.status !== "published" && (sent > 0 || filteredSubscribers.length === 0)) {
    db.prepare("UPDATE newsletters SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  }

  return NextResponse.json({ success: true, sent, failed, total: filteredSubscribers.length, failedEmails });
}
