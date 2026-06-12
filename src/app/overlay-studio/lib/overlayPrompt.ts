// Overlay Studio — Claude prompt generator + paste-back parser.
// Same loop the rest of the app uses: copy the prompt → paste into
// Claude.ai with the photos attached → paste Claude's response back
// here → app maps overlay words + caption onto the photos.
//
// Zero API cost from this app; everything happens in Claude.ai.

import {
  AUDIENCE_LABELS,
  CTA_DEFAULTS,
  PILLAR_LABELS,
  type CtaKind,
  type OverlayMedia,
  type OverlaySettings,
  type PresetKey,
  type Role,
  type ShotType,
} from "./overlayTypes";

function ctaLine(settings: OverlaySettings): string {
  const tmpl = CTA_DEFAULTS[settings.ctaKind];
  const filled = tmpl.replace("{KEYWORD}", settings.dmKeyword || "DESIGN");
  if (settings.ctaKind === "book-call" && settings.bookingLink) {
    return `${filled} ${settings.bookingLink}`;
  }
  return filled;
}

export function buildOverlayPrompt(
  settings: OverlaySettings,
  photoCount: number,
): string {
  const audienceCopy =
    settings.audience === "local"
      ? "San Diego property owners (we design AND manage locally)"
      : "long-distance real-estate investors (we design remotely, they never fly out)";

  const pillarDef = PILLAR_LABELS[settings.pillar];
  const cta = ctaLine(settings);
  const listingLine = [
    settings.listingNickname && `Listing: ${settings.listingNickname}`,
    settings.listingSpecs,
    settings.listingCity,
  ]
    .filter(Boolean)
    .join(" — ");

  const sellingPoints = (settings.sellingPoints || "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  return `You are the creative director for Teeco.co — a done-for-you short-term-rental DESIGN service (back-end: management). Vision: "Freedom by Design." We make Airbnbs that book.

I'm attaching ${photoCount} photos of one of our designed listings:
${listingLine ? `  ${listingLine}` : "  (no listing details set — read the photos)"}
${sellingPoints ? `  Selling points: ${sellingPoints}` : ""}

Audience for this post: ${audienceCopy}.
Design pillar (teach this): ${pillarDef.label} — ${pillarDef.definition}
ONE call to action: ${cta}   (organic on-ramp: DM "${settings.dmKeyword || "DESIGN"}")

Treat this as a ${photoCount}-slide Instagram carousel that teaches and sells: cover (hook) → teaching slides → proof → CTA slide.

For EACH photo, look at what's actually in it and return:
  - shotType: one of "exterior" | "living" | "kitchen" | "bedroom" | "bath" | "view" | "detail"
  - role:    one of "cover" | "teach" | "proof" | "cta"
  - preset:  one of "cover" | "editorial" | "tip" | "before-after" | "stat" | "label" | "cta"
  - headline: ≤ 6 words, high-contrast, specific to THAT photo
  - body: 1–2 short lines of DESCRIPTION that do the work (teach the design point or state the proof). Skimmable. No hashtags.
  - alts: 2 alternate headline options

Then return:
  - caption: short, human, 3–5 sentences, leads with the design lesson / proof, ends with the single CTA above.
  - firstComment: one line reinforcing the CTA + the booking link.
  - audioVibe: one short suggested music vibe (the poster picks the actual track on Instagram).

Voice: confident, direct, no fluff, no guru-speak. Show receipts. 3rd-grade reading level. No emojis. No hashtags inside the caption body — keep the hashtag block separate.

RETURN STRICT JSON, no commentary before or after, exactly this shape:
{
  "photos": [
    { "index": 0, "shotType": "", "role": "", "preset": "", "headline": "", "body": "", "alts": ["", ""] }
  ],
  "caption": "",
  "firstComment": "",
  "audioVibe": ""
}`;
}

// ── Paste-back parser ─────────────────────────────────────────────

export interface ParsedResponse {
  photos: Array<{
    index: number;
    shotType?: ShotType;
    role?: Role;
    preset?: PresetKey;
    headline?: string;
    body?: string;
    alts?: string[];
  }>;
  caption: string;
  firstComment: string;
  audioVibe: string;
}

// Tolerant parse: strip markdown fences, find the outermost JSON
// object, coerce per-photo enums to known values, default the rest.
// Returns null if nothing usable is in the input.
export function parseOverlayResponse(raw: string): ParsedResponse | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    return null;
  }
  const photosRaw = Array.isArray(parsed.photos) ? parsed.photos : [];
  const photos = photosRaw
    .map((p): ParsedResponse["photos"][number] | null => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const idx = typeof o.index === "number" ? o.index : NaN;
      if (Number.isNaN(idx)) return null;
      return {
        index: idx,
        shotType: validShot(o.shotType),
        role: validRole(o.role),
        preset: validPreset(o.preset),
        headline: typeof o.headline === "string" ? o.headline.trim() : "",
        body: typeof o.body === "string" ? o.body.trim() : "",
        alts:
          Array.isArray(o.alts)
            ? (o.alts as unknown[])
                .filter((a): a is string => typeof a === "string")
                .slice(0, 4)
            : [],
      };
    })
    .filter((p): p is ParsedResponse["photos"][number] => p !== null);

  return {
    photos,
    caption: typeof parsed.caption === "string" ? parsed.caption.trim() : "",
    firstComment:
      typeof parsed.firstComment === "string" ? parsed.firstComment.trim() : "",
    audioVibe:
      typeof parsed.audioVibe === "string" ? parsed.audioVibe.trim() : "",
  };
}

function validShot(v: unknown): ShotType | undefined {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  const allowed: ShotType[] = [
    "exterior",
    "living",
    "kitchen",
    "bedroom",
    "bath",
    "view",
    "detail",
  ];
  return (allowed as string[]).includes(s) ? (s as ShotType) : undefined;
}

function validRole(v: unknown): Role | undefined {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  const allowed: Role[] = ["cover", "teach", "proof", "cta"];
  return (allowed as string[]).includes(s) ? (s as Role) : undefined;
}

function validPreset(v: unknown): PresetKey | undefined {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  const allowed: PresetKey[] = [
    "cover",
    "editorial",
    "tip",
    "before-after",
    "stat",
    "label",
    "cta",
  ];
  return (allowed as string[]).includes(s) ? (s as PresetKey) : undefined;
}

// Merge a parsed Claude response into the current media list. Photos
// are matched by index. Unknown fields are left untouched so a partial
// response doesn't blow away the user's existing work.
export function mergeParsedIntoMedia(
  media: OverlayMedia[],
  parsed: ParsedResponse,
): OverlayMedia[] {
  return media.map((m, i): OverlayMedia => {
    const p = parsed.photos.find((x) => x.index === i);
    if (!p) return m;
    return {
      ...m,
      shotType: p.shotType ?? m.shotType,
      role: p.role ?? m.role,
      preset: p.preset ?? m.preset,
      headline: p.headline ?? m.headline,
      body: p.body ?? m.body,
    };
  });
}
