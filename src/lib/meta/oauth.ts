/**
 * Instagram Login (not Facebook Login) — the creator authorizes our single
 * Meta app directly from their Instagram professional account. They never
 * create a developer app, never generate a key, never paste a secret.
 *
 * Reading and moderating comments on accounts we don't own requires Advanced
 * Access for instagram_business_manage_comments, which means Meta App Review.
 * Until that clears, only accounts added as testers on our app can connect.
 */

import { getMetaSettings } from "@/lib/settings";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_HOST = "https://graph.instagram.com";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
] as const;

/** Threads lives on its own host and its own scope set. */
const THREADS_AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";

export const THREADS_SCOPES = [
  "threads_basic",
  "threads_manage_replies",
  "threads_read_replies",
] as const;

async function creds(): Promise<{ appId: string; appSecret: string; baseUrl: string }> {
  const m = await getMetaSettings();
  if (!m.appId || !m.appSecret) throw new Error("Meta app credentials are not configured");
  return { appId: m.appId, appSecret: m.appSecret, baseUrl: m.publicBaseUrl };
}

export async function redirectUri(platform: "instagram" | "threads"): Promise<string> {
  const { baseUrl } = await creds();
  return `${baseUrl}/api/auth/${platform}/callback`;
}

/** Where to send the creator when they click "Connect". `state` is CSRF defence. */
export async function authorizeUrl(
  platform: "instagram" | "threads",
  state: string,
): Promise<string> {
  const { appId } = await creds();
  const scopes = platform === "instagram" ? INSTAGRAM_SCOPES : THREADS_SCOPES;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: await redirectUri(platform),
    response_type: "code",
    scope: scopes.join(","),
    state,
  });
  const base = platform === "instagram" ? AUTHORIZE_URL : THREADS_AUTHORIZE_URL;
  return `${base}?${params}`;
}

export type TokenResult = {
  accessToken: string;
  platformUserId: string;
  /** Seconds until expiry, when Meta tells us. */
  expiresIn?: number;
};

/**
 * Step 1 of 2. The code-for-token exchange yields a SHORT-LIVED token
 * (about an hour). On its own that is useless for a background moderator,
 * which is why exchangeForLongLived runs immediately after.
 */
export async function exchangeCode(
  platform: "instagram" | "threads",
  code: string,
): Promise<TokenResult> {
  const url = platform === "instagram" ? TOKEN_URL : THREADS_TOKEN_URL;
  const { appId, appSecret } = await creds();
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: await redirectUri(platform),
    code,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`${platform} code exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; user_id: number | string };
  return { accessToken: json.access_token, platformUserId: String(json.user_id) };
}

/**
 * Step 2 of 2: trade the short-lived token for a 60-day one. This is the
 * token we persist. It must be refreshed before day 60 or the creator
 * silently stops being protected — see worker/refresh.
 */
export async function exchangeForLongLived(
  platform: "instagram" | "threads",
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const host = platform === "instagram" ? GRAPH_HOST : "https://graph.threads.net";
  const grant = platform === "instagram" ? "ig_exchange_token" : "th_exchange_token";
  const { appSecret } = await creds();
  const params = new URLSearchParams({
    grant_type: grant,
    client_secret: appSecret,
    access_token: shortLivedToken,
  });

  const res = await fetch(`${host}/access_token?${params}`);
  if (!res.ok) {
    throw new Error(`${platform} long-lived exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** Long-lived tokens are refreshable once they're at least 24 hours old. */
export async function refreshLongLived(
  platform: "instagram" | "threads",
  token: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const host = platform === "instagram" ? GRAPH_HOST : "https://graph.threads.net";
  const grant = platform === "instagram" ? "ig_refresh_token" : "th_refresh_token";
  const res = await fetch(`${host}/refresh_access_token?${new URLSearchParams({ grant_type: grant, access_token: token })}`);
  if (!res.ok) {
    throw new Error(`${platform} token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}
