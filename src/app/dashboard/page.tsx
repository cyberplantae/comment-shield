import { AccountPicker } from "../components/AccountPicker";
import { requireOwner } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { desc, eq, inArray, and, gte, isNull, isNotNull, count } from "drizzle-orm";
import { db, schema } from "@/db";
import { CommentCard } from "./CommentCard";
import { RefreshButton } from "../components/RefreshButton";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function Dashboard({ searchParams }: {
  searchParams: Promise<{ view?: string; page?: string; account?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "hidden" ? "hidden" : "pending";
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  await requireOwner();
  const accounts = await db.select().from(schema.accounts).orderBy(desc(schema.accounts.createdAt));
  const account = accounts.find(a => a.id === params.account) ?? accounts[0];
  if (!account) return (
    <main className="soft-panel mx-auto max-w-2xl space-y-5 p-8 sm:p-12">
      <p className="eyebrow">Your first step</p>
      <h1 className="text-4xl">Your circle awaits.</h1>
      <p className="text-[var(--color-muted)]">Connect your Instagram Creator or Business account to start reviewing comments here. Then choose the boundaries that feel right for you.</p>
      <Link href="/connect" className="btn btn-primary">Connect Instagram</Link>
      <p className="text-sm text-[var(--color-muted)]">Already connected? Check that you’re using the same installation.</p>
    </main>
  );
  const [policy] = await db.select().from(schema.policies).where(eq(schema.policies.creatorId, account.creatorId)).limit(1);
  const accountMatch = eq(schema.comments.accountId, account.id);
  // Count independently of the visible page: history must never crowd out pending work.
  const [totals, queue, backlogRows, failedRows, hiddenRows, recentWindows] = await Promise.all([
    db.select({ disposition: schema.comments.disposition, n: count() }).from(schema.comments)
      .where(and(accountMatch, isNotNull(schema.comments.classifiedAt)))
      .groupBy(schema.comments.disposition),
    db.select().from(schema.comments).where(and(accountMatch, isNotNull(schema.comments.classifiedAt),
      view === "pending" ? eq(schema.comments.disposition, "pending") : inArray(schema.comments.disposition, ["auto_hidden", "hidden"])))
      .orderBy(desc(schema.comments.createdAt), desc(schema.comments.id)).limit(PAGE_SIZE + 1).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(schema.comments).where(and(accountMatch, isNull(schema.comments.classifiedAt), isNull(schema.comments.classifierError))),
    db.select({ n: count() }).from(schema.comments).where(and(accountMatch, isNotNull(schema.comments.classifierError))),
    db.select({ n: count() }).from(schema.comments).where(and(accountMatch, inArray(schema.comments.disposition, ["auto_hidden", "hidden"]), gte(schema.comments.actedAt, new Date(Date.now() - 86_400_000)))),
    db.select().from(schema.activityWindows).where(and(eq(schema.activityWindows.accountId, account.id), gte(schema.activityWindows.windowStart, new Date(Date.now() - 86_400_000)))),
  ]);
  const pendingCount = totals.find((row) => row.disposition === "pending")?.n ?? 0;
  const hiddenCount = totals.filter((row) => row.disposition === "auto_hidden" || row.disposition === "hidden").reduce((sum, row) => sum + row.n, 0);
  const backlog = backlogRows[0]?.n ?? 0;
  const failed = failedRows[0]?.n ?? 0;
  const total24h = recentWindows.reduce((sum, row) => sum + row.totalComments, 0);
  const comments = queue.slice(0, PAGE_SIZE);
  const total = view === "pending" ? pendingCount : hiddenCount;
  const pageLink = (n: number) => `/dashboard?account=${account.id}&view=${view}&page=${n}`;
  async function retry() {
    "use server"; await requireOwner();
    await db.update(schema.comments).set({attempts:0,nextAttemptAt:null,classifierError:null}).where(and(eq(schema.comments.accountId,account!.id),eq(schema.comments.disposition,"pending"),isNull(schema.comments.classifiedAt)));
    revalidatePath("/dashboard");
  }

  return (
    <main className="space-y-7">
      <AccountPicker accounts={accounts} selected={account.id} path="/dashboard" />
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-2"><p className="eyebrow">Your space on Instagram · @{account.username ?? "your account"}</p>
          <h1 className="text-4xl sm:text-5xl">Within your circle.</h1>
          <p className="text-sm text-[var(--color-muted)]">A gentle telling, before the words themselves. Lift the veil on an original comment only when you choose.</p>
        </div>
        <RefreshButton />
      </header>
      <div className="grid grid-cols-3 gap-3">
        {[
          { n: pendingCount, label: "Need your decision", note: "Waiting for you" },
          { n: hiddenRows[0]?.n ?? 0, label: "Hidden comments", note: "In the last 24 hours" },
          { n: total24h, label: "Comments received", note: "In the last 24 hours" },
        ].map((stat) => <div className="card p-4 sm:p-6" key={stat.label}><p className="stat-number">{stat.n.toLocaleString()}</p><p className="mt-3 text-xs font-medium sm:text-sm">{stat.label}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{stat.note}</p></div>)}
      </div>
      {account.disconnectedAt ? <div role="status" className="card space-y-2 border-[var(--color-sev-hate)] p-5"><p className="font-semibold">Instagram needs you to reconnect</p><p className="text-sm text-[var(--color-muted)]">Access has ended. Reconnect so the bot can manage comments again.</p><Link href="/connect" className="btn btn-primary">Reconnect Instagram</Link></div> : null}
      {backlog > 0 || failed > 0 ? <div role="status" className="card space-y-2 p-5"><p className="font-medium">Some comments haven’t been reviewed yet</p><p className="text-sm text-[var(--color-muted)]">{backlog} waiting to be read{failed > 0 ? ` · ${failed} could not be read` : ""}. These may still be visible on Instagram.</p><Link href="/setup" className="text-sm underline">Check the comment reader connection</Link>{failed > 0 && <form action={retry}><button className="btn btn-quiet">Try reading these comments again</button></form>}</div> : null}
      {recentWindows.some((row) => row.alertSentAt !== null) ? <div className="soft-panel p-5"><p className="font-medium">There’s been a wave of difficult comments.</p><p className="mt-1 text-sm text-[var(--color-muted)]">Take this at your own pace. You can <Link href={`/dashboard/settings?account=${account.id}`} className="underline">adjust your boundaries</Link> or review what has already been hidden below.</p></div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><nav className="review-tabs" aria-label="Comment lists"><Link href="/dashboard" aria-current={view === "pending" ? "page" : undefined}>Needs you <span className="ml-2 font-semibold">{pendingCount}</span></Link><Link href={`/dashboard?account=${account.id}&view=hidden`} aria-current={view === "hidden" ? "page" : undefined}>Already hidden <span className="ml-2 font-semibold">{hiddenCount}</span></Link></nav><Link href={`/dashboard/settings?account=${account.id}`} className="text-sm underline text-[var(--color-muted)]">Adjust your boundaries ↗</Link></div>
      <section className="space-y-4" aria-labelledby="list-title">
        <div><h2 id="list-title" className="text-2xl">{view === "pending" ? "Words at the threshold" : "Beyond the ward"}</h2><p className="mt-1 text-sm text-[var(--color-muted)]">{view === "pending" ? "Hide a comment or leave it on your post. You don’t have to read the original to decide." : "No action needed. If we got something wrong, you can put it back."}</p></div>
        {comments.length === 0 ? <div className="card space-y-3 p-10 text-center"><p className="text-3xl text-[var(--color-accent)]" aria-hidden="true">✳</p><h3 className="text-lg font-medium">{page > 1 ? "No more comments on this page" : view === "hidden" ? "Nothing hidden yet" : "No decisions waiting on you"}</h3><p className="text-sm text-[var(--color-muted)]">{page > 1 ? "The list may have changed since your last visit." : view === "hidden" ? "Comments that are hidden will appear here for you to review." : backlog || failed ? "Some comments still need to be processed. Check their status above." : "Close the book for now. Return to these pages whenever you’re ready."}</p>{page > 1 ? <Link href={pageLink(1)} className="btn btn-quiet">Back to the first page</Link> : null}</div> : <ul className="grid gap-4 lg:grid-cols-2">{comments.map((c) => <CommentCard key={`${c.id}:${c.disposition}`} id={c.id} severity={c.severity} confidence={c.confidence} summary={c.summary} text={c.text} author={c.authorUsername} reason={c.dispositionReason} disposition={c.disposition} blurByDefault={policy?.blurQueueByDefault ?? true} />)}</ul>}
        {comments.length > 0 ? <nav aria-label="Comment pages" className="flex flex-wrap items-center justify-between gap-3 pt-3"><p className="text-xs text-[var(--color-muted)]">Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + comments.length} of {total}</p><div className="flex gap-2">{page > 1 ? <Link className="btn btn-quiet" href={pageLink(page - 1)}>Previous</Link> : null}{queue.length > PAGE_SIZE ? <Link className="btn btn-quiet" href={pageLink(page + 1)}>Next comments</Link> : null}</div></nav> : null}
      </section>
    </main>
  );
}
