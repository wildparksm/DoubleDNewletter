"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sparkles from "@/components/Sparkles";

const CATEGORIES = ["IT 트렌드", "AI", "보안", "개발·기술", "인프라", "기타"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "AI":  ["ai", "인공지능", "llm", "gpt", "머신러닝", "딥러닝", "챗봇", "생성형", "빅데이터", "claude", "gemini", "copilot", "에이전트", "자동화"],
  "보안":       ["보안", "해킹", "랜섬웨어", "취약점", "사이버", "악성코드", "피싱", "침해", "개인정보", "암호화", "제로데이"],
  "개발·기술":  ["개발", "프로그래밍", "코드", "소프트웨어", "개발자", "오픈소스", "api", "프레임워크", "깃허브", "쿠버네티스", "도커"],
  "인프라":     ["클라우드", "서버", "네트워크", "인프라", "aws", "azure", "gcp", "데이터센터", "엣지", "온프레미스", "스토리지", "가상화"],
};

/**
 * 응답 본문을 안전하게 JSON으로 파싱한다.
 * 서버가 JSON이 아닌 응답(404/500 HTML 에러 페이지 등)을 돌려줘도
 * JSON.parse 예외 대신 상태코드 기반의 에러 객체를 반환한다.
 */
interface GenerateResult {
  id?: number;
  error?: string;
  crawlFailed?: boolean;
  url?: string;
  [key: string]: unknown;
}

async function parseJsonSafe(res: Response): Promise<GenerateResult> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      error: `서버 오류 (HTTP ${res.status}). 응답을 처리할 수 없습니다.`,
    };
  }
}

function detectCategory(title: string, summary: string): string {
  const text = (title + " " + summary).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "IT 트렌드";
}

interface Source { id: number; name: string; url: string; article_count: number; }
interface Article {
  id: number; source_name: string; title: string; url: string;
  summary: string; image_url: string | null; pub_date: string; status: string;
}

interface SuggestedGroup { ids: number[]; title: string; reason: string; }

