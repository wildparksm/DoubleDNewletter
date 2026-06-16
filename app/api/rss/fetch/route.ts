import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import getDb from "@/lib/db";
import { filterItRelevant } from "@/lib/rss-filter";

async function fetchWithFallback(url: string): Promise<string> {
  // 1차: 직접 접근
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return await res.text();
  } catch { /* 직접 접근 실패 */ }

  // 2차: Jina Reader 경유 (회사망 차단 우회)
  const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(15000),
  });
  if (!jinaRes.ok) throw new Error(`Jina fetch failed: ${jinaRes.status}`);
  return await jinaRes.text();
}

function decodeHtml(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractImageFromItem(item: string): string {
  // 1. media:content url
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
  if (media) return media;
  // 2. media:thumbnail url (국내 뉴스 RSS에서 가장 많이 사용)
  const thumbnail = item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
  if (thumbnail) return thumbnail;
  // 3. enclosure url (image 타입)
  const enclosure = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/i)?.[1]
    ?? item.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i)?.[1];
  if (enclosure) return enclosure;
  // 4. content:encoded 내 첫 번째 img src (CDATA 포함)
  const encoded = item.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1] ?? "";
  if (encoded) {
    const encodedImg = encoded.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (encodedImg) return encodedImg;
  }
  // 5. description 내 첫 번째 img src (일반 태그 및 entity-encoded 모두 처리)
  const desc = item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] ?? "";
  if (desc) {
    const descImg = desc.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (descImg) return descImg;
    // entity-encoded: &lt;img src=&quot;...&quot;&gt;
    const decoded = desc.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    const decodedImg = decoded.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (decodedImg) return decodedImg;
  }
  return "";
}

type ParsedItem = { title: string; link: string; summary: string; pubDate: string; imageUrl: string };

async function parseRss(url: string, count = 20): Promise<{ title: string; link: string; summary: string; pubDate: string; imageUrl: string }[]> {
  const xml = await fetchWithFallback(url);

  const items: { title: string; link: string; summary: string; pubDate: string; imageUrl: string }[] = [];
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of matches) {
    const item = match[1];
    const title = decodeHtml((
      item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      item.match(/<title>(.*?)<\/title>/)?.[1] ?? ""
    ).trim());
    const link = (
      item.match(/<link>(.*?)<\/link>/)?.[1] ??
      item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? ""
    ).trim();
    const summary = decodeHtml((
      item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
      item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ""
    ).replace(/<[^>]+>/g, "").trim().slice(0, 300));
    const pubDate = (
      item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ""
    ).trim();
    const imageUrl = extractImageFromItem(item);

    if (title && link) items.push({ title, link, summary, pubDate, imageUrl });
    if (items.length >= count) break;
  }
  return items;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const perSource = Math.min(Math.max(parseInt(body.perSource) || 20, 1), 100);
  const sourceIds: number[] | undefined = Array.isArray(body.sourceIds) ? body.sourceIds : undefined;

  const db = getDb();
  const allSources = db.prepare("SELECT * FROM rss_sources").all() as { id: number; name: string; url: string }[];
  const sources = sourceIds && sourceIds.length > 0
    ? allSources.filter((s) => sourceIds.includes(s.id))
    : allSources;

  if (sources.length === 0) {
    return NextResponse.json({ error: "등록된 RSS 소스가 없습니다." }, { status: 400 });
  }

  let added = 0;
  let failed = 0;
  let skipped = 0;

  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO rss_articles (source_id, source_name, title, url, summary, image_url, pub_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((items: ParsedItem[], srcId: number, srcName: string): number => {
    let count = 0;
    for (const item of items) {
      const result = insertArticle.run(srcId, srcName, item.title, item.link, item.summary, item.imageUrl || null, item.pubDate);
      if (result.changes > 0) count++;
    }
    return count;
  });

  await Promise.allSettled(
    sources.map(async (src) => {
      try {
        const items = await parseRss(src.url, perSource);
        const filtered = await filterItRelevant(items);
        skipped += items.length - filtered.length;
        added += insertBatch(filtered, src.id, src.name);
      } catch {
        failed++;
      }
    })
  );

  return NextResponse.json({ added, skipped, failed, message: `${added}개 새 기사를 가져왔습니다. (IT 무관 ${skipped}개 제외)` });
}
