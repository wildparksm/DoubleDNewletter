import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const publicOnly = searchParams.get("public") === "true";

  let query = `
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
  `;
  const params: string[] = [];

  const search = searchParams.get("search");
  const conditions: string[] = [];

  if (publicOnly) conditions.push("n.status = 'published'");
  else if (status) { conditions.push("n.status = ?"); params.push(status); }

  if (search) {
    conditions.push("(n.title LIKE ? OR n.summary LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY n.created_at DESC";

  const newsletters = db.prepare(query).all(...params);
  return NextResponse.json({ newsletters });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { title, card_title, summary, content, cover_image, category, tags } = await request.json();
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO newsletters (title, card_title, summary, content, cover_image, category, tags, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(title, card_title || null, summary || "", content || "", cover_image || null, category || "일반", tags || "", session.id);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
