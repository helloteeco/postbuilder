// Structural analysis of captured slide content. Top Post Mode uses the
// shape returned here to give a content-aware diagnosis ("your top post
// used a list format with 4 named cities and 3 dollar amounts") and to
// generate format-aware follow-up recommendations.
//
// Pure functions — no React, no localStorage, no side effects. Safe to
// call from anywhere on the client.

import type {
  ContentAnalysis,
  ContentCtaPattern,
  ContentFormatType,
  ContentHookStyle,
  SlideContent,
} from "./storage";
import type { Slide } from "@/lib/post-templates";

// ── Entity dictionaries ────────────────────────────────────────────────
//
// These are extension points — the team can grow these lists as they
// see new entities show up in their posts. Cities are matched
// case-insensitively; people and brands case-sensitively at word
// boundaries (per spec).

export const KNOWN_CITIES: string[] = [
  // Markets that show up in real Dr. Jeff posts
  "Toledo",
  "Joshua Tree",
  "Killeen",
  "Fayetteville",
  "Columbus",
  "Clarksville",
  "Abilene",
  "Dayton",
  "Cave City",
  "Panguitch",
  "Terlingua",
  "Fort Cavazos",
  "Fort Liberty",
  "Spartanburg",
  "Mammoth Cave",
  "New River Gorge",
  "Red River Gorge",
  "Detroit",
  "Pueblo",
  "Salida",
  "Chattanooga",
  "Atlanta",
  "Charlotte",
  "Greenville",
  // Counties referenced as markets
  "Wolfe County",
  "Hocking County",
  "Fayette County",
  "Muscogee County",
  "Oconee County",
  "Sequatchie County",
];

export const KNOWN_PEOPLE: string[] = [
  "Rick",
  "Roeben",
  "Trump",
  "Jeff",
  "Wilson",
  "Powell",
  "Biden",
  "Musk",
];

export const KNOWN_BRANDS: string[] = [
  "HostBuddy",
  "PriceLabs",
  "Hospitable",
  "Turno",
  "AirDNA",
  "Airbnb",
  "VRBO",
  "Wayfair",
  "Hostshare",
  "Edge",
  "Photolab",
  "Teeco",
  "Spoak",
  "Matterport",
  "Polycam",
  "Rabbu",
];

const US_STATE_RE = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Number extraction ─────────────────────────────────────────────────

function extractDollarAmounts(text: string): string[] {
  // Matches $25K, $250K+, $1.5M, $4,371, $250,000
  const matches = text.match(/\$[\d,]+(?:\.\d+)?[KMkm]?\+?/g) ?? [];
  return uniq(matches);
}

function extractPercentages(text: string): string[] {
  // Matches 100%, 32-37%, 12.5%
  const matches = text.match(/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?%/g) ?? [];
  return uniq(matches);
}

function extractYears(text: string): string[] {
  const matches = text.match(/\b20[2-3]\d\b/g) ?? [];
  return uniq(matches);
}

// ── Entity extraction ─────────────────────────────────────────────────

function extractCities(text: string): string[] {
  const found: string[] = [];
  for (const city of KNOWN_CITIES) {
    const re = new RegExp(`\\b${escapeRegex(city)}\\b`, "i");
    if (re.test(text)) found.push(city);
  }
  // Catch unknown TitleCase 1-2 word cities followed by ", [State]".
  // Pattern: "Foo, TX" or "Foo Bar, NY".
  const titleCaseRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s+[A-Z]{2}\b/g;
  let m: RegExpExecArray | null;
  while ((m = titleCaseRe.exec(text)) !== null) {
    const cityName = m[1];
    if (!found.includes(cityName) && US_STATE_RE.test(m[0])) {
      found.push(cityName);
    }
  }
  return uniq(found);
}

function extractPeople(text: string): string[] {
  const found: string[] = [];
  for (const person of KNOWN_PEOPLE) {
    const re = new RegExp(`\\b${escapeRegex(person)}\\b`);
    if (re.test(text)) found.push(person);
  }
  return uniq(found);
}

