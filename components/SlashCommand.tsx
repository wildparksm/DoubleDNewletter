"use client";

import { Extension, Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import "tippy.js/dist/tippy.css";

// ── Command Definitions ──────────────────────────────────────────────────────
interface CommandItem {
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  action: (editor: Editor, range: Range) => void;
}

const COMMANDS: CommandItem[] = [
  {
    title: "제목 1", description: "큰 제목", icon: "H1",
    keywords: ["h1", "heading", "제목"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: "제목 2", description: "중간 제목", icon: "H2",
    keywords: ["h2", "heading", "제목"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: "제목 3", description: "소제목", icon: "H3",
    keywords: ["h3", "heading", "제목"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: "불릿 리스트", description: "글머리 기호 목록", icon: "•",
    keywords: ["bullet", "list", "목록"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "번호 목록", description: "번호 있는 목록", icon: "1.",
    keywords: ["ordered", "list", "번호"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "인용구", description: "강조 인용 블록", icon: "❝",
    keywords: ["quote", "blockquote", "인용"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "구분선", description: "섹션 구분선", icon: "—",
    keywords: ["divider", "hr", "구분"],
    action: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "CTA 버튼", description: "클릭 유도 버튼", icon: "🔘",
    keywords: ["button", "cta", "버튼"],
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range)
        .insertContent(`<p style="text-align:center"><a href="https://example.com" style="display:inline-block;background:#0d1b8e;color:#fff;padding:12px 32px;border-radius:50px;font-weight:600;text-decoration:none;font-size:15px;">자세히 보기 →</a></p>`)
        .run(),
  },
  {
    title: "강조 박스", description: "파란 콜아웃 박스", icon: "💡",
    keywords: ["callout", "box", "강조", "박스"],
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range)
        .insertContent(`<div style="background:#f0f4ff;border-left:4px solid #0d1b8e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#0d1b8e;font-weight:600">💡 알고 계셨나요?</p><p style="margin:8px 0 0">여기에 강조 내용을 입력하세요.</p></div>`)
        .run(),
  },
  {
    title: "경고 박스", description: "주의/경고 알림", icon: "⚠️",
    keywords: ["warning", "alert", "경고", "주의"],
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range)
        .insertContent(`<div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#c2410c;font-weight:600">⚠️ 주의사항</p><p style="margin:8px 0 0">여기에 주의 내용을 입력하세요.</p></div>`)
        .run(),
  },
  {
    title: "성공 박스", description: "완료/성공 알림", icon: "✅",
    keywords: ["success", "done", "성공", "완료"],
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range)
        .insertContent(`<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px"><p style="margin:0;color:#15803d;font-weight:600">✅ 완료</p><p style="margin:8px 0 0">여기에 완료 내용을 입력하세요.</p></div>`)
        .run(),
  },
  {
    title: "이미지", description: "URL로 이미지 삽입", icon: "🖼",
    keywords: ["image", "img", "이미지"],
    action: (editor, range) => {
      // Dispatch custom event so the parent React component can show a styled prompt
      document.dispatchEvent(
        new CustomEvent("editor:image-url-prompt", {
          detail: { editor, range },
        })
      );
    },
  },
  {
    title: "서명", description: "작성자 서명 블록", icon: "✍",
    keywords: ["signature", "서명"],
    action: (editor, range) =>
      editor.chain().focus().deleteRange(range)
        .insertContent(`<hr><p><strong>홍길동</strong><br><span style="color:#888;font-size:14px">대덕전자 IT팀 | hong@daeduck.com</span></p>`)
        .run(),
  },
];

// ── Popup List ───────────────────────────────────────────────────────────────
interface ListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}
export interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const CommandList = forwardRef<CommandListRef, ListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowUp")   { setSelected((i) => (i - 1 + items.length) % items.length); return true; }
      if (event.key === "ArrowDown") { setSelected((i) => (i + 1) % items.length); return true; }
      if (event.key === "Enter")     { if (items[selected]) command(items[selected]); return true; }
      return false;
    },
  }));

  if (!items.length) return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 w-52">
      결과 없음
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-60 max-h-72 overflow-y-auto py-1">
      <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
        블록 삽입 <span className="text-gray-300 font-normal">↑↓ 이동 · Enter 선택 · Esc 닫기</span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.title}
          onClick={() => command(item)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selected ? "bg-[#0d1b8e]/10 text-[#0d1b8e]" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-bold flex-shrink-0">
            {item.icon}
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{item.title}</p>
            <p className="text-xs text-gray-400 leading-tight">{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
});
CommandList.displayName = "CommandList";

// ── Extension ────────────────────────────────────────────────────────────────
export const SlashCommandExtension = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        items({ query }: { query: string }) {
          const q = query.toLowerCase();
          if (!q) return COMMANDS;
          return COMMANDS.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q) ||
              c.keywords.some((k) => k.includes(q))
          );
        },
        render() {
          let renderer: ReactRenderer<CommandListRef, ListProps>;
          let popup: TippyInstance[];

          return {
            onStart(props) {
              renderer = new ReactRenderer(CommandList, {
                props: { ...props, command: (item: CommandItem) => props.command(item) },
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: renderer.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate(props) {
              renderer.updateProps({ ...props, command: (item: CommandItem) => props.command(item) });
              if (props.clientRect) popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") { popup[0]?.hide(); return true; }
              return renderer.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup?.[0]?.destroy();
              renderer?.destroy();
            },
          };
        },
        command({ editor, range, props }) {
          (props as CommandItem).action(editor as unknown as Editor, range);
        },
      }),
    ];
  },
});
