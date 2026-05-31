// Overlay Studio — IG style presets for the on-photo text. Each preset
// defines typography + placement defaults. Profile row + format size
// are handled by OverlaySlideRender, not here.

import type { PresetKey, Role } from "./overlayTypes";

export interface PresetDef {
  key: PresetKey;
  label: string;
  role: Role;
  why: string;
  headlineFont: string;
  headlineSize: number;
  headlineWeight: number;
  headlineUppercase: boolean;
  headlineLetterSpacing: number;
  bodyFont: string;
  bodySize: number;
  bodyWeight: number;
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
    why: "Slide 1: stop the scroll. Big claim, big type.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 140,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.025,
    bodyFont: BODY_FONT,
    bodySize: 38,
    bodyWeight: 500,
    defaultPosition: "CL",
    scrim: "bottom",
  },
  editorial: {
    key: "editorial",
    label: "Editorial caption",
    role: "teach",
    why: "Magazine-style 1–2 line caption over the photo.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 78,
    headlineWeight: 900,
    headlineUppercase: false,
    headlineLetterSpacing: -0.02,
    bodyFont: BODY_FONT,
    bodySize: 42,
    bodyWeight: 500,
    defaultPosition: "CL",
    scrim: "bottom",
  },
  tip: {
    key: "tip",
    label: "Numbered tip",
    role: "teach",
    why: "Numbered step with consistent placement.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 78,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: -0.02,
    bodyFont: BODY_FONT,
    bodySize: 38,
    bodyWeight: 500,
    defaultPosition: "CL",
    scrim: "top",
    numbering: true,
  },
  "before-after": {
    key: "before-after",
    label: "Before / After",
    role: "teach",
    why: "Labeled chip; shows the transformation cleanly.",
    headlineFont: HEADLINE_FONT,
    headlineSize: 64,
    headlineWeight: 900,
    headlineUppercase: true,
    headlineLetterSpacing: 0.05,
    bodyFont: BODY_FONT,
    bodySize: 36,
    bodyWeight: 600,
    defaultPosition: "CL",
    scrim: "none",
    chip: "after",
  },
  stat: {
    key: "stat",
    label: "Stat / proof",
    role: "proof",
    why: "One number, centered. Receipts.",
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
    label: "Minimal tag",
    role: "proof",
    why: "Tiny corner label — lets the photo breathe.",
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
    why: "Close with one ask. Booking link in first comment.",
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

export function carouselRecipe(count: number): PresetKey[] {
  if (count <= 0) return [];
  if (count === 1) return ["cover"];
  if (count === 2) return ["cover", "cta"];
  const out: PresetKey[] = ["cover"];
  const middle = Math.max(0, count - 3);
  for (let i = 0; i < middle; i++) {
    out.push(i % 2 === 0 ? "editorial" : "tip");
  }
  if (count >= 3) out.push("stat");
  out.push("cta");
  return out.slice(0, count);
}
