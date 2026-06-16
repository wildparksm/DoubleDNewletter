"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";

interface Props {
  userName: string;
  userRole: string;
  stats: { newsletters: number; subscribers: number; rssNew: number };
  children: React.ReactNode;
}

export default function AdminShell({ userName, userRole, stats, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 경로 바뀌면 모바일 사이드바 자동 닫힘
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 사이드바 열려 있을 때 ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // 모바일에서 열렸을 땐 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-gray-950">
      {/* 모바일 상단바 (햄버거 + 로고) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="font-black text-base tracking-tight">
          <span className="text-gray-900 dark:text-white">대덕</span>
          <span className="text-[#0d1b8e] dark:text-blue-400">.it</span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 ml-1">관리자</span>
        </div>
        {/* 정렬용 placeholder */}
        <div className="w-8" />
      </div>

      {/* 모바일 백드롭 */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
          aria-hidden
        />
      )}

      <AdminSidebar
        userName={userName}
        userRole={userRole}
        stats={stats}
        open={open}
        onClose={() => setOpen(false)}
      />

      <div className="lg:ml-16">{children}</div>
    </div>
  );
}
