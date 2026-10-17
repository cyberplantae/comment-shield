import { requireOwner } from "@/lib/auth";
import { NextResponse } from "next/server";
import { checkClassifier, resolveClassifier } from "@/lib/classify";

/** Live check of whatever is currently saved, for the Test button on /setup. */
export async function POST() {
  await requireOwner();
  try {
    const { providerId, model } = await resolveClassifier();
    const result = await checkClassifier();
    return NextResponse.json(
      result.ok
        ? { ok: true, message: `${providerId} / ${model} — ${result.detail}` }
        : { ok: false, message: `${providerId} / ${model} — ${result.error}` },
    );
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
