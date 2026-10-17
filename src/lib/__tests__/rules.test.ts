import { describe, it, expect } from "vitest";
import { decide, isPileOn, AUTO_ACTION_MIN_CONFIDENCE, type Policy } from "../rules";
import type { Assessment } from "../rules";

const policy: Policy = {
  autoHideAtOrAbove: "hateful",
  surfaceAtOrAbove: "rude",
  allowAutoDelete: false,
  allowlistHandles: ["bestfriend"],
  blocklistHandles: ["knownharasser"],
  categoryOverrides: {},
  protectedIdentities: [],
  identityAttackAction: "hide",
};

function verdict(over: Partial<Assessment> = {}): Assessment {
  return {
    severity: "benign",
    confidence: 95,
    categories: [],
    targetsPhysicalSafety: false,
    ...over,
  };
}

describe("decide", () => {
  it("leaves benign comments entirely alone", () => {
    expect(decide(verdict(), policy, "someone").action).toBe("ignore");
  });

  it("queues rude comments rather than hiding them", () => {
    // The product promise: criticism keeps reaching the creator.
    expect(decide(verdict({ severity: "rude" }), policy, "critic").action).toBe("queue");
  });

  it("auto-hides at or above the creator's threshold", () => {
    expect(decide(verdict({ severity: "hateful" }), policy, "x").action).toBe("hide");
    expect(decide(verdict({ severity: "threatening" }), policy, "x").action).toBe("hide");
  });

  it("refuses to act automatically when the model is unsure", () => {
    const d = decide(
      verdict({ severity: "threatening", confidence: AUTO_ACTION_MIN_CONFIDENCE - 1 }),
      policy,
      "x",
    );
    expect(d.action).toBe("queue");
  });

  it("lets the allowlist beat even a threatening classification", () => {
    const d = decide(verdict({ severity: "threatening", confidence: 99 }), policy, "BestFriend");
    expect(d.action).toBe("ignore");
  });

  it("normalizes @ and casing on handles", () => {
    expect(decide(verdict(), policy, "@BESTFRIEND").action).toBe("ignore");
    expect(decide(verdict(), policy, "@KnownHarasser").action).toBe("hide");
  });

  it("never deletes unless auto-delete is on AND safety is threatened", () => {
    const threat = verdict({ severity: "threatening", targetsPhysicalSafety: true });
    expect(decide(threat, policy, "x").action).toBe("hide");
    expect(decide(threat, { ...policy, allowAutoDelete: true }, "x").action).toBe("delete");

    // Auto-delete on, but generic abuse rather than a safety threat: still hide.
    const abuse = verdict({ severity: "hateful", targetsPhysicalSafety: false });
    expect(decide(abuse, { ...policy, allowAutoDelete: true }, "x").action).toBe("hide");
  });

  it("respects a creator who wants only the worst hidden and the rest shown", () => {
    const strict: Policy = { ...policy, autoHideAtOrAbove: "threatening", surfaceAtOrAbove: "harassment" };
    expect(decide(verdict({ severity: "rude" }), strict, "x").action).toBe("ignore");
    expect(decide(verdict({ severity: "hateful" }), strict, "x").action).toBe("queue");
    expect(decide(verdict({ severity: "threatening" }), strict, "x").action).toBe("hide");
  });
});

describe("isPileOn", () => {
  it("ignores low-volume noise", () => {
    expect(isPileOn(10, 10)).toBe(false);
  });

  it("ignores a viral post that is mostly positive", () => {
    expect(isPileOn(500, 20)).toBe(false);
  });

  it("fires when a meaningful share of a real volume is abusive", () => {
    expect(isPileOn(200, 60)).toBe(true);
  });
});

describe("re-applying a changed policy", () => {
  // reapplyPolicy() is decide() in a loop over pending rows, so the semantics
  // that matter are pinned here on the pure function.
  it("clears queued items that the new, higher threshold no longer surfaces", () => {
    const before = decide(verdict({ severity: "rude" }), policy, "x");
    expect(before.action).toBe("queue");

    const raised: Policy = { ...policy, surfaceAtOrAbove: "harassment" };
    expect(decide(verdict({ severity: "rude" }), raised, "x").action).toBe("ignore");
  });

  it("hides queued items when the auto-hide threshold comes down", () => {
    const before = decide(verdict({ severity: "harassment" }), policy, "x");
    expect(before.action).toBe("queue");

    const lowered: Policy = { ...policy, autoHideAtOrAbove: "harassment" };
    expect(decide(verdict({ severity: "harassment" }), lowered, "x").action).toBe("hide");
  });

  it("still refuses to auto-act on a low-confidence verdict after a change", () => {
    const lowered: Policy = { ...policy, autoHideAtOrAbove: "rude" };
    expect(decide(verdict({ severity: "harassment", confidence: 40 }), lowered, "x").action).toBe("queue");
  });

  it("clears a queued item once its author is allowlisted", () => {
    const added: Policy = { ...policy, allowlistHandles: ["ragebait_andy"] };
    expect(decide(verdict({ severity: "harassment" }), added, "ragebait_andy").action).toBe("ignore");
  });
});