function extractBrands(text: string): string[] {
  const found: string[] = [];
  for (const brand of KNOWN_BRANDS) {
    const re = new RegExp(`\\b${escapeRegex(brand)}\\b`);
    if (re.test(text)) found.push(brand);
  }
  return uniq(found);
}

function extractBoldedTerms(text: string): string[] {
  const out: string[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].trim();
    if (v) out.push(v);
  }
  return uniq(out);
}

// ── Format detection (in spec precedence order) ───────────────────────

function detectFormat(slides: SlideContent[], joined: string): ContentFormatType {
  if (slides.length === 0) return "unknown";
  const slide1 = slides[0]?.text.trim() ?? "";

  // 1. list — slide 1 starts with a number followed by a noun, OR 3+
  // slides start with a numbered list item ("1.", "2.", …)
  const slide1StartsWithNumber = /^\s*\d+\s+\w+/.test(slide1);
  const numberedSlideCount = slides.filter((s) =>
    /(^|\n)\s*\d+\.\s/.test(s.text),
  ).length;
  if (slide1StartsWithNumber || numberedSlideCount >= 3) return "list";

  // 2. before_after — explicit before/after, or "from $X to $Y" pattern
  const hasBefore = slides.some((s) => /\bbefore\b/i.test(s.text));
  const hasAfter = slides.some((s) => /\bafter\b/i.test(s.text));
  const hasFromTo = slides.some((s) =>
    /from\s+\$[\d,]+(?:\.\d+)?[KMkm]?\s+to\s+\$[\d,]+(?:\.\d+)?[KMkm]?/i.test(s.text),
  );
  if ((hasBefore && hasAfter) || hasFromTo) return "before_after";

  // 3. math_walkthrough — 3+ slides w/ dollar amounts AND at least one
  // slide doing visible math
  const slidesWithDollar = slides.filter((s) => /\$[\d,]+/.test(s.text)).length;
  const hasMathExpr = slides.some(
    (s) =>
      /\$[\d,]+(?:\.\d+)?[KMkm]?\s*[\/×x*]\s*\$?[\d,]+/i.test(s.text) ||
      /\d+(?:\.\d+)?%\s*[×x*]\s*\$?[\d,]+/i.test(s.text) ||
      /=\s*\$?[\d,]+/.test(s.text),
  );
  if (slidesWithDollar >= 3 && hasMathExpr) return "math_walkthrough";

  // 4. contrarian — slide 1 only
  const contrarianPatterns: RegExp[] = [
    /\bis\s+dead\b/i,
    /\bis\s+wrong\b/i,
    /\beveryone\s+is\s+wrong\b/i,
    /\bcannot\s+(replace|do|outperform)\b/i,
    /\bstop\s+\w+(?:\s+\w+)?\s+start\s+\w+/i,
    /\bactually\b.*\b(works|wins|matters)\b/i,
  ];
  if (contrarianPatterns.some((p) => p.test(slide1))) return "contrarian";

  // 5. story — first-person pronouns in 60%+ of slides AND a narrative
  // arc cue somewhere
  if (slides.length >= 3) {
    const personalSlides = slides.filter((s) => /\b(I|we)\b/.test(s.text)).length;
    const personalRatio = personalSlides / slides.length;
    const hasArc = /\b(was|used to|then|years?\s+ago|before that|today|now)\b/i.test(joined);
    if (personalRatio >= 0.6 && hasArc) return "story";
  }

  // 6. framework — recurring "trait/rule/principle/step/law" across 3+
  // slides
  const frameworkKeywords = ["trait", "rule", "principle", "step", "law"];
  const frameworkSlideCount = slides.filter((s) =>
    frameworkKeywords.some((kw) => new RegExp(`\\b${kw}s?\\b`, "i").test(s.text)),
  ).length;
  if (frameworkSlideCount >= 3) return "framework";

  return "unknown";
}

// ── Hook style (slide 1 only) ─────────────────────────────────────────

