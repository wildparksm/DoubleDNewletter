import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import { chat, stripForeignChars, stripArticleBoilerplate, styleImageSources, sanitizeMarks } from "@/lib/ai";
import { MULTI_SYSTEM_CONTENT, getCategoryTone, BLOCK_GUIDE, WRITING_RULES, TRANSLATION_RULES, needsTranslation } from "@/lib/newsletter-prompt";

interface ArticleRow {
  id: number; title: string; url: string;
  summary: string; source_name: string; image_url: string | null;
}

function extractArticleBody(raw: string, charLimit: number): string {
  const mdIdx = raw.indexOf("Markdown Content:");
  const base = mdIdx >= 0 ? raw.slice(mdIdx) : raw;

  const lines = base.split("\n");
  // 1순위: 첫 '실질 한국어 문단'(40자+, 한글 포함, 링크·메뉴·헤딩 아님) → nav가 긴 사이트 본문 시작 정확히 탐지
  let bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length >= 40 && /[가-힣]/.test(t) && !/^[[*\->#|!]/.test(t) && !/\]\(https?:/.test(t)) {
      bodyStart = lines.slice(0, i).join("\n").length;
      break;
    }
  }
  if (bodyStart < 0) {
    bodyStart = 0;
    let realLineCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isNavLine = /^\[.*\]\(.*\)$/.test(line) || line === "" || /^[*\-=>#]/.test(line) || line.length < 10;
      if (!isNavLine) {
        realLineCount++;
        if (realLineCount >= 3) { bodyStart = lines.slice(0, Math.max(0, i - 2)).join("\n").length; break; }
      } else {
        realLineCount = 0;
      }
    }
  }

  const body = stripArticleBoilerplate(base.slice(bodyStart));
  console.log(`[crawl-multi] 전체 ${raw.length}자, 본문 오프셋 ${bodyStart}, 보일러플레이트 제거 후 ${body.length}자, 제한 후 ${Math.min(body.length, charLimit)}자`);
  return body.slice(0, charLimit);
}

function extractContentImages(raw: string): string[] {
  const urls = new Set<string>();
  for (const m of raw.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)/g)) urls.add(m[1]);
  for (const m of raw.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) urls.add(m[1]);
  return [...urls].filter(url => {
    if (url.startsWith("data:")) return false;
    if (url.endsWith(".svg")) return false;
    if (/\/(icon|logo|avatar|sprite|favicon|tracking|pixel|badge|button|arrow|close|menu|share|social)\b/i.test(url)) return false;
    // 광고·배너 (aitimes의 /bannerpop/ 등). \b 경계 없이 부분 일치로 'bannerpop'까지 차단
    if (/banner|\/ads?[\/_-]|\/ad[\/_-]|advert|promotion|sponsor|popup|\/member\/|\/reporter\/|gstatic|googlelogo/i.test(url)) return false;
    if (/[_-](icon|logo|avatar|sm|xs|tiny|mini|small)\b/i.test(url)) return false;
    if (/1x1|pixel|tracker/i.test(url)) return false;
    return true;
  }).slice(0, 3); // 멀티는 기사당 3개로 제한
}

async function crawlArticle(url: string, charLimit: number): Promise<{ text: string; images: string[] }> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { text: "", images: [] };
    const raw = await res.text();
    return {
      text: extractArticleBody(raw, charLimit),
      images: extractContentImages(raw),
    };
  } catch {
    return { text: "", images: [] };
  }
}

// 원문 HTML에서 직접 이미지 추출 (Jina 텍스트 크롤이 이미지를 떨구는 경우 대비).
// og:image + 파일명에 기사 고유 id가 들어간 본문 이미지만 선택(관련기사 썸네일·로고 제외).
async function fetchHtmlImages(url: string): Promise<{ og: string; content: string[] }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { og: "", content: [] };
    const html = await res.text();
    const og = (
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      ""
    ).replace(/&amp;/g, "&");
    const id = (url.match(/\/article\/(\d+)/) ?? url.match(/idxno=(\d+)/))?.[1] ?? null;
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
    const content = [...new Set(imgs)].filter((u) =>
      /\.(jpe?g|png|webp)/i.test(u) &&
      !/logo|icon|banner|sprite|favicon|sns|btn|avatar|profile|thumb_/i.test(u) &&
      (!id || u.includes(id))
    );
    return { og, content };
  } catch {
    return { og: "", content: [] };
  }
}


