/**
 * AI 생성 클라이언트
 * - CEREBRAS_API_KEY 있으면 Cerebras 사용 (빠름, 무료)
 * - 없으면 Groq 폴백 (llama-3.3-70b-versatile)
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * CJK 한자·일본어·태국어 등 비한글 문자 제거.
 * \uXXXX 이스케이프만 사용 (리터럴 문자 사용 시 인코딩 오해석 위험).
 * 한글 음절 U+AC00-U+D7A3 은 모든 제거 범위 밖이므로 안전.
 * 만약 한글이 사라지면 원본 반환 (안전장치).
 */
export function stripForeignChars(text: string): string {
  const koreanBefore = (text.match(/[가-힣]/g) ?? []).length;

  const cleaned = text
    .replace(/[一-鿿]/g, "")   // CJK 통합 한자 (全球, 半導體 등)
    .replace(/[㐀-䶿]/g, "")   // CJK 확장 A
    .replace(/[\uD840-\uD87F][\uDC00-\uDFFF]/g, "") // CJK 확장 B-F (서로게이트)
    .replace(/[豈-﫿]/g, "")   // CJK 호환 한자
    .replace(/[぀-ゟ]/g, "")   // 히라가나
    .replace(/[゠-ヿ]/g, "")   // 가타카나
    .replace(/[฀-๿]/g, "")   // 태국어 (สำค 등)
    .replace(/[؀-ۿ]/g, "")   // 아랍어
    .replace(/ {2,}/g, " ");           // 연속 공백 정리

  // 안전장치: 한글이 10자 이상 있었는데 모두 사라졌으면 원본 반환
  const koreanAfter = (cleaned.match(/[가-힣]/g) ?? []).length;
  if (koreanBefore > 10 && koreanAfter === 0) {
    console.warn("[stripForeignChars] 한글 손실 감지, 원본 반환. before:", koreanBefore);
    return text;
  }

  return cleaned;
}

/**
 * 크롤한 기사 본문 끝에 붙는 보일러플레이트(관련기사 링크 목록, 저작권 고지 등)를 잘라낸다.
 * 이 잔재가 모델에 들어가면 뉴스레터 본문에 "관련 기사" 링크가 섞여 나오는 문제가 생긴다.
 * 과도한 절단을 막기 위해 본문 후반부(40% 이후)에 나타난 마커에서만 자른다.
 */
export function stripArticleBoilerplate(text: string): string {
  const markers = [/관련\s?기사/, /저작권자/, /무단\s?전재/, /재배포\s?금지/, /ⓒ/];
  let cut = text.length;
  const minKeep = text.length * 0.4;
  for (const re of markers) {
    const m = text.search(re);
    if (m >= minKeep && m < cut) cut = m;
  }
  // 기자 이메일 바이라인("OOO 기자 email@...")은 한국 뉴스 본문의 끝 신호.
  // 그 뒤는 푸터·관련기사·다른 기사 링크 등 잡음이므로 바이라인에서 자른다(본문 길이 무관).
  const byline = text.search(/[가-힣]{2,5}\s*기자\s*[\w.+-]+@[\w.-]+/);
  if (byline > 200 && byline < cut) cut = byline;
  return text.slice(0, cut).trim();
}

/**
 * 본문의 이미지를 일관된 캡션 스타일로 정규화하고 출처를 붙인다.
 * - 모델이 <img>를 맨 태그로 넣고 캡션을 별도 <p>로 쓰면 본문 글과 섞여 헷갈린다.
 * - 모든 이미지를 <figure>로 감싸고, 캡션(직후 짧은 <p> 또는 alt)을 작은 회색 <figcaption>으로,
 *   "출처: 매체명"을 함께 표기해 본문과 시각적으로 구분한다.
 * resolveSource(이미지URL) → 출처 문자열(매체명). 빈 문자열이면 출처 생략.
 */
export function styleImageSources(html: string, resolveSource: (src: string) => string): string {
  // 기존 figure/figcaption 래퍼 제거 → bare img로 정규화(이중 래핑 방지)
  let out = html.replace(/<\/?figure[^>]*>/gi, "").replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, "");
  // 각 img를 스타일된 figure로 감싼다. 바로 뒤 짧은 <p>(마침표 없는 45자 이하)는 캡션으로 흡수.
  out = out.replace(/<img\b([^>]*)>(\s*<p>\s*([^<]{1,80})\s*<\/p>)?/gi, (_m, attrs, pBlock, capText) => {
    const src = (attrs.match(/src=["']([^"']+)["']/i) || [])[1] || "";
    const alt = (attrs.match(/alt=["']([^"']*)["']/i) || [])[1] || "";
    const isCap = capText && capText.trim().length <= 45 && !/[.?!]\s*$/.test(capText.trim());
    const caption = isCap ? capText.trim() : alt;
    const source = resolveSource(src);
    const line = [caption, source ? `출처: ${source}` : ""].filter(Boolean).join(" · ");
    const fig = `<figure style="margin:18px 0;text-align:center"><img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px">` +
      (line ? `<figcaption style="font-size:13px;color:#8a8f98;text-align:center;margin-top:6px">${line}</figcaption>` : "") +
      `</figure>`;
    // 캡션으로 흡수하지 않은 <p>(실제 본문 문장)는 그대로 유지
    return fig + (pBlock && !isCap ? pBlock : "");
  });
  return out;
}

