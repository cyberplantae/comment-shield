import type { CategoryAction } from "./rules";

/**
 * Creator-facing labels for the classifier's category tags. The tag names are
 * for code; these are what someone reads at 2am after a post blew up, so they
 * say what the comment is rather than naming a taxonomy.
 */
export const CATEGORY_UI: { key: string; label: string; hint: string }[] = [
  {
    key: "criticism_not_abuse",
    label: "Criticism of your work",
    hint: "Harsh takes on the thing you made, not on you. Shown by default — some people want all of it.",
  },
  { key: "insult", label: "Insults and mockery", hint: "Name-calling, sneering, being talked down to." },
  { key: "appearance", label: "Comments on your appearance", hint: "Your body, face, voice, clothes, ageing." },
  {
    key: "identity_hate",
    label: "Attacks on who you are",
    hint: "Race, religion, disability, gender, sexuality, caste, immigration status.",
  },
  { key: "sexual_harassment", label: "Sexual comments", hint: "Sexual remarks you did not invite." },
  { key: "threat_of_violence", label: "Threats of violence", hint: "Someone saying they will hurt you." },
  { key: "wish_of_harm", label: "Wishing harm on you", hint: "“I hope you get hit by a bus.”" },
  { key: "doxxing", label: "Your private information", hint: "Address, workplace, routine, family, real name." },
  {
    key: "self_harm_encouragement",
    label: "Telling you to hurt yourself",
    hint: "Always hidden by default, and we'd encourage leaving it that way.",
  },
  { key: "spam_or_scam", label: "Spam and scams", hint: "Crypto, bots, follow-for-follow, fake giveaways." },
  {
    key: "coordinated_brigading",
    label: "Pile-on comments",
    hint: "People arriving together from somewhere else to hit the same post.",
  },
];

export const CATEGORY_ACTIONS: { value: CategoryAction | ""; label: string }[] = [
  { value: "", label: "Use my levels above" },
  { value: "surface", label: "Always show me" },
  { value: "hide", label: "Always hide" },
  { value: "ignore", label: "Never show me" },
];

/**
 * Common targets, offered as checkboxes so nobody has to describe their own
 * identity in a free-text box to get protected. The list is a starting point,
 * never a closed set — the UI keeps a free-text field alongside it.
 */
export const COMMON_IDENTITIES = [
  "my race or ethnicity",
  "my religion",
  "my disability",
  "my gender",
  "being trans",
  "my sexuality",
  "my body or weight",
  "my accent or where I'm from",
  "my immigration status",
  "my caste",
  "being neurodivergent",
  "my age",
];
