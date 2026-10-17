/**
 * The models you can point this at, what they cost, and how much to trust
 * their judgment on the hard calls.
 *
 * Prices verified 2026-10-15 against each vendor's own pricing page, in USD
 * per 1M tokens. They change — `priceCheckedOn` is shown in the UI so nobody
 * treats a stale number as a quote. To add a model, add a row; the setup
 * screen, cost table, and tier picker all read from here.
 *
 * `judgment` is the honest part and the reason this table isn't just a price
 * list. It rates one specific thing: can the model tell harsh criticism from
 * harassment, a hyperbolic joke from a threat, and a reclaimed word from a
 * slur? That is the whole job here, and it does not track price linearly.
 */

export type Tier = "free" | "budget" | "balanced" | "best";

export type CatalogEntry = {
  id: string;
  provider: "anthropic" | "openai" | "ollama";
  /** The exact string to put in CLASSIFIER_MODEL / OLLAMA_MODEL. */
  model: string;
  label: string;
  tier: Tier;
  inputPerMTok: number;
  outputPerMTok: number;
  /** 1-5. Judgment on borderline moderation calls, not general capability. */
  judgment: number;
  note: string;
  /** Produces the plain-language summary the review queue shows. */
  writesSummaries: boolean;
  /**
   * False for anything that can't be the only classifier — it either can't
   * produce the severity bands and summaries this app needs, or it isn't a
   * chat endpoint at all. Shown as a pre-filter, never as a selectable option,
   * because printing config for it would hand someone a broken setup.
   */
  standalone: boolean;
};

export const PRICE_CHECKED_ON = "2026-10-15";

