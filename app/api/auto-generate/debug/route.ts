import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tavily } from "@tavily/core";

const CATEGORY_QUERIES: Record<string, string> = {
  "IT 트렌드":  "최신 IT 기술 트렌드 2026",
  "AI":  "AI 인공지능 머신러닝 최신 뉴스 2026",
  "보안":       "사이버 보안 해킹 취약점 최신 뉴스 2026",
  "개발·기술":  "소프트웨어 개발 기술 최신 동향 2026",
  "인프라":     "클라우드 인프라 서버 네트워크 최신 뉴스 2026",
  "사내 소식":  "IT 기업 디지털 전환 혁신 사례 2026",
  "기타":       "IT 테크 뉴스 최신 2026",
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const category = request.nextUrl.searchParams.get("category") ?? "IT 트렌드";
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  const query = CATEGORY_QUERIES[category] ?? CATEGORY_QUERIES["IT 트렌드"];

  const response = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 5,
    includeAnswer: false,
    includeRawContent: false,
  });

  return NextResponse.json({
    query,
    results: response.results.map((r) => ({
      title: r.title,
      url: r.url,
      score: r.score,
      contentLength: r.content.length,
      content: r.content,
    })),
  });
}
