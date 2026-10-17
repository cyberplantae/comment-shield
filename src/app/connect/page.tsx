import { redirect } from "next/navigation";
import Link from "next/link";
import { metaReadiness } from "@/lib/meta/config";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function Connect({ searchParams }: Props) {
  if (process.env.SHIELD_DESKTOP === "1") redirect("/desktop/connect");
  const { error } = await searchParams;
  const readiness = await metaReadiness();
  return <main className="mx-auto max-w-2xl space-y-6">
    <div className="space-y-3"><p className="eyebrow">THE OPENING RITUAL</p><h1 className="text-3xl">Open the Instagram gate</h1><p className="text-[var(--color-muted)]">Every ward begins with a place to protect. Connect your Instagram, then choose which words may cross your circle.</p></div>
    {error ? <div role="alert" className="card p-5"><p className="font-medium">Your connection didn’t finish.</p><p className="mt-2 text-sm text-[var(--color-muted)]">Try again and review the permissions on Instagram. You can return here at any time.</p><details className="mt-3 text-sm"><summary>Connection details</summary><p className="mt-2 break-words">{error}</p></details></div> : null}
    <section className="card space-y-5 p-6">
      <h2 className="text-xl">Your first casting, step by step</h2>
      <ol className="space-y-4">{[
        ["Connect your account", "Sign in on Instagram and review the access it asks you to approve."],
        ["Choose your boundaries", "Tell us which kinds of comments you’d like help with."],
        ["Check in when you want", "Review comments and restore anything you want to keep."],
      ].map(([title, detail], i) => <li key={title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-raised)] text-sm">{i+1}</span><div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{detail}</p></div></li>)}</ol>
      {readiness.ready ? <a href="/api/auth/instagram" className="btn btn-primary">Connect Instagram →</a> : <div className="soft-panel space-y-3 p-4"><p className="font-medium">The gate is not ready yet</p><p className="text-sm text-[var(--color-muted)]">The person running Comment Shield needs to finish its Instagram setup before you can sign in.</p><Link href="/setup#instagram-setup" className="btn btn-primary">Set up Instagram →</Link></div>}
      <p className="text-xs text-[var(--color-muted)]">Use an Instagram Creator or Business account. Your Instagram password stays with Instagram.</p>
    </section>
    <details className="card p-5"><summary className="cursor-pointer font-medium">I have a personal Instagram account</summary><div className="mt-4 space-y-3 text-sm text-[var(--color-muted)]"><p>Open your Instagram profile settings and look for “Account type and tools” to switch to a professional account. Choose Creator or Business.</p><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="btn btn-quiet">Open Instagram ↗</a></div></details>
    <details className="card p-5"><summary className="cursor-pointer font-medium">What happens to my comments?</summary><p className="mt-4 text-sm text-[var(--color-muted)]">Your boundaries control what gets hidden or sent for review. Hidden comments can be restored from Your comments. Automated decisions can be wrong, so check in occasionally. Permanent deletion always asks for confirmation in the review screen.</p></details>
    <Link href="/dashboard" className="btn btn-quiet">Explore Your comments →</Link>
  </main>;
}
