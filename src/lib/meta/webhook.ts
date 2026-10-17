import { createHmac, timingSafeEqual } from "node:crypto";
import { getMetaSettings } from "@/lib/settings";

/**
 * Meta signs every webhook POST with an HMAC-SHA256 of the RAW request body,
 * keyed by the app secret, in the X-Hub-Signature-256 header.
 *
 * Verify against the raw bytes, never a re-serialized JSON object — any
 * difference in key order or whitespace changes the digest. An unverified
 * webhook endpoint lets anyone on the internet inject comments into a
 * creator's moderation queue.
 */
export async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const { appSecret: secret } = await getMetaSettings();
  if (!secret) throw new Error("Meta app secret is not configured");
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(expected, received);
}

/** The subscription handshake Meta performs when you save the webhook URL. */
export async function verifyChallenge(params: URLSearchParams): Promise<string | null> {
  const { verifyToken: expected } = await getMetaSettings();
  if (!expected) throw new Error("Meta webhook verify token is not configured");
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return params.get("hub.challenge");
  }
  return null;
}

/**
 * Shape of the `comments` webhook field. Meta's payloads are sparse and the
 * exact fields vary by product and version, so everything past the ids is
 * optional and we re-fetch from the Graph API when text is missing.
 */
export type CommentWebhookEntry = {
  accountPlatformUserId: string;
  commentId: string;
  mediaId?: string;
  parentId?: string;
  text?: string;
  username?: string;
};

export function parseCommentWebhook(payload: unknown): CommentWebhookEntry[] {
  const out: CommentWebhookEntry[] = [];
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { entry?: unknown }).entry)) return out;
  const body = payload as {
    entry?: {
      id?: string;
      changes?: { field?: string; value?: Record<string, unknown> }[];
    }[];
  };

  for (const entry of body.entry ?? []) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change || typeof change !== "object") continue;
      if (change.field !== "comments" && change.field !== "live_comments") continue;
      const v = change.value ?? {};
      const commentId = typeof v.id === "string" ? v.id : undefined;
      if (!commentId) continue;

      const media = v.media as { id?: string } | undefined;
      const from = v.from as { username?: string } | undefined;

      out.push({
        accountPlatformUserId: entry.id ?? "",
        commentId,
        mediaId: media?.id,
        parentId: typeof v.parent_id === "string" ? v.parent_id : undefined,
        text: typeof v.text === "string" ? v.text : undefined,
        username: from?.username,
      });
    }
  }
  return out;
}
