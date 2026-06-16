"use client";

import { useState, useTransition, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// ── 베이토 타일 스킨 (공용) — 둥근 타일 + 하어라인 보더 + 소프트 그림자 + 호버 떠오름 ──
const TILE = "rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(13,27,142,0.04)]";
const TILE_HOVER = "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(13,27,142,0.22)] hover:border-gray-200 dark:hover:border-gray-700";

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// 위클리 레터 발행 라벨 (현재 월·주차 파생 — 사실 주장 아님)
function issueLabel() {
  const now = new Date();
  const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const week = Math.ceil((now.getDate() + firstDow) / 7);
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")} · ${week}주차`;
}

function isNew(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) <= 3;
}

function readMin(text: string) {
  const clean = text?.replace(/<[^>]+>/g, "") || "";
  return Math.max(1, Math.round(clean.length / 500));
}

// 카테고리는 색 대신 라벨(소문자 추적·무채색)로 구분 — 브랜드 네이비는 인터랙션에만 사용
function catColor(_cat?: string) { return "text-gray-500 dark:text-gray-400"; }

// ── 북마크 외부 스토어(localStorage) ──────────────────────────
// useSyncExternalStore로 읽어 SSR/CSR 불일치 없이, 탭·컴포넌트 간에도 동기화된다.
const BOOKMARK_KEY = "bookmarks";
const BOOKMARK_EVENT = "bookmarks-changed";
const EMPTY_BOOKMARKS: number[] = [];
let bmCachedRaw: string | null = null;
let bmCachedVal: number[] = EMPTY_BOOKMARKS;

function readBookmarksSnapshot(): number[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(BOOKMARK_KEY); } catch { raw = null; }
  if (raw !== bmCachedRaw) {
    bmCachedRaw = raw;
    try { bmCachedVal = raw ? JSON.parse(raw) : EMPTY_BOOKMARKS; } catch { bmCachedVal = EMPTY_BOOKMARKS; }
  }
  return bmCachedVal;
}

function subscribeBookmarks(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(BOOKMARK_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(BOOKMARK_EVENT, cb);
  };
}

function writeBookmarks(next: number[]) {
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  window.dispatchEvent(new Event(BOOKMARK_EVENT));
}

// ── 검색어 하이라이팅 (동의어 포함) ──────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  // 동의어 확장: "클로드" → ["클로드", "Claude"]
  const terms = expandTerms(query);
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lowerTerms = terms.map(t => t.toLowerCase());

  return (
    <>
      {parts.map((part, i) =>
        lowerTerms.includes(part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-gray-900 dark:text-yellow-100 rounded-sm px-0.5 not-italic">
            {part}
          </mark>
        ) : part
      )}
    </>
  );
}

// NEW 배지 — 어디서나 동일하게 (여백만 호출부에서 조정)
function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[11px] font-bold text-[#0d1b8e] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded ${className}`}>
      NEW
    </span>
  );
}

// 이미지 없을 때 — 비비드 그라디언트 대신 무채색 패널 + 발행물 마크(타이포그래픽)
function Placeholder({ category }: { category?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 select-none">
      <span className="font-display text-[18px] text-gray-300 dark:text-gray-600 leading-none">
        대덕<span className="italic">.it</span>
      </span>
      {category && (
        <span className="text-[10px] tracking-[0.25em] uppercase text-gray-300 dark:text-gray-600">
          {category}
        </span>
      )}
    </div>
  );
}

// ── 히어로 우상단 노치 (CSS 컷아웃) — 배경색 둥근 박스로 매끄럽게 파냄 ──
function HeroNotch() {
  return <div aria-hidden className="pointer-events-none absolute top-0 right-0 z-10 w-[150px] h-[58px] bg-[#f6f7f9] dark:bg-[#0f1117] rounded-bl-[26px]" />;
}

// ── "이번 주 PICK" 배지 — 클립 바깥(컨테이너)에서 우상단 노치 위에 띄움 ──
function PickBadge() {
  return (
    <span className="pointer-events-none absolute top-[14px] right-5 z-30 inline-flex items-center gap-1.5 text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-[#0d1b8e] shadow-sm">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
      이번 주 PICK
    </span>
  );
}

