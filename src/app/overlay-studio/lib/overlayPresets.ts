// Overlay Studio — the IG style presets. Each preset defines how the
// overlay is drawn on the photo: which font, the size/weight/case,
// default block layout, default position, and a one-line "why this
// works" hint surfaced to the user in the auditor.
//
// Fonts chosen are free Google Fonts (loaded on the page) so the
// preview matches the html-to-image export exactly:
//   Headlines: Anton, Archivo Black, Inter 900
//   Body:      Inter / Work Sans 500–600
//   Accent:    Teeco yellow #FBC02D for one highlighted word
//
// Carousel recipe (the auditor uses this when auto-assigning roles +
// presets across N photos): cover → 3–6 editorial/tip teaching slides
// → 1 stat/proof → cta. The proven IG "hook → value → proof → ask"
// arc, per the spec.

import type { PresetKey, Role } from "./overlayTypes";

export interface PresetDef {
  key: PresetKey;
  label: string;
  role: Role;
  // One-line "why this works" hint shown to the user.
  why: string;
  // Headline font + size hints used by the slide renderer.
  headlineFont: string;
  headlineSize: number; // px at 1080×1350
  headlineWeight: number;
  headlineUppercase: boolean;
  headlineLetterSpacing: number; // em
  bodyFont: string;
  bodySize: number;
  bodyWeight: number;
  // Default position. The auditor still lets the user override per slide.
  defaultPosition:
    | "TL"
    | "TC"
    | "TR"
    | "CL"
    | "CC"
    | "CR"
    | "BL"
    | "BC"
    | "BR";
  scrim: "none" | "top" | "bottom" | "full";
  // Extras some presets render: a giant "01" number for tip slides,
  // a chip background for before/after labels, etc.
  numbering?: boolean;
  chip?: "before" | "after" | null;
}

const HEADLINE_FONT = "'Anton', 'Archivo Black', 'Inter', sans-serif";
const BODY_FONT = "'Inter', 'Work Sans', system-ui, sans-serif";

export const PRESETS: Record<PresetKey, PresetDef> = {
  cover: {
    key: "cover",
    label: "Cover hook",
    role: "cover",
    why: "Slide 1 has one job: stop the scroll. Big claim, big type, high contrast.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 140,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.025,
    bodyFont: BODY_FONT,
    bodySize: 38,
    bodyWeight: 500,
    defaultPosition: "BL",
    scrim: "bottom",
  },
  editorial: {
    key: "editorial",
    label: "Editorial caption",
    role: "teach",
    why: "Magazine-style 1–2 line caption. The text teaches; the photo carries the mood.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 78,
    headlineWeight: 900,
    headlineUppercase: false,
    headlineLetterSpacing: -0.02,
    bodyFont: BODY_FONT,
    bodySize: 42,
    bodyWeight: 500,
    defaultPosition: "BL",
    scrim: "bottom",
  },
  tip: {
    key: "tip",
    label: "Numbered tip",
    role: "teach",
    why: "Steps + consistent placement train the viewer to swipe for the next one.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 78,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.02,
    bodyFont: BODY_FONT,
    bodySize: 38,
    bodyWeight: 500,
    defaultPosition: "TL",
    scrim: "top",
    numbering: true,
  },
  "before-after": {
    key: "before-after",
    label: "Before / After label",
    role: "teach",
    why: "A single labeled chip makes the gap obvious without crowding the photo.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 64,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: 0.05,
    bodyFont: BODY_FONT,
    bodySize: 36,
    bodyWeight: 600,
    defaultPosition: "TL",
    scrim: "none",
    chip: "after",
  },
  stat: {
    key: "stat",
    label: "Stat / proof block",
    role: "proof",
    why: "One number, centered, owns the slide. Receipts beat adjectives.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 180,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.04,
    bodyFont: BODY_FONT,
    bodySize: 40,
    bodyWeight: 500,
    defaultPosition: "CC",
    scrim: "full",
  },
  label: {
    key: "label",
    label: "Minimal corner tag",
    role: "proof",
    why: "Let a strong photo breathe. A tiny tag is enough context.",
    headlineFont: BODY_FONT,
    headlineSize: 32,
    headlineWeight: 700,
    headlineUppercase: true,
    headlineLetterSpacing: 0.15,
    bodyFont: BODY_FONT,
    bodySize: 28,
    bodyWeight: 500,
    defaultPosition: "BL",
    scrim: "none",
  },
  cta: {
    key: "cta",
    label: "CTA end slide",
    role: "cta",
    why: "Close with one ask. Booking link in the first comment.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 110,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.03,
    bodyFont: BODY_FONT,
    bodySize: 42,
    bodyWeight: 600,
    defaultPosition: "CC",
    scrim: "full",
  },
};

export const PRESET_ORDER: PresetKey[] = [
  "cover",
  "editorial",
  "tip",
  "before-after",
  "stat",
  "label",
  "cta",
];

// Given N photos, return the suggested preset for each slide so a
// first-time poster lands on the proven "hook → value → proof → ask"
// arc without having to think. The user can override any slide in
// the auditor.
export function carouselRecipe(count: number): PresetKey[] {
  if (count <= 0) return [];
  if (count === 1) return ["cover"];
  if (count === 2) return ["cover", "cta"];
  const out: PresetKey[] = ["cover"];
  // 1 stat slide near the end (proof) + a CTA end slide. The middle
  // fills with editorial/tip alternating so consecutive slides feel
  // varied but not chaotic.
  const middle = Math.max(0, count - 3);
  for (let i = 0; i < middle; i++) {
    out.push(i % 2 === 0 ? "editorial" : "tip");
  }
  if (count >= 3) out.push("stat");
  out.push("cta");
  return out.slice(0, count);
}
