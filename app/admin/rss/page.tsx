import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import RssClient from "./RssClient";
import PageHeader from "@/components/PageHeader";

export default async function RssPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <main className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="RSS Inbox"
        title="RSS 수신함"
        subtitle="외부 피드에서 자동 수집된 새 기사를 검토하고 큐레이션합니다."
      />
      <RssClient />
    </main>
  );
}
