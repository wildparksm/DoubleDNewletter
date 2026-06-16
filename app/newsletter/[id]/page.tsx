import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import ReadingProgress from "@/components/ReadingProgress";
import ShareButtons from "@/components/ShareButtons";
import Logo from "@/components/Logo";
import getDb from "@/lib/db";
import sanitizeHtml from "sanitize-html";
import ViewTracker from "@/components/ViewTracker";
import ArticleHighlighter from "@/components/ArticleHighlighter";
import ArticleTOC from "@/components/ArticleTOC";

function injectSummaryClass(html: string): string {
  const EMOJI = "📌";
  if (!html.includes(EMOJI)) return html;

  // 케이스 1: div 래퍼가 있는 경우 — nl-summary class 추가
  const divIdx = html.indexOf("<div");
  const emojiIdx = html.indexOf(EMOJI);
  if (divIdx !== -1 && divIdx < emojiIdx) {
    const divCloseIdx = html.indexOf(">", divIdx);
    if (divCloseIdx > divIdx && divCloseIdx > emojiIdx - 200) {
      return html.slice(0, divCloseIdx) + ' class="nl-summary"' + html.slice(divCloseIdx);
    }
  }

  // 케이스 2: div 없이 <p>로만 된 경우 — 마커 p + 이어지는 p들을 div로 묶기
  const pStart = html.lastIndexOf("<p", emojiIdx);
  if (pStart === -1) return html;
  let closeIdx = html.indexOf("</p>", emojiIdx) + 4;
  for (let i = 0; i < 3; i++) {
    const next = html.indexOf("<p", closeIdx);
    if (next === -1 || html.slice(closeIdx, next).trim() !== "") break;
    closeIdx = html.indexOf("</p>", next) + 4;
  }
  return html.slice(0, pStart) + '<div class="nl-summary">' + html.slice(pStart, closeIdx) + "</div>" + html.slice(closeIdx);
}

const ALLOWED_HTML: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img", "h1", "h2", "h3", "figure", "figcaption", "video", "source", "iframe", "mark",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height", "style", "class"],
    a: ["href", "name", "target", "rel"],
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen", "allow", "title", "style", "class"],
    "*": ["class", "style", "id", "data-youtube-video"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "youtu.be", "www.youtube-nocookie.com"],
};

interface Newsletter {
  id: number;
  title: string;
  summary: string;
  content: string;
  cover_image: string | null;
  status: string;
  author_name: string;
  published_at: string;
  created_at: string;
  category: string;
  view_count: number;
  tags: string | null;
}

