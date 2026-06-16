import Link from "next/link";
import getDb from "@/lib/db";
import PublicHeader from "@/components/PublicHeader";
import SubscribeForm from "@/components/SubscribeForm";

interface RecentItem { id: number; title: string; category: string | null; published_at: string; created_at: string; }

function getSubCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as total FROM subscribers WHERE unsubscribed_at IS NULL").get() as { total: number };
  return row.total;
}

function getRecent(): RecentItem[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, category, published_at, created_at
    FROM newsletters WHERE status = 'published'
    ORDER BY published_at DESC, created_at DESC LIMIT 3
  `).all() as RecentItem[];
}

export default async function SubscribePage() {
  const subCount = getSubCount();
  const recent = getRecent();

  return (
    <div className="min-h-screen flex flex-col page-bg">
      <PublicHeader subCount={subCount} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-center">
          {/* 좌: 가치 제안 + 소셜 프루프 + 미리보기 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#0d1b8e] dark:bg-blue-400 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0d1b8e] dark:bg-blue-400" />
              </span>
              <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-[#0d1b8e] dark:text-blue-400">Newsletter</span>
            </div>

            <h1 className="font-display text-[34px] sm:text-[44px] font-black text-gray-900 dark:text-gray-50 tracking-[-0.03em] leading-[1.05] mb-4">
              매주, IT가<br />한 통으로 쉬워집니다
            </h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              대덕전자 IT인프라그룹이 꼭 알아야 할 IT·AI·보안 소식만 골라 이메일로 보내드려요.
            </p>

            {/* 소셜 프루프 */}
            <div className="flex items-center gap-2 mb-7">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0d1b8e]/8 dark:bg-blue-500/15 text-[#0d1b8e] dark:text-blue-400 text-[13px] font-bold tabular-nums">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                이미 {subCount.toLocaleString()}명 구독 중
              </span>
            </div>

            {/* 발행물 미리보기 */}
            {recent.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">최근 이런 글을 보냈어요</p>
                <ul className="space-y-2.5">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/newsletter/${r.id}`} className="group flex items-start gap-2.5 text-[14px] text-gray-700 dark:text-gray-300 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0d1b8e]/40 dark:bg-blue-400/40 flex-shrink-0 group-hover:bg-[#0d1b8e] dark:group-hover:bg-blue-400 transition-colors" />
                        <span className="font-medium leading-snug line-clamp-1">{r.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 우: 폼 카드 (글래스) */}
          <div className="rounded-2xl bg-white/80 dark:bg-gray-900/70 backdrop-blur-md border border-gray-200/70 dark:border-gray-800 shadow-[0_20px_44px_-20px_rgba(13,27,142,0.25)] p-7 sm:p-8">
            <div className="mb-6">
              <div className="font-display text-2xl font-black text-gray-900 dark:text-white mb-1">
                대덕<span className="text-[#0d1b8e] dark:text-blue-400">.it</span> 구독
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">이메일만 넣으면 끝 — 30초면 충분해요.</p>
            </div>
            <SubscribeForm />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950 mt-auto">
        <div className="max-w-5xl mx-auto px-5 py-8 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="text-sm font-bold text-[#0d1b8e] dark:text-blue-400">대덕.it</Link>
          <p className="text-xs text-gray-500 dark:text-gray-500">© {2026} 대덕전자 · IT인프라그룹</p>
        </div>
      </footer>
    </div>
  );
}
