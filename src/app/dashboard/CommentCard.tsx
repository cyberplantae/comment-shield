"use client";

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  severity: string | null;
  confidence: number | null;
  summary: string | null;
  text: string;
  author: string | null;
  reason: string | null;
  disposition: string;
  blurByDefault: boolean;
};

/** Label plus the colour tokens that tint the pill and the card's left spine. */
const SEVERITY: Record<string, { label: string; fg: string; bg: string }> = {
  rude: { label: "Mean", fg: "var(--color-sev-mean)", bg: "var(--color-sev-mean-bg)" },
  harassment: {
    label: "Going after you",
    fg: "var(--color-sev-targeted)",
    bg: "var(--color-sev-targeted-bg)",
  },
  hateful: { label: "Hate", fg: "var(--color-sev-hate)", bg: "var(--color-sev-hate-bg)" },
  threatening: { label: "Threat", fg: "var(--color-sev-threat)", bg: "var(--color-sev-threat-bg)" },
  benign: { label: "Fine", fg: "var(--color-muted)", bg: "var(--color-raised)" },
};

/**
 * A percentage invites the reader to do arithmetic about someone's abuse.
 * What they actually need to know is whether to trust the label, so only
 * genuine uncertainty is surfaced, in words.
 */
function uncertaintyNote(confidence: number | null): string | null {
  if (confidence === null) return null;
  if (confidence >= 70) return null;
  if (confidence >= 50) return "We're not certain about this one";
  return "We really couldn't tell — worth a look";
}

export function CommentCard(props: Props) {
  // The point of the summary is that the creator can clear a queue without
  // reading abuse. Revealing the raw text is always a deliberate click.
  const router = useRouter();
  const confirmationId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revealed, setRevealed] = useState(!props.blurByDefault);
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function act(action: "hide" | "delete" | "keep") {
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ commentId: props.id, action }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error === "reconnect_required"
            ? "Instagram access has expired. Reconnect your account, then try again."
            : "We couldn’t update this comment. Please try again.");
          return;
        }
        setResolved(action);
        setConfirmDelete(false);
        router.refresh();
      } catch {
        setError("We couldn’t confirm the change. Check your connection and refresh before trying again.");
      }
    });
  }

  if (resolved) {
    return (
      <li role="status" className="card p-5 text-sm text-[var(--color-muted)]">
        {resolved === "keep"
          ? "Kept on your post."
          : resolved === "hide"
            ? "Hidden from your post. You can restore it from Already hidden."
            : "Deleted for good."}
      </li>
    );
  }

  const alreadyHidden = props.disposition === "auto_hidden" || props.disposition === "hidden";
  const sev = SEVERITY[props.severity ?? ""] ?? SEVERITY.benign!;

  return (
    <li
      className="card spine space-y-4 p-5 pl-6"
      style={{ color: sev.fg }}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="sev" style={{ background: sev.bg, color: sev.fg }}>
          {sev.label}
        </span>
        {uncertaintyNote(props.confidence) ? (
          <span className="text-[var(--color-muted)]">{uncertaintyNote(props.confidence)}</span>
        ) : null}
        {alreadyHidden ? (
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 font-medium text-[var(--color-accent-ink)]">
            hidden
          </span>
        ) : null}
        {props.author ? (
          <span className="text-[var(--color-faint)]">@{props.author}</span>
        ) : null}
      </div>

      <p className="text-[16px] leading-relaxed text-[var(--color-ink)]">
        {props.summary ?? "No summary available."}
      </p>

      {revealed ? (
        <blockquote className="rounded-lg bg-[var(--color-raised)] px-3.5 py-2.5 text-sm text-[var(--color-muted)] break-words">{props.text}</blockquote>
      ) : null}
      <button onClick={() => setRevealed(!revealed)} aria-expanded={revealed} className="min-h-11 text-xs underline decoration-dotted text-[var(--color-muted)]">
        {revealed ? "Hide original words" : "Read original comment"}
      </button>

      {props.reason ? (
        <details className="text-xs text-[var(--color-muted)]">
          <summary className="cursor-pointer list-none underline decoration-dotted">
            Why is this here?
          </summary>
          <p className="mt-1">{props.reason}</p>
        </details>
      ) : null}

      {error ? <p role="alert" className="text-sm text-[var(--color-sev-hate)]">{error}</p> : null}
      {pending ? <p role="status" className="text-xs text-[var(--color-muted)]">Updating comment…</p> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {!alreadyHidden ? (
          <button
            disabled={pending}
            onClick={() => act("hide")}
            className="btn btn-primary"
          >
            Hide
          </button>
        ) : null}
        <button
          disabled={pending}
          onClick={() => act("keep")}
          className="btn btn-quiet"
        >
          {alreadyHidden ? "Put it back" : "Keep on my post"}
        </button>
        <button disabled={pending} onClick={() => setConfirmDelete(!confirmDelete)} className="btn text-[var(--color-muted)]" aria-expanded={confirmDelete}>
          More options
        </button>
      </div>
      {confirmDelete ? <div className="rounded-xl border border-[var(--color-line)] p-4 text-[var(--color-ink)]" role="group" aria-labelledby={confirmationId}>
        <p id={confirmationId} className="text-sm font-semibold">Delete this comment permanently?</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">You can’t undo this. Hiding is reversible if you just want it off your post.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button autoFocus disabled={pending} className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>Cancel</button><button disabled={pending} className="btn btn-danger" onClick={() => act("delete")}>Delete permanently</button></div>
      </div> : null}
    </li>
  );
}
