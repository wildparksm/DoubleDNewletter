import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const collection = db.prepare(`
    SELECT c.*, u.name as author_name
    FROM collections c
    LEFT JOIN users u ON c.author_id = u.id
    WHERE c.id = ?
  `).get(id);

  if (!collection) {
    return NextResponse.json({ error: "컬렉션을 찾을 수 없습니다." }, { status: 404 });
  }

  const articles = db.prepare(`
    SELECT n.*, u.name as author_name, ca.position
    FROM newsletters n
    INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
    LEFT JOIN users u ON n.author_id = u.id
    WHERE ca.collection_id = ?
    ORDER BY ca.position ASC
  `).all(id);

  return NextResponse.json({ collection, articles });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const { title, description, cover_image, article_ids } = await request.json();

  const db = getDb();
  const existing = db.prepare("SELECT id FROM collections WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "컬렉션을 찾을 수 없습니다." }, { status: 404 });
  }

  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (title !== undefined) { fields.push("title = ?"); values.push(title); }
  if (description !== undefined) { fields.push("description = ?"); values.push(description || null); }
  if (cover_image !== undefined) { fields.push("cover_image = ?"); values.push(cover_image || null); }

  if (fields.length > 0) {
    db.prepare(`UPDATE collections SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  }

  if (Array.isArray(article_ids)) {
    db.prepare("DELETE FROM collection_articles WHERE collection_id = ?").run(id);
    const insertArticle = db.prepare(
      "INSERT OR IGNORE INTO collection_articles (collection_id, newsletter_id, position) VALUES (?, ?, ?)"
    );
    const insertMany = db.transaction((ids: number[]) => {
      ids.forEach((nid, idx) => insertArticle.run(id, nid, idx));
    });
    insertMany(article_ids);
  }

  return NextResponse.json({ ok: true });
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
  const existing = db.prepare("SELECT id FROM collections WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "컬렉션을 찾을 수 없습니다." }, { status: 404 });
  }

  db.prepare("DELETE FROM collections WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
