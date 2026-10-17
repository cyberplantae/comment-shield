import { atOrAbove, type Severity } from "./classify/schema";

/**
 * What the rules engine needs to know about a comment. Deliberately looser
 * than the classifier's Verdict (categories are plain strings) so stored rows
 * can be re-evaluated without round-tripping through the classifier's enums.
 * A Verdict is assignable to this.
 */
export type Assessment = {
  severity: Severity;
  confidence: number;
  categories: readonly string[];
  targetsPhysicalSafety: boolean;
};

/** Per-category intent, independent of how severe the comment is. */
export type CategoryAction = "ignore" | "surface" | "hide";

export type Policy = {
  autoHideAtOrAbove: Severity;
  surfaceAtOrAbove: Severity;
  allowAutoDelete: boolean;
  allowlistHandles: string[];
  blocklistHandles: string[];
  categoryOverrides: Record<string, CategoryAction>;
  protectedIdentities: string[];
  identityAttackAction: "surface" | "hide";
};

export type Decision = {
  action: "hide" | "delete" | "queue" | "ignore";
  reason: string;
  /** Pile-on alerting keys off this rather than re-deriving severity. */
  countsAsFlagged: boolean;
};

/**
 * Confidence floor for acting without a human. Below this we always queue,
 * however severe the band — an uncertain "threatening" is exactly the case
 * where a person should look, not a case for a confident machine action.
 */
export const AUTO_ACTION_MIN_CONFIDENCE = 70;

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@/, "").toLowerCase();
}

/**
 * When a comment carries several overridden categories, the strongest
 * instruction wins. "hide" is strongest because it is the one the creator
 * chose in order to never see something; "surface" beats "ignore" because
 * being shown too much is recoverable and being silently filtered is not.
 */
const OVERRIDE_RANK: Record<CategoryAction, number> = { ignore: 0, surface: 1, hide: 2 };

function strongestOverride(
  categories: readonly string[],
  overrides: Record<string, CategoryAction>,
): { action: CategoryAction; category: string } | null {
  let best: { action: CategoryAction; category: string } | null = null;
  for (const c of categories) {
    const action = overrides[c];
    if (!action) continue;
    if (!best || OVERRIDE_RANK[action] > OVERRIDE_RANK[best.action]) {
      best = { action, category: c };
    }
  }
  return best;
}

/**
 * Pure function: verdict + policy -> action. Kept free of I/O so the policy
 * semantics creators depend on are directly testable.
 *
 * Precedence, highest first:
 *   1. allowlisted author          - never touch, whatever it says
 *   2. blocklisted author          - always hide
 *   3. attack on a protected identity
 *   4. per-category override
 *   5. severity thresholds
 * The confidence floor applies to every automatic hide, at any level.
 */
export function decide(
  verdict: Assessment,
  policy: Policy,
  author: string | null | undefined,
): Decision {
  const handle = author ? normalizeHandle(author) : null;

  // The allowlist wins over everything, including a threatening classification.
  // If a creator says "never touch my sister's account", a false positive on
  // an inside joke must not hide her comment.
  if (handle && policy.allowlistHandles.some((h) => normalizeHandle(h) === handle)) {
    return { action: "ignore", reason: "author is allowlisted", countsAsFlagged: false };
  }

  if (handle && policy.blocklistHandles.some((h) => normalizeHandle(h) === handle)) {
    return { action: "hide", reason: "author is blocklisted", countsAsFlagged: true };
  }

  // An attack on something the creator told us they get targeted over.
  // This sits above the category grid: it is the most personal setting in
  // the product and should not be silently outvoted by a generic rule.
  const isIdentityAttack =
    policy.protectedIdentities.length > 0 && verdict.categories.includes("identity_hate");

  if (isIdentityAttack) {
    if (policy.identityAttackAction === "surface") {
      return { action: "queue", reason: "attack on a protected identity", countsAsFlagged: true };
    }
    if (verdict.confidence < AUTO_ACTION_MIN_CONFIDENCE) {
      return {
        action: "queue",
        reason: `possible identity attack, only ${verdict.confidence}% confident; needs a human`,
        countsAsFlagged: true,
      };
    }
    return { action: "hide", reason: "attack on a protected identity", countsAsFlagged: true };
  }

  const override = strongestOverride(verdict.categories, policy.categoryOverrides);
  if (override) {
    if (override.action === "ignore") {
      return {
        action: "ignore",
        reason: `you asked never to be shown ${override.category}`,
        countsAsFlagged: false,
      };
    }
    if (override.action === "surface") {
      // Explicitly opted in to reading these — never auto-hide them.
      return {
        action: "queue",
        reason: `you asked to see ${override.category}`,
        countsAsFlagged: true,
      };
    }
    if (verdict.confidence < AUTO_ACTION_MIN_CONFIDENCE) {
      return {
        action: "queue",
        reason: `possible ${override.category}, only ${verdict.confidence}% confident; needs a human`,
        countsAsFlagged: true,
      };
    }
    return {
      action: "hide",
      reason: `you asked to always hide ${override.category}`,
      countsAsFlagged: true,
    };
  }

  const flagged = atOrAbove(verdict.severity, policy.surfaceAtOrAbove);

  const meetsHideBand = atOrAbove(verdict.severity, policy.autoHideAtOrAbove);

  if (!flagged && !meetsHideBand) {
    return { action: "ignore", reason: `below ${policy.surfaceAtOrAbove}`, countsAsFlagged: false };
  }

  if (meetsHideBand && verdict.confidence < AUTO_ACTION_MIN_CONFIDENCE) {
    return {
      action: "queue",
      reason: `${verdict.severity} but only ${verdict.confidence}% confident; needs a human`,
      countsAsFlagged: true,
    };
  }

  if (meetsHideBand) {
    // Deletion is opt-in and additionally gated on a credible safety threat,
    // because it is the one action that cannot be undone and that the
    // commenter can see. Everything else hides: silent and reversible.
    if (policy.allowAutoDelete && verdict.targetsPhysicalSafety) {
      return {
        action: "delete",
        reason: "credible safety threat, auto-delete enabled",
        countsAsFlagged: true,
      };
    }
    return {
      action: "hide",
      reason: `${verdict.severity} at or above auto-hide threshold (${policy.autoHideAtOrAbove})`,
      countsAsFlagged: true,
    };
  }

  return {
    action: "queue",
    reason: `${verdict.severity}: surfaced for review`,
    countsAsFlagged: true,
  };
}

/**
 * Pile-on detection. Not a severity question but a velocity one: the signal
 * that a creator is being brigaded is the *share* of incoming comments that
 * are abusive spiking, not the raw count, which rises with any viral post.
 */
export const PILE_ON = {
  minComments: 25,
  flaggedShare: 0.25,
} as const;

export function isPileOn(totalComments: number, flaggedComments: number): boolean {
  if (totalComments < PILE_ON.minComments) return false;
  return flaggedComments / totalComments >= PILE_ON.flaggedShare;
}
