/**
 * 번역 규칙이 한글 원문 생성 품질(길이)을 떨어뜨리는지 A/B 검증.
 *   A. 번역 규칙 미적용 (한글 원문 → 우리 수정 후의 기본 경로)
 *   B. 번역 규칙 적용 (이전의 항상-켜짐 동작 재현)
 * 또한 needsTranslation() 분류가 올바른지 확인.
 *
 * 실행:  npx tsx scripts/test-translation.ts
 */
import { readFileSync } from "node:fs";
import {
  SYSTEM_CONTENT, getCategoryTone, BLOCK_GUIDE, WRITING_RULES,
  TRANSLATION_RULES, needsTranslation,
} from "../lib/newsletter-prompt";
import { chat, stripForeignChars } from "../lib/ai";

for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

// KAIST 보도자료 스타일의 한글 원문 (사용자가 본 기사와 유사하게 재구성)
const koreanArticle = `
KAIST(한국과학기술원, 총장 이광형)는 박종세 전산학부 교수 연구팀이 AI 인프라의 성능과 효율을 사전에 검증할 수 있는 시뮬레이터를 개발했다고 31일 밝혔다.
이 연구는 컴퓨터 시스템 분야 국제 학회인 ISPASS 2026에서 최우수 논문상을 받았다.
연구팀이 개발한 시뮬레이터의 명칭은 LLMServingSim 2.0으로, 대규모 AI 서버를 실제로 구축하기 전에 가상 환경에서 처리량, 지연시간, 에너지 효율 등을 미리 측정하고 최적화할 수 있게 해준다.
박종세 교수는 "실제 서버를 구축하기 전에 다양한 워크로드를 시뮬레이션하면 막대한 비용과 시간을 절감할 수 있다"고 말했다.
연구팀은 LLMServingSim 2.0이 데이터센터 규모의 AI 추론 인프라 설계에 실질적으로 활용될 수 있으며, 향후 다양한 하드웨어 구성과 모델에 대응하도록 확장할 계획이라고 밝혔다.
`.trim();

const category = "AI";

function buildUserPrompt(articleText: string, withTranslation: boolean): string {
  const translationBlock = withTranslation ? `\n\n${TRANSLATION_RULES}` : "";
  return `아래 기사 원문을 뉴스레터 HTML 형식으로 변환하세요.

출처: KAIST 보도자료
제목: KAIST, AI 인프라 시뮬레이터 개발
카테고리: ${category}
카테고리 톤: ${getCategoryTone(category)}

== 기사 원문 ==
${articleText}
${BLOCK_GUIDE}

${WRITING_RULES}${translationBlock}

본문 HTML을 모두 작성한 뒤, 맨 마지막 줄에 아래 형식을 추가하세요:
<!--META:{"title":"제목","card_title":"키워드","summary":"요약"}-->`;
}

async function gen(withTranslation: boolean): Promise<number> {
  const raw = await chat([
    { role: "system", content: SYSTEM_CONTENT },
    { role: "user", content: buildUserPrompt(koreanArticle, withTranslation) },
  ], { temperature: 0.2, max_tokens: 8000 });
  const html = stripForeignChars(raw.replace(/<!--META:[\s\S]*?-->/, "").trim());
  return html.length;
}

async function main() {
  const englishSample = "Microsoft today announced a major update to Copilot Notebooks, bringing AI-powered workspaces to Microsoft 365.";
  console.log("==================== needsTranslation 분류 ====================");
  console.log("한글 기사 → needsTranslation:", needsTranslation(koreanArticle), "(기대: false ✅)");
  console.log("영문 기사 → needsTranslation:", needsTranslation(englishSample.repeat(5)), "(기대: true ✅)");

  console.log("\n==================== A/B 길이 비교 (한글 기사) ====================");
  const lenA = await gen(false); // 수정 후 기본 경로 (번역 규칙 없음)
  const lenB = await gen(true);  // 이전 동작 (번역 규칙 항상 켜짐)
  console.log("A. 번역 규칙 없음 (수정 후):", lenA, "자");
  console.log("B. 번역 규칙 적용 (이전):  ", lenB, "자");
  console.log("차이:", lenA - lenB, "자", lenA > lenB ? "→ 규칙 제거 시 더 김 ✅" : "→ 차이 미미/역전 ⚠️");
}

main().catch((e) => { console.error(e); process.exit(1); });
