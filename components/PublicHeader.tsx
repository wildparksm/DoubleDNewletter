"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import DarkToggle from "@/components/DarkToggle";

interface Props {
  subCount?: number;
}

const MAX_RECENT = 6;

export default function PublicHeader({ subCount }: Props) {
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [query,       setQuery]       = useState("");
  const [recents,     setRecents]     = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => {
    const r = localStorage.getItem("search-recents");
    if (r) setRecents(JSON.parse(r));
  }, []);

  /* 검색창 열릴 때 자동 포커스 + ESC 닫기 */
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  function openSearch()  { setSearchOpen(true); }
  function closeSearch() { setSearchOpen(false); setQuery(""); }

  function saveRecent(q: string) {
    const updated = [q, ...recents.filter(r => r !== q)].slice(0, MAX_RECENT);
    setRecents(updated);
    localStorage.setItem("search-recents", JSON.stringify(updated));
  }

  function removeRecent(q: string) {
    const updated = recents.filter(r => r !== q);
    setRecents(updated);
    localStorage.setItem("search-recents", JSON.stringify(updated));
  }

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    router.push(`/?search=${encodeURIComponent(trimmed)}`);
    closeSearch();
  }

  return (
    <>
      <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/70 dark:border-gray-800 sticky top-0 z-40">
        <div className="relative max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">

          {/* Logo */}
          <Logo size="sm" />

          {/* Center nav — 화면 중앙 고정 (확장성) */}
          <nav className="hidden sm:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <Link href="/" className="px-3.5 py-1.5 text-[15px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors font-semibold">
              IT 인사이트
            </Link>
            <Link href="/news" className="px-3.5 py-1.5 text-[15px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors font-semibold">
              사내 소식
            </Link>
          </nav>

          {/* Right actions */}
          <div className="hidden sm:flex items-center gap-2">
            {/* 검색 버튼 */}
            <button
              onClick={openSearch}
              title="검색"
              className="p-2 rounded-lg text-gray-600 hover:text-[#0d1b8e] hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            <DarkToggle storageKey="public-dark" />

            <Link href="/subscribe" className="subscribe-btn ml-1">
              <svg className="arr-2" width="14" height="14" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/>
              </svg>
              <span className="btn-text">구독하기</span>
              <span className="circle" aria-hidden="true"></span>
              <svg className="arr-1" width="14" height="14" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/>
              </svg>
            </Link>
          </div>

          {/* Mobile */}
          <div className="sm:hidden flex items-center gap-1">
            <button onClick={openSearch} className="p-2 text-gray-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
            <button className="p-2 text-gray-500" onClick={() => setMenuOpen(v => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-5 py-3 space-y-1">
            <Link href="/" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-lg">IT 인사이트</Link>
            <Link href="/news" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-lg">사내 소식</Link>
            <Link href="/subscribe" className="block px-3 py-2 text-sm font-bold text-[#0d1b8e] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">구독하기</Link>
            <div className="px-3 py-2">
              <DarkToggle storageKey="public-dark" />
            </div>
          </div>
        )}
      </header>

      {/* ── 검색 오버레이 ───────────────────────────────────────── */}
      {/* 배경 딤 */}
      <div
        className={`fixed inset-0 top-16 bg-black/30 dark:bg-black/60 z-30 transition-opacity duration-300 ${searchOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={closeSearch}
      />

      {/* 슬라이드 다운 패널 */}
      <div
        className={`fixed top-16 left-0 right-0 z-[39] bg-white dark:bg-gray-950 shadow-xl border-b border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-out ${searchOpen ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="max-w-3xl mx-auto px-5 py-5">

          {/* 입력창 */}
          <div className="flex items-center gap-3 border-b-2 border-gray-200 dark:border-gray-700 pb-4 focus-within:border-[#0d1b8e] dark:focus-within:border-blue-500 transition-colors">
            <svg className="text-gray-400 flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(query); }}
              placeholder="키워드, 아티클, 컬렉션 검색하기"
              className="flex-1 text-base bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </button>
            )}
            <button onClick={closeSearch} className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* 최근 검색어 */}
          <div className="pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">최근 검색어</h3>
              {recents.length > 0 && (
                <button
                  onClick={() => { setRecents([]); localStorage.removeItem("search-recents"); }}
                  className="text-xs text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  전체 삭제
                </button>
              )}
            </div>

            {recents.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-600 text-center py-5">최근 검색어가 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recents.map(r => (
                  <div key={r} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5">
                    <button
                      onClick={() => submit(r)}
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#0d1b8e] dark:hover:text-blue-400 transition-colors"
                    >
                      {r}
                    </button>
                    <button
                      onClick={() => removeRecent(r)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-0.5 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
