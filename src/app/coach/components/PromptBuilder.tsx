// The main feature of Coach Mode: a one-click "copy this into Claude.ai"
// prompt that produces 10-section long-form copy for today's pillar.
// User pastes the response into Post Builder's "Paste text" tab and gets
// a finished carousel. No /api/analyze cost until they're happy with the
// long-form draft.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HOOK_FORMULAS,
  LOCKED_POST_BUILDER_SETTINGS,
  SLOT_POST_WINDOW,
  getDailyTopics,
  getHookForSlot,
  getPillarForSlot,
  pillarColorClasses,
} from "@/app/coach/lib/strategy";
import {
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  loadLoggedPosts,
  saveRate,
  shareRate,
  toCoachPost,
  type CoachPost,
  type LoggedPost,
  type PostSnapshot,
} from "@/app/coach/lib/storage";
import {
  getDetectionSnapshot,
  normalizeMetricsTo48h,
} from "@/app/coach/lib/timingHelpers";
import { dailyStoriesForPillar, type Story } from "@/app/coach/lib/storyBank";
import type { SelectedSlot } from "./CoachDashboard";

interface CtaOption {
  keyword: string;
  // What the CTA promises in exchange for the DM. Used in the prompt.
  promise: string;
}

const DEFAULT_CTAS: CtaOption[] = [
  { keyword: "RURAL", promise: "a free mini course" },
  { keyword: "TAX", promise: "a free mini course" },
  { keyword: "BUY-BOX", promise: "a free mini course" },
  { keyword: "OPS", promise: "a free mini course" },
];

// Composite score so a single number ranks both metrics. Save target is
// 1.5%, share target is 0.6%, so a "1.0" composite means roughly hitting
// both targets evenly. Weighting share rate higher (×2.5) because shares
// are the rarer / harder signal of resonance.
function compositeScore(p: CoachPost): number {
  return saveRate(p) / SAVE_RATE_TARGET + (shareRate(p) / SHARE_RATE_TARGET) * 2.5;
}

// Score a LoggedPost using its detection snapshot's normalized metrics
// — same fairness rule as the Top Post Mode badges. Returns null when
// the post can't be evaluated (no settled snapshot yet).
interface ScoredPost {
  cv: CoachPost; // 48h-equivalent flat view, used for rate display
  lp: LoggedPost; // full record, used for contentAnalysis + slide text
  score: number;
}

function scorePost(lp: LoggedPost): ScoredPost | null {
  const snap = getDetectionSnapshot(lp);
  if (!snap) return null;
  const normalized: PostSnapshot = {
    ...snap,
    metrics: normalizeMetricsTo48h(snap.metrics, snap.hoursAfterPosting),
  };
  const cv = toCoachPost(lp, normalized);
  return { cv, lp, score: compositeScore(cv) };
}

interface LearningContext {
  winners: ScoredPost[];
  losers: ScoredPost[];
  totalLogged: number;
}

function pickLearningContext(loggedPosts: LoggedPost[]): LearningContext {
  const scored: ScoredPost[] = loggedPosts
    .map(scorePost)
    .filter((x): x is ScoredPost => x !== null);
  const sorted = scored.slice().sort((a, b) => b.score - a.score);
  const winners = sorted.slice(0, 3);
  const losers = sorted.slice(-2).reverse();
  // Avoid winners and losers overlapping when there are <5 eligible posts.
  const winnerIds = new Set(winners.map((s) => s.lp.id));
  const filteredLosers = losers.filter((s) => !winnerIds.has(s.lp.id));
  return {
    winners,
    losers: filteredLosers,
    totalLogged: scored.length,
  };
}

