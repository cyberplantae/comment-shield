"use client";

import { useCallback, useEffect, useState } from "react";

type Status = { running: boolean; models: string[]; hasModel?: boolean };

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked; the text is visible to select by hand */
        }
      }}
      className="btn btn-quiet shrink-0 px-2.5 py-1 text-xs"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** macOS, Windows and Linux each want a different line. */
function installCommand(): { label: string; command: string; note?: string } {
  if (typeof navigator === "undefined") return { label: "Install Ollama", command: "" };
  const p = navigator.platform + " " + navigator.userAgent;
  if (/Mac/i.test(p)) {
    return {
      label: "On a Mac, paste this into Terminal",
      command: "brew install ollama && ollama serve",
      note: "No Homebrew? Download the app from ollama.com instead — it starts itself.",
    };
  }
  if (/Win/i.test(p)) {
    return {
      label: "On Windows",
      command: "winget install Ollama.Ollama",
      note: "Or download the installer from ollama.com. It runs in the background once installed.",
    };
  }
  return {
    label: "On Linux, paste this into a terminal",
    command: "curl -fsSL https://ollama.com/install.sh | sh",
  };
}

/**
 * Getting someone from nothing to a working local model.
 *
 * Installing Ollama genuinely needs a terminal once — a web page cannot
 * install software. Everything after that we can do for them: this polls
 * until Ollama appears, then downloads the model over Ollama's own API with
 * a progress bar, so the only thing they ever type is one command.
 */
export function OllamaSetup({ model }: { model: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<{ text: string; pct: number | null }>({
    text: "",
    pct: null,
  });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ollama/status");
      setStatus((await res.json()) as Status);
    } catch {
      setStatus({ running: false, models: [] });
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Poll while it's missing so the page notices the moment they install it,
    // rather than making them guess when to reload.
    const t = setInterval(() => {
      setStatus((s) => {
        if (!s || !s.running || !s.hasModel) void refresh();
        return s;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function pull() {
    setPulling(true);
    setError(null);
    setProgress({ text: "Starting…", pct: null });

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Download failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Newline-delimited JSON; the last line may be a partial.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as {
              status?: string;
              completed?: number;
              total?: number;
              error?: string;
            };
            if (ev.error) throw new Error(ev.error);
            const pct =
              ev.total && ev.completed ? Math.round((ev.completed / ev.total) * 100) : null;
            setProgress({ text: ev.status ?? "Working…", pct });
          } catch (err) {
            if (err instanceof Error && err.message && !/JSON/i.test(err.message)) throw err;
          }
        }
      }

      setProgress({ text: "Done", pct: 100 });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPulling(false);
    }
  }

  const install = installCommand();
  const ready = status?.running && status.hasModel;

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            ready
              ? "bg-[var(--color-accent)]"
              : status?.running
                ? "bg-[var(--color-sev-mean)]"
                : "bg-[var(--color-line-strong)]"
          }`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {ready
              ? "Ready to go"
              : status?.running
                ? "Ollama is running — just needs the model"
                : status === null
                  ? "Checking…"
                  : "Ollama isn't running yet"}
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            {ready
              ? `${model} is installed. Nothing leaves your computer and nothing costs anything.`
              : status?.running
                ? `Download your chosen reader next. The size depends on the reader and may be several gigabytes.`
                : "It's a free app that runs quietly in the background. Download it, install it, then open the app."}
          </p>
        </div>
      </div>

      {/* Step 1 — the only thing they have to type. */}
      {status && !status.running ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3"><a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="btn btn-primary">Download Ollama ↗</a><button type="button" onClick={refresh} className="btn btn-quiet">I’ve installed it — check again</button></div>
          <details><summary className="cursor-pointer text-sm">Advanced: install with a terminal</summary>
          <p className="mt-3 text-xs font-medium text-[var(--color-faint)]">
            {install.label}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--color-raised)] p-2.5 text-xs">
              {install.command}
            </code>
            <Copy text={install.command} />
          </div>
          {install.note ? (
            <p className="text-xs text-[var(--color-muted)]">{install.note}</p>
          ) : null}
          </details>
          <p className="text-xs text-[var(--color-faint)]">
            This page is watching — it&rsquo;ll notice on its own once Ollama starts.
          </p>
        </div>
      ) : null}

      {/* Step 2 — we do this part. */}
      {status?.running && !status.hasModel ? (
        <div className="space-y-2">
          <button type="button" onClick={pull} disabled={pulling} className="btn btn-primary">
            {pulling ? "Downloading…" : "Download comment reader"}
          </button>

          {pulling || progress.pct !== null ? (
            <div className="space-y-1.5">
              <span className="bar-track block">
                <span
                  className="bar-fill block"
                  style={{ width: `${progress.pct ?? 5}%` }}
                />
              </span>
              <p className="text-xs text-[var(--color-muted)]">
                {progress.text}
                {progress.pct !== null ? ` — ${progress.pct}%` : ""}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-sev-hate)]">{error}</p> : null}
    </div>
  );
}