export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: number[] = body.ids ?? [];
  const category: string = body.category ?? "IT 트렌드";

  if (ids.length < 2) return NextResponse.json({ error: "기사를 2개 이상 선택하세요." }, { status: 400 });
  if (ids.length > 5) return NextResponse.json({ error: "기사는 최대 5개까지 선택 가능합니다." }, { status: 400 });

  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const articles = db.prepare(`SELECT * FROM rss_articles WHERE id IN (${placeholders})`).all(...ids) as ArticleRow[];

  if (articles.length === 0) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 422 });

  // Cerebras면 넉넉하게, Groq 폴백이면 TPM 한도 내로 제한
  const hasCerebras = !!process.env.CEREBRAS_API_KEY;
  const totalCharLimit = hasCerebras ? 24000 : 4000;
  const charPerArticle = Math.floor(totalCharLimit / articles.length);

  // 모든 기사 병렬 크롤 + 대표 이미지 수집
  const crawled = await Promise.all(
    articles.map(async (a) => {
      const [crawlResult, htmlImages] = await Promise.all([
        crawlArticle(a.url, charPerArticle),
        fetchHtmlImages(a.url),
      ]);
      // Jina 본문 이미지 + 원문 HTML 이미지 병합(중복 제거), 기사당 최대 3장
      const images = [...new Set([...crawlResult.images, ...htmlImages.content])].slice(0, 3);
      return {
        ...a,
        content: crawlResult.text || a.summary || a.title,
        images,
        // 커버 우선순위: RSS 썸네일 → 본문 첫 이미지 → og:image
        image: a.image_url || images[0] || htmlImages.og || null,
      };
    })
  );

  // 대표 이미지: 첫 번째로 이미지 있는 기사 사용
  const coverImage = crawled.find((a) => a.image)?.image ?? null;

  // 크롤 실패 감지: 기사 전체가 제목뿐이면 차단
  const poorArticles = crawled.filter((a) => a.content.length < 200);
  if (poorArticles.length === crawled.length) {
    return NextResponse.json({
      error: "선택한 기사들의 본문을 모두 가져오지 못했습니다. 원문 사이트가 크롤을 차단했을 수 있습니다. 본문이 충분한 기사를 선택해주세요.",
      crawlFailed: true,
    }, { status: 422 });
  }

  // 합성용 텍스트 구성 (크롤 성공 기사만 사용)
  const usableArticles = crawled.filter((a) => a.content.length >= 200);

  const articlesBlock = usableArticles
    .map((a, i) => {
      const imgSection = a.images.length > 0
        ? `\n[이미지]\n${a.images.map((u, j) => `[이미지${j + 1}] ${u}`).join("\n")}`
        : "";
      return `[기사 ${i + 1}] ${a.source_name} — ${a.title}\n${a.content}${imgSection}`;
    })
    .join("\n\n─────────────────────────────\n\n");

  // 영문 등 외국어 원문이 섞여 있으면 번역 정확도 규칙을 주입 (한글 기사만이면 생략)
  const translationBlock = needsTranslation(articlesBlock) ? `\n\n${TRANSLATION_RULES}` : "";

  try {
    // Pass 2: 중량 모델로 통합 HTML 생성
    const rawContent = await chat([
      { role: "system", content: MULTI_SYSTEM_CONTENT },
      {
        role: "user",
        content: `아래 ${usableArticles.length}개의 기사 원문을 하나의 통합 뉴스레터 HTML 형식으로 변환하세요.

⚠️ 핵심 지침:
- 각 기사의 모든 문장·수치·인물명·기업명·제품명·예시를 빠짐없이 포함하세요. 단 하나도 생략하면 안 됩니다.
- 원문에 없는 내용은 절대 추가하지 마세요.
- 할 일은 말투(해요체)와 HTML 구조 변환뿐입니다.
- 기사들이 길수록 뉴스레터도 길어야 합니다. 각 기사의 모든 단락을 커버하세요.
- 기사들 사이에 자연스러운 공통 흐름이 있으면 엮어서 구성하고, 없으면 각 기사를 독립 섹션으로 배치하세요.
- 각 기사에 [이미지] 항목이 있으면 해당 기사 섹션 안 관련 내용 바로 뒤에 삽입하세요. 기사마다 가능하면 1장은 넣어 시각적으로 풍성하게 만드세요. 명백히 무관한 이미지(로고·광고·UI)만 제외하세요.
  삽입 형식: <figure><img src="URL" alt="이미지 설명" style="width:100%;border-radius:8px;margin:16px 0"><figcaption>간단한 설명(선택)</figcaption></figure>

카테고리: ${category}
카테고리 톤: ${getCategoryTone(category)}

== 기사들 ==
${articlesBlock}

${BLOCK_GUIDE}

${WRITING_RULES}${translationBlock}

본문 HTML을 모두 작성한 뒤, 맨 마지막 줄에 아래 형식을 추가하세요 (원문의 구체적 수치·기업명·제품명을 제목에 반드시 포함):
<!--META:{"title":"제목(40자이내, 이모지 1~2개. 독자의 호기심을 자극하는 후킹형 — 궁금증을 유발하는 의문형/반전형/핵심수치 강조 중 택1. 원문의 핵심 사실·수치·고유명사를 살리되 원문에 없는 내용·과장은 금지하고 원문 취지·톤을 벗어나지 말 것)","card_title":"핵심 키워드(15자이내)","summary":"독자가 이 글을 읽어야 하는 이유 한 문장(60자이내)"}-->`,
      },
      // Cerebras(추론 모델)는 추론+본문이 max_tokens를 공유하므로 여유를 크게 준다 (8000→16000). Groq는 TPD 한도로 낮게 유지.
    ], { temperature: 0.2, max_tokens: hasCerebras ? 16000 : 4000 });

    const metaMatch = rawContent.match(/<!--META:([\s\S]*?)-->/);
    let meta: Record<string, string> = {};
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[1].trim()); } catch (e) {
        console.warn("[generate-multi] META 파싱 실패, 기본값 사용:", e);
      }
    } else {
      console.warn("[generate-multi] META 블록 없음, 기본값 사용. ids:", ids);
    }
    let htmlContent = stripForeignChars(rawContent.replace(/<!--META:[\s\S]*?-->/, "").trim());

    // AI가 본문에 이미지를 하나도 안 넣었으면 커버와 다른 본문 이미지 1장을 자동 삽입
    if (!/<img\b/i.test(htmlContent)) {
      const bodyImg = usableArticles.flatMap((a) => a.images).find((u) => u !== coverImage);
      if (bodyImg) {
        htmlContent = `<figure style="margin:16px 0"><img src="${bodyImg}" alt="" style="width:100%;border-radius:8px"></figure>\n${htmlContent}`;
      }
    }

    // 이미지 URL → 출처(매체명) 매핑 후 캡션 스타일 정규화 + 출처 표기
    const imgSource = new Map<string, string>();
    for (const a of crawled) for (const u of a.images) imgSource.set(u, a.source_name);
    htmlContent = styleImageSources(htmlContent, (src) => imgSource.get(src) ?? "");
    htmlContent = sanitizeMarks(htmlContent);

    const cleanTitle = stripForeignChars(meta.title || articles[0].title);
    const cleanCardTitle = stripForeignChars(meta.card_title || "");
    const cleanSummary = stripForeignChars(meta.summary || "");

    const result = db.prepare(`
      INSERT INTO newsletters (title, card_title, summary, content, cover_image, category, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanTitle, cleanCardTitle, cleanSummary, htmlContent, coverImage, category, session.id);

    db.prepare(`UPDATE rss_articles SET status = 'used' WHERE id IN (${placeholders})`).run(...ids);

    return NextResponse.json({ id: result.lastInsertRowid, message: `${articles.length}개 기사를 합성해 초안을 생성했습니다.` }, { status: 201 });

  } catch (err) {
    console.error("[generate-multi] 생성 실패:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `생성 실패: ${message}` }, { status: 500 });
  }
}
