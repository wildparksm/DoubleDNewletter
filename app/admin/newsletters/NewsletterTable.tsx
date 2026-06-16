"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NewsletterActions from "./NewsletterActions";

const CAT_STYLE: Record<string, { bg: string; text: string }> = {
  "IT 트렌드": { bg: "bg-blue-50",    text: "text-blue-600" },
  "사내 소식":  { bg: "bg-sky-50",     text: "text-sky-600" },
  "개발·기술":  { bg: "bg-indigo-50",  text: "text-indigo-600" },
  "보안":       { bg: "bg-red-50",     text: "text-red-600" },
  "AI":         { bg: "bg-emerald-50", text: "text-emerald-600" },
  "인프라":     { bg: "bg-slate-100",  text: "text-slate-600" },
  "기타":       { bg: "bg-orange-50",  text: "text-orange-600" },
  "일반":       { bg: "bg-blue-50",    text: "text-[#0d1b8e]" },
};

function CategoryBadge({ cat }: { cat: string }) {
  const s = CAT_STYLE[cat] ?? CAT_STYLE["일반"];
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>
      {cat}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

interface Newsletter {
  id: number;
  title: string;
  status: string;
  author_name: string;
  category: string | null;
  created_at: string;
  published_at: string;
  send_count: number;
  open_count: number;
}

export default function NewsletterTable({ newsletters }: { newsletters: Newsletter[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const allCheckRef = useRef<HTMLInputElement>(null);

  const allChecked = checked.size === newsletters.length && newsletters.length > 0;
  const someChecked = checked.size > 0 && !allChecked;

  // indeterminate 상태는 DOM 직접 조작으로만 설정 가능
  useEffect(() => {
    if (allCheckRef.current) {
      allCheckRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(newsletters.map((n) => n.id)));
  }

  function toggleOne(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!confirm(`선택한 ${checked.size}개의 뉴스레터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    const res = await fetch("/api/newsletters/bulk-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(checked) }),
    });
    setDeleting(false);
    if (res.ok) {
      setChecked(new Set());
      router.refresh();
    } else {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  if (newsletters.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-sm">아직 작성된 뉴스레터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── 선택 액션 바 ── */}
      {checked.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50 border-b border-red-200">
          <span className="text-sm font-semibold text-red-700">
            {checked.size}개 선택됨
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChecked(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 bg-white transition-colors"
            >
              선택 해제
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              {deleting ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  삭제 중...
                </>
              ) : (
                <>{checked.size}개 삭제</>
              )}
            </button>
          </div>
        </div>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="pl-4 pr-2 py-3 w-10">
              <input
                ref={allCheckRef}
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 accent-[#0d1b8e] cursor-pointer"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">제목</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">카테고리</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">작성자</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">상태</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">발송/열람</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">날짜</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {newsletters.map((nl) => {
            const isChecked = checked.has(nl.id);
            return (
              <tr key={nl.id} className={`transition-colors ${isChecked ? "bg-red-50/60" : "hover:bg-gray-50"}`}>
                <td className="pl-4 pr-2 py-4">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(nl.id)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#0d1b8e] cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/newsletters/${nl.id}/edit`}
                    className="font-medium text-gray-800 hover:text-[#0d1b8e] transition-colors"
                  >
                    {nl.title}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <CategoryBadge cat={nl.category || "일반"} />
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">{nl.author_name}</td>
                <td className="px-4 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    nl.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {nl.status === "published" ? "발행됨" : "초안"}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {nl.send_count > 0 ? (
                    <span>
                      {nl.send_count}건 /{" "}
                      <span className="text-green-600">
                        {Math.round((nl.open_count / nl.send_count) * 100)}%
                      </span>
                    </span>
                  ) : "-"}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {formatDate(nl.published_at || nl.created_at)}
                </td>
                <td className="px-4 py-4 text-right">
                  <NewsletterActions id={nl.id} status={nl.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
