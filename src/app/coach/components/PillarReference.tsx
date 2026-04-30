// Section E of Coach Mode: a collapsible reference list of the 5 pillars.
// Static — no state beyond open/closed.

"use client";

import { useState } from "react";
import { PILLARS, pillarColorClasses } from "@/app/coach/lib/strategy";

export default function PillarReference() {
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
          5 pillars reference
        </h2>
        <span className="text-sm text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-4 space-y-3 text-sm">
          {PILLARS.map((p) => {
            const colors = pillarColorClasses(p.color);
            return (
              <li key={p.id} className="flex gap-3">
                <span
                  className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${colors.bg}`}
                  aria-hidden
                />
                <div>
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-gray-600">{p.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
