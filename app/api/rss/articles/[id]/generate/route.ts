import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import { chat, stripForeignChars, stripArticleBoilerplate, styleImageSources, sanitizeMarks } from "@/lib/ai";
import { SYSTEM_CONTENT, getCategoryTone, BLOCK_GUIDE, WRITING_RULES, TRANSLATION_RULES, needsTranslation } from "@/lib/newsletter-prompt";

function getCharLimit(): number {
  return process.env.CEREBRAS_API_KEY ? 20000 : 3500;
}

function getMaxOutputTokens(): number {
  // Cerebras gpt-oss-120b는 추론 모델이라 max_tokens 안에서 추론+본문을 함께 소비한다.
  // 8000이면 긴 기사에서 추론이 예산을 잠식해 본문이 비거나(→Groq 폴백) 잘리는 문제가 있어 16000으로 상향.
  // Groq는 TPD 한도가 있어 낮게 유지.
  return process.env.CEREBRAS_API_KEY ? 16000 : 4000;
}

/**
 * Jina 크롤 결과에서 본문 내 이미지 URL 추출.
 * 아이콘·로고·트래킹 픽셀 등 UI 이미지는 제외하고 콘텐츠 이미지만 반환.
 */
function extractContentImages(raw: string): string[] {
  const urls = new Set<string>();

  // 마크다운 이미지: ![alt](url)
  for (const m of raw.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)/g)) urls.add(m[1]);
  // HTML img 태그
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
  }).slice(0, 5);
}

/**
 * Jina 크롤 결과에서 실제 기사 본문만 추출.
 * Jina 응답 앞부분은 nav 메뉴 링크로 가득 차 있어 기사 본문이 뒤에 등장함.
 * 연속된 마크다운 링크 덩어리를 건너뛰고 실질 문단이 시작되는 지점부터 반환.
 */
function extractArticleBody(raw: string, charLimit: number): string {
  // Jina가 "Markdown Content:" 이후를 본문으로 표시하는 경우
  const mdIdx = raw.indexOf("Markdown Content:");
  const base = mdIdx >= 0 ? raw.slice(mdIdx) : raw;

  const lines = base.split("\n");
  // 1순위: 첫 '실질 한국어 문단'(40자+, 한글 포함, 링크·메뉴·헤딩·이미지 아님)을 본문 시작으로.
  //  → aitimes처럼 네비게이션 메뉴가 길어 기존 휴리스틱이 nav를 본문으로 오인하는 문제를 해결.
  let bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length >= 40 && /[가-힣]/.test(t) && !/^[[*\->#|!]/.test(t) && !/\]\(https?:/.test(t)) {
      bodyStart = lines.slice(0, i).join("\n").length;
      break;
    }
  }
  // 2순위(폴백): 실질 텍스트가 연속 3줄 나오는 지점
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
  console.log(`[crawl] 전체 ${raw.length}자, 본문 시작 오프셋 ${bodyStart}, 보일러플레이트 제거 후 ${body.length}자, 제한 후 ${Math.min(body.length, charLimit)}자`);
  return body.slice(0, charLimit);
}

async function crawlArticle(url: string): Promise<{ text: string; images: string[] }> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { text: "", images: [] };
    const raw = await res.text();
    return {
      text: extractArticleBody(raw, getCharLimit()),
      images: extractContentImages(raw),
    };
  } catch {
    return { text: "", images: [] };
  }
}

