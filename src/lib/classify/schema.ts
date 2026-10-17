import { z } from "zod";

export const SEVERITIES = ["benign", "rude", "harassment", "hateful", "threatening"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Ordered weakest to strongest so policy thresholds are a simple index compare. */
const RANK: Record<Severity, number> = {
  benign: 0,
  rude: 1,
  harassment: 2,
  hateful: 3,
  threatening: 4,
};

export function atOrAbove(value: Severity, threshold: Severity): boolean {
  return RANK[value] >= RANK[threshold];
}

export const CATEGORIES = [
  "insult",
  "appearance",
  "identity_hate",
  "sexual_harassment",
  "threat_of_violence",
  "wish_of_harm",
  "doxxing",
  "self_harm_encouragement",
  "spam_or_scam",
  "coordinated_brigading",
  "criticism_not_abuse",
  "custom_sensitivity",
] as const;

export const verdictSchema = z.object({
  /** Echoes the id we sent, so a reordered or partial response still lines up. */
  id: z.string(),
  severity: z.enum(SEVERITIES),
  confidence: z.number().int(),
  categories: z.array(z.enum(CATEGORIES)),
  targetsPhysicalSafety: z.boolean(),
  summary: z.string(),
});

export const batchVerdictSchema = z.object({ verdicts: z.array(verdictSchema) });

export type Verdict = z.infer<typeof verdictSchema>;

/**
 * Hand-written JSON Schema for the API's structured-output constraint.
 * Kept in sync with the zod schema above by the test in classify.test.ts.
 * Note the API's schema subset: no minimum/maximum, no minLength, and
 * additionalProperties:false is required on every object.
 */
export const VERDICT_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The exact id given for this comment." },
          severity: {
            type: "string",
            enum: SEVERITIES,
            description: "Worst-fitting band for this comment.",
          },
          confidence: {
            type: "integer",
            description: "0-100. How sure you are of the severity band. Be honest about ambiguity.",
          },
          categories: {
            type: "array",
            items: { type: "string", enum: CATEGORIES },
            description: "All that apply. Empty for benign.",
          },
          targetsPhysicalSafety: {
            type: "boolean",
            description:
              "True only for a credible threat of real-world harm to a real person, not for generic abuse or hyperbole.",
          },
          summary: {
            type: "string",
            description:
              "One clinical clause describing the comment WITHOUT repeating slurs, threats, or graphic content. This is what the creator reads instead of the comment.",
          },
        },
        required: ["id", "severity", "confidence", "categories", "targetsPhysicalSafety", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;
