// Section B of Coach Mode: a 7-day grid showing the next week's pillar
// rotation with TWO slots per day (AM / PM, ~6-12 hours apart). Clicking
// any slot tells the PromptBuilder to switch to that date+slot+pillar.

"use client";

import {
  SLOT_POST_WINDOW,
  getNextDays,
  pillarColorClasses,
  type Pillar,
  type Slot,
} from "@/app/coach/lib/strategy";
import type { SelectedSlot } from "./CoachDashboard";

interface Props {
  selectedSlot: SelectedSlot | null;
  onSelectSlot: (s: SelectedSlot) => void;
}

function dayName(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface SlotButtonProps {
  pillar: Pillar;
  slot: Slot;
  date: Date;
  active: boolean;
  onClick: () => void;
}

function SlotButton({ pillar, slot, date, active, onClick }: SlotButtonProps) {
  const colors = pillarColorClasses(pillar.color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded border px-2 py-1.5 text-left transition ${
        active
          ? `${colors.border} ${colors.bgSoft} ring-2 ${colors.ring}`
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
      aria-label={`${slot.toUpperCase()} on ${shortDate(date)}: ${pillar.name}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {slot.toUpperCase()}
        </span>
        <span className="text-[10px] text-gray-400">
          {SLOT_POST_WINDOW[slot]}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${colors.bg}`}
          aria-hidden
        />
        <span className="text-xs leading-tight text-gray-800">
          {pillar.name}
        </span>
      </div>
    </button>
  );
}

export default function WeekCalendar({ selectedSlot, onSelectSlot }: Props) {
  const days = getNextDays(new Date(), 7);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Next 7 days</h2>
      <p className="mb-4 text-sm text-gray-600">
        Two posts per day, AM and PM. AM is the primary; PM is optional but
        keeps engagement up if you have the bandwidth. Click any slot to load
        its pillar into the prompt builder above.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-7">
        {days.map((d) => {
          const iso = isoDate(d.date);
          const amActive =
            selectedSlot?.isoDate === iso && selectedSlot.slot === "am";
          const pmActive =
            selectedSlot?.isoDate === iso && selectedSlot.slot === "pm";
          return (
            <div
              key={iso}
              className={`rounded-lg border p-2 ${
                d.isToday
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  {dayName(d.date)}
                </span>
                {d.isToday && (
                  <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                    Today
                  </span>
                )}
              </div>
              <div className="mb-2 px-1 text-sm font-medium text-gray-900">
                {shortDate(d.date)}
              </div>
              <div className="space-y-1.5">
                <SlotButton
                  pillar={d.amPillar}
                  slot="am"
                  date={d.date}
                  active={amActive}
                  onClick={() =>
                    onSelectSlot({ isoDate: iso, slot: "am" })
                  }
                />
                <SlotButton
                  pillar={d.pmPillar}
                  slot="pm"
                  date={d.date}
                  active={pmActive}
                  onClick={() =>
                    onSelectSlot({ isoDate: iso, slot: "pm" })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
