import { requireOwner } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/meta/oauth";
import { metaReadiness } from "@/lib/meta/config";
import { getMetaSettings } from "@/lib/settings";

/** Kick off the connect flow. The creator clicks one button; this is it. */
export async function GET() {
  await requireOwner();
  // Don't bounce someone to Instagram's 404 when we already know the app
  // isn't configured — send them back with an explanation they can act on.
  const readiness = await metaReadiness();
  if (!readiness.ready) {
    const { publicBaseUrl: base } = await getMetaSettings();
    return NextResponse.redirect(
      `${base}/connect?error=${encodeURIComponent(readiness.reason)}`,
    );
  }

  const state = randomBytes(16).toString("hex");

  // Bound to an httpOnly cookie so a forged callback can't attach someone
  // else's Instagram account to this session.
  (await cookies()).set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(await authorizeUrl("instagram", state));
}