const CAT: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  "IT 트렌드":  { bg: "bg-blue-50",    text: "text-blue-600",    dot: "bg-blue-400",    border: "border-blue-200" },
  "사내 소식":  { bg: "bg-sky-50",     text: "text-sky-600",     dot: "bg-sky-400",     border: "border-sky-200" },
  "개발·기술":  { bg: "bg-indigo-50",  text: "text-indigo-600",  dot: "bg-indigo-400",  border: "border-indigo-200" },
  "보안":       { bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400",     border: "border-red-200" },
  "AI":  { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400", border: "border-emerald-200" },
  "인프라":     { bg: "bg-slate-100",  text: "text-slate-600",   dot: "bg-slate-400",   border: "border-slate-200" },
  "기타":       { bg: "bg-orange-50",  text: "text-orange-600",  dot: "bg-orange-400",  border: "border-orange-200" },
  "일반":       { bg: "bg-blue-50",    text: "text-[#0d1b8e]",   dot: "bg-[#0d1b8e]",  border: "border-blue-100" },
};

function catStyle(cat: string) {
  return CAT[cat] ?? CAT["일반"];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function readTime(content: string) {
  const text = content.replace(/<[^>]+>/g, "");
  return Math.max(1, Math.round(text.length / 500));
}

export default async function NewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const newsletter = db.prepare(`
    SELECT n.*, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = ?
  `).get(id) as Newsletter | undefined;

  if (!newsletter || newsletter.status !== "published") notFound();

  const stats = db.prepare(`
    SELECT COUNT(*) as total_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened
    FROM email_sends WHERE newsletter_id = ?
  `).get(id) as { total_sent: number; total_opened: number };

  // Related articles (same category, different id)
  const related = db.prepare(`
    SELECT n.id, n.title, n.summary, n.cover_image, n.published_at, n.created_at, n.category, u.name as author_name
    FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.status = 'published' AND n.id != ? AND n.category = ?
    ORDER BY n.published_at DESC, n.created_at DESC
    LIMIT 3
  `).all(id, newsletter.category || "일반") as Newsletter[];

  const minutes = readTime(newsletter.content);
  const rawSafe = sanitizeHtml(newsletter.content, ALLOWED_HTML);
  const safeContent = injectSummaryClass(rawSafe);
  const cat = newsletter.category || "일반";
  const cs = catStyle(cat);

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const pageUrl = `${protocol}://${host}/newsletter/${id}`;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <ViewTracker id={newsletter.id} />
      <ArticleHighlighter />
      <ReadingProgress />
      <ArticleTOC />
      <PublicHeader />

      <main className="flex-1 w-full">

        {/* ── 아티클 헤더 영역 ── */}
        <div className="max-w-2xl mx-auto px-5 pt-8 pb-0">

          {/* 뒤로 가기 */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors mb-7 font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            아티클 목록
          </Link>

          {/* 카테고리 + 읽기시간 */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${cs.bg} ${cs.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />
              {cat}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {minutes}분 읽기
            </span>
          </div>

          {/* 제목 */}
          <h1 className="text-3xl sm:text-[2.1rem] font-black text-gray-900 dark:text-gray-100 leading-tight tracking-tight mb-4">
            {newsletter.title}
          </h1>

          {/* 요약 */}
          {newsletter.summary && (
            <p className="text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed mb-5 font-normal">
              {newsletter.summary}
            </p>
          )}

          {/* 태그 */}
          {newsletter.tags && newsletter.tags.trim() && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {newsletter.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                <Link
                  key={tag}
                  href={`/?tag=${encodeURIComponent(tag)}`}
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-50 hover:text-[#0d1b8e] dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* 메타 */}
          <div className="flex items-center gap-2 text-sm text-gray-500 pb-6 border-b border-gray-100 dark:border-gray-800">
            <span className="w-6 h-6 rounded-full bg-[#0d1b8e]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#0d1b8e] font-black text-[9px]">it</span>
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300 text-[13px]">{newsletter.author_name}</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="text-[13px]">{formatDate(newsletter.published_at || newsletter.created_at)}</span>
            {newsletter.view_count > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-[13px] inline-flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  {newsletter.view_count.toLocaleString()}
                </span>
              </>
            )}
            {stats?.total_sent > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-[13px]">{stats.total_sent.toLocaleString()}명 수신</span>
              </>
            )}
          </div>
        </div>

        {/* ── 커버 이미지 ── */}
        {newsletter.cover_image && (
          <div className="max-w-2xl mx-auto px-5 my-6">
            <div className="rounded-2xl overflow-hidden aspect-[2/1]">
              <img
                src={newsletter.cover_image}
                alt={newsletter.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* ── 본문 ── */}
        <article className="max-w-2xl mx-auto px-5 py-8">
          <div
            data-article-body
            className="
              prose-reading
              text-gray-700 dark:text-gray-300 leading-[1.9] text-[17px]
              [&_h1]:text-[1.65rem] [&_h1]:font-black [&_h1]:text-gray-900 [&_h1]:mt-12 [&_h1]:mb-4 [&_h1]:leading-tight dark:[&_h1]:text-gray-100
              [&_h2]:text-[1.35rem] [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:leading-snug dark:[&_h2]:text-gray-100
              [&_h3]:text-[1.1rem] [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-8 [&_h3]:mb-2 dark:[&_h3]:text-gray-200
              [&_p]:my-5 [&_p]:leading-[1.9]
              [&_a]:text-[#0d1b8e] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[#0d1b8e]/30 hover:[&_a]:decoration-[#0d1b8e] dark:[&_a]:text-blue-400
              [&_blockquote]:border-l-4 [&_blockquote]:border-[#0d1b8e] [&_blockquote]:pl-5 [&_blockquote]:py-2 [&_blockquote]:bg-blue-50 [&_blockquote]:rounded-r-lg [&_blockquote]:text-gray-800 [&_blockquote]:my-7 [&_blockquote]:not-italic [&_blockquote]:font-medium dark:[&_blockquote]:bg-blue-950/30 dark:[&_blockquote]:text-gray-200
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-5 [&_ul_li]:my-2 [&_ul_li]:leading-relaxed
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-5 [&_ol_li]:my-2 [&_ol_li]:leading-relaxed
              [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-gray-100 [&_hr]:my-12 dark:[&_hr]:border-gray-800
              [&_img:not(.emoji)]:max-w-full [&_img:not(.emoji)]:rounded-xl [&_img:not(.emoji)]:my-8
              [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[15px] [&_code]:font-mono [&_code]:text-gray-700 dark:[&_code]:bg-gray-800 dark:[&_code]:text-gray-200
              [&_pre]:bg-gray-950 [&_pre]:text-gray-100 [&_pre]:p-5 [&_pre]:rounded-xl [&_pre]:my-7 [&_pre]:overflow-x-auto [&_pre]:text-sm
              [&_p.subtitle]:text-[1.05rem] [&_p.subtitle]:text-gray-500 [&_p.subtitle]:italic [&_p.subtitle]:mt-0 [&_p.subtitle]:mb-8 [&_p.subtitle]:leading-relaxed
              [&_div]:rounded-xl [&_div]:my-6
              [&_strong]:font-bold [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100
              [&_iframe]:w-full [&_iframe]:rounded-xl [&_iframe]:my-6 [&_iframe]:aspect-video
              [&_div[data-youtube-video]]:my-6
              [&_table]:w-full [&_table]:my-6 [&_table]:text-sm
              [&_th]:text-left [&_th]:font-semibold [&_th]:py-2 [&_th]:px-3 [&_th]:border-b-2 [&_th]:border-gray-200 dark:[&_th]:border-gray-700
              [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-gray-100 dark:[&_td]:border-gray-800
            "
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
        </article>

        {/* ── 공유 ── */}
        <div className="max-w-2xl mx-auto px-5 pb-10 border-b border-gray-100 dark:border-gray-800">
          <ShareButtons title={newsletter.title} url={pageUrl} />
        </div>

        {/* ── 연관 아티클 ── */}
        {related.length > 0 && (
          <div className="max-w-2xl mx-auto px-5 py-10 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-600 tracking-widest uppercase mb-5">같은 카테고리 아티클</p>
            <div className="space-y-4">
              {related.map(r => {
                const rs = catStyle(r.category || "일반");
                const rMin = readTime(r.summary + r.title);
                return (
                  <Link
                    key={r.id}
                    href={`/newsletter/${r.id}`}
                    className="group flex items-start gap-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 -mx-2 px-2 transition-colors"
                  >
                    <div className="flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-[#0d1b8e]/10 to-[#0d1b8e]/5 flex items-center justify-center">
                      {r.cover_image
                        ? <img src={r.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        : <span className="text-[#0d1b8e]/30 font-black text-[10px]">it</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 font-semibold ${rs.text}`}>
                          <span className={`w-1 h-1 rounded-full ${rs.dot}`} />
                          {r.category || "일반"}
                        </span>
                        <span>·</span>
                        <span>{rMin}분</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 구독 CTA ── */}
        <div className="max-w-2xl mx-auto px-5 py-10">
          <div className="bg-[#0d1b8e] rounded-2xl p-8 text-white">
            <div className="mb-3">
              <Logo size="xs" href={null} onDark />
            </div>
            <h3 className="text-lg font-black mb-1.5 leading-tight">
              매주 꼭 알아야 할 IT 지식,<br />이메일로 받아보세요
            </h3>
            <p className="text-blue-300 text-[13px] mb-6">짧고 핵심만 담은 아티클을 무료로 구독하세요</p>
            <Link
              href="/subscribe"
              className="inline-block bg-white text-[#0d1b8e] hover:bg-blue-50 font-bold px-6 py-2.5 rounded-full text-sm transition-colors"
            >
              무료 구독 신청 →
            </Link>
          </div>
        </div>

        {/* ── 하단 목록 링크 ── */}
        <div className="max-w-2xl mx-auto px-5 pb-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0d1b8e] transition-colors font-medium">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            다른 아티클 보기
          </Link>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 dark:border-gray-800 dark:bg-gray-950 mt-auto">
        <div className="max-w-5xl mx-auto px-5 py-8 flex items-center justify-between gap-4 flex-wrap">
          <Logo size="xs" href="/" />
          <p className="text-xs text-gray-500 dark:text-gray-500">© 2026 대덕전자 · IT인프라그룹<br />담당자: 윤종민 프로</p>
        </div>
      </footer>
    </div>
  );
}
