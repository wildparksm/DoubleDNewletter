import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

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
  db.prepare("DELETE FROM subscribers WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
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
  const { unsubscribe } = await request.json();
  const db = getDb();

  if (unsubscribe) {
    db.prepare(
      "UPDATE subscribers SET unsubscribed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
  } else {
    db.prepare(
      "UPDATE subscribers SET unsubscribed_at = NULL WHERE id = ?"
    ).run(id);
  }

  return NextResponse.json({ success: true });
}
