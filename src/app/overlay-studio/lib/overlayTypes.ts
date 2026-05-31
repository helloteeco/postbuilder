// Overlay Studio — shared types. Media-first carousel/reel builder
// using your own photos. Profile + voice come from the SAME source
// the rest of the app uses (postBuilder.profile) so face/name/blue
// check stay consistent across Post Builder, Reel Builder, and here.

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

// Output canvas size — single toggle at the top of the workspace.
// "post"  = 1080×1350 (IG feed carousel, matches Post Builder)
// "reel"  = 1080×1920 (IG reel cover, matches Reel Builder)
export type OutputFormat = "post" | "reel";

export const OUTPUT_DIMENSIONS: Record<OutputFormat, { w: number; h: number; label: string }> = {
  post: { w: 1080, h: 1350, label: "Post (1080×1350)" },
  reel: { w: 1080, h: 1920, label: "Reel cover (1080×1920)" },
};

export interface AutoAnalysis {
  band: "top" | "center" | "bottom";
  color: "light" | "dark";
}

// One photo + the words you want on it. headline = the big bold text,
// body = the line(s) you want to say about it (this also feeds the
// post caption).
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

export interface OverlaySettings {
  outputFormat: OutputFormat;
  showProfile: boolean;
  audience: Audience;
  pillar: DesignPillar;
  ctaKind: CtaKind;
  bookingLink: string;
  dmKeyword: string;
  // Optional listing context — only used to shape the Claude prompt
  // when the user wants the AI-assisted captioning path.
  listingNickname: string;
  listingCity: string;
  listingSpecs: string;
  sellingPoints: string;
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  outputFormat: "post",
  showProfile: true,
  audience: "local",
  pillar: "design-roi",
  ctaKind: "book-call",
  bookingLink: "",
  dmKeyword: "DESIGN",
  listingNickname: "",
  listingCity: "",
  listingSpecs: "",
  sellingPoints: "",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  local: "Local owners (we design & manage locally)",
  remote: "Long-distance investors (designed remotely)",
};

export const PILLAR_LABELS: Record<DesignPillar, { label: string; definition: string }> = {
  "design-roi": {
    label: "Design ROI",
    definition: "Design → more bookings, higher ADR, better reviews.",
  },
  "before-after": {
    label: "Before / After",
    definition: "Transformation — rental → a real stay.",
  },
  "design-principle": {
    label: "Design principle",
    definition: "One specific design decision explained.",
  },
  "host-mistake": {
    label: "Host mistake",
    definition: "An anti-pattern most owners make.",
  },
  process: {
    label: "Process",
    definition: "How we design (remote workflow, sourcing).",
  },
  proof: {
    label: "Proof",
    definition: "A client win, revenue receipt, specific result.",
  },
};

export const CTA_DEFAULTS: Record<CtaKind, string> = {
  "book-call": "Book a free design call →",
  "dm-keyword": 'DM "{KEYWORD}" for the guide',
  "comment-keyword": 'Comment "{KEYWORD}" and I\'ll send the breakdown',
};
