"use client";

// First-run onboarding banner shown at the top of each feature
// (Post Builder / Reel Builder / Coach Mode). Three jobs:
//
//   1. Position the app honestly: who it's for + what it isn't.
//      Built for business owners with an offer who haven't cracked
//      Instagram marketing — the app gives the structure, AI gives
//      the words. Built around Claude.ai but works with any AI chat
//      since the "generate prompt" buttons produce copy-paste text.
//
//   2. Reassure new visitors that the app is private and per-browser:
//      no servers, no accounts, no risk of mixing data with whoever
//      shared the link. Friends opening the URL get a fresh slate.
//
//   3. Walk through the 2-4 most important "make this yours" steps
//      so a fresh user knows where to start instead of guessing.
//      Plus a "Stuck? Ask your AI" tip so users know they can use
//      Claude.ai / ChatGPT / Gemini as a help desk.
//
// Each feature passes its own storageKey + steps. Dismissal is sticky
// per feature — clicking "Got it" on Post Builder doesn't dismiss the
// Coach Mode banner. Returning users (and friends opening the URL on
// a different device) see it again, by design — that's our onboarding.
//
// Bump the storageKey suffix (e.g. v1 → v2) when the copy changes
// materially so existing users see the updated banner once.

import { useEffect, useState } from "react";

export interface WelcomeStep {
  label: string;
  detail: string;
}

interface Props {
  // Unique per feature: e.g. "welcome_coach_v2", "welcome_post_v2".
  storageKey: string;
  title: string;
  steps: WelcomeStep[];
}

export default function WelcomeBanner({ storageKey, title, steps }: Props) {
  // null = pre-mount (we don't render anything server-side); true =
  // show banner; false = user dismissed.
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      setShow(seen !== "1");
    } catch {
      setShow(true);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore quota */
    }
    setShow(false);
  }

  if (show !== true) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-blue-900">{title}</div>
          <div className="mt-2 text-xs leading-relaxed text-blue-900/85">
            <p className="mb-2">
              <strong>For business owners with an offer.</strong> Coaching,
              course, service, product — you have the thing, you just
              haven&apos;t figured out Instagram marketing yet. This app gives
              you the structure (pillars, schedule, hooks, templates); your AI
              chat gives you the words. You skip the &ldquo;what do I post?&rdquo;
              paralysis and ship.
            </p>
            <p className="mb-2">
              <strong>Built around Claude.ai but works with any AI chat.</strong>{" "}
              The &ldquo;generate prompt&rdquo; buttons produce copy-paste text — paste
              into Claude.ai, ChatGPT, Gemini, or whichever AI you already use
              (ideally the one where you&apos;ve been talking about your
              business and life, since it has context on you).
            </p>
            <p>
              <strong>Your data stays in your browser only.</strong> No
              servers, no accounts, no logins. Share this link with a friend
              and they open the app to a fresh blank slate — your settings,
              posts, and stories never leave your device. Multiple personas?
              Use the Channel selector at the top of Coach Mode.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
        >
          Got it
        </button>
      </div>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-blue-900">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="font-semibold">{s.label}:</span> {s.detail}
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded border border-blue-300 bg-white/70 p-2.5 text-[11px] leading-relaxed text-blue-900">
        <span className="font-semibold">💡 Stuck on a field?</span> Screenshot
        it (or copy the label / question), paste into your AI chat, and ask:{" "}
        <em>&ldquo;How should I fill this out for [your business]?&rdquo;</em>{" "}
        Paste the answer back into the field. Same trick works for any
        prompt or step you&apos;re unsure about.
      </div>
    </section>
  );
}
