// Section B of Coach Mode: a 7-day grid showing the next week's pillar
// rotation. Today is highlighted.

"use client";

import { getNextDays, pillarColorClasses } from "@/app/coach/lib/strategy";

function dayName(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WeekCalendar() {
  const days = getNextDays(new Date(), 7);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Next 7 days</h2>
      <p className="mb-4 text-sm text-gray-600">
        Pillar rotation so you never wonder what to post tomorrow.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-7">
        {days.map((d) => {
          const colors = pillarColorClasses(d.pillar.color);
          return (
            <div
              key={d.date.toISOString()}
              className={`rounded-lg border p-3 text-left transition ${
                d.isToday
                  ? `${colors.border} ${colors.bgSoft} ring-2 ${colors.ring}`
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {dayName(d.date)}
                </span>
                {d.isToday && (
                  <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                    Today
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm font-medium text-gray-900">
                {shortDate(d.date)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${colors.bg}`}
                  aria-hidden
                />
                <span className="text-xs leading-tight text-gray-700">
                  {d.pillar.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
