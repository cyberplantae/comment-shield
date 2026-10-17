import { validateEndpoint } from "./endpoint";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encryptToken, decryptToken } from "@/lib/crypto";
import type { ProviderId } from "@/lib/classify/providers/types";

const SINGLETON = "singleton";

export type ResolvedSettings = {
  provider: ProviderId;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  apiKey?: string;
  baseUrl?: string;
  /** Where each value came from, so the UI can say so honestly. */
  source: { provider: "ui" | "env" | "default"; key: "ui" | "env" | "none" };
};

const DEFAULT_MODEL: Record<ProviderId, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-6.1-sol",
  ollama: "llama3.1:8b",
};

function envProvider(): ProviderId | null {
  const raw = process.env.CLASSIFIER_PROVIDER;
  return raw === "anthropic" || raw === "openai" || raw === "ollama" ? raw : null;
}

/**
 * Settings the classifier should actually run with. UI beats env beats default,
 * per field — so someone can set a key in .env and still pick the model in the
 * browser without one clobbering the other.
 */
export async function getSettings(): Promise<ResolvedSettings> {
  let row: typeof schema.appSettings.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, SINGLETON))
      .limit(1);
    row = rows[0];
  } catch {
    // Table missing (migrations not run yet) — fall back to env entirely so
    // /setup can still load and tell the user to migrate.
    row = undefined;
  }

  const provider: ProviderId = row?.provider ?? envProvider() ?? "anthropic";
  const providerSource: ResolvedSettings["source"]["provider"] = row?.provider
    ? "ui"
    : envProvider()
      ? "env"
      : "default";

  const model =
    (row?.provider === provider ? row?.model : null) ??
    (provider === "anthropic"
      ? process.env.CLASSIFIER_MODEL
      : provider === "openai"
        ? process.env.OPENAI_MODEL
        : process.env.OLLAMA_MODEL) ??
    DEFAULT_MODEL[provider];

  let apiKey: string | undefined;
  let keySource: ResolvedSettings["source"]["key"] = "none";

  if (provider === "anthropic") {
    if (row?.anthropicKeyEnc) {
      apiKey = decryptToken(row.anthropicKeyEnc);
      keySource = "ui";
    } else if (process.env.ANTHROPIC_API_KEY) {
      apiKey = process.env.ANTHROPIC_API_KEY;
      keySource = "env";
    }
  } else if (provider === "openai") {
    if (row?.openaiKeyEnc) {
      apiKey = decryptToken(row.openaiKeyEnc);
      keySource = "ui";
    } else if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
      keySource = "env";
    }
  }

  const baseUrl =
    provider === "openai"
      ? (row?.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1")
      : provider === "ollama"
        ? (row?.ollamaHost ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434")
        : undefined;

  const rawEffort = row?.effort ?? process.env.CLASSIFIER_EFFORT ?? "medium";
  const allowed = ["low", "medium", "high", "xhigh", "max"] as const;
  const effort = (allowed as readonly string[]).includes(rawEffort)
    ? (rawEffort as ResolvedSettings["effort"])
    : "medium";

  return { provider, model, effort, apiKey, baseUrl, source: { provider: providerSource, key: keySource } };
}

export type MetaSettings = {
  appId: string | null;
  appSecret: string | null;
  verifyToken: string | null;
  publicBaseUrl: string;
  /** Exact strings the user must paste into Meta's console. */
  redirectUri: string;
  webhookUrl: string;
};

/** Meta app config, UI first then env. */
export async function getMetaSettings(): Promise<MetaSettings> {
  let row: typeof schema.appSettings.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, SINGLETON))
      .limit(1);
    row = rows[0];
  } catch {
    row = undefined;
  }

  const publicBaseUrl =
    row?.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "http://localhost:3188";

  return {
    appId: row?.metaAppId ?? process.env.META_APP_ID ?? null,
    appSecret: row?.metaAppSecretEnc
      ? decryptToken(row.metaAppSecretEnc)
      : (process.env.META_APP_SECRET ?? null),
    verifyToken: row?.metaVerifyToken ?? process.env.META_WEBHOOK_VERIFY_TOKEN ?? null,
    publicBaseUrl,
    redirectUri: `${publicBaseUrl}/api/auth/instagram/callback`,
    webhookUrl: `${publicBaseUrl}/api/webhooks/meta`,
  };
}

