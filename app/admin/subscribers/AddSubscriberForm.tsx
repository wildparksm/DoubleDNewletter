"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddSubscriberForm() {
  const [form, setForm] = useState({ name: "", email: "", department: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("success");
      setMessage("구독자가 추가되었습니다.");
      setForm({ name: "", email: "", department: "" });
      router.refresh();
    } else {
      setStatus("error");
      setMessage(data.error || "오류가 발생했습니다.");
    }

    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-bold text-gray-800 mb-4">구독자 추가</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="홍길동"
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이메일 *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="hong@daeduck.com"
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="개발팀"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e] transition-colors"
          />
        </div>

        {message && (
          <p className={`text-xs px-3 py-2 rounded-lg ${
            status === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
          }`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-[#0d1b8e] hover:bg-[#1a2fa8] disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          {status === "loading" ? "추가 중..." : "추가하기"}
        </button>
      </form>
    </div>
  );
}
