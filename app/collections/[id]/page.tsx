import { notFound } from "next/navigation";
import Link from "next/link";
import getDb from "@/lib/db";
import PublicHeader from "@/components/PublicHeader";

interface Collection {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  author_name: string;
  created_at: string;
}

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
  position: number;
}

function getCollectionWithArticles(id: string): { collection: Collection; articles: Newsletter[] } | null {
  const db = getDb();
  const collection = db.prepare(`
    SELECT c.*, u.name as author_name
    FROM collections c
    LEFT JOIN users u ON c.author_id = u.id
    WHERE c.id = ?
  `).get(id) as Collection | undefined;

  if (!collection) return null;

  const articles = db.prepare(`
    SELECT n.*, u.name as author_name, ca.position
    FROM newsletters n
    INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
    LEFT JOIN users u ON n.author_id = u.id
    WHERE ca.collection_id = ? AND n.status = 'published'
    ORDER BY ca.position ASC
  `).all(id) as Newsletter[];

  return { collection, articles };
}

function getSubCount(): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as total FROM subscribers WHERE unsubscribed_at IS NULL"
  ).get() as { total: number };
  return row.total;
}

const CAT_COLORS: Record<string, string> = {
  "IT 트렌드":  "text-blue-600",
  "AI":  "text-emerald-600",
  "보안":       "text-red-500",
  "개발·기술":  "text-violet-600",
  "인프라":     "text-slate-500",
  "사내 소식":  "text-orange-500",
  "기타":       "text-gray-500",
  "일반":       "text-[#0d1b8e]",
};

const CAT_GRADIENT: Record<string, [string, string]> = {
  "IT 트렌드":  ["#3b5bdb", "#748ffc"],
  "AI":  ["#0b7285", "#22b8cf"],
  "보안":       ["#9c36b5", "#cc5de8"],
  "개발·기술":  ["#4263eb", "#74c0fc"],
  "인프라":     ["#495057", "#868e96"],
  "사내 소식":  ["#d9480f", "#f76707"],
  "기타":       ["#2f9e44", "#69db7c"],
};

function Placeholder({ id, category }: { id: number; category: string }) {
  const [c1, c2] = CAT_GRADIENT[category] ?? ["#3b5bdb", "#748ffc"];
  const gId = `g${id}`;
  const pId = `p${id}`;
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <pattern id={pId} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1.2" fill="white" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${gId})`} />
      <rect width="100%" height="100%" fill={`url(#${pId})`} />
    </svg>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = getCollectionWithArticles(id);
  if (!data) notFound();

  const { collection, articles } = data;
  const subCount = getSubCount();

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-gray-950">
      <PublicHeader subCount={subCount} />

      <main className="flex-1 max-w-7xl mx-auto px-5 py-8 w-full">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          홈으로
        </Link>

        {/* Collection header */}
        <div className="mb-8">
          {collection.cover_image && (
            <div className="w-full h-52 rounded-2xl overflow-hidden mb-6 bg-gray-200">
              <img
                src={collection.cover_image}
                alt={collection.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#0d1b8e] bg-blue-50 dark:bg-blue-950 dark:text-blue-400 px-2.5 py-1 rounded-full uppercase tracking-wide">
              컬렉션
            </span>
            <span className="text-xs text-gray-400">{articles.length}개 아티클</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-gray-50 leading-tight mb-3">
            {collection.title}
          </h1>
          {collection.description && (
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-6 h-6 rounded-full bg-[#0d1b8e]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#0d1b8e] font-black text-[8px]">it</span>
            </div>
            <span className="font-medium text-gray-600 dark:text-gray-400">{collection.author_name}</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span>{formatDate(collection.created_at)}</span>
          </div>
        </div>

        {/* Articles grid */}
        {articles.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-400">이 컬렉션에 아티클이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {articles.map((nl, idx) => {
              const cat = nl.category || "일반";
              const displayTitle = nl.title;
              const date = nl.published_at || nl.created_at;
              return (
                <Link
                  key={nl.id}
                  href={`/newsletter/${nl.id}`}
                  className="group flex flex-col bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                >
                  {/* Position badge */}
                  <div className="relative w-full aspect-[16/10] bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                    {nl.cover_image ? (
                      <img src={nl.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Placeholder id={nl.id} category={cat} />
                    )}
                    <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 text-xs font-black flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </span>
                  </div>

                  <div className="flex flex-col flex-1 p-4">
                    <span className={`text-[13px] font-bold mb-2 ${CAT_COLORS[cat] ?? CAT_COLORS["일반"]}`}>
                      {cat}
                    </span>
                    <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors leading-snug flex-1 mb-4">
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-gray-500">
                      <div className="w-5 h-5 rounded-full bg-[#0d1b8e]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#0d1b8e] font-black text-[8px]">it</span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{nl.author_name}</span>
                      <span className="text-gray-200 dark:text-gray-700">·</span>
                      <span>{formatDate(date)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-[#f8f9fa] dark:bg-gray-950 mt-auto">
        <div className="max-w-7xl mx-auto px-5 py-8 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="text-sm font-bold text-[#0d1b8e]">대덕뉴스레터</Link>
          <p className="text-xs text-gray-400 dark:text-gray-500">© 2026 대덕전자 · IT인프라그룹</p>
        </div>
      </footer>
    </div>
  );
}
