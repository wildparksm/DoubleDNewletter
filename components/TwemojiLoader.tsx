"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twemoji?: { parse: (el: Element | Document, opts?: Record<string, unknown>) => void };
  }
}

/**
 * 윈도우 기본 이모지(Segoe UI Emoji) 대신 Twemoji(트위터 오픈소스) SVG 이모지로 교체.
 * 라우트 이동 시마다 재적용되도록 pathname 의존 없이 MutationObserver로 처리.
 */
export default function TwemojiLoader() {
  useEffect(() => {
    const TWEMOJI_CDN = "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js";
    const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/";

    function applyTwemoji() {
      window.twemoji?.parse(document.body, {
        folder: "svg",
        ext: ".svg",
        base: TWEMOJI_BASE,
      });
    }

    if (window.twemoji) {
      applyTwemoji();
      return;
    }

    // 이미 로딩 중인 스크립트가 있으면 중복 삽입 방지
    if (document.querySelector(`script[src="${TWEMOJI_CDN}"]`)) {
      const wait = setInterval(() => {
        if (window.twemoji) { clearInterval(wait); applyTwemoji(); }
      }, 50);
      return () => clearInterval(wait);
    }

    const script = document.createElement("script");
    script.src = TWEMOJI_CDN;
    script.crossOrigin = "anonymous";
    script.onload = applyTwemoji;
    document.head.appendChild(script);
  }, []);

  return null;
}
