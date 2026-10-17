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

  const rows = await db
    .select({
      comment: schema.comments,
      account: schema.accounts,
    })
    .from(schema.comments)
    .innerJoin(schema.accounts, eq(schema.comments.accountId, schema.accounts.id))
    .where(eq(schema.comments.id, commentId))
    .limit(1);

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { comment, account } = row;

  if (action === "keep") {
    // "Keep" on something already hidden has to actually unhide it, or the
    // creator's decision silently doesn't take effect on Instagram.
    const wasHidden = comment.disposition === "hidden" || comment.disposition === "auto_hidden";
    if (wasHidden) {
      try {
        await applyPlatformAction(account, comment, "unhide");
      } catch (err) {
        if (!(err instanceof MetaApiError) || !err.isGone) throw err;
      }
    }
    await finalize(comment.id, account.id, "kept", "creator kept this comment", action);
    return NextResponse.json({ ok: true });
  }

  try {
    await applyPlatformAction(account, comment, action);
  } catch (err) {
    if (err instanceof MetaApiError && err.isGone) {
      // Already deleted upstream. The end state is what the creator wanted.
      await finalize(comment.id, account.id, "deleted", "already removed upstream", action);
      return NextResponse.json({ ok: true, note: "comment no longer exists" });
    }
    if (err instanceof MetaApiError && err.isAuthFailure) {
      await db
        .update(schema.accounts)
        .set({ disconnectedAt: new Date() })
        .where(eq(schema.accounts.id, account.id));
      return NextResponse.json({ error: "reconnect_required" }, { status: 409 });
    }
    throw err;
  }

  const disposition =
    action === "delete" ? "deleted" : action === "hide" ? "hidden" : "kept";
  await finalize(comment.id, account.id, disposition, `creator chose ${action}`, action);

  return NextResponse.json({ ok: true });
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

async function finalize(
  commentId: string,
  accountId: string,
  disposition: "hidden" | "deleted" | "kept",
  reason: string,
  action: string,
): Promise<void> {
  await db
    .update(schema.comments)
    .set({ disposition, dispositionReason: reason, actedAt: new Date() })
    .where(eq(schema.comments.id, commentId));

  await db.insert(schema.auditLog).values({
    commentId,
    accountId,
    action,
    actor: "creator",
    detail: { disposition, reason },
  });
}
