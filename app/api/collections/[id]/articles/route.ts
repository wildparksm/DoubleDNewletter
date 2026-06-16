import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const { newsletter_id, position } = await request.json();
  if (!newsletter_id) {
    return NextResponse.json({ error: "newsletter_id가 필요합니다." }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM collections WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "컬렉션을 찾을 수 없습니다." }, { status: 404 });
  }

  const maxPos = (db.prepare(
    "SELECT COALESCE(MAX(position), -1) as m FROM collection_articles WHERE collection_id = ?"
  ).get(id) as { m: number }).m;

  db.prepare(
    "INSERT OR IGNORE INTO collection_articles (collection_id, newsletter_id, position) VALUES (?, ?, ?)"
  ).run(id, newsletter_id, position ?? maxPos + 1);

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const { newsletter_id } = await request.json();
  if (!newsletter_id) {
    return NextResponse.json({ error: "newsletter_id가 필요합니다." }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    "DELETE FROM collection_articles WHERE collection_id = ? AND newsletter_id = ?"
  ).run(id, newsletter_id);

  return NextResponse.json({ ok: true });
}
