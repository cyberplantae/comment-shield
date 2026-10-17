import { requireOwner } from "@/lib/auth";
import { getProfile, listRecentMedia } from "@/lib/meta/graph";
import { encryptToken } from "@/lib/crypto";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SettingsForm } from "../../components/SettingsForm";
import Link from "next/link";
export default async function DesktopConnect() {
 await requireOwner();
 async function connect(data: FormData) {
  "use server"; await requireOwner();
  const token = data.get("token"); if(typeof token !== "string" || token.trim().length < 20 || token.length > 4096) return { error: "Paste the complete connection code from Meta, then try again." };
  const value = token.trim();
  let profile;
  try { profile = await getProfile(value); await listRecentMedia(value); } catch { return { error: "Instagram could not confirm this code. Check your internet connection and copy a fresh access token from Meta’s Instagram setup page." }; }
  if(!profile.id || !profile.username) throw new Error("Instagram did not return your profile");
  await db.transaction(async tx => {
   const [existing] = await tx.select().from(schema.accounts).where(and(eq(schema.accounts.platform,"instagram"),eq(schema.accounts.platformUserId,profile.id)));
   if(existing) { await tx.update(schema.accounts).set({accessTokenEnc:encryptToken(value),username:profile.username,disconnectedAt:null,tokenExpiresAt:null,lastRefreshedAt:new Date()}).where(eq(schema.accounts.id,existing.id)); }
   else { const [creator] = await tx.insert(schema.creators).values({displayName:profile.username}).returning(); await tx.insert(schema.policies).values({creatorId:creator!.id}); await tx.insert(schema.accounts).values({creatorId:creator!.id,platform:"instagram",platformUserId:profile.id,username:profile.username,accessTokenEnc:encryptToken(value),lastRefreshedAt:new Date(),scopes:["instagram_business_basic","instagram_business_manage_comments"]}); }
  });
  redirect("/desktop");
 }
 return <main className="mx-auto max-w-2xl space-y-6"><p className="eyebrow">OPEN THE INSTAGRAM GATE</p><h1 className="text-3xl">Connect your account</h1><p className="text-[var(--color-muted)]">This independent desktop app needs permission from Meta, the company behind Instagram. There’s a one-time setup on Meta’s website. You won’t need a server, public website, or Terminal.</p><ol className="card space-y-5 p-6"><li><h2 className="text-lg">1. Use a professional account</h2><p className="mt-2 text-sm">Your Instagram account must be a Creator or Business account.</p><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="btn btn-quiet mt-3">Open Instagram ↗</a></li><li><h2 className="text-lg">2. Give your app access in Meta</h2><p className="mt-2 text-sm">Create an app in Meta’s developer dashboard, add Instagram with Instagram Login, and add your account as a tester. Accept the invitation. In the Instagram setup area, generate an access token with permission to read and manage comments.</p><a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="btn btn-quiet mt-3">Open Meta setup ↗</a></li><li><h2 className="text-lg">3. Bring back your connection code</h2><p className="mt-2 text-sm">Meta calls this an “access token.” It is not your Instagram password. Keep it private: it grants access to your account’s comments. Paste it below; it is encrypted on this computer.</p></li></ol><SettingsForm action={connect} success="Connected."><label className="block space-y-2"><span>Instagram access token</span><input name="token" type="password" required autoComplete="off" maxLength={4096} className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3" /></label><button className="btn btn-primary">Check and connect Instagram</button></SettingsForm><p className="text-sm text-[var(--color-muted)]">Meta can require developer registration and account verification. Token duration depends on the kind Meta issues; the app asks you to reconnect if access expires. This setup cannot be skipped by an independent app.</p><Link href="/desktop" className="btn btn-quiet">Back to my spellbook</Link></main>;
}
