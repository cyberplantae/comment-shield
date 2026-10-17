"use client";

import { useState } from "react";

type Row = {
  id: string;
  provider: string;
  model: string;
  label: string;
  tier: string;
  judgment: number;
  cost: number;
  standalone: boolean;
  note: string;
};

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "On your machine",
};

function Pips({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`pip ${n <= score ? "pip-on" : ""}`} />
      ))}
    </span>
  );
}

/**
 * Picking a model and pasting a key, entirely in the browser. Nothing here
 * requires opening a text editor — that was the point.
 *
 * Rows are sorted cheapest-first, which is the argument: judgment plainly
 * doesn't climb with price. Cost gets bar length in one hue; judgment gets
 * discrete pips; provider is carried in text, never colour alone.
 */
export function ClassifierForm({
  rows,
  activeProvider,
  activeModel,
  hasKey,
  effort,
  ollamaHost,
  openaiBaseUrl,
}: {
  rows: Row[];
  activeProvider: string;
  activeModel: string;
  hasKey: { anthropic: boolean; openai: boolean };
  effort: string;
  ollamaHost: string;
  openaiBaseUrl: string;
}) {
  const [chosen, setChosen] = useState(`${activeProvider}:${activeModel}`);
  const [installed, setInstalled] = useState<string[]>([]);
  const [installedMessage, setInstalledMessage] = useState("");
  async function loadInstalled() {
    try { const res = await fetch("/api/ollama/status"); const data = await res.json(); setInstalled(data.models ?? []); setInstalledMessage(data.running ? "Choose a downloaded reader below. It must support chat and structured replies." : "Save a local reader first, then open Ollama and try again."); } catch { setInstalledMessage("Could not reach Ollama. Open it and try again."); }
  }
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const sorted = [...rows].sort((a, b) => a.cost - b.cost);
  const max = Math.max(...sorted.map((r) => r.cost), 1);
  const [chosenProvider] = chosen.split(":");
  const selected = sorted.find((r) => `${r.provider}:${r.model}` === chosen);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/classifier/test", { method: "POST" });
      const body = (await res.json()) as { ok: boolean; message: string };
      setResult(body);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="soft-panel p-4"><p className="text-sm font-semibold">{selected?.label ?? activeModel}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{chosenProvider === "ollama" ? "Reads comments on your computer. Keep this computer and Ollama running." : "Sends comments to your chosen AI service. Usage is billed by that service."}</p></div>
      <details className="card p-4"><summary className="cursor-pointer text-sm font-medium">Change reader or compare options</summary>
      <fieldset className="card overflow-hidden">
        <legend className="sr-only">Choose a model</legend>

        <div className="hidden gap-4 border-b border-[var(--color-line)] px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)] sm:grid sm:grid-cols-[1.6rem_1fr_auto_11rem]">
          <span />
          <span>Model</span>
          <span className="text-right">Judgment</span>
          <span className="text-right">Cost per 10,000 comments</span>
        </div>

        <div className="divide-y divide-[var(--color-line)]">
          {sorted.map((r) => {
            const value = `${r.provider}:${r.model}`;
            const pct = r.cost === 0 ? 0 : Math.max(2, (r.cost / max) * 100);
            const isChosen = chosen === value;

            return (
              <label
                key={r.id}
                className={`grid cursor-pointer gap-2 px-4 py-3.5 sm:grid-cols-[1.6rem_1fr_auto_11rem] sm:items-center sm:gap-4 ${
                  isChosen ? "bg-[var(--color-accent-soft)]" : ""
                } ${r.standalone ? "" : "opacity-60"}`}
              >
                <input
                  type="radio"
                  name="choice"
                  value={value}
                  checked={isChosen}
                  disabled={!r.standalone}
                  onChange={() => setChosen(value)}
                  className="justify-self-start"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{r.label}</span>
                    {r.provider === activeProvider && r.model === activeModel ? (
                      <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-bg)]">
                        in use
                      </span>
                    ) : null}
                    {!r.standalone ? (
                      <span className="rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                        can&rsquo;t run alone
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-faint)]">
                    {PROVIDER_LABEL[r.provider]} · {r.tier}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {r.provider === "ollama" ? <span className="text-xs text-[var(--color-muted)]">Local reader</span> : <Pips score={r.judgment} />}
                  <span className="text-xs text-[var(--color-muted)] sm:hidden">
                    {r.provider === "ollama" ? "" : `judgment ${r.judgment}/5`}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="bar-track flex-1">
                    <span className="bar-fill block" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                    {r.cost === 0 ? "free" : `$${r.cost.toFixed(2)}`}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>
      </details>

      {selected ? (
        <p className="max-w-prose text-sm text-[var(--color-muted)]">{selected.note}</p>
      ) : null}

      {/* Only the field the chosen provider actually needs. */}
      {chosenProvider === "anthropic" ? (
        <div className="card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Anthropic API key</span>
            <span className="block text-xs text-[var(--color-muted)]">
              {hasKey.anthropic
                ? "A key is already saved. Leave this blank to keep it, or paste a new one to replace it."
                : "Get one at console.anthropic.com → API keys. It's stored encrypted and never shown again."}
            </span>
            <input
              type="password"
              name="anthropicKey"
              form="classifier-form"
              autoComplete="off"
              placeholder={hasKey.anthropic ? "•••••••• saved" : "sk-ant-..."}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">How hard it thinks</span>
            <span className="block text-xs text-[var(--color-muted)]">
              Lower is cheaper and faster. Medium suits most people.
            </span>
            <select
              name="effort"
              form="classifier-form"
              defaultValue={effort}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2 text-sm"
            >
              {["low", "medium", "high", "xhigh", "max"].map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {chosenProvider === "openai" ? (
        <div className="card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">OpenAI API key</span>
            <span className="block text-xs text-[var(--color-muted)]">
              {hasKey.openai
                ? "A key is already saved. Leave this blank to keep it, or paste a new one to replace it."
                : "Get one at platform.openai.com → API keys. It's stored encrypted and never shown again."}
            </span>
            <input
              type="password"
              name="openaiKey"
              form="classifier-form"
              autoComplete="off"
              placeholder={hasKey.openai ? "•••••••• saved" : "sk-..."}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
            />
          </label>
          <details><summary className="cursor-pointer text-sm">Advanced: use a different server</summary>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Server address</span>
            <span className="block text-xs text-[var(--color-muted)]">
              Change this only to use a compatible service like Groq or Together.
            </span>
            <input
              name="openaiBaseUrl"
              form="classifier-form"
              defaultValue={openaiBaseUrl}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
            />
          </label>
          </details>
        </div>
      ) : null}

      {chosenProvider === "ollama" ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm">
            No key needed. Choose a reader, click “Save and use this,” then use “Download comment reader” below. Keep Ollama open while your ward runs.
          </p>
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="btn btn-quiet">Get Ollama ↗</a>
          <details><summary>Use a reader I already downloaded</summary><div className="mt-3 space-y-3"><button type="button" onClick={loadInstalled} className="btn btn-quiet">Find my installed readers</button><p role="status" className="text-sm">{installedMessage}</p>{installed.length > 0 && <select aria-label="Installed Ollama reader" value={installed.includes(chosen.slice(7)) ? chosen.slice(7) : ""} onChange={e => e.target.value && setChosen(`ollama:${e.target.value}`)} className="w-full rounded-lg bg-[var(--color-surface)] p-3"><option value="">Choose a downloaded reader</option>{installed.map(name => <option key={name} value={name}>{name}</option>)}</select>}</div></details>
          <details><summary>Advanced connection settings</summary><label className="block space-y-1">
            <span className="text-sm font-medium">Where Ollama is running</span>
            <input
              name="ollamaHost"
              form="classifier-form"
              defaultValue={ollamaHost}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
            />
          </label></details>
        </div>
      ) : null}

      <input type="hidden" name="choice" form="classifier-form" value={chosen} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" form="classifier-form" className="btn btn-primary">
          Save and use this
        </button>
        <button type="button" onClick={test} disabled={testing} className="btn btn-quiet">
          {testing ? "Testing…" : "Test what's saved"}
        </button>
      </div>

      {result ? (
        <div
          className={`card p-4 ${
            result.ok ? "border-[var(--color-accent)]" : "border-[var(--color-sev-hate)]"
          }`}
        >
          <p role="status"
            className={`text-sm font-medium ${
              result.ok ? "text-[var(--color-accent)]" : "text-[var(--color-sev-hate)]"
            }`}
          >
            {result.ok ? "Working" : "Not working yet"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{result.message}</p>
        </div>
      ) : null}
    </div>
  );
}
