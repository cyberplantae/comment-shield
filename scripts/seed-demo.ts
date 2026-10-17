import "dotenv/config";
import { db, schema } from "../src/db";
import { encryptToken } from "../src/lib/crypto";

/**
 * Local demo data: a connected account plus comments already carrying the
 * verdicts the classifier would have produced. Lets you see and click the
 * real queue UI without a Meta app or an API key.
 *
 *   pnpm seed:demo
 *
 * Actions taken in the UI on these rows will fail at the Graph call (the
 * token is fake) — the point here is the queue, the summaries, and settings.
 */

type Row = {
  author: string;
  text: string;
  severity: typeof schema.comments.$inferInsert.severity;
  confidence: number;
  summary: string;
  categories: string[];
  safety?: boolean;
  disposition: typeof schema.comments.$inferInsert.disposition;
  reason: string;
};

const ROWS: Row[] = [
  {
    author: "concerned_hiker",
    text: "This is lazy and factually wrong. You clearly didn't check the trail conditions and people are going to get hurt following this.",
    severity: "rude",
    confidence: 88,
    summary: "harsh criticism of the post's accuracy, directed at the work",
    categories: ["criticism_not_abuse"],
    disposition: "pending",
    reason: "rude: surfaced for review",
  },
  {
    author: "ragebait_andy",
    text: "imagine being this proud of nothing lmao couldn't be me",
    severity: "rude",
    confidence: 91,
    summary: "dismissive mockery of the creator",
    categories: ["insult"],
    disposition: "pending",
    reason: "rude: surfaced for review",
  },
  {
    author: "notyourfriend_22",
    text: "nobody wants you here. delete the account and stay off the internet, seriously",
    severity: "harassment",
    confidence: 94,
    summary: "demand that the creator stop posting publicly",
    categories: ["insult"],
    disposition: "pending",
    reason: "harassment: surfaced for review",
  },
  {
    author: "ambiguous_dave",
    text: "wow you really went all out this time huh. bet that took you ages",
    severity: "rude",
    confidence: 41,
    summary: "possibly sarcastic remark; tone unclear without context",
    categories: [],
    disposition: "pending",
    reason: "rude but only 41% confident; needs a human",
  },
  {
    author: "throwaway_9f2",
    text: "[slur omitted in demo data]",
    severity: "hateful",
    confidence: 96,
    summary: "slur targeting the creator's ethnicity",
    categories: ["identity_hate"],
    disposition: "auto_hidden",
    reason: "hateful at or above auto-hide threshold (hateful)",
  },
  {
    author: "creep_watcher",
    text: "i know which gym you go to on thursdays",
    severity: "threatening",
    confidence: 87,
    summary: "comment establishing real-world proximity to the creator",
    categories: ["threat_of_violence", "doxxing"],
    safety: true,
    disposition: "auto_hidden",
    reason: "threatening at or above auto-hide threshold (hateful)",
  },
  {
    author: "pileon_crew",
    text: "[body-shaming comment omitted in demo data]",
    severity: "harassment",
    confidence: 79,
    summary: "sustained mockery of the creator's appearance",
    categories: ["appearance", "custom_sensitivity"],
    disposition: "auto_hidden",
    reason: "matched a custom sensitivity; harassment at threshold",
  },
];

async function main(): Promise<void> {
  const [creator] = await db
    .insert(schema.creators)
    .values({ displayName: "demo_creator", email: "demo@example.com" })
    .returning({ id: schema.creators.id });
  if (!creator) throw new Error("failed to insert creator");

  await db.insert(schema.policies).values({
    creatorId: creator.id,
    customSensitivities: ["comments about my weight"],
    allowlistHandles: ["bestfriend"],
  });

  const [account] = await db
    .insert(schema.accounts)
    .values({
      creatorId: creator.id,
      platform: "instagram",
      platformUserId: `demo-${Date.now()}`,
      username: "demo_creator",
      accessTokenEnc: encryptToken("fake-token-for-local-demo"),
      scopes: ["instagram_business_basic", "instagram_business_manage_comments"],
    })
    .returning({ id: schema.accounts.id });
  if (!account) throw new Error("failed to insert account");

  await db.insert(schema.comments).values(
    ROWS.map((r, i) => ({
      accountId: account.id,
      platformCommentId: `demo_comment_${Date.now()}_${i}`,
      platformMediaId: "demo_media_1",
      authorUsername: r.author,
      text: r.text,
      severity: r.severity,
      confidence: r.confidence,
      summary: r.summary,
      categories: r.categories,
      targetsPhysicalSafety: r.safety ?? false,
      disposition: r.disposition,
      dispositionReason: r.reason,
      classifiedAt: new Date(),
      actedAt: r.disposition === "auto_hidden" ? new Date() : null,
    })),
  );

  // A velocity window that trips the pile-on threshold (>=25 comments, >=25% flagged).
  const windowStart = new Date(Math.floor(Date.now() / 900_000) * 900_000);
  await db.insert(schema.activityWindows).values({
    accountId: account.id,
    windowStart,
    totalComments: 214,
    flaggedComments: 63,
    alertSentAt: new Date(),
  });

  console.log(`seeded account ${account.id} with ${ROWS.length} comments`);
}

void main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
