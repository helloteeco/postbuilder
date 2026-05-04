// Builds a copy-paste-ready prompt for Claude.ai that remixes a
// top-performing post. The point isn't to redesign the post — it's
// the opposite: keep the body slides + CTA almost verbatim (we know
// they worked) and swap in a fresh cover hook so the user can repost
// 60-90 days later without their audience recognizing the duplicate.
//
// Output is a single ready-to-use post, NOT a menu of options. Claude
// is instructed to brainstorm 5 candidates internally, evaluate them
// against scroll-stopping criteria, and output ONLY the winner —
// formatted slide-by-slide so the user can paste it straight into
// the Post Builder's "Paste text" mode.
//
// Strategy:
//   - Body slides 2..N-1 are sacred. Same numbers, same named entities,
//     same examples, same structure per slide. At most a 1-2 word tweak
//     per bullet for freshness.
//   - The cover (slide 1) is where Claude varies things. Internal
//     brainstorm across 5 hook styles, then pick the strongest single
//     headline + subtitle.
//   - CTA is locked verbatim. That part converted; don't break it.
//
// We feed Claude:
//   - The post's metrics so it knows WHY this is worth remixing
//   - The structural fingerprint from contentAnalysis so Claude
//     understands what made it work (specificity density, bolding
//     cadence, hook style)
//   - The full slide-by-slide text so Claude has the literal content
//     to keep close.
//
// Pure function — no I/O, no side effects, easy to test.

import type { LoggedPost, PostSnapshot } from "./storage";
import { saveRate, shareRate } from "./storage";

const FORMAT_LABELS: Record<string, string> = {
  list: "ranked / numbered list",
  story: "personal story",
  math_walkthrough: "math walkthrough",
  before_after: "before / after transformation",
  contrarian: "contrarian take",
  framework: "framework / criteria breakdown",
  unknown: "mixed",
};

const HOOK_LABELS: Record<string, string> = {
  counter_intuitive: "counter-intuitive / nobody-talks-about-this",
  list_promise: "list-promise (e.g. \"5 things…\")",
  news_driven: "news / timely peg",
  specific_number: "specific number (dollar amount, year, count)",
  question: "open question",
  unknown: "freeform",
};

const CTA_LABELS: Record<string, string> = {
  dm_keyword: "DM keyword",
  soft_offer: "soft offer / free resource",
  no_cta: "no explicit CTA",
  unknown: "freeform CTA",
};

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

// Picks the best snapshot to describe the post by — the 36-72h
// detection window when present, else the latest snapshot. Mirrors the
// fallback logic in timingHelpers.getDetectionSnapshot but inlined to
// avoid a circular import (this module should only read storage types).
function pickSnapshot(post: LoggedPost): PostSnapshot | null {
  const fortyEight = post.snapshots.find(
    (s) => s.hoursAfterPosting >= 36 && s.hoursAfterPosting <= 72,
  );
  if (fortyEight) return fortyEight;
  return post.snapshots[post.snapshots.length - 1] ?? null;
}

