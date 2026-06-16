"use client";

import { useEffect, useState } from "react";

interface StatsData {
  growth: { date: string; new_subs: number; cumulative: number }[];
  nlPerf: { id: number; title: string; sent: number; opened: number; clicks: number }[];
  totalSubs: number;
}

// Tiny SVG sparkline
function Sparkline({ data, color = "#0d1b8e" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 200, h = 48, pad = 4;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
      const y = pad + (1 - v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
        fill={`url(#grad-${color.replace("#", "")})`}
        stroke="none"
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Horizontal bar
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function StatsCharts() {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse h-48" />
        ))}
      </div>
    );
  }

  const subCounts = data.growth.map((g) => g.new_subs);
  const maxSent = Math.max(...(data.nlPerf.map((n) => n.sent) || [1]), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Subscriber Growth */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">구독자 증가 추이</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{data.totalSubs.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">명</span></p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">최근 30일</span>
        </div>
        {subCounts.length > 1 ? (
          <div className="mt-2">
            <Sparkline data={subCounts} color="#0d1b8e" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{data.growth[0]?.date?.slice(5)}</span>
              <span>{data.growth[data.growth.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 text-gray-300 text-sm">
            데이터가 충분하지 않습니다
          </div>
        )}
        {subCounts.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            최근 30일 신규 <span className="font-semibold text-green-600">+{subCounts.reduce((a, b) => a + b, 0)}명</span>
          </p>
        )}
      </div>

      {/* Newsletter Performance */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">뉴스레터별 성과</p>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">최근 5개</span>
        </div>
        {data.nlPerf.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-300 text-sm">
            발행된 뉴스레터가 없습니다
          </div>
        ) : (
          <div className="space-y-4">
            {data.nlPerf.slice(0, 5).map((nl) => {
              const openRate = nl.sent > 0 ? Math.round((nl.opened / nl.sent) * 100) : 0;
              return (
                <div key={nl.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-[60%]">{nl.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-green-600 font-semibold">{openRate}%</span>
                      <span className="text-gray-300">|</span>
                      <span>{nl.sent}명</span>
                      {nl.clicks > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-[#00a3ff]">클릭 {nl.clicks}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Bar value={nl.opened} max={maxSent} color="#0d1b8e" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
