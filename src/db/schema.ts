import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["instagram", "threads"]);

/** What we decided to do about a comment, and whether it stuck. */
export const dispositionEnum = pgEnum("disposition", [
  "pending", // classified, waiting on the creator
  "auto_hidden", // a rule hid it without asking
  "hidden", // creator hid it
  "deleted", // creator deleted it (irreversible on Meta's side)
  "kept", // creator explicitly cleared it
  "ignored", // below the surfacing threshold; never shown
]);

/**
 * Severity is deliberately coarse. Creators set rules against these five words,
 * not against a 0-100 score they'd have to calibrate themselves.
 */
export const severityEnum = pgEnum("severity", [
  "benign",
  "rude",
  "harassment",
  "hateful",
  "threatening",
]);

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per connected Instagram or Threads account.
 * Access tokens are encrypted at rest (see lib/crypto.ts) — they are
 * bearer credentials for someone's entire comment surface.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    /** Instagram/Threads user id as Meta reports it. */
    platformUserId: text("platform_user_id").notNull(),
    username: text("username"),
    accessTokenEnc: text("access_token_enc").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /** Long-lived tokens must be refreshed before this passes. */
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_platform_user_idx").on(t.platform, t.platformUserId),
    index("accounts_creator_idx").on(t.creatorId),
  ],
);

/**
 * Per-creator policy. Every field here is surfaced in the settings UI —
 * this table *is* the customization surface.
 */
export const policies = pgTable("policies", {
  creatorId: uuid("creator_id")
    .primaryKey()
    .references(() => creators.id, { onDelete: "cascade" }),

  /** At or above this severity, hide immediately without asking. */
  autoHideAtOrAbove: severityEnum("auto_hide_at_or_above").notNull().default("hateful"),
  /** At or above this severity, surface in the review queue. Below it, ignore. */
  surfaceAtOrAbove: severityEnum("surface_at_or_above").notNull().default("rude"),

  /**
   * Off by default and deliberately so: deletion is irreversible and tells the
   * commenter they got to you. Hiding is silent and undoable.
   */
  allowAutoDelete: boolean("allow_auto_delete").notNull().default(false),

  /** Never act on these handles (friends, your own alt, your manager). */
  allowlistHandles: jsonb("allowlist_handles").$type<string[]>().notNull().default([]),
  /** Always hide these handles regardless of what the classifier thinks. */
  blocklistHandles: jsonb("blocklist_handles").$type<string[]>().notNull().default([]),

  /**
   * Extra things this particular creator does not want to read. Free text,
   * passed to the classifier as additional context (e.g. "comments about my
   * weight", "anything mentioning my kid's school").
   */
  customSensitivities: jsonb("custom_sensitivities").$type<string[]>().notNull().default([]),

  /**
   * Per-category overrides, keyed by the classifier's category tags. These
   * beat the severity thresholds in both directions, because "how bad is it"
   * and "do I want to see it" are different questions:
   *   "ignore"  - never show me this, whatever the severity
   *   "surface" - always show me this, never hide it for me
   *   "hide"    - always hide this, even if it's mild
   * A creator who wants to read every insult sets insult -> surface; one who
   * never wants to see a slur sets identity_hate -> hide.
   */
  categoryOverrides: jsonb("category_overrides")
    .$type<Record<string, "ignore" | "surface" | "hide">>()
    .notNull()
    .default({}),

  /**
   * Identities this creator is attacked over. Two jobs: told to the
   * classifier so it recognizes attacks on *this* person rather than
   * generic hate, and used to route those attacks via identityAttackAction.
   * Stored as free-ish strings so someone can name something our checkbox
   * list didn't anticipate.
   */
  protectedIdentities: jsonb("protected_identities").$type<string[]>().notNull().default([]),

  /** What to do with an attack on a listed identity. */
  identityAttackAction: text("identity_attack_action")
    .$type<"surface" | "hide">()
    .notNull()
    .default("hide"),

  /** Hide the comment text in the queue behind a click, so counts can be read safely. */
  blurQueueByDefault: boolean("blur_queue_by_default").notNull().default(true),

  /** Pause all notifications; keep hiding in the background. */
  quietMode: boolean("quiet_mode").notNull().default(false),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    /** Meta's comment id — the handle for hide/delete/reply. */
    platformCommentId: text("platform_comment_id").notNull(),
    platformMediaId: text("platform_media_id"),
    /** Only set for Threads, where replies nest. */
    parentCommentId: text("parent_comment_id"),

    authorUsername: text("author_username"),
    text: text("text").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),

    severity: severityEnum("severity"),
    /** Model's own confidence, 0-100. Low confidence never auto-hides. */
    confidence: integer("confidence"),
    /** Short, non-graphic label the queue can show without re-exposing the abuse. */
    summary: text("summary"),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    /** True when the comment reads as a credible threat rather than generic abuse. */
    targetsPhysicalSafety: boolean("targets_physical_safety").notNull().default(false),

    disposition: dispositionEnum("disposition").notNull().default("pending"),
    /** Which rule fired, for the "why was this hidden?" answer. */
    dispositionReason: text("disposition_reason"),
    actedAt: timestamp("acted_at", { withTimezone: true }),

    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    classifierError: text("classifier_error"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Meta retries webhooks; this is what makes ingestion idempotent.
    uniqueIndex("comments_platform_id_idx").on(t.accountId, t.platformCommentId),
    index("comments_queue_idx").on(t.accountId, t.disposition, t.createdAt),
    index("comments_unclassified_idx").on(t.classifiedAt),
  ],
);

