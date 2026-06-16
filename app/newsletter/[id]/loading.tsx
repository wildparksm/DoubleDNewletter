// 기사 로딩 중 즉시 보여줄 스켈레톤 (App Router Suspense fallback)
export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-5 pt-8 animate-pulse">
        {/* 뒤로가기 */}
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-7" />

        {/* 카테고리 + 읽기시간 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-14 rounded bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* 제목 */}
        <div className="space-y-3 mb-5">
          <div className="h-8 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-3/4 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* 요약 */}
        <div className="space-y-2 mb-6">
          <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-5/6 rounded bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* 메타 */}
        <div className="flex items-center gap-2 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* 커버 */}
        <div className="aspect-[2/1] rounded-2xl bg-gray-100 dark:bg-gray-800 my-6" />

        {/* 본문 */}
        <div className="space-y-3 py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`h-4 rounded bg-gray-100 dark:bg-gray-800 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