// ── 히어로 슬라이드 (이미지 위 텍스트 오버레이) ──
function HeroSlide({ a, didDragRef }: { a: Newsletter; didDragRef: { current: boolean } }) {
  const cat  = a.category || "일반";
  const date = a.published_at || a.created_at;

  return (
    <Link
      href={`/newsletter/${a.id}`}
      draggable={false}
      onClick={e => { if (didDragRef.current) { e.preventDefault(); didDragRef.current = false; } }}
      className="group relative block w-full h-full overflow-hidden bg-gray-900"
    >
      {/* 풀 블리드 이미지 */}
      {a.cover_image ? (
        <img src={a.cover_image} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
      ) : (
        <div className="absolute inset-0"><Placeholder category={cat} /></div>
      )}

      {/* 그라디언트 오버레이 (하단 어둡게) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5 pointer-events-none" />

      {/* 좌하단 텍스트 */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-7">
        <h2 className="font-display text-[21px] sm:text-[26px] font-black text-white leading-snug tracking-tight line-clamp-2 mb-2 pr-4">
          {a.title}
        </h2>
        <div className="flex items-center gap-2 text-[13px] text-white/85">
          <span className="font-semibold">{cat}</span>
          <span className="text-white/40">·</span>
          <span className="text-white/75">{a.author_name}</span>
          {isNew(date) && <span className="ml-0.5 text-[11px] font-bold text-white/90">NEW</span>}
        </div>
      </div>
    </Link>
  );
}

// ── 히어로 슬라이더 ────────────────────────────────────────────
function HeroSlider({ articles }: { articles: Newsletter[] }) {
  const [current, setCurrent]     = useState(0);
  const [paused,  setPaused]      = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX  = useRef<number | null>(null);
  const didDrag     = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const goNext = useCallback(() => setCurrent(p => (p + 1) % articles.length), [articles.length]);
  const goPrev = useCallback(() => setCurrent(p => (p - 1 + articles.length) % articles.length), [articles.length]);
  const goTo   = useCallback((i: number) => { setCurrent(i); setPaused(true); }, []);

  useEffect(() => {
    if (paused || articles.length <= 1) return;
    const t = setInterval(goNext, 6500);
    return () => clearInterval(t);
  }, [paused, goNext, articles.length]);

  const endDrag = (deltaX: number) => {
    if (Math.abs(deltaX) > 50) { deltaX < 0 ? goNext() : goPrev(); setPaused(true); }
    dragStartX.current = null;
    setDragOffset(0);
  };
  const onMouseDown  = (e: React.MouseEvent) => { dragStartX.current = e.clientX; didDrag.current = false; setDragOffset(0); };
  const onMouseMove  = (e: React.MouseEvent) => {
    if (dragStartX.current === null) return;
    const off = e.clientX - dragStartX.current;
    if (Math.abs(off) > 5) { didDrag.current = true; setDragOffset(off); }
  };
  const onMouseUp    = (e: React.MouseEvent) => { if (dragStartX.current !== null) endDrag(e.clientX - dragStartX.current); };
  const onMouseLeave = () => { if (dragStartX.current !== null) endDrag(0); setPaused(false); setHovered(false); };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; setDragOffset(0); };
  const onTouchMove  = (e: React.TouchEvent) => { if (touchStartX.current !== null) setDragOffset(e.touches[0].clientX - touchStartX.current); };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    endDrag(e.changedTouches[0].clientX - touchStartX.current);
    touchStartX.current = null;
  };

  if (articles.length === 0) return null;

  const isDragging = dragOffset !== 0;

  // ── 아티클 1개 → 슬라이더 없이 단순 카드 ─────────────
  if (articles.length === 1) {
    return (
      <div className="relative rounded-2xl overflow-hidden h-[440px] sm:h-[340px] lg:h-[380px]">
        <HeroNotch />
        <HeroSlide a={articles[0]} didDragRef={didDrag} />
        <PickBadge />
      </div>
    );
  }

  // ── 복수 슬라이드 (이미지 오버레이) ──────────────────────────
  return (
    <div
      className="relative h-[440px] sm:h-[340px] lg:h-[380px] overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing select-none"
      onMouseEnter={() => { setPaused(true); setHovered(true); }}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <HeroNotch />
      <PickBadge />
      {/* 슬라이드 트랙 */}
      <div
        className="flex h-full"
        style={{
          width: `${articles.length * 100}%`,
          transform: `translateX(calc(-${(current * 100) / articles.length}% + ${dragOffset}px))`,
          transition: isDragging ? "none" : "transform 600ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {articles.map((a) => (
          <div key={a.id} className="flex-shrink-0 h-full" style={{ width: `${100 / articles.length}%` }}>
            <HeroSlide a={a} didDragRef={didDrag} />
          </div>
        ))}
      </div>

      {/* ◀ ▶ 화살표 (다크 이미지 위) */}
      <button
        onClick={e => { e.preventDefault(); goPrev(); setPaused(true); }}
        className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 ${hovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}
        aria-label="이전"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button
        onClick={e => { e.preventDefault(); goNext(); setPaused(true); }}
        className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 ${hovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"}`}
        aria-label="다음"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* 우상단: 일시정지 */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setPaused(p => !p); }}
        className="absolute bottom-6 right-5 z-20 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors cursor-pointer"
        aria-label={paused ? "재생" : "일시정지"}
      >
        {paused
          ? <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          : <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        }
      </button>

      {/* 하단 스토리식 세그먼트 진행바 (클릭 시 해당 슬라이드로 이동, 자동재생 채워짐) */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex gap-1.5 px-3.5 pb-3.5">
        {articles.map((_, i) => (
          <button
            key={i}
            onClick={e => { e.preventDefault(); e.stopPropagation(); goTo(i); }}
            className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden cursor-pointer"
            aria-label={`${i + 1}번째 슬라이드로 이동`}
          >
            <span
              key={current}
              className={`block h-full rounded-full bg-white ${i < current ? "w-full" : i > current ? "w-0" : ""}`}
              style={i === current ? { animation: "heroProg 6500ms linear both", animationPlayState: paused ? "paused" : "running" } : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// 태그 칩 (카드용 — 클릭 시 태그 필터)
function TagChips({ tags, onTag, activeTag = "", className = "" }: {
  tags: string | null;
  onTag?: (tag: string) => void;
  activeTag?: string;
  className?: string;
}) {
  const list = (tags || "").split(",").map(t => t.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {list.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onTag?.(tag); }}
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
            activeTag === tag
              ? "bg-[#0d1b8e] text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-[#0d1b8e] dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
          }`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

// ── 북마크 토글 버튼 (카드의 <Link> 안에 들어가므로 기본 이동을 막는다) ──
function BookmarkButton({ active, onToggle, className = "" }: {
  active: boolean; onToggle: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "북마크 해제" : "북마크 저장"}
      aria-pressed={active}
      title={active ? "북마크 해제" : "북마크 저장"}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
        active
          ? "text-[#0d1b8e] dark:text-blue-400"
          : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300"
      } ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  );
}

// ── 일반 카드 (세로형 그리드) ────────────────────────────────
function ArticleCard({ nl, search = "", activeTag = "", onTag, bookmarked = false, onBookmark }: {
  nl: Newsletter; search?: string; activeTag?: string; onTag?: (tag: string) => void;
  bookmarked?: boolean; onBookmark?: (id: number) => void;
}) {
  const displayTitle = nl.title;
  const cat = nl.category || "일반";
  const date = nl.published_at || nl.created_at;

  return (
    <Link href={`/newsletter/${nl.id}`} className={`group relative flex flex-col overflow-hidden cursor-pointer ${TILE} ${TILE_HOVER}`}>
      {/* 썸네일 */}
      <div className="relative w-full aspect-[16/10] bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
        {nl.cover_image ? (
          <img src={nl.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        ) : (
          <Placeholder category={cat} />
        )}
        <span className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-center text-[#0d1b8e] dark:text-blue-400 shadow-sm opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
      {onBookmark && (
        <div className="absolute top-2 right-2 z-10">
          <BookmarkButton active={bookmarked} onToggle={() => onBookmark(nl.id)} className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm" />
        </div>
      )}

      {/* 본문 */}
      <div className="flex flex-col flex-1 p-4">
        {/* 카테고리 */}
        <span className={`text-[13px] font-bold mb-2 ${catColor(cat)}`}>
          {cat}
          {isNew(date) && <NewBadge className="ml-1.5 align-middle" />}
        </span>

        {/* 제목 */}
        <h3 className="font-display text-[17px] font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors leading-snug flex-1 mb-3">
          <Highlight text={displayTitle} query={search} />
        </h3>

        {/* 태그 */}
        <TagChips tags={nl.tags} onTag={onTag} activeTag={activeTag} className="mb-3" />

        {/* 푸터 */}
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-500">
          <div className="w-5 h-5 rounded-full bg-[#0d1b8e]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[#0d1b8e] font-black text-[8px]">it</span>
          </div>
          <span className="text-gray-500 dark:text-gray-400 font-medium">{nl.author_name}</span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span>{formatDate(date)}</span>
          {nl.view_count > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="flex items-center gap-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {nl.view_count.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── 홈 하단 3컬럼용 최소 아이템 타입 (Newsletter / DaeduckArticle 모두 수용) ──
type ColItem = {
  id: number; title: string; card_title?: string | null; cover_image: string | null;
  category?: string; published_at?: string; created_at?: string; view_count?: number;
};

// ── 뉴닉식 이미지 카드 (이미지 상단 + 카테고리 + 제목 + 날짜, 보더 없음) ──
function FeedCard({ nl }: { nl: ColItem }) {
  const cat = nl.category || "일반";
  const date = nl.published_at || nl.created_at || "";
  return (
    <Link href={`/newsletter/${nl.id}`} className={`group block overflow-hidden cursor-pointer ${TILE} ${TILE_HOVER}`}>
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800">
        {nl.cover_image
          ? <img src={nl.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          : <Placeholder category={cat} />}
        <span className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-center text-[#0d1b8e] dark:text-blue-400 shadow-sm opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
      <div className="p-4">
        <span className={`text-[13px] font-bold ${catColor(cat)}`}>{cat}</span>
        <h4 className="font-display text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mt-1.5 mb-2 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors duration-200">{nl.title}</h4>
        {date && <span className="text-[13px] text-gray-500 dark:text-gray-500">{formatDate(date)}</span>}
      </div>
    </Link>
  );
}

// ── 섹션 헤더 (에디토리얼 통일안: 제목 + 짧은 네이비 언더라인) ──
function SectionHeader({ title, moreHref }: { title: string; moreHref?: string }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h3 className="font-display text-[20px] font-black tracking-[-0.02em] text-gray-900 dark:text-gray-50">{title}</h3>
        <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#0d1b8e] to-[#3b82f6] dark:from-blue-400 dark:to-cyan-400" />
      </div>
      {moreHref && <Link href={moreHref} className="text-[13px] font-medium text-gray-500 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors cursor-pointer flex-shrink-0">더 보기 ›</Link>}
    </div>
  );
}

// ── 테마 섹션 (굵은 헤더 + 이미지 카드 행) ──
function HighlightSection({ title, items, emptyText, moreHref }: {
  title: string; items: ColItem[]; emptyText: string; moreHref?: string;
}) {
  return (
    <section className="mb-10">
      <SectionHeader title={title} moreHref={moreHref} />
      {items.length === 0
        ? <p className="text-[13px] text-gray-500 dark:text-gray-500 py-12 text-center bg-white dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">{emptyText}</p>
        : <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 gap-y-7">{items.map(nl => <FeedCard key={nl.id} nl={nl} />)}</div>}
    </section>
  );
}

// ── 지금 뜨는 글 (라이트 레일: 히어로 우측, 세로 랭킹 + 네이비 번호) ──
function TrendingRail({ items }: { items: ColItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={`h-full px-6 py-6 flex flex-col ${TILE}`}>
      <div>
        <h3 className="font-display text-[17px] font-black tracking-[-0.02em] text-gray-900 dark:text-gray-50">지금 뜨는 글</h3>
        <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-[#0d1b8e] to-[#3b82f6] dark:from-blue-400 dark:to-cyan-400" />
      </div>
      <ol className="flex-1 flex flex-col mt-1">
        {items.map((nl, i) => {
          const cat = nl.category || "일반";
          const date = nl.published_at || nl.created_at || "";
          return (
            <li key={nl.id} className="flex-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <Link href={`/newsletter/${nl.id}`} className="group flex gap-3.5 items-center h-full py-2.5 cursor-pointer">
                <span className={`flex-shrink-0 w-7 text-center font-display text-[26px] font-black leading-none tabular-nums ${i < 3 ? "text-[#0d1b8e] dark:text-blue-400" : "text-gray-200 dark:text-gray-700"}`}>{i + 1}</span>
                <div className="min-w-0">
                  <h4 className="font-display text-[14.5px] font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors duration-200">{nl.title}</h4>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-500 mt-1">
                    <span className={`font-semibold ${catColor(cat)}`}>{cat}</span>
                    {date && <><span className="text-gray-300 dark:text-gray-700">·</span><span>{formatDate(date)}</span></>}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ALL_CATS = ["전체", "IT 트렌드", "AI", "보안", "개발·기술", "인프라", "사내 소식", "기타"];
const BOOKMARK_TAB = "__saved__";
const ITEMS_PER_PAGE = 6;

/**
 * 페이지네이션 화살표 버튼 (재사용)
 *
 * 시맨틱한 <button disabled>를 유지. 키보드 포커스에서 자동 제외되고
 * 스크린리더가 비활성 상태를 안내해 접근성이 보장됨.
 *
 * suppressHydrationWarning 사유:
 *   React 19 + Next.js 16의 boolean 속성 SSR 직렬화 엣지 케이스나,
 *   일부 브라우저 확장(번역기·접근성 도구·비밀번호 매니저 등)이
 *   페이지 로드 직후 disabled 속성을 건드리면서 발생하는 false-positive
 *   hydration 경고를 억제한다. 런타임 동작에는 영향 없음.
 */
function PaginationButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      suppressHydrationWarning
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

// ── 페이지네이션 ──────────────────────────────────────────────
function Pagination({ totalPages, current, onChange }: { totalPages: number; current: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i);
    if (current < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-8 mb-2">
      <PaginationButton
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        ariaLabel="이전 페이지"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </PaginationButton>

      {pages.map((p, i) => p === "..." ? (
        <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm select-none">···</span>
      ) : (
        <button
          key={p}
          onClick={() => onChange(p as number)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
            p === current
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10"
          }`}
        >
          {p}
        </button>
      ))}

      <PaginationButton
        onClick={() => onChange(current + 1)}
        disabled={current >= totalPages}
        ariaLabel="다음 페이지"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </PaginationButton>
    </div>
  );
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