// Compact one-liner for a winner/loser entry. When contentAnalysis is
// available, includes the structural fingerprint so Claude knows WHY
// the post performed (or didn't) at a structural level — not just the
// metric outcome.
function postLine(s: ScoredPost): string {
  const a = s.lp.contentAnalysis;
  const head = `  • "${s.cv.title}" (${s.cv.datePosted}, save ${saveRate(s.cv).toFixed(2)}%, share ${shareRate(s.cv).toFixed(2)}%)`;
  if (!a) return head;
  const fp: string[] = [];
  if (a.formatType !== "unknown") fp.push(`format: ${a.formatType.replace(/_/g, " ")}`);
  fp.push(`${a.slideCount} slides, ~${a.averageSlideLength} words/slide`);
  if (a.hookStyle !== "unknown") fp.push(`hook: ${a.hookStyle.replace(/_/g, " ")}`);
  if (a.dollarAmounts.length > 0) {
    fp.push(`$ amounts: ${a.dollarAmounts.slice(0, 5).join(", ")}`);
  }
  if (a.namedCities.length > 0) fp.push(`cities: ${a.namedCities.slice(0, 5).join(", ")}`);
  if (a.namedPeople.length > 0) fp.push(`people: ${a.namedPeople.join(", ")}`);
  if (a.namedBrands.length > 0) fp.push(`brands: ${a.namedBrands.slice(0, 5).join(", ")}`);
  if (a.boldedTerms.length > 0) fp.push(`bolded: ${a.boldedTerms.slice(0, 6).join(", ")}`);
  if (a.ctaPattern !== "unknown") {
    fp.push(`CTA: ${a.ctaPattern.replace(/_/g, " ")}${a.ctaKeyword ? ` "${a.ctaKeyword}"` : ""}`);
  }
  return `${head}\n      ${fp.join(" · ")}`;
}

// Full slide-by-slide dump of the #1 winner. Gives Claude the actual
// writing it should mirror — pacing, sentence length, specificity,
// bolding cadence. Empty when the top winner has no captured slides.
function deepStudyBlock(top: ScoredPost | undefined): string {
  if (!top || !top.lp.slides || top.lp.slides.length === 0) return "";
  const slideText = top.lp.slides
    .map((s) => `Slide ${s.slideNumber}${s.isHook ? " (hook)" : s.isCTA ? " (CTA)" : ""}:\n${s.text}`)
    .join("\n\n");
  return `

DEEP-STUDY YOUR #1 WINNER ("${top.cv.title}"):
This post outperformed your average. The slide-by-slide content is below.
MIRROR its structural pattern in the new post:
  - same format type and slide count
  - same hook style for Section 1
  - same level of specificity (concrete numbers, named places, named people)
  - same bolding cadence (which words get **bolded**)
  - same CTA pattern

${slideText}`;
}

// Format up to N stories from the user's Story Bank into a labelled
// block Claude can pull anchor material from. Returns an empty string
// when the bank has nothing for the active pillar — in that case the
// downstream prompt skips the section entirely instead of telling
// Claude "(no stories yet)" which dilutes the rest of the prompt.
function storiesBlock(stories: Story[]): string {
  if (stories.length === 0) return "";
  const lines = stories
    .map((s, i) => `${i + 1}. ${s.title}\n${s.body}`)
    .join("\n\n");
  return `PERSONAL STORIES YOU CAN DRAW FROM (real anecdotes from this creator's life — names, places, dollar amounts, moments, all real). Weave at least one of these naturally into the post where it fits the topic. Use the specific people, places, and numbers verbatim — don't paraphrase them away. If none truly fit the current topic, skip them rather than force-fit:

${lines}

`;
}

