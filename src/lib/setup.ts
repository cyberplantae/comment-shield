import { sql } from "drizzle-orm";
import { db } from "@/db";
import { checkClassifier, resolveClassifier } from "@/lib/classify";
import { metaReadiness } from "@/lib/meta/config";
import { CATALOG, costFor, type CatalogEntry } from "@/lib/classify/catalog";

export type CheckStatus = "ok" | "warn" | "fail";

export type Check = {
  name: string;
  status: CheckStatus;
  detail: string;
  /** What to actually do about it, in plain language. */
  fix?: string;
};

async function checkDatabase(): Promise<Check> {
  if (!process.env.DATABASE_URL && process.env.SHIELD_DESKTOP !== "1") {
    return {
      name: "Database",
      status: "fail",
      detail: "DATABASE_URL isn't set.",
      fix: "Copy .env.example to .env and point DATABASE_URL at a Postgres database.",
    };
  }
  try {
    await db.execute(sql`select 1`);
    // If migrations haven't run, the tables won't exist.
    await db.execute(sql`select 1 from policies limit 1`);
    return { name: "Database", status: "ok", detail: "Connected, and the tables exist." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: "Database",
      status: "fail",
      detail: msg,
      fix: /relation .* does not exist/i.test(msg)
        ? "The database is reachable but empty. Run: pnpm db:migrate"
        : "Check that Postgres is running and DATABASE_URL is correct.",
    };
  }
}

function checkEncryption(): Check {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    return {
      name: "Token encryption",
      status: "fail",
      detail: "TOKEN_ENCRYPTION_KEY isn't set, so Instagram tokens can't be stored safely.",
      fix: "Generate one with: openssl rand -base64 32",
    };
  }
  if (Buffer.from(raw, "base64").length !== 32) {
    return {
      name: "Token encryption",
      status: "fail",
      detail: "TOKEN_ENCRYPTION_KEY is the wrong length.",
      fix: "It must be exactly 32 bytes, base64-encoded: openssl rand -base64 32",
    };
  }
  return { name: "Token encryption", status: "ok", detail: "A valid 32-byte key is configured." };
}

async function checkMeta(): Promise<Check> {
  const readiness = await metaReadiness();
  if (!readiness.ready) {
    return {
      name: "Instagram connection",
      // Hard fail, not a warning: the Connect button does not work in this
      // state, and calling that a warning is how someone ends up staring at
      // Instagram's 404 wondering what they did wrong.
      status: "fail",
      detail: readiness.reason,
      fix: readiness.detail,
    };
  }

  if (!process.env.PUBLIC_BASE_URL?.startsWith("https://")) {
    return {
      name: "Instagram connection",
      status: "warn",
      detail: "PUBLIC_BASE_URL isn't an https address.",
      fix: "Fine for local work, but Meta won't deliver webhooks to it. Use a tunnel (cloudflared, ngrok) when you're ready to receive comments.",
    };
  }
  return { name: "Instagram connection", status: "ok", detail: "Meta app credentials are set." };
}

async function classifierCheck(): Promise<Check> {
  const { providerId, model } = await resolveClassifier();
  const label = `${providerId} / ${model}`;
  const result = await checkClassifier();
  if (result.ok) {
    return { name: "Classifier", status: "ok", detail: `${label} — ${result.detail}` };
  }
  const provider = { id: providerId };
  return {
    name: "Classifier",
    status: "fail",
    detail: `${label} — ${result.error}`,
    fix:
      provider.id === "anthropic" || provider.id === "openai"
        ? "Paste a key below, or switch to a free option — both are right here on this page."
        : "Open the Ollama download button below, install it, then use the reader download button on this page.",
  };
}

export async function runChecks(): Promise<Check[]> {
  // Independent checks; one slow network call shouldn't serialize the rest.
  if (process.env.SHIELD_DESKTOP === "1") return Promise.all([checkDatabase(), classifierCheck()]);
  const [database, classifier, meta] = await Promise.all([
    checkDatabase(),
    classifierCheck(),
    checkMeta(),
  ]);
  return [database, checkEncryption(), meta, classifier];
}

/** Every catalogued model priced for a given comment volume. */
export function estimateCatalog(comments: number): (CatalogEntry & { cost: number })[] {
  return CATALOG.map((e) => ({ ...e, cost: costFor(e, comments) }));
}

/** What's configured right now, for highlighting the chosen row. */
export async function activeChoice(): Promise<{ provider: string; model: string }> {
  const { providerId, model } = await resolveClassifier();
  return { provider: providerId, model };
}
