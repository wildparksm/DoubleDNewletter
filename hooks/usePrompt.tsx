"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

interface PromptOptions {
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptState extends Required<PromptOptions> {
  title: string;
  resolve: (value: string | null) => void;
}

export function usePrompt() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state) {
      setValue(state.defaultValue);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [state]);

  const prompt = useCallback(
    (title: string, options: PromptOptions = {}): Promise<string | null> =>
      new Promise((resolve) => {
        setState({
          title,
          placeholder:  options.placeholder  ?? "",
          defaultValue: options.defaultValue ?? "",
          confirmLabel: options.confirmLabel ?? "확인",
          cancelLabel:  options.cancelLabel  ?? "취소",
          resolve,
        });
      }),
    []
  );

  const close = useCallback(
    (result: string | null) => {
      setState((prev) => {
        prev?.resolve(result);
        return null;
      });
      setValue("");
    },
    []
  );

  const handleSubmit = useCallback(() => {
    setState((prev) => {
      prev?.resolve(value.trim() || null);
      return null;
    });
    setValue("");
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit();
      if (e.key === "Escape") close(null);
    },
    [handleSubmit, close]
  );

  const promptNode = state ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "inherit",
      }}
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in"
        onClick={() => close(null)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.30)",
          backdropFilter: "blur(3px)",
        }}
      />

      {/* Card */}
      <div
        className="animate-scale-in"
        style={{
          position: "relative",
          zIndex: 1,
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth: 340,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ height: 4, background: "#0d1b8e" }} />

        <div style={{ padding: "20px 20px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
            {state.title}
          </p>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={state.placeholder}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px",
              fontSize: 13,
              color: "#111827",
              background: "#f9fafb",
              border: "1.5px solid #e5e7eb",
              borderRadius: 10,
              outline: "none",
              marginBottom: 14,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#0d1b8e";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(13,27,142,0.10)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => close(null)}
              style={{
                flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600,
                color: "#374151", background: "#f3f4f6", border: "none",
                borderRadius: 11, cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e5e7eb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
            >
              {state.cancelLabel}
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700,
                color: "#fff", background: "#0d1b8e", border: "none",
                borderRadius: 11, cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1a2fa8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#0d1b8e"; }}
            >
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { prompt, promptNode };
}
