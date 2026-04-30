// Client-side wrapper that holds cross-component state — specifically the
// "selected slot" (a date + AM/PM + pillar). When the user clicks a slot
// in WeekCalendar, the PromptBuilder updates to match that pillar/date so
// the generated Claude prompt reflects whatever the user is planning to
// post for that slot.

"use client";

import { useEffect, useState } from "react";
import HookFormulas from "@/app/coach/components/HookFormulas";
import PerformanceTracker from "@/app/coach/components/PerformanceTracker";
import PillarReference from "@/app/coach/components/PillarReference";
import PillarsScheduleEditor from "@/app/coach/components/PillarsScheduleEditor";
import PromptBuilder from "@/app/coach/components/PromptBuilder";
import TodaysPlan from "@/app/coach/components/TodaysPlan";
import WeekCalendar from "@/app/coach/components/WeekCalendar";
import type { Slot } from "@/app/coach/lib/strategy";
import { installCustomData } from "@/app/coach/lib/customization";

export interface SelectedSlot {
  // Stored as ISO date-only string (yyyy-mm-dd) so it round-trips cleanly
  // and JSON-stringifies without timezone surprises.
  isoDate: string;
  slot: Slot;
}

export default function CoachDashboard() {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Bumped after a save to force child sections (which read from
  // getEffectivePillars at render time) to recompute.
  const [revision, setRevision] = useState(0);

  // Install any saved custom pillars / schedule on mount before the rest of
  // the dashboard reads from getEffectivePillars / getEffectiveRotation.
  useEffect(() => {
    installCustomData();
    setRevision((v) => v + 1);
  }, []);

  function handleSelectSlot(s: SelectedSlot) {
    setSelectedSlot(s);
    if (typeof document !== "undefined") {
      const el = document.getElementById("coach-prompt-builder");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function handleEditorSaved() {
    installCustomData();
    setRevision((v) => v + 1);
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Customize pillars &amp; schedule
        </button>
      </div>

      <PromptBuilder key={`pb-${revision}`} selectedSlot={selectedSlot} />
      <TodaysPlan key={`tp-${revision}`} />
      <WeekCalendar
        key={`wc-${revision}`}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
      />
      <PerformanceTracker />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HookFormulas />
        <PillarReference key={`pr-${revision}`} />
      </div>

      <PillarsScheduleEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={handleEditorSaved}
      />
    </>
  );
}
