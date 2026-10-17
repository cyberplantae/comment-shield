import type { Severity } from "./classify/schema";
import type { CategoryAction } from "./rules";

/**
 * Most people don't want to configure a moderation policy — they want to say
 * roughly how protected they'd like to be and get on with their day. These
 * are the four answers that actually differ in practice; everything finer is
 * behind "Fine-tune" for the people who want it.
 */
export type Preset = {
  id: string;
  name: string;
  tagline: string;
  /** Who this is for, in their words, not ours. */
  forWho: string;
  values: {
    surfaceAtOrAbove: Severity;
    autoHideAtOrAbove: Severity;
    identityAttackAction: "surface" | "hide";
    categoryOverrides: Record<string, CategoryAction>;
    blurQueueByDefault: boolean;
  };
};

export const PRESETS: Preset[] = [
  {
    id: "shield",
    name: "Shield me",
    tagline: "Hide anything cruel. Only show me what's borderline.",
    forWho: "You're in the middle of a pile-on and you want it to stop.",
    values: {
      surfaceAtOrAbove: "rude",
      autoHideAtOrAbove: "harassment",
      identityAttackAction: "hide",
      categoryOverrides: { spam_or_scam: "ignore", self_harm_encouragement: "hide" },
      blurQueueByDefault: true,
    },
  },
  {
    id: "balanced",
    name: "Balanced",
    tagline: "Hide slurs and threats. Show me the rest so I can decide.",
    forWho: "Normal weeks. This is where most people land.",
    values: {
      surfaceAtOrAbove: "rude",
      autoHideAtOrAbove: "hateful",
      identityAttackAction: "hide",
      categoryOverrides: { spam_or_scam: "ignore" },
      blurQueueByDefault: true,
    },
  },
  {
    id: "thickskin",
    name: "I can take it",
    tagline: "Only hide threats and slurs. Show me every insult.",
    forWho: "You want the mean stuff. You just don't want to be unsafe.",
    values: {
      surfaceAtOrAbove: "rude",
      autoHideAtOrAbove: "threatening",
      identityAttackAction: "surface",
      categoryOverrides: { insult: "surface", criticism_not_abuse: "surface" },
      blurQueueByDefault: false,
    },
  },
  {
    id: "safety",
    name: "Only the serious stuff",
    tagline: "Don't bother me with rudeness. Flag threats and doxxing.",
    forWho: "Insults bounce off you, but you want to know if someone crosses a line.",
    values: {
      surfaceAtOrAbove: "harassment",
      autoHideAtOrAbove: "threatening",
      identityAttackAction: "surface",
      categoryOverrides: { insult: "ignore", criticism_not_abuse: "ignore", spam_or_scam: "ignore" },
      blurQueueByDefault: false,
    },
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Plain words for the severity bands, used everywhere a creator reads them. */
export const BAND_WORD: Record<Severity, string> = {
  benign: "fine",
  rude: "mean",
  harassment: "harassment",
  hateful: "hate and slurs",
  threatening: "threats",
};

/**
 * One sentence describing what the current settings actually do, shown live
 * above the controls. Thresholds are much easier to get right when you can
 * read back what you just chose.
 */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function describePolicy(p: {
  surfaceAtOrAbove: Severity;
  autoHideAtOrAbove: Severity;
  identityAttackAction: "surface" | "hide";
  protectedIdentities: string[];
}): string {
  const parts: string[] = [];
  parts.push(
    `We'll hide ${BAND_WORD[p.autoHideAtOrAbove]} — and anything worse — without asking you.`,
  );

  if (p.surfaceAtOrAbove === p.autoHideAtOrAbove) {
    parts.push(`Nothing milder reaches your queue at all.`);
  } else {
    parts.push(
      `${sentenceCase(BAND_WORD[p.surfaceAtOrAbove])} comments go to your queue so you can decide.`,
    );
  }

  if (p.protectedIdentities.length > 0) {
    parts.push(
      p.identityAttackAction === "hide"
        ? `Attacks on ${p.protectedIdentities.length === 1 ? "what you listed" : "the things you listed"} are always hidden.`
        : `Attacks on what you listed are always shown to you.`,
    );
  }

  return parts.join(" ");
}
