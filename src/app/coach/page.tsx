// Coach Mode dashboard.
// Tells you what to post today (pillar + hook formula + 5 topic ideas),
// shows the 7-day rotation ahead with optional 2 posts/day, and tracks
// performance over time. Self-learning: every logged post tunes the
// next Claude.ai prompt.

import CoachDashboard from "@/app/coach/components/CoachDashboard";

export const metadata = {
  title: "Coach Mode — Post Builder",
  description:
    "Self-learning content coach. Today's pillar, a Claude.ai prompt builder informed by what's worked, and a 7-day 2-post-per-day rotation.",
};

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Coach mode</h1>
        <p className="text-sm text-gray-600">
          One-click prompt for Claude.ai → 10 sections of long-form copy →
          paste into the Post Builder. Self-learning: every post you log
          tunes the next prompt. Click any AM/PM slot in the calendar to
          jump the prompt to that day&apos;s pillar.
        </p>
      </header>

      <CoachDashboard />
    </div>
  );
}
