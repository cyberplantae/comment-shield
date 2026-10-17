import { VERDICT_JSON_SCHEMA } from "../schema";
import { parseVerdicts } from "./parse";
import type { Provider, ClassifyRequest, ProviderConfig } from "./types";

/**
 * Local inference via Ollama. Free, unlimited, and nothing leaves the machine —
 * which for a tool holding a creator's abuse archive is a real feature, not
 * just a cost saving.
 *
 * The tradeoff is judgment, not throughput. Small models handle obvious abuse
 * fine and misread exactly the cases this product exists for: hyperbole that
 * isn't a threat ("I'll kill you, that pun was awful"), reclaimed in-group
 * language, and harsh criticism that isn't harassment. Expect more
 * false positives on criticism and more low-confidence verdicts, both of which
 * route to the review queue rather than auto-hiding — the rules engine's
 * confidence floor is what makes a weaker model safe to run here.
 */

function host(cfg: ProviderConfig): string {
  return cfg.baseUrl ?? "http://127.0.0.1:11434";
}

export const ollamaProvider: Provider = {
  id: "ollama",
  // Deliberately small. A 7-8B model's accuracy degrades noticeably when asked
  // to hold twenty independent judgments in one response.
  batchSize: 5,

  async classify(req: ClassifyRequest, cfg: ProviderConfig) {
    const res = await fetch(`${host(cfg)}/api/chat`, {
      method: "POST",
      signal: AbortSignal.timeout(180000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        ...(cfg.model.startsWith("qwen3:") ? { think: false } : {}),
        // Ollama constrains output to a JSON schema the same way, so we can
        // reuse the exact schema the hosted provider uses.
        format: VERDICT_JSON_SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    if (!content) throw new Error("Ollama returned an empty response");

    return parseVerdicts(content, req.requestedIds);
  },

  async check(cfg: ProviderConfig) {
    try {
      const res = await fetch(`${host(cfg)}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { ok: false, error: `Ollama replied ${res.status} at ${host(cfg)}` };

      const json = (await res.json()) as { models?: { name: string }[] };
      const names = (json.models ?? []).map((m) => m.name);
      if (names.length === 0) {
        return {
          ok: false,
          error: `Ollama is open. Use “Download comment reader” to install ${cfg.model}.`,
        };
      }
      // Ollama reports "llama3.1:8b"; tolerate a bare "llama3.1" in config.
      const has = names.some((n) => n === cfg.model || n === `${cfg.model}:latest`);
      if (!has) {
        return {
          ok: false,
          error: `Ollama is open, but ${cfg.model} is not installed. Use “Download comment reader” below.`,
        };
      }
      return { ok: true, detail: `${cfg.model} is installed and reachable` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Couldn't reach Ollama at ${host(cfg)} (${msg}). Is it running?` };
    }
  },
};
