// Client-side wrapper that holds cross-component state — specifically the
// "selected slot" (a date + AM/PM + pillar). When the user clicks a slot
// in WeekCalendar, the PromptBuilder updates to match that pillar/date so
// the generated Claude prompt reflects whatever the user is planning to
// post for that slot.

"use client";

import { useState } from "react";
import HookFormulas from "@/app/coach/components/HookFormulas";
import PerformanceTracker from "@/app/coach/components/PerformanceTracker";
import PillarReference from "@/app/coach/components/PillarReference";
import PromptBuilder from "@/app/coach/components/PromptBuilder";
import TodaysPlan from "@/app/coach/components/TodaysPlan";
import WeekCalendar from "@/app/coach/components/WeekCalendar";
import type { Slot } from "@/app/coach/lib/strategy";

export interface SelectedSlot {
  // Stored as ISO date-only string (yyyy-mm-dd) so it round-trips cleanly
  // and JSON-stringifies without timezone surprises.
  isoDate: string;
  slot: Slot;
}

export default function CoachDashboard() {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  function handleSelectSlot(s: SelectedSlot) {
    setSelectedSlot(s);
    // Smooth-scroll the prompt builder into view so the user sees their
    // selection take effect.
    if (typeof document !== "undefined") {
      const el = document.getElementById("coach-prompt-builder");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  return (
    <>
      <PromptBuilder selectedSlot={selectedSlot} />
      <TodaysPlan />
      <WeekCalendar
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
      />
      <PerformanceTracker />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HookFormulas />
        <PillarReference />
      </div>
    </>
  );
}
