import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const db = getDb();

  // Subscriber growth: last 30 days
  const growth = db.prepare(`
    SELECT
      date(subscribed_at) as date,
      COUNT(*) as new_subs,
      SUM(COUNT(*)) OVER (ORDER BY date(subscribed_at)) as cumulative
    FROM subscribers
    WHERE subscribed_at >= date('now', '-30 days')
    GROUP BY date(subscribed_at)
    ORDER BY date ASC
  `).all() as { date: string; new_subs: number; cumulative: number }[];

  // Unsubscribes last 30 days
  const unsubs = db.prepare(`
    SELECT date(unsubscribed_at) as date, COUNT(*) as count
    FROM subscribers
    WHERE unsubscribed_at >= date('now', '-30 days') AND unsubscribed_at IS NOT NULL
    GROUP BY date(unsubscribed_at)
    ORDER BY date ASC
  `).all() as { date: string; count: number }[];

  // Newsletter performance (last 10 published)
  const nlPerf = db.prepare(`
    SELECT
      n.id, n.title,
      COUNT(es.id) as sent,
      SUM(CASE WHEN es.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
      COALESCE(SUM(tl.click_count), 0) as clicks,
      n.published_at
    FROM newsletters n
    LEFT JOIN email_sends es ON es.newsletter_id = n.id
    LEFT JOIN tracking_links tl ON tl.newsletter_id = n.id
    WHERE n.status = 'published'
    GROUP BY n.id
    ORDER BY n.published_at DESC
    LIMIT 10
  `).all() as {
    id: number; title: string; sent: number; opened: number; clicks: number; published_at: string;
  }[];

  // Total subscriber count over time (weekly buckets for longer range)
  const totalSubs = db.prepare(
    "SELECT COUNT(*) as total FROM subscribers WHERE unsubscribed_at IS NULL"
  ).get() as { total: number };

  return NextResponse.json({ growth, unsubs, nlPerf, totalSubs: totalSubs.total });
}
