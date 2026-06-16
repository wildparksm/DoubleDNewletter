import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import getDb from "@/lib/db";
import SubscriberActions from "./SubscriberActions";
import AddSubscriberForm from "./AddSubscriberForm";
import Link from "next/link";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import { IconSearch } from "@/components/Icon";

const PAGE_SIZE = 20;

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { page: pageStr, q = "", status: statusFilter = "all" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (q) {
    where += " AND (name LIKE ? OR email LIKE ? OR department LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (statusFilter === "active") {
    where += " AND unsubscribed_at IS NULL AND (confirmed_at IS NOT NULL OR confirm_token IS NULL)";
  } else if (statusFilter === "inactive") {
    where += " AND unsubscribed_at IS NOT NULL";
  } else if (statusFilter === "pending") {
    where += " AND confirm_token IS NOT NULL AND confirmed_at IS NULL";
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM subscribers ${where}`).get(...params) as { cnt: number };
  const total = totalRow.cnt;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const subscribers = db.prepare(
    `SELECT * FROM subscribers ${where} ORDER BY subscribed_at DESC LIMIT ? OFFSET ?`
  ).all(...params, PAGE_SIZE, offset) as {
    id: number; name: string; email: string; department: string; tags: string;
    subscribed_at: string; unsubscribed_at: string | null;
    confirm_token: string | null; confirmed_at: string | null;
  }[];

  const allStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN unsubscribed_at IS NULL AND (confirmed_at IS NOT NULL OR confirm_token IS NULL) THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN confirm_token IS NOT NULL AND confirmed_at IS NULL THEN 1 ELSE 0 END) as pending
    FROM subscribers
  `).get() as { total: number; active: number; inactive: number; pending: number };

  const sleepingCount = (db.prepare(`
    SELECT COUNT(DISTINCT s.id) as cnt
    FROM subscribers s
    WHERE s.unsubscribed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM email_sends es
        WHERE es.subscriber_id = s.id
          AND es.opened_at >= datetime('now', '-90 days')
      )
      AND EXISTS (
        SELECT 1 FROM email_sends es2
        WHERE es2.subscriber_id = s.id
      )
  `).get() as { cnt: number }).cnt;

  const buildUrl = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  function statusBadge(sub: { unsubscribed_at: string | null; confirm_token: string | null; confirmed_at: string | null }) {
    if (sub.unsubscribed_at) {
      return { dot: "bg-gray-400", text: "구독취소", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
    }
    if (sub.confirm_token && !sub.confirmed_at) {
      return { dot: "bg-amber-500", text: "미확인", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" };
    }
    return { dot: "bg-emerald-500", text: "구독중", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" };
  }

  return (
    <main className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Subscribers"
        title="구독자 관리"
        subtitle="구독자 풀과 상태를 한눈에 확인하세요."
        meta={
          <>
            <HeaderStat label="활성" value={allStats.active} />
            <HeaderStat label="미확인" value={allStats.pending} />
            <HeaderStat label="취소" value={allStats.inactive} />
            <HeaderStat label="전체" value={allStats.total} />
          </>
        }
      />

      {sleepingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 px-4 py-2.5 rounded-2xl text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span><span className="font-semibold">잠자는 구독자</span> {sleepingCount}명 — 90일 이상 미열람</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AddSubscriberForm />
        </div>

        <div className="lg:col-span-2 space-y-3">
          <form className="flex gap-2">
            <div className="flex items-center flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 focus-within:ring-2 focus-within:ring-[#0d1b8e]/20 focus-within:border-[#0d1b8e]/40 transition-all">
              <IconSearch size={14} />
              <input
                name="q"
                defaultValue={q}
                placeholder="이름, 이메일, 부서 검색..."
                className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none text-gray-800 dark:text-gray-100"
              />
            </div>
            <select
              name="status"
              defaultValue={statusFilter}
              className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl text-sm focus:outline-none text-gray-700 dark:text-gray-200"
            >
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="pending">미확인</option>
              <option value="inactive">취소됨</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0d1b8e] text-white rounded-xl text-sm font-semibold shadow-sm shadow-[#0d1b8e]/25 hover:opacity-95 transition-opacity"
            >
              검색
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            {subscribers.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                <p className="text-sm">검색 결과가 없습니다.</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">이름</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">이메일</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">부서</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">상태</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">구독일</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70">
                    {subscribers.map((sub) => {
                      const badge = statusBadge(sub);
                      return (
                        <tr key={sub.id} className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${sub.unsubscribed_at ? "opacity-60" : ""}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{sub.name}</span>
                              {sub.tags && sub.tags.split(",").filter(Boolean).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] rounded-full font-medium">{tag.trim()}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{sub.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{sub.department || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {badge.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{formatDate(sub.subscribed_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <SubscriberActions id={sub.id} isUnsubscribed={!!sub.unsubscribed_at} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{total}명 중 {offset + 1}–{Math.min(offset + PAGE_SIZE, total)}명</span>
                    <div className="flex gap-1">
                      {page > 1 && (
                        <Link href={buildUrl(page - 1)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">←</Link>
                      )}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                        return (
                          <Link
                            key={p}
                            href={buildUrl(p)}
                            className={`px-3 py-1.5 rounded-lg ${
                              p === page
                                ? "bg-[#0d1b8e] text-white shadow-sm shadow-[#0d1b8e]/25"
                                : "border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {p}
                          </Link>
                        );
                      })}
                      {page < totalPages && (
                        <Link href={buildUrl(page + 1)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">→</Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
