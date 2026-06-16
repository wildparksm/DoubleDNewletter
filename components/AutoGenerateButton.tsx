"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sparkles from "@/components/Sparkles";

const CATEGORIES = [
  "IT 트렌드",
  "AI",
  "보안",
  "개발·기술",
  "인프라",
  "기타",
];

export default function AutoGenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("IT 트렌드");
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "생성에 실패했습니다.");
        return;
      }

      // 생성된 초안 편집 페이지로 이동
      router.push(`/admin/newsletters/${data.id}/edit`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* 버튼 */}
      <button
        onClick={() => setShowPanel((v) => !v)}
        className="relative overflow-hidden flex items-center gap-2 bg-gradient-to-r from-[#0d1b8e] to-[#00a3ff] hover:from-[#0a1570] hover:to-[#0090e0] text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-100 shadow-sm shadow-[#0d1b8e]/30"
      >
        <Sparkles />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="relative z-10"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z"/></svg>
        <span className="relative z-10">AI 자동 생성</span>
      </button>

      {/* 드롭다운 패널 */}
      {showPanel && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-5 z-50">
          <p className="text-sm font-semibold text-gray-700 mb-1">RSS → AI 뉴스레터 초안 생성</p>
          <p className="text-xs text-gray-400 mb-4">
            Tavily로 실제 최신 기사를 검색하고, Groq AI가 뉴스레터 형식으로 작성합니다.
          </p>

          {/* 카테고리 선택 */}
          <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 mb-4 focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* 에러 */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="relative overflow-hidden w-full bg-gradient-to-r from-[#0d1b8e] to-[#00a3ff] hover:from-[#0a1570] hover:to-[#0090e0] disabled:opacity-50 text-white py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {!loading && <Sparkles />}
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>생성 중... (30~60초 소요)</span>
              </>
            ) : (
              <span className="relative z-10 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z"/></svg>
                초안 생성하기
              </span>
            )}
          </button>

          <button
            onClick={() => setShowPanel(false)}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