/**
 * 원문 HTML에서 직접 이미지를 추출한다.
 * Jina 텍스트 크롤은 이미지를 종종 떨궈서, 페이지에 이미지가 있어도 0개가 나오는 경우가 있다.
 * - og:image: 기사 대표 이미지 (거의 항상 존재)
 * - 본문 이미지: 파일명에 기사 고유 id(URL의 /article/<id>/ 또는 idxno=<id>)가 들어간 것만 선택
 *   → 같은 기사의 이미지만 골라내고 '관련기사' 썸네일·로고·배너는 자동 제외.
 */
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


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log("[generate] POST 진입");
  const session = await getSession();
  console.log("[generate] session:", session ? "있음" : "없음");
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const { category = "IT 트렌드" } = await request.json().catch(() => ({}));

  const db = getDb();
  const article = db.prepare("SELECT * FROM rss_articles WHERE id = ?").get(id) as {
    id: number; title: string; url: string; summary: string; source_name: string; image_url: string | null;
  } | undefined;

  if (!article) return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 422 });

  try {
    // 본문 크롤 + 이미지 병렬 수집 (Jina 본문 이미지 + 원문 HTML 이미지)
    const [crawlResult, htmlImages] = await Promise.all([
      crawlArticle(article.url),
      fetchHtmlImages(article.url),
    ]);
    const articleText = crawlResult.text || article.summary || article.title;
    // Jina가 추출한 본문 이미지 + 원문 HTML에서 뽑은 이미지를 병합(중복 제거), 최대 5장.
    // Jina가 이미지를 못 가져온 기사도 HTML 추출로 이미지를 확보한다.
    const inlineImages = [...new Set([...crawlResult.images, ...htmlImages.content])].slice(0, 5);
    // 커버 우선순위: RSS 썸네일(기사 고유) → 본문 첫 이미지 → og:image
    const coverImage = article.image_url || inlineImages[0] || htmlImages.og || null;

    // 크롤 실패 감지: 제목+요약만 있으면 내용 부족 경고
    const isCrawlFailed = !crawlResult.text || crawlResult.text.length < 300;
    if (isCrawlFailed && (!article.summary || article.summary.length < 100)) {
      return NextResponse.json({
        error: "기사 본문을 가져오지 못했습니다. 원문 사이트가 크롤을 차단하거나 내용이 너무 짧습니다. 원문을 직접 확인 후 내용을 붙여넣어 수동으로 작성해주세요.",
        crawlFailed: true,
        url: article.url,
      }, { status: 422 });
    }

    const imageSection = inlineImages.length > 0
      ? `\n== 본문 삽입 가능 이미지 (${inlineImages.length}개) ==\n아래 이미지를 본문 흐름에 맞는 위치(관련 문단 바로 뒤)에 삽입하세요. 제공된 이미지는 가능한 한 많이(최소 2장, 있으면 더) 본문 곳곳에 분산 배치해 글을 시각적으로 풍성하게 만드세요. 명백히 무관한 이미지(로고·광고·UI)만 제외하세요.\n${inlineImages.map((u, i) => `[이미지${i + 1}] ${u}`).join("\n")}\n삽입 형식: <figure><img src="URL" alt="이미지 설명" style="width:100%;border-radius:8px;margin:16px 0"><figcaption>간단한 설명(선택)</figcaption></figure>\n`
      : "";

    // 영문 등 외국어 원문일 때만 번역 정확도 규칙을 주입 (한글 원문엔 불필요 → 글쓰기 지침 희석 방지)
    const translationBlock = needsTranslation(articleText) ? `\n\n${TRANSLATION_RULES}` : "";

    const rawContent = await chat([
      { role: "system", content: SYSTEM_CONTENT },
      {
        role: "user",
        content: `아래 기사 원문을 뉴스레터 HTML 형식으로 변환하세요.

⚠️ 핵심 지침:
- 원문의 모든 문장·수치·인물명·기업명·제품명·예시를 빠짐없이 포함하세요. 단 하나도 생략하면 안 됩니다.
- 원문에 없는 내용은 절대 추가하지 마세요.
- 할 일은 말투(해요체)와 HTML 구조 변환뿐입니다.
- 원문이 길수록 뉴스레터도 길어야 합니다. 원문의 각 단락을 모두 커버하세요.

출처: ${article.source_name}
제목: ${article.title}
URL: ${article.url}
카테고리: ${category}
카테고리 톤: ${getCategoryTone(category)}

== 기사 원문 ==
${articleText}
${imageSection}
${BLOCK_GUIDE}

${WRITING_RULES}${translationBlock}

본문 HTML을 모두 작성한 뒤, 맨 마지막 줄에 아래 형식을 추가하세요 (원문의 구체적 수치·기업명·제품명을 제목에 반드시 포함):
<!--META:{"title":"제목(40자이내, 이모지 1~2개. 독자의 호기심을 자극하는 후킹형 — 궁금증을 유발하는 의문형/반전형/핵심수치 강조 중 택1. 원문의 핵심 사실·수치·고유명사를 살리되 원문에 없는 내용·과장은 금지하고 원문 제목의 취지·톤을 벗어나지 말 것)","card_title":"핵심 키워드(15자이내)","summary":"독자가 이 글을 읽어야 하는 이유 한 문장(60자이내)"}-->`,
      },
    ], { temperature: 0.2, max_tokens: getMaxOutputTokens() });

    const metaMatch = rawContent.match(/<!--META:([\s\S]*?)-->/);
    let meta: Record<string, string> = {};
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[1].trim()); } catch (e) {
        console.warn("[generate] META 파싱 실패, 기본값 사용:", e);
      }
    } else {
      console.warn("[generate] META 블록 없음, 기본값 사용. article.id:", id);
    }
    let htmlContent = stripForeignChars(rawContent.replace(/<!--META:[\s\S]*?-->/, "").trim());

    // AI가 본문에 이미지를 하나도 안 넣었으면 본문 이미지 1장을 자동 삽입.
    // 본문 이미지가 아예 없으면 og:image라도 넣어 최소 1장은 확보.
    if (!/<img\b/i.test(htmlContent)) {
      const bodyImg = inlineImages.find((u) => u !== coverImage) ?? inlineImages[0] ?? htmlImages.og;
      if (bodyImg) {
        htmlContent = `<figure style="margin:16px 0"><img src="${bodyImg}" alt="" style="width:100%;border-radius:8px"></figure>\n${htmlContent}`;
      }
    }

    // 본문 이미지를 일관된 캡션 스타일로 정규화하고 출처(매체명) 표기 → 본문 글과 구분
    htmlContent = styleImageSources(htmlContent, () => article.source_name);
    // <mark> 무결성 보정 (닫힘 누락으로 형광이 문단 전체를 삼키는 문제 방지)
    htmlContent = sanitizeMarks(htmlContent);

    const cleanTitle = stripForeignChars(meta.title || article.title);
    const cleanCardTitle = stripForeignChars(meta.card_title || "");
    const cleanSummary = stripForeignChars(meta.summary || article.summary || "");

    const result = db.prepare(`
      INSERT INTO newsletters (title, card_title, summary, content, cover_image, category, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanTitle, cleanCardTitle, cleanSummary, htmlContent, coverImage, category, session.id);

    db.prepare("UPDATE rss_articles SET status = 'used' WHERE id = ?").run(id);

    return NextResponse.json({ id: result.lastInsertRowid, message: "초안이 생성되었습니다." }, { status: 201 });

  } catch (err) {
    console.error("[generate] 생성 실패:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `생성 실패: ${message}` }, { status: 500 });
  }
}
