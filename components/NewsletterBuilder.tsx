"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Youtube from "@tiptap/extension-youtube";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { all, createLowlight } from "lowlight";
import { useEffect, useState, useCallback, useRef } from "react";
import { SlashCommandExtension } from "./SlashCommand";
import { useToast } from "@/hooks/useToast";
import { usePrompt } from "@/hooks/usePrompt";

const lowlight = createLowlight(all);

// ── Custom FontSize extension ─────────────────────────────────────
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
          renderHTML: (attrs) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: { chain: () => any }) =>
        chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: { chain: () => any }) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// ── Block templates ──────────────────────────────────────────────
const BLOCKS = [
  { label: "제목 섹션",  icon: "📰", desc: "큰 제목 + 부제목",     html: `<h2>섹션 제목을 입력하세요</h2><p>이 섹션에 대한 소개 문구를 작성하세요.</p>` },
  { label: "본문 단락",  icon: "📝", desc: "일반 텍스트 단락",     html: `<p>내용을 입력하세요.</p>` },
  { label: "인용구",     icon: "💬", desc: "강조 인용 블록",       html: `<blockquote>여기에 인용하거나 강조하고 싶은 문구를 입력하세요.</blockquote>` },
  { label: "구분선",     icon: "➖", desc: "섹션 구분선",          html: `<hr>` },
  { label: "불릿 리스트",icon: "📋", desc: "글머리 기호 목록",     html: `<ul><li>첫 번째 항목</li><li>두 번째 항목</li><li>세 번째 항목</li></ul>` },
  { label: "번호 목록",  icon: "🔢", desc: "번호가 있는 목록",     html: `<ol><li>첫 번째 단계</li><li>두 번째 단계</li><li>세 번째 단계</li></ol>` },
  { label: "체크리스트", icon: "✅", desc: "할 일 체크리스트",     html: `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">첫 번째 항목</li><li data-type="taskItem" data-checked="false">두 번째 항목</li></ul>` },
  { label: "표",         icon: "🗂️", desc: "3×3 기본 표",         html: "" /* 동적 삽입 */ },
  { label: "코드 블록",  icon: "💻", desc: "문법 강조 코드",       html: `<pre><code>// 코드를 입력하세요\nconsole.log('Hello, 대덕.it!');</code></pre>` },
  { label: "CTA 버튼",   icon: "🔘", desc: "클릭 유도 버튼",       html: `<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#0d1b8e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">자세히 보기 →</a></p>` },
  { label: "이미지",     icon: "🖼️", desc: "이미지 + 캡션",       html: `<img src="https://via.placeholder.com/600x300?text=이미지를+교체하세요" alt="이미지 설명"><p style="text-align:center;color:#888;font-size:13px">이미지 캡션을 입력하세요</p>` },
  { label: "강조 박스",  icon: "📦", desc: "하이라이트 박스",      html: `<div style="background:#f0f4ff;border-left:4px solid #0d1b8e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#0d1b8e;font-weight:600">💡 알고 계셨나요?</p><p style="margin:8px 0 0">여기에 강조하고 싶은 내용을 입력하세요.</p></div>` },
  { label: "서명",       icon: "✍️", desc: "작성자 서명",          html: `<hr><p><strong>홍길동</strong><br><span style="color:#888;font-size:14px">대덕전자 IT팀 | hong@daeduck.com</span></p>` },
];

// ── Font sizes ───────────────────────────────────────────────────
const FONT_SIZES = [
  { label: "기본", value: "" },
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
];

// ── Fonts ────────────────────────────────────────────────────────
const FONTS = [
  { label: "기본 (Pretendard)", value: "" },
  { label: "나눔고딕", value: "'Nanum Gothic', sans-serif" },
  { label: "나눔명조", value: "'Nanum Myeongjo', serif" },
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "Noto Serif KR", value: "'Noto Serif KR', serif" },
  { label: "Georgia (영문)", value: "Georgia, serif" },
  { label: "Courier New (모노)", value: "'Courier New', monospace" },
];

