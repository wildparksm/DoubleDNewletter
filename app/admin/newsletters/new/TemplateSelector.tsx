"use client";

import { useState } from "react";
import NewsletterEditor from "../NewsletterEditor";

// ── Template definitions ──────────────────────────────────────────
interface Template {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tags: string[];
  preview: string; // short visual preview text
  content: string;
  category: string;
}

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "빈 문서",
    description: "완전히 빈 상태에서 시작합니다.",
    emoji: "✏️",
    tags: ["자유 형식"],
    preview: "",
    content: "",
    category: "일반",
  },
  {
    id: "weekly-it",
    name: "주간 IT 뉴스",
    description: "매주 IT 트렌드 3~5개를 정리해 전달하는 포맷입니다.",
    emoji: "📡",
    tags: ["IT 트렌드", "정기 발행"],
    preview: "이번 주 주요 IT 뉴스 · 트렌드 분석 · 추천 자료",
    category: "IT 트렌드",
    content: `<h2>📡 이번 주 IT 뉴스</h2>
<p>안녕하세요, 대덕전자 IT팀입니다. 이번 주 주목할 만한 IT 소식을 정리했습니다.</p>
<hr>
<h3>1. 첫 번째 소식 제목</h3>
<p>소식 내용을 여기에 작성하세요. 핵심 내용을 2~3 문장으로 요약합니다.</p>
<p><a href="https://example.com">자세히 읽기 →</a></p>
<hr>
<h3>2. 두 번째 소식 제목</h3>
<p>소식 내용을 여기에 작성하세요. 핵심 내용을 2~3 문장으로 요약합니다.</p>
<p><a href="https://example.com">자세히 읽기 →</a></p>
<hr>
<h3>3. 세 번째 소식 제목</h3>
<p>소식 내용을 여기에 작성하세요. 핵심 내용을 2~3 문장으로 요약합니다.</p>
<p><a href="https://example.com">자세히 읽기 →</a></p>
<hr>
<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#0d1b8e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">뉴스레터 아카이브 보기 →</a></p>
<hr>
<p><strong>홍길동</strong><br><span style="color:#888;font-size:14px">대덕전자 IT팀 | hong@daeduck.com</span></p>`,
  },
  {
    id: "announcement",
    name: "단일 공지",
    description: "하나의 중요 소식을 집중적으로 전달하는 포맷입니다.",
    emoji: "📢",
    tags: ["공지", "사내 소식"],
    preview: "중요 공지 · 큰 제목 · CTA 버튼",
    category: "사내 소식",
    content: `<h2>📢 공지 제목을 입력하세요</h2>
<p>안녕하세요, 대덕전자 IT팀입니다.</p>
<p>이번에 알려드릴 중요한 내용은 다음과 같습니다.</p>
<div style="background:#f0f4ff;border-left:4px solid #0d1b8e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#0d1b8e;font-weight:600">💡 핵심 요약</p><p style="margin:8px 0 0">여기에 가장 중요한 내용을 한 두 줄로 요약하세요.</p></div>
<h3>배경</h3>
<p>공지의 배경과 이유를 설명합니다.</p>
<h3>주요 내용</h3>
<ul><li>첫 번째 내용</li><li>두 번째 내용</li><li>세 번째 내용</li></ul>
<h3>일정</h3>
<p>관련 일정이나 기한을 여기에 작성하세요.</p>
<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#0d1b8e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">자세히 보기 →</a></p>
<hr>
<p>문의사항은 <a href="mailto:it@daeduck.com">it@daeduck.com</a>으로 연락주세요.</p>`,
  },
  {
    id: "event",
    name: "이벤트 안내",
    description: "교육, 세미나, 행사 등 이벤트 정보를 안내합니다.",
    emoji: "🗓️",
    tags: ["이벤트", "교육"],
    preview: "일시 · 장소 · 참가 신청 버튼",
    category: "사내 소식",
    content: `<h2>🗓️ 이벤트 제목을 입력하세요</h2>
<p>안녕하세요, 대덕전자 IT팀입니다. 아래 행사에 여러분을 초대합니다.</p>
<div style="background:#f0f4ff;border-left:4px solid #0d1b8e;border-radius:8px;padding:16px 20px">
<p style="margin:0;font-weight:600;color:#0d1b8e">📌 행사 정보</p>
<p style="margin:8px 0 0"><strong>일시:</strong> 2026년 MM월 DD일 (요일) HH:MM ~ HH:MM</p>
<p style="margin:4px 0 0"><strong>장소:</strong> 장소를 입력하세요</p>
<p style="margin:4px 0 0"><strong>대상:</strong> 참가 대상을 입력하세요</p>
<p style="margin:4px 0 0"><strong>신청 기한:</strong> MM월 DD일까지</p>
</div>
<h3>프로그램 소개</h3>
<p>행사 내용을 여기에 설명합니다.</p>
<h3>세부 일정</h3>
<ul><li>HH:MM — 등록 및 접수</li><li>HH:MM — 오프닝 및 소개</li><li>HH:MM — 메인 프로그램</li><li>HH:MM — Q&A 및 마무리</li></ul>
<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#0d1b8e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">참가 신청하기 →</a></p>
<p style="text-align:center;color:#888;font-size:13px">선착순 마감될 수 있습니다. 서둘러 신청해 주세요!</p>`,
  },
  {
    id: "survey",
    name: "설문 요청",
    description: "구성원 의견 수집이나 만족도 조사를 전달합니다.",
    emoji: "📊",
    tags: ["설문", "참여 유도"],
    preview: "설문 소개 · 소요 시간 · 링크 버튼",
    category: "사내 소식",
    content: `<h2>📊 설문에 참여해주세요!</h2>
<p>안녕하세요, 대덕전자 IT팀입니다.</p>
<p>더 나은 서비스를 제공하기 위해 여러분의 소중한 의견을 모으고 있습니다.</p>
<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#15803d;font-weight:600">✅ 소요 시간: 약 3분</p><p style="margin:8px 0 0">총 5개의 간단한 질문으로 구성되어 있습니다.</p></div>
<h3>설문 목적</h3>
<p>이 설문은 ___을 위해 진행됩니다. 수집된 의견은 ___ 개선에 활용됩니다.</p>
<h3>참여 방법</h3>
<ol><li>아래 버튼을 클릭하여 설문 페이지로 이동합니다.</li><li>질문에 솔직하게 응답해주세요.</li><li>제출 버튼을 눌러 완료합니다.</li></ol>
<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">설문 참여하기 →</a></p>
<p style="text-align:center;color:#888;font-size:13px">응답 기한: MM월 DD일까지</p>
<hr>
<p>문의: <a href="mailto:it@daeduck.com">it@daeduck.com</a></p>`,
  },
  {
    id: "tech-deep",
    name: "기술 심층 분석",
    description: "특정 기술 주제를 심층적으로 다루는 포맷입니다.",
    emoji: "💻",
    tags: ["기술", "개발"],
    preview: "개요 · 본문 분석 · 요약 · 참고 자료",
    category: "개발·기술",
    content: `<h2>💻 기술 주제 제목</h2>
<p>안녕하세요, 대덕전자 IT팀입니다. 이번 호에서는 <strong>기술 주제</strong>에 대해 심층적으로 살펴봅니다.</p>
<div style="background:#f0f4ff;border-left:4px solid #0d1b8e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#0d1b8e;font-weight:600">📌 핵심 요약</p><p style="margin:8px 0 0">이 글에서 다루는 핵심 내용을 2~3줄로 요약합니다.</p></div>
<h3>배경 및 개요</h3>
<p>기술의 배경과 개요를 설명합니다.</p>
<h3>주요 특징 및 원리</h3>
<p>기술의 주요 특징과 작동 원리를 설명합니다.</p>
<ul><li>특징 1</li><li>특징 2</li><li>특징 3</li></ul>
<h3>실제 적용 사례</h3>
<p>실무에서 어떻게 활용될 수 있는지 설명합니다.</p>
<h3>결론 및 전망</h3>
<p>기술의 미래 전망과 우리 회사에의 시사점을 정리합니다.</p>
<hr>
<h3>📚 참고 자료</h3>
<ul><li><a href="https://example.com">참고 자료 1</a></li><li><a href="https://example.com">참고 자료 2</a></li></ul>`,
  },
];

