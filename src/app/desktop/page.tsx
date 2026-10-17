import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq, isNull, and } from "drizzle-orm";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { checkClassifier } from "@/lib/classify";
import { SettingsForm } from "../components/SettingsForm";
import { Status } from "./Status";
export const dynamic = "force-dynamic";
export default async function Desktop() {
 await requireOwner(); if(process.env.SHIELD_DESKTOP !== "1") redirect("/dashboard");
 const accounts = await db.select().from(schema.accounts);
 const [settings] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id,"singleton"));
 const reader = await getSettings(); const connected = accounts.some(a => !a.disconnectedAt);
 async function toggle(data: FormData) {
  "use server"; await requireOwner(); const enabled = data.get("enabled") === "true";
  if(enabled) { const accounts = await db.select().from(schema.accounts).where(isNull(schema.accounts.disconnectedAt)); if(!accounts.length) return { error: "Connect Instagram in step 1, then try again." }; const check = await checkClassifier(); if(!check.ok) return { error: "Your reader is not ready. Open step 2, finish its setup, and test the connection." }; }
  await db.insert(schema.appSettings).values({id:"singleton",desktopEnabled:enabled}).onConflictDoUpdate({target:schema.appSettings.id,set:{desktopEnabled:enabled}});
  revalidatePath("/desktop");
 }
 return <main className="mx-auto max-w-3xl space-y-6"><p className="eyebrow">YOUR DESKTOP SPELLBOOK</p><h1 className="text-4xl">A ward of your own.</h1><p className="text-[var(--color-muted)]">Three small steps, then let your familiar read. Everything you save stays on this computer when you install an update.</p>
 <ol className="grid gap-4">{[
 ["1", "Connect Instagram", connected ? "An account is connected. You can replace its connection if access expires." : "Use a Creator or Business account. The guide explains Meta’s one-time connection steps.", "/desktop/connect", connected ? "Manage connection" : "Connect Instagram"],
 ["2", "Choose your familiar", `Your comment reader is ${reader.provider === "ollama" ? "Ollama on this computer" : reader.provider}. Check that it works before you start.`, "/setup", "Set up comment reader"],
 ["3", "Inscribe your ward", "Choose which comments to hide and which to review. Hiding is reversible; permanent deletion is optional.", "/dashboard/settings", "Choose my boundaries"],
 ].map(([n,title,body,href,label]) => <li key={n} className="card space-y-3 p-5"><h2 className="text-xl">{n}. {title}</h2><p className="text-sm text-[var(--color-muted)]">{body}</p><Link href={href!} className="btn btn-quiet">{label}</Link></li>)}</ol>
 <section className="soft-panel space-y-4 p-6"><h2 className="text-2xl">{settings?.desktopEnabled ? "Your ward is switched on" : "Ready when you are"}</h2><p className="text-sm text-[var(--color-muted)]">Checks run about once a minute while the app is open and your computer is awake. Closing it pauses protection. Each check covers your 20 most recent posts and up to 500 comments per post; this is not a complete archive.</p><p className="text-sm text-[var(--color-muted)]">Starting also reviews existing comments in that range and may hide them according to your rules.</p><SettingsForm action={toggle} success="Your choice is saved."><input type="hidden" name="enabled" value={settings?.desktopEnabled ? "false" : "true"} /><button className="btn btn-primary" disabled={!connected}>{settings?.desktopEnabled ? "Pause protection" : "Start protection"}</button></SettingsForm><Status /><Link className="btn btn-quiet" href="/dashboard">Review my comments</Link></section>
 <details className="card p-5"><summary>How do I install updates?</summary><p className="mt-3 text-sm">Quit Comment Shield, download the newer installer from GitHub Releases, and replace the app. Your saved data lives separately. There are no automatic downloads.</p><a className="btn btn-quiet mt-3" href="https://github.com/cyberplantae/comment-shield/releases" target="_blank" rel="noreferrer">Open downloads ↗</a></details></main>;
}
