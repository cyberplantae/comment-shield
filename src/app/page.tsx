import Link from "next/link";

export default function Home() {
  return (
    <main className="space-y-12">
      <section className="welcome-panel">
        <div className="space-y-6">
          <p className="eyebrow">A spellbook for a quieter corner of the internet</p>
          <h1 className="text-5xl leading-[1.06] sm:text-6xl">Open your spellbook.<br /><span className="text-[var(--color-accent)]">Draw your circle.</span></h1>
          <p className="max-w-lg text-lg text-[var(--color-muted)] leading-relaxed">
            Here begins a small ritual of protection. Choose what may enter your creative space; let your ward help hide abusive Instagram comments and bring you gentle summaries of those that need your care.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/connect" className="btn btn-primary">Connect Instagram <span aria-hidden="true">↗</span></Link>
            <Link href="/dashboard" className="btn btn-quiet">Open your comments</Link>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Made for Creator and Business accounts. You choose your boundaries.</p>
        </div>
        <aside className="preview-card" aria-label="Example of a comment summary">
          <div className="flex items-center justify-between gap-3"><span className="eyebrow">A page from the book of wards</span><span className="example-badge">Example</span></div>
          <div className="ward-sigil" aria-hidden="true"><span>✦</span></div>
          <h2 className="text-3xl">Lift the veil.<br />At your own pace.</h2>
          <div className="card mt-6 space-y-3 p-5">
            <span className="example-badge">Hidden automatically</span>
            <p className="text-sm">A personal insult about your appearance.</p>
            <p className="text-xs text-[var(--color-muted)]">Original comment stays out of sight.</p>
          </div>
          <p className="mt-5 text-sm text-[var(--color-muted)]">You can review hidden comments and restore them whenever you choose.</p>
        </aside>
      </section>

      <section className="space-y-5" aria-labelledby="how-it-works">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="how-it-works" className="text-3xl">The opening ritual</h2><p className="text-sm text-[var(--color-muted)]">Three steps to inscribe your first ward.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["01", "Open the gate", "Connect Instagram to begin. Your password stays with Instagram."],
            ["02", "Inscribe your ward", "Choose your boundaries: what stays, what is hidden, and what comes to you for review."],
            ["03", "Return to your circle", "Read gentle summaries at your own pace. Keep what belongs; restore anything hidden by mistake."],
          ].map(([number, title, body]) => <div className="card p-6" key={number}><p className="eyebrow mb-5">{number}</p><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{body}</p></div>)}
        </div>
      </section>

      <section className="soft-panel flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="max-w-xl"><h2 className="text-xl">Before the first casting</h2><p className="mt-2 text-sm text-[var(--color-muted)]">Every ward needs its foundations. The setup guide helps you connect Instagram and choose a comment reader, one step at a time.</p></div>
        <Link href="/setup" className="btn btn-quiet">Open the setup spellbook</Link>
      </section>
    </main>
  );
}