export type SettingsPatch = {
  provider?: ProviderId;
  model?: string;
  effort?: string;
  anthropicKey?: string;
  openaiKey?: string;
  openaiBaseUrl?: string;
  ollamaHost?: string;
  metaAppId?: string;
  metaAppSecret?: string;
  metaVerifyToken?: string;
  publicBaseUrl?: string;
};

/** Upsert the singleton. Blank key fields are ignored, never used to wipe. */
export async function saveSettings(patch: SettingsPatch): Promise<void> {
  const set: Partial<typeof schema.appSettings.$inferInsert> = { updatedAt: new Date() };
  if (patch.publicBaseUrl) patch.publicBaseUrl = validateEndpoint(patch.publicBaseUrl, true);
  if (patch.ollamaHost) patch.ollamaHost = validateEndpoint(patch.ollamaHost, true);
  if (patch.openaiBaseUrl) {
    patch.openaiBaseUrl = validateEndpoint(patch.openaiBaseUrl, true);
    const previous = await db.select({ url: schema.appSettings.openaiBaseUrl }).from(schema.appSettings).where(eq(schema.appSettings.id, SINGLETON)).limit(1);
    const current = previous[0]?.url ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    if (patch.openaiBaseUrl !== current.replace(/\/$/, "") && !patch.openaiKey?.trim()) throw new Error("Changing the server requires a new key for that server. Existing keys will not be forwarded.");
  }


  if (patch.provider) set.provider = patch.provider;
  if (patch.model) set.model = patch.model;
  if (patch.effort) set.effort = patch.effort;
  if (patch.openaiBaseUrl !== undefined) set.openaiBaseUrl = patch.openaiBaseUrl || null;
  if (patch.ollamaHost !== undefined) set.ollamaHost = patch.ollamaHost || null;

  // An empty box means "leave it alone", so a user editing the model doesn't
  // silently delete the key they pasted last week.
  if (patch.anthropicKey) set.anthropicKeyEnc = encryptToken(patch.anthropicKey.trim());
  if (patch.openaiKey) set.openaiKeyEnc = encryptToken(patch.openaiKey.trim());

  if (patch.metaAppId !== undefined) set.metaAppId = patch.metaAppId || null;
  if (patch.metaVerifyToken !== undefined) set.metaVerifyToken = patch.metaVerifyToken || null;
  if (patch.publicBaseUrl !== undefined) set.publicBaseUrl = patch.publicBaseUrl || null;
  // Same rule as the API keys: blank means keep, never wipe.
  if (patch.metaAppSecret) set.metaAppSecretEnc = encryptToken(patch.metaAppSecret.trim());

  await db
    .insert(schema.appSettings)
    .values({ id: SINGLETON, ...set })
    .onConflictDoUpdate({ target: schema.appSettings.id, set });
}

/** Explicitly forget a stored key. */
export async function clearKey(which: "anthropic" | "openai"): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({
      id: SINGLETON,
      ...(which === "anthropic" ? { anthropicKeyEnc: null } : { openaiKeyEnc: null }),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: {
        ...(which === "anthropic" ? { anthropicKeyEnc: null } : { openaiKeyEnc: null }),
        updatedAt: new Date(),
      },
    });
}

/** Never return the key itself to a page — only whether one exists. */
export async function keyPresence(): Promise<{ anthropic: boolean; openai: boolean }> {
  try {
    const rows = await db
      .select({
        a: schema.appSettings.anthropicKeyEnc,
        o: schema.appSettings.openaiKeyEnc,
      })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, SINGLETON))
      .limit(1);
    const row = rows[0];
    return {
      anthropic: Boolean(row?.a) || Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(row?.o) || Boolean(process.env.OPENAI_API_KEY),
    };
  } catch {
    return {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    };
  }
}
