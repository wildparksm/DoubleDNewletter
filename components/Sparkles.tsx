// AI 버튼용 장식 스파클 (CSS-only, 의존성 없음). 부모 버튼은 relative여야 함.
const STAR = "M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z";

export default function Sparkles() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="absolute left-2 top-1.5 w-2 h-2 fill-white/90 animate-sparkle">
        <path d={STAR} />
      </svg>
      <svg viewBox="0 0 24 24" className="absolute left-6 bottom-1.5 w-1.5 h-1.5 fill-white/80 animate-sparkle" style={{ animationDelay: "0.7s" }}>
        <path d={STAR} />
      </svg>
      <svg viewBox="0 0 24 24" className="absolute left-3.5 top-3 w-1 h-1 fill-white/70 animate-sparkle" style={{ animationDelay: "1.2s" }}>
        <path d={STAR} />
      </svg>
    </span>
  );
}
