import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const db = getDb();
  const sources = db.prepare(`
    SELECT s.*, COUNT(a.id) as article_count
    FROM rss_sources s
    LEFT JOIN rss_articles a ON a.source_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();

  return NextResponse.json({ sources });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { name, url } = await request.json();
  if (!name || !url) return NextResponse.json({ error: "이름과 URL을 입력해주세요." }, { status: 400 });

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "http 또는 https URL만 허용됩니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "유효하지 않은 URL 형식입니다." }, { status: 400 });
  }

  const db = getDb();
  try {
    const result = db.prepare("INSERT INTO rss_sources (name, url) VALUES (?, ?)").run(name, url);
    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "이미 등록된 URL입니다." }, { status: 409 });
  }
}
