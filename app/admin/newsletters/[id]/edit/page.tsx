import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import getDb from "@/lib/db";
import NewsletterEditor from "../../NewsletterEditor";

function truncateUrl(url: string, max = 55) {
  return url.length > max ? url.slice(0, max) + "…" : url;
}

export default async function EditNewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const db = getDb();

  const newsletter = db.prepare("SELECT * FROM newsletters WHERE id = ?").get(id) as {
    id: number; title: string; card_title: string | null; summary: string; content: string; cover_image: string | null;
    status: string; scheduled_at: string | null; category: string | null; tags: string | null;
  } | undefined;

  if (!newsletter) notFound();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened
    FROM email_sends WHERE newsletter_id = ?
  `).get(id) as { total_sent: number; total_opened: number };

  const linkStats = db.prepare(`
    SELECT tl.short_code, tl.original_url, tl.click_count,
      COUNT(DISTINCT lc.subscriber_id) as unique_clicks
    FROM tracking_links tl
    LEFT JOIN link_clicks lc ON lc.tracking_link_id = tl.id
    WHERE tl.newsletter_id = ?
    GROUP BY tl.id
    ORDER BY tl.click_count DESC
  `).all(id) as { short_code: string; original_url: string; click_count: number; unique_clicks: number }[];

  const openRate = stats.total_sent > 0
    ? Math.round((stats.total_opened / stats.total_sent) * 100)
    : 0;

  return (
    <>
      <NewsletterEditor
        initialData={{
          id: newsletter.id,
          title: newsletter.title,
          summary: newsletter.summary || "",
          content: newsletter.content,
          cover_image: newsletter.cover_image || "",
          status: newsletter.status,
          scheduled_at: newsletter.scheduled_at || "",
          category: newsletter.category || "일반",
          tags: newsletter.tags || "",
        }}
        stats={stats.total_sent > 0 ? { sent: stats.total_sent, openRate } : undefined}
        linkStats={linkStats}
      />
    </>
  );
}
