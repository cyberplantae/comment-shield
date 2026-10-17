import { requireOwner } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeCode, exchangeForLongLived, INSTAGRAM_SCOPES } from "@/lib/meta/oauth";
import { getMetaSettings } from "@/lib/settings";
import { getProfile } from "@/lib/meta/graph";

export async function GET(request: NextRequest) {
  await requireOwner();
  const url = new URL(request.url);
  const jar = await cookies();

  // Meta reports user-declined consent here rather than as an error status.
  const error = url.searchParams.get("error");
  if (error) {
    const reason = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      `${(await getMetaSettings()).publicBaseUrl}/connect?error=${encodeURIComponent(reason)}`,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = jar.get("meta_oauth_state")?.value;
  jar.delete("meta_oauth_state");

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  try {
    // Short-lived token is useless to us on its own — trade up immediately.
    const short = await exchangeCode("instagram", code);
    const long = await exchangeForLongLived("instagram", short.accessToken);
    const profile = await getProfile(long.accessToken);

    const expiresAt = new Date(Date.now() + long.expiresIn * 1000);
    const sealed = encryptToken(long.accessToken);

    // A creator reconnecting must land on the same account row, not a second
    // one — otherwise their policy and queue history detach.
    const existing = await db
      .select({ id: schema.accounts.id, creatorId: schema.accounts.creatorId })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.platform, "instagram"),
          eq(schema.accounts.platformUserId, profile.id),
        ),
      )
      .limit(1);

    let accountId: string;
    if (existing[0]) {
      accountId = existing[0].id;
      await db
        .update(schema.accounts)
        .set({
          accessTokenEnc: sealed,
          tokenExpiresAt: expiresAt,
          lastRefreshedAt: new Date(),
          username: profile.username,
          scopes: [...INSTAGRAM_SCOPES],
          disconnectedAt: null,
        })
        .where(eq(schema.accounts.id, accountId));
    } else {
      const [creator] = await db
        .insert(schema.creators)
        .values({ displayName: profile.username })
        .returning({ id: schema.creators.id });
      if (!creator) throw new Error("failed to create creator");

      // Policy row must exist before the first webhook lands, or the worker
      // has no thresholds to apply.
      await db.insert(schema.policies).values({ creatorId: creator.id });

      const [account] = await db
        .insert(schema.accounts)
        .values({
          creatorId: creator.id,
          platform: "instagram",
          platformUserId: profile.id,
          username: profile.username,
          accessTokenEnc: sealed,
          tokenExpiresAt: expiresAt,
          lastRefreshedAt: new Date(),
          scopes: [...INSTAGRAM_SCOPES],
        })
        .returning({ id: schema.accounts.id });
      if (!account) throw new Error("failed to create account");
      accountId = account.id;
    }

    await db.insert(schema.auditLog).values({
      accountId,
      action: "account_connected",
      actor: "creator",
      detail: { platform: "instagram", username: profile.username },
    });

    return NextResponse.redirect(`${(await getMetaSettings()).publicBaseUrl}/dashboard`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${(await getMetaSettings()).publicBaseUrl}/connect?error=${encodeURIComponent(message)}`,
    );
  }
}
