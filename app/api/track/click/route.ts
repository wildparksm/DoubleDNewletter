import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("c");
  const subscriberId = searchParams.get("s");

  if (!code) return NextResponse.redirect(new URL("/", request.url));

  const db = getDb();
  const link = db.prepare("SELECT * FROM tracking_links WHERE short_code = ?").get(code) as {
    id: number; original_url: string; newsletter_id: number;
  } | undefined;

  if (!link) return NextResponse.redirect(new URL("/", request.url));

  // Increment click count
  db.prepare("UPDATE tracking_links SET click_count = click_count + 1 WHERE id = ?").run(link.id);

  // Record individual click
  db.prepare(
    "INSERT INTO link_clicks (tracking_link_id, subscriber_id) VALUES (?, ?)"
  ).run(link.id, subscriberId ? parseInt(subscriberId) : null);

  return NextResponse.redirect(link.original_url);
}
