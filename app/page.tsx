import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import ArchiveClient from "@/components/ArchiveClient";
import Logo from "@/components/Logo";
import ScrollTopButton from "@/components/ScrollTopButton";
import getDb from "@/lib/db";
import { expandTerms } from "@/lib/search-synonyms";

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
  tags: string | null;
}

function getNewsletters(search?: string, tag?: string): Newsletter[] {
  const db = getDb();
  let query = `
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.status = 'published'
  `;
  const params: string[] = [];

  if (tag) {
    // 태그 필터: "Microsoft" → tags LIKE '%Microsoft%'
    query += ` AND (',' || n.tags || ',' LIKE ?)`;
    params.push(`%,${tag},%`);
  }

  if (search) {
    // 동의어 확장: "클로드" → ["클로드", "Claude"]
    const terms = expandTerms(search);
    const termConditions = terms
      .map(() => "(n.title LIKE ? OR n.summary LIKE ? OR n.category LIKE ? OR n.tags LIKE ? OR u.name LIKE ?)")
      .join(" OR ");
    query += ` AND (${termConditions})`;
    terms.forEach(t => params.push(`%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`));
  }
  query += " ORDER BY n.published_at DESC, n.created_at DESC";
  return db.prepare(query).all(...params) as Newsletter[];
}


// 히어로 수동 지정: "홈 대표기사" 컬렉션에 담긴 글을 순서대로 사용. (관리자 컬렉션 UI에서 선택·정렬)
function getFeaturedNewsletters(): Newsletter[] {
  const db = getDb();
  const col = db.prepare("SELECT id FROM collections WHERE title = '홈 대표기사' LIMIT 1").get() as { id: number } | undefined;
  if (!col) return [];
  return db.prepare(`
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
    WHERE ca.collection_id = ? AND n.status = 'published'
    ORDER BY ca.position ASC
    LIMIT 5
  `).all(col.id) as Newsletter[];
}

function getHeroNewsletters(): Newsletter[] {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  // SQLite는 "YYYY-MM-DD HH:MM:SS" 형식으로 저장하므로 ISO의 'T'/'Z'를 제거
  const sqliteTs = todayStart.toISOString().replace("T", " ").slice(0, 19);
  return db.prepare(`
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.status = 'published'
      AND (n.published_at >= ? OR (n.published_at IS NULL AND n.created_at >= ?))
    ORDER BY n.published_at DESC, n.created_at DESC
    LIMIT 5
  `).all(sqliteTs, sqliteTs) as Newsletter[];
}

function getPopularNewsletters(): Newsletter[] {
  const db = getDb();
  // 최근 7일 조회 기록 기준 집계 (SQLite 형식: "YYYY-MM-DD HH:MM:SS" UTC)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ").slice(0, 19);
  const popular = db.prepare(`
    SELECT n.*, u.name as author_name, COUNT(nv.id) as week_views
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    INNER JOIN newsletter_views nv
      ON nv.newsletter_id = n.id AND nv.viewed_at >= ?
    WHERE n.status = 'published'
    GROUP BY n.id
    ORDER BY week_views DESC, n.published_at DESC
    LIMIT 4
  `).all(weekAgo) as Newsletter[];

  // 최근 7일 조회 기록이 4개 미만이면 최신 발행글로 4개까지 채운다.
  if (popular.length < 4) {
    const have = new Set(popular.map(n => n.id));
    const recent = db.prepare(`
      SELECT n.*, u.name as author_name
      FROM newsletters n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.status = 'published'
      ORDER BY n.published_at DESC
      LIMIT 10
    `).all() as Newsletter[];
    for (const r of recent) {
      if (popular.length >= 4) break;
      if (!have.has(r.id)) { popular.push(r); have.add(r.id); }
    }
  }

  return popular;
}

interface DaeduckArticle {
  id: number;
  title: string;
  card_title: string | null;
  summary: string;
  cover_image: string | null;
  published_at: string;
  category: string;
  view_count: number;
}

interface DaeduckCollection {
  id: number;
  title: string;
  description: string | null;
  articles: DaeduckArticle[];
}

