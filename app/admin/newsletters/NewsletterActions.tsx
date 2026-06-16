"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";

export default function NewsletterActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const { toast, toastNode } = useToast();
  const { confirm, confirmNode } = useConfirm();

  async function handleDelete() {
    const ok = await confirm("정말 삭제하시겠습니까?", {
      title: "뉴스레터 삭제",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/newsletters/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleSend() {
    const ok = await confirm("모든 구독자에게 이메일을 발송하시겠습니까?", {
      title: "이메일 발송",
      confirmLabel: "발송하기",
    });
    if (!ok) return;
    setSending(true);
    const res = await fetch(`/api/newsletters/${id}/send`, { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      toast.success("발송 완료", `성공 ${data.sent}건 · 실패 ${data.failed}건`);
      router.refresh();
    } else {
      toast.error("발송 실패", "이메일 발송 중 오류가 발생했습니다.");
    }
  }

  return (
    <>
      {toastNode}
      {confirmNode}
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/admin/newsletters/${id}/edit`}
          className="text-xs text-[#0d1b8e] hover:underline font-medium"
        >
          편집
        </Link>
        {status !== "published" && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
          >
            {sending ? "발송 중..." : "발송"}
          </button>
        )}
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
