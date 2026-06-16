import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "new";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  const db = getDb();
  const articles = db.prepare(`
    SELECT * FROM rss_articles
    WHERE status = ?
    ORDER BY pub_date DESC, created_at DESC
    LIMIT ?
  `).all(status, limit) as {
    id: number; source_name: string; title: string; url: string;
    summary: string; pub_date: string; status: string; created_at: string;
  }[];

  return NextResponse.json({ articles });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = getDb();
  if (status) {
    const result = db.prepare("DELETE FROM rss_articles WHERE status = ?").run(status);
    return NextResponse.json({ deleted: result.changes });
  }
  const result = db.prepare("DELETE FROM rss_articles").run();
  return NextResponse.json({ deleted: result.changes });
}
