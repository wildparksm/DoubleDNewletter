import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SmtpTestPanel from "./SmtpTestPanel";
import PageHeader from "@/components/PageHeader";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const smtpConfig = {
    host: process.env.SMTP_HOST || "192.168.6.112",
    port: process.env.SMTP_PORT || "25",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "newsletter@daeduck.com",
    auth: process.env.SMTP_USER ? process.env.SMTP_USER : "없음 (익명 릴레이)",
  };

  return (
    <main className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="설정"
        subtitle="SMTP 발송 설정과 시스템 옵션을 관리합니다."
      />
      <SmtpTestPanel smtpConfig={smtpConfig} defaultEmail={session.email} />
    </main>
  );
}
