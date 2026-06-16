import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const newsletter = db.prepare(`
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = ?
  `).get(id);

  if (!newsletter) {
    return NextResponse.json({ error: "뉴스레터를 찾을 수 없습니다." }, { status: 404 });
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened
    FROM email_sends
    WHERE newsletter_id = ?
  `).get(id) as { total_sent: number; total_opened: number };

  const clicks = db.prepare(`
    SELECT SUM(click_count) as total_clicks
    FROM tracking_links
    WHERE newsletter_id = ?
  `).get(id) as { total_clicks: number };

  return NextResponse.json({
    newsletter,
    stats: {
      total_sent: stats.total_sent || 0,
      total_opened: stats.total_opened || 0,
      total_clicks: clicks.total_clicks || 0,
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const { title, card_title, summary, content, cover_image, scheduled_at, category, tags } = await request.json();

  const db = getDb();
  db.prepare(
    "UPDATE newsletters SET title = ?, card_title = ?, summary = ?, content = ?, cover_image = ?, scheduled_at = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(title, card_title || null, summary || "", content || "", cover_image || null, scheduled_at || null, category || "일반", tags || "", id);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // FK 제약 순서: link_clicks → tracking_links → email_sends → newsletters
  db.transaction(() => {
    db.prepare(`
      DELETE FROM link_clicks
      WHERE tracking_link_id IN (
        SELECT id FROM tracking_links WHERE newsletter_id = ?
      )
    `).run(id);
    db.prepare("DELETE FROM tracking_links WHERE newsletter_id = ?").run(id);
    db.prepare("DELETE FROM email_sends WHERE newsletter_id = ?").run(id);
    db.prepare("DELETE FROM newsletters WHERE id = ?").run(id);
  })();

  return NextResponse.json({ success: true });
}
