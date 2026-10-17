import { requireOwner } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

/** Polled by the setup page so it can notice Ollama appearing, without a reload. */
export async function GET() {
  await requireOwner();
  const { baseUrl, model, provider } = await getSettings();
  if (provider !== "ollama") return NextResponse.json({ running: false, models: [] });
  const host = baseUrl ?? "http://127.0.0.1:11434";

  try {
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return NextResponse.json({ running: false, models: [] });

    const json = (await res.json()) as { models?: { name: string }[] };
    const models = (json.models ?? []).map((m) => m.name);
    return NextResponse.json({
      running: true,
      models,
      hasModel: models.some((n) => n === model || n === `${model}:latest`),
    });
  } catch {
    return NextResponse.json({ running: false, models: [] });
  }
}
