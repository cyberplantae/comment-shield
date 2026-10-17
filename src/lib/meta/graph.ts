/**
 * The four comment-moderation calls Meta actually exposes, plus profile lookup.
 * Endpoints and permissions per Meta's Instagram comment-moderation docs:
 *   GET    /{ig-media-id}/comments     read
 *   POST   /{ig-comment-id}            hide/unhide  (hide=true|false)
 *   DELETE /{ig-comment-id}            delete       (irreversible)
 *   POST   /{ig-comment-id}/replies    reply
 */

const GRAPH_HOST = "https://graph.instagram.com";

function version(): string {
  return process.env.META_GRAPH_VERSION ?? "v23.0";
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
    /** Meta's own error subcode, when present — needed to tell apart "already gone" from "no permission". */
    readonly code?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }

  /**
   * The comment no longer exists — the author deleted it, or we already did.
   * Callers treat this as success: the desired end state is reached.
   */
  get isGone(): boolean {
    return this.status === 400 && this.code === 24;
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 4 || this.code === 17 || this.code === 32;
  }

  /** Token revoked, expired, or the creator removed our app. Stop retrying; ask them to reconnect. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 190;
  }
}

async function call(
  path: string,
  init: RequestInit & { token: string; query?: Record<string, string> },
): Promise<unknown> {
  const { token, query, ...rest } = init;
  const params = new URLSearchParams({ ...query, access_token: token });
  const res = await fetch(`${GRAPH_HOST}/${version()}/${path}?${params}`, { ...rest, signal: AbortSignal.timeout(30_000) });

  const body = await res.text();
  if (!res.ok) {
    let code: number | undefined;
    try {
      code = (JSON.parse(body) as { error?: { code?: number } }).error?.code;
    } catch {
      /* non-JSON error body; leave code undefined */
    }
    throw new MetaApiError(`Graph ${rest.method ?? "GET"} ${path} -> ${res.status}`, res.status, body, code);
  }
  return body ? JSON.parse(body) : null;
}

export type IgComment = {
  id: string;
  text: string;
  username?: string;
  timestamp?: string;
  hidden?: boolean;
};

export async function getProfile(token: string): Promise<{ id: string; username: string }> {
  const json = (await call("me", { token, query: { fields: "id,username" } })) as {
    id: string;
    username: string;
  };
  return json;
}

/** Fetch a single comment. Used to hydrate webhook payloads that arrive thin. */
export async function getComment(token: string, commentId: string): Promise<IgComment> {
  return (await call(commentId, {
    token,
    query: { fields: "id,text,username,timestamp,hidden" },
  })) as IgComment;
}

export async function listComments(
  token: string,
  mediaId: string,
  limit = 50,
): Promise<IgComment[]> {
  const json = (await call(`${mediaId}/comments`, {
    token,
    query: { fields: "id,text,username,timestamp,hidden", limit: String(limit) },
  })) as { data?: IgComment[] };
  return json.data ?? [];
}

/**
 * Hide (or unhide) a comment. This is the primary action and the default:
 * it is invisible to the commenter and fully reversible, so a false positive
 * costs the creator nothing but a click.
 */
export async function setHidden(token: string, commentId: string, hidden: boolean): Promise<void> {
  await call(commentId, { token, method: "POST", query: { hide: String(hidden) } });
}

/**
 * Permanently delete. Irreversible, and visible to the author as a removal.
 * Reserved for explicit creator action or an opt-in policy — never a default.
 */
export async function deleteComment(token: string, commentId: string): Promise<void> {
  await call(commentId, { token, method: "DELETE" });
}

export async function replyToComment(
  token: string,
  commentId: string,
  message: string,
): Promise<{ id: string }> {
  return (await call(`${commentId}/replies`, {
    token,
    method: "POST",
    query: { message },
  })) as { id: string };
}

export async function listRecentMedia(token: string): Promise<{ id: string }[]> {
  const result = await call("me/media", { token, query: { fields: "id", limit: "20" } }) as { data?: { id: string }[] };
  return result.data ?? [];
}
/** Bounded polling: recent 20 posts, up to 500 comments per post per check. */
export async function pollComments(token: string, mediaId: string): Promise<IgComment[]> {
  const out: IgComment[] = []; let after: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = await call(`${encodeURIComponent(mediaId)}/comments`, { token, query: { fields: "id,text,username,timestamp,hidden", limit: "100", ...(after ? { after } : {}) } }) as { data?: IgComment[]; paging?: { next?: string; cursors?: { after?: string } } };
    out.push(...(result.data ?? []));
    after = result.paging?.next ? result.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}