function detectHookStyle(slide1: string): ContentHookStyle {
  const t = slide1.trim();
  if (!t) return "unknown";

  // 1. counter_intuitive
  if (
    /\bis\s+dead\b/i.test(t) ||
    /\bis\s+wrong\b/i.test(t) ||
    /^stop\s+\w+/i.test(t) ||
    /\bcannot\s+(replace|do|outperform)\b/i.test(t) ||
    /\bactually\b/i.test(t)
  ) {
    return "counter_intuitive";
  }

  // 2. list_promise — number then noun ("5 markets", "10 tools")
  if (/^\s*\d+\s+\w+/.test(t)) return "list_promise";

  // 3. news_driven — year, news verb, or known public figure
  if (
    /\b20[2-3]\d\b/.test(t) ||
    /\bjust\s+(signed|changed|announced|did|launched|released)\b/i.test(t) ||
    /\b(Trump|Biden|Powell|Musk)\b/.test(t)
  ) {
    return "news_driven";
  }

  // 4. specific_number — dollar amount or percentage
  if (/\$[\d,]+/.test(t) || /\d+(?:\.\d+)?%/.test(t)) {
    return "specific_number";
  }

  // 5. question
  if (t.endsWith("?")) return "question";

  return "unknown";
}

// ── CTA pattern (last slide only) ─────────────────────────────────────

