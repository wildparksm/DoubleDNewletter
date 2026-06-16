import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { sendNewsletter } from "@/lib/email";
import { headers } from "next/headers";

// Processes any newsletters with scheduled_at <= now that haven't been sent yet
export async function POST(_request: NextRequest) {
  const db = getDb();

  const due = db.prepare(`
    SELECT * FROM newsletters
    WHERE status = 'published'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= datetime('now')
      AND id NOT IN (SELECT DISTINCT newsletter_id FROM email_sends)
  `).all() as { id: number; title: string; content: string }[];

  if (due.length === 0) return NextResponse.json({ processed: 0 });

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  let processed = 0;

  for (const newsletter of due) {
    const subscribers = db.prepare(
      "SELECT * FROM subscribers WHERE unsubscribed_at IS NULL"
    ).all() as { id: number; name: string; email: string }[];

    for (const subscriber of subscribers) {
      try {
        const existing = db.prepare(
          "SELECT id FROM email_sends WHERE newsletter_id = ? AND subscriber_id = ?"
        ).get(newsletter.id, subscriber.id);
        if (existing) continue;

        db.prepare("INSERT INTO email_sends (newsletter_id, subscriber_id) VALUES (?, ?)").run(newsletter.id, subscriber.id);
        await sendNewsletter({
          to: subscriber.email,
          subscriberName: subscriber.name,
          newsletterId: newsletter.id,
          subscriberId: subscriber.id,
          title: newsletter.title,
          content: newsletter.content,
          baseUrl,
        });
      } catch {
        db.prepare("DELETE FROM email_sends WHERE newsletter_id = ? AND subscriber_id = ?").run(newsletter.id, subscriber.id);
      }
    }
    // Clear scheduled_at after processing
    db.prepare("UPDATE newsletters SET scheduled_at = NULL WHERE id = ?").run(newsletter.id);
    processed++;
  }

  return NextResponse.json({ processed });
}
