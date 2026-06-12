// Per-slide headline + body banks. Each new photo, however it lands
// (drag-drop / Airbnb URL / paste-image-URLs), gets a punchy headline
// and a paired body line picked from the bank for its preset role.
// Goal: the carousel looks complete the moment you stop uploading —
// no per-slide typing, just click export.
//
// Voice rules match the warm-design caption:
//   - lowercase first, jeff-style casual
//   - no em dashes, no en dashes
//   - 3rd grade reading level
//   - punchy, memorable, tied to design ROI when possible

import type { PresetKey } from "./overlayTypes";
import { DESIGN_TIPS } from "./designTips";

// Cover (slide 1) — big claim, big type. Stop the scroll.
const COVER_HEADLINES = [
  "designed for bookings",
  "this is what design does",
  "soft. warm. stunning.",
  "your listing, leveled up",
  "design that pays for itself",
  "the airbnb your guests post about",
];
const COVER_BODIES = [
  "10 design moves that print money",
  "why design = more nights booked",
  "what a top 1% listing actually looks like",
  "the difference between rented and remembered",
];

// Editorial — magazine-style 1 line caption over the photo.
const EDITORIAL_HEADLINES = [
  "the cozy corner",
  "where guests stay longer",
  "the photo they save",
  "details people remember",
  "the room that books out first",
  "first impressions, on purpose",
  "this is the vibe",
];
const EDITORIAL_BODIES = [
  "small choices. big bookings.",
  "design is the difference",
  "good design feels effortless. it isn't.",
  "this is why hosts hire us",
];

// Numbered tip — short tip title that pairs with a tip body.
const TIP_HEADLINES = [
  "warm light wins",
  "layer the lighting",
  "one statement piece",
  "the kitchen bowl trick",
  "linen sheets, always",
  "rugs that fit",
  "art bigger than you think",
  "soft edges everywhere",
];

// Before / After — single word labels.
const BA_HEADLINES = ["AFTER", "BEFORE"];
const BA_BODIES = [
  "same square footage. different listing.",
  "this is what 2 weeks of design does.",
];

// Stat / proof — one number, big. The headline IS the number.
const STAT_HEADLINES = [
  "+$12,500 / yr",
  "+47% bookings",
  "5 star reviews",
  "+30% ADR",
  "200+ booked nights",
  "6 weeks to roi",
];
const STAT_BODIES = [
  "design pays for itself. usually fast.",
  "this is what the math looks like.",
  "real numbers from a real listing.",
];

// Label — tiny corner tag. Index-based so 01/02/03... reads cleanly.
const LABEL_HEADLINES_PREFIX = "DESIGN TIP";
const LABEL_BODIES = ["interior design playbook", "what works in 2026"];

// CTA — last slide. Big ask, one keyword.
const CTA_HEADLINES = [
  "comment DESIGN",
  "ready for this?",
  "dm DESIGN for the playbook",
  "let's design yours",
];
const CTA_BODIES = [
  "san diego local + remote anywhere",
  "full setup design + cohosting",
  "we walk you through pricing too",
  "one comment. that's it.",
];

// Index-stable pick. Same index = same headline across reloads so a
// saved batch keeps its identity. Slide index counts into the photo
// position, not just the preset count, so two editorial slides next
// to each other get different lines.
function pick(arr: string[], seed: number): string {
  if (arr.length === 0) return "";
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

export interface AutoCopy {
  headline: string;
  body: string;
}

export function pickAutoCopy(preset: PresetKey, slideIndex: number): AutoCopy {
  switch (preset) {
    case "cover":
      return {
        headline: pick(COVER_HEADLINES, slideIndex),
        body: pick(COVER_BODIES, slideIndex),
      };
    case "editorial":
      return {
        headline: pick(EDITORIAL_HEADLINES, slideIndex),
        body: pick(EDITORIAL_BODIES, slideIndex),
      };
    case "tip":
      return {
        headline: pick(TIP_HEADLINES, slideIndex),
        body: pick(DESIGN_TIPS, slideIndex),
      };
    case "before-after":
      return {
        headline: pick(BA_HEADLINES, slideIndex),
        body: pick(BA_BODIES, slideIndex),
      };
    case "stat":
      return {
        headline: pick(STAT_HEADLINES, slideIndex),
        body: pick(STAT_BODIES, slideIndex),
      };
    case "label":
      return {
        headline: `${LABEL_HEADLINES_PREFIX} ${String((slideIndex % 99) + 1).padStart(2, "0")}`,
        body: pick(LABEL_BODIES, slideIndex),
      };
    case "cta":
      return {
        headline: pick(CTA_HEADLINES, slideIndex),
        body: pick(CTA_BODIES, slideIndex),
      };
  }
}
