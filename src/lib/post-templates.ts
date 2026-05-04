// Types, defaults, and character-budget heuristics for the Canva-style
// carousel post builder. Slides are modeled after the Dr. Jeff Chheuy
// template the user posts (1080x1080, profile row, typed body).

export type SlideType =
  | "hook-opener" // big hook + optional numbered list preview + optional small footer lines
  | "personal-story" // 3-5 short paragraphs, can bold inline via **word**
  | "criteria-bullets" // intro line + bullet list + optional closing line
  | "market-detail" // #N header + subtitle + bullets + stat lines (Gross Rev Potential / Avg Home Price)
  | "numbered-list" // heading + numbered items
  | "plain-text" // simple paragraphs
  | "cta"; // closing DM call-to-action

// Cover-slide background option. Drives bg color + text color in the
// hook-opener renderer. Each option is a brand-tested combo with WCAG-AA
// (or better) contrast for body text and accent bold.
export type CoverBg =
  | "white"   // crisp / corporate
  | "yellow"  // signature brand yellow, dark text
  | "dark"    // near-black, white text — high impact
  | "cream"   // warm soft, terracotta accent
  | "forest"  // deep green, amber accent
  | "navy"    // premium navy, coral accent
  | "soft"    // pale blue, Wilson-style — teal accent
  | "custom"; // user-picked bg + accent (auto-computed text color)

// Typography toggle on the user's profile. Drives fontFamily across all
// slides so the brand voice stays consistent. Each option is intentionally
// distinct so picking a font feels like picking a brand:
//   - "sans"    Inter — clean modern (Jeff style)
//   - "serif"   Lora — classic readable serif (Wilson style)
//   - "display" DM Serif Display — high-contrast magazine serif (fashion / editorial)
//   - "rounded" Nunito — friendly approachable rounded sans (lifestyle / coach)
export type ProfileFont = "sans" | "serif" | "display" | "rounded";

// Common color/background fields available on EVERY slide type. Slide 1
// (hook-opener) has used these since launch; every body slide type also
// exposes them so a user can theme the whole carousel, not just the cover.
//
// All three are optional — leaving them undefined renders the slide with
// the default white-bg / dark-text body look.
export interface SlideStyleFields {
  bg?: CoverBg;
  // Only used when bg === "custom". Both should be hex like "#1A2B3C".
  // Body text color is auto-computed from bg luminance for legibility.
  customBg?: string;
  customAccent?: string;
}

export interface HookOpenerSlide extends SlideStyleFields {
  type: "hook-opener";
  headline: string; // e.g. "These are the best rural Airbnb markets for 2026:"
  subtitle?: string; // small secondary line under the headline (often parenthetical)
  items?: string[]; // numbered preview list, rendered "1. ..." — optional
  footer?: string[]; // short closing paragraphs — optional
}

export interface PersonalStorySlide extends SlideStyleFields {
  type: "personal-story";
  paragraphs: string[]; // each string is one paragraph; **word** renders bold
}

export interface CriteriaBulletsSlide extends SlideStyleFields {
  type: "criteria-bullets";
  heading: string;
  bullets: string[];
  footer?: string;
}

export interface MarketDetailSlide extends SlideStyleFields {
  type: "market-detail";
  rank: number; // 1, 2, 3...
  title: string; // "Wolfe County, KY"
  subtitle?: string; // "(Red River Gorge)"
  bullets: string[];
  stats?: { label: string; value: string }[]; // [{label:"Gross Rev Potential", value:"$75,940/year"}]
}

export interface NumberedListSlide extends SlideStyleFields {
  type: "numbered-list";
  heading: string;
  items: string[];
}

export interface PlainTextSlide extends SlideStyleFields {
  type: "plain-text";
  paragraphs: string[];
}

export interface CtaSlide extends SlideStyleFields {
  type: "cta";
  paragraphs: string[]; // **word** renders bold
}

export type Slide =
  | ({ id: string } & HookOpenerSlide)
  | ({ id: string } & PersonalStorySlide)
  | ({ id: string } & CriteriaBulletsSlide)
  | ({ id: string } & MarketDetailSlide)
  | ({ id: string } & NumberedListSlide)
  | ({ id: string } & PlainTextSlide)
  | ({ id: string } & CtaSlide);

export interface CarouselPost {
  slides: Slide[];
  caption: string;
  hooks: string[]; // 3 alternate first-slide hooks
}