export function buildRemixPrompt(post: LoggedPost): string {
  const snap = pickSnapshot(post);
  const slides = post.slides ?? [];
  const a = post.contentAnalysis;

  const lines: string[] = [];

  lines.push(
    "You are remixing one of my high-performing Instagram carousels. The original post outperformed my baseline — the structure, framing, and content choices clearly resonated with my audience. I want to repost this material 60-90 days from now without my audience recognizing it as a duplicate.",
    "",
    "Your job: produce ONE ready-to-publish remix. Same body slides, same CTA, fresh cover hook. I do NOT want a menu of options — I want the single best version, ready to paste straight into my slide builder.",
    "",
    "PROCESS — do this internally before writing the final output:",
    "1. Brainstorm 5 cover-hook candidates spanning different angles: question, contrarian / nobody-talks-about-this, list-promise, specific-number, news-driven peg. Don't show me these.",
    "2. Score each candidate against:",
    "   a. Stops the scroll on a cold feed (curiosity / pattern interrupt)",
    "   b. Promises the SAME outcome as the original (don't drift the substance)",
    "   c. Reads natural — not clickbait, not corporate, in my voice",
    "   d. Far enough from the original wording that a returning viewer won't recognize it",
    "3. Pick the single highest-scoring candidate. Output only that one.",
    "",
    "RULES for the final output:",
    "1. Cover (slide 1): the chosen winner — fresh headline + optional subtitle. Headline ≤ 7 words, ≤ 40 characters, no individual word over 12 chars. Subtitle ≤ 60 chars, optional.",
    "2. Body slides (slides 2 through N-1): keep nearly identical to the original. Same number of slides. Same structure per slide. Same numbers, same dollar amounts, same percentages, same named cities/people/brands. You may tweak ONE bullet per slide for freshness (swap a verb, reorder a clause) but don't add or remove information.",
    "3. CTA (final slide): LOCKED. Reproduce verbatim. Do not rephrase. That part converted.",
    "4. Preserve the post's voice and bolding cadence. Wrap roughly the same number of words in **double asterisks** per slide as the original. Bold the same nouns and numbers.",
    "5. Do NOT introduce new claims, new numbers, or new examples. This is a remix, not a fresh post.",
    "",
    "WHY THIS POST IS WORTH REMIXING:",
  );

  if (snap) {
    const sR = saveRate(snap.metrics);
    const shR = shareRate(snap.metrics);
    lines.push(
      `- 48h-equivalent reach: ${snap.metrics.reach.toLocaleString()}`,
      `- Saves: ${snap.metrics.saves.toLocaleString()} (save rate ${fmtPct(sR)})`,
      `- Shares: ${snap.metrics.shares.toLocaleString()} (share rate ${fmtPct(shR)})`,
      `- Logged ${snap.hoursAfterPosting}h after posting`,
    );
  } else {
    lines.push("- (No metrics snapshot available — remixing on structural confidence only.)");
  }
  lines.push("");

  lines.push("ORIGINAL POST METADATA:");
  lines.push(`- Title: ${post.title}`);
  if (post.pillar) lines.push(`- Pillar: ${post.pillar}`);
  if (post.hookFormula) lines.push(`- Hook formula used: ${post.hookFormula}`);
  if (a) {
    lines.push(
      `- Format type: ${FORMAT_LABELS[a.formatType] ?? a.formatType}`,
      `- Hook style: ${HOOK_LABELS[a.hookStyle] ?? a.hookStyle}`,
      `- Slide count: ${a.slideCount}`,
      `- CTA pattern: ${CTA_LABELS[a.ctaPattern] ?? a.ctaPattern}${a.ctaKeyword ? ` (keyword: "${a.ctaKeyword}")` : ""}`,
    );
    if (a.dollarAmounts.length > 0) {
      lines.push(`- Dollar amounts that MUST stay: ${a.dollarAmounts.join(", ")}`);
    }
    if (a.percentages.length > 0) {
      lines.push(`- Percentages that MUST stay: ${a.percentages.join(", ")}`);
    }
    if (a.yearReferences.length > 0) {
      lines.push(`- Years that MUST stay: ${a.yearReferences.join(", ")}`);
    }
    if (a.namedCities.length > 0) {
      lines.push(`- Named cities that MUST stay: ${a.namedCities.join(", ")}`);
    }
    if (a.namedPeople.length > 0) {
      lines.push(`- Named people that MUST stay: ${a.namedPeople.join(", ")}`);
    }
    if (a.namedBrands.length > 0) {
      lines.push(`- Named brands that MUST stay: ${a.namedBrands.join(", ")}`);
    }
    if (a.boldedTerms.length > 0) {
      lines.push(
        `- Terms originally bolded (preserve the bolding pattern): ${a.boldedTerms.join(", ")}`,
      );
    }
  }
  lines.push("");

  lines.push("ORIGINAL SLIDE CONTENT (slide-by-slide):");
  lines.push("");
  for (const s of slides) {
    const role = s.isHook ? "COVER (remix this)" : s.isCTA ? "CTA (lock verbatim)" : "BODY (keep nearly identical)";
    lines.push(`─── Slide ${s.slideNumber} · ${role} ───`);
    lines.push(s.text || "(empty)");
    lines.push("");
  }

  lines.push("OUTPUT FORMAT — single post, ready to paste into my slide builder:");
  lines.push("");
  lines.push("Use this exact shape, no commentary, no preface, no \"here is the remix\", no markdown headers — just the slides:");
  lines.push("");
  lines.push("Slide 1: <fresh cover headline>");
  lines.push("<optional one-line subtitle>");
  lines.push("");
  lines.push("Slide 2: <body slide 2 text, **bolding** preserved>");
  lines.push("");
  lines.push("Slide 3: <body slide 3 text>");
  lines.push("");
  lines.push("(continue through every slide in order)");
  lines.push("");
  lines.push(`Slide ${slides.length || "N"}: <CTA verbatim from original>`);
  lines.push("");
  lines.push("Use **double asterisks** for bolding, same as the original. Do not show your 5 brainstormed candidates. Do not include angle notes, scoring, or explanation. Output the slides only — first character should be \"Slide 1:\".");

  return lines.join("\n");
}
