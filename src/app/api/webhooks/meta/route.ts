import { NextResponse, type NextRequest } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifySignature, verifyChallenge, parseCommentWebhook } from "@/lib/meta/webhook";

/** Meta's subscription handshake when you save the callback URL. */
export async function GET(request: NextRequest) {
  const challenge = await verifyChallenge(new URL(request.url).searchParams);
  if (challenge === null) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Raw text, not request.json() — the HMAC is over these exact bytes.
  const raw = await request.text();

  if (!(await verifySignature(raw, request.headers.get("x-hub-signature-256")))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("malformed body", { status: 400 });
  }

  const entries = parseCommentWebhook(payload);

  // Ingest only. Classification and moderation happen in the worker:
  // Meta retries anything that doesn't return 200 quickly, and an LLM call
  // inline here would turn a latency spike into duplicate deliveries.
  let failed = false;
  for (const entry of entries) {
    try {
      await ingest(entry);
    } catch (err) {
      failed = true; // Redelivery is safe: inserts are idempotent.
      console.error("[webhook] failed to ingest", entry.commentId, err);
    }
  }

  return new NextResponse(failed ? "retry delivery" : "ok", { status: failed ? 503 : 200 });
}

async function ingest(entry: {
  accountPlatformUserId: string;
  commentId: string;
  mediaId?: string;
  parentId?: string;
  text?: string;
  username?: string;
}): Promise<void> {
  const accounts = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.platformUserId, entry.accountPlatformUserId),
        eq(schema.accounts.platform, "instagram"),
      ),
    )
    .limit(1);

  const account = accounts[0];
  // A webhook for an account we've never seen, or one that disconnected.
  if (!account) return;

  // onConflictDoNothing is what makes Meta's at-least-once delivery safe:
  // a redelivered comment hits the unique index and vanishes.
  await db.transaction(async (tx) => {
  const inserted = await tx
    .insert(schema.comments)
    .values({
      accountId: account.id,
      platformCommentId: entry.commentId,
      platformMediaId: entry.mediaId ?? null,
      parentCommentId: entry.parentId ?? null,
      authorUsername: entry.username ?? null,
      // Webhook payloads are sometimes thin; the worker hydrates empty text
      // from the Graph API before classifying.
      text: entry.text ?? "",
    })
    .onConflictDoNothing({
      target: [schema.comments.accountId, schema.comments.platformCommentId],
    })
    .returning({ id: schema.comments.id, createdAt: schema.comments.createdAt });

  // Only count a comment we actually stored. Meta redelivers aggressively, and
  // counting every delivery would inflate the denominator that pile-on
  // detection divides by — making a real brigade look proportionally smaller.
  if (inserted.length === 0) return;

  // Bump the 15-minute velocity bucket that drives pile-on alerting.
  const windowStart = new Date(Math.floor(inserted[0]!.createdAt.getTime() / 900_000) * 900_000);
  await tx
    .insert(schema.activityWindows)
    .values({ accountId: account.id, windowStart, totalComments: 1 })
    .onConflictDoUpdate({
      target: [schema.activityWindows.accountId, schema.activityWindows.windowStart],
      set: { totalComments: sql`${schema.activityWindows.totalComments} + 1` },
    });
  });
}
