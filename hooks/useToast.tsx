"use client";

import React, { useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

let _counter = 0;

const ACCENT: Record<ToastType, string> = {
  success: "#10b981",
  error:   "#ef4444",
  info:    "#0d1b8e",
  warning: "#f59e0b",
};

const ICON: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  info: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  warning: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = ++_counter;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => dismiss(id), 4500);
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (title: string, message?: string) => show("success", title, message),
    error:   (title: string, message?: string) => show("error",   title, message),
    info:    (title: string, message?: string) => show("info",    title, message),
    warning: (title: string, message?: string) => show("warning", title, message),
  };

  const toastNode =
    toasts.length > 0 ? (
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          fontFamily: "inherit",
        }}
      >
        {toasts.map((t) => {
          const accent = ACCENT[t.type];
          return (
            <div
              key={t.id}
              className="animate-toast-in"
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-start",
                gap: 11,
                background: "#fff",
                borderRadius: 14,
                borderLeft: `4px solid ${accent}`,
                padding: "12px 11px 12px 13px",
                minWidth: 260,
                maxWidth: 360,
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: accent,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {ICON[t.type]}
              </div>

              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
                  {t.title}
                </p>
                {t.message && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {t.message}
                  </p>
                )}
              </div>

              <button
                onClick={() => dismiss(t.id)}
                aria-label="닫기"
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  color: "#9ca3af",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  marginTop: 1,
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                  e.currentTarget.style.color = "#374151";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#9ca3af";
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    ) : null;

  return { toast, toastNode };
}
