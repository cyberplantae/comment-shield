"use client";
import { useEffect, useState } from "react";
export function Status() {
 const [state, setState] = useState<{ lastChecked: string | null; busy: boolean; error: string | null }>();
 useEffect(() => { const check = () => fetch("/api/desktop/status").then(r => r.ok ? r.json() : null).then(setState).catch(() => {}); void check(); const timer = setInterval(check, 10000); return () => clearInterval(timer); }, []);
 return <p role="status" className="text-sm text-[var(--color-muted)]">{state?.error || (state?.busy ? "Checking comments…" : state?.lastChecked ? `Last check finished at ${new Date(state.lastChecked).toLocaleTimeString()}.` : "Your first check will appear here after you start.")}</p>;
}
