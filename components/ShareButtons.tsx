"use client";

import { useState } from "react";

interface ShareButtonsProps {
  title: string;
  url: string;
}

export default function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareKakao = () => {
    // Kakao share via URL scheme — works if KakaoTalk is installed
    const kakaoUrl = `kakaotalk://share?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(kakaoUrl, "_blank");
  };

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const shareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=500"
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-400 mr-1">공유하기</span>

      <button
        onClick={copyUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            복사됨!
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            링크 복사
          </>
        )}
      </button>

      <button
        onClick={shareTwitter}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-800 hover:bg-gray-900 hover:text-white text-xs font-medium text-gray-600 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        X (Twitter)
      </button>

      <button
        onClick={shareLinkedIn}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-xs font-medium text-blue-600 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
        LinkedIn
      </button>

      <button
        onClick={shareKakao}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-300 hover:bg-yellow-400 hover:border-yellow-400 text-xs font-medium text-yellow-700 hover:text-yellow-900 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.69 2 11.25c0 2.89 1.79 5.44 4.5 6.97-.2.74-.73 2.69-.84 3.11-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.54.72.1 1.45.16 2.2.16 5.52 0 10-3.69 10-8.25S17.52 3 12 3"/></svg>
        카카오
      </button>
    </div>
  );
}
