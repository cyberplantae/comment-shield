import { AccountPicker } from "../../components/AccountPicker";
import { requireOwner } from "@/lib/auth";
import Link from "next/link";
import { SettingsForm } from "@/app/components/SettingsForm";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SEVERITIES } from "@/lib/classify/schema";
import { CATEGORY_UI, CATEGORY_ACTIONS, COMMON_IDENTITIES } from "@/lib/categories";
import { PRESETS, findPreset, describePolicy, BAND_WORD } from "@/lib/presets";
import { reapplyPolicy } from "@/lib/reapply";
import type { CategoryAction } from "@/lib/rules";

export const dynamic = "force-dynamic";

function parseHandles(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim().replace(/^@/, ""))
    .filter(Boolean);
}

function band(v: FormDataEntryValue | null, fallback: (typeof SEVERITIES)[number]) {
  return typeof v === "string" && (SEVERITIES as readonly string[]).includes(v)
    ? (v as (typeof SEVERITIES)[number])
    : fallback;
}

export default async function Settings({ searchParams }: {searchParams:Promise<{account?:string}>}) {
  await requireOwner();
  const params = await searchParams;
  const accounts = await db
    .select()
    .from(schema.accounts)
    .orderBy(desc(schema.accounts.createdAt));

  const account = accounts.find(a => a.id === params.account) ?? accounts[0];
  if (!account) {
    return (
      <main className="space-y-4">
        <h1 className="text-3xl font-semibold">Inscribe your ward</h1>
        <p className="text-[var(--color-muted)]">
          Connect an account first and these will appear.
        </p>
        <Link href="/connect" className="underline">
          Connect Instagram
        </Link>
      </main>
    );
  }

  const rows = await db
    .select()
    .from(schema.policies)
    .where(eq(schema.policies.creatorId, account.creatorId))
    .limit(1);
  const policy = rows[0];
  if (!policy) return <main>No settings found.</main>;

  /** One click sets every knob, then re-applies to the waiting queue. */
  async function applyPreset(formData: FormData) {
    "use server";
    await requireOwner();
    const creatorId = formData.get("creatorId");
    const presetId = formData.get("preset");
    if (typeof creatorId !== "string" || typeof presetId !== "string") return;

    const preset = findPreset(presetId);
    if (!preset) return;

    await db
      .update(schema.policies)
      .set({ ...preset.values, updatedAt: new Date() })
      .where(eq(schema.policies.creatorId, creatorId));

    await reapplyPolicy(creatorId);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
  }

  async function save(formData: FormData) {
    "use server";
    await requireOwner();
    const creatorId = formData.get("creatorId");
    if (typeof creatorId !== "string") return;

    await db
      .update(schema.policies)
      .set({
        surfaceAtOrAbove: band(formData.get("surfaceAtOrAbove"), "rude"),
        autoHideAtOrAbove: band(formData.get("autoHideAtOrAbove"), "hateful"),
        allowAutoDelete: formData.get("allowAutoDelete") === "on",
        blurQueueByDefault: formData.get("blurQueueByDefault") === "on",
        quietMode: formData.get("quietMode") === "on",
        allowlistHandles: parseHandles(formData.get("allowlistHandles")),
        blocklistHandles: parseHandles(formData.get("blocklistHandles")),
        categoryOverrides: (() => {
          const out: Record<string, CategoryAction> = {};
          for (const { key } of CATEGORY_UI) {
            const v = formData.get(`cat:${key}`);
            if (v === "surface" || v === "hide" || v === "ignore") out[key] = v;
          }
          return out;
        })(),
        protectedIdentities: (() => {
          const checked = formData
            .getAll("identity")
            .filter((v): v is string => typeof v === "string");
          const extra = formData.get("identitiesOther");
          const more =
            typeof extra === "string"
              ? extra.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)
              : [];
          return [...checked, ...more];
        })(),
        identityAttackAction:
          formData.get("identityAttackAction") === "surface" ? "surface" : "hide",
        customSensitivities: (() => {
          const raw = formData.get("customSensitivities");
          if (typeof raw !== "string") return [];
          return raw.split("\n").map((s) => s.trim()).filter(Boolean);
        })(),
        updatedAt: new Date(),
      })
      .where(eq(schema.policies.creatorId, creatorId));

    await reapplyPolicy(creatorId);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
  }

  const summary = describePolicy(policy);
  const fineTuned =
    Object.keys(policy.categoryOverrides).length > 0 ||
    policy.allowlistHandles.length > 0 ||
    policy.blocklistHandles.length > 0 ||
    policy.customSensitivities.length > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-10">
      <AccountPicker accounts={accounts} selected={account.id} path="/dashboard/settings" />
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold">Inscribe your ward</h1>
        <Link href="/dashboard" className="text-sm underline">
          Back to your comments
        </Link>
      </header>

      {/* What's happening right now, in a sentence, before any controls. */}
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Right now
        </p>
        <p className="mt-1">{summary}</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Choose the strength of your ward</h2>
          <p className="text-sm text-[var(--color-muted)]">
            One click sets everything. You can change it whenever you like, and it applies to
            what&rsquo;s already waiting in your queue.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PRESETS.map((p) => {
            const isCurrent =
              policy.surfaceAtOrAbove === p.values.surfaceAtOrAbove &&
              policy.autoHideAtOrAbove === p.values.autoHideAtOrAbove &&
              policy.identityAttackAction === p.values.identityAttackAction &&
              policy.blurQueueByDefault === p.values.blurQueueByDefault &&
              JSON.stringify(Object.entries(policy.categoryOverrides).sort()) === JSON.stringify(Object.entries(p.values.categoryOverrides).sort());
            return (
              <SettingsForm action={applyPreset} key={p.id} success="Protection level updated.">
                <input type="hidden" name="creatorId" value={policy.creatorId} />
                <input type="hidden" name="preset" value={p.id} />
                <button
                  type="submit"
                  className={`card card-interactive w-full space-y-1 p-4 text-left ${
                    isCurrent ? "border-[var(--color-accent)]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    {isCurrent ? (
                      <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-medium text-[var(--color-bg)]">
                        current
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm">{p.tagline}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{p.forWho}</span>
                </button>
              </SettingsForm>
            );
          })}
        </div>
      </section>

      <SettingsForm action={save} className="space-y-8">
        <input type="hidden" name="creatorId" value={policy.creatorId} />

        {/* The one thing worth asking everyone, kept outside the advanced panel. */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">What needs a little extra protection?</h2>
          <p className="max-w-prose text-sm text-[var(--color-muted)]">
            If people come after you for something specific, tick it and we&rsquo;ll treat those
            comments as attacks on <em>you</em> — not as general rudeness that has to be bad
            enough first. These details are sent to your chosen comment reader to help it understand context. Share only what you’re comfortable including.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COMMON_IDENTITIES.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="identity"
                  value={id}
                  defaultChecked={policy.protectedIdentities.includes(id)}
                />
                <span>{id}</span>
              </label>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--color-muted)]">
              Anything else, in your own words — one per line
            </span>
            <textarea
              name="identitiesOther"
              rows={2}
              defaultValue={policy.protectedIdentities
                .filter((i) => !COMMON_IDENTITIES.includes(i))
                .join("\n")}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-sm"
            />
          </label>
          <div className="space-y-2 pt-1">
            <p className="text-sm">When someone does that:</p>
            {(
              [
                ["hide", "Hide it — don't show me", "You can still look at what was hidden."],
                ["surface", "Show it to me", "Some people want to see it, or need it to report."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="identityAttackAction"
                  value={value}
                  defaultChecked={policy.identityAttackAction === value}
                  className="mt-1"
                />
                <span>
                  {label}
                  <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Choose how much to unveil</h2>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="blurQueueByDefault"
              defaultChecked={policy.blurQueueByDefault}
              className="mt-1"
            />
            <span>
              Don&rsquo;t show me the actual comments
              <span className="block text-xs text-[var(--color-muted)]">
                You get a short description of each one instead, so you can clear the whole queue
                without reading any of it. Tap any comment to see it if you want.
              </span>
            </span>
          </label>
          <input type="hidden" name="quietMode" value={policy.quietMode ? "on" : "off"} />
          <p className="text-xs text-[var(--color-muted)]">Email and push notifications aren’t available yet. Check Your comments for updates.</p>
        </section>

        {/* Everything below is optional. Collapsed so the page reads as four
            short decisions rather than a control panel. */}
        <details className="card" open={fineTuned}>
          <summary className="cursor-pointer list-none p-4">
            <span className="font-medium">Fine-tune</span>
            <span className="block text-sm text-[var(--color-muted)]">
              Exact levels, specific kinds of comment, and particular people. Most people never
              need to open this.
            </span>
          </summary>

          <div className="space-y-8 border-t border-[var(--color-line)] p-4">
            <fieldset className="space-y-3">
              <legend className="font-medium">Show me, and worse</legend>
              <p className="text-sm text-[var(--color-muted)]">
                Anything milder than this never reaches your queue.
              </p>
              <div className="space-y-2">
                {SEVERITIES.filter((s) => s !== "benign").map((s) => (
                  <label key={s} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="surfaceAtOrAbove"
                      value={s}
                      defaultChecked={policy.surfaceAtOrAbove === s}
                    />
                    <span className="capitalize">{BAND_WORD[s]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="font-medium">Hide without asking, and worse</legend>
              <p className="text-sm text-[var(--color-muted)]">
                Hidden after the comment reader checks it. If we aren&rsquo;t confident, we ask you instead.
              </p>
              <div className="space-y-2">
                {SEVERITIES.filter((s) => s !== "benign").map((s) => (
                  <label key={s} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="autoHideAtOrAbove"
                      value={s}
                      defaultChecked={policy.autoHideAtOrAbove === s}
                    />
                    <span className="capitalize">{BAND_WORD[s]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="font-medium">Specific kinds of comment</legend>
              <p className="text-sm text-[var(--color-muted)]">
                These beat the levels above. Use them when one particular thing doesn&rsquo;t fit
                the general rule.
              </p>
              <div className="card divide-y divide-[var(--color-line)]">
                {CATEGORY_UI.map((c) => (
                  <div key={c.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{c.label}</p>
                      <p className="text-xs text-[var(--color-muted)]">{c.hint}</p>
                    </div>
                    <select
                      name={`cat:${c.key}`}
                      defaultValue={policy.categoryOverrides[c.key] ?? ""}
                      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 text-sm"
                    >
                      {CATEGORY_ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="font-medium">Things you&rsquo;d rather not read about</legend>
              <p className="text-sm text-[var(--color-muted)]">
                In your own words, one per line. For example: &ldquo;my divorce&rdquo;,
                &ldquo;anything about my kid&rdquo;, &ldquo;people bringing up my old job&rdquo;.
              </p>
              <textarea
                name="customSensitivities"
                rows={3}
                defaultValue={policy.customSensitivities.join("\n")}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-sm"
              />
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="font-medium">Particular people</legend>
              <label className="block space-y-1 text-sm">
                <span>Never touch these accounts</span>
                <span className="block text-xs text-[var(--color-muted)]">
                  Friends who roast you affectionately, your own alt, your manager. One per line.
                  Beats every other rule.
                </span>
                <textarea
                  name="allowlistHandles"
                  rows={2}
                  defaultValue={policy.allowlistHandles.join("\n")}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Always hide these accounts</span>
                <span className="block text-xs text-[var(--color-muted)]">
                  Hidden on sight, whatever they write. One per line.
                </span>
                <textarea
                  name="blocklistHandles"
                  rows={2}
                  defaultValue={policy.blocklistHandles.join("\n")}
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5"
                />
              </label>
            </fieldset>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="allowAutoDelete"
                defaultChecked={policy.allowAutoDelete}
                className="mt-1"
              />
              <span>
                Let it delete real threats outright
                <span className="block text-xs text-[var(--color-sev-hate)]">
                  Off by default, and we&rsquo;d leave it off. Deleting can&rsquo;t be undone, the
                  person who wrote it can tell, and it destroys evidence you might want if you
                  ever report them. Hiding already removes it from everyone else&rsquo;s view.
                </span>
              </span>
            </label>
          </div>
        </details>

        <div className="soft-panel flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-[var(--color-muted)]">No inscription is final. Rewrite your boundaries whenever you need.</p><button type="submit" className="btn btn-primary">Save my boundaries</button></div>
      </SettingsForm>
    </main>
  );
}
