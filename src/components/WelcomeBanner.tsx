"use client";

// First-run onboarding banner shown at the top of each feature
// (Post Builder / Reel Builder / Coach Mode). Two jobs:
//
//   1. Reassure new visitors that the app is private and per-browser:
//      no servers, no accounts, no risk of mixing data with whoever
//      shared the link. Friends opening the URL get a fresh slate.
//
//   2. Walk through the 2-3 most important "make this yours" steps
//      so a fresh user knows where to start instead of guessing.
//
// Each feature passes its own storageKey + steps. Dismissal is sticky
// per feature — clicking "Got it" on Post Builder doesn't dismiss the
// Coach Mode banner. Returning users (and friends opening the URL on
// a different device) see it again, by design — that's our onboarding.
//
// Minimal, dismissible, no animations, no modals. Cheap.

import { useEffect, useState } from "react";

export interface WelcomeStep {
  label: string;
  detail: string;
}

interface Props {
  // Unique per feature: e.g. "welcome_coach_v1", "welcome_post_v1".
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
          <div className="mt-1 text-xs text-blue-900/85">
            <strong>Your data stays in your browser only.</strong> No servers,
            no accounts, no logins. If you share this link with a friend, they
            open the app to a fresh blank slate — your settings, posts, and
            stories never leave your device. Multiple personas? Use the
            Channel selector at the top of Coach Mode to keep them separate.
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
    </section>
  );
}