// ── Template Card ─────────────────────────────────────────────────
function TemplateCard({
  template,
  onSelect,
}: {
  template: Template;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group w-full text-left bg-white border-2 border-gray-100 hover:border-[#0d1b8e] rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:border-[#0d1b8e]"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl leading-none mt-0.5">{template.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-gray-900 group-hover:text-[#0d1b8e] transition-colors">
              {template.name}
            </h3>
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{template.description}</p>
          {template.preview && (
            <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <span className="text-gray-300">구성:</span>
              {template.preview}
            </p>
          )}
        </div>
        <svg
          className="flex-shrink-0 text-gray-300 group-hover:text-[#0d1b8e] transition-colors mt-1"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function TemplateSelector() {
  const [selected, setSelected] = useState<Template | null>(null);

  if (selected) {
    return (
      <NewsletterEditor
        initialData={{
          title: "",
          summary: "",
          content: selected.content,
          cover_image: "",
          status: "draft",
          category: selected.category,
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <a href="/admin/newsletters" className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </a>
          <span className="text-gray-200">|</span>
          <span className="font-semibold text-gray-700">새 뉴스레터</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-black text-gray-900 mb-2">템플릿을 선택하세요</h1>
          <p className="text-gray-500">
            시작 템플릿을 고르면 기본 구조가 자동으로 채워집니다.
            <br />
            이후 자유롭게 수정할 수 있습니다.
          </p>
        </div>

        <div className="space-y-3">
          {TEMPLATES.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onSelect={() => setSelected(tpl)}
            />
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          모든 템플릿은 에디터에서 자유롭게 수정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
