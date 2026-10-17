import { VERDICT_JSON_SCHEMA } from "../schema";
import { parseVerdicts } from "./parse";
import type { Provider, ClassifyRequest, ProviderConfig } from "./types";

/**
 * OpenAI, via plain fetch rather than the SDK — this is one endpoint with a
 * JSON-schema response format, and an open-source tool is easier to audit and
 * cheaper to install with one less dependency.
 */

function base(cfg: ProviderConfig): string {
  return cfg.baseUrl ?? "https://api.openai.com/v1";
}

export const openaiProvider: Provider = {
  id: "openai",
  batchSize: 20,

  async classify(req: ClassifyRequest, cfg: ProviderConfig) {
    if (!cfg.apiKey) throw new Error("No OpenAI key saved");
    const res = await fetch(`${base(cfg)}/chat/completions`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "verdicts", strict: true, schema: VERDICT_JSON_SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = json.choices?.[0];

    // A truncated or filtered response is not a classification. Fail loudly so
    // the worker retries rather than silently marking abuse benign.
    if (choice?.finish_reason === "length") {
      throw new Error("OpenAI response was truncated; reduce the batch size");
    }
    if (choice?.finish_reason === "content_filter") {
      throw new Error("OpenAI content filter blocked the response");
    }

    const content = choice?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");

    return parseVerdicts(content, req.requestedIds);
  },

  async check(cfg: ProviderConfig) {
    if (!cfg.apiKey) return { ok: false, error: "No OpenAI key saved yet." };
    try {
      const res = await fetch(`${base(cfg)}/models/${cfg.model}`, {
        redirect: "error",
        headers: { authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401) return { ok: false, error: "That key was rejected." };
      if (res.status === 404) {
        return { ok: false, error: `Your account can't reach "${cfg.model}".` };
      }
      if (!res.ok) return { ok: false, error: `OpenAI replied ${res.status}` };
      return { ok: true, detail: `${cfg.model} is reachable` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
