"use client";

import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/useConfirm";

export default function SubscriberActions({
  id,
  isUnsubscribed,
}: {
  id: number;
  isUnsubscribed: boolean;
}) {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();

  async function handleDelete() {
    const ok = await confirm("정말 삭제하시겠습니까?", {
      title: "구독자 삭제",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleToggle() {
    await fetch(`/api/subscribers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribe: !isUnsubscribed }),
    });
    router.refresh();
  }

  return (
    <>
      {confirmNode}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleToggle}
          className={`text-xs font-medium hover:underline ${
            isUnsubscribed ? "text-green-600" : "text-yellow-600"
          }`}
        >
          {isUnsubscribed ? "재구독" : "구독취소"}
        </button>
        <button
          onClick={handleDelete}
          className="text-xs text-red-500 hover:underline font-medium"
        >
          삭제
        </button>
      </div>
    </>
  );
}