function buildPrompt({
  topic,
  pillarName,
  pillarDescription,
  hookTemplate,
  ctaKeyword,
  ctaPromise,
  learning,
  stories,
  todayDate,
}: {
  topic: string;
  pillarName: string;
  pillarDescription: string;
  hookTemplate: string;
  ctaKeyword: string;
  ctaPromise: string;
  learning: LearningContext;
  // Up to 2 stories from the user's Story Bank tagged to the active
  // pillar. Empty array if the user hasn't deposited any yet.
  stories: Story[];
  todayDate: Date;
}): string {
  const { audience, tone, readingLevel, creatorIdentity } =
    LOCKED_POST_BUILDER_SETTINGS;

  // Build the past-performance section. If there's no data, say so honestly
  // instead of inventing context — Claude will perform better without
  // fabricated examples.
  let learningBlock: string;
  if (learning.totalLogged === 0) {
    learningBlock = `(No prior post performance logged yet. Lean on the pillar + hook formula above. As more posts are logged in the Coach Mode tracker — and slide content captured — this section will fill in with what's worked structurally, not just by metrics.)`;
  } else {
    const winnerLines =
      learning.winners.length > 0
        ? learning.winners.map(postLine).join("\n")
        : "  (none yet)";
    const loserLines =
      learning.losers.length > 0
        ? learning.losers.map(postLine).join("\n")
        : "  (none yet)";
    const deepStudy = deepStudyBlock(learning.winners[0]);
    learningBlock = `Top-performing posts so far — mirror their structural patterns (format, slide count, hook style, specificity, bolding, CTA pattern). The fingerprint after each post tells you HOW it was structured:
${winnerLines}

Underperforming posts — avoid these structural patterns:
${loserLines}

Targets to beat: save rate ≥${SAVE_RATE_TARGET}%, share rate ≥${SHARE_RATE_TARGET}%.${deepStudy}`;
  }

  return `You are a ghostwriter for ${creatorIdentity}.

Write a 10-section long-form Instagram carousel post on this topic.

DATE: ${todayDate.toDateString()}

TOPIC: ${topic}

TODAY'S CONTENT PILLAR: ${pillarName} — ${pillarDescription}

HOOK FORMULA TO USE FOR SECTION 1:
${hookTemplate}

AUDIENCE: ${audience}.
TONE: ${tone}.
READING LEVEL: ${readingLevel}. Short, plain words. No jargon. No fluff.

CTA: DM "${ctaKeyword}" to get ${ctaPromise}.

${storiesBlock(stories)}WHAT'S WORKED FOR THIS ACCOUNT (real performance data):
${learningBlock}

STRUCTURE:
- Section 1: Hook that stops the scroll. Use the hook formula above. Punchy, 6-9 words. The whole point of the post in one line.
- Sections 2-9: 8 supporting points, examples, or steps that build the case. Each 2-4 short sentences (40-80 words).
- Section 10: CTA — direct readers to DM "${ctaKeyword}". Use the promise EXACTLY as written above ("${ctaPromise}") — do NOT invent, expand, or describe what's inside it. Don't promise modules, lessons, PDFs, checklists, spreadsheets, or anything else not literally written above. If the promise is "a free mini course", say "free mini course" — nothing more.

HARD RULES:
- MATCH THE STRUCTURAL PATTERN of the top-performing posts above. Specifically:
  * Same FORMAT TYPE as the #1 winner (list / story / math walkthrough / before-after / contrarian / framework). If the winner is a list, this post is a list. If the winner is a math walkthrough, this post does math.
  * Same HOOK STYLE for Section 1 (counter-intuitive / list-promise / news-driven / specific-number / question).
  * Same SPECIFICITY DENSITY — if the winner had 4 named cities and 3 dollar amounts, target a similar density. Borrow from the winner's named entities where the topic allows.
  * Same BOLDING CADENCE — bold the kinds of words the winner bolded (numbers, place names, emotional triggers).
  * Same CTA PATTERN — if the winner used a DM-keyword CTA, do the same.
- AVOID the structural patterns of the underperformers (different format, different hook style, lower specificity).
- If a DEEP-STUDY block is included above, treat the slide-by-slide text as your primary writing model. Match its sentence length, pacing, line breaks, and bolding rhythm — not its words. Different topic, same voice.
- Specific numbers, not rounded. ($75,940 over "about $76K".)
- 3rd-grade reading level throughout.
- Bold 2-4 high-impact words per section using **double asterisks** (e.g. **$300K**, **outperforms**, **nobody talks about this**). Bold the nouns and numbers, not whole sentences.
- No emojis. No hashtags. No markdown headers beyond the "Section N:" labels.
- Don't preface with intro text — go straight to "Section 1:".
- NEVER fabricate specifics about what gets DMed. The CTA promise above is the only thing you may reference.

OUTPUT FORMAT:

Section 1:
[hook copy here]

Section 2:
[copy here]

…through Section 10.`;
}