/**
 * Append-only log of every action taken on a comment, by whom, and why.
 * A moderation tool the creator can't audit is one they can't trust.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actor: text("actor").notNull(), // "rule:auto_hide" | "creator" | "system"
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_comment_idx").on(t.commentId)],
);

/** Rolling counters that drive pile-on detection. */
export const activityWindows = pgTable(
  "activity_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Start of a 15-minute bucket. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    totalComments: integer("total_comments").notNull().default(0),
    flaggedComments: integer("flagged_comments").notNull().default(0),
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("activity_window_idx").on(t.accountId, t.windowStart)],
);

/**
 * Installation-wide runtime settings, edited from /setup rather than a text
 * editor. A single row (id = "singleton").
 *
 * Environment variables still work and act as the fallback, so an existing
 * deployment keeps running untouched — but anything set here wins, because
 * someone who just picked a model in the UI expects that to be what happens.
 *
 * API keys are encrypted with the same AES-256-GCM sealing as Instagram
 * tokens; a database dump must not hand over someone's billing.
 */
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("singleton"),

  /** "anthropic" | "openai" | "ollama" */
  desktopEnabled: boolean("desktop_enabled").notNull().default(false),
  provider: text("provider").$type<"anthropic" | "openai" | "ollama">(),
  /** The exact model string for the chosen provider. */
  model: text("model"),
  /** Reasoning depth, Anthropic only: low | medium | high | xhigh | max */
  effort: text("effort"),

  anthropicKeyEnc: text("anthropic_key_enc"),
  openaiKeyEnc: text("openai_key_enc"),
  /** For OpenAI-compatible gateways (Groq, Together, vLLM). */
  openaiBaseUrl: text("openai_base_url"),
  ollamaHost: text("ollama_host"),

  /**
   * Meta app credentials, also editable from /setup. The secret is sealed like
   * every other credential here. The verify token is not a secret — it's a
   * shared nonce Meta echoes during the webhook handshake — so it's stored
   * plainly and can be shown back to the user, which it has to be: they need
   * to paste it into Meta's console.
   */
  metaAppId: text("meta_app_id"),
  metaAppSecretEnc: text("meta_app_secret_enc"),
  metaVerifyToken: text("meta_verify_token"),
  publicBaseUrl: text("public_base_url"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
