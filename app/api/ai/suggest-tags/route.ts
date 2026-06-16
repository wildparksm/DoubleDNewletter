import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { chat } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { title, summary, content } = await request.json();
  if (!title && !summary && !content) {
    return NextResponse.json({ error: "내용을 먼저 입력해주세요." }, { status: 400 });
  }

  // 본문에서 텍스트만 추출 (HTML 제거), 최대 1500자
  const plainContent = (content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

  const prompt = [
    title    && `제목: ${title}`,
    summary  && `요약: ${summary}`,
    plainContent && `본문: ${plainContent}`,
  ].filter(Boolean).join("\n");

  const result = await chat(
    [
      {
        role: "system",
        content: `당신은 IT 뉴스레터 태그 추천 전문가입니다.
아티클의 제목/요약/본문을 분석해서 핵심 태그만 추천하세요.

규칙:
- 3~5개만 추천 (적을수록 좋음, 절대 5개 초과 금지)
- 독자가 "이 태그로 비슷한 글을 찾겠다"고 클릭할 만한 것만
- 고유명사(기업, 제품, 인물)는 원어 그대로 (예: Microsoft, Claude, iPhone)
- 한국어 기술 용어는 한국어로 (예: 반도체, 사이버보안, 자율주행)
- 금지: AI, IT, 기술, 뉴스, 인터넷, 디지털 등 너무 범용적인 단어
- 금지: 카테고리명과 겹치는 단어 (예: 인공지능, 보안, 클라우드 단독 사용)
- JSON 배열로만 응답, 설명 없이

예시: ["Microsoft", "Copilot", "업무자동화"]`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    { tier: "light", temperature: 0.4, max_tokens: 200 }
  );

  // JSON 배열 파싱
  try {
    const match = result.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error("no array");
    const tags: string[] = JSON.parse(match[0]);
    const clean = tags
      .map(t => String(t).trim().replace(/^#/, ""))
      .filter(t => t.length > 0 && t.length <= 30)
      .slice(0, 5);
    return NextResponse.json({ tags: clean });
  } catch {
    // 파싱 실패 시 쉼표 분리 폴백
    const fallback = result
      .replace(/[\[\]"']/g, "")
      .split(/[,\n]/)
      .map(t => t.trim().replace(/^#/, ""))
      .filter(t => t.length > 0 && t.length <= 30)
      .slice(0, 5);
    return NextResponse.json({ tags: fallback });
  }
}
