import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const newsletterId = searchParams.get("n");
  const subscriberId = searchParams.get("s");

  if (newsletterId && subscriberId) {
    try {
      const db = getDb();
      db.prepare(
        "UPDATE email_sends SET opened_at = CURRENT_TIMESTAMP WHERE newsletter_id = ? AND subscriber_id = ? AND opened_at IS NULL"
      ).run(newsletterId, subscriberId);
    } catch {
      // Silently ignore tracking errors
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
