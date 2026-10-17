import type { Verdict } from "../schema";

export type ProviderId = "anthropic" | "openai" | "ollama";

/** Everything a provider needs for one call, resolved from UI settings or env. */
export type ProviderConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
};

export type ClassifyRequest = {
  system: string;
  user: string;
  /** Ids we asked about, so a provider can validate what came back. */
  requestedIds: string[];
};

export type CheckResult = { ok: true; detail: string } | { ok: false; error: string };

export type Provider = {
  id: ProviderId;
  /** How many comments to send at once. Smaller models cope badly with big batches. */
  batchSize: number;
  classify(req: ClassifyRequest, cfg: ProviderConfig): Promise<Map<string, Verdict>>;
  /** Cheap liveness check for the setup screen. */
  check(cfg: ProviderConfig): Promise<CheckResult>;
};