describe("per-category overrides", () => {
  it("lets someone opt in to reading every insult, even a severe one", () => {
    const wantsInsults: Policy = { ...policy, categoryOverrides: { insult: "surface" } };
    const d = decide(
      verdict({ severity: "hateful", confidence: 99, categories: ["insult"] }),
      wantsInsults,
      "x",
    );
    // Would normally auto-hide at "hateful"; the opt-in keeps it visible.
    expect(d.action).toBe("queue");
  });

  it("lets someone never see a category even when it's mild", () => {
    const noAppearance: Policy = { ...policy, categoryOverrides: { appearance: "hide" } };
    const d = decide(verdict({ severity: "rude", categories: ["appearance"] }), noAppearance, "x");
    expect(d.action).toBe("hide");
  });

  it("drops a category the creator never wants surfaced", () => {
    const noSpam: Policy = { ...policy, categoryOverrides: { spam_or_scam: "ignore" } };
    const d = decide(verdict({ severity: "rude", categories: ["spam_or_scam"] }), noSpam, "x");
    expect(d.action).toBe("ignore");
  });

  it("takes the strongest instruction when categories disagree", () => {
    const mixed: Policy = {
      ...policy,
      categoryOverrides: { insult: "surface", appearance: "hide" },
    };
    const d = decide(
      verdict({ severity: "rude", categories: ["insult", "appearance"] }),
      mixed,
      "x",
    );
    expect(d.action).toBe("hide");
  });

  it("still won't auto-hide an override match it isn't confident about", () => {
    const noAppearance: Policy = { ...policy, categoryOverrides: { appearance: "hide" } };
    const d = decide(
      verdict({ severity: "rude", confidence: 30, categories: ["appearance"] }),
      noAppearance,
      "x",
    );
    expect(d.action).toBe("queue");
  });

  it("leaves untagged comments to the severity levels", () => {
    const withOverride: Policy = { ...policy, categoryOverrides: { insult: "surface" } };
    expect(decide(verdict({ severity: "hateful", categories: [] }), withOverride, "x").action).toBe(
      "hide",
    );
  });
});

describe("protected identities", () => {
  const lgbtq: Policy = {
    ...policy,
    protectedIdentities: ["my sexuality", "being trans"],
    identityAttackAction: "hide",
  };

  it("hides an identity attack that the severity levels alone would only queue", () => {
    // surfaceAtOrAbove is "rude" and autoHide is "hateful", so a merely rude
    // identity jab would normally sit in the queue for them to read.
    const d = decide(verdict({ severity: "rude", categories: ["identity_hate"] }), lgbtq, "x");
    expect(d.action).toBe("hide");
  });

  it("respects a creator who wants to see them instead", () => {
    const wantsToSee: Policy = { ...lgbtq, identityAttackAction: "surface" };
    const d = decide(
      verdict({ severity: "hateful", confidence: 99, categories: ["identity_hate"] }),
      wantsToSee,
      "x",
    );
    expect(d.action).toBe("queue");
  });

  it("does nothing when no identities are listed", () => {
    const d = decide(verdict({ severity: "rude", categories: ["identity_hate"] }), policy, "x");
    expect(d.action).toBe("queue"); // falls through to the severity levels
  });

  it("outranks a category override", () => {
    const conflicting: Policy = { ...lgbtq, categoryOverrides: { identity_hate: "surface" } };
    expect(
      decide(verdict({ severity: "rude", categories: ["identity_hate"] }), conflicting, "x").action,
    ).toBe("hide");
  });

  it("is still beaten by the allowlist", () => {
    const d = decide(
      verdict({ severity: "hateful", categories: ["identity_hate"] }),
      lgbtq,
      "bestfriend",
    );
    expect(d.action).toBe("ignore");
  });

  it("queues rather than hides when unsure it's an identity attack", () => {
    const d = decide(
      verdict({ severity: "hateful", confidence: 45, categories: ["identity_hate"] }),
      lgbtq,
      "x",
    );
    expect(d.action).toBe("queue");
  });
});
