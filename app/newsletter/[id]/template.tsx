// 기사 라우트 전환용 template — 네비게이션마다 재마운트되어 진입 애니메이션을 재생한다.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
