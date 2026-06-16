"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import DarkToggle from "@/components/DarkToggle";

export default function AdminHeader({ userName }: { userName?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "대시보드" },
    { href: "/admin/newsletters", label: "뉴스레터" },
    { href: "/admin/collections", label: "컬렉션" },
    { href: "/admin/rss", label: "RSS 수신함" },
    { href: "/admin/subscribers", label: "구독자" },
    { href: "/admin/users", label: "사용자" },
    { href: "/admin/settings", label: "설정" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <header className="bg-[#0d1b8e] text-white">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo size="sm" href="/admin" onDark />
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-blue-200 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {userName && <span className="text-sm text-blue-200">{userName}님</span>}

          <DarkToggle storageKey="admin-dark" />

          <button
            onClick={handleLogout}
            className="text-sm text-blue-200 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
