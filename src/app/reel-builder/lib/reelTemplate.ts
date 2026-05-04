// Visual constants + shared types for the Reel Builder. Mirrors the
// look of the Post Builder's cover slide (dark background, centered
// hook, profile row) but at 9:16 portrait (1080×1920) for Instagram
// Reels instead of 4:5 (1080×1350).
//
// We deliberately do NOT import from the Post Builder template — per
// spec, Reel Builder is a separate feature. Visual parity is achieved
// by mirroring the same color palette and font treatment, not by
// sharing files.

// 9:16 portrait, the IG Reel cover spec.
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

// Two reel background palettes — navy and forest. Each variation can
// optionally override its bg, but by default we cycle navy→forest→navy
// across the 3 variations so the user has visual differentiation even
// when the headlines are similar in tone.
export type ReelBg = "navy" | "forest";

export interface ReelBgPalette {
  // CSS color for the page background.
  bg: string;
  // Default text color.
  text: string;
  // Muted subtitle / handle color.
  muted: string;
  // Accent color for **bolded** spans inside the hook (Instagram
  // doesn't render markdown, but we DO render the bold visually on
  // the cover image so the user can lean on the same emphasis cue
  // they use in Post Builder).
  accent: string;
  // Verified-check ring background.
  checkBg: string;
}

export const REEL_BG_PALETTES: Record<ReelBg, ReelBgPalette> = {
  navy: {
    bg: "#0A1628",
    text: "#FFFFFF",
    muted: "#9DB2C7",
    accent: "#5DADE2",
    checkBg: "#1D4ED8",
  },
  forest: {
    bg: "#0A2818",
    text: "#FFFFFF",
    muted: "#A6C2A6",
    accent: "#E8B042",
    checkBg: "#1D4ED8",
  },
};

// One of the 5 hook angles the API picks from. Surfaced as a label
// under each variation card so the user can see at a glance what
// flavor each variation is.
export type ReelHookAngle =
  | "counter-intuitive"
  | "list-promise"
  | "specific-number"
  | "news-driven"
  | "question";

export const HOOK_ANGLE_LABELS: Record<ReelHookAngle, string> = {
  "counter-intuitive": "Counter-intuitive",
  "list-promise": "List promise",
  "specific-number": "Specific number",
  "news-driven": "News-driven",
  question: "Question",
};

// One generated variation. Returned by the API in groups of 3.
export interface ReelVariation {
  angle: ReelHookAngle;
  hookHeadline: string;
  hookSubtitle: string;
  caption: string;
}

export interface ReelGenerationResult {
  variations: ReelVariation[];
}

// Hard cap for IG captions (officially 2,200). Soft cap shown in the
// UI as the safe target. Past 2,000 we warn (yellow), past 2,200 we
// truncate at the last full sentence.
export const CAPTION_HARD_CAP = 2200;
export const CAPTION_SOFT_CAP = 2000;

// Max headline length / words. Mirrors Post Builder cover constraints
// so reels read with the same compression.
export const HEADLINE_MAX_CHARS = 40;
export const HEADLINE_MAX_WORDS = 7;
export const HEADLINE_MAX_WORD_CHARS = 12;
export const SUBTITLE_MAX_CHARS = 60;

// Pick a default bg for a variation index so each card looks visually
// distinct even when the API didn't override.
export function defaultBgForIndex(i: number): ReelBg {
  return i % 2 === 0 ? "navy" : "forest";
}

// Truncate a caption at the last full sentence before the hard cap.
// Used when the model overshoots — we never present an over-cap
// caption to the user.
export function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  // Look for the last sentence terminator in the truncated chunk.
  const candidates = [".", "!", "?", "\n\n"];
  let cutAt = -1;
  for (const t of candidates) {
    const i = slice.lastIndexOf(t);
    if (i > cutAt) cutAt = i;
  }
  if (cutAt > 0) return slice.slice(0, cutAt + 1).trimEnd() + "…";
  return slice.trimEnd() + "…";
}
