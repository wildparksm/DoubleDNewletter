"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageHeader, { HeaderStat } from "@/components/PageHeader";
import { IconPlus } from "@/components/Icon";

interface Newsletter {
  id: number;
  title: string;
  cover_image: string | null;
  category: string;
  published_at: string;
  created_at: string;
  status: string;
}

interface Collection {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  author_name: string;
  article_count: number;
  created_at: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCover, setFormCover] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCollections = useCallback(async () => {
    const res = await fetch("/api/collections");
    const data = await res.json();
    setCollections(data.collections || []);
  }, []);

  const fetchNewsletters = useCallback(async () => {
    const res = await fetch("/api/newsletters?public=true");
    const data = await res.json();
    setNewsletters(data.newsletters || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchCollections(), fetchNewsletters()]).finally(() => setLoading(false));
  }, [fetchCollections, fetchNewsletters]);

  function resetForm() {
    setFormTitle("");
    setFormDesc("");
    setFormCover("");
    setSelectedIds([]);
    setError("");
    setEditId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  async function openEdit(col: Collection) {
    resetForm();
    setEditId(col.id);
    setFormTitle(col.title);
    setFormDesc(col.description || "");
    setFormCover(col.cover_image || "");
    // fetch articles for this collection
    const res = await fetch(`/api/collections/${col.id}`);
    const data = await res.json();
    setSelectedIds((data.articles || []).map((a: { id: number }) => a.id));
    setShowForm(true);
  }

  function toggleArticle(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setSelectedIds(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setSelectedIds(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) { setError("제목을 입력해주세요."); return; }
    setSaving(true);
    setError("");

    const body = {
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      cover_image: formCover.trim() || null,
      article_ids: selectedIds,
    };

    const res = editId
      ? await fetch(`/api/collections/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "저장 중 오류가 발생했습니다.");
      setSaving(false);
      return;
    }

    await fetchCollections();
    setShowForm(false);
    resetForm();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 컬렉션을 삭제하시겠습니까?")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    await fetchCollections();
  }

  // Get newsletter objects for selected IDs in order
  const nlMap = Object.fromEntries(newsletters.map(n => [n.id, n]));
  const selectedNewsletters = selectedIds.map(id => nlMap[id]).filter(Boolean);
  const unselectedNewsletters = newsletters.filter(n => !selectedIds.includes(n.id));

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 dark:text-gray-500 text-sm">로딩 중...</p>
      </main>
    );
  }

  const totalArticles = collections.reduce((s, c) => s + (c.article_count || 0), 0);

  return (
    <main className="p-6 lg:p-8 space-y-6">
        <PageHeader
          eyebrow="Collections"
          title="컬렉션 관리"
          subtitle="아티클을 묶어 큐레이션 컬렉션을 만들어보세요."
          meta={
            <>
              <HeaderStat label="컬렉션" value={collections.length} />
              <HeaderStat label="포함된 아티클" value={totalArticles} />
            </>
          }
          actions={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 bg-[#0d1b8e] text-white hover:bg-[#0a1570] px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-[#0d1b8e]/30 transition-colors"
            >
              <IconPlus size={16} /> 새 컬렉션
            </button>
          }
        />

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  {editId ? "컬렉션 수정" : "새 컬렉션 만들기"}
                </h2>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="컬렉션 제목"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">설명</label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="컬렉션 설명 (선택)"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">커버 이미지 URL</label>
                  <input
                    value={formCover}
                    onChange={e => setFormCover(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-all"
                  />
                </div>

                {/* Article selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    아티클 선택
                    {selectedIds.length > 0 && (
                      <span className="ml-2 text-[#0d1b8e] font-normal text-xs">{selectedIds.length}개 선택됨</span>
                    )}
                  </label>

                  {/* Selected articles with ordering */}
                  {selectedNewsletters.length > 0 && (
                    <div className="mb-3 border border-[#0d1b8e]/20 rounded-lg overflow-hidden bg-blue-50/30">
                      <div className="px-3 py-2 border-b border-[#0d1b8e]/10 text-xs font-semibold text-[#0d1b8e]">
                        선택된 아티클 (드래그하거나 ↑↓ 버튼으로 순서 변경)
                      </div>
                      <div className="divide-y divide-blue-100">
                        {selectedNewsletters.map((nl, idx) => (
                          <div key={nl.id} className="flex items-center gap-2 px-3 py-2.5">
                            <span className="text-xs text-gray-400 tabular-nums w-5 text-center flex-shrink-0">{idx + 1}</span>
                            <span className="flex-1 text-sm text-gray-800 truncate">{nl.title}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-[#0d1b8e] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveDown(idx)}
                                disabled={idx === selectedNewsletters.length - 1}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-[#0d1b8e] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleArticle(nl.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-white transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unselected articles */}
                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {unselectedNewsletters.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">추가할 아티클이 없습니다.</p>
                    ) : (
                      unselectedNewsletters.map(nl => (
                        <label
                          key={nl.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleArticle(nl.id)}
                            className="w-4 h-4 rounded border-gray-300 accent-[#0d1b8e] cursor-pointer flex-shrink-0"
                          />
                          <span className="flex-1 text-sm text-gray-700 truncate">{nl.title}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(nl.published_at || nl.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#0d1b8e] hover:bg-[#1a2fa8] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    {saving ? "저장 중..." : editId ? "수정 완료" : "컬렉션 만들기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {collections.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-gray-400 dark:text-gray-500">아직 생성된 컬렉션이 없습니다.</p>
              <button
                onClick={openCreate}
                className="mt-4 text-sm text-[#0d1b8e] dark:text-blue-400 hover:underline font-medium"
              >
                첫 번째 컬렉션 만들기 →
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">제목</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">아티클 수</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">작성자</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">생성일</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70">
                {collections.map(col => (
                  <tr key={col.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          href={`/collections/${col.id}`}
                          target="_blank"
                          className="font-medium text-gray-800 dark:text-gray-100 hover:text-[#0d1b8e] dark:hover:text-purple-300 transition-colors"
                        >
                          {col.title}
                        </Link>
                        {col.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">{col.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {col.article_count}개
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{col.author_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{formatDate(col.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(col)}
                          className="text-xs text-gray-500 dark:text-gray-300 hover:text-[#0d1b8e] dark:hover:text-purple-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(col.id)}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </main>
  );
}
