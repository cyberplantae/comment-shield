import { SYSTEM_PROMPT, buildUserTurn } from "./prompt";
import type { Verdict } from "./schema";
import { anthropicProvider } from "./providers/anthropic";
import { ollamaProvider } from "./providers/ollama";
import { openaiProvider } from "./providers/openai";
import type { Provider, ProviderId, ProviderConfig, CheckResult } from "./providers/types";
import { getSettings } from "@/lib/settings";

export type { Provider, ProviderId, ProviderConfig } from "./providers/types";

const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  ollama: ollamaProvider,
};

export function providerById(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export type ClassifyInput = { id: string; text: string; author?: string | null };

/**
 * Resolve the configured provider from the database (falling back to env) and
 * return it alongside the config it should run with. Read per call rather than
 * cached at module scope, so changing the model in the UI takes effect on the
 * next batch without restarting the worker.
 */
export async function resolveClassifier(): Promise<{
  provider: Provider;
  config: ProviderConfig;
  model: string;
  providerId: ProviderId;
}> {
  const s = await getSettings();
  return {
    provider: PROVIDERS[s.provider],
    providerId: s.provider,
    model: s.model,
    config: { model: s.model, apiKey: s.apiKey, baseUrl: s.baseUrl, effort: s.effort },
  };
}

/** Batch size for the configured provider. */
export async function batchSize(): Promise<number> {
  const { provider } = await resolveClassifier();
  return provider.batchSize;
}

/** Liveness check for whatever is currently configured. */
export async function checkClassifier(): Promise<CheckResult> {
  const { provider, config } = await resolveClassifier();
  return provider.check(config);
}

/**
 * Classify one batch. Returns a map keyed by the id you passed in; an id
 * missing from the map means the model did not return a verdict for it and
 * the caller should leave that comment unclassified rather than guess.
 */
export async function classifyBatch(
  comments: ClassifyInput[],
  customSensitivities: string[] = [],
  protectedIdentities: string[] = [],
): Promise<Map<string, Verdict>> {
  if (comments.length === 0) return new Map();

  const { provider, config } = await resolveClassifier();
  return provider.classify(
    {
      system: SYSTEM_PROMPT,
      user: buildUserTurn(comments, customSensitivities, protectedIdentities),
      requestedIds: comments.map((c) => c.id),
    },
    config,
  );
}
