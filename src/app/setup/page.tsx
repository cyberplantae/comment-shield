import { requireOwner } from "@/lib/auth";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { runChecks, estimateCatalog, activeChoice, type Check } from "@/lib/setup";
import { PRICE_CHECKED_ON, TIER_UI } from "@/lib/classify/catalog";
import { getSettings, saveSettings, keyPresence, getMetaSettings } from "@/lib/settings";
import { metaReadiness } from "@/lib/meta/config";
import { ClassifierForm } from "./ClassifierForm";
import { MetaSetup } from "./MetaSetup";
import { SettingsForm } from "@/app/components/SettingsForm";
import { RefreshButton } from "@/app/components/RefreshButton";
import { OllamaSetup } from "./OllamaSetup";

export const dynamic = "force-dynamic";

const DOT: Record<Check["status"], string> = {
  ok: "bg-[var(--color-accent)]",
  warn: "bg-[var(--color-sev-mean)]",
  fail: "bg-[var(--color-sev-hate)]",
};



export default async function Setup() {
  const desktop = process.env.SHIELD_DESKTOP === "1";
  const checks = await runChecks();
  const ready = checks.every((c) => c.status !== "fail");
  const { provider: activeProvider, model: active } = await activeChoice();
  const settings = await getSettings();
  const hasKey = await keyPresence();
  const priced = estimateCatalog(10_000);
  const meta = await getMetaSettings();
  const metaReady = (await metaReadiness()).ready;

  async function saveMeta(formData: FormData) {
    "use server";
    await requireOwner();
    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" ? v.trim() : undefined;
    };
    await saveSettings({
      metaAppId: str("metaAppId"),
      metaAppSecret: str("metaAppSecret"),
      publicBaseUrl: str("publicBaseUrl"),
    });
    revalidatePath("/setup");
    revalidatePath("/connect");
  }

  async function save(formData: FormData) {
    "use server";
    await requireOwner();
    const choice = formData.get("choice");
    if (typeof choice !== "string") return;
    const [provider, ...rest] = choice.split(":");
    if (provider !== "anthropic" && provider !== "openai" && provider !== "ollama") return;

    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };

    await saveSettings({
      provider,
      model: rest.join(":"),
      effort: str("effort"),
      anthropicKey: str("anthropicKey"),
      openaiKey: str("openaiKey"),
      openaiBaseUrl: str("openaiBaseUrl"),
      ollamaHost: str("ollamaHost"),
    });

    revalidatePath("/setup");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{desktop ? "Choose your familiar" : "The book of wards"}</h1>
        <p className="max-w-prose text-[var(--color-muted)]">
          Your familiar is the AI reader that helps review comments. Choose where it runs, follow the connection steps, then test it before starting your ward.
        </p>
      </div>

      <section className="soft-panel space-y-4 p-6">
        <h2 className="text-2xl">Before the first casting</h2>
        <p className="text-sm text-[var(--color-muted)]">{desktop ? "Start with the reader options below. Ollama runs on your computer; online readers send comments to the provider you choose." : metaReady ? "Your app settings are saved. Next, sign in with the account you want to use." : "Your ward’s foundations are not yet complete. Follow the guided setup below, one page at a time."}</p>
        <div className="flex flex-wrap gap-3"><Link href={process.env.SHIELD_DESKTOP === "1" ? "/desktop" : metaReady ? "/connect" : "#instagram-setup"} className="btn btn-primary">{process.env.SHIELD_DESKTOP === "1" ? "Back to my spellbook" : metaReady ? "Connect Instagram →" : "Start Instagram setup →"}</Link><Link href="/dashboard/settings" className="btn btn-quiet">Choose my boundaries</Link></div>
      </section>
      <details className="card p-5"><summary className="cursor-pointer text-sm">Connection checks & troubleshooting {ready ? "— checks passed" : "— needs attention"}</summary><div className="mt-4 space-y-4">
        <ul className="card divide-y divide-[var(--color-line)]">
          {checks.map((c) => (
            <li key={c.name} className="flex gap-3 p-4">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[c.status]}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-sm text-[var(--color-muted)]">{c.detail}</p>
                {c.fix ? <p className="mt-1 text-sm">{c.fix}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        <RefreshButton label="Check setup again" />
      </div></details>

      <details className="card p-5" open={desktop}>
        <summary className="cursor-pointer"><span className="text-lg font-semibold">I. Choose your familiar</span><span className="block text-sm text-[var(--color-muted)]">Your familiar is the AI reader that reviews comments. Choose a service and connect it here.</span></summary>
        <div className="space-y-5 pt-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">A reader for your ward</h2>
          <p className="max-w-prose text-[var(--color-muted)]">
            Your comment reader helps spot comments that cross your boundaries. Keep the current choice, or open the options to choose a different service.
          </p>
        </div>

        <form id="classifier-form" action={save} />

        <ClassifierForm
          rows={priced.map((r) => ({
            id: r.id,
            provider: r.provider,
            model: r.model,
            label: r.label,
            tier: TIER_UI[r.tier].name,
            judgment: r.judgment,
            cost: r.cost,
            standalone: r.standalone,
            note: r.note,
          }))}
          activeProvider={activeProvider}
          activeModel={active}
          hasKey={hasKey}
          effort={settings.effort}
          ollamaHost={settings.provider === "ollama" ? (settings.baseUrl ?? "http://127.0.0.1:11434") : "http://127.0.0.1:11434"}
          openaiBaseUrl={
            settings.provider === "openai"
              ? (settings.baseUrl ?? "https://api.openai.com/v1")
              : "https://api.openai.com/v1"
          }
        />

        {settings.provider === "ollama" ? <OllamaSetup model={settings.model} /> : null}

        <p className="text-xs text-[var(--color-faint)]">
          Prices are per 10,000 comments — roughly one post that genuinely takes off — estimated
          from average comment length. Checked against each vendor&rsquo;s own pricing page on{" "}
          {PRICE_CHECKED_ON}; they change, so treat these as a ballpark, not a quote. You pay the
          vendor directly — your key is stored by this installation; billing stays with your provider.
        </p>
        </div>
      </details>

      {process.env.SHIELD_DESKTOP !== "1" && <details className="card p-5" id="instagram-setup" open={!metaReady}>
        <summary className="cursor-pointer"><span className="text-lg font-semibold">II. Open the Instagram gate</span><span className="block text-sm text-[var(--color-muted)]">For the installation owner. You only need to do this once.</span></summary>
        <div className="space-y-4 pt-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Connect the app to Instagram</h2>
          <p className="max-w-prose text-[var(--color-muted)]">
            Keep this page open while you follow the steps on Meta’s site. Copy buttons help you move the connection details between the two.
          </p>
        </div>

        <SettingsForm id="meta-form" action={saveMeta} success="Connection details saved. Continue with the next step; saving does not connect your Instagram account yet.">

        <MetaSetup
          ready={metaReady}
          appId={meta.appId ?? ""}
          hasSecret={Boolean(meta.appSecret)}
          verifyToken={meta.verifyToken ?? ""}
          publicBaseUrl={meta.publicBaseUrl}
          redirectUri={meta.redirectUri}
          webhookUrl={meta.webhookUrl}
        />
        </SettingsForm>
        </div>
      </details>}
      <div className="soft-panel flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-xl">III. Inscribe your boundaries</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Choose what your ward should hide, and what it should bring to you for review.</p></div><Link href={desktop ? "/dashboard/settings" : "/connect"} className="btn btn-primary">{desktop ? "Choose my boundaries" : "Continue to Instagram"}</Link></div>
    </main>
  );
}
