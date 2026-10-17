import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * Pull a model into the user's local Ollama, streaming progress straight
 * through to the browser.
 *
 * Installing Ollama itself needs a terminal — a web page can't install
 * software. But once it's running, downloading a model is just an API call,
 * so there's no reason to make someone copy another command for it.
 */
export async function POST(request: Request) {
  await requireOwner();
  const { baseUrl, provider, model: selectedModel } = await getSettings();
  if (provider !== "ollama") return Response.json({ error: "Select a local reader first" }, { status: 409 });
  const host = baseUrl ?? "http://127.0.0.1:11434";

  const body = (await request.json().catch(() => ({}))) as { model?: string };
  const model = body.model;
  if (typeof model !== "string" || model !== selectedModel) {
    return new Response(JSON.stringify({ error: "no model given" }), { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${host}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: `Couldn't reach Ollama at ${host}. Is it running?` }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Ollama replied ${upstream.status}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Ollama emits newline-delimited JSON progress objects; pass them through
  // untouched and let the client render them.
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
