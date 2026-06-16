import Link from "next/link";

// ── 사이즈 프리셋 ────────────────────────────────────────────
const SIZES = {
  xs:  { imgH: 32, wordmark: "text-sm",   tag: "text-[9px]",  gap: "gap-1.5" },
  sm:  { imgH: 40, wordmark: "text-base", tag: "text-[9px]",  gap: "gap-2"   },
  md:  { imgH: 48, wordmark: "text-xl",   tag: "text-[10px]", gap: "gap-2.5" },
  lg:  { imgH: 60, wordmark: "text-2xl",  tag: "text-xs",     gap: "gap-3"   },
  xl:  { imgH: 72, wordmark: "text-3xl",  tag: "text-sm",     gap: "gap-3.5" },
} as const;

interface LogoProps {
  size?:      keyof typeof SIZES;
  href?:      string | null;
  onDark?:    boolean;
  className?: string;
}

export default function Logo({
  size      = "md",
  href      = "/",
  onDark    = false,
  className = "",
}: LogoProps) {
  const s = SIZES[size];

  // 투명 배경 로고 이미지. onDark(항상 어두운 배경)는 흰색 실루엣으로,
  // 일반 컨텍스트는 다크모드일 때만 흰색 실루엣으로 반전.
  const inner = (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="대덕.it — 대덕의 IT, 소식을 잇다"
        style={{ height: s.imgH, width: "auto", display: "block" }}
        className={onDark ? "brightness-0 invert" : "dark:brightness-0 dark:invert"}
      />
    </span>
  );

  if (href === null) return inner;
  return <Link href={href}>{inner}</Link>;
}
