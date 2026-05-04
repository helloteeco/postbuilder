// Visual constants + shared types for the Reel Builder. Layout uses
// ABSOLUTE positioning for each major block so headlines, subtitles,
// and the profile row land in fixed pixel positions regardless of
// content length — no flex drift.
//
// The y-coordinates are tuned so that when the rendered MP4 / PNG is
// posted to Instagram Reels:
//   • Headline starts at ~20% from the top (matches the visual feel
//     of a Post Builder cover post in the IG feed).
//   • Profile row sits comfortably above the IG bottom-UI overlay
//     zone (which covers ~30% of the screen with caption / like /
//     comment / share buttons).
//   • "See description ↓" sits in the top safe zone above the
//     headline, tight to its chevron (no oceanic gap).
//
// Per the original spec, Reel Builder mirrors Post Builder's visual
// language but does NOT import from CarouselSlide.tsx.

// 9:16 portrait, the IG Reel cover spec.
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

// ── Absolute y-positions for each block ─────────────────────────────
// "See description ↓" lives in the top zone, tight chevron right
// below the text (was 24px gap before — too airy; now ~12px).
export const SEE_DESC_TEXT_Y = 110;
export const SEE_DESC_CHEVRON_Y = 200;

// Hook block starts at ~20% from the top of the reel — same visual
// proportion as Post Builder's 240/1350 cover (~17.8%).
export const HOOK_BLOCK_TOP = 380;
// Max height of the hook block so a 5-line headline + subtitle never
// crashes into the profile row.
export const HOOK_BLOCK_MAX_HEIGHT = 720;

// Profile row top. Pinned at ~61% from top so it stays well above
// the IG bottom-UI overlay zone (which starts ~70% on most phones).
export const PROFILE_ROW_TOP = 1170;

// Side padding (X). Same 80px as Post Builder.
export const SIDE_PAD = 80;

// ── Background palettes ────────────────────────────────────────────
// Mirror Post Builder's full 7-palette set so the reel's bg picker
// has 1:1 parity with the carousel's.
export type ReelBg =
  | "white"
  | "soft"
  | "yellow"
  | "dark"
  | "cream"
  | "forest"
  | "navy";

export interface ReelBgPalette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
}

export const REEL_BG_PALETTES: Record<ReelBg, ReelBgPalette> = {
  white: { bg: "#FFFFFF", fg: "#0F1419", muted: "#6B7280", accent: "#2E86AB" },
  soft: { bg: "#EEF2F6", fg: "#0F1419", muted: "#6B7280", accent: "#3290B5" },
  yellow: { bg: "#F5B935", fg: "#0F1419", muted: "#5C4A1F", accent: "#0F1419" },
  dark: { bg: "#0F1419", fg: "#FFFFFF", muted: "#9CA3AF", accent: "#5FB4D2" },
  cream: { bg: "#F7F0E1", fg: "#2A1F0F", muted: "#76624A", accent: "#B8501F" },
  forest: { bg: "#1B3A2F", fg: "#F5F0E1", muted: "#9DBAA9", accent: "#E8B042" },
  navy: { bg: "#0F2645", fg: "#F8FAFC", muted: "#94A8C7", accent: "#FF8C5C" },
};

export const REEL_BG_LABELS: Record<ReelBg, string> = {
  white: "White",
  soft: "Soft",
  yellow: "Yellow",
  dark: "Dark",
  cream: "Cream",
  forest: "Forest",
  navy: "Navy",
};

export const REEL_BG_ORDER: ReelBg[] = [
  "dark",
  "navy",
  "forest",
  "white",
  "soft",
  "yellow",
  "cream",
];

// ── Font choices ───────────────────────────────────────────────────
// Mirror Post Builder's profile fonts so a reel matches the user's
// chosen font for their feed.
export type ReelFont = "sans" | "serif" | "display" | "rounded";

export const REEL_FONTS: Record<ReelFont, string> = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  display: "'DM Serif Display', 'Lora', Georgia, serif",
  rounded:
    "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const REEL_FONT_LABELS: Record<ReelFont, string> = {
  sans: "Sans (Inter)",
  serif: "Serif (Lora)",
  display: "Display",
  rounded: "Rounded",
};

// ── Hook angle types (unchanged) ───────────────────────────────────
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

export interface ReelVariation {
  angle: ReelHookAngle;
  hookHeadline: string;
  hookSubtitle: string;
  caption: string;
}

export interface ReelGenerationResult {
  variations: ReelVariation[];
}

// ── Caption + headline limits ──────────────────────────────────────
export const CAPTION_HARD_CAP = 2200;
export const CAPTION_SOFT_CAP = 2000;

export const HEADLINE_MAX_CHARS = 40;
export const HEADLINE_MAX_WORDS = 7;
export const HEADLINE_MAX_WORD_CHARS = 12;
export const SUBTITLE_MAX_CHARS = 60;

// Pick a default bg for a variation index. Default to "dark" (matches
// the user's reference screenshot), then cycle navy → forest so the 3
// cards look visually distinct without the user having to override.
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