// ── 대덕.it 사내 소식 — 요즘IT 스타일 ────────────────────────
function DaeduckSection({ col }: { col: DaeduckCollection }) {
  function monthLabel(published_at: string) {
    if (!published_at) return "";
    return new Date(published_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }

  return (
    <section className="mt-10 mb-2">
      {/* 요즘IT 스타일 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-[#0d1b8e]/20 dark:ring-blue-500/30 flex-shrink-0">
          <div className="w-full h-full bg-[#0d1b8e] flex items-center justify-center">
            <span className="text-white font-black text-[13px] tracking-tight">it</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[18px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight">
            {col.title}
          </h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-500 mt-0.5">By 대덕전자 IT인프라그룹</p>
        </div>
        <a
          href={`/collections/${col.id}`}
          className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 transition-colors flex-shrink-0"
        >
          전체보기
        </a>
      </div>

      {/* 카드 가로 스크롤 */}
      {col.articles.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-600 py-6 text-center">
          아직 발행된 사내 소식이 없습니다.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {col.articles.map(a => {
            const label = monthLabel(a.published_at);
            return (
              <a
                key={a.id}
                href={`/newsletter/${a.id}`}
                className={`group flex-shrink-0 w-[214px] p-3 ${TILE} ${TILE_HOVER}`}
              >
                {/* 썸네일 + 배지 */}
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-2.5 bg-gray-100 dark:bg-gray-800">
                  {/* 아티클 수 배지 (좌상단) */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded px-1.5 py-[3px]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
                      <line x1="9" y1="18" x2="20" y2="18"/>
                      <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
                    </svg>
                    <span className="text-white text-[11px] font-bold tabular-nums">{col.articles.length}</span>
                  </div>

                  {a.cover_image ? (
                    <img
                      src={a.cover_image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-1.5 px-3">
                      <span className="text-gray-300 dark:text-gray-600 text-[9px] font-bold uppercase tracking-[0.2em]">사내소식</span>
                      <span className="font-display text-gray-500 dark:text-gray-500 text-[14px] leading-tight text-center">{label}</span>
                    </div>
                  )}
                </div>

                {/* 제목 */}
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 mb-1.5">
                  {a.title}
                </h3>

                {/* 발행월 */}
                <p className="text-[12px] text-gray-500 dark:text-gray-500 mb-1.5">{label}</p>

                {/* 조회수 */}
                <div className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span>{(a.view_count || 0).toLocaleString()}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 뉴닉식 주제(이슈) 블록 — 컬렉션 1개 = 주제명 + 큰 리드 카드 + 하위 헤드라인 ──
function TopicBlock({ col }: { col: DaeduckCollection }) {
  const [lead, ...subs] = col.articles;
  if (!lead) return null;
  const leadCat = lead.category || "일반";
  const leadDate = lead.published_at || "";
  return (
    <div className={`flex flex-col p-5 ${TILE} transition-all duration-300 hover:shadow-[0_20px_44px_-16px_rgba(13,27,142,0.16)] hover:border-gray-200 dark:hover:border-gray-700`}>
      {/* 주제 헤더 + 화살표 */}
      <Link href={`/collections/${col.id}`} className="group inline-flex items-center gap-1 self-start mb-4 cursor-pointer">
        <h3 className="font-display text-[19px] font-black text-gray-900 dark:text-gray-50 tracking-tight group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors duration-200">{col.title}</h3>
        <svg className="text-gray-400 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </Link>

      {/* 리드 카드 (이미지 + 헤드라인 + 요약) */}
      <Link href={`/newsletter/${lead.id}`} className="group cursor-pointer">
        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
          {lead.cover_image
            ? <img src={lead.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
            : <Placeholder category={leadCat} />}
        </div>
        <h4 className="font-display text-[18px] font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mb-2 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors duration-200">{lead.title}</h4>
        {lead.summary && <p className="text-[14.5px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">{lead.summary}</p>}
        <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-500">
          <span className={`font-semibold ${catColor(leadCat)}`}>{leadCat}</span>
          {leadDate && <><span className="text-gray-300 dark:text-gray-700">·</span><span>{formatDate(leadDate)}</span></>}
        </span>
      </Link>

      {/* 하위 헤드라인 */}
      {subs.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-gray-800">
          {subs.map((a) => {
            const cat = a.category || "일반";
            const date = a.published_at || "";
            return (
              <Link key={a.id} href={`/newsletter/${a.id}`} className="group block py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer">
                <h5 className="font-display text-[15.5px] font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 mb-1 group-hover:text-[#0d1b8e] dark:group-hover:text-blue-400 transition-colors duration-200">{a.title}</h5>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-500">
                  <span className={`font-semibold ${catColor(cat)}`}>{cat}</span>
                  {date && <><span className="text-gray-300 dark:text-gray-700">·</span><span>{formatDate(date)}</span></>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  newsletters: Newsletter[];
  heroNewsletters: Newsletter[];
  popularNewsletters: Newsletter[];
  initialSearch: string;
  initialTag?: string;
  totalCount: number;
  topicCollections?: DaeduckCollection[];
  daeduckCollection?: DaeduckCollection | null;
}

export default function ArchiveClient({ newsletters, heroNewsletters, popularNewsletters, initialSearch, initialTag = "", totalCount, topicCollections = [], daeduckCollection = null }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [activeTag, setActiveTag] = useState(initialTag);
  const [activeTab, setActiveTab] = useState("전체");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // 북마크: 공개 사이트라 독자 로그인이 없으므로 localStorage에 영구 저장.
  // SSR에선 빈 배열을 반환해 hydration 불일치를 피한다.
  const bookmarks = useSyncExternalStore(subscribeBookmarks, readBookmarksSnapshot, () => EMPTY_BOOKMARKS);
  const bookmarkSet = new Set(bookmarks);

  const toggleBookmark = useCallback((id: number) => {
    const current = readBookmarksSnapshot();
    const next = current.includes(id) ? current.filter(b => b !== id) : [...current, id];
    writeBookmarks(next);
  }, []);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    startTransition(() => {
      const p = new URLSearchParams();
      if (val) p.set("search", val);
      if (activeTag) p.set("tag", activeTag);
      router.push(`/?${p}`);
    });
  }

  function handleTagClick(tag: string) {
    const next = activeTag === tag ? "" : tag;
    setActiveTag(next);
    setPage(1);
    startTransition(() => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (next) p.set("tag", next);
      router.push(`/?${p}`);
    });
  }

  function handlePageChange(p: number) {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const availableCats = Array.from(new Set(newsletters.map(n => n.category || "일반")));
  const tabs = ALL_CATS.filter(c => c === "전체" || availableCats.includes(c));

  // 저장됨 탭: 북마크한 글만 보기 (히어로·컬렉션 숨김)
  const isBookmarkView = activeTab === BOOKMARK_TAB;

  // 히어로: 서버에서 계산된 오늘 발행된 최신 5개 (hydration 불일치 방지)
  const heroArticles = isBookmarkView ? [] : heroNewsletters;
  const heroIds = new Set(heroNewsletters.map(n => n.id));

  // ── 홈 피처 섹션 데이터 (중복 방지: 한 기사는 페이지에 한 번만 노출) ──
  // 우선순위: 히어로 > 큐레이션(토픽 블록·사내소식) > 트렌딩 > AI 하이라이트 > 메인 그리드.
  // 큐레이션 글은 "예약"해 자동 섹션(트렌딩/AI)·그리드에서 다시 쓰지 않는다.
  // 토픽 블록: 히어로/다른 토픽과 겹치는 글은 제거(히어로 우선), 빈 블록은 숨긴다.
  const topicSeen = new Set<number>(heroIds);
  const dedupTopics = topicCollections
    .map(c => ({
      ...c,
      articles: c.articles.filter(a => {
        if (topicSeen.has(a.id)) return false;
        topicSeen.add(a.id);
        return true;
      }),
    }))
    .filter(c => c.articles.length > 0);
  const topicIds = new Set<number>(dedupTopics.flatMap(c => c.articles.map(a => a.id)));
  const saenae = (daeduckCollection?.articles ?? []).slice(0, 4) as ColItem[];
  const reserved = new Set<number>([...heroIds, ...topicIds, ...saenae.map(n => n.id)]);

  const popBase = popularNewsletters.length > 0 ? popularNewsletters : newsletters;
  const popular = popBase.filter(n => !reserved.has(n.id)).slice(0, 5);
  // 인기글이 예약 글과 겹쳐 비거나 부족하면, 예약되지 않은 다른 최신 글로 채워 레일이 사라지지 않게 한다.
  if (popular.length < 4) {
    const have = new Set<number>([...reserved, ...popular.map(n => n.id)]);
    for (const n of newsletters) {
      if (popular.length >= 4) break;
      if (!have.has(n.id)) { popular.push(n); have.add(n.id); }
    }
  }
  const popIds = new Set(popular.map(n => n.id));
  const aiItems = newsletters
    .filter(n => (n.category || "").includes("AI") && !reserved.has(n.id) && !popIds.has(n.id))
    .slice(0, 4);
  // 피처 섹션·토픽 블록에 이미 노출된 글은 하단 메인 그리드에서 제외해 중복을 없앤다.
  const featuredIds = new Set<number>([...reserved, ...popIds, ...aiItems.map(n => n.id)]);
  // 기본 브라우즈(검색·태그·카테고리 필터 없음)에서만 중복 제외 — 검색/필터 결과는 가리지 않는다.
  const isDefaultBrowse = !isBookmarkView && !search && !activeTag && activeTab === "전체";

  // 카테고리 탭 + 태그 필터는 히어로(및 기본 브라우즈 시 피처 섹션) 제외한 나머지에 적용
  const belowHero = newsletters.filter(n => !heroIds.has(n.id) && (!isDefaultBrowse || !featuredIds.has(n.id)));
  const filtered = isBookmarkView
    ? newsletters.filter(n => bookmarkSet.has(n.id))
    : belowHero
        .filter(n => activeTab === "전체" || (n.category || "일반") === activeTab)
        .filter(n => !activeTag || (n.tags || "").split(",").map(t => t.trim()).includes(activeTag));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasContent = heroArticles.length > 0 || filtered.length > 0;

  // 하단 아카이브 그리드 제목 (검색·태그 중엔 위 배너가 맥락을 주므로 제목 숨김)
  const gridHeading = isBookmarkView
    ? "저장한 글"
    : (search || activeTag)
      ? null
      : activeTab !== "전체"
        ? `${activeTab} 아티클`
        : "전체 아티클";

  // 슬라이딩 밑줄: 활성 탭의 위치/너비를 측정해 인디케이터를 이동.
  // setState는 rAF·ResizeObserver·resize 콜백 안에서만 호출(동기 effect 본문 X).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-tab-active="true"]');
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth, ready: true });
    };
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [activeTab, isBookmarkView, tabs.length, bookmarks.length]);

  // 스크롤 등장: home-stage 직계 자식이 뷰포트에 들어오면 reveal-in 부여 (reduced-motion이면 비활성)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const els = document.querySelectorAll<HTMLElement>(".home-stage > *");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeTab, search, activeTag, page, isBookmarkView, hasContent]);

  return (
    <div>
      {/* ── 카테고리 바 — 헤더 바로 아래 sticky ── */}
      <div className="sticky top-16 z-30 -mx-5 px-5 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/70 dark:border-gray-800 mb-6">
        <div ref={navRef} className="relative flex items-center gap-0.5 py-2.5 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                data-tab-active={isActive ? "true" : undefined}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`relative px-3.5 py-2 text-[14px] font-bold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "text-[#0d1b8e] dark:text-blue-400"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/70 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            );
          })}

          {/* 우측: 로딩 스피너 + 저장됨(알약) */}
          <div className="ml-auto flex items-center gap-2 pl-3 flex-shrink-0">
            {isPending && (
              <svg className="text-[#0d1b8e] dark:text-blue-400 animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
              </svg>
            )}
            <button
              onClick={() => { setActiveTab(isBookmarkView ? "전체" : BOOKMARK_TAB); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                isBookmarkView
                  ? "bg-[#0d1b8e] text-white shadow-sm shadow-[#0d1b8e]/30"
                  : "text-gray-500 hover:text-[#0d1b8e] hover:bg-[#0d1b8e]/8 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={isBookmarkView ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              저장됨{bookmarks.length > 0 && ` ${bookmarks.length}`}
            </button>
          </div>

          {/* 슬라이딩 밑줄 인디케이터 (카테고리 전용, 그라디언트) */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 h-[2.5px] rounded-full bg-gradient-to-r from-[#0d1b8e] to-[#3b82f6] dark:from-blue-400 dark:to-cyan-400 transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width, opacity: indicator.ready && !isBookmarkView ? 1 : 0 }}
          />
        </div>
      </div>

      <div className="home-stage">
      {/* ── 상단 히어로: 슬라이더(좌) + 지금 뜨는 글 레일(우) ── */}
      {hasContent && !isBookmarkView && (
          <>
            <section className="mb-10 flex flex-col lg:flex-row gap-6 lg:items-stretch">
              {/* 좌: 주간 IT 핵심 요약 + 슬라이더 */}
              <div className="lg:flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#0d1b8e] dark:bg-blue-400 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0d1b8e] dark:bg-blue-400" />
                  </span>
                  <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-[#0d1b8e] dark:text-blue-400">
                    대덕<span className="lowercase">.it</span> WEEKLY
                  </span>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-500 tabular-nums">{issueLabel()}</span>
                </div>
                <h2 className="font-display text-[32px] sm:text-[42px] font-black text-gray-900 dark:text-gray-50 tracking-[-0.035em] leading-[1.02] mb-4">주간 IT 핵심 요약</h2>
                <div className="flex-1">
                  <HeroSlider articles={heroArticles.length > 0 ? heroArticles : newsletters.slice(0, 5)} />
                </div>
              </div>
              {/* 우: 지금 뜨는 글 (다크 레일) */}
              <aside className="lg:w-[330px] flex-shrink-0">
                <TrendingRail items={popular as ColItem[]} />
              </aside>
            </section>

            <div className="h-px bg-gray-100 dark:bg-gray-800 mb-9" />

            {/* ── 테마 섹션: Copilot·AI / 사내 소식 (이미지 전면 카드) ── */}
            <HighlightSection title="사내 소식" items={saenae} emptyText="이번 달 사내 소식이 곧 올라옵니다." moreHref={daeduckCollection ? `/collections/${daeduckCollection.id}` : "/news"} />
            <HighlightSection title="Copilot / AI 하이라이트" items={aiItems as ColItem[]} emptyText="AI 콘텐츠가 곧 추가됩니다." />
          </>
      )}

      {/* 주제(이슈) 블록 — 뉴닉식: 컬렉션별 리드 카드 + 하위 헤드라인 */}
      {!isBookmarkView && dedupTopics.length > 0 && (
        <section className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {dedupTopics.map(col => <TopicBlock key={col.id} col={col} />)}
          </div>
        </section>
      )}


      {/* 태그 필터 배너 */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900">
          <svg className="text-indigo-500 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium flex-1">
            <strong>#{activeTag}</strong> 태그 아티클 {filtered.length}건
          </span>
          <button
            onClick={() => handleTagClick(activeTag)}
            className="text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium"
          >
            해제
          </button>
        </div>
      )}

      {/* 검색 중 배너 */}
      {search && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900">
          <svg className="text-[#0d1b8e] flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="text-sm text-[#0d1b8e] dark:text-blue-300 font-medium flex-1">
            <strong>&ldquo;{search}&rdquo;</strong> 검색 결과 {filtered.length}건
          </span>
          <button
            onClick={() => handleSearch("")}
            className="text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium"
          >
            초기화
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {filtered.length === 0 && !search && newsletters.length === 0 && (
        <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800">
          <p className="text-gray-500 font-medium text-sm dark:text-gray-400">아직 발행된 아티클이 없습니다.</p>
        </div>
      )}

      {search && filtered.length === 0 && (
        <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800">
          <p className="text-gray-500 font-medium text-sm dark:text-gray-400">&ldquo;{search}&rdquo;에 해당하는 아티클이 없어요.</p>
          <button onClick={() => handleSearch("")} className="mt-3 text-sm text-[#0d1b8e] hover:underline font-medium">전체 보기</button>
        </div>
      )}

      {/* 저장됨 빈 상태 */}
      {isBookmarkView && filtered.length === 0 && (
        <div className="text-center py-24 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0d1b8e]/8 text-[#0d1b8e] dark:bg-blue-500/15 dark:text-blue-400 mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </span>
          <p className="text-gray-500 font-medium text-sm dark:text-gray-400">아직 저장한 아티클이 없어요.</p>
          <p className="text-gray-500 text-xs mt-1 dark:text-gray-500">카드의 북마크 아이콘을 눌러 나중에 볼 글을 저장해 보세요.</p>
          <button onClick={() => { setActiveTab("전체"); setPage(1); }} className="mt-3 text-sm text-[#0d1b8e] hover:underline font-medium">전체 보기</button>
        </div>
      )}

      {hasContent && (
        <div>
            {/* 아티클 리스트 — 에디토리얼 레이아웃 */}
            {filtered.length > 0 && (
              <div ref={gridRef} className={`mt-2 transition-opacity duration-200 ${isPending ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                {gridHeading && <SectionHeader title={gridHeading} />}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {paginated.map(nl => (
                    <ArticleCard key={nl.id} nl={nl} search={search} activeTag={activeTag} onTag={handleTagClick} bookmarked={bookmarkSet.has(nl.id)} onBookmark={toggleBookmark} />
                  ))}
                </div>
                <Pagination totalPages={totalPages} current={page} onChange={handlePageChange} />
              </div>
            )}
            {filtered.length === 0 && activeTab !== "전체" && (
              <p className="text-sm text-gray-500 py-10 text-center">이 카테고리에 아티클이 없어요.</p>
            )}
        </div>
      )}

      {/* 대덕.it 사내 소식 전용 섹션 — 아티클 그리드 하단 */}
      {daeduckCollection && <DaeduckSection col={daeduckCollection} />}

      {/* 구독 CTA — 네이비 타일 밴드 */}
      {hasContent && (
        <div className="mt-10 rounded-2xl bg-[#0d1b8e] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_16px_40px_-18px_rgba(13,27,142,0.55)]">
          <div>
            <p className="font-display text-[19px] font-black text-white tracking-tight">새 아티클, 이메일로 받기</p>
            <p className="text-blue-200 text-[13px] mt-1">대덕전자 IT 소식을 매주 받아보세요.</p>
          </div>
          <Link
            href="/subscribe"
            className="flex-shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 bg-white text-[#0d1b8e] hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl text-[14px] transition-colors duration-200 cursor-pointer group"
          >
            구독하기
            <svg className="group-hover:translate-x-0.5 transition-transform duration-200" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
