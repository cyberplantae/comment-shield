"use client";

import { useState, useTransition, type ReactNode } from "react";

export function SettingsForm({ action, children, className, id, success = "Your boundaries are saved." }: {
  action: (data: FormData) => Promise<void | { error: string }>;
  children: ReactNode;
  className?: string;
  id?: string;
  success?: string;
}) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form id={id} className={className} onChange={() => setStatus(null)} onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      setStatus(null);
      start(async () => {
        try { const result = await action(data); setStatus(result?.error ? { ok: false, text: result.error } : { ok: true, text: success }); }
        catch { setStatus({ ok: false, text: "We couldn’t finish saving. Check your connection and try again." }); }
      });
    }}>
      <fieldset disabled={pending} className="min-w-0 space-y-8" aria-busy={pending}>{children}</fieldset>
      <div aria-live="polite" className="mt-3 text-sm">
        {pending ? "Saving your preferences…" : status ? <p className={status.ok ? "text-[var(--color-accent-ink)]" : "text-[var(--color-sev-hate)]"}>{status.text}</p> : null}
      </div>
    </form>
  );
}
