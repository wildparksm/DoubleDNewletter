"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import DarkToggle from "@/components/DarkToggle";
import {
  IconDashboard,
  IconNewsletter,
  IconCollection,
  IconRss,
  IconUsersGroup,
  IconUser,
  IconSettings,
  IconMoon,
  IconLogout,
} from "@/components/Icon";

interface SidebarStats {
  newsletters: number;
  subscribers: number;
  rssNew: number;
}

interface Props {
  userName: string;
  userRole: string;
  stats: SidebarStats;
  open?: boolean;
  onClose?: () => void;
}

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  exact?: boolean;
  badgeKey?: keyof SidebarStats;
};

const mainItems: NavItem[] = [
  { href: "/admin", label: "대시보드", Icon: IconDashboard, exact: true },
  { href: "/admin/newsletters", label: "뉴스레터", Icon: IconNewsletter },
  { href: "/admin/collections", label: "컬렉션", Icon: IconCollection },
  { href: "/admin/rss", label: "RSS 수신함", Icon: IconRss, badgeKey: "rssNew" },
  { href: "/admin/subscribers", label: "구독자", Icon: IconUsersGroup },
];

const manageItems: NavItem[] = [
  { href: "/admin/users", label: "사용자", Icon: IconUser },
  { href: "/admin/settings", label: "설정", Icon: IconSettings },
];

export default function AdminSidebar({ userName, userRole, stats, open = false, onClose }: Props) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  // 모바일은 open(드로어), 데스크톱은 hover로 펼침
  const expanded = open || hovered;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const roleLabel = userRole === "admin" ? "관리자" : "에디터";
  const initial = userName?.charAt(0) || "?";

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  function renderItem(item: NavItem) {
    const active = isActive(item.href, item.exact);
    const badgeCount = item.badgeKey ? stats[item.badgeKey] : 0;
    const Icon = item.Icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={!expanded ? item.label : undefined}
        className={`relative flex items-center h-10 rounded-xl text-[13px] transition-colors ${
          expanded ? "gap-3 px-3" : "justify-center px-0"
        } ${
          active
            ? "bg-[#0d1b8e] text-white font-semibold shadow-sm shadow-[#0d1b8e]/30"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
        }`}
      >
        <span className={`flex items-center justify-center w-5 shrink-0 ${active ? "text-white" : "text-gray-500 dark:text-gray-400"}`}>
          <Icon size={18} />
        </span>
        {expanded && <span className="truncate">{item.label}</span>}

        {/* 펼침: 숫자 배지 / 접힘: 점 */}
        {badgeCount > 0 && (expanded ? (
          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/25 text-white" : "bg-rose-500 text-white"}`}>
            {badgeCount}
          </span>
        ) : (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-950" />
        ))}
      </Link>
    );
  }

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`fixed inset-y-0 left-0 z-50 lg:z-30 flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200/70 dark:border-gray-800 overflow-hidden transition-[width,transform] duration-200 ease-out w-64 lg:translate-x-0 ${
        expanded ? "lg:w-64" : "lg:w-16"
      } ${hovered ? "lg:shadow-2xl" : ""} ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* 로고 */}
      <div className={`h-16 shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center ${expanded ? "px-4 justify-between" : "justify-center px-0"}`}>
        <Link href="/admin" className="inline-flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#0d1b8e] text-white font-black text-[12px] flex items-center justify-center shrink-0">it</span>
          {expanded && (
            <span className="font-black text-lg tracking-tight whitespace-nowrap">
              <span className="text-gray-900 dark:text-white">대덕</span>
              <span className="text-[#0d1b8e] dark:text-blue-400">.it</span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 ml-1">관리자</span>
            </span>
          )}
        </Link>
        {expanded && onClose && (
          <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="lg:hidden p-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 프로필 */}
      <div className={`shrink-0 border-b border-gray-100 dark:border-gray-800 flex flex-col items-center text-center ${expanded ? "px-6 py-5" : "py-4"}`}>
        <div className={`rounded-2xl bg-gradient-to-br from-[#0d1b8e] to-[#3b82f6] flex items-center justify-center text-white font-bold shadow-lg shadow-[#0d1b8e]/25 transition-all ${expanded ? "w-14 h-14 text-lg mb-3" : "w-9 h-9 text-sm"}`}>
          {initial}
        </div>
        {expanded && (
          <>
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{userName}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{roleLabel}</div>
            <div className="grid grid-cols-3 gap-2 mt-4 w-full">
              {[
                { v: stats.newsletters, l: "뉴스레터" },
                { v: stats.subscribers, l: "구독자" },
                { v: stats.rssNew, l: "RSS" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">{s.v}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {expanded ? (
          <div className="px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">메인</div>
        ) : (
          <div className="h-px bg-gray-100 dark:bg-gray-800 mx-2 mb-2" />
        )}
        {mainItems.map(renderItem)}

        {expanded ? (
          <div className="px-3 py-1 mt-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">관리</div>
        ) : (
          <div className="h-px bg-gray-100 dark:bg-gray-800 mx-2 my-2" />
        )}
        {manageItems.map(renderItem)}
      </nav>

      {/* 하단: 다크토글 + 로그아웃 */}
      <div className="shrink-0 px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <div className={`flex items-center h-10 rounded-xl text-[13px] text-gray-700 dark:text-gray-300 ${expanded ? "justify-between px-3" : "justify-center px-0"}`}>
          {expanded && (
            <div className="flex items-center gap-3">
              <span className="w-5 flex items-center justify-center text-gray-500 dark:text-gray-400"><IconMoon size={18} /></span>
              <span>다크모드</span>
            </div>
          )}
          <DarkToggle storageKey="admin-dark" />
        </div>

        <button
          onClick={handleLogout}
          title={!expanded ? "로그아웃" : undefined}
          className={`flex items-center h-10 w-full rounded-xl text-[13px] text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors ${
            expanded ? "gap-3 px-3" : "justify-center px-0"
          }`}
        >
          <span className="w-5 flex items-center justify-center shrink-0"><IconLogout size={18} /></span>
          {expanded && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}
