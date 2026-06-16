/**
 * 한영 동의어 사전 — 검색어 자동 확장
 * [한국어, English] 쌍으로 관리
 */
const PAIRS: [string, string][] = [
  // AI / 모델
  ["클로드", "Claude"],
  ["챗GPT", "ChatGPT"],
  ["제미나이", "Gemini"],
  ["코파일럿", "Copilot"],
  ["라마", "Llama"],
  ["딥시크", "DeepSeek"],
  ["퍼플렉시티", "Perplexity"],
  ["미드저니", "Midjourney"],
  ["스테이블디퓨전", "Stable Diffusion"],

  // 기업
  ["앤트로픽", "Anthropic"],
  ["오픈AI", "OpenAI"],
  ["구글", "Google"],
  ["애플", "Apple"],
  ["마이크로소프트", "Microsoft"],
  ["메타", "Meta"],
  ["아마존", "Amazon"],
  ["테슬라", "Tesla"],
  ["엔비디아", "NVIDIA"],
  ["퀄컴", "Qualcomm"],
  ["인텔", "Intel"],
  ["오라클", "Oracle"],
  ["어도비", "Adobe"],
  ["세일즈포스", "Salesforce"],
  ["넷플릭스", "Netflix"],
  ["우버", "Uber"],
  ["에어비앤비", "Airbnb"],
  ["스포티파이", "Spotify"],
  ["링크드인", "LinkedIn"],
  ["유튜브", "YouTube"],
  ["인스타그램", "Instagram"],
  ["왓츠앱", "WhatsApp"],
  ["스냅챗", "Snapchat"],
  ["틱톡", "TikTok"],
  ["삼성", "Samsung"],
  ["하이닉스", "SK Hynix"],
  ["카카오", "Kakao"],
  ["네이버", "Naver"],
  ["라인", "LINE"],
  ["쿠팡", "Coupang"],
  ["토스", "Toss"],

  // 플랫폼 / 서비스
  ["깃허브", "GitHub"],
  ["깃랩", "GitLab"],
  ["슬랙", "Slack"],
  ["노션", "Notion"],
  ["피그마", "Figma"],
  ["버셀", "Vercel"],
  ["도커", "Docker"],
  ["쿠버네티스", "Kubernetes"],
  ["안드로이드", "Android"],
  ["아이폰", "iPhone"],
  ["아이패드", "iPad"],
  ["윈도우", "Windows"],
  ["리눅스", "Linux"],
  ["맥OS", "macOS"],

  // 기술 용어
  ["인공지능", "AI"],
  ["머신러닝", "Machine Learning"],
  ["딥러닝", "Deep Learning"],
  ["자연어처리", "NLP"],
  ["컴퓨터비전", "Computer Vision"],
  ["클라우드", "Cloud"],
  ["블록체인", "Blockchain"],
  ["반도체", "Semiconductor"],
  ["사이버보안", "Cybersecurity"],
  ["사물인터넷", "IoT"],
  ["증강현실", "AR"],
  ["가상현실", "VR"],
  ["메타버스", "Metaverse"],
  ["엣지컴퓨팅", "Edge Computing"],
  ["양자컴퓨팅", "Quantum Computing"],
  ["파이썬", "Python"],
  ["자바스크립트", "JavaScript"],
  ["타입스크립트", "TypeScript"],
  ["리액트", "React"],
  ["넥스트", "Next.js"],
];

/**
 * 검색어 → 동의어 포함 확장 배열 반환
 * "클로드" → ["클로드", "Claude"]
 * "AI"    → ["AI", "인공지능"]
 */
export function expandTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [trimmed];

  const lower = trimmed.toLowerCase();
  const terms = new Set<string>([trimmed]);

  for (const [ko, en] of PAIRS) {
    if (lower.includes(ko.toLowerCase())) terms.add(en);
    if (lower.includes(en.toLowerCase())) terms.add(ko);
  }

  return [...terms];
}
