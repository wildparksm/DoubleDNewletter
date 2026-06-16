"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";

const NewsletterBuilder = dynamic(() => import("@/components/NewsletterBuilder"), { ssr: false });

const CATEGORIES = ["일반", "IT 트렌드", "사내 소식", "개발·기술", "보안", "AI", "인프라", "기타"];

interface NewsletterEditorProps {
  initialData?: {
    id?: number;
    title: string;
    summary: string;
    content: string;
    cover_image?: string;
    status: string;
    scheduled_at?: string;
    category?: string;
    tags?: string;
  };
  stats?: { sent: number; openRate: number };
  linkStats?: { short_code: string; original_url: string; click_count: number; unique_clicks: number }[];
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${on ? "bg-[#0d1b8e]" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function truncateUrl(url: string, max = 45) {
  return url.length > max ? url.slice(0, max) + "…" : url;
}

export default function NewsletterEditor({ initialData, stats, linkStats = [] }: NewsletterEditorProps) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const { confirm, confirmNode } = useConfirm();
  const [form, setForm] = useState({
    title: initialData?.title || "",
    summary: initialData?.summary || "",
    content: initialData?.content || "",
    cover_image: initialData?.cover_image || "",
    scheduled_at: initialData?.scheduled_at ? initialData.scheduled_at.slice(0, 16) : "",
    category: initialData?.category || "일반",
  });
  // 태그 (칩 형태)
  const [tagList, setTagList] = useState<string[]>(
    (initialData?.tags || "").split(",").map(t => t.trim()).filter(Boolean)
  );
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [tagSuggesting, setTagSuggesting] = useState(false);

  async function suggestTags() {
    if (tagSuggesting) return;
    setTagSuggesting(true);
    try {
      const res = await fetch("/api/ai/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, summary: form.summary, content: form.content }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("태그 추천 실패", data.error || ""); return; }
      const newTags: string[] = (data.tags as string[]).filter(t => !tagList.includes(t));
      if (newTags.length > 0) {
        setTagList(prev => [...prev, ...newTags]);
        setIsDirty(true);
      }
    } catch {
      toast.error("태그 추천 실패", "네트워크 오류");
    } finally {
      setTagSuggesting(false);
    }
  }

  function addTag(val: string) {
    const trimmed = val.trim().replace(/^#/, "");
    if (trimmed && !tagList.includes(trimmed)) {
      setTagList(prev => [...prev, trimmed]);
      setIsDirty(true);
    }
    setTagInput("");
  }
  function removeTag(tag: string) {
    setTagList(prev => prev.filter(t => t !== tag));
    setIsDirty(true);
  }

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<{ id: number; title: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Settings panel
  const [showCover, setShowCover] = useState(!!(initialData?.cover_image));
  const [showSchedule, setShowSchedule] = useState(!!initialData?.scheduled_at);
  const [showSegment, setShowSegment] = useState(false);
  const [segmentDept, setSegmentDept] = useState("");
  const [segmentTags, setSegmentTags] = useState("");

  // Cover image upload
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef(form.content);

  // 마운트 시 title textarea 높이를 콘텐츠에 맞게 초기화
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, []);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setIsDirty(true);
  };

  // Scroll shadow on sticky bar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ctrl+S
  const handleSaveRef = useRef<((publish: boolean) => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current?.(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-save 30s
  useEffect(() => {
    if (!initialData?.id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (form.content === lastSavedContent.current) return;
      await fetch(`/api/newsletters/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tags: tagList.join(", ") }),
      });
      lastSavedContent.current = form.content;
      setIsDirty(false);
      setSaveMsg({ text: "자동저장됨", ok: true });
      setTimeout(() => setSaveMsg(null), 2000);
    }, 30000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [form, initialData?.id, tagList]);

  const handleSave = useCallback(async (publish = false) => {
    if (!form.title) { setSaveMsg({ text: "제목을 입력해주세요", ok: false }); return; }
    setSaving(true);
    setSaveMsg(null);

    const isEdit = !!initialData?.id;
    const url = isEdit ? `/api/newsletters/${initialData.id}` : "/api/newsletters";
    const method = isEdit ? "PUT" : "POST";

    // 입력창에 Enter로 확정 안 한 태그가 남아 있으면 함께 저장
    const pending = tagInput.trim().replace(/^#/, "");
    const allTags = pending && !tagList.includes(pending) ? [...tagList, pending] : tagList;

    const body = {
      ...form,
      scheduled_at: showSchedule && form.scheduled_at ? form.scheduled_at : null,
      tags: allTags.join(", "),
    };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setSaveMsg({ text: "저장 실패", ok: false });
      setSaving(false);
      return;
    }

    const data = await res.json();
    const id = initialData?.id || data.id;

    if (publish) {
      await fetch(`/api/newsletters/${id}/publish`, { method: "POST" });
      setPublishSuccess({ id, title: form.title });
      setSaving(false);
      return;
    } else if (showSchedule && form.scheduled_at) {
      setSaveMsg({ text: "예약 완료!", ok: true });
    } else {
      setSaveMsg({ text: "저장됨", ok: true });
    }

    lastSavedContent.current = form.content;
    setIsDirty(false);
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);

    if (!isEdit) router.push(`/admin/newsletters/${id}/edit`);
    else router.refresh();
  }, [form, initialData?.id, showSchedule, router, tagList, tagInput]);

  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  async function handleSend() {
    if (!initialData?.id) {
      toast.warning("먼저 저장해주세요.", "뉴스레터를 저장한 후 발송할 수 있습니다.");
      return;
    }
    const tags = segmentTags.split(",").map((t) => t.trim()).filter(Boolean);
    const target = [segmentDept, tags.join(", ")].filter(Boolean).join(" / ") || "전체 구독자";
    const ok = await confirm(`"${target}"에게 이메일을 발송하시겠습니까?`, {
      title: "이메일 발송",
      confirmLabel: "발송하기",
    });
    if (!ok) return;

    setSending(true);
    const res = await fetch(`/api/newsletters/${initialData.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: segmentDept || undefined, tags: tags.length > 0 ? tags : undefined }),
    });
    const d = await res.json();
    setSending(false);
    if (res.ok) {
      toast.success(
        "발송 완료!",
        `대상 ${d.total}명 · 성공 ${d.sent}건 · 실패 ${d.failed}건`
      );
    } else {
      toast.error("발송 실패", "이메일 발송 중 오류가 발생했습니다.");
    }
    router.refresh();
  }

  async function handleCoverUpload(file: File) {
    setCoverUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    setCoverUploading(false);
    if (d.url) updateForm({ cover_image: d.url });
    else toast.error(d.error || "업로드 실패", "커버 이미지를 업로드할 수 없습니다.");
    if (coverFileRef.current) coverFileRef.current.value = "";
  }

  const isPublished = initialData?.status === "published";

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {toastNode}
      {confirmNode}

      {/* ── 발행 완료 팝업 ── */}
      {publishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 flex flex-col items-center gap-5 animate-in zoom-in-95 duration-300">
            {/* 체크 아이콘 */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* 텍스트 */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 mb-1">발행 완료!</p>
              <p className="text-sm text-gray-500 line-clamp-2 max-w-xs">
                &ldquo;{publishSuccess.title}&rdquo;이(가) 성공적으로 발행됐습니다.
              </p>
            </div>
            {/* 액션 버튼 */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setPublishSuccess(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                계속 편집
              </button>
              <button
                onClick={() => router.push(`/admin/newsletters`)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d1b8e] text-white text-sm font-semibold hover:bg-[#1a2fa8] transition-colors"
              >
                뉴스레터 보기 →
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Sticky Action Bar ── */}
      <div className={`sticky top-0 z-30 bg-white border-b transition-shadow ${scrolled ? "shadow-md border-gray-200" : "border-gray-100"}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            {/* 홈 로고 */}
            <Link href="/admin" className="flex-shrink-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity" title="어드민 홈으로 이동">
              <div className="w-6 h-6 bg-[#0d1b8e] rounded-md flex items-center justify-center">
                <span className="text-white font-black text-[9px] leading-none">it</span>
              </div>
            </Link>
            <span className="text-gray-200">|</span>
            <Link href="/admin/newsletters" className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </Link>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-700 truncate max-w-[200px]">
              {form.title || (initialData?.id ? "편집 중" : "새 뉴스레터")}
            </span>
            {/* Status badge */}
            <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              isPublished ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {isPublished ? "발행됨" : "초안"}
            </span>
            {isDirty && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" title="저장되지 않은 변경사항" />}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {saveMsg && (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                saveMsg.ok ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              }`}>
                {saveMsg.ok ? "✓" : "✕"} {saveMsg.text}
              </span>
            )}
            <span className="text-xs text-gray-300 hidden lg:block">Ctrl+S</span>

            <button
              onClick={() => router.push("/admin/newsletters")}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !form.title}
              className="px-4 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors"
            >
              {saving ? "저장 중…" : "임시저장"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !form.title}
              className="px-4 py-1.5 text-sm font-semibold bg-[#0d1b8e] hover:bg-[#1a2fa8] text-white disabled:opacity-40 rounded-lg transition-colors shadow-sm"
            >
              발행하기
            </button>
            {initialData?.id && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-white dark:bg-gray-900 border border-[#0d1b8e]/40 text-[#0d1b8e] dark:text-blue-400 hover:bg-[#0d1b8e]/5 disabled:opacity-40 rounded-lg transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {sending ? "발송 중…" : "발송"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full">

        {/* ── Main Editor Column ── */}
        <div className="flex-1 min-w-0 px-6 py-8">

          {/* Title */}
          <textarea
            ref={titleRef}
            value={form.title}
            onChange={(e) => {
              updateForm({ title: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="제목을 입력하세요"
            rows={1}
            className="w-full text-4xl font-black text-gray-900 bg-transparent border-none outline-none resize-none leading-tight mb-3 overflow-hidden placeholder:text-gray-300 placeholder:font-black"
          />

          {/* Summary */}
          <div className="flex items-start gap-2 mb-8">
            <span className="mt-[3px] w-0.5 h-4 bg-[#0d1b8e]/30 rounded-full flex-shrink-0" />
            <input
              type="text"
              value={form.summary}
              onChange={(e) => updateForm({ summary: e.target.value })}
              placeholder="한 줄 요약을 입력하세요 — 독자에게 가장 먼저 보이는 문장입니다"
              className="flex-1 text-base text-gray-500 bg-transparent border-none outline-none placeholder:text-gray-400 placeholder:italic"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-[10px] text-gray-300 font-medium tracking-widest uppercase">본문</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          {/* Editor */}
          <div className="flex flex-col gap-2">
            <NewsletterBuilder
              content={form.content}
              onChange={(content) => updateForm({ content })}
            />
          </div>
        </div>

        {/* ── Right Settings Panel ── */}
        <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-white px-5 py-8 space-y-6">

          {/* Cover Image */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">커버 이미지</h3>
              <Toggle on={showCover} onToggle={() => setShowCover((v) => !v)} />
            </div>
            {showCover && (
              <div className="space-y-2">
                {form.cover_image && (
                  <div className="relative rounded-xl overflow-hidden aspect-[16/9] bg-gray-100">
                    <img src={form.cover_image} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button
                      onClick={() => updateForm({ cover_image: "" })}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-xs"
                    >✕</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => coverFileRef.current?.click()}
                    disabled={coverUploading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 hover:border-[#0d1b8e] rounded-xl text-xs text-gray-400 hover:text-[#0d1b8e] transition-colors"
                  >
                    {coverUploading ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    )}
                    {coverUploading ? "업로드 중…" : "파일 업로드"}
                  </button>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
                  />
                </div>
                <input
                  type="url"
                  value={form.cover_image}
                  onChange={(e) => updateForm({ cover_image: e.target.value })}
                  placeholder="또는 이미지 URL 직접 입력"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] text-gray-600 placeholder:text-gray-300"
                />
              </div>
            )}
          </section>

          <div className="border-t border-gray-50" />

          {/* Schedule */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">발송 예약</h3>
              <Toggle on={showSchedule} onToggle={() => setShowSchedule((v) => !v)} />
            </div>
            {showSchedule && (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => updateForm({ scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e]"
                />
                {form.scheduled_at && (
                  <p className="text-xs text-[#0d1b8e] font-medium">
                    {new Date(form.scheduled_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} 발송 예정
                  </p>
                )}
                <p className="text-xs text-gray-400">발행 상태일 때만 자동 발송됩니다.</p>
              </div>
            )}
          </section>

          <div className="border-t border-gray-50" />

          {/* Segment */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">타겟 발송</h3>
              <Toggle on={showSegment} onToggle={() => setShowSegment((v) => !v)} />
            </div>
            {showSegment && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">부서</label>
                  <input
                    type="text"
                    value={segmentDept}
                    onChange={(e) => setSegmentDept(e.target.value)}
                    placeholder="예: IT팀"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">태그 (쉼표 구분)</label>
                  <input
                    type="text"
                    value={segmentTags}
                    onChange={(e) => setSegmentTags(e.target.value)}
                    placeholder="예: VIP, 신규"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e]"
                  />
                </div>
                <p className="text-xs text-gray-400">비워두면 전체 구독자에게 발송됩니다.</p>
              </div>
            )}
          </section>

          <div className="border-t border-gray-50" />

          {/* Category */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">카테고리</h3>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateForm({ category: cat })}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    form.category === cat
                      ? "bg-[#0d1b8e] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          <div className="border-t border-gray-50" />

          {/* Tags */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">태그</h3>
              <button
                type="button"
                onClick={suggestTags}
                disabled={tagSuggesting || (!form.title && !form.summary && !form.content)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-[#0d1b8e]/8 text-[#0d1b8e] hover:bg-[#0d1b8e]/15 dark:bg-blue-500/15 dark:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="AI가 본문을 분석해서 태그를 자동 추천합니다"
              >
                {tagSuggesting ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                )}
                {tagSuggesting ? "추천 중…" : "AI 추천"}
              </button>
            </div>

            {/* 기존 태그 칩 */}
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagList.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-100"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-400 hover:text-blue-700 transition-colors leading-none"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 태그 입력 */}
            <div
              className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 focus-within:border-[#0d1b8e] focus-within:ring-2 focus-within:ring-[#0d1b8e]/10 transition-all cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              <svg className="text-gray-300 flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === "Backspace" && !tagInput && tagList.length > 0) {
                    removeTag(tagList[tagList.length - 1]);
                  }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tagList.length === 0 ? "Microsoft, Claude, AI… (Enter로 추가)" : "태그 추가…"}
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-300 min-w-0"
              />
            </div>
            <p className="text-[10px] text-gray-300 mt-1.5">Enter 또는 쉼표로 구분, Backspace로 삭제</p>
          </section>

          <div className="border-t border-gray-50" />

          {/* Info */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">정보</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">상태</span>
              <span className={`font-medium ${isPublished ? "text-green-600" : "text-amber-600"}`}>
                {isPublished ? "발행됨" : "초안"}
              </span>
            </div>
            {initialData?.id && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">ID</span>
                <span className="text-gray-500 font-mono">#{initialData.id}</span>
              </div>
            )}
            {initialData?.id && isPublished && (
              <Link
                href={`/newsletter/${initialData.id}`}
                target="_blank"
                className="flex items-center gap-1 text-xs text-[#0d1b8e] hover:underline mt-1"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                웹에서 보기
              </Link>
            )}
          </section>

          {/* Send Stats */}
          {stats && (
            <>
              <div className="border-t border-gray-50" />
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">발송 통계</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-gray-800">{stats.sent.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">발송</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-green-600">{stats.openRate}%</p>
                    <p className="text-xs text-gray-400 mt-0.5">열람률</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Link Click Stats */}
          {linkStats.length > 0 && (
            <>
              <div className="border-t border-gray-50" />
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">링크 클릭</h3>
                <div className="space-y-2.5">
                  {linkStats.map((link) => {
                    const maxClicks = Math.max(...linkStats.map((l) => l.click_count), 1);
                    const pct = Math.round((link.click_count / maxClicks) * 100);
                    return (
                      <div key={link.short_code}>
                        <div className="flex items-center justify-between mb-1">
                          <a href={link.original_url} target="_blank" rel="noreferrer"
                            className="text-xs text-[#0d1b8e] hover:underline truncate max-w-[65%]">
                            {truncateUrl(link.original_url)}
                          </a>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {link.click_count}<span className="text-gray-300">클릭</span>
                          </span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#0d1b8e]/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
