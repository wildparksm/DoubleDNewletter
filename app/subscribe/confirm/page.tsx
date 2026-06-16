"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

function ConfirmContent() {
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("유효하지 않은 링크입니다."); return; }

    fetch("/api/subscribe/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setStatus("done"); setName(d.name || ""); }
        else { setStatus("error"); setErrorMsg(d.error || "처리 중 오류가 발생했습니다."); }
      })
      .catch(() => { setStatus("error"); setErrorMsg("요청 처리 중 오류가 발생했습니다."); });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1b8e] via-[#1a2fa8] to-[#0066cc] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">
          {status === "loading" ? "⏳" : status === "done" ? "🎉" : "❌"}
        </div>
        <div className="flex justify-center mb-2">
          <Logo size="sm" href="/" />
        </div>
        <div className="mb-8" />

        {status === "loading" && (
          <p className="text-gray-500 text-sm">구독 확인 중...</p>
        )}

        {status === "done" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">구독이 확인되었습니다!</h1>
            <p className="text-gray-500 text-sm mb-6">
              {name}님, 환영합니다!<br />
              이제 대덕.it 뉴스레터를 이메일로 받아보실 수 있습니다.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-left mb-6">
              <p className="font-semibold text-[#0d1b8e] mb-2">📬 앞으로 받게 될 내용</p>
              <ul className="space-y-1 text-gray-600">
                <li>· 최신 IT 트렌드와 기술 인사이트</li>
                <li>· 사내 IT 프로젝트 소식</li>
                <li>· 업계 동향 및 유용한 도구 소개</li>
              </ul>
            </div>
            <Link href="/" className="block bg-[#0d1b8e] hover:bg-[#1a2fa8] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors">
              뉴스레터 아카이브 보기
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-gray-800 mb-3">확인 실패</h1>
            <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
            <Link href="/subscribe" className="block text-sm text-[#0d1b8e] hover:underline">
              다시 구독 신청하기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0d1b8e] via-[#1a2fa8] to-[#0066cc] flex items-center justify-center">
        <div className="text-white text-lg">처리 중...</div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
