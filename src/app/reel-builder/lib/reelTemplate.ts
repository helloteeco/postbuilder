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

// ── Layout strategy ────────────────────────────────────────────────
//
// To keep the user's IG profile grid uniform, the reel EMBEDS a
// pixel-identical 1080×1350 Post Builder cover (the same 4:5 ratio IG
// uses for feed posts) centered vertically inside the 1080×1920
// reel. This way:
//
//   • When IG shows the reel in the 4:5 profile-grid cell (the most
//     common modern grid), it center-crops the reel to 1080×1350
//     starting at y=285 — which captures the embedded cover EXACTLY,
//     so the grid thumbnail is identical to a Post Builder feed post.
//
//   • When IG center-crops to 1:1 (older grid view, story sticker,
//     etc.), it takes the middle 1080×1080 — y=420 to y=1500. Inside
//     the embedded cover that's relative y=135 to y=1215, the same
//     center-crop a Post Builder feed post would get. Headline + face
//     land at identical positions.
//
//   • When played at full 9:16 in the Reels tab, the cover content
//     sits in the middle of the screen with "See description ↓" above
//     and an empty bg band below (where IG's UI overlays anyway).
//
// The embedded cover uses the EXACT same padding (240/80/380), font
// sizes (132 headline, 48 subtitle), and compact profile row (avatar
// 128, name 46pt, handle 38pt) as Post Builder. That's what keeps
// the text + face uniform between both formats.

// Cover area embedded inside the reel.
export const COVER_AREA_TOP = 285; // (1920 - 1350) / 2 = 285
export const COVER_AREA_HEIGHT = 1350;
export const COVER_PADDING_TOP = 240;
export const COVER_PADDING_BOTTOM = 380;
export const COVER_PADDING_X = 80;
// Hook-block max-height inside the cover. Same value Post Builder
// uses to keep the headline from crashing into the profile row.
export const COVER_HOOK_MAX_HEIGHT = 510;

// "See description ↓" sits BELOW the profile row, inside the cover's
// bottom-padding zone. Three reasons this is the right spot:
//
//  1. Bird's-eye-view scannability on the IG profile grid. The grid
//     center-crops 9:16 reels to 4:5 (y=285 to y=1635), which IS
//     the embedded cover. An indicator below the profile row shows
//     up clearly in the grid thumbnail and visually differentiates
//     reels from carousel posts (which have nothing below the face).
//
//  2. Doesn't fight the headline/subtitle hierarchy. Putting it
//     above the title or in the title block competed for attention
//     and made the cover feel cluttered.
//
//  3. Sits above where IG's bottom UI overlays the reel when
//     playing (caption peek + music + buttons typically start
//     around y=1500). At y=1290-1450, it's visible during playback
//     and doesn't conflict with IG's chrome.
//
// Profile row bottom is at ~y=1255 (cover y=970+140). 35px gap, then
// "See description" text, tight 12px gap, then chevron — total
// indicator block ~190px tall, ending at ~y=1480, well above IG's
// bottom-UI start.
export const SEE_DESC_TEXT_Y = 1290;
export const SEE_DESC_CHEVRON_Y = 1370;

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
