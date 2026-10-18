import "dotenv/config";
import { eq, and, isNull, sql, inArray, or, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { classifyBatch, batchSize, type ClassifyInput } from "@/lib/classify";
import { decide, isPileOn } from "@/lib/rules";
import { policyFromRow } from "@/lib/policy";
import { setHidden, deleteComment, getComment, MetaApiError } from "@/lib/meta/graph";
import { manageReply } from "@/lib/meta/threads";

const POLL_INTERVAL_MS = 5_000;

/** One unclassified comment joined to the account and policy it belongs to. */
type PendingRow = {
  comment: typeof schema.comments.$inferSelect;
  account: typeof schema.accounts.$inferSelect;
  policy: typeof schema.policies.$inferSelect;
};

/**
 * The worker owns everything slow: LLM calls and Graph writes. The webhook
 * only writes rows. That split is what keeps Meta from redelivering comments
 * because we took too long to answer.
 */
export async function tick(): Promise<number> {
  const pending = await db
    .select({
      comment: schema.comments,
      account: schema.accounts,
      policy: schema.policies,
    })
    .from(schema.comments)
    .innerJoin(schema.accounts, eq(schema.comments.accountId, schema.accounts.id))
    .innerJoin(schema.policies, eq(schema.accounts.creatorId, schema.policies.creatorId))
    .where(and(isNull(schema.comments.classifiedAt), eq(schema.comments.disposition, "pending"), lt(schema.comments.attempts, 5), or(isNull(schema.comments.nextAttemptAt), lte(schema.comments.nextAttemptAt, new Date())), isNull(schema.accounts.disconnectedAt)))
    .limit((await batchSize()) * 4);

  if (pending.length === 0) return 0;

  // Batch per creator: the custom-sensitivity list is part of the prompt, so
  // mixing creators in one call would leak one creator's settings into
  // another's classification.
  const byCreator = new Map<string, PendingRow[]>();
  for (const row of pending) {
    const key = row.policy.creatorId;
    const bucket = byCreator.get(key);
    if (bucket) bucket.push(row);
    else byCreator.set(key, [row]);
  }

  let handled = 0;
  for (const rows of byCreator.values()) {
    const size = await batchSize();
    for (let i = 0; i < rows.length; i += size) {
      handled += await processBatch(rows.slice(i, i + size));
    }
  }
  return handled;
}

async function processBatch(rows: PendingRow[]): Promise<number> {
  const first = rows[0];
  if (!first) return 0;
  const policyRow = first.policy;

  // Hydrate any comment whose webhook payload arrived without text.
  const inputs: ClassifyInput[] = [];
  for (const row of rows) {
    const { comment, account } = row;
    let text = comment.text;

    if (!text.trim() || !comment.authorUsername) {
      try {
        const fetched = await getComment(decryptToken(account.accessTokenEnc), comment.platformCommentId);
        text = text || fetched.text || "";
        comment.authorUsername = comment.authorUsername ?? fetched.username ?? null;
        if (text) {
          await db
            .update(schema.comments)
            .set({ text, authorUsername: comment.authorUsername ?? fetched.username ?? null })
            .where(eq(schema.comments.id, comment.id));
        }
      } catch (err) {
        if (err instanceof MetaApiError && err.isGone) {
          // Author deleted it before we got to it. Nothing to moderate.
          await db
            .update(schema.comments)
            .set({ disposition: "ignored", dispositionReason: "removed upstream", classifiedAt: new Date() })
            .where(eq(schema.comments.id, comment.id));
          continue;
        }
        if (err instanceof MetaApiError && err.isAuthFailure) await db.update(schema.accounts).set({disconnectedAt:new Date()}).where(eq(schema.accounts.id,account.id));
        await db.update(schema.comments).set({classifierError:"Instagram could not read this comment. Check the connection; retries stop after five attempts.",attempts:sql`${schema.comments.attempts} + 1`,nextAttemptAt:new Date(Date.now()+60000)}).where(and(eq(schema.comments.id,comment.id),isNull(schema.comments.classifiedAt),eq(schema.comments.disposition,"pending")));
        continue;
      }
    }

    if (!text.trim()) {
      // An image-only or sticker comment. Nothing for a text classifier to do.
      await db
        .update(schema.comments)
        .set({ disposition: "ignored", dispositionReason: "no text content", classifiedAt: new Date() })
        .where(eq(schema.comments.id, comment.id));
      continue;
    }

    inputs.push({ id: comment.id, text, author: comment.authorUsername });
  }

  if (inputs.length === 0) return 0;

  let verdicts: Awaited<ReturnType<typeof classifyBatch>>;
  try {
    verdicts = await classifyBatch(
      inputs,
      policyRow.customSensitivities,
      policyRow.protectedIdentities,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[worker] classification failed:", message);
    // Record the failure so the batch isn't retried in a hot loop forever.
    // These rows need an operator look, not an infinite retry.
    await db
      .update(schema.comments)
      .set({ classifierError: "Reader unavailable. Retrying automatically, up to five attempts.", attempts: sql`${schema.comments.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 60000) })
      .where(and(inArray(schema.comments.id, inputs.map((i) => i.id)), isNull(schema.comments.classifiedAt), eq(schema.comments.disposition, "pending")));
    return 0;
  }

  const policy = policyFromRow(policyRow);

  let count = 0;
  for (const row of rows) {
    const { comment, account } = row;
    const verdict = verdicts.get(comment.id);
    // Model skipped this id — leave it unclassified for the next tick rather
    // than defaulting to benign.
    if (!verdict) {
      await db.update(schema.comments).set({classifierError: "The reader skipped this comment. Retrying up to five attempts.", attempts: sql`${schema.comments.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 60000)}).where(and(eq(schema.comments.id, comment.id), isNull(schema.comments.classifiedAt),eq(schema.comments.disposition,"pending")));
      continue;
    }

    const completed = await db.transaction(async db => {
    const [fresh] = await db.select().from(schema.comments).where(eq(schema.comments.id, comment.id)).for("update");
    if (!fresh || fresh.disposition !== "pending" || fresh.classifiedAt) return false;
    const [currentPolicy] = await db.select().from(schema.policies).where(eq(schema.policies.creatorId, account.creatorId));
    if (!currentPolicy) return false;
    if (process.env.SHIELD_DESKTOP === "1") {
      const [settings] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, "singleton"));
      if (!settings?.desktopEnabled) return false;
    }
    const decision = decide(verdict, policyFromRow(currentPolicy), comment.authorUsername);

    let disposition: typeof schema.comments.$inferSelect.disposition = "pending";
    if (decision.action === "ignore") disposition = "ignored";
    if (decision.action === "queue") disposition = "pending";

    if (decision.action === "hide" || decision.action === "delete") {
      try {
        const token = decryptToken(account.accessTokenEnc);
        if (account.platform === "threads") {
          await manageReply(token, comment.platformCommentId, true);
          disposition = "auto_hidden";
        } else if (decision.action === "delete") {
          await deleteComment(token, comment.platformCommentId);
          disposition = "deleted";
        } else {
          await setHidden(token, comment.platformCommentId, true);
          disposition = "auto_hidden";
        }
      } catch (err) {
        if (err instanceof MetaApiError && err.isGone) {
          disposition = "ignored";
        } else if (err instanceof MetaApiError && err.isAuthFailure) {
          await db
            .update(schema.accounts)
            .set({ disconnectedAt: new Date() })
            .where(eq(schema.accounts.id, account.id));
          // Surface it to the creator instead of dropping it on the floor.
          disposition = "pending";
        } else if (err instanceof MetaApiError && err.isRateLimited) {
          // Leave classifiedAt null so the next tick retries the action.
          await db.update(schema.comments).set({classifierError:"Instagram asked us to wait. Retrying up to five attempts.",attempts:sql`${schema.comments.attempts} + 1`,nextAttemptAt:new Date(Date.now()+300000)}).where(eq(schema.comments.id,comment.id));
          return false;
        } else {
          await db.update(schema.comments).set({ classifierError: "Instagram could not finish this action. Retrying up to five attempts.", attempts: sql`${schema.comments.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 60000) }).where(eq(schema.comments.id, comment.id));
          return false;
        }
      }
    }

    await db
      .update(schema.comments)
      .set({
        severity: verdict.severity,
        confidence: verdict.confidence,
        summary: verdict.summary,
        categories: verdict.categories,
        targetsPhysicalSafety: verdict.targetsPhysicalSafety,
        disposition,
        dispositionReason: decision.reason,
        classifiedAt: new Date(),
        classifierError: null,
        nextAttemptAt: null,
        actedAt: disposition === "auto_hidden" || disposition === "deleted" ? new Date() : null,
      })
      .where(eq(schema.comments.id, comment.id));

    if (disposition === "auto_hidden" || disposition === "deleted") {
      await db.insert(schema.auditLog).values({
        commentId: comment.id,
        accountId: account.id,
        action: disposition,
        actor: "rule:auto_hide",
        detail: { severity: verdict.severity, confidence: verdict.confidence, reason: decision.reason },
      });
    }

    if (decision.countsAsFlagged) {
      const windowStart = new Date(Math.floor(comment.createdAt.getTime() / 900_000) * 900_000);
      await db
        .insert(schema.activityWindows)
        .values({ accountId: account.id, windowStart, totalComments: 0, flaggedComments: 1 })
        .onConflictDoUpdate({
          target: [schema.activityWindows.accountId, schema.activityWindows.windowStart],
          set: { flaggedComments: sql`${schema.activityWindows.flaggedComments} + 1` },
        });
    }

    return true;
    });
    if (completed) count++;
  }

  await checkPileOn(first.account.id);
  return count;
}

/**
 * The feature creators actually want: told that a wave is starting, before
 * they open the app and read 400 comments.
 */
async function checkPileOn(accountId: string): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / 900_000) * 900_000);
  const rows = await db
    .select()
    .from(schema.activityWindows)
    .where(
      and(
        eq(schema.activityWindows.accountId, accountId),
        eq(schema.activityWindows.windowStart, windowStart),
      ),
    )
    .limit(1);

  const window = rows[0];
  if (!window || window.alertSentAt) return;
  if (!isPileOn(window.totalComments, window.flaggedComments)) return;

  await db
    .update(schema.activityWindows)
    .set({ alertSentAt: new Date() })
    .where(eq(schema.activityWindows.id, window.id));

  await db.insert(schema.auditLog).values({
    accountId,
    action: "pile_on_detected",
    actor: "system",
    detail: { total: window.totalComments, flagged: window.flaggedComments },
  });

  // TODO: deliver this — email, push, or SMS. The detection is the hard part
  // and it's done; delivery is a channel choice the creator should make.
  console.warn(
    `[worker] pile-on on account ${accountId}: ${window.flaggedComments}/${window.totalComments} flagged in this window`,
  );
}

export async function main(): Promise<void> {
  console.log("[worker] started");
  for (;;) {
    try {
      const n = await tick();
      if (n > 0) console.log(`[worker] processed ${n} comment(s)`);
    } catch (err) {
      console.error("[worker] tick failed:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}