export const CATALOG: CatalogEntry[] = [
  // Download sizes from Ollama library tags; runtime memory exceeds file size.
  {"id": "ollama-qwen3-small", "provider": "ollama", "model": "qwen3:4b", "label": "Qwen 3 \u00b7 smaller download", "tier": "free", "inputPerMTok": 0, "outputPerMTok": 0, "judgment": 0, "note": "About 2.5 GB to download. A lighter choice to try first on a laptop; speed depends on your computer. Moderation accuracy has not been benchmarked in this app. Test it before use.", "writesSummaries": true, "standalone": true},
  {"id": "ollama-qwen3-medium", "provider": "ollama", "model": "qwen3:8b", "label": "Qwen 3 \u00b7 medium size", "tier": "free", "inputPerMTok": 0, "outputPerMTok": 0, "judgment": 0, "note": "About 5.2 GB to download. Uses more memory than the small choice; allow extra room for other apps. Moderation accuracy has not been benchmarked in this app. Test it before use.", "writesSummaries": true, "standalone": true},
  {"id": "ollama-gemma3-small", "provider": "ollama", "model": "gemma3:4b", "label": "Gemma 3 \u00b7 smaller model", "tier": "free", "inputPerMTok": 0, "outputPerMTok": 0, "judgment": 0, "note": "A smaller alternative from Google. Download size varies with the model version; needs additional memory while running. Moderation accuracy has not been benchmarked in this app. Test it before use.", "writesSummaries": true, "standalone": true},
  {"id": "ollama-gemma3-large", "provider": "ollama", "model": "gemma3:12b", "label": "Gemma 3 \u00b7 larger model", "tier": "free", "inputPerMTok": 0, "outputPerMTok": 0, "judgment": 0, "note": "For computers with more available memory. Expect a larger download and slower checks than smaller models on the same hardware. Moderation accuracy has not been benchmarked in this app. Test it before use.", "writesSummaries": true, "standalone": true},
  // ---- free ----
  {
    id: "ollama-llama31",
    provider: "ollama",
    model: "llama3.1:8b",
    label: "Llama 3.1 8B, on your computer",
    tier: "free",
    inputPerMTok: 0,
    outputPerMTok: 0,
    judgment: 2,
    note: "Runs through Ollama without per-comment API fees. Local models can misread jokes and criticism. Test your chosen reader and review its decisions.",
    writesSummaries: true,
    standalone: true,
  },
  {
    id: "openai-moderation",
    provider: "openai",
    model: "omni-moderation-latest",
    label: "OpenAI moderation endpoint",
    tier: "free",
    inputPerMTok: 0,
    outputPerMTok: 0,
    judgment: 2,
    note: "Free from OpenAI and very fast, but it only scores fixed categories — it can't weigh context, read satire, or write the summaries your queue shows. It is a filter to put in front of something else, not a replacement for one.",
    writesSummaries: false,
    standalone: false,
  },

  // ---- budget ----
  {
    id: "openai-luna",
    provider: "openai",
    model: "gpt-6-luna",
    label: "GPT-6 Luna",
    tier: "budget",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    judgment: 3,
    note: "The cheapest option that still reads context and writes summaries. Good value for high volume.",
    writesSummaries: true,
    standalone: true,
  },
  {
    id: "anthropic-haiku",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    tier: "budget",
    inputPerMTok: 1,
    outputPerMTok: 5,
    judgment: 3,
    note: "Fast and cheap, noticeably steadier than free options on borderline calls.",
    writesSummaries: true,
    standalone: true,
  },

  // ---- balanced ----
  {
    id: "openai-sol",
    provider: "openai",
    model: "gpt-6.1-sol",
    label: "GPT-6.1 Sol",
    tier: "balanced",
    inputPerMTok: 2,
    outputPerMTok: 10,
    judgment: 4,
    note: "Strong general judgment at a middling price.",
    writesSummaries: true,
    standalone: true,
  },
  {
    id: "anthropic-sonnet",
    provider: "anthropic",
    model: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    tier: "balanced",
    inputPerMTok: 3,
    outputPerMTok: 15,
    judgment: 4,
    note: "Close to the top tier on these calls for a fraction of the cost. A sensible default if Opus feels steep.",
    writesSummaries: true,
    standalone: true,
  },

  // ---- best ----
  {
    id: "anthropic-opus",
    provider: "anthropic",
    model: "claude-opus-5",
    label: "Claude Opus 5",
    tier: "best",
    inputPerMTok: 5,
    outputPerMTok: 25,
    judgment: 5,
    note: "Best at the calls this tool exists for: protecting real criticism while catching what's actually meant to wound.",
    writesSummaries: true,
    standalone: true,
  },
  {
    id: "openai-astra",
    provider: "openai",
    model: "gpt-6-astra",
    label: "GPT-6 Astra",
    tier: "best",
    inputPerMTok: 10,
    outputPerMTok: 50,
    judgment: 5,
    note: "OpenAI's most capable. Priced accordingly.",
    writesSummaries: true,
    standalone: true,
  },
];

export const TIER_UI: Record<Tier, { name: string; blurb: string }> = {
  free: {
    name: "Free",
    blurb: "Costs nothing. Expect to review more yourself.",
  },
  budget: {
    name: "Cheap",
    blurb: "Pennies per viral post. Solid on obvious abuse.",
  },
  balanced: {
    name: "Balanced",
    blurb: "Where most people should land.",
  },
  best: {
    name: "Best judgment",
    blurb: "Most likely to get the borderline calls right.",
  },
};

/** Cost of classifying `comments` with a given entry, in USD. */
export function costFor(entry: CatalogEntry, comments: number): number {
  // Measured averages per comment, amortized over a batch with the shared
  // rubric cached.
  const INPUT_TOKENS_PER_COMMENT = 75;
  const OUTPUT_TOKENS_PER_COMMENT = 60;
  return (
    (comments * INPUT_TOKENS_PER_COMMENT * entry.inputPerMTok) / 1_000_000 +
    (comments * OUTPUT_TOKENS_PER_COMMENT * entry.outputPerMTok) / 1_000_000
  );
}

export function entriesByTier(): [Tier, CatalogEntry[]][] {
  const order: Tier[] = ["free", "budget", "balanced", "best"];
  return order.map((t) => [t, CATALOG.filter((e) => e.tier === t)]);
}

export function findEntry(provider: string, model: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.provider === provider && e.model === model);
}