// ── Text colors ──────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: "기본",     value: "" },
  { label: "파랑",     value: "#0d1b8e" },
  { label: "하늘",     value: "#00a3ff" },
  { label: "빨강",     value: "#e53e3e" },
  { label: "초록",     value: "#38a169" },
  { label: "주황",     value: "#dd6b20" },
  { label: "보라",     value: "#805ad5" },
  { label: "회색",     value: "#718096" },
  { label: "흰색",     value: "#ffffff" },
];

// ── Highlight colors ─────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { label: "노랑",     value: "#fef08a" },
  { label: "하늘",     value: "#bfdbfe" },
  { label: "초록",     value: "#bbf7d0" },
  { label: "분홍",     value: "#fecdd3" },
  { label: "보라",     value: "#e9d5ff" },
  { label: "주황",     value: "#fed7aa" },
];

// ── Toolbar button ────────────────────────────────────────────────
function TB({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all text-[13px] ${
        active
          ? "bg-[#0d1b8e] text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-gray-200 mx-0.5" />;
}

// ── Dropdown wrapper ─────────────────────────────────────────────
function DropdownBtn({
  label, open, onToggle, width = "w-auto", children,
}: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-gray-400">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className={`absolute top-full left-0 mt-1 ${width} bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Preview device type ───────────────────────────────────────────
type PreviewDevice = "desktop" | "mobile" | "text";

// ── Main component ────────────────────────────────────────────────
interface NewsletterBuilderProps {
  content: string;
  onChange: (html: string) => void;
}

export default function NewsletterBuilder({ content, onChange }: NewsletterBuilderProps) {
  const { toast, toastNode } = useToast();
  const { prompt, promptNode } = usePrompt();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [autoSaved, setAutoSaved] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Dropdown states
  const [currentFont, setCurrentFont]   = useState("");
  const [currentSize, setCurrentSize]   = useState("");
  const [openMenu, setOpenMenu]         = useState<string | null>(null); // "font"|"size"|"color"|"highlight"

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const menuRefs      = useRef<Record<string, HTMLDivElement | null>>({});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, underline: false, link: false }), // replaced/handled separately
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ HTMLAttributes: { style: "max-width:100%;border-radius:8px;" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      CharacterCount,
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: "w-full rounded-xl my-4" } }),
      CodeBlockLowlight.configure({ lowlight }),
      Superscript,
      Subscript,
      SlashCommandExtension,
    ],
    content,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[500px] px-10 py-8 max-w-none",
        "data-placeholder": "내용을 입력하세요. '/' 입력으로 블록을 추가할 수 있습니다.",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Auto-save indicator
  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(() => {
      setAutoSaved(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    }, 2000);
    return () => clearTimeout(t);
  }, [content, editor]);

  // Esc closes preview / menus
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPreviewOpen(false); setOpenMenu(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const clickedInside = Object.values(menuRefs.current).some(
        ref => ref && ref.contains(e.target as Node)
      );
      if (!clickedInside) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Handle slash-command image URL prompt (dispatched from SlashCommand.tsx)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { editor: ed, range } = (e as CustomEvent).detail;
      const url = await prompt("이미지 URL을 입력하세요", {
        placeholder: "https://example.com/image.jpg",
        confirmLabel: "삽입",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (url) (ed as any).chain().focus().deleteRange(range).setImage({ src: url }).run();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else (ed as any).chain().focus().deleteRange(range).run();
    };
    document.addEventListener("editor:image-url-prompt", handler);
    return () => document.removeEventListener("editor:image-url-prompt", handler);
  }, [prompt]);

  const toggle = (name: string) => setOpenMenu(v => v === name ? null : name);

  const setLink = useCallback(async () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const url = await prompt("링크 URL을 입력하세요", {
      defaultValue: prev,
      placeholder: "https://example.com",
      confirmLabel: "적용",
    });
    if (url === null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url }).run();
  }, [editor, prompt]);

  const addImageByUrl = useCallback(async () => {
    if (!editor) return;
    const url = await prompt("이미지 URL을 입력하세요", {
      placeholder: "https://example.com/image.jpg",
      confirmLabel: "삽입",
    });
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor, prompt]);

  const addYoutube = useCallback(async () => {
    if (!editor) return;
    const url = await prompt("YouTube URL을 입력하세요", {
      placeholder: "https://youtu.be/...",
      confirmLabel: "삽입",
    });
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor, prompt]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) editor.chain().focus().setImage({ src: data.url }).run();
      else toast.error(data.error || "업로드 실패", "이미지를 업로드할 수 없습니다.");
    } catch {
      toast.error("업로드 오류", "이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [editor]);

  const applyFont = useCallback((fontValue: string) => {
    if (!editor) return;
    setCurrentFont(fontValue);
    setOpenMenu(null);
    if (!fontValue) editor.chain().focus().unsetFontFamily().run();
    else editor.chain().focus().setFontFamily(fontValue).run();
  }, [editor]);

  const applySize = useCallback((sizeValue: string) => {
    if (!editor) return;
    setCurrentSize(sizeValue);
    setOpenMenu(null);
    if (!sizeValue) (editor.chain().focus() as any).unsetFontSize().run();
    else (editor.chain().focus() as any).setFontSize(sizeValue).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  const currentFontLabel = FONTS.find(f => f.value === currentFont)?.label ?? "기본";
  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  // Current active text/highlight color
  const activeColor     = editor.getAttributes("textStyle").color || "";
  const activeHighlight = editor.getAttributes("highlight").color || "";

  return (
    <div className="flex flex-col gap-0 h-full">
      {toastNode}
      {promptNode}

      {/* ── Toolbar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-0.5 flex-wrap shadow-sm">

        {/* Font family */}
        <div ref={el => { menuRefs.current["font"] = el; }}>
          <DropdownBtn
            label={<span className="truncate max-w-[100px] block">{currentFontLabel}</span>}
            open={openMenu === "font"}
            onToggle={() => toggle("font")}
            width="w-52"
          >
            {FONTS.map(f => (
              <button key={f.value} onClick={() => applyFont(f.value)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${currentFont === f.value ? "bg-[#0d1b8e]/10 text-[#0d1b8e] font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                style={{ fontFamily: f.value || "inherit" }}>
                {f.label}
                {currentFont === f.value && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7"/></svg>}
              </button>
            ))}
          </DropdownBtn>
        </div>

        {/* Font size */}
        <div ref={el => { menuRefs.current["size"] = el; }} className="ml-1">
          <DropdownBtn
            label={<span className="w-10 text-center block">{currentSize || "크기"}</span>}
            open={openMenu === "size"}
            onToggle={() => toggle("size")}
            width="w-28"
          >
            {FONT_SIZES.map(s => (
              <button key={s.value} onClick={() => applySize(s.value)}
                className={`w-full text-left px-4 py-1.5 text-sm transition-colors flex items-center justify-between ${currentSize === s.value ? "bg-[#0d1b8e]/10 text-[#0d1b8e] font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>
                {s.label}
                {currentSize === s.value && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7"/></svg>}
              </button>
            ))}
          </DropdownBtn>
        </div>

        <Sep />

        {/* Text color */}
        <div ref={el => { menuRefs.current["color"] = el; }}>
          <DropdownBtn
            label={
              <span className="flex items-center gap-1">
                <span className="font-bold text-sm" style={{ color: activeColor || "#1a1a2e" }}>A</span>
                <span className="w-4 h-1 rounded-full mt-0.5" style={{ background: activeColor || "#1a1a2e" }} />
              </span>
            }
            open={openMenu === "color"}
            onToggle={() => toggle("color")}
            width="w-36"
          >
            <div className="px-3 py-2">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">글자 색상</p>
              <div className="grid grid-cols-5 gap-1.5">
                {TEXT_COLORS.filter(c => c.value).map(c => (
                  <button key={c.value} title={c.label} onClick={() => { editor.chain().focus().setColor(c.value).run(); setOpenMenu(null); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${activeColor === c.value ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ background: c.value }} />
                ))}
              </div>
              <button onClick={() => { editor.chain().focus().unsetColor().run(); setOpenMenu(null); }}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-800 text-center py-1 hover:bg-gray-50 rounded transition-colors">
                기본값으로
              </button>
            </div>
          </DropdownBtn>
        </div>

        {/* Highlight color */}
        <div ref={el => { menuRefs.current["highlight"] = el; }}>
          <DropdownBtn
            label={
              <span className="flex items-center gap-1">
                <span className="font-bold text-sm px-0.5 rounded" style={{ background: activeHighlight || "#fef08a", color: "#1a1a2e" }}>H</span>
              </span>
            }
            open={openMenu === "highlight"}
            onToggle={() => toggle("highlight")}
            width="w-36"
          >
            <div className="px-3 py-2">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">형광펜</p>
              <div className="grid grid-cols-6 gap-1.5">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.value} title={c.label} onClick={() => { editor.chain().focus().toggleHighlight({ color: c.value }).run(); setOpenMenu(null); }}
                    className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${activeHighlight === c.value ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ background: c.value }} />
                ))}
              </div>
              <button onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenMenu(null); }}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-800 text-center py-1 hover:bg-gray-50 rounded transition-colors">
                형광펜 제거
              </button>
            </div>
          </DropdownBtn>
        </div>

        <Sep />

        {/* Text style */}
        <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="굵게 (Ctrl+B)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="기울임">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="밑줄">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="취소선">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 6 3.9h.2m8.2 3.2c.3.4.4.8.4 1.3 0 2.9-2.7 3.6-6.2 3.6-2.3 0-4.4-.3-6-.7M4 12h16"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="위첨자">
          <span className="font-bold text-[11px] leading-none">x<sup className="text-[8px]">2</sup></span>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="아래첨자">
          <span className="font-bold text-[11px] leading-none">x<sub className="text-[8px]">2</sub></span>
        </TB>

        <Sep />

        {/* Heading */}
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="제목 1">
          <span className="font-black text-[11px]">H1</span>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="제목 2">
          <span className="font-black text-[11px]">H2</span>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="제목 3">
          <span className="font-black text-[11px]">H3</span>
        </TB>

        <Sep />

        {/* Lists */}
        <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="불릿 목록">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="번호 목록">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="체크리스트">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" y1="8" x2="21" y2="8"/><line x1="13" y1="18" x2="21" y2="18"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="인용구">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </TB>

        <Sep />

        {/* Align */}
        <TB onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="왼쪽">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="가운데">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="오른쪽">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </TB>

        <Sep />

        {/* Table */}
        <TB onClick={insertTable} active={editor.isActive("table")} title="표 삽입 (3×3)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </TB>
        {editor.isActive("table") && (
          <>
            <TB onClick={() => editor.chain().focus().addColumnAfter().run()} title="열 추가">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><line x1="14" y1="9" x2="21" y2="9"/><line x1="17.5" y1="5.5" x2="17.5" y2="12.5"/></svg>
            </TB>
            <TB onClick={() => editor.chain().focus().addRowAfter().run()} title="행 추가">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><line x1="9" y1="14" x2="9" y2="21"/><line x1="5.5" y1="17.5" x2="12.5" y2="17.5"/></svg>
            </TB>
            <TB onClick={() => editor.chain().focus().deleteColumn().run()} title="열 삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><line x1="14" y1="9" x2="21" y2="9"/><line x1="14" y1="9" x2="21" y2="9" strokeWidth="2"/><path d="m14 7 7 7m-7 0 7-7"/></svg>
            </TB>
            <TB onClick={() => editor.chain().focus().deleteRow().run()} title="행 삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="m9 16 6 6m-6 0 6-6"/></svg>
            </TB>
            <TB onClick={() => editor.chain().focus().deleteTable().run()} title="표 삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 9 6 6m-6 0 6-6"/></svg>
            </TB>
          </>
        )}

        <Sep />

        {/* Media */}
        <TB onClick={setLink} active={editor.isActive("link")} title="링크">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </TB>
        <TB onClick={() => fileInputRef.current?.click()} title={uploadingImage ? "업로드 중…" : "이미지 업로드"}>
          {uploadingImage
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          }
        </TB>
        <TB onClick={addImageByUrl} title="이미지 URL">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.5"/></svg>
        </TB>
        <TB onClick={addYoutube} title="YouTube 삽입">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="코드 블록">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </TB>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />

        <Sep />

        {/* History */}
        <TB onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Y)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </TB>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {autoSaved && (
            <span className="text-[10px] text-gray-300 hidden sm:block">✓ {autoSaved} 저장</span>
          )}
          <span className="text-[11px] text-gray-400 tabular-nums hidden sm:block">{charCount.toLocaleString()}자 · {wordCount}단어</span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            미리보기
          </button>
        </div>
      </div>

      {/* ── Editor row: block panel + editor ── */}
      <div className="flex gap-4 flex-1 mt-2">

        {/* Left block panel */}
        <div className="w-44 flex-shrink-0 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">블록 추가</p>
          <div className="space-y-1.5">
            {BLOCKS.map((block) => (
              <button
                key={block.label}
                type="button"
                onClick={() => {
                  if (block.label === "표") {
                    insertTable();
                  } else {
                    editor.chain().focus().insertContent(block.html).run();
                  }
                }}
                title={block.desc}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-[#0d1b8e] hover:bg-blue-50 transition-all text-left group"
              >
                <span className="text-base leading-none">{block.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700 group-hover:text-[#0d1b8e] leading-tight">{block.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{block.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-gray-300 leading-relaxed">
            <kbd className="bg-gray-100 text-gray-400 px-1 py-0.5 rounded font-mono">/</kbd>
            {" "}입력으로도 추가 가능
          </p>
        </div>

        {/* Editor */}
        <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <EditorContent
            editor={editor}
            className="
              [&_.ProseMirror]:min-h-[520px] [&_.ProseMirror]:px-10 [&_.ProseMirror]:py-8
              [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-black [&_.ProseMirror_h1]:text-[#0d1b8e] [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-3
              [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:text-[#0d1b8e] [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-2
              [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-gray-800 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:mb-2
              [&_.ProseMirror_p]:my-2 [&_.ProseMirror_p]:text-gray-700 [&_.ProseMirror_p]:leading-relaxed
              [&_.ProseMirror_a]:text-[#00a3ff] [&_.ProseMirror_a]:underline
              [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-[#0d1b8e] [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-gray-500 [&_.ProseMirror_blockquote]:my-4
              [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-2
              [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-2
              [&_.ProseMirror_li]:my-1
              [&_.ProseMirror_hr]:border-gray-200 [&_.ProseMirror_hr]:my-6
              [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-3
              [&_.ProseMirror_code]:bg-blue-50 [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-sm
              [&_.ProseMirror_pre]:bg-gray-900 [&_.ProseMirror_pre]:text-gray-100 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto
              [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic
              [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-4
              [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-gray-50 [&_.ProseMirror_th]:px-3 [&_.ProseMirror_th]:py-2 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:text-sm
              [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-200 [&_.ProseMirror_td]:px-3 [&_.ProseMirror_td]:py-2 [&_.ProseMirror_td]:text-sm
              [&_.ProseMirror_ul[data-type=taskList]]:list-none [&_.ProseMirror_ul[data-type=taskList]]:pl-0
              [&_.ProseMirror_li[data-type=taskItem]]:flex [&_.ProseMirror_li[data-type=taskItem]]:items-start [&_.ProseMirror_li[data-type=taskItem]]:gap-2
              [&_.ProseMirror_li[data-type=taskItem]_label]:mt-0.5
              [&_.ProseMirror_li[data-type=taskItem]_input]:mt-1 [&_.ProseMirror_li[data-type=taskItem]_input]:accent-[#0d1b8e]
              [&_.ProseMirror_.hljs]:bg-transparent
            "
          />
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
        >
          {/* Modal Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(["desktop", "mobile", "text"] as PreviewDevice[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPreviewDevice(d)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    previewDevice === d ? "bg-white shadow-sm text-[#0d1b8e]" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {d === "desktop" && <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>데스크톱</>}
                  {d === "mobile"  && <><svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>모바일</>}
                  {d === "text"    && <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>텍스트 전용</>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {previewDevice === "desktop" ? "600px 이메일" : previewDevice === "mobile" ? "375px 모바일" : "plain text"}
              </span>
              <button type="button" onClick={() => setPreviewOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            {previewDevice === "text" ? (
              <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-8">
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-xs text-gray-500 space-y-1 font-mono border border-gray-200">
                  <p><span className="text-gray-400">From:</span> 대덕.it &lt;jmyun@daeduck.com&gt;</p>
                  <p><span className="text-gray-400">Content-Type:</span> text/plain; charset=UTF-8</p>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
                  {editor.getText().split("\n").map(l => l.trim()).filter(Boolean).join("\n\n")}
                  {"\n\n---\n대덕전자 | IT인프라그룹\n담당자: 윤종민 프로\n수신거부 링크"}
                </pre>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-xl overflow-hidden transition-all"
                style={{ width: previewDevice === "mobile" ? "375px" : "600px", minHeight: "600px" }}>
                {previewDevice === "desktop" && (
                  <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 space-y-1">
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span className="text-gray-400 w-12">보낸이:</span>
                      <span className="font-medium text-gray-700">대덕.it &lt;jmyun@daeduck.com&gt;</span>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span className="text-gray-400 w-12">제목:</span>
                      <span className="font-medium text-gray-700">[대덕.it] 뉴스레터</span>
                    </div>
                  </div>
                )}
                <div style={{ background: "linear-gradient(135deg,#0d1b8e,#1a2fa8)", padding: previewDevice === "mobile" ? "16px 20px" : "20px 32px" }}>
                  <div style={{ color: "#fff", fontSize: previewDevice === "mobile" ? "20px" : "24px", fontWeight: 900 }}>
                    대덕<span style={{ color: "#00a3ff" }}>.it</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,.6)", fontSize: "11px", marginTop: 3 }}>대덕의 IT, 소식을 잇다</div>
                </div>
                <div
                  style={{ padding: previewDevice === "mobile" ? "20px 16px" : "32px", fontFamily: "'Apple SD Gothic Neo',Arial,sans-serif", fontSize: previewDevice === "mobile" ? "14px" : "15px", lineHeight: 1.8, color: "#1a1a2e" }}
                  className="[&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-[#0d1b8e] [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#0d1b8e] [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-3 [&_a]:text-[#0d1b8e] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-[#0d1b8e] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:my-4 [&_hr]:border-gray-200 [&_hr]:my-6 [&_img:not(.emoji)]:max-w-full [&_img:not(.emoji)]:rounded-lg [&_img:not(.emoji)]:my-3 [&_strong]:font-bold [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:text-sm"
                  dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
                />
                <div style={{ padding: "16px 24px", textAlign: "center", fontSize: "11px", color: "#aaa", background: "#f9fafb", borderTop: "1px solid #eee", lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 4px" }}>대덕전자 | IT인프라그룹</p>
                  <p style={{ margin: "0 0 4px" }}>담당자: 윤종민 프로</p>
                  <p style={{ margin: 0 }}>이 메일은 구독자에게 발송됩니다. · <a href="#" style={{ color: "#aaa" }}>수신거부</a></p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
