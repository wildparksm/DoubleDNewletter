"use client";

import { useState } from "react";

interface SmtpConfig {
  host: string;
  port: string;
  from: string;
  auth: string;
}

export default function SmtpTestPanel({
  smtpConfig,
  defaultEmail,
}: {
  smtpConfig: SmtpConfig;
  defaultEmail?: string;
}) {
  const [testEmail, setTestEmail] = useState(defaultEmail || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    step?: string;
    config?: Record<string, string>;
  } | null>(null);

  async function runSmtpTest() {
    if (!testEmail) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/smtp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "네트워크 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* SMTP 테스트 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📧</span>
            <h2 className="font-semibold text-gray-800">SMTP 메일 발송 테스트</h2>
          </div>
          <p className="text-sm text-gray-500">실제 메일을 발송해 SMTP 연결 상태를 확인합니다.</p>
        </div>

        {/* 현재 설정 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">현재 SMTP 설정</p>
          <ConfigRow label="서버" value={`${smtpConfig.host}:${smtpConfig.port}`} />
          <ConfigRow label="인증" value={smtpConfig.auth} />
          <ConfigRow label="발신" value={smtpConfig.from} />
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSmtpTest()}
              placeholder="수신할 이메일 주소"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d1b8e]/20 focus:border-[#0d1b8e]"
            />
            <button
              onClick={runSmtpTest}
              disabled={loading || !testEmail}
              className="px-5 py-2.5 bg-[#0d1b8e] hover:bg-[#1a2fa8] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  발송 중…
                </>
              ) : "테스트 발송"}
            </button>
          </div>

          {/* 결과 */}
          {result && (
            <div className={`rounded-xl p-4 text-sm ${result.ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-start gap-2.5">
                <span className="text-lg mt-0.5">{result.ok ? "✅" : "❌"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold mb-1 ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
                    {result.ok ? "발송 성공" : `발송 실패${result.step ? ` (${result.step === "connect" ? "연결 단계" : "발송 단계"})` : ""}`}
                  </p>
                  <p className={result.ok ? "text-emerald-600" : "text-red-600"}>
                    {result.message || result.error}
                  </p>
                  {result.config && (
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      {Object.entries(result.config).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="font-medium w-14 shrink-0">{k}</span>
                          <span className="font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 트러블슈팅 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>🔧</span> 문제 해결
        </h3>
        <ul className="space-y-2.5 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="text-gray-300 shrink-0 mt-0.5">•</span>
            <span><strong className="text-gray-700">연결 실패</strong> — 서버가 <Code>{smtpConfig.host}:{smtpConfig.port}</Code>에 접근 가능한지 확인. 방화벽이 포트 25를 차단하는지 확인.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-300 shrink-0 mt-0.5">•</span>
            <span><strong className="text-gray-700">메일 미도착</strong> — 스팸함 확인. Exchange 릴레이에서 발신 IP 허용 여부 확인.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-300 shrink-0 mt-0.5">•</span>
            <span><strong className="text-gray-700">인증 오류</strong> — <Code>.env.local</Code>의 <Code>SMTP_USER</Code> / <Code>SMTP_PASS</Code> 확인.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-300 shrink-0 mt-0.5">•</span>
            <span><strong className="text-gray-700">발신자 거부</strong> — Exchange에서 <Code>{smtpConfig.from}</Code> 주소가 릴레이 허용 목록에 있는지 확인.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-400 w-10 shrink-0">{label}</span>
      <code className="text-gray-700 font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">{value}</code>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  );
}
