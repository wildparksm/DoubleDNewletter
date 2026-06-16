import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import AdminShell from "@/components/AdminShell";

function getSidebarStats() {
  const db = getDb();
  const nl = db
    .prepare("SELECT COUNT(*) as n FROM newsletters WHERE status = 'published'")
    .get() as { n: number };
  const sub = db
    .prepare("SELECT COUNT(*) as n FROM subscribers WHERE unsubscribed_at IS NULL")
    .get() as { n: number };
  const rss = db
    .prepare("SELECT COUNT(*) as n FROM rss_articles WHERE status = 'new'")
    .get() as { n: number };
  return { newsletters: nl.n, subscribers: sub.n, rssNew: rss.n };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // 비로그인(=로그인 페이지)은 사이드바 없이 그대로 렌더.
  // proxy.ts가 /admin/* 비인증 요청을 /admin/login으로 보내므로
  // 이 경로에 도달했다면 로그인 페이지뿐임.
  if (!session) return <>{children}</>;

  const stats = getSidebarStats();

  return (
    <AdminShell
      userName={session.name}
      userRole={session.role}
      stats={stats}
    >
      {children}
    </AdminShell>
  );
}
