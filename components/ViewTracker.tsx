"use client";

import { useEffect } from "react";

export default function ViewTracker({ id }: { id: number }) {
  useEffect(() => {
    const key = `viewed_${id}`;
    if (sessionStorage.getItem(key)) return;
    fetch(`/api/newsletter/${id}/view`, { method: "POST" }).then(r => {
      if (r.ok) sessionStorage.setItem(key, "1");
    });
  }, [id]);

  return null;
}
