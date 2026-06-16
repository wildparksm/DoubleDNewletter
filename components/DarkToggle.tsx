"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  storageKey: string;
}

const DARK_TRACK = "#34323D";

export default function DarkToggle({ storageKey }: Props) {
  const id = useId();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) === "1";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
    setMounted(true);
  }, [storageKey]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
    document.documentElement.classList.toggle("dark", next);
  };

  if (!mounted) return <div className="w-[52px] h-[26px]" />;

  return (
    <label
      htmlFor={id}
      title={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="relative inline-flex items-center cursor-pointer select-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <input
        id={id}
        type="checkbox"
        checked={dark}
        onChange={toggle}
        className="sr-only"
      />

      {/* 트랙 */}
      <span
        className="relative inline-block rounded-full transition-colors duration-300"
        style={{
          width: 52,
          height: 26,
          backgroundColor: dark ? DARK_TRACK : "rgba(0,0,0,0.12)",
          boxShadow: dark
            ? "inset 0 1px 4px rgba(0,0,0,.5)"
            : "inset 0 1px 3px rgba(0,0,0,.15)",
        }}
      >
        {/* 썸 */}
        <span
          className="absolute top-[3px] rounded-full overflow-hidden transition-all duration-300"
          style={{
            width: 20,
            height: 20,
            left: dark ? 29 : 3,
            background: dark
              ? "linear-gradient(40deg, #8983F7, #A3DAFB 70%)"
              : "linear-gradient(40deg, #FF0080, #FF8C00 70%)",
            boxShadow: "0 2px 6px rgba(0,0,0,.3)",
          }}
        >
          {/* 초승달 컷아웃 — 트랙 색으로 오버레이해 달 모양 연출 */}
          <span
            className="absolute rounded-full"
            style={{
              width: 14,
              height: 14,
              top: 0,
              right: 0,
              backgroundColor: DARK_TRACK,
              transformOrigin: "top right",
              transform: dark ? "scale(1)" : "scale(0)",
              transition: "transform .5s cubic-bezier(0.645, 0.045, 0.355, 1)",
            }}
          />
        </span>
      </span>

    </label>
  );
}
