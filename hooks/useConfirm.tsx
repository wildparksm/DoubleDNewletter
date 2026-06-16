"use client";

import React, { useState, useCallback } from "react";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends Required<ConfirmOptions> {
  message: string;
  resolve: (value: boolean) => void;
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}): Promise<boolean> =>
      new Promise((resolve) => {
        setState({
          message,
          title:        options.title        ?? "확인",
          confirmLabel: options.confirmLabel ?? "확인",
          cancelLabel:  options.cancelLabel  ?? "취소",
          danger:       options.danger       ?? false,
          resolve,
        });
      }),
    []
  );

  const close = useCallback(
    (result: boolean) => {
      setState((prev) => {
        prev?.resolve(result);
        return null;
      });
    },
    []
  );

  const isDanger = state?.danger ?? false;

  const confirmNode = state ? (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Backdrop — blur + dark overlay */}
      <div
        onClick={() => close(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-7 shadow-2xl animate-scale-in">
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white border ${
              isDanger
                ? "bg-gradient-to-br from-red-500/40 to-rose-500/20 border-red-400/30"
                : "bg-gradient-to-br from-blue-500/40 to-cyan-500/20 border-blue-400/30"
            }`}
          >
            {isDanger ? <TrashIcon /> : <SendIcon />}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {state.title}
          </h2>
        </div>

        {/* Message */}
        <p className="text-[14px] text-zinc-300 leading-relaxed mb-6 whitespace-pre-line">
          {state.message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 py-3 px-6 rounded-xl bg-white/5 hover:bg-white/15 text-white font-semibold border border-white/10 transition-colors"
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`flex-1 py-3 px-6 rounded-xl text-white font-bold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-100 ${
              isDanger
                ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-500/30"
                : "bg-gradient-to-r from-blue-600 to-cyan-500 shadow-blue-500/30"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmNode };
}
