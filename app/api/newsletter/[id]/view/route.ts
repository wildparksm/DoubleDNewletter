import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare(
    "UPDATE newsletters SET view_count = view_count + 1 WHERE id = ? AND status = 'published'"
  ).run(id);

  if (result.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 주간 인기글 집계를 위한 조회 시각 기록
  db.prepare("INSERT INTO newsletter_views (newsletter_id) VALUES (?)").run(id);

  return NextResponse.json({ ok: true });
}
