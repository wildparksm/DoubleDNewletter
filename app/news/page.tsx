import Link from "next/link";
import getDb from "@/lib/db";
import PublicHeader from "@/components/PublicHeader";

interface Newsletter {
  id: number;
  title: string;
  card_title: string | null;
  summary: string;
  content: string;
  cover_image: string | null;
  author_name: string;
  published_at: string;
  created_at: string;
  category: string;
  view_count: number;
}

const DAEDUCK_COLLECTION = "대덕.it 사내 소식";

function getNewsArticles(): Newsletter[] {
  const db = getDb();
  const col = db.prepare("SELECT id FROM collections WHERE title = ? LIMIT 1").get(DAEDUCK_COLLECTION) as { id: number } | undefined;
  if (!col) return [];
  return db.prepare(`
    SELECT n.*, u.name as author_name
    FROM newsletters n
    INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
    LEFT JOIN users u ON n.author_id = u.id
    WHERE ca.collection_id = ? AND n.status = 'published'
    ORDER BY ca.position ASC, n.published_at DESC
  `).all(col.id) as Newsletter[];
}

function getSubCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as total FROM subscribers WHERE unsubscribed_at IS NULL").get() as { total: number };
  return row.total;
}

function monthLabel(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function getPreview(nl: { summary: string; content: string }, maxLen = 160): string {
  if (nl.summary?.trim()) return nl.summary.trim();
  const plain = (nl.content || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
}

const TILE = "rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(13,27,142,0.04)]";
const TILE_HOVER = "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(13,27,142,0.22)] hover:border-gray-200 dark:hover:border-gray-700";

export default async function NewsPage() {
  const articles = getNewsArticles();
  const subCount = getSubCount();
  const latest = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen flex flex-col page-bg">
      <PublicHeader subCount={subCount} />

      <main className="admin-stage flex-1 max-w-5xl mx-auto px-5 py-12 w-full">
        {/* 헤더 — 네이비 에디토리얼 */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#0d1b8e] dark:bg-blue-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0d1b8e] dark:bg-blue-400" />
            </span>
            <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-[#0d1b8e] dark:text-blue-400">
              Monthly · 사내 소식
            </span>
          </div>
          <h1 className="font-display text-[30px] sm:text-[38px] font-black text-gray-900 dark:text-gray-50 tracking-[-0.03em] leading-[1.05] mb-2">
            대덕<span className="lowercase">.it</span> 사내 소식
          </h1>
          <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed">
            IT인프라그룹이 매월 전하는 사내 IT 소식 — 여기에서만 볼 수 있어요.
          </p>
        </div>

        {/* 빈 상태 */}
        {articles.length === 0 && (
          <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">이번 달 사내 소식이 곧 올라옵니다.</p>
          </div>
        )}

        {/* 이번 호 — 클립 히어로 (홈 히어로와 동일 무드) */}
        {latest && (
          <section className="mb-12">
            <Link href={`/newsletter/${latest.id}`} className="group relative block rounded-2xl overflow-hidden h-[320px] sm:h-[380px]">
              <div className="absolute inset-0 bg-gray-900 overflow-hidden">
                {latest.cover_image ? (
                  <img src={latest.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b8e] to-[#00a3ff] flex items-center justify-center">
                    <span className="text-white font-black text-3xl">{monthLabel(latest.published_at)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <span className="inline-block text-[13px] font-bold text-cyan-200 mb-2">{monthLabel(latest.published_at)}</span>
                  <h2 className="font-display text-[22px] sm:text-[28px] font-black text-white leading-snug tracking-tight line-clamp-2 mb-2">
                    {latest.title}
                  </h2>
                  <p className="text-[14px] text-white/75 leading-relaxed line-clamp-2 max-w-2xl">{getPreview(latest, 160)}</p>
                  <div className="flex items-center gap-2 text-[13px] text-white/70 mt-3">
                    <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center"><span className="text-white font-black text-[8px]">it</span></span>
                    <span className="font-medium">{latest.author_name}</span>
                  </div>
                </div>
              </div>
              {/* 우상단 노치 (CSS 컷아웃) */}
              <div aria-hidden className="pointer-events-none absolute top-0 right-0 z-10 w-[150px] h-[58px] bg-[#f6f7f9] dark:bg-[#0f1117] rounded-bl-[26px]" />
              {/* 우상단 노치 배지 */}
              <span className="pointer-events-none absolute top-[14px] right-5 z-20 inline-flex items-center gap-1.5 text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-[#0d1b8e] shadow-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                이번 호
              </span>
            </Link>
          </section>
        )}

        {/* 지난 편지들 — 타일 그리드 */}
        {rest.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-5">
              <div>
                <h3 className="font-display text-[20px] font-black tracking-[-0.02em] text-gray-900 dark:text-gray-50">지난 편지들</h3>
                <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#0d1b8e] to-[#3b82f6] dark:from-blue-400 dark:to-cyan-400" />
              </div>
              <span className="text-[13px] text-gray-500 dark:text-gray-500 tabular-nums">총 {articles.length}호</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {rest.map(nl => {
                const label = monthLabel(nl.published_at);
                return (
                  <Link key={nl.id} href={`/newsletter/${nl.id}`} className={`group block overflow-hidden cursor-pointer ${TILE} ${TILE_HOVER}`}>
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {nl.cover_image ? (
                        <img src={nl.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#0d1b8e] to-[#00a3ff] flex flex-col items-center justify-center gap-1">
                          <span className="text-white/60 text-[9px] font-bold uppercase tracking-[0.2em]">사내소식</span>
                          <span className="text-white font-black text-[16px]">{label}</span>
                        </div>
                      )}
                      <span className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-center text-[#0d1b8e] dark:text-blue-400 shadow-sm opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[13px] font-bold text-[#0d1b8e] dark:text-blue-400 mb-1">{label}</p>
                      <h4 className="font-display text-[16px] font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 mb-2">
                        {nl.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-500">
                        <span className="w-5 h-5 rounded-full bg-[#0d1b8e]/10 flex items-center justify-center flex-shrink-0"><span className="text-[#0d1b8e] font-black text-[8px]">it</span></span>
                        <span className="text-gray-500 dark:text-gray-400 font-medium">{nl.author_name}</span>
                        {nl.view_count > 0 && (
                          <>
                            <span className="text-gray-300 dark:text-gray-700">·</span>
                            <span className="flex items-center gap-0.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              {nl.view_count.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 구독 CTA — 네이비 타일 밴드 */}
        {articles.length > 0 && (
          <div className="mt-12 rounded-2xl bg-[#0d1b8e] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_16px_40px_-18px_rgba(13,27,142,0.55)]">
            <div>
              <p className="font-display text-[19px] font-black text-white tracking-tight">사내 소식, 매월 메일로 받기</p>
              <p className="text-blue-200 text-[13px] mt-1">새 소식이 올라오면 가장 먼저 알려드려요.</p>
            </div>
            <Link href="/subscribe" className="flex-shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 bg-white text-[#0d1b8e] hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl text-[14px] transition-colors duration-200 cursor-pointer group">
              구독하기
              <svg className="group-hover:translate-x-0.5 transition-transform duration-200" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950 mt-auto">
        <div className="max-w-5xl mx-auto px-5 py-8 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="text-sm font-bold text-[#0d1b8e] dark:text-blue-400">대덕.it</Link>
          <p className="text-xs text-gray-500 dark:text-gray-500">© 2026 대덕전자 · IT인프라그룹</p>
        </div>
      </footer>
    </div>
  );
}
