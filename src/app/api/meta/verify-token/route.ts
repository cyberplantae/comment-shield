import { requireOwner } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getMetaSettings, saveSettings } from "@/lib/settings";

/**
 * Return the webhook verify token, creating one on first ask.
 *
 * This lives behind a route rather than being generated while the setup page
 * renders, because a Server Component must not write during render — the
 * write is silently dropped and the user is handed a blank box to paste into
 * Meta's console.
 *
 * The token is not a secret: it's a shared word Meta echoes back during the
 * webhook handshake so each side can confirm the other. It has to be visible.
 */
export async function GET() {
  await requireOwner();
  const existing = await getMetaSettings();
  if (existing.verifyToken) {
    return NextResponse.json({ verifyToken: existing.verifyToken });
  }

  const token = randomBytes(16).toString("hex");
  await saveSettings({ metaVerifyToken: token });
  return NextResponse.json({ verifyToken: token });
}
