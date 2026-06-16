import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { ids }: { ids: number[] } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "삭제할 항목을 선택해주세요." }, { status: 400 });
  }

  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");

  db.transaction(() => {
    db.prepare(`
      DELETE FROM link_clicks
      WHERE tracking_link_id IN (
        SELECT id FROM tracking_links WHERE newsletter_id IN (${placeholders})
      )
    `).run(...ids);
    db.prepare(`DELETE FROM tracking_links WHERE newsletter_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM email_sends WHERE newsletter_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM newsletters WHERE id IN (${placeholders})`).run(...ids);
  })();

  return NextResponse.json({ success: true, deleted: ids.length });
}