const GROUP_PALETTE = [
  { border: "border-l-blue-400",   bg: "bg-blue-50",   badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-400"   },
  { border: "border-l-emerald-400",bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  { border: "border-l-orange-400", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
  { border: "border-l-violet-400", bg: "bg-violet-50", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  { border: "border-l-rose-400",   bg: "bg-rose-50",   badge: "bg-rose-100 text-rose-700",   dot: "bg-rose-400"   },
];

const SOURCE_COLORS = [
  "text-blue-600 bg-blue-50",
  "text-violet-600 bg-violet-50",
  "text-emerald-600 bg-emerald-50",
  "text-orange-600 bg-orange-50",
  "text-pink-600 bg-pink-50",
  "text-teal-600 bg-teal-50",
  "text-amber-600 bg-amber-50",
  "text-indigo-600 bg-indigo-50",
  "text-rose-600 bg-rose-50",
  "text-cyan-600 bg-cyan-50",
];

function getSourceColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d.slice(0, 10);
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function RssClient() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [tab, setTab] = useState<"new" | "skipped" | "used">("new");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [perSource, setPerSource] = useState(10);
  const [displayLimit, setDisplayLimit] = useState(30);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Record<number, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());

  // 멀티 선택 상태
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [multiCategory, setMultiCategory] = useState("IT 트렌드");
  const [multiGenerating, setMultiGenerating] = useState(false);

  // AI 합성 추천
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/rss/sources");
    const data = await res.json();
    const loaded: Source[] = data.sources ?? [];
    setSources(loaded);
    setSelectedSourceIds((prev) => {
      if (prev.size === 0) return new Set(loaded.map((s) => s.id));
      return prev;
    });
  }, []);

  const loadArticles = useCallback(async (status: string, limit = displayLimit) => {
    const res = await fetch(`/api/rss/articles?status=${status}&limit=${limit}`);
    const data = await res.json();
    const fetched: Article[] = data.articles ?? [];
    setArticles(fetched);
    setCheckedIds(new Set());
    setSuggestedGroups([]); // 탭 전환 시 추천 초기화
    setSelectedCategory((prev) => {
      const next = { ...prev };
      for (const a of fetched) {
        if (!next[a.id]) next[a.id] = detectCategory(a.title, a.summary ?? "");
      }
      return next;
    });
  }, [displayLimit]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadArticles(tab, displayLimit); }, [tab, loadArticles, displayLimit]);

  function toggleCheck(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === articles.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(articles.map((a) => a.id)));
    }
  }

  async function addSource() {
    if (!newName || !newUrl) return;
    const res = await fetch("/api/rss/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, url: newUrl }),
    });
    if (res.ok) {
      setNewName(""); setNewUrl(""); setShowAddForm(false);
      loadSources();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  async function deleteSource(id: number) {
    if (!confirm("삭제하면 해당 소스의 기사도 모두 삭제됩니다.")) return;
    await fetch(`/api/rss/sources/${id}`, { method: "DELETE" });
    loadSources();
    loadArticles(tab);
  }

  function toggleSource(id: number) {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllSources() {
    setSelectedSourceIds((prev) =>
      prev.size === sources.length ? new Set() : new Set(sources.map((s) => s.id))
    );
  }

  async function fetchArticles() {
    if (selectedSourceIds.size === 0) { setFetchMsg("소스를 하나 이상 선택하세요."); return; }
    setFetching(true); setFetchMsg("");
    const res = await fetch("/api/rss/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perSource, sourceIds: Array.from(selectedSourceIds) }),
    });
    const data = await res.json();
    setFetchMsg(data.message ?? data.error);
    setFetching(false);
    loadArticles(tab);
  }

  async function skipArticle(id: number) {
    await fetch(`/api/rss/articles/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setCheckedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function restoreArticle(id: number) {
    await fetch(`/api/rss/articles/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new" }),
    });
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  async function deleteArticle(id: number) {
    await fetch(`/api/rss/articles/${id}`, { method: "DELETE" });
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setCheckedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function deleteAllByStatus(status: string) {
    if (!confirm(`"${status === "new" ? "새 기사" : status === "skipped" ? "건너뜀" : "사용됨"}" 기사를 전체 삭제할까요?`)) return;
    await fetch(`/api/rss/articles?status=${status}`, { method: "DELETE" });
    setArticles([]);
    setCheckedIds(new Set());
  }

  async function suggestGroups() {
    setAnalyzing(true);
    setSuggestedGroups([]);
    try {
      const res = await fetch("/api/rss/suggest-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: articles.map(a => a.id) }),
      });
      const data = await res.json();
      setSuggestedGroups(data.groups ?? []);
    } catch {
      alert("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  function selectGroup(groupIdx: number) {
    const ids = suggestedGroups[groupIdx]?.ids ?? [];
    const allChecked = ids.every(id => checkedIds.has(id));
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allChecked) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
    // 그룹에 해당 카테고리 자동 설정
    const cat = multiCategory;
    setSelectedCategory(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (!next[id]) next[id] = cat; });
      return next;
    });
  }

  function getArticleGroup(id: number): { index: number; palette: typeof GROUP_PALETTE[0] } | null {
    const idx = suggestedGroups.findIndex(g => g.ids.includes(id));
    if (idx === -1) return null;
    return { index: idx, palette: GROUP_PALETTE[idx % GROUP_PALETTE.length] };
  }

  // 단일 기사 생성
  async function generateNewsletter(article: Article) {
    setGeneratingId(article.id);
    const category = selectedCategory[article.id] ?? "IT 트렌드";
    try {
      const res = await fetch(`/api/rss/articles/${article.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        router.push(`/admin/newsletters/${data.id}/edit`);
      } else if (data.crawlFailed) {
        const go = confirm(`⚠️ 기사 본문을 가져오지 못했습니다.\n\n${data.error}\n\n원문을 열어볼까요?`);
        if (go) window.open(data.url || article.url, "_blank");
      } else {
        alert(data.error ?? "생성에 실패했습니다.");
      }
    } catch (e) {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      console.error("[generateNewsletter]", e);
    } finally {
      setGeneratingId(null);
    }
  }

  // 멀티 기사 합성 생성
  async function generateMulti() {
    if (checkedIds.size < 2) { alert("기사를 2개 이상 선택하세요."); return; }
    if (checkedIds.size > 5) { alert("기사는 최대 5개까지 선택할 수 있습니다."); return; }
    setMultiGenerating(true);
    try {
      const res = await fetch("/api/rss/articles/generate-multi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds), category: multiCategory }),
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        router.push(`/admin/newsletters/${data.id}/edit`);
      } else if (data.crawlFailed) {
        alert(`⚠️ 크롤 실패\n\n${data.error}`);
      } else {
        alert(data.error ?? "생성에 실패했습니다.");
      }
    } catch (e) {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      console.error("[generateMulti]", e);
    } finally {
      setMultiGenerating(false);
    }
  }

  const checkedCount = checkedIds.size;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

      {/* ── 왼쪽: RSS 소스 관리 ── */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm">RSS 소스</h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs bg-[#0d1b8e] text-white px-2.5 py-1 rounded-lg hover:bg-[#1a2fa8]"
            >
              + 추가
            </button>
          </div>

          {/* 전체 선택 토글 */}
          {sources.length > 0 && (
            <button
              onClick={toggleAllSources}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                selectedSourceIds.size === sources.length
                  ? "bg-[#0d1b8e] border-[#0d1b8e]"
                  : selectedSourceIds.size > 0
                    ? "bg-blue-100 border-[#0d1b8e]"
                    : "border-gray-300"
              }`}>
                {selectedSourceIds.size === sources.length && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="white"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                )}
                {selectedSourceIds.size > 0 && selectedSourceIds.size < sources.length && (
                  <span className="w-1.5 h-0.5 bg-[#0d1b8e] block" />
                )}
              </span>
              {selectedSourceIds.size === sources.length ? "전체 해제" : `전체 선택 (${selectedSourceIds.size}/${sources.length})`}
            </button>
          )}

          {showAddForm && (
            <div className="mb-3 space-y-2 p-3 bg-gray-50 rounded-lg">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 (예: AI타임스)"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="RSS URL"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={addSource} className="w-full bg-[#0d1b8e] text-white py-1.5 rounded-lg text-sm font-medium">등록</button>
            </div>
          )}

          <div className="space-y-2">
            {sources.length === 0 && <p className="text-xs text-gray-400 text-center py-4">등록된 소스가 없습니다</p>}
            {sources.map((src) => {
              const isSelected = selectedSourceIds.has(src.id);
              return (
                <div
                  key={src.id}
                  className={`flex items-start gap-2 py-2 border-b border-gray-50 last:border-0 cursor-pointer group ${isSelected ? "" : "opacity-50"}`}
                  onClick={() => toggleSource(src.id)}
                >
                  {/* 체크박스 */}
                  <span className={`mt-0.5 w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    isSelected ? "bg-[#0d1b8e] border-[#0d1b8e]" : "border-gray-300 group-hover:border-gray-400"
                  }`}>
                    {isSelected && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{src.name}</p>
                    <p className="text-xs text-gray-400 truncate">{src.url}</p>
                    <p className="text-xs text-blue-500">{src.article_count}개 기사</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSource(src.id); }}
                    className="text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 overflow-hidden">
            {/* 소스당 기사 수 */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">소스당 기사 수</p>
              <div className="flex items-center gap-1.5">
                {[5, 10, 20].map(v => (
                  <button key={v} onClick={() => setPerSource(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      perSource === v
                        ? "bg-[#0d1b8e] text-white shadow-sm"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}>
                    {v}
                  </button>
                ))}
                <input type="number" min={1} max={100} value={perSource}
                  onChange={(e) => setPerSource(Number(e.target.value))}
                  className="w-12 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs text-center text-gray-600 focus:outline-none focus:border-[#0d1b8e]" />
              </div>
            </div>
            {/* 목록 표시 개수 */}
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">목록 표시 개수</p>
              <div className="flex items-center gap-1.5">
                {[20, 30, 50].map(v => (
                  <button key={v} onClick={() => setDisplayLimit(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      displayLimit === v
                        ? "bg-[#0d1b8e] text-white shadow-sm"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}>
                    {v}
                  </button>
                ))}
                <input type="number" min={10} max={200} value={displayLimit}
                  onChange={(e) => setDisplayLimit(Number(e.target.value))}
                  className="w-12 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs text-center text-gray-600 focus:outline-none focus:border-[#0d1b8e]" />
              </div>
            </div>
          </div>

          <button onClick={fetchArticles} disabled={fetching || selectedSourceIds.size === 0}
            suppressHydrationWarning
            className="mt-3 w-full bg-[#0d1b8e] hover:bg-[#0a1570] disabled:bg-[#0d1b8e]/40 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            {fetching ? (
              <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>가져오는 중...</>
            ) : (
              selectedSourceIds.size === sources.length || sources.length === 0
                ? "새 기사 가져오기"
                : `새 기사 가져오기 (${selectedSourceIds.size}개 소스)`
            )}
          </button>
          {fetchMsg && <p className="text-xs text-center text-gray-500 mt-2">{fetchMsg}</p>}

        </div>
      </div>

      {/* ── 오른쪽: 기사 수신함 ── */}
      <div className="lg:col-span-3">
        {/* 탭 + AI 추천 + 전체 삭제 */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex gap-1">
            {(["new", "skipped", "used"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                }`}>
                {t === "new" ? "새 기사" : t === "skipped" ? "건너뜀" : "사용됨"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {tab === "new" && articles.length >= 2 && (
              <button onClick={suggestGroups} disabled={analyzing}
                className="relative overflow-hidden flex items-center gap-1.5 text-xs bg-gradient-to-r from-[#0d1b8e] to-[#00a3ff] hover:from-[#0a1570] hover:to-[#0090e0] text-white px-3 py-1.5 rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-100 disabled:opacity-60 shadow-sm shadow-[#0d1b8e]/30">
                {!analyzing && <Sparkles />}
                {analyzing ? (
                  <span className="relative z-10 flex items-center gap-1.5"><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>분석 중...</span>
                ) : (
                  <span className="relative z-10 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z"/></svg> AI 합성 추천</span>
                )}
              </button>
            )}
            {articles.length > 0 && (
              <button onClick={() => deleteAllByStatus(tab)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
                전체 삭제
              </button>
            )}
          </div>
        </div>

        {/* AI 추천 그룹 요약 */}
        {suggestedGroups.length > 0 && (
          <div className="mb-4 rounded-xl border border-[#0d1b8e]/20 bg-[#0d1b8e]/5 p-4">
            <p className="text-xs font-bold text-[#0d1b8e] dark:text-blue-400 mb-3">AI가 {suggestedGroups.length}개의 합성 추천 그룹을 발견했습니다 — 뱃지를 클릭하면 그룹 기사가 자동 선택됩니다</p>
            <div className="flex flex-col gap-2">
              {suggestedGroups.map((g, i) => {
                const p = GROUP_PALETTE[i % GROUP_PALETTE.length];
                const allChecked = g.ids.every(id => checkedIds.has(id));
                return (
                  <button key={i} onClick={() => selectGroup(i)}
                    className={`flex items-start gap-2.5 text-left px-3 py-2 rounded-lg border transition-all ${
                      allChecked ? "border-gray-400 bg-white shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                    <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${p.dot}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-snug">{g.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{g.reason} · {g.ids.length}개 기사</p>
                    </div>
                    {allChecked && <span className="ml-auto flex-shrink-0 text-[10px] text-gray-500 font-medium">선택됨 ✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 멀티 선택 합성 바 (new 탭 + 1개 이상 선택 시) ── */}
        {tab === "new" && articles.length > 0 && (
          <div className={`mb-4 rounded-xl border transition-all overflow-hidden ${
            checkedCount > 0 ? "border-[#0d1b8e]/30 bg-[#0d1b8e]/5 shadow-sm" : "border-gray-100 bg-gray-50"
          }`}>
            <div className="flex items-center gap-3 px-4 py-3">
              {/* 전체 선택 */}
              <input type="checkbox" checked={checkedCount === articles.length && articles.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 accent-[#0d1b8e] cursor-pointer flex-shrink-0" />
              <span className="text-sm text-gray-600 flex-1">
                {checkedCount === 0
                  ? <span className="text-gray-400">기사를 2~5개 선택하면 합성 생성할 수 있습니다</span>
                  : <span className="font-semibold text-[#0d1b8e]">{checkedCount}개 선택됨</span>
                }
              </span>

              {checkedCount >= 2 && (
                <>
                  <select value={multiCategory} onChange={(e) => setMultiCategory(e.target.value)}
                    className="border border-[#0d1b8e]/40 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <button onClick={generateMulti} disabled={multiGenerating}
                    className="relative overflow-hidden bg-gradient-to-r from-[#0d1b8e] to-[#00a3ff] hover:from-[#0a1570] hover:to-[#0090e0] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 whitespace-nowrap shadow-sm shadow-[#0d1b8e]/30">
                    {!multiGenerating && <Sparkles />}
                    {multiGenerating ? (
                      <span className="relative z-10 flex items-center gap-2"><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>합성 중...</span>
                    ) : <span className="relative z-10">합성 생성</span>}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 기사 목록 */}
        {articles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 text-center py-20 text-gray-400">
            <p className="text-sm">
              {tab === "new" ? "새 기사가 없습니다. RSS 소스를 추가하고 기사를 가져오세요." : "기사가 없습니다."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              const isChecked = checkedIds.has(article.id);
              const group = tab === "new" ? getArticleGroup(article.id) : null;
              return (
                <div key={article.id}
                  className={`bg-white rounded-xl border shadow-sm p-4 transition-all border-l-4 ${
                    isChecked
                      ? "border-[#0d1b8e]/30 ring-1 ring-[#0d1b8e]/20 border-l-[#0d1b8e]"
                      : group
                        ? `border-gray-100 hover:border-gray-200 ${group.palette.border}`
                        : "border-gray-100 hover:border-gray-200 border-l-transparent"
                  }`}>
                  <div className="flex items-start gap-3">
                    {/* 체크박스 (new 탭만) */}
                    {tab === "new" && (
                      <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(article.id)}
                        className="w-4 h-4 mt-1 rounded border-gray-300 accent-[#0d1b8e] cursor-pointer flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0 flex gap-3">
                      {/* 썸네일 */}
                      {article.image_url && (
                        <div className="w-20 h-16 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                          <img src={article.image_url} alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).closest("div")!.style.display = "none"; }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSourceColor(article.source_name)}`}>{article.source_name}</span>
                          <span className="text-xs text-gray-400">{formatDate(article.pub_date)}</span>
                          {group && (
                            <button onClick={() => selectGroup(group.index)}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${group.palette.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${group.palette.dot}`} />
                              그룹 {group.index + 1}
                            </button>
                          )}
                        </div>
                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-gray-800 hover:text-[#0d1b8e] transition-colors line-clamp-2 block mb-1">
                          {article.title}
                        </a>
                        {article.summary && <p className="text-sm text-gray-500 line-clamp-2">{article.summary}</p>}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    {tab === "new" && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <div className="relative">
                          <select
                            value={selectedCategory[article.id] ?? detectCategory(article.title, article.summary ?? "")}
                            onChange={(e) => setSelectedCategory((prev) => ({ ...prev, [article.id]: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 w-full">
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                          <span className="absolute -top-2 -right-1 text-[9px] bg-emerald-100 text-emerald-600 px-1 rounded-full">자동</span>
                        </div>
                        <button onClick={() => generateNewsletter(article)} disabled={generatingId === article.id || multiGenerating}
                          className="bg-[#0d1b8e] hover:bg-[#1a2fa8] disabled:bg-blue-300 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap">
                          {generatingId === article.id ? (
                            <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>생성 중</>
                          ) : "생성"}
                        </button>
                        <button onClick={() => skipArticle(article.id)} className="text-xs text-gray-400 hover:text-gray-600 py-1">건너뜀</button>
                      </div>
                    )}

                    {tab === "skipped" && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button onClick={() => restoreArticle(article.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg">복원</button>
                        <button onClick={() => deleteArticle(article.id)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">삭제</button>
                      </div>
                    )}

                    {tab === "used" && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <select
                          value={selectedCategory[article.id] ?? detectCategory(article.title, article.summary ?? "")}
                          onChange={(e) => setSelectedCategory((prev) => ({ ...prev, [article.id]: e.target.value }))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 w-full">
                          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <button onClick={() => generateNewsletter(article)} disabled={generatingId === article.id}
                          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap">
                          {generatingId === article.id ? (
                            <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>생성 중</>
                          ) : "재생성"}
                        </button>
                        <button onClick={() => deleteArticle(article.id)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">삭제</button>
                      </div>
                    )}

                    {tab === "new" && (
                      <button onClick={() => deleteArticle(article.id)} className="text-xs text-gray-300 hover:text-red-400 mt-1" title="삭제">×</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
