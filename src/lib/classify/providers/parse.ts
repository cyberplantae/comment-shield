import { batchVerdictSchema, type Verdict } from "../schema";

/**
 * Shared post-processing. Both providers are constrained to a JSON schema, but
 * "constrained" means different things to a hosted model and a 7B running
 * locally, so every response is still validated and filtered here.
 */
export function parseVerdicts(raw: string, requestedIds: string[]): Map<string, Verdict> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Small models sometimes wrap JSON in prose or a code fence.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`classifier returned no parseable JSON: ${raw.slice(0, 200)}`);
    json = JSON.parse(match[0]);
  }

  const parsed = batchVerdictSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`classifier output failed validation: ${parsed.error.message}`);
  }

  const requested = new Set(requestedIds);
  const byId = new Map<string, Verdict>();
  let degenerate = 0;

  for (const v of parsed.data.verdicts) {
    // Drop hallucinated ids rather than letting them create orphan rows.
    if (!requested.has(v.id)) continue;

    // A verdict with no confidence never clears the auto-action floor, and one
    // with no summary defeats the point of the queue. The JSON-schema subset
    // can't express "non-empty" or a numeric range, so it's enforced here.
    // Without this a weak model yields a full queue, no hiding, and no error.
    if (v.confidence <= 0 || v.summary.trim() === "") {
      degenerate++;
      continue;
    }

    byId.set(v.id, { ...v, confidence: Math.min(100, v.confidence) });
  }

  if (degenerate > 0 && byId.size === 0) {
    throw new Error(
      `classifier returned ${degenerate} verdict(s) with no confidence or no summary. ` +
        `This model can't produce usable output for this task — try a larger one, or use Claude.`,
    );
  }
  return byId;
}
