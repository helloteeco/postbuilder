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
  getDailyTopics,
  getHookForDate,
  getPillarForDate,
  pillarColorClasses,
} from "@/app/coach/lib/strategy";
import {
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  loadPosts,
  saveRate,
  shareRate,
  type CoachPost,
} from "@/app/coach/lib/storage";

interface CtaOption {
  keyword: string;
  // What the CTA promises in exchange for the DM. Used in the prompt.
  promise: string;
}

const DEFAULT_CTAS: CtaOption[] = [
  { keyword: "RURAL", promise: "the 6-market rural Airbnb shortlist" },
  { keyword: "TAX", promise: "the STR tax loophole walkthrough" },
  { keyword: "BUY-BOX", promise: "the rural Airbnb buy-box checklist" },
  { keyword: "OPS", promise: "the 7-person operator team blueprint" },
];

// Composite score so a single number ranks both metrics. Save target is
// 1.5%, share target is 0.6%, so a "1.0" composite means roughly hitting
// both targets evenly. Weighting share rate higher (×2.5) because shares
// are the rarer / harder signal of resonance.
function compositeScore(p: CoachPost): number {
  return saveRate(p) / SAVE_RATE_TARGET + (shareRate(p) / SHARE_RATE_TARGET) * 2.5;
}

interface LearningContext {
  winners: CoachPost[];
  losers: CoachPost[];
  totalLogged: number;
}

function pickLearningContext(posts: CoachPost[]): LearningContext {
  const sorted = posts.slice().sort((a, b) => compositeScore(b) - compositeScore(a));
  const winners = sorted.slice(0, 3);
  const losers = sorted.slice(-2).reverse();
  // Avoid winners and losers overlapping when there are <5 logged.
  const winnerIds = new Set(winners.map((p) => p.id));
  const filteredLosers = losers.filter((p) => !winnerIds.has(p.id));
  return {
    winners,
    losers: filteredLosers,
    totalLogged: posts.length,
  };
}

function postLine(p: CoachPost): string {
  return `  • "${p.title}" (posted ${p.datePosted}) — save rate ${saveRate(p).toFixed(2)}%, share rate ${shareRate(p).toFixed(2)}%`;
}

function buildPrompt({
  topic,
  pillarName,
  pillarDescription,
  hookTemplate,
  ctaKeyword,
  ctaPromise,
  learning,
  todayDate,
}: {
  topic: string;
  pillarName: string;
  pillarDescription: string;
  hookTemplate: string;
  ctaKeyword: string;
  ctaPromise: string;
  learning: LearningContext;
  todayDate: Date;
}): string {
  const { audience, tone, readingLevel } = LOCKED_POST_BUILDER_SETTINGS;

  // Build the past-performance section. If there's no data, say so honestly
  // instead of inventing context — Claude will perform better without
  // fabricated examples.
  let learningBlock: string;
  if (learning.totalLogged === 0) {
    learningBlock = `(No prior post performance logged yet. Lean on the pillar + hook formula above. As more posts are logged in the Coach Mode tracker, this section will fill in with what's worked.)`;
  } else {
    const winnerLines =
      learning.winners.length > 0
        ? learning.winners.map(postLine).join("\n")
        : "  (none yet)";
    const loserLines =
      learning.losers.length > 0
        ? learning.losers.map(postLine).join("\n")
        : "  (none yet)";
    learningBlock = `Top-performing posts so far (use these patterns — angles, hook structures, level of specificity):
${winnerLines}

Underperforming posts (avoid these patterns — whatever made these flat shouldn't repeat):
${loserLines}

Targets to beat: save rate ≥${SAVE_RATE_TARGET}%, share rate ≥${SHARE_RATE_TARGET}%.`;
  }

  return `You are a ghostwriter for a real estate investor who teaches W2 high earners how to use rural Airbnbs to build wealth and replace W2 income.

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

WHAT'S WORKED FOR THIS ACCOUNT (real performance data):
${learningBlock}

STRUCTURE:
- Section 1: Hook that stops the scroll. Use the hook formula above. Punchy, 6-9 words. The whole point of the post in one line.
- Sections 2-9: 8 supporting points, examples, or steps that build the case. Each 2-4 short sentences (40-80 words).
- Section 10: CTA — direct readers to DM "${ctaKeyword}" for ${ctaPromise}. Make it clear and specific.

HARD RULES:
- Match the angles and specificity of the top-performing posts above. Avoid the patterns of the underperformers.
- Specific numbers, not rounded. ($75,940 over "about $76K".)
- 3rd-grade reading level throughout.
- Bold 2-4 high-impact words per section using **double asterisks** (e.g. **$300K**, **outperforms**, **nobody talks about this**). Bold the nouns and numbers, not whole sentences.
- No emojis. No hashtags. No markdown headers beyond the "Section N:" labels.
- Don't preface with intro text — go straight to "Section 1:".

OUTPUT FORMAT:

Section 1:
[hook copy here]

Section 2:
[copy here]

…through Section 10.`;
}

export default function PromptBuilder() {
  const today = new Date();
  const todayPillar = getPillarForDate(today);
  const todayHook = getHookForDate(today);
  const todayTopics = useMemo(
    () => getDailyTopics(today, todayPillar.id, 5),
    [today, todayPillar.id],
  );

  const [topic, setTopic] = useState<string>(todayTopics[0] ?? "");
  const [customTopic, setCustomTopic] = useState("");
  const [hookId, setHookId] = useState<string>(todayHook.id);
  const [ctaKeyword, setCtaKeyword] = useState<string>(DEFAULT_CTAS[0].keyword);
  const [ctaPromise, setCtaPromise] = useState<string>(DEFAULT_CTAS[0].promise);
  const [copied, setCopied] = useState(false);
  const [posts, setPosts] = useState<CoachPost[]>([]);

  // Pull the latest performance logs so the generated prompt is informed
  // by what's actually working. Re-runs on mount and whenever this
  // component is revealed (e.g. after the user navigates back from logging).
  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  const learning = useMemo(() => pickLearningContext(posts), [posts]);

  const selectedHook =
    HOOK_FORMULAS.find((h) => h.id === hookId) ?? todayHook;
  const finalTopic = topic === "__custom__" ? customTopic : topic;
  const colors = pillarColorClasses(todayPillar.color);

  const prompt = buildPrompt({
    topic: finalTopic || "(pick a topic above)",
    pillarName: todayPillar.name,
    pillarDescription: todayPillar.description,
    hookTemplate: selectedHook.template,
    ctaKeyword,
    ctaPromise,
    learning,
    todayDate: today,
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

  return (
    <section
      className={`rounded-xl border-2 ${colors.border} bg-white p-6 shadow-sm`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Step 1 — Generate the long-form copy
        </div>
      </div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">
        Claude.ai prompt builder
      </h2>
      <p className="mb-5 text-sm text-gray-600">
        Pick a topic and CTA, copy the prompt, paste it into Claude.ai. Paste
        the response into the Post Builder&apos;s <em>Paste text</em> tab and
        you&apos;ll have a 10-slide carousel in 30 seconds.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-xs text-gray-600">
          Topic (today&apos;s 5 ideas, or write your own)
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {todayTopics.map((t) => (
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
                {h.id === todayHook.id ? "★ " : ""}
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
