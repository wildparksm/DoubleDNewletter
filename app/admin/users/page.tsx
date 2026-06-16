import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import getDb from "@/lib/db";
import AddUserForm from "./AddUserForm";
import PageHeader, { HeaderStat } from "@/components/PageHeader";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/admin");

  const db = getDb();
  const users = db.prepare(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
  ).all() as { id: number; name: string; email: string; role: string; created_at: string }[];

  const admins = users.filter((u) => u.role === "admin").length;
  const editors = users.length - admins;

  return (
    <main className="p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="Team"
        title="사용자 관리"
        subtitle="이 워크스페이스에 접근할 수 있는 팀원을 관리합니다."
        meta={
          <>
            <HeaderStat label="전체" value={users.length} />
            <HeaderStat label="관리자" value={admins} />
            <HeaderStat label="편집자" value={editors} />
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AddUserForm />
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">이름</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">이메일</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">권한</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/70">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0d1b8e] to-[#3b82f6] text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
                        {user.name?.charAt(0) || "?"}
                      </span>
                      {user.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        user.role === "admin"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.role === "admin" ? "bg-indigo-500" : "bg-gray-400"
                        }`}
                      />
                      {user.role === "admin" ? "관리자" : "편집자"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
