import Anthropic from "@anthropic-ai/sdk";
import { VERDICT_JSON_SCHEMA } from "../schema";
import { parseVerdicts } from "./parse";
import type { Provider, ClassifyRequest, ProviderConfig } from "./types";

function client(cfg: ProviderConfig): Anthropic {
  // An explicit key from the UI wins; otherwise the bare constructor resolves
  // ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
  return cfg.apiKey ? new Anthropic({ apiKey: cfg.apiKey }) : new Anthropic();
}

export const anthropicProvider: Provider = {
  id: "anthropic",
  batchSize: 20,

  async classify(req: ClassifyRequest, cfg: ProviderConfig) {
    const response = await client(cfg).messages.create({
      model: cfg.model,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: req.system,
          // The rubric is identical on every request, so it should be paid for
          // once. Everything creator-specific lives in the user turn, after
          // this breakpoint, so one creator's settings cannot evict another's.
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        effort: cfg.effort,
        format: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: req.user }],
    });

    // A refusal or a truncated response is not a classification. Fail loudly so
    // the worker retries rather than silently marking abuse benign.
    if (response.stop_reason === "refusal") {
      throw new Error(
        `classifier refused (${response.stop_details?.category ?? "unknown"}): ${
          response.stop_details?.explanation ?? "no explanation"
        }`,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("classifier response hit max_tokens; reduce the batch size");
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("classifier returned no text block");

    return parseVerdicts(text.text, req.requestedIds);
  },

  async check(cfg: ProviderConfig) {
    if (!cfg.apiKey && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return { ok: false, error: "No Anthropic key saved yet." };
    }
    try {
      const res = await client(cfg).messages.create({
        model: cfg.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
      });
      const text = res.content.find((b) => b.type === "text");
      return {
        ok: true,
        detail: `${cfg.model} replied "${text?.type === "text" ? text.text.trim() : "(no text)"}"`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/401|authentication/i.test(msg)) return { ok: false, error: "That key was rejected." };
      if (/404|not_found/i.test(msg)) {
        return { ok: false, error: `Your account can't reach "${cfg.model}".` };
      }
      return { ok: false, error: msg };
    }
  },
};
