import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  db.prepare(
    "UPDATE newsletters SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(id);

  return NextResponse.json({ success: true });
}
