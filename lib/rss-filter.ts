import { chat } from "@/lib/ai";

export type FilterItem = { title: string };

const includeKeywords = [
  // AI / ML
  "AI", "인공지능", "GPT", "LLM", "딥러닝", "머신러닝", "생성형", "파운데이션모델",
  // Cloud / Infra
  "클라우드", "AWS", "Azure", "GCP", "데이터센터", "서버", "쿠버네티스", "도커",
  // Security
  "보안", "해킹", "랜섬웨어", "취약점", "사이버", "악성코드", "피싱", "제로데이",
  // Semiconductor / HW
  "반도체", "GPU", "CPU", "HBM", "파운드리", "팹", "칩", "웨이퍼", "나노",
  // Dev / Software
  "API", "SDK", "오픈소스", "깃허브", "개발", "프레임워크", "라이브러리", "소프트웨어",
  // Networks / Devices
  "5G", "6G", "네트워크", "스마트폰", "앱", "플랫폼", "IoT", "엣지컴퓨팅",
  // Emerging tech
  "로봇", "자율주행", "드론", "양자컴퓨터", "블록체인",
  // Key companies (tech announcements context)
  "엔비디아", "인텔", "AMD", "퀄컴", "TSMC", "SK하이닉스",
  "오픈AI", "딥마인드", "앤스로픽",
];

const excludeKeywords = [
  // Financials
  "실적", "영업이익", "영업손실", "매출액", "순이익", "흑자", "적자", "영업익",
  // Stock / Investment
  "주가", "코스피", "코스닥", "상장", "IPO", "공모", "주식", "증시", "펀드",
  // Crypto
  "코인", "비트코인", "이더리움", "NFT", "가상화폐", "암호화폐", "토큰",
  // Entertainment
  "흥행", "관객수", "박스오피스", "드라마", "영화",
  // HR / Corporate
  "CEO", "대표이사", "인사", "채용", "퇴직", "사임", "선임",
  // Construction / Real estate
  "건설", "시공", "분양", "부동산", "아파트",
  // M&A (financial context)
  "합병", "인수합병",
  // Politics / Law
  "법안", "국회", "정치", "선거", "규제안",
  // Logistics / Retail
  "유통", "물류", "배송", "마트",
];

function isRelevant(title: string): boolean | null {
  const lower = title.toLowerCase();

  for (const kw of excludeKeywords) {
    if (lower.includes(kw.toLowerCase())) return false;
  }

  for (const kw of includeKeywords) {
    if (lower.includes(kw.toLowerCase())) return true;
  }

  return null; // ambiguous → needs LLM
}

function scoreArticle(title: string): number {
  let score = 0;
  const lower = title.toLowerCase();

  if (/ai|인공지능|gpt|llm|딥러닝|생성형/.test(lower)) score += 3;
  if (/보안|해킹|랜섬웨어|취약점|사이버/.test(lower)) score += 3;
  if (/반도체|gpu|cpu|hbm|파운드리/.test(lower)) score += 2;
  if (/클라우드|aws|azure|gcp/.test(lower)) score += 2;
  if (/출시|공개|발표|업데이트|릴리즈/.test(lower)) score += 1;
  if (/취약점|패치|긴급|경보/.test(lower)) score += 1;

  return score;
}

export async function filterItRelevant<T extends FilterItem>(items: T[], topN?: number): Promise<T[]> {
  if (items.length === 0) return [];

  const definitelyIn: T[] = [];
  const ambiguous: T[] = [];

  for (const item of items) {
    const result = isRelevant(item.title);
    if (result === true) definitelyIn.push(item);
    else if (result === false) { /* excluded */ }
    else ambiguous.push(item);
  }

  let llmPassed: T[] = [];

  if (ambiguous.length > 0) {
    const numbered = ambiguous.map((item, i) => `${i + 1}. ${item.title}`).join("\n");

    try {
      const result = await chat([
        {
          role: "user",
          content: `다음 기사 제목들을 보고, 순수 IT 기술 뉴스인 것의 번호만 JSON으로 반환하세요.

판단 기준:
✅ 포함: 새 기술·제품·서비스 출시, AI/보안/클라우드/반도체/개발 기술 동향, 해킹·취약점 사건
❌ 제외: 기업 실적·주가·투자, 암호화폐 시세·법안, 게임 흥행·실적, 인사·채용·합병, 건설·유통·정치

판단 예시:
✅ "엔비디아, 블랙웰 GPU 신제품 출시...전작 대비 성능 4배"
✅ "구글, 제미나이 2.0 공개...멀티모달 기능 대폭 강화"
✅ "국내 기업 랜섬웨어 피해 급증...보안 패치 시급"
✅ "삼성전자, HBM4 양산 돌입...SK하이닉스와 경쟁 본격화"
❌ "삼성전자 2분기 영업이익 10조 전망...반도체 회복세" → 실적 기사이므로 제외
❌ "갤럭시디지털, 美 클래리티 법안 초당적 처리 가능성" → 암호화폐 법안이므로 제외
❌ "컴투스, 외형 줄어도 영업익 3배 껑충...체질 개선" → 게임사 실적이므로 제외
❌ "KCC건설, 서울 업무시설 신축공사 계약 체결" → 건설이므로 제외

${numbered}

출력 형식 (JSON만, 다른 텍스트 없이): {"relevant":[1,3,4]}`,
        },
      ], { temperature: 0, max_tokens: 300, tier: "light" });

      const match = result.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const indices = new Set<number>((parsed.relevant ?? []).map((n: number) => n - 1));
        llmPassed = ambiguous.filter((_, i) => indices.has(i));
      } else {
        llmPassed = ambiguous;
      }
    } catch (e) {
      console.warn("[rss-filter] LLM 분류 실패, 애매한 기사 전체 포함:", e);
      llmPassed = ambiguous;
    }
  }

  const passed = [...definitelyIn, ...llmPassed];

  if (topN !== undefined) {
    return passed
      .sort((a, b) => scoreArticle(b.title) - scoreArticle(a.title))
      .slice(0, topN);
  }

  return passed;
}
