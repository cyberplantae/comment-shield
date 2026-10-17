/**
 * Threads reply management. The reason Threads ships first:
 * `manage_reply` hides a reply after the fact, exactly like Instagram — but
 * Threads additionally supports *reply approvals*, where a reply is held
 * pending and never becomes public until approved. For a tool whose whole
 * promise is "you don't have to read it", a pre-publication gate beats
 * cleanup after the creator has already seen the notification.
 */

const HOST = "https://graph.threads.net";

function version(): string {
  return process.env.META_GRAPH_VERSION ?? "v1.0";
}

async function call(
  path: string,
  init: RequestInit & { token: string; query?: Record<string, string> },
): Promise<unknown> {
  const { token, query, ...rest } = init;
  const params = new URLSearchParams({ ...query, access_token: token });
  const res = await fetch(`${HOST}/${version()}/${path}?${params}`, rest);
  const body = await res.text();
  if (!res.ok) throw new Error(`Threads ${rest.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

/** Hide or unhide a reply. Hiding cascades to the whole nested subtree. */
export async function manageReply(token: string, replyId: string, hide: boolean): Promise<void> {
  await call(`${replyId}/manage_reply`, { token, method: "POST", query: { hide: String(hide) } });
}

/** Replies held back by reply-approval, awaiting a decision. */
export async function listPendingReplies(
  token: string,
  mediaId: string,
): Promise<{ id: string; text: string; username?: string; timestamp?: string }[]> {
  const json = (await call(`${mediaId}/pending_replies`, {
    token,
    query: { fields: "id,text,username,timestamp" },
  })) as { data?: { id: string; text: string; username?: string; timestamp?: string }[] };
  return json.data ?? [];
}

/** Approve or reject a pending reply. Rejected replies never become public. */
export async function managePendingReply(
  token: string,
  replyId: string,
  approve: boolean,
): Promise<void> {
  await call(`${replyId}/manage_pending_reply`, {
    token,
    method: "POST",
    query: { approve: String(approve) },
  });
}
