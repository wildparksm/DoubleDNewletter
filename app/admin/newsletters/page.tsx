import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import getDb from "@/lib/db";
import Link from "next/link";
import NewsletterTable from "./NewsletterTable";
import AutoGenerateButton from "@/components/AutoGenerateButton";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import { IconPlus } from "@/components/Icon";

export default async function NewslettersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const db = getDb();
  const newsletters = db.prepare(`
    SELECT n.*, u.name as author_name,
      (SELECT COUNT(*) FROM email_sends WHERE newsletter_id = n.id) as send_count,
      (SELECT COUNT(*) FROM email_sends WHERE newsletter_id = n.id AND opened_at IS NOT NULL) as open_count
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    ORDER BY n.created_at DESC
  `).all() as {
    id: number; title: string; status: string; author_name: string; category: string | null;
    created_at: string; published_at: string; send_count: number; open_count: number;
  }[];

  const published = newsletters.filter((n) => n.status === "published").length;
  const drafts = newsletters.length - published;

  return (
    <main className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Newsletters"
        title="뉴스레터 관리"
        subtitle="발행 일정과 콘텐츠를 한곳에서 관리하세요."
        meta={
          <>
            <HeaderStat label="전체" value={newsletters.length} />
            <HeaderStat label="발행됨" value={published} />
            <HeaderStat label="초안" value={drafts} />
          </>
        }
        actions={
          <>
            <AutoGenerateButton />
            <Link
              href="/admin/newsletters/new"
              className="inline-flex items-center gap-1.5 bg-[#0d1b8e] text-white hover:bg-[#0a1570] px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-[#0d1b8e]/30 transition-colors"
            >
              <IconPlus size={16} />새 뉴스레터
            </Link>
          </>
        }
      />

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <NewsletterTable newsletters={newsletters} />
      </div>
    </main>
  );
}
