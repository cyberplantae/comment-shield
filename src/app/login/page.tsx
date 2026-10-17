import { authConfigured } from "@/lib/session";
import { RefreshButton } from "@/app/components/RefreshButton";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ready = authConfigured();
  return <main className="mx-auto max-w-2xl space-y-6">
    <div className="space-y-3"><p className="eyebrow">THE KEEPER’S KEY</p><h1 className="text-3xl">{ready ? "Open your spellbook" : "Every spellbook needs a key"}</h1><p className="text-[var(--color-muted)]">{ready ? "Enter your Comment Shield password to see your comments and settings. This is separate from your Instagram password." : "Your key is simply a password. It keeps your comments and settings private. Let’s create it once, then you can sign in."}</p></div>
    {ready ? <form action="/api/session" method="post" className="card space-y-4 p-6"><label className="block space-y-2"><span>Your Comment Shield password</span><input name="password" type="password" autoComplete="current-password" required maxLength={512} className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-3" /></label>{error ? <p role="alert">That key didn’t fit. Check your Comment Shield password and try again.</p> : null}<button className="btn btn-primary" type="submit">Unlock spellbook</button><p className="text-sm text-[var(--color-muted)]">If someone set this up for you, ask them for the password.</p></form> : <>
      <section className="card space-y-5 p-6" aria-labelledby="first-key"><h2 id="first-key" className="text-xl">Setting this up on your Mac?</h2><p className="text-sm text-[var(--color-muted)]">Use the Mac where Comment Shield is installed. You’ll only need to do this once.</p>
      <ol className="space-y-5">{[
        ["Open the Comment Shield folder", "In Finder, open the folder named comment-shield. It’s the folder you downloaded or used to start this app."],
        ["Double-click “Set Up Comment Shield.command”", "A setup window will open. It creates a private password for you and saves it on this Mac."],
        ["Keep your key somewhere safe", "Your password appears in that setup window. Save it in your password manager. Don’t use your Instagram password."],
        ["Restart Comment Shield, then come back here", "If the app is running in a Terminal window, click that window and press Control + C once to stop it. Start it again the same way you did before. Then use the button below."],
      ].map(([title, body], i) => <li key={title} className="flex gap-3"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm">{i+1}</span><div><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{body}</p></div></li>)}</ol>
      <RefreshButton label="I’ve restarted it — continue to sign in" />
      </section>
      <details className="card p-5"><summary className="cursor-pointer font-medium">Someone else set this up for me</summary><p className="mt-3 text-sm text-[var(--color-muted)]">Ask them: “Could you finish setting up my Comment Shield password and restart the app?” Once they’ve done that, refresh this page and sign in with the password they give you.</p></details>
      <details className="card p-5"><summary className="cursor-pointer font-medium">Using Windows, Linux, or a hosted server?</summary><div className="mt-3 space-y-3 text-sm text-[var(--color-muted)]"><p>On the computer running Comment Shield, open a terminal in the project folder and run:</p><pre className="overflow-x-auto rounded-lg bg-[var(--color-raised)] p-3">npm run setup:local</pre><p>Save the password it displays, then restart the app. For hosted services, the person managing the server should set ADMIN_PASSWORD to a long, unique password in the service’s environment settings and redeploy.</p></div></details>
      <p className="text-xs text-[var(--color-muted)]">Why a separate setup window? Only someone with access to the computer running Comment Shield should be able to create its first password.</p>
    </>}
  </main>;
}
