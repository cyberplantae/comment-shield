import { describe, it, expect, beforeAll, vi } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-app-secret";

// Settings now come from the database. Stub that boundary so these stay pure
// unit tests of the crypto and parsing, with no Postgres required.
vi.mock("@/lib/settings", () => ({
  getMetaSettings: async () => ({
    appId: "test-app-id",
    appSecret: SECRET,
    verifyToken: "verify-me",
    publicBaseUrl: "http://localhost:3188",
    redirectUri: "http://localhost:3188/api/auth/instagram/callback",
    webhookUrl: "http://localhost:3188/api/webhooks/meta",
  }),
}));

const { verifySignature, verifyChallenge, parseCommentWebhook } = await import(
  "../meta/webhook"
);

beforeAll(() => {
  process.env.META_APP_SECRET = SECRET;
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-me";
});

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("verifySignature", () => {
  const body = JSON.stringify({ object: "instagram", entry: [] });

  it("accepts a correctly signed body", async () => {
    expect(await verifySignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", async () => {
    expect(await verifySignature(body + " ", sign(body))).toBe(false);
  });

  it("rejects a missing or malformed header", async () => {
    expect(await verifySignature(body, null)).toBe(false);
    expect(await verifySignature(body, "deadbeef")).toBe(false);
    expect(await verifySignature(body, "sha256=")).toBe(false);
  });

  it("rejects a wrong-length digest without throwing", async () => {
    // timingSafeEqual throws on length mismatch; the guard must catch it first.
    await expect(verifySignature(body, "sha256=abcd")).resolves.toBe(false);
  });
});

describe("verifyChallenge", () => {
  it("echoes the challenge when the token matches", async () => {
    const p = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-me",
      "hub.challenge": "12345",
    });
    expect(await verifyChallenge(p)).toBe("12345");
  });

  it("refuses a wrong token", async () => {
    const p = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "nope",
      "hub.challenge": "12345",
    });
    expect(await verifyChallenge(p)).toBeNull();
  });
});

describe("parseCommentWebhook", () => {
  it("extracts comments and ignores unrelated fields", () => {
    const entries = parseCommentWebhook({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_1",
                text: "hello",
                from: { username: "someone" },
                media: { id: "media_1" },
              },
            },
            { field: "mentions", value: { id: "ignored" } },
          ],
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      accountPlatformUserId: "17841400000000000",
      commentId: "comment_1",
      mediaId: "media_1",
      text: "hello",
      username: "someone",
    });
  });

  it("survives a payload with no text (thin delivery)", () => {
    const entries = parseCommentWebhook({
      entry: [{ id: "acct", changes: [{ field: "comments", value: { id: "c" } }] }],
    });
    expect(entries[0]?.text).toBeUndefined();
    expect(entries[0]?.commentId).toBe("c");
  });

  it("returns nothing for a malformed payload instead of throwing", () => {
    expect(parseCommentWebhook({})).toEqual([]);
    expect(parseCommentWebhook({ entry: [{}] })).toEqual([]);
  });
});
