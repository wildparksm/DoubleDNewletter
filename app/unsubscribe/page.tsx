"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeContent() {
  const params = useSearchParams();
  const subscriberId = params.get("s");
  const email = params.get("email");

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!subscriberId && !email) return;
    setStatus("loading");
    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriberId, email }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setStatus("done"); setMessage(d.message || "구독이 취소되었습니다."); }
        else { setStatus("error"); setMessage(d.error || "오류가 발생했습니다."); }
      })
      .catch(() => { setStatus("error"); setMessage("요청 처리 중 오류가 발생했습니다."); });
  }, [subscriberId, email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1b8e] via-[#1a2fa8] to-[#0066cc] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">
          {status === "done" ? "✅" : status === "error" ? "❌" : "📭"}
        </div>

        <div className="text-2xl font-black text-[#0d1b8e] mb-1">대덕<span className="text-[#00a3ff]">.it</span></div>
        <p className="text-gray-400 text-xs mb-8">대덕의 IT, 소식을 잇다</p>

        {status === "idle" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">구독 취소</h1>
            <p className="text-gray-500 text-sm mb-6">
              구독 취소 링크가 올바르지 않습니다.<br />
              이메일의 구독 취소 링크를 다시 확인해주세요.
            </p>
          </>
        )}

        {status === "loading" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">처리 중...</h1>
            <p className="text-gray-500 text-sm">구독 취소 요청을 처리하고 있습니다.</p>
          </>
        )}

        {status === "done" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">구독이 취소되었습니다</h1>
            <p className="text-gray-500 text-sm mb-6">{message}<br />더 이상 이메일을 받지 않으실 것입니다.</p>
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-600 mb-6">
              <p className="font-semibold text-[#0d1b8e] mb-1">다시 구독하시겠습니까?</p>
              <p>언제든지 구독 신청 페이지에서 다시 구독하실 수 있습니다.</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">오류가 발생했습니다</h1>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
          </>
        )}

        <div className="flex flex-col gap-2">
          {status === "done" && (
            <Link href="/subscribe" className="block bg-[#0d1b8e] hover:bg-[#1a2fa8] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors">
              다시 구독하기
            </Link>
          )}
          <Link href="/" className="block text-sm text-gray-400 hover:text-[#0d1b8e] transition-colors">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0d1b8e] via-[#1a2fa8] to-[#0066cc] flex items-center justify-center">
        <div className="text-white text-lg">처리 중...</div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
