"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton({ label = "Check for new comments" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="btn btn-quiet" disabled={pending} onClick={() => start(() => router.refresh())}>
    {pending ? "Checking…" : label}
  </button>;
}