function detectCtaPattern(lastSlide: string): {
  pattern: ContentCtaPattern;
  keyword?: string;
} {
  const t = lastSlide.trim();
  if (!t) return { pattern: "unknown" };

  // dm_keyword — "DM me" / "DM" + capitalized keyword (with or without quotes)
  const dmKeywordRe =
    /\b(?:DM|dm)\s+(?:me\s+)?["'`]?([A-Z][A-Z0-9-]{1,15})["'`]?/;
  const m = dmKeywordRe.exec(t);
  if (m) {
    return { pattern: "dm_keyword", keyword: m[1] };
  }

  // soft_offer — generic DM/comment/link in bio
  if (/\b(DM|comment|link\s+in\s+bio)\b/i.test(t)) {
    return { pattern: "soft_offer" };
  }

  // no_cta — no action ask at all
  const hasAction = /\b(get|grab|join|start|book|read|share|follow|subscribe|sign\s+up)\b/i.test(t);
  if (!hasAction) return { pattern: "no_cta" };

  return { pattern: "unknown" };
}

// ── Public entry point ────────────────────────────────────────────────

export function analyzeContent(slides: SlideContent[]): ContentAnalysis {
  const joined = slides.map((s) => s.text).join("\n");
  const slide1 = slides[0]?.text ?? "";
  const lastSlide = slides[slides.length - 1]?.text ?? "";

  const dollars = extractDollarAmounts(joined);
  const percents = extractPercentages(joined);
  const years = extractYears(joined);
  const cities = extractCities(joined);
  const people = extractPeople(joined);
  const brands = extractBrands(joined);
  const bold = extractBoldedTerms(joined);

  const totalWords = slides.reduce((sum, s) => sum + countWords(s.text), 0);
  const avgWords = slides.length === 0 ? 0 : Math.round(totalWords / slides.length);

  const cta = detectCtaPattern(lastSlide);

  return {
    formatType: detectFormat(slides, joined),
    slideCount: slides.length,
    dollarAmounts: dollars,
    percentages: percents,
    yearReferences: years,
    namedCities: cities,
    namedPeople: people,
    namedBrands: brands,
    hookStyle: detectHookStyle(slide1),
    averageSlideLength: avgWords,
    ctaPattern: cta.pattern,
    ctaKeyword: cta.keyword,
    boldedTerms: bold,
  };
}

// ── Post Builder Slide → SlideContent flattener ───────────────────────
//
// Reads (never writes) the Post Builder Slide discriminated union and
// produces a single text blob plus position-based hook/CTA flags. Used
// by SlideCaptureModal when the user links a Post Builder draft.

export function slideToText(slide: Slide): string {
  switch (slide.type) {
    case "hook-opener": {
      const items = slide.items?.map((it, i) => `${i + 1}. ${it}`).join("\n");
      return [slide.headline, slide.subtitle, items, slide.footer?.join("\n")]
        .filter(Boolean)
        .join("\n\n");
    }
    case "personal-story":
      return slide.paragraphs.join("\n\n");
    case "criteria-bullets": {
      const bullets = slide.bullets.map((b) => `• ${b}`).join("\n");
      return [slide.heading, bullets, slide.footer]
        .filter(Boolean)
        .join("\n\n");
    }
    case "market-detail": {
      const bullets = slide.bullets.map((b) => `• ${b}`).join("\n");
      const stats = slide.stats?.map((s) => `${s.label}: ${s.value}`).join("\n");
      return [
        `#${slide.rank} ${slide.title}`,
        slide.subtitle,
        bullets,
        stats,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "numbered-list": {
      const items = slide.items.map((it, i) => `${i + 1}. ${it}`).join("\n");
      return [slide.heading, items].filter(Boolean).join("\n\n");
    }
    case "plain-text":
      return slide.paragraphs.join("\n\n");
    case "cta":
      return slide.paragraphs.join("\n\n");
  }
}

// Build a SlideContent[] from a Post Builder draft's Slide[].
export function slidesFromPostBuilder(slides: Slide[]): SlideContent[] {
  const total = slides.length;
  return slides.map((s, i) => ({
    slideNumber: i + 1,
    text: slideToText(s),
    isHook: i === 0,
    isCTA: i === total - 1,
  }));
}

// ── Manual paste parser ───────────────────────────────────────────────
//
// Tries three strategies in order until one yields ≥ 3 chunks:
//   1. "Slide N:" / "Section N:" markers
//   2. "---" separator lines
//   3. blank-line separators (3+ newlines)
// Falls back to a single-slide treatment.
//
// Strips "Slide N:" / "Section N:" labels from chunk starts before
// returning.

export function parseManualSlides(raw: string): SlideContent[] {
  if (!raw.trim()) return [];

  const lines = raw.split("\n");
  const labelRe = /^(?:Slide|Section)\s+\d+\s*:?\s*$/i;
  const labelIndices: number[] = [];
  lines.forEach((line, i) => {
    if (labelRe.test(line.trim())) labelIndices.push(i);
  });

  let chunks: string[] = [];

  if (labelIndices.length >= 3) {
    for (let i = 0; i < labelIndices.length; i++) {
      const start = labelIndices[i] + 1;
      const end =
        i + 1 < labelIndices.length ? labelIndices[i + 1] : lines.length;
      const chunk = lines.slice(start, end).join("\n").trim();
      if (chunk) chunks.push(chunk);
    }
  }

  if (chunks.length < 3) {
    const dashChunks = raw
      .split(/^\s*-{3,}\s*$/m)
      .map((c) => stripLeadingLabel(c.trim()))
      .filter(Boolean);
    if (dashChunks.length >= 3) chunks = dashChunks;
  }

  if (chunks.length < 3) {
    const blankChunks = raw
      .split(/\n{3,}/)
      .map((c) => stripLeadingLabel(c.trim()))
      .filter(Boolean);
    if (blankChunks.length >= 3) chunks = blankChunks;
  }

  if (chunks.length < 3) {
    // Not enough delimiters — treat the whole thing as one slide. Caller
    // can warn the user.
    chunks = [stripLeadingLabel(raw.trim())].filter(Boolean);
  }

  const total = chunks.length;
  return chunks.map((text, i) => ({
    slideNumber: i + 1,
    text,
    isHook: i === 0,
    isCTA: i === total - 1,
  }));
}

function stripLeadingLabel(text: string): string {
  // Removes a leading "Slide N:" or "Section N:" line if present.
  return text.replace(/^(?:Slide|Section)\s+\d+\s*:?\s*\n?/i, "").trim();
}
