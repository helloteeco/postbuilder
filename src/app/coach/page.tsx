// Coach Mode dashboard.
// Tells you what to post today (pillar + hook formula + 5 topic ideas),
// shows the 7-day rotation ahead, and tracks performance over time.

import HookFormulas from "@/app/coach/components/HookFormulas";
import PerformanceTracker from "@/app/coach/components/PerformanceTracker";
import PillarReference from "@/app/coach/components/PillarReference";
import PromptBuilder from "@/app/coach/components/PromptBuilder";
import TodaysPlan from "@/app/coach/components/TodaysPlan";
import WeekCalendar from "@/app/coach/components/WeekCalendar";

export const metadata = {
  title: "Coach Mode — Post Builder",
  description:
    "Self-learning content coach. Today's pillar, a Claude.ai prompt builder informed by what's worked, and a performance tracker.",
};

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Coach mode</h1>
        <p className="text-sm text-gray-600">
          One-click prompt for Claude.ai → 10 sections of long-form copy →
          paste into the Post Builder. Self-learning: every post you log makes
          the next prompt smarter.
        </p>
      </header>

      <PromptBuilder />
      <TodaysPlan />
      <WeekCalendar />
      <PerformanceTracker />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HookFormulas />
        <PillarReference />
      </div>
    </div>
  );
}
