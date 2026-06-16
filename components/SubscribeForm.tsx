"use client";

import { useState } from "react";
import Link from "next/link";

export default function SubscribeForm() {
  const [form, setForm] = useState({ name: "", email: "", department: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "구독이 완료되었습니다!");
      } else {
        setStatus("error");
        setMessage(data.error || "오류가 발생했습니다.");
      }
    } catch {
      setStatus("error");
      setMessage("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }

  const inputCls =
    "w-full px-4 py-3 rounded-xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-colors";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  if (status === "success") {
    return (
      <div className="text-center py-8">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0d1b8e]/10 text-[#0d1b8e] dark:bg-blue-500/15 dark:text-blue-400 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{message}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">앞으로 대덕.it 뉴스레터를 이메일로 받아보실 수 있어요.</p>
        <Link href="/" className="inline-flex items-center gap-1.5 text-[#0d1b8e] dark:text-blue-400 hover:underline font-semibold text-sm">
          아티클 보러가기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sub-name" className={labelCls}>이름 <span className="text-rose-500">*</span></label>
        <input id="sub-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="sub-email" className={labelCls}>이메일 <span className="text-rose-500">*</span></label>
        <input id="sub-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hong@daeduck.com" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="sub-dept" className={labelCls}>부서</label>
        <input id="sub-dept" type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="개발팀" className={inputCls} />
      </div>

      {status === "error" && (
        <p className="text-rose-600 dark:text-rose-400 text-sm bg-rose-50 dark:bg-rose-950/30 px-4 py-3 rounded-xl">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-[#0d1b8e] hover:bg-[#0a1570] disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors shadow-sm shadow-[#0d1b8e]/30"
      >
        {status === "loading" ? "처리 중…" : "구독 신청하기"}
      </button>
      <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center">사내 전용 · 언제든 수신 거부할 수 있어요.</p>
    </form>
  );
}
