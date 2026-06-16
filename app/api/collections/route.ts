import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const collections = db.prepare(`
    SELECT c.*, u.name as author_name,
      COUNT(ca.newsletter_id) as article_count,
      (
        SELECT n.cover_image FROM newsletters n
        INNER JOIN collection_articles ca2 ON ca2.newsletter_id = n.id
        WHERE ca2.collection_id = c.id AND n.cover_image IS NOT NULL
        ORDER BY ca2.position ASC
        LIMIT 1
      ) as first_article_image
    FROM collections c
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN collection_articles ca ON ca.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  return NextResponse.json({ collections });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { title, description, cover_image, article_ids } = await request.json();
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO collections (title, description, cover_image, author_id) VALUES (?, ?, ?, ?)"
  ).run(title, description || null, cover_image || null, session.id);

  const collectionId = result.lastInsertRowid;

  if (Array.isArray(article_ids) && article_ids.length > 0) {
    const insertArticle = db.prepare(
      "INSERT OR IGNORE INTO collection_articles (collection_id, newsletter_id, position) VALUES (?, ?, ?)"
    );
    const insertMany = db.transaction((ids: number[]) => {
      ids.forEach((nid, idx) => insertArticle.run(collectionId, nid, idx));
    });
    insertMany(article_ids);
  }

  return NextResponse.json({ id: collectionId }, { status: 201 });
}
