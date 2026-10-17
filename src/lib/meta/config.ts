import { getMetaSettings } from "@/lib/settings";

/**
 * Is there a real Meta app behind the connect button?
 *
 * Without this check the OAuth redirect still fires, Instagram can't find an
 * app matching the placeholder client_id, and the user lands on Instagram's
 * generic "Sorry, this page isn't available" — which tells them nothing and
 * looks like our bug. Better to stop at our own door and explain.
 */
export type MetaReadiness =
  | { ready: true }
  | { ready: false; reason: string; detail: string };

const PLACEHOLDER = /^(dev-)?placeholder/i;

export async function metaReadiness(): Promise<MetaReadiness> {
  const m = await getMetaSettings();

  if (!m.appId || !m.appSecret) {
    return {
      ready: false,
      reason: "No Meta app connected yet",
      detail:
        "Instagram requires an approved app before anything can read comments. It's a one-time setup — the steps are below and take about ten minutes.",
    };
  }

  if (PLACEHOLDER.test(m.appId) || PLACEHOLDER.test(m.appSecret)) {
    return {
      ready: false,
      reason: "Still using placeholder credentials",
      detail:
        "The app ID is a placeholder, so Instagram has nothing to match it to and will show a 'page isn't available' error. Paste your real Meta app ID and secret below.",
    };
  }

  if (!m.verifyToken) {
    return {
      ready: false,
      reason: "No webhook verify token",
      detail:
        "Meta needs a shared word to confirm your webhook address. Generate one below — it takes a click.",
    };
  }

  return { ready: true };
}