export interface PostBuilderProfile {
  displayName: string; // "Dr.Jeff Chheuy"
  handle: string; // "@jeffchheuy" (leading @ optional, we normalize)
  avatarDataUrl: string | null; // uploaded image as data URL, persisted to localStorage
  verified: boolean; // show the blue check
  font?: ProfileFont; // sans (default) or serif — applies to every slide
}

export interface PostBuilderParams {
  slideCount: number; // target slide count; 6-12 typical, default 10
  readingLevel: string; // "3rd grade" default
  audience: string; // "high income earners with $65k saved" default
  tone: string; // "confident, direct, no-fluff"
  // per-slide character budgets — the prompt references these and the
  // renderer warns when exceeded. Keeps slides readable, no flood.
  maxCharsBody: number; // default 280 for hook/story/cta body blocks
  maxBullets: number; // default 6 bullets per slide
  maxCharsBullet: number; // default 60 chars per bullet
}

export const DEFAULT_PARAMS: PostBuilderParams = {
  slideCount: 10,
  readingLevel: "3rd grade",
  // Generic placeholder so new users see a hint, not a previous user's
  // niche. Edit in the Carousel params panel.
  audience: "your target audience (edit me in Carousel params)",
  tone: "confident, direct, no-fluff",
  maxCharsBody: 220,
  maxBullets: 5,
  maxCharsBullet: 42,
};

// Generic defaults so a fresh visitor sees placeholder identity, not
// someone else's name + handle on the cover slide. ProfileEditor
// prompts the user to fill it in before first export.
export const DEFAULT_PROFILE: PostBuilderProfile = {
  displayName: "Your Name",
  handle: "@yourhandle",
  avatarDataUrl: null,
  verified: false,
  font: "sans",
};

// Local-storage keys
export const LS_KEY_PROFILE = "postBuilder.profile";
export const LS_KEY_PARAMS = "postBuilder.params";
export const LS_KEY_LAST_POST = "postBuilder.lastPost";
export const LS_KEY_SAVED_PROFILES = "postBuilder.savedProfiles";

// Max number of saved-profile snapshots stored in localStorage. Keeps the
// dropdown short and bounds the bytes consumed by avatar data URLs.
export const SAVED_PROFILE_LIMIT = 5;

// One entry in the saved-profiles list. label is the user's free-form name
// for this snapshot (defaults to displayName); savedAt is for sort order.
export interface SavedProfile extends PostBuilderProfile {
  label: string;
  savedAt: number;
}

export function normalizeHandle(h: string): string {
  const trimmed = h.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function newSlideId(): string {
  return `slide_${Math.random().toString(36).slice(2, 10)}`;
}

// Approximate character count used by a slide's body content. Used by the
// UI to flag slides that exceed the budget so the user sees "too much text".
export function slideCharCount(slide: Slide): number {
  switch (slide.type) {
    case "hook-opener":
      return (
        slide.headline.length +
        (slide.subtitle?.length ?? 0) +
        (slide.items?.join(" ").length ?? 0) +
        (slide.footer?.join(" ").length ?? 0)
      );
    case "personal-story":
      return slide.paragraphs.join(" ").length;
    case "criteria-bullets":
      return (
        slide.heading.length +
        slide.bullets.join(" ").length +
        (slide.footer?.length ?? 0)
      );
    case "market-detail":
      return (
        slide.title.length +
        (slide.subtitle?.length ?? 0) +
        slide.bullets.join(" ").length +
        (slide.stats?.map((s) => s.label + s.value).join(" ").length ?? 0)
      );
    case "numbered-list":
      return slide.heading.length + slide.items.join(" ").length;
    case "plain-text":
      return slide.paragraphs.join(" ").length;
    case "cta":
      return slide.paragraphs.join(" ").length;
  }
}

// Raw shape returned by the /analyze API. We attach ids on the client to
// keep server responses small.
export type RawSlide = Omit<Slide, "id">;
export interface RawCarouselPost {
  slides: RawSlide[];
  caption: string;
  hooks: string[];
}

export function attachIds(raw: RawCarouselPost): CarouselPost {
  return {
    slides: raw.slides.map((s) => ({ ...s, id: newSlideId() }) as Slide),
    caption: raw.caption,
    hooks: raw.hooks,
  };
}
