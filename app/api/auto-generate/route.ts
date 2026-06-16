import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import { chat, stripForeignChars } from "@/lib/ai";
import { SYSTEM_CONTENT, getCategoryTone, BLOCK_GUIDE, WRITING_RULES, extractFacts } from "@/lib/newsletter-prompt";

const NEWS_SITES = [
  { name: "AI타임스", rss: "https://cdn.aitimes.com/rss/gn_rss_allArticle.xml" },
];

interface Article { title: string; url: string; content: string; }

async function fetchRssArticleUrls(rssUrl: string, count = 5): Promise<{ title: string; url: string }[]> {
  const res = await fetch(rssUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const items: { title: string; url: string }[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
    const link = (item.match(/<link>(.*?)<\/link>/)?.[1] ?? item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? "").trim();
    if (title && link) { items.push({ title, url: link }); if (items.length >= count) break; }
  }
  return items;
}

async function crawlArticle(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return "";
  return (await res.text()).slice(0, 6000); // 컨텍스트 확대
}

async function fetchArticles(): Promise<Article[]> {
  const articles: Article[] = [];
  for (const site of NEWS_SITES) {
    try {
      const urls = await fetchRssArticleUrls(site.rss, 5);
      const crawled = await Promise.allSettled(
        urls.slice(0, 3).map(async (item) => ({
          title: item.title,
          url: item.url,
          content: await crawlArticle(item.url),
        }))
      );
      for (const r of crawled) {
        if (r.status === "fulfilled" && r.value.content) articles.push(r.value);
      }
    } catch (e) {
      console.error(`[auto-generate] ${site.name} 크롤 실패:`, e);
    }
  }
  return articles;
}


export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const category: string = body.category ?? "AI";

  try {
    const articles = await fetchArticles();
    if (articles.length === 0) {
      return NextResponse.json({ error: "기사를 가져오지 못했습니다." }, { status: 502 });
    }

    // Pass 1: 각 기사 핵심 사실 병렬 추출
    const factsArray = await Promise.all(
      articles.map((a) => extractFacts(`${a.title}\n출처: ${a.url}\n\n${a.content}`))
    );

    const articlesText = articles
      .map((a, i) => {
        const facts = factsArray[i];
        return facts
          ? `[${i + 1}] ${a.title}\n출처: ${a.url}\n\n▶ 핵심 사실:\n${facts}\n\n▶ 원문 참조:\n${a.content.slice(0, 2000)}`
          : `[${i + 1}] ${a.title}\n출처: ${a.url}\n\n${a.content}`;
      })
      .join("\n\n========\n\n");

    // Pass 2: 중량 모델로 HTML 생성
    const rawContent = await chat([
      { role: "system", content: SYSTEM_CONTENT },
      {
        role: "user",
        content: `아래 기사들 중 가장 흥미롭고 유용한 1건을 골라 사내 IT 뉴스레터 본문을 작성하세요.
각 기사의 "핵심 사실" 항목에 있는 내용을 반드시 반영하고, 없는 내용은 추가하지 마세요.

카테고리: ${category}
카테고리 톤: ${getCategoryTone(category)}

== 기사 원문 ==
${articlesText}

${BLOCK_GUIDE}

== 구성 순서 (이 순서대로 작성) ==
1. [소제목] <p class="subtitle">: 제목의 다른 각도·보완 설명 한 문장
2. [도입부] <p> 1~2개: 최근 이슈 훅 → "함께 살펴봐요!" 초대로 마무리
3. [본문 섹션 3~4개] <h2>주제 키워드: 독자 질문?</h2>
   - 여러 포인트: <ul> 이모지 불릿
   - 단계적 내용: <ol> 번호 목록
   - 핵심 수치·발언: <blockquote>
   - 알아두면 좋은 포인트: 강조 박스 div
   - 각 섹션 사이 <hr> 로 구분
4. [마지막 섹션] 전망·시사점
5. [원문 링크] 마지막에 CTA 버튼으로 원문 URL 연결

${WRITING_RULES}
- 총 1,500자 이상

본문 HTML을 모두 작성한 뒤, 맨 마지막 줄에 아래 형식을 추가하세요 (선택한 기사의 구체적 수치·기업명·제품명을 제목에 반드시 포함):
<!--META:{"selected_article":선택한기사번호,"title":"제목(40자이내, 수치/고유명사 포함, 이모지 1~2개, 의문형/감탄형/반전형 중 택1)","card_title":"핵심 키워드(15자이내)","summary":"읽어야 하는 이유 한 문장(60자이내)"}-->`,
      },
    ], { temperature: 0.75, max_tokens: 6300 });

    const metaMatch = rawContent.match(/<!--META:([\s\S]*?)-->/);
    let meta: Record<string, string | number> = {};
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[1].trim()); } catch (e) {
        console.warn("[auto-generate] META 파싱 실패, 기본값 사용:", e);
      }
    } else {
      console.warn("[auto-generate] META 블록 없음, 기본값 사용.");
    }
    const htmlContent = stripForeignChars(rawContent.replace(/<!--META:[\s\S]*?-->/, "").trim());
    const selectedIdx = typeof meta.selected_article === "number" ? meta.selected_article - 1 : 0;
    const usedArticle = articles[selectedIdx] ?? articles[0];

    const db = getDb();
    const result = db
      .prepare(`INSERT INTO newsletters (title, card_title, summary, content, category, author_id) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(
        stripForeignChars(String(meta.title || usedArticle.title)),
        stripForeignChars(String(meta.card_title || "")),
        stripForeignChars(String(meta.summary || "")),
        htmlContent,
        category,
        session.id,
      );

    return NextResponse.json({ id: result.lastInsertRowid, title: meta.title, source_url: usedArticle.url, message: "초안이 생성되었습니다." }, { status: 201 });
  } catch (err) {
    console.error("[auto-generate] error:", err);
    return NextResponse.json({ error: `생성 실패: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }
}
