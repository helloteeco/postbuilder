// Coach Mode dashboard.
// Tells you what to post today (pillar + hook formula + 5 topic ideas),
// shows the 7-day rotation ahead, and tracks performance over time.

import HookFormulas from "@/app/coach/components/HookFormulas";
import PerformanceTracker from "@/app/coach/components/PerformanceTracker";
import PillarReference from "@/app/coach/components/PillarReference";
import TodaysPlan from "@/app/coach/components/TodaysPlan";
import WeekCalendar from "@/app/coach/components/WeekCalendar";

export const metadata = {
  title: "Coach Mode — Post Builder",
  description:
    "What to post today. Daily pillar, hook formula, and topic ideas, plus a weekly rotation and performance tracker.",
};

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Coach mode</h1>
        <p className="text-sm text-gray-600">
          Decide what to post in 30 seconds. Today&apos;s pillar, hook formula,
          and 5 topic ideas — then jump into the Post Builder.
        </p>
      </header>

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