function getDaeduckCollection(): DaeduckCollection | null {
  const db = getDb();
  const col = db.prepare(`
    SELECT id, title, description FROM collections
    WHERE title = '대덕.it 사내 소식'
    LIMIT 1
  `).get() as { id: number; title: string; description: string | null } | undefined;

  if (!col) return null;

  const articles = db.prepare(`
    SELECT n.id, n.title, n.card_title, n.summary, n.cover_image, n.published_at, n.category, n.view_count
    FROM newsletters n
    INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
    WHERE ca.collection_id = ? AND n.status = 'published'
    ORDER BY ca.position ASC, n.published_at DESC
  `).all(col.id) as DaeduckArticle[];

  return { ...col, articles };
}

// 주제(컬렉션)별 상위 기사까지 묶어 반환 — 홈의 뉴닉식 "이슈 블록"용.
// (사내 소식 = 전용 섹션, 홈 대표기사 = 히어로 소스이므로 토픽 블록에서 제외해 중복 방지)
function getTopicCollections(): DaeduckCollection[] {
  const db = getDb();
  const cols = db.prepare(`
    SELECT id, title, description FROM collections
    WHERE title NOT IN ('대덕.it 사내 소식', '홈 대표기사')
    ORDER BY created_at DESC
  `).all() as { id: number; title: string; description: string | null }[];
  return cols
    .map((c) => ({
      ...c,
      articles: db.prepare(`
        SELECT n.id, n.title, n.card_title, n.summary, n.cover_image, n.published_at, n.category, n.view_count
        FROM newsletters n
        INNER JOIN collection_articles ca ON ca.newsletter_id = n.id
        WHERE ca.collection_id = ? AND n.status = 'published'
        ORDER BY ca.position ASC, n.published_at DESC
        LIMIT 4
      `).all(c.id) as DaeduckArticle[],
    }))
    .filter((c) => c.articles.length > 0);
}

function getSubCount(): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as total FROM subscribers WHERE unsubscribed_at IS NULL"
  ).get() as { total: number };
  return row.total;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tag?: string }>;
}) {
  const { search, tag } = await searchParams;
  const newsletters = getNewsletters(search, tag);
  // 수동 지정("홈 대표기사" 컬렉션) 우선, 없으면 오늘 발행글로 자동 폴백
  const featured = getFeaturedNewsletters();
  const heroNewsletters = featured.length > 0 ? featured : getHeroNewsletters();
  const popularNewsletters = getPopularNewsletters();
  const topicCollections = getTopicCollections();
  const daeduckCollection = getDaeduckCollection();
  const subCount = getSubCount();

  return (
    <div className="min-h-screen flex flex-col page-bg">
      <PublicHeader subCount={subCount} />

      {/* ── Archive ── */}
      <main className="flex-1 max-w-7xl mx-auto px-5 py-6 w-full">
        <ArchiveClient
          newsletters={newsletters}
          heroNewsletters={heroNewsletters}
          popularNewsletters={popularNewsletters}
          initialSearch={search || ""}
          initialTag={tag || ""}
          totalCount={newsletters.length}
          topicCollections={topicCollections}
          daeduckCollection={daeduckCollection}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
        <div className="max-w-7xl mx-auto px-5 py-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-8 sm:gap-12 justify-between">

            {/* 브랜드 */}
            <div className="flex-shrink-0">
              {/* 다크모드 대응 인라인 로고 */}
              <Link href="/" className="inline-flex items-center gap-1.5 mb-3 group">
                <span className="font-black text-lg tracking-tight">
                  <span className="text-gray-900 dark:text-white group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors">대덕</span>
                  <span className="text-[#0d1b8e] dark:text-blue-400">.it</span>
                </span>
              </Link>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                대덕의 IT, 소식을 잇다<br />
                대덕전자 IT인프라그룹
              </p>
            </div>

            {/* 링크 그룹 */}
            <div className="flex gap-10 sm:gap-14">
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">콘텐츠</p>
                <ul className="space-y-2">
                  <li><Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors">아티클</Link></li>
                  <li><Link href="/collections" className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors">컬렉션</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">구독</p>
                <ul className="space-y-2">
                  <li><Link href="/subscribe" className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors">뉴스레터 구독</Link></li>
                  <li><a href="mailto:jmyun@daeduck.com" className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors">문의하기</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* 하단 구분선 + 저작권 */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              © 2026 대덕전자 · 담당자: 윤종민 프로
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-700">
              사내 전용 서비스 · 외부 공개 금지
            </p>
          </div>
        </div>
      </footer>

      <ScrollTopButton />
    </div>
  );
}
