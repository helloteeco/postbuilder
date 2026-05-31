// Overlay Studio — shared types. Kept narrow and tight so the rest of
// the module reads cleanly; per the spec, media is image-only for v1
// (Phase 5 adds short video) and we render one carousel at a time
// (Phase 4 adds the listings library).

export type Audience = "local" | "remote";

export type DesignPillar =
  | "design-roi"
  | "before-after"
  | "design-principle"
  | "host-mistake"
  | "process"
  | "proof";

export type CtaKind = "book-call" | "dm-keyword" | "comment-keyword";

export type PresetKey =
  | "cover"
  | "editorial"
  | "tip"
  | "before-after"
  | "stat"
  | "label"
  | "cta";

export type Role = "cover" | "teach" | "proof" | "cta";

export type ShotType =
  | "exterior"
  | "living"
  | "kitchen"
  | "bedroom"
  | "bath"
  | "view"
  | "detail";

export type TextColor = "light" | "dark" | "yellow";
export type Position =
  | "TL"
  | "TC"
  | "TR"
  | "CL"
  | "CC"
  | "CR"
  | "BL"
  | "BC"
  | "BR";

// Result of luminance analysis on the photo — used to suggest a
// starting position + color before the user audits.
export interface AutoAnalysis {
  band: "top" | "center" | "bottom";
  color: "light" | "dark";
}

// One photo in the carousel under audit. dataUrl is the user's
// uploaded file as a base64 string so it survives a page refresh
// inside localStorage. Per the build spec, the photo input is a real
// <input type="file" multiple>, never a hidden/custom widget, so the
// Claude Chrome extension can drop files straight in.
export interface OverlayMedia {
  id: string;
  dataUrl: string;
  shotType: ShotType;
  role: Role;
  preset: PresetKey;
  headline: string;
  body: string;
  textColor: TextColor;
  position: Position;
  scrim: boolean;
  auto: AutoAnalysis;
}

// Persisted settings for the active channel. The audience / pillar /
// CTA flow the spec defines.
export interface OverlaySettings {
  audience: Audience;
  pillar: DesignPillar;
  ctaKind: CtaKind;
  bookingLink: string;
  dmKeyword: string;
  // Free-form, lets a user identify the listing they're posting about
  // without us shipping the full listings system in v1.
  listingNickname: string;
  listingCity: string;
  listingSpecs: string;
  sellingPoints: string;
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  audience: "local",
  pillar: "design-roi",
  ctaKind: "book-call",
  bookingLink: "https://calendly.com/your-link",
  dmKeyword: "DESIGN",
  listingNickname: "",
  listingCity: "",
  listingSpecs: "",
  sellingPoints: "",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  local: "San Diego owners (we design AND manage locally)",
  remote: "Long-distance investors (we design remotely)",
};

export const PILLAR_LABELS: Record<DesignPillar, { label: string; definition: string }> = {
  "design-roi": {
    label: "Design ROI",
    definition: "Why good design = more bookings, higher nightly rate, better reviews.",
  },
  "before-after": {
    label: "Before / After",
    definition: "The transformation gap between a rental and a stay.",
  },
  "design-principle": {
    label: "Design principle",
    definition: "One specific design decision explained (lighting, layout, texture).",
  },
  "host-mistake": {
    label: "Host mistake",
    definition: "An anti-pattern most owners make (e.g. furnished like a long-term rental).",
  },
  process: {
    label: "Process",
    definition: "How we design (remote workflow, sourcing — Wayfair, Schlage Encode, Ring).",
  },
  proof: {
    label: "Proof",
    definition: "A client win, real revenue receipt, or specific result.",
  },
};

export const CTA_DEFAULTS: Record<CtaKind, string> = {
  "book-call": "Book a free design call →",
  "dm-keyword": 'DM "{KEYWORD}" for our design guide',
  "comment-keyword": 'Comment "{KEYWORD}" and I\'ll send the breakdown',
};
