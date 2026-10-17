import { db, schema } from "@/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { listRecentMedia, pollComments, MetaApiError } from "@/lib/meta/graph";
import { refreshLongLived } from "@/lib/meta/oauth";
import { tick } from "@/worker/index";
type State = { started: boolean; busy: boolean; lastChecked: string | null; error: string | null; nextRefresh: number };
const shared = globalThis as typeof globalThis & { shieldDesktopWorker?: State };
export const workerState = shared.shieldDesktopWorker ??= { started: false, busy: false, lastChecked: null, error: null, nextRefresh: 0 };
export async function desktopCycle() {
  if (workerState.busy) return;
  workerState.busy = true;
  try {
    const [settings] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, "singleton"));
    if (!settings?.desktopEnabled) return;
    const accounts = await db.select().from(schema.accounts).where(and(eq(schema.accounts.platform, "instagram"), isNull(schema.accounts.disconnectedAt)));
    workerState.error = null;
    for (const account of accounts) {
      try {
        let token = decryptToken(account.accessTokenEnc);
        if (Date.now() > workerState.nextRefresh && (!account.lastRefreshedAt || Date.now() - account.lastRefreshedAt.getTime() > 86400000)) {
          try { const fresh = await refreshLongLived("instagram", token); token = fresh.accessToken;
            await db.update(schema.accounts).set({ accessTokenEnc: encryptToken(token), tokenExpiresAt: new Date(Date.now() + fresh.expiresIn * 1000), lastRefreshedAt: new Date() }).where(eq(schema.accounts.id, account.id));
          } catch { /* Some user-generated tokens cannot refresh. Auth failures during polling request reconnect. */ }
        }
        const posts = await listRecentMedia(token);
        for (const post of posts) {
          const comments = await pollComments(token, post.id);
          for (const comment of comments) {
            await db.transaction(async tx => {
              const inserted = await tx.insert(schema.comments).values({ accountId: account.id, platformCommentId: comment.id, platformMediaId: post.id, text: comment.text ?? "", authorUsername: comment.username ?? null, postedAt: comment.timestamp ? new Date(comment.timestamp) : null,
                ...(comment.hidden ? { disposition: "hidden" as const, classifiedAt: new Date(), summary: "Already hidden on Instagram", dispositionReason: "Hidden before this check" } : {}) }).onConflictDoNothing().returning({ createdAt: schema.comments.createdAt });
              if (!inserted[0]) return;
              const windowStart = new Date(Math.floor(inserted[0].createdAt.getTime() / 900000) * 900000);
              await tx.insert(schema.activityWindows).values({ accountId: account.id, windowStart, totalComments: 1 }).onConflictDoUpdate({ target: [schema.activityWindows.accountId, schema.activityWindows.windowStart], set: { totalComments: sql`${schema.activityWindows.totalComments} + 1` } });
            });
          }
        }
      } catch (error) {
        if (error instanceof MetaApiError && error.isAuthFailure) await db.update(schema.accounts).set({ disconnectedAt: new Date() }).where(eq(schema.accounts.id, account.id));
        workerState.error = "Instagram could not be checked. Check your internet connection or reconnect your account.";
      }
    }
    if (Date.now() > workerState.nextRefresh) workerState.nextRefresh = Date.now() + 3600000;
    await tick();
    workerState.lastChecked = new Date().toISOString();
  } catch { workerState.error = "The check did not finish. Check your reader connection and try again."; }
  finally { workerState.busy = false; }
}
export function startDesktopWorker() {
  if (workerState.started) return; workerState.started = true;
  void desktopCycle();
  setInterval(() => { void desktopCycle(); }, 60000).unref();
}