interface PromptBuilderProps {
  // Optional override from WeekCalendar. When set, the prompt builder
  // switches to that date+slot's pillar/hook/topics instead of "today AM".
  selectedSlot?: SelectedSlot | null;
}

export default function PromptBuilder({ selectedSlot }: PromptBuilderProps = {}) {
  // Resolve the active (date, slot) pair: either the user-clicked slot or
  // today's AM by default.
  const activeDate = useMemo(() => {
    if (selectedSlot?.isoDate) {
      // Parse "yyyy-mm-dd" as a local date (avoid the UTC midnight pitfall
      // of new Date("yyyy-mm-dd") which can shift by a day).
      const [y, m, d] = selectedSlot.isoDate.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1);
    }
    return new Date();
  }, [selectedSlot?.isoDate]);

  const activeSlot = selectedSlot?.slot ?? "am";
  const activePillar = getPillarForSlot(activeDate, activeSlot);
  const activeHook = getHookForSlot(activeDate, activeSlot);

  const dailyTopics = useMemo(
    () => getDailyTopics(activeDate, activePillar.id, 5),
    [activeDate, activePillar.id],
  );

  const [topic, setTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");
  const [hookId, setHookId] = useState<string>("");
  const [ctaKeyword, setCtaKeyword] = useState<string>(DEFAULT_CTAS[0].keyword);
  const [ctaPromise, setCtaPromise] = useState<string>(DEFAULT_CTAS[0].promise);
  const [copied, setCopied] = useState(false);
  const [loggedPosts, setLoggedPosts] = useState<LoggedPost[]>([]);

  // Reset topic + hook whenever the active slot changes — otherwise stale
  // selections from a previous slot's pillar carry over.
  useEffect(() => {
    setTopic(dailyTopics[0] ?? "");
    setHookId(activeHook.id);
  }, [activeDate, activeSlot, activeHook.id, dailyTopics]);

  // Pull the latest performance logs so the generated prompt is informed
  // by what's actually working — including the structural fingerprint
  // of each winner (format, hook style, specificity, bolding, CTA
  // pattern) plus the slide-by-slide text of the #1 winner as a deep-
  // study writing model.
  useEffect(() => {
    setLoggedPosts(loadLoggedPosts());
  }, []);

  const learning = useMemo(() => pickLearningContext(loggedPosts), [loggedPosts]);

  // Pull up to 2 stories tagged to the active pillar. Deterministic
  // by date+pillar so the same suggestions surface for the whole day
  // — switching slots reshuffles when the pillar changes, switching
  // hooks doesn't.
  const pillarStories = useMemo(
    () => dailyStoriesForPillar(activeDate, activePillar.id, 2),
    [activeDate, activePillar.id],
  );

  const selectedHook =
    HOOK_FORMULAS.find((h) => h.id === hookId) ?? activeHook;
  const finalTopic = topic === "__custom__" ? customTopic : topic;
  const colors = pillarColorClasses(activePillar.color);

  const prompt = buildPrompt({
    topic: finalTopic || "(pick a topic above)",
    pillarName: activePillar.name,
    pillarDescription: activePillar.description,
    hookTemplate: selectedHook.template,
    ctaKeyword,
    ctaPromise,
    learning,
    stories: pillarStories,
    todayDate: activeDate,
  });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — fall back to selecting the textarea.
      const ta = document.getElementById(
        "coach-prompt-output",
      ) as HTMLTextAreaElement | null;
      ta?.select();
    }
  }

  function pickCtaPreset(keyword: string) {
    const preset = DEFAULT_CTAS.find((c) => c.keyword === keyword);
    if (preset) {
      setCtaKeyword(preset.keyword);
      setCtaPromise(preset.promise);
    }
  }

  const slotBadge = selectedSlot
    ? `${activeDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${activeSlot.toUpperCase()} (${SLOT_POST_WINDOW[activeSlot]})`
    : `Today · AM (${SLOT_POST_WINDOW.am})`;

  return (
    <section
      id="coach-prompt-builder"
      className={`rounded-xl border-2 ${colors.border} bg-white p-6 shadow-sm`}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Step 1 — Generate the long-form copy
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full ${colors.bgSoft} ${colors.text} px-2.5 py-0.5 text-xs font-medium`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${colors.bg}`}
              aria-hidden
            />
            {slotBadge}
          </span>
        </div>
      </div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">
        Claude.ai prompt builder
      </h2>
      <p className="mb-5 text-sm text-gray-600">
        Pick a topic and CTA, copy the prompt, paste it into Claude.ai. Paste
        the response into the Post Builder&apos;s <em>Paste text</em> tab and
        you&apos;ll have a 10-slide carousel in 30 seconds. Click any slot in
        the 7-day calendar below to switch this prompt to that day&apos;s
        pillar and hook.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-xs text-gray-600">
          Topic (today&apos;s 5 ideas, or write your own)
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {dailyTopics.map((t: string) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom__">Custom (write your own)…</option>
          </select>
          {topic === "__custom__" && (
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Type your topic"
              className="mt-1.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          )}
        </label>

        <label className="block text-xs text-gray-600">
          Hook formula
          <select
            value={hookId}
            onChange={(e) => setHookId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {HOOK_FORMULAS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id === activeHook.id ? "★ " : ""}
                {h.template}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-600">
          CTA keyword
          <input
            type="text"
            value={ctaKeyword}
            onChange={(e) => setCtaKeyword(e.target.value.toUpperCase())}
            placeholder="RURAL"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DEFAULT_CTAS.map((c) => (
              <button
                key={c.keyword}
                type="button"
                onClick={() => pickCtaPreset(c.keyword)}
                className={`rounded border px-2 py-0.5 text-[11px] transition ${
                  ctaKeyword === c.keyword
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {c.keyword}
              </button>
            ))}
          </div>
        </label>

        <label className="block text-xs text-gray-600">
          What the DM gets them
          <input
            type="text"
            value={ctaPromise}
            onChange={(e) => setCtaPromise(e.target.value)}
            placeholder="the 6-market rural Airbnb shortlist"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div
        className={`mb-3 rounded-md border px-3 py-2 text-xs ${
          learning.totalLogged === 0
            ? "border-dashed border-gray-300 bg-gray-50 text-gray-500"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}
      >
        {learning.totalLogged === 0 ? (
          <>
            <span className="font-semibold">No performance data yet.</span> The
            prompt below uses today&apos;s pillar + hook formula. Log a few
            posts in the tracker section and Coach Mode will start tailoring
            future prompts based on what&apos;s actually working.
          </>
        ) : (
          <>
            <span className="font-semibold">
              Self-learning: using {learning.totalLogged} logged post
              {learning.totalLogged === 1 ? "" : "s"}.
            </span>{" "}
            Top {learning.winners.length} winners and bottom{" "}
            {learning.losers.length} underperformer
            {learning.losers.length === 1 ? "" : "s"} are folded into the
            prompt so Claude mimics what&apos;s working and avoids what
            isn&apos;t.
          </>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Prompt to paste into Claude.ai
        </div>
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
        >
          {copied ? "✓ Copied" : "Copy prompt"}
        </button>
      </div>
      <textarea
        id="coach-prompt-output"
        readOnly
        value={prompt}
        rows={14}
        className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800"
      />

      <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
        <li>
          <span className="font-semibold text-gray-900">Copy</span> the prompt
          above.
        </li>
        <li>
          Open{" "}
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noreferrer"
            className="text-gray-900 underline hover:no-underline"
          >
            claude.ai
          </a>{" "}
          (or any LLM) and paste it. You&apos;ll get back 10 sections of
          long-form copy.
        </li>
        <li>
          Copy Claude&apos;s response, then{" "}
          <a
            href="/post-builder"
            className="font-semibold text-gray-900 underline hover:no-underline"
          >
            open the Post Builder
          </a>
          , go to <em>Paste text</em> tab, paste the response, and hit{" "}
          <em>Generate</em>.
        </li>
      </ol>
    </section>
  );
}
