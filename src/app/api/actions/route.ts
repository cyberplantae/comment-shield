import { requireOwner } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { setHidden, deleteComment, MetaApiError } from "@/lib/meta/graph";
import { manageReply } from "@/lib/meta/threads";

const bodySchema = z.object({
  commentId: z.string().uuid(),
  action: z.enum(["hide", "unhide", "delete", "keep"]),
});

/**
 * Creator-driven moderation from the review queue.
 *
 * One authenticated owner controls all accounts in this self-hosted installation.
 */
export async function POST(request: NextRequest) {
  await requireOwner();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { commentId, action } = parsed.data;

  return db.transaction(async (tx) => {
  const rows = await tx
    .select({
      comment: schema.comments,
      account: schema.accounts,
    })
    .from(schema.comments)
    .innerJoin(schema.accounts, eq(schema.comments.accountId, schema.accounts.id))
    .where(eq(schema.comments.id, commentId))
    .limit(1).for("update", { of: schema.comments });

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { comment, account } = row;

  if (comment.disposition === "deleted") return NextResponse.json({ error: "This comment has been deleted and cannot be restored." }, {status:409});
  try {
    if (action === "keep") {
      if (comment.disposition === "hidden" || comment.disposition === "auto_hidden") await applyPlatformAction(account, comment, "unhide");
    } else await applyPlatformAction(account, comment, action);
  } catch (err) {
    if (err instanceof MetaApiError && err.isGone) {
      await finalize(tx, comment.id, account.id, "deleted", "already removed upstream", action);
      return NextResponse.json({ ok: true, note: "comment no longer exists" });
    }
    if (err instanceof MetaApiError && err.isAuthFailure) {
      await tx.update(schema.accounts).set({disconnectedAt:new Date()}).where(eq(schema.accounts.id,account.id));
      return NextResponse.json({ error: "reconnect_required" }, {status:409});
    }
    return NextResponse.json({ error: "Instagram could not confirm that change. Check the comment and try again." }, {status:502});
  }

  const disposition =
    action === "delete" ? "deleted" : action === "hide" ? "hidden" : "kept";
  await finalize(tx, comment.id, account.id, disposition, `creator chose ${action}`, action);

  return NextResponse.json({ ok: true });
  });
}

async function applyPlatformAction(
  account: typeof schema.accounts.$inferSelect,
  comment: typeof schema.comments.$inferSelect,
  action: "hide" | "unhide" | "delete",
): Promise<void> {
  const token = decryptToken(account.accessTokenEnc);

  if (account.platform === "threads") {
    // Threads has no delete-reply endpoint for other people's replies;
    // hiding is the available lever and it cascades to nested replies.
    await manageReply(token, comment.platformCommentId, action !== "unhide");
    return;
  }

  if (action === "delete") {
    await deleteComment(token, comment.platformCommentId);
  } else {
    await setHidden(token, comment.platformCommentId, action === "hide");
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function finalize(
  db: Transaction,
  commentId: string,
  accountId: string,
  disposition: "hidden" | "deleted" | "kept",
  reason: string,
  action: string,
): Promise<void> {
  await db
    .update(schema.comments)
    .set({ disposition, dispositionReason: reason, actedAt: new Date(), classifiedAt: new Date(), classifierError: null, nextAttemptAt: null })
    .where(eq(schema.comments.id, commentId));

  await db.insert(schema.auditLog).values({
    commentId,
    accountId,
    action,
    actor: "creator",
    detail: { disposition, reason },
  });
}
