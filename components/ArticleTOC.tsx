"use client";

import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

function slugify(s: string, i: number) {
  const base = s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w가-힣-]/g, "").slice(0, 40);
  return base ? `h-${i}-${base}` : `h-${i}`;
}

// 본문 헤딩을 읽어 좌측에 스크롤스파이 목차를 띄움 (xl 이상에서만, reduced-motion 안전)
export default function ArticleTOC() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const body = document.querySelector("[data-article-body]");
    if (!body) return;
    const els = Array.from(body.querySelectorAll<HTMLElement>("h2, h3"));
    if (els.length < 2) return;

    const items: Heading[] = els.map((el, i) => {
      if (!el.id) el.id = slugify(el.textContent || "", i);
      el.style.scrollMarginTop = "96px";
      return { id: el.id, text: el.textContent || "", level: el.tagName === "H3" ? 3 : 2 };
    });
    setHeadings(items);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-90px 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="목차" className="hidden xl:block fixed top-28 left-8 w-52 z-20">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3">목차</p>
      <ul className="space-y-1 border-l border-gray-200 dark:border-gray-800">
        {headings.map((h) => {
          const active = activeId === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`block py-1 text-[13px] leading-snug transition-colors -ml-px border-l-2 ${h.level === 3 ? "pl-5" : "pl-3"} ${
                  active
                    ? "border-[#0d1b8e] text-[#0d1b8e] dark:border-blue-400 dark:text-blue-400 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
