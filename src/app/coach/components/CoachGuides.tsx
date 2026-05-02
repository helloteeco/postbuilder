// "How to use Coach Mode" + "DIY in Claude.ai" guides shown in a single
// modal with two tabs. Same pattern as Post Builder's How-to-use modal.
//
// Why two guides: Coach Mode automates a strategy that you can also run
// manually in a Claude.ai chat. The DIY tab gives the user the raw
// prompts so they understand what's being automated and can do it
// without the tool if they want.

"use client";

import { useEffect, useState } from "react";

export type GuideTab = "how-to" | "diy";

interface Props {
  open: GuideTab | null;
  onClose: () => void;
}

export default function CoachGuides({ open, onClose }: Props) {
  // Local copy of the active tab so the user can switch inside the
  // modal without the parent driving it.
  const [tab, setTab] = useState<GuideTab>(open ?? "how-to");

  // Re-sync the active tab whenever the parent opens the modal on a
  // specific tab. Crucially this only fires when `open` itself
  // changes — clicking tabs inside the modal updates local `tab`
  // without triggering this effect, so internal switches stick.
  useEffect(() => {
    if (open !== null) setTab(open);
  }, [open]);

  if (open === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("how-to")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                tab === "how-to"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              How to use Coach Mode
            </button>
            <button
              type="button"
              onClick={() => setTab("diy")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                tab === "diy"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              DIY in Claude.ai
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {tab === "how-to" && <HowToTab />}
        {tab === "diy" && <DiyTab />}
      </div>
    </div>
  );
}

function HowToTab() {
  return (
    <>
      <h2 className="mb-1 text-lg font-bold text-gray-900">
        How to use Coach Mode to grow
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        The 8-step rhythm. Set it up once, run it weekly.
      </p>

      <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Why this works
        </div>
        <p className="text-sm text-gray-700">
          Posting consistently requires three decisions every day:{" "}
          <span className="font-semibold">what</span> to post,{" "}
          <span className="font-semibold">how</span> to write it, and{" "}
          <span className="font-semibold">when</span> to log the result. Each
          decision is small, but stacked across a year you make a thousand of
          them — that&apos;s where decision fatigue kills consistent creators.
        </p>
        <p className="mt-2 text-sm text-gray-700">
          Coach Mode collapses those decisions into one click. The system
          picks today&apos;s pillar (rotation), hands you a hook formula and 5
          topic ideas, generates the Claude prompt that produces the
          long-form copy, and tracks performance so the next post is informed
          by data instead of guesswork. You stay in flow, your brand stays
          consistent, and the work compounds — every logged post sharpens the
          next prompt.
        </p>
        <p className="mt-2 text-sm text-gray-700">
          It&apos;s also a habit loop. The more you log, the smarter the
          recommendations. Top Post Mode triggers automatically when
          something resonates so you don&apos;t have to remember to
          &ldquo;double down on what worked.&rdquo; That&apos;s how channels
          grow without burnout — the tool stays open, the rhythm stays the
          same, and the channel compounds in the background.
        </p>
      </div>

      <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
        <li>
          <span className="font-semibold text-gray-900">Set up your channel (one-time).</span>{" "}
          Click <em>Customize pillars &amp; schedule</em> at the top right. Edit
          the 5 default pillars to match what you actually post about. Pick
          a color for each, write a one-line description, and paste your topic
          banks. Edit your audience, tone, and reading level under{" "}
          <em>Post Builder settings</em>. If you run multiple Instagram accounts,
          hit <em>+ New</em> in the channel dropdown to spin up a separate
          workspace per account — each is fully isolated.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Generate today&apos;s prompt.</span>{" "}
          The prompt builder at the top is the main tool. It auto-fills
          today&apos;s pillar, today&apos;s hook formula, and 5 topic ideas
          drawn from that pillar. Pick a topic, set the CTA keyword (the word
          your DMers will message), copy the generated prompt, paste it into{" "}
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noreferrer"
            className="text-gray-900 underline hover:no-underline"
          >
            claude.ai
          </a>
          . You&apos;ll get back 10 sections of long-form copy.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Push the copy into Post Builder.</span>{" "}
          Open <a href="/post-builder" className="font-semibold text-gray-900 underline hover:no-underline">Post Builder</a>,
          click the <em>Paste text</em> tab, paste Claude&apos;s response, hit
          <em> Generate</em>. Edit slides, pick a cover background, download
          the PNGs as a zip, post.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Plan ahead with the 7-day calendar.</span>{" "}
          Each day card shows two slots (AM and PM). Click any slot to load
          its pillar + hook into the prompt builder above. PM uses a
          different pillar than AM so the same day doesn&apos;t see two posts
          on the same theme.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Log every post 48 hours after publishing.</span>{" "}
          In Performance Tracker, click <em>Log a new post</em>. Enter the
          post details (title, time you posted, pillar, hook). Come back at
          48 hours to fill in metrics — reach, saves, shares, likes, comments,
          profile visits, follows. Coach Mode shows a yellow{" "}
          <em>Time for the 48-hour update</em> reminder when it&apos;s time.
          Why 48h? Shares are mostly locked in by then; reach has settled
          enough to trust the comparison.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Update at 7 days for archival accuracy.</span>{" "}
          A second reminder fires at 7 days. Log the updated numbers. Catches
          late saves and reach climbs.
        </li>
        <li>
          <span className="font-semibold text-gray-900">Watch for the ★ Top Post badge.</span>{" "}
          After 3+ posts logged with 48h data, Coach Mode auto-flags any post
          where save rate, share rate, or reach is ≥ 2× your average. Click
          the badge to open Top Post Mode. It tells you why the post worked,
          gives you 5 follow-up topic ideas, and lists 5 amplification moves
          (run as an ad, cut into stories, pitch a podcast, etc.).
        </li>
        <li>
          <span className="font-semibold text-gray-900">Lock in the winning strategy for 14 days.</span>{" "}
          In Top Post Mode, click <em>Make this my strategy for the next 14 days</em>.
          Coach Mode shifts 8 of 14 AM-slot days toward the winning pillar
          and 5 of 14 toward the winning hook formula. Today&apos;s Plan shows
          a green banner; click <em>Reset to default rotation</em> any time
          to end early.
        </li>
      </ol>

      <div className="mt-5 space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <div>
          <span className="font-semibold">Remember the flywheel:</span> Content → Trust → Capital → Deals → Case Studies → More Content. Every post should move someone closer to trusting you. If it doesn&apos;t, skip it.
        </div>
        <div>
          <span className="font-semibold">Pro tip:</span> log posts at the same time every week to build the habit. Set a recurring calendar reminder: <em>"log Monday&apos;s post on Wednesday."</em>
        </div>
      </div>
    </>
  );
}

function DiyTab() {
  return (
    <>
      <h2 className="mb-1 text-lg font-bold text-gray-900">
        DIY in Claude.ai — run the same strategy without the tool
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        Coach Mode automates these prompts. If you want to run them
        yourself in a Claude.ai chat — or want to understand what
        Coach Mode is doing under the hood — the playbook is below.
      </p>
      <ol className="list-decimal space-y-4 pl-5 text-sm text-gray-700">
        <li>
          <div className="font-semibold text-gray-900">Define your 5 pillars (one-time)</div>
          <p className="mt-1">Paste into Claude.ai:</p>
          <PromptBlock>
            {`Help me define 5 content pillars for my Instagram account.

My niche: [your niche]
My audience: [who you're writing for, what they want]
My voice: [confident, warm, direct, etc.]

For each pillar, give me:
- A name (3-5 words)
- A one-line description
- 10 specific topic ideas (not generic — use real numbers, places, names)

Pillars should not overlap. Together they should cover 80% of what
I'd ever post about.`}
          </PromptBlock>
          <p className="mt-1 text-gray-600">Save Claude&apos;s output. These are your pillars.</p>
        </li>
        <li>
          <div className="font-semibold text-gray-900">Set a weekly schedule (one-time)</div>
          <PromptBlock>
            {`Given these 5 pillars: [paste pillar names]

Assign each pillar to specific days of the week so I rotate content
cleanly. I post twice a day (AM and PM, ~10 hours apart).

Constraints:
- The same pillar shouldn't run AM and PM on the same day.
- Each pillar lands at least once per week.
- Spread heavier pillars (whatever's hardest to write) earlier in the week.

Output a Mon→Sun grid with AM and PM columns.`}
          </PromptBlock>
        </li>
        <li>
          <div className="font-semibold text-gray-900">Generate today&apos;s long-form copy (daily)</div>
          <p className="mt-1">
            Pick today&apos;s pillar from your schedule, then paste this — replacing the bracketed parts:
          </p>
          <PromptBlock>
            {`You are a ghostwriter for [your name], a [niche] expert who teaches
[audience] how to [transformation].

Write a 10-section long-form Instagram carousel post on this topic:

Topic: [topic from today's pillar]
Pillar: [pillar name]
Hook formula for Section 1: [pick one — see options below]
CTA: DM "[keyword]" to get [what you actually send]
Audience: [audience]
Tone: [tone]
Reading level: 3rd grade. Short, plain words. No jargon.

Hook formula options (use ONE for Section 1):
- [Authority figure] just did [thing]. Here's what it means for [audience].
- [Stat] proves [old strategy] is dead. [New strategy] is winning.
- [Number] of [outcome] in [timeframe]. Here's exactly how.
- [Archetype] unlocks [benefit] most don't know about.
- [Counter-intuitive truth]. [Reframe of who's winning].

Structure:
- Section 1: hook (6-9 words, use the formula)
- Sections 2-9: 8 supporting points, 40-80 words each
- Section 10: CTA — direct readers to DM "[keyword]". Use the promise
  EXACTLY as written above. Do not invent or expand.

Hard rules:
- Specific numbers, not rounded ($75,940 over "about $76K")
- Bold 2-4 high-impact words per section using **double asterisks**
- No emojis, no hashtags, no markdown headers beyond "Section N:"
- Don't preface — go straight to "Section 1:"`}
          </PromptBlock>
          <p className="mt-1 text-gray-600">
            Paste Claude&apos;s output into Post Builder&apos;s <em>Paste text</em>
            tab and hit Generate, or build the carousel by hand in Canva
            using the DIY-in-Canva guide on the Post Builder page.
          </p>
        </li>
        <li>
          <div className="font-semibold text-gray-900">Track performance manually (after each post)</div>
          <p className="mt-1">
            Wait 48 hours. Open Instagram Insights and note for each post:
            reach, saves, shares, likes, comments, profile visits, follows,
            posted-at date.
          </p>
          <p className="mt-1">Keep a simple spreadsheet with formulas:</p>
          <PromptBlock>
            {`Save rate  = saves / reach × 100
Share rate = shares / reach × 100

Compute the average save rate and average share rate across all
your posts. A post is a "winner" when save rate, share rate, OR
reach is ≥ 2× your average. Targets to beat (Dr. Jeff baseline):
save rate ≥ 1.5%, share rate ≥ 0.6%.`}
          </PromptBlock>
          <p className="mt-1">
            Re-log the post 7 days after publishing — saves and reach climb
            past the 48h mark.
          </p>
        </li>
        <li>
          <div className="font-semibold text-gray-900">When a post wins, paste this into Claude.ai</div>
          <PromptBlock>
            {`I posted "[post title]" using my [pillar name] pillar with the
[hook formula] hook structure. Stats at 48 hours:
- Reach: [number]
- Saves: [number] (save rate [X.X]%)
- Shares: [number] (share rate [X.X]%)

This is [Nx] my average — it's a winner.

Give me:
(a) 5 follow-up post ideas in the same pillar that extend the angle.
    Use the patterns from the winning post.
(b) 3 alternative hooks in the same family I can use on the follow-ups.
(c) 5 cross-platform amplification moves: ad targeting, repurpose
    formats, story sequences, collab pitches, repost timing.
(d) A 14-day biased posting schedule:
    - 8 of 14 AM-slot days = the winning pillar
    - 5 of 14 days = the winning hook formula
    - Other days = my other 4 pillars for variety
    - Don't repeat the same pillar back-to-back.

Output as a clean numbered list per section.`}
          </PromptBlock>
          <p className="mt-1 text-gray-600">
            Lock the resulting schedule into your calendar manually. After
            14 days, go back to your default rotation.
          </p>
        </li>
        <li>
          <div className="font-semibold text-gray-900">Decision filter for every post</div>
          <PromptBlock>
            {`Before posting, ask:

"Does this content move someone closer to trusting me?"

If yes → post.
If no → skip.

The flywheel:
Content → Trust → Capital → Deals → Case Studies → More Content`}
          </PromptBlock>
        </li>
      </ol>

      <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
        <span className="font-semibold">If this looks like work,</span> that&apos;s why Coach Mode exists. The prompt builder, performance tracker, outlier detection, and 14-day strategy lock all run these prompts for you with one click. The DIY playbook above is the manual version — useful for understanding the system, sharing with someone who doesn&apos;t use the app, or running on a day the tool isn&apos;t available.
      </div>
    </>
  );
}

// Pre-formatted prompt template block. Slightly looser line-height than
// regular code blocks because these are full multi-line prompts and the
// user will be highlighting + copying them.
function PromptBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800 whitespace-pre-wrap">
      {children}
    </pre>
  );
}
