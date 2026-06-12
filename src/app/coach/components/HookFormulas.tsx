// Section D of Coach Mode: a collapsible reference list of the 5 hook
// formulas. Static — no state beyond open/closed.

"use client";

import { useState } from "react";
import { HOOK_FORMULAS } from "@/app/coach/lib/strategy";

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri/Sat/Sun",
  6: "Sat",
};

export default function HookFormulas() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg font-bold text-gray-900">
          5 hook formulas reference
        </h2>
        <span className="text-sm text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-gray-800">
          {HOOK_FORMULAS.map((h) => (
            <li key={h.id}>
              <div className="font-medium text-gray-900">{h.template}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                Day: {DAY_LABELS[h.dayOfWeek] ?? "—"}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
