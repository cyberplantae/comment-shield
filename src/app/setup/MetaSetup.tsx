"use client";

import { useEffect, useState } from "react";
import { StepGuide } from "./StepGuide";

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked; the value is visible to select by hand */
        }
      }}
      className="btn btn-quiet shrink-0 px-2.5 py-1 text-xs"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--color-raised)] p-2.5 text-xs">
          {value}
        </code>
        <Copy text={value} />
      </div>
    </div>
  );
}

/**
 * The Meta app walkthrough.
 *
 * Every value Meta's console asks for is generated here with a copy button,
 * so the job is reduced to pasting between two browser tabs. The two URLs in
 * particular have to match byte for byte — people lose hours to a trailing
 * slash — so they are never asked to type them.
 */
export function MetaSetup({
  ready,
  appId,
  hasSecret,
  verifyToken,
  publicBaseUrl,
  redirectUri,
  webhookUrl,
}: {
  ready: boolean;
  appId: string;
  hasSecret: boolean;
  verifyToken: string;
  publicBaseUrl: string;
  redirectUri: string;
  webhookUrl: string;
}) {
  const [open, setOpen] = useState(!ready);
  const [token, setToken] = useState(verifyToken);

  // Generated on first ask rather than during render — a Server Component
  // can't write, so doing it there leaves this box empty.
  useEffect(() => {
    if (token) return;
    void (async () => {
      try {
        const res = await fetch("/api/meta/verify-token");
        const body = (await res.json()) as { verifyToken?: string };
        if (body.verifyToken) setToken(body.verifyToken);
      } catch {
        /* leave it blank; the check on /setup will still flag it */
      }
    })();
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              ready ? "bg-[var(--color-accent)]" : "bg-[var(--color-sev-mean)]"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {ready ? "Instagram app settings are saved" : "Set up your Instagram connection"}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {ready
                ? "Your Meta app is configured. You can connect accounts now."
                : "For the person running this app. Follow each step, then connect your creator account."}
            </p>
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-quiet">
            {open ? "Hide" : ready ? "Edit" : "Show me how"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="space-y-5">
          <StepGuide>
            <div className="space-y-3">
              <p className="text-sm">
                Create or open your Meta app, then return here for the next step.
              </p>
              <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="btn btn-primary">Open Meta app setup ↗</a>
              <p className="text-sm text-[var(--color-muted)]">Meta may ask you to sign in or register as a developer first.</p>
            </div>

          <div className="space-y-3"><p className="text-sm">In Meta, open App settings → Basic. Copy your App ID and App Secret into these boxes, then save.</p>
            <label className="block space-y-1">
              <span className="text-sm font-medium">App ID</span>
              <input
                name="metaAppId"
                form="meta-form"
                defaultValue={appId}
                placeholder="1234567890123456"
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">App Secret</span>
              <span className="block text-xs text-[var(--color-muted)]">
                {hasSecret
                  ? "Already saved. Leave blank to keep it."
                  : "Stored encrypted and never shown again."}
              </span>
              <input
                type="password"
                name="metaAppSecret"
                form="meta-form"
                autoComplete="off"
                placeholder={hasSecret ? "•••••••• saved" : ""}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Your address</span>
              <span className="block text-xs text-[var(--color-muted)]">
                Where this app is reachable. Change it when you deploy or start a tunnel — the
                connection links in the next steps update to match.
              </span>
              <input
                name="publicBaseUrl"
                form="meta-form"
                defaultValue={publicBaseUrl}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 font-mono text-sm"
              />
            </label>

            <p className="text-sm text-[var(--color-muted)]">Save these details before continuing. If you changed the address, use the updated links in the next two steps.</p>
            <button type="submit" form="meta-form" className="btn btn-primary">
              Save connection details
            </button>
          </div>
            <div className="space-y-3">
              <p className="text-sm">
                Add the{" "}
                <span className="font-medium">Instagram</span> product, and choose{" "}
                <span className="font-medium">Instagram Login</span> — not Facebook Login. Then
                paste this into the OAuth redirect allowlist, exactly as written:
              </p>
              <Field label="Redirect URI" value={redirectUri} />
            </div>

            <div className="space-y-3">
              <p className="text-sm">
                Under Webhooks, subscribe to the{" "}
                <code>comments</code> field using these two values:
              </p>
              <Field label="Callback URL" value={webhookUrl} />
              <Field label="Verify token" value={token || "generating…"} />
              {!publicBaseUrl.startsWith("https://") ? (
                <p className="text-xs text-[var(--color-sev-mean)]">
                  Meta won&rsquo;t accept a localhost address here. When you&rsquo;re ready to
                  receive comments, ask the person hosting this app for its secure public address. Go back to step 2 to save it, then copy the updated values here.
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm">
                In App roles, add your own Instagram
                account as a <span className="font-medium">tester</span>.
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Follow Meta’s tester invitation steps for your account. Connecting other creators may require Meta App Review. Saving settings here does not verify that Meta has approved them.
              </p>
            </div>
          

          </StepGuide>
        </div>
      ) : null}
    </div>
  );
}