/**
 * <mark> 무결성 보정. 모델이 </mark>를 빠뜨려 형광이 여러 문단·섹션을 통째로 삼키는 문제를 막는다.
 * - 블록 경계(</p>, <hr>, <h2> 등)를 만나면 mark를 강제로 닫는다.
 * - 한 mark가 40자를 넘으면 강제로 닫는다(핵심 구절만 형광).
 * - 중첩/고아 태그 제거.
 */
export function sanitizeMarks(html: string): string {
  const BLOCK = /^<\/?(?:p|hr|h1|h2|h3|h4|figure|figcaption|ul|ol|li|blockquote|div|table|tr|td|br)\b/i;
  let out = "", open = false, openLen = 0;
  for (const tok of html.split(/(<[^>]+>)/)) {
    if (/^<mark\b[^>]*>$/i.test(tok)) { if (!open) { open = true; openLen = 0; out += "<mark>"; } continue; }
    if (/^<\/mark>$/i.test(tok)) { if (open) { open = false; out += "</mark>"; } continue; }
    if (open && BLOCK.test(tok)) { out += "</mark>" + tok; open = false; continue; }
    if (open && !/^<[^>]+>$/.test(tok)) {
      openLen += tok.length;
      if (openLen > 40) {
        const keep = Math.max(0, 40 - (openLen - tok.length));
        out += tok.slice(0, keep) + "</mark>" + tok.slice(keep);
        open = false;
        continue;
      }
    }
    out += tok;
  }
  if (open) out += "</mark>";
  return out;
}

export interface AIOptions {
  temperature?: number;
  max_tokens?: number;
  /** "heavy": 고품질 모델 (본문 생성), "light": 경량 모델 (제목·요약 추출) */
  tier?: "heavy" | "light";
}

/**
 * Groq 모델 구성
 * - heavy: llama-3.3-70b-versatile  (TPD 100k, 품질 최우선)
 * - light: llama-3.1-8b-instant     (TPD 500k, 간단한 JSON 추출용)
 *
 * Cerebras가 설정되어 있으면 모든 요청에 Cerebras 사용 (무제한에 가까움).
 */
const GROQ_HEAVY = "llama-3.3-70b-versatile";
const GROQ_LIGHT = "llama-3.1-8b-instant";

/**
 * Cerebras 단일 모델 호출 헬퍼
 */
async function cerebrasCall(
  key: string,
  model: string,
  messages: AIMessage[],
  options: AIOptions
): Promise<string> {
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.75,
      max_tokens: options.max_tokens ?? 8192,
      // gpt-oss-120b는 추론 모델이라 max_tokens 안에서 추론+본문을 함께 소비한다.
      // reasoning_effort="low"로 추론 소비를 줄여 빈 응답을 막고 본문에 토큰을 확보한다.
      reasoning_effort: "low",
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cerebras(${model}) ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function chat(messages: AIMessage[], options: AIOptions = {}): Promise<string> {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const tier = options.tier ?? "heavy";

  // ── Cerebras gpt-oss-120b (주 모델) ─────────────────────────
  // reasoning_effort=low + 재시도로 빈 응답을 최대한 막는다.
  // 본문 생성(heavy)은 품질이 중요하므로 Cerebras가 무조건 성공해야 하며, 실패해도
  // 품질 낮은 Groq로 폴백하지 않고 명확히 에러를 던진다(쓰레기 저장 방지 → 사용자가 재시도).
  if (cerebrasKey) {
    const maxTokens = options.max_tokens ?? (tier === "light" ? 1500 : 8192);
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const content = await cerebrasCall(
          cerebrasKey,
          "gpt-oss-120b",
          messages,
          { ...options, max_tokens: maxTokens }
        );
        if (content) {
          console.log(`[AI] Cerebras(gpt-oss-120b) 완료, tier: ${tier}, 길이: ${content.length}${attempt > 1 ? ` (시도 ${attempt})` : ""}`);
          return content;
        }
        console.warn(`[AI] Cerebras 빈 응답 (시도 ${attempt}/${MAX_ATTEMPTS})`);
      } catch (e) {
        console.error(`[AI] Cerebras 오류 (시도 ${attempt}/${MAX_ATTEMPTS}):`, (e as Error).message);
      }
      // 마지막 시도가 아니면 짧은 백오프 후 재시도 (일시적 5xx·네트워크 블립 대응)
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    // 본문 생성은 Groq 폴백 금지 — 품질 저하보다 명확한 실패가 낫다.
    if (tier === "heavy") {
      throw new Error("Cerebras 생성에 반복 실패했습니다(빈 응답/오류). 잠시 후 다시 시도해주세요.");
    }
    console.warn("[AI] Cerebras 실패 → light 작업이라 Groq 폴백");
  }

  // ── Groq 폴백 (light 티어 전용: 제목·태그·요약 추출 등 보조 작업) ──
  if (!groqKey) throw new Error("CEREBRAS_API_KEY 또는 GROQ_API_KEY가 필요합니다.");
  const Groq = (await import("groq-sdk")).default;
  const groq = new Groq({ apiKey: groqKey, timeout: 90000 });

  // tier에 따라 모델 선택 → TPD 한도를 두 모델로 분산
  const model = tier === "light" ? GROQ_LIGHT : GROQ_HEAVY;
  const defaultMaxTokens = tier === "light" ? 400 : 3000;

  const res = await groq.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.75,
    max_tokens: options.max_tokens ?? defaultMaxTokens,
  });
  const content = res.choices[0]?.message?.content?.trim() ?? "";
  console.log("[AI] Groq 완료, model:", model, "길이:", content.length);
  return content;
}
