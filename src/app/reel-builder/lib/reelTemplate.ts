// Visual constants + shared types for the Reel Builder. The cover is
// laid out as a 1080×1920 frame split into two zones:
//
//   ┌─────────────────────────┐  y=0
//   │   "See description ↓"   │
//   │      ↓ chevron          │  570px tall — top zone
//   ├─────────────────────────┤  y=570
//   │  Headline (132pt bold)  │
//   │  Subtitle (48pt muted)  │
//   │   ...                   │  1350px tall — Post Builder cover
//   │  [avatar]  Name ✓       │  layout, pixel-identical
//   │            @handle      │
//   └─────────────────────────┘  y=1920
//
// The bottom 1350px duplicates Post Builder's slide-1 cover EXACTLY
// (same padding, same font sizes, same compact profile row at the
// bottom) so when the user posts the rendered MP4 / PNG to Instagram,
// their headline / subtitle / name / handle land in the same visual
// pixels they're used to seeing in a feed post.
//
// Per the original spec, Reel Builder duplicates this layout rather
// than importing from Post Builder's CarouselSlide — keeps the two
// features decoupled.

// 9:16 portrait, the IG Reel cover spec.
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

// The bottom region is a 1080×1350 mirror of the Post Builder cover.
// The top region holds the "See description ↓" CTA. These constants
// are the Post Builder cover's known-good padding values — mirrored
// so the reel and the carousel cover are pixel-aligned.
export const REEL_COVER_HEIGHT = 1350;
export const REEL_TOP_ZONE_HEIGHT = REEL_HEIGHT - REEL_COVER_HEIGHT; // 570
export const COVER_PADDING_TOP = 240;
export const COVER_PADDING_BOTTOM = 380;
export const COVER_PADDING_X = 80;

// Reel palettes mirror the Post Builder cover palettes (dark, navy,
// forest) so a reel and a carousel cover with the same bg key look
// identical. Default is "dark" because the user's reference screenshot
// uses the dark palette.
export type ReelBg = "dark" | "navy" | "forest";

export interface ReelBgPalette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
}

export const REEL_BG_PALETTES: Record<ReelBg, ReelBgPalette> = {
  dark: { bg: "#0F1419", fg: "#FFFFFF", muted: "#9CA3AF", accent: "#5FB4D2" },
  navy: { bg: "#0F2645", fg: "#F8FAFC", muted: "#94A8C7", accent: "#FF8C5C" },
  forest: { bg: "#1B3A2F", fg: "#F5F0E1", muted: "#9DBAA9", accent: "#E8B042" },
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

// Pick a default bg for a variation index. Default to "dark" (matches
// the reference screenshot), then cycle navy → forest so the 3 cards
// look visually distinct without the user having to override.
export function defaultBgForIndex(i: number): ReelBg {
  const order: ReelBg[] = ["dark", "navy", "forest"];
  return order[i % order.length];
}

// Truncate a caption at the last full sentence before the hard cap.
// Used when the model overshoots — we never present an over-cap
// caption to the user.
export function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const candidates = [".", "!", "?", "\n\n"];
  let cutAt = -1;
  for (const t of candidates) {
    const i = slice.lastIndexOf(t);
    if (i > cutAt) cutAt = i;
  }
  if (cutAt > 0) return slice.slice(0, cutAt + 1).trimEnd() + "…";
  return slice.trimEnd() + "…";
}
