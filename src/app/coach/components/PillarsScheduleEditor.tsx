// Modal editor for customizing the pillar list and weekly schedule.
// Each user (each browser) starts from the default Dr. Jeff setup, then
// can rename pillars, recolor them, edit topic banks, and remap which
// pillar lands on each AM/PM slot.

"use client";

import { useEffect, useState } from "react";
import {
  PILLAR_COLOR_OPTIONS,
  pillarColorClasses,
  type Pillar,
  type Rotation,
} from "@/app/coach/lib/strategy";
import {
  defaultPillars,
  defaultRotation,
  loadCustomPillars,
  loadCustomRotation,
  saveCustomPillars,
  saveCustomRotation,
} from "@/app/coach/lib/customization";

interface Props {
  open: boolean;
  onClose: () => void;
  // Called after save so the parent can refresh (re-install effective data
  // and force-rerender child sections).
  onSaved: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first ordering for the UI

function newPillarId(): string {
  return `p_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyPillar(): Pillar {
  return {
    id: newPillarId(),
    name: "New pillar",
    color: PILLAR_COLOR_OPTIONS[0],
    description: "",
    topics: [],
  };
}

export default function PillarsScheduleEditor({ open, onClose, onSaved }: Props) {
  const [pillars, setPillars] = useState<Pillar[]>(defaultPillars());
  const [rotation, setRotation] = useState<Rotation>(defaultRotation());

  // On open, load whatever's currently saved (or fall back to defaults).
  useEffect(() => {
    if (!open) return;
    const savedPillars = loadCustomPillars();
    const savedRotation = loadCustomRotation();
    setPillars(savedPillars ?? defaultPillars());
    setRotation(savedRotation ?? defaultRotation());
  }, [open]);

  if (!open) return null;

  function patchPillar(id: string, patch: Partial<Pillar>) {
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function removePillar(id: string) {
    if (pillars.length <= 2) return; // need at least 2 to fill AM/PM
    setPillars((prev) => prev.filter((p) => p.id !== id));
    // Reassign any rotation slot that pointed at this pillar to the first
    // remaining pillar so the schedule never references a deleted pillar.
    const fallbackId = pillars.find((p) => p.id !== id)?.id;
    if (!fallbackId) return;
    const fix = (m: Record<number, string>) =>
      Object.fromEntries(
        Object.entries(m).map(([k, v]) => [k, v === id ? fallbackId : v]),
      ) as Record<number, string>;
    setRotation((r) => ({ am: fix(r.am), pm: fix(r.pm) }));
  }

  function addPillar() {
    if (pillars.length >= 7) return;
    setPillars((prev) => [...prev, emptyPillar()]);
  }

  function setSlotPillar(day: number, slot: "am" | "pm", pillarId: string) {
    setRotation((r) => ({ ...r, [slot]: { ...r[slot], [day]: pillarId } }));
  }

  function onSave() {
    saveCustomPillars(pillars);
    saveCustomRotation(rotation);
    onSaved();
    onClose();
  }

  function onResetDefaults() {
    if (!confirm("Reset pillars and schedule to the Dr. Jeff defaults? This wipes your customizations.")) {
      return;
    }
    saveCustomPillars(null);
    saveCustomRotation(null);
    setPillars(defaultPillars());
    setRotation(defaultRotation());
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Pillars & schedule
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-600">
          Edit your content pillars and which pillar lands on each AM / PM
          slot. Saved per-browser, isolated from anyone else using the app.
        </p>

        {/* Pillars list */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Pillars</h3>
            <button
              type="button"
              onClick={addPillar}
              disabled={pillars.length >= 7}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              + Add pillar (max 7)
            </button>
          </div>

          <div className="space-y-3">
            {pillars.map((p) => {
              const colors = pillarColorClasses(p.color);
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[180px] space-y-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => patchPillar(p.id, { name: e.target.value })}
                        placeholder="Pillar name"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                      />
                      <input
                        type="text"
                        value={p.description}
                        onChange={(e) => patchPillar(p.id, { description: e.target.value })}
                        placeholder="One-line description (shown in the reference panel)"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1">
                        <span
                          className={`h-4 w-4 rounded-full ${colors.bg}`}
                          aria-hidden
                        />
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          Color
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {PILLAR_COLOR_OPTIONS.map((c) => {
                          const cc = pillarColorClasses(c);
                          const active = c === p.color;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => patchPillar(p.id, { color: c })}
                              className={`h-5 w-5 rounded-full ${cc.bg} ${
                                active ? "ring-2 ring-offset-1 ring-gray-700" : ""
                              }`}
                              aria-label={c}
                              title={c}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePillar(p.id)}
                      disabled={pillars.length <= 2}
                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      title="Remove pillar"
                    >
                      Remove
                    </button>
                  </div>
                  <label className="mt-2 block text-[11px] text-gray-500">
                    Topic ideas (one per line — Coach Mode samples 5 of these per day)
                    <textarea
                      value={p.topics.join("\n")}
                      onChange={(e) =>
                        patchPillar(p.id, {
                          topics: e.target.value
                            .split("\n")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      rows={5}
                      className="mt-1 w-full rounded border border-gray-200 p-2 font-mono text-xs"
                      placeholder={"e.g.\nThe one mistake that cost me $20K\nMy 6-month framework"}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule grid */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Weekly schedule
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Assign which pillar runs on each AM / PM slot. AM is the primary
            post; PM is optional.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">Day</th>
                  <th className="py-2 pr-3 font-medium">AM (~8-10 AM)</th>
                  <th className="py-2 pr-3 font-medium">PM (~6-9 PM)</th>
                </tr>
              </thead>
              <tbody>
                {DAY_ORDER.map((d) => (
                  <tr key={d} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-semibold text-gray-700">
                      {DAY_NAMES[d]}
                    </td>
                    {(["am", "pm"] as const).map((slot) => (
                      <td key={slot} className="py-2 pr-3">
                        <select
                          value={rotation[slot][d] ?? pillars[0]?.id ?? ""}
                          onChange={(e) => setSlotPillar(d, slot, e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          {pillars.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onResetDefaults}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
