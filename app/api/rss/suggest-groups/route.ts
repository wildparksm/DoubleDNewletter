import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import { chat } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const db = getDb();
  const body = await request.json().catch(() => ({}));
  const articleIds: number[] | undefined = Array.isArray(body.articleIds) ? body.articleIds : undefined;

  type Row = { id: number; title: string; summary: string };
  let articles: Row[];

  if (articleIds && articleIds.length > 0) {
    const ph = articleIds.map(() => "?").join(",");
    articles = db.prepare(
      `SELECT id, title, summary FROM rss_articles WHERE id IN (${ph}) AND status = 'new'`
    ).all(...articleIds) as Row[];
  } else {
    articles = db.prepare(
      "SELECT id, title, summary FROM rss_articles WHERE status = 'new' ORDER BY created_at DESC LIMIT 60"
    ).all() as Row[];
  }

  if (articles.length < 2) return NextResponse.json({ groups: [] });

  const list = articles
    .map(a => `[${a.id}] ${a.title}${a.summary ? ` — ${a.summary.slice(0, 120)}` : ""}`)
    .join("\n");

  const prompt = `아래는 RSS에서 수집한 IT 뉴스 기사 목록입니다.
주제·관점이 서로 보완적이어서 하나의 뉴스레터 아티클로 합성하면 시너지가 좋을 기사들을 그룹으로 묶어주세요.

규칙:
- 그룹당 2~4개 기사
- 단순히 같은 키워드 반복이 아닌, 합쳐서 더 풍부한 인사이트를 줄 수 있는 조합을 우선
- 모든 기사를 그룹에 넣을 필요 없음 (단독 처리가 나은 기사는 제외)
- 최대 5개 그룹

기사 목록:
${list}

JSON만 응답 (한국어, 설명 없이):
{"groups":[{"ids":[숫자,숫자],"title":"합성 후 예상 아티클 제목","reason":"묶는 이유 한 줄"}]}`;

  try {
    const raw = await chat(
      [{ role: "user", content: prompt }],
      { tier: "light", temperature: 0.3, max_tokens: 1000 }
    );
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ groups: [] });
    const parsed = JSON.parse(m[0]);
    const groups = (parsed.groups ?? []).filter(
      (g: { ids: number[]; title: string; reason: string }) =>
        Array.isArray(g.ids) && g.ids.length >= 2
    );
    return NextResponse.json({ groups });
  } catch (e) {
    console.error("[suggest-groups]", e);
    return NextResponse.json({ error: "AI 분석 실패" }, { status: 500 });
  }
}
