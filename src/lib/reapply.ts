import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { decide } from "@/lib/rules";
import { policyFromRow } from "@/lib/policy";
import { setHidden, deleteComment, MetaApiError } from "@/lib/meta/graph";
import { manageReply } from "@/lib/meta/threads";
import type { Assessment } from "@/lib/rules";

export type ReapplyResult = {
  cleared: number; // dropped out of the queue (now below the surfacing threshold)
  hidden: number; // newly hidden because the auto-hide threshold came down
  failed: number; // platform call failed; left pending
};

/**
 * Re-run the policy over comments still waiting on a decision.
 *
 * Only `pending` rows are touched. Anything already acted on — hidden,
 * deleted, kept — is history: silently reversing a decision the creator
 * already made (or already saw made for them) is worse than leaving it stale.
 *
 * No classifier call is involved. The verdict is already stored on the row,
 * so this is a pure re-evaluation of `decide()` against the new thresholds.
 */
export async function reapplyPolicy(creatorId: string): Promise<ReapplyResult> {
  const result: ReapplyResult = { cleared: 0, hidden: 0, failed: 0 };

  const policyRows = await db
    .select()
    .from(schema.policies)
    .where(eq(schema.policies.creatorId, creatorId))
    .limit(1);
  const policyRow = policyRows[0];
  if (!policyRow) return result;

  const policy = policyFromRow(policyRow);

  const rows = await db
    .select({ comment: schema.comments, account: schema.accounts })
    .from(schema.comments)
    .innerJoin(schema.accounts, eq(schema.comments.accountId, schema.accounts.id))
    .where(
      and(
        eq(schema.accounts.creatorId, creatorId),
        eq(schema.comments.disposition, "pending"),
        // Unclassified rows have no verdict to re-evaluate; the worker owns them.
        isNotNull(schema.comments.classifiedAt),
      ),
    );

  for (const { comment, account } of rows) {
    await db.transaction(async db => {
    const [fresh] = await db.select().from(schema.comments).where(eq(schema.comments.id, comment.id)).for("update");
    if (!fresh || fresh.disposition !== "pending") return;
    if (!comment.severity || comment.confidence === null) return;

    const verdict: Assessment = {
      severity: comment.severity,
      confidence: comment.confidence,
      categories: comment.categories,
      targetsPhysicalSafety: comment.targetsPhysicalSafety,
    };

    const decision = decide(verdict, policy, comment.authorUsername);
    if (decision.action === "queue") return; // still wants a human; leave it

    if (decision.action === "ignore") {
      await db
        .update(schema.comments)
        .set({
          disposition: "ignored",
          dispositionReason: `settings changed: ${decision.reason}`,
        })
        .where(eq(schema.comments.id, comment.id));
      result.cleared++;
      return;
    }

    // hide / delete: the threshold came down far enough to act on this one.
    try {
      const token = decryptToken(account.accessTokenEnc);
      if (account.platform === "threads") {
        await manageReply(token, comment.platformCommentId, true);
      } else if (decision.action === "delete") {
        await deleteComment(token, comment.platformCommentId);
      } else {
        await setHidden(token, comment.platformCommentId, true);
      }
    } catch (err) {
      // A failed platform call must not cost the creator their settings save.
      // Leave the comment pending and move on.
      if (!(err instanceof MetaApiError) || !err.isGone) {
        result.failed++;
        return;
      }
    }

    const disposition = decision.action === "delete" ? "deleted" : "auto_hidden";
    await db
      .update(schema.comments)
      .set({
        disposition,
        dispositionReason: `settings changed: ${decision.reason}`,
        actedAt: new Date(),
      })
      .where(eq(schema.comments.id, comment.id));

    await db.insert(schema.auditLog).values({
      commentId: comment.id,
      accountId: account.id,
      action: disposition,
      actor: "rule:settings_change",
      detail: { reason: decision.reason },
    });

    result.hidden++;
    });
  }

  return result;
}
