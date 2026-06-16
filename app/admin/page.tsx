import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import getDb from "@/lib/db";
import StatsCharts from "@/components/StatsCharts";
import CountUp from "@/components/CountUp";
import Sparkline from "@/components/Sparkline";
import Link from "next/link";
import {
  IconNewsletter,
  IconUsersGroup,
  IconSend,
  IconMail,
  IconArrowRight,
  IconPlus,
  IconBell,
  IconRss,
  IconSparkle,
  IconTrend,
} from "@/components/Icon";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

interface CategoryRow { category: string; n: number; }
interface RecentNewsletter {
  id: number; title: string; status: string; author_name: string;
  created_at: string; published_at: string; category: string | null;
}
interface RssArticle { id: number; title: string; source_name: string; pub_date: string | null; created_at: string; }

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const db = getDb();

  const nlStats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
    FROM newsletters
  `).get() as { total: number; published: number; draft: number };

  const subStats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN unsubscribed_at IS NULL THEN 1 ELSE 0 END) as active
    FROM subscribers
  `).get() as { total: number; active: number };

  const sendStats = db.prepare(`
    SELECT COUNT(*) as total_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened
    FROM email_sends
  `).get() as { total_sent: number; total_opened: number };

  const openRate = sendStats.total_sent > 0
    ? Math.round((sendStats.total_opened / sendStats.total_sent) * 100) : 0;

  // ── 주간 시계열(최근 8주) — 실제 데이터 기반 스파크라인 ──
  const WEEKS = 8;
  function weekly(dateCol: string, table: string, extra = ""): number[] {
    const rows = db.prepare(`
      SELECT CAST((julianday('now') - julianday(${dateCol})) / 7 AS INTEGER) AS wago, COUNT(*) AS n
      FROM ${table}
      WHERE ${dateCol} IS NOT NULL ${extra}
      GROUP BY wago
    `).all() as { wago: number; n: number }[];
    const arr = new Array(WEEKS).fill(0);
    for (const r of rows) if (r.wago >= 0 && r.wago < WEEKS) arr[r.wago] = r.n;
    return arr.reverse(); // [0]=가장 과거, [끝]=이번 주
  }
  function pctDelta(s: number[]): number {
    const cur = s[s.length - 1] ?? 0;
    const prev = s[s.length - 2] ?? 0;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  const nlSeries = weekly("created_at", "newsletters");
  const subSeries = weekly("subscribed_at", "subscribers", "AND unsubscribed_at IS NULL");
  const sendSeries = weekly("sent_at", "email_sends");
  // 주간 열람률 시계열
  const orRows = db.prepare(`
    SELECT CAST((julianday('now') - julianday(sent_at)) / 7 AS INTEGER) AS wago,
      COUNT(*) AS sent, SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened
    FROM email_sends WHERE sent_at IS NOT NULL GROUP BY wago
  `).all() as { wago: number; sent: number; opened: number }[];
  const sentArr = new Array(WEEKS).fill(0), openArr = new Array(WEEKS).fill(0);
  for (const r of orRows) if (r.wago >= 0 && r.wago < WEEKS) { sentArr[r.wago] = r.sent; openArr[r.wago] = r.opened; }
  const orSeries = sentArr.map((s, i) => (s > 0 ? Math.round((openArr[i] / s) * 100) : 0)).reverse();

  const recentNewsletters = db.prepare(`
    SELECT n.*, u.name as author_name FROM newsletters n
    LEFT JOIN users u ON n.author_id = u.id
    ORDER BY n.created_at DESC LIMIT 5
  `).all() as RecentNewsletter[];

  const categoryRows = db.prepare(`
    SELECT COALESCE(category, '일반') as category, COUNT(*) as n
    FROM newsletters WHERE status = 'published'
    GROUP BY category ORDER BY n DESC
  `).all() as CategoryRow[];
  const categoryTotal = categoryRows.reduce((s, r) => s + r.n, 0);

  const rssRecent = db.prepare(`
    SELECT id, title, source_name, pub_date, created_at FROM rss_articles
    WHERE status = 'new' ORDER BY COALESCE(pub_date, created_at) DESC LIMIT 3
  `).all() as RssArticle[];
  const rssNewTotal = (db.prepare("SELECT COUNT(*) as n FROM rss_articles WHERE status = 'new'").get() as { n: number }).n;

  const statCards = [
    { label: "전체 뉴스레터", value: nlStats.total, suffix: "", sub: `발행 ${nlStats.published} · 초안 ${nlStats.draft}`, Icon: IconNewsletter, series: nlSeries },
    { label: "활성 구독자", value: subStats.active, suffix: "", sub: `전체 ${subStats.total}명`, Icon: IconUsersGroup, series: subSeries },
    { label: "누적 발송", value: sendStats.total_sent, suffix: "", sub: `열람 ${sendStats.total_opened}건`, Icon: IconSend, series: sendSeries },
    { label: "평균 열람률", value: openRate, suffix: "%", sub: `총 ${sendStats.total_sent}건 기준`, Icon: IconMail, series: orSeries },
  ];

  // 네이비/블루 단일 계열 도넛 팔레트 (무지개 제거)
  const donutGrads: [string, string][] = [
    ["#0d1b8e", "#3b4fd0"], ["#3b82f6", "#60a5fa"], ["#00a3ff", "#38bdf8"],
    ["#1e3a8a", "#4f6ef7"], ["#0ea5e9", "#7dd3fc"], ["#4338ca", "#6366f1"],
  ];
  const avatarGrads = [
    "from-[#0d1b8e] to-[#3b82f6]", "from-[#1e3a8a] to-[#3b82f6]", "from-[#0ea5e9] to-[#3b82f6]",
    "from-[#0d1b8e] to-[#00a3ff]", "from-[#3b4fd0] to-[#6366f1]",
  ];
  const rssDots = ["#0d1b8e", "#3b82f6", "#00a3ff"];
  let donutCursor = 0;

  return (
    <main className="admin-stage p-6 lg:p-8 space-y-6">
      {/* 글래스 상단바 (제목 + 빠른 액션) */}
      <section className="rounded-2xl bg-white/80 dark:bg-gray-900/70 backdrop-blur-md border border-gray-200/70 dark:border-gray-800 shadow-sm px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0d1b8e] dark:text-blue-400 mb-1">관리자 대시보드</p>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">
            안녕하세요, {session.name}님
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            발행 {nlStats.published}건 · 구독자 {subStats.active}명 · RSS 신규 {rssNewTotal}건
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/rss"
            className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:text-[#0d1b8e] hover:border-[#0d1b8e]/40 dark:hover:text-blue-400 transition-colors"
            aria-label="알림 · RSS 수신함"
          >
            <IconBell size={18} />
            {rssNewTotal > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900" />
            )}
          </Link>
          <Link
            href="/admin/newsletters/new"
            className="inline-flex items-center gap-1.5 bg-[#0d1b8e] hover:bg-[#0a1570] text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-[#0d1b8e]/30 transition-colors"
          >
            <IconPlus size={16} />
            새 뉴스레터
          </Link>
        </div>
      </section>

      {/* KPI 통계 카드 (스파크라인 + 증감 + 카운트업) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.Icon;
          const d = pctDelta(card.series);
          const up = d > 0, down = d < 0;
          return (
            <div
              key={card.label}
              className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#0d1b8e]/8 text-[#0d1b8e] dark:bg-blue-500/15 dark:text-blue-400">
                  <Icon size={20} />
                </span>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  up ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : down ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                }`}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className={down ? "rotate-180" : ""}>
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                  {Math.abs(d)}%
                </span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-none">
                <CountUp value={card.value} suffix={card.suffix} />
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-1">{card.sub}</p>
              <div className="mt-2 -mx-1">
                <Sparkline data={card.series} gradId={`kpi-spark-${idx}`} color="#0d1b8e" height={30} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-100">발송 &amp; 열람 추이</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">최근 발행 기준</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0d1b8e] bg-[#0d1b8e]/8 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1 rounded-full">
              <IconTrend size={13} />
              실시간
            </span>
          </div>
          <StatsCharts />
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-bold text-gray-800 dark:text-gray-100">카테고리 분포</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">발행 기준</p>
          </div>

          {categoryTotal === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">발행된 뉴스레터가 없습니다.</p>
          ) : (
            <>
              <div className="relative w-40 h-40 mx-auto mb-5">
                <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90">
                  <defs>
                    {donutGrads.map(([a, b], i) => (
                      <linearGradient key={i} id={`cat-grad-${i}`}>
                        <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
                      </linearGradient>
                    ))}
                  </defs>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-100 dark:text-gray-800" />
                  {categoryRows.map((row, i) => {
                    const pct = (row.n / categoryTotal) * 100;
                    const dash = `${pct} ${100 - pct}`;
                    const offset = -donutCursor;
                    donutCursor += pct;
                    return (
                      <circle key={row.category} cx="18" cy="18" r="14" fill="none"
                        stroke={`url(#cat-grad-${i % donutGrads.length})`} strokeWidth="3.5"
                        strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{categoryTotal}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">전체 발행</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {categoryRows.slice(0, 5).map((row, i) => {
                  const [a, b] = donutGrads[i % donutGrads.length];
                  return (
                    <div key={row.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
                        <span className="text-gray-600 dark:text-gray-400 truncate">{row.category}</span>
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                        {Math.round((row.n / categoryTotal) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단: 최근 뉴스레터 + RSS 위젯 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-100">최근 뉴스레터</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">최근 작성된 5건</p>
            </div>
            <Link href="/admin/newsletters" className="inline-flex items-center gap-1 text-xs text-[#0d1b8e] dark:text-blue-400 hover:underline font-semibold">
              전체 보기 <IconArrowRight size={13} />
            </Link>
          </div>

          {recentNewsletters.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-10">아직 작성된 뉴스레터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <th className="text-left font-semibold px-6 py-3">제목</th>
                    <th className="text-left font-semibold px-3 py-3">카테고리</th>
                    <th className="text-left font-semibold px-3 py-3">작성자</th>
                    <th className="text-left font-semibold px-3 py-3">상태</th>
                    <th className="text-right font-semibold px-6 py-3">작성일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70">
                  {recentNewsletters.map((nl, i) => (
                    <tr key={nl.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrads[i % avatarGrads.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                            {Array.from(nl.title)[0] || "?"}
                          </span>
                          <Link href={`/admin/newsletters/${nl.id}/edit`} className="font-medium text-gray-800 dark:text-gray-100 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors block truncate max-w-[260px]">
                            {nl.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-500 dark:text-gray-400">{nl.category || "일반"}</td>
                      <td className="px-3 py-3.5 text-xs text-gray-500 dark:text-gray-400">{nl.author_name}</td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          nl.status === "published"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${nl.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {nl.status === "published" ? "발행됨" : "초안"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-400 dark:text-gray-500 text-right tabular-nums">{formatDate(nl.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RSS 미니 위젯 */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-[#0d1b8e]/10 to-[#00a3ff]/10 blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-100">RSS 수신함</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                신규 <span className="font-semibold text-rose-500">{rssNewTotal}</span>건
              </p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#0d1b8e] flex items-center justify-center shadow-sm shadow-[#0d1b8e]/30 text-white">
              <IconRss size={18} />
            </span>
          </div>

          <div className="relative space-y-2.5">
            {rssRecent.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">신규 기사가 없습니다.</p>
            ) : (
              rssRecent.map((a, i) => (
                <Link key={a.id} href="/admin/rss" className="block bg-gray-50/70 hover:bg-gray-100/70 dark:bg-gray-800/40 dark:hover:bg-gray-800/70 p-3 rounded-xl border border-gray-100 dark:border-gray-800 transition-colors">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug">{a.title}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: rssDots[i % rssDots.length] }} />
                    {a.source_name}
                  </p>
                </Link>
              ))
            )}
          </div>

          <Link href="/admin/rss" className="relative mt-4 inline-flex w-full items-center justify-center gap-1.5 bg-[#0d1b8e] hover:bg-[#0a1570] text-white py-2.5 rounded-xl text-xs font-semibold shadow-sm shadow-[#0d1b8e]/25 transition-colors">
            전체 수신함 보기 <IconArrowRight size={13} />
          </Link>

          <div className="relative mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#0d1b8e]/8 text-[#0d1b8e] dark:bg-blue-500/15 dark:text-blue-400">
              <IconSparkle size={12} />
            </span>
            AI 추천으로 새 글을 자동 큐레이션합니다.
          </div>
        </div>
      </div>
    </main>
  );
}
