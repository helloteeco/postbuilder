// Section A of Coach Mode: today's pillar, today's hook formula, 5 topic
// suggestions for the pillar, and a "Locked Post Builder Settings" card
// that the user copies into the Post Builder when they go to write.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LOCKED_POST_BUILDER_SETTINGS,
  getDailyTopics,
  getHookForDate,
  getPillarForDate,
  pillarColorClasses,
  type LockedStrategy,
} from "@/app/coach/lib/strategy";
import {
  formatLockExpiry,
  installLockedStrategy,
  loadLockedStrategy,
  saveLockedStrategy,
} from "@/app/coach/lib/topPostAnalysis";

function formatDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TodaysPlan() {
  // Track the active lock so the banner re-renders when Top Post Mode
  // locks/resets it. TopPostMode dispatches a "coach-strategy-changed"
  // CustomEvent on the window after every change; we listen here.
  const [lock, setLock] = useState<LockedStrategy | null>(null);

  useEffect(() => {
    setLock(loadLockedStrategy());
    function refresh() {
      setLock(loadLockedStrategy());
    }
    window.addEventListener("coach-strategy-changed", refresh);
    return () => {
      window.removeEventListener("coach-strategy-changed", refresh);
    };
  }, []);

  // getPillarForDate / getHookForDate already consult the effective lock
  // via the strategy module's biased lookup, so today's plan
  // automatically reflects the active lock for the AM slot. We only need
  // to surface the explicit "Strategy locked" banner here.
  const today = new Date();
  const pillar = getPillarForDate(today);
  const hook = getHookForDate(today);
  const topics = getDailyTopics(today, pillar.id, 5);
  const colors = pillarColorClasses(pillar.color);

  function handleResetLock() {
    saveLockedStrategy(null);
    installLockedStrategy();
    setLock(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("coach-strategy-changed"));
    }
  }

  return (
    <section
      className={`rounded-xl border-2 ${colors.border} bg-white p-6 shadow-sm`}
    >
      {lock && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div>
            <span className="font-semibold">★ Strategy locked:</span>{" "}
            {pillar.name} for 14 days · expires {formatLockExpiry(lock)}
          </div>
          <button
            type="button"
            onClick={handleResetLock}
            className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Reset to default rotation
          </button>
        </div>
      )}

      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Today&apos;s plan
      </div>
      <div className="mb-4 text-sm text-gray-600">{formatDateLong(today)}</div>

      <div className="mb-5 flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${colors.bg}`}
          aria-hidden
        />
        <h2 className="text-2xl font-bold text-gray-900">{pillar.name}</h2>
      </div>

      <div className="mb-5 rounded-lg bg-gray-50 p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Hook formula
        </div>
        <div className="text-sm text-gray-800">{hook.template}</div>
      </div>

      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          5 topic ideas
        </div>
        <ul className="space-y-1.5 text-sm text-gray-800">
          {topics.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-400">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Locked Post Builder settings (copy these in)
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm md:grid-cols-2">
          <div className="flex justify-between border-b border-gray-100 py-1">
            <dt className="text-gray-500">Slide count</dt>
            <dd className="font-medium text-gray-900">
              {LOCKED_POST_BUILDER_SETTINGS.slideCount}
            </dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <dt className="text-gray-500">Reading level</dt>
            <dd className="font-medium text-gray-900">
              {LOCKED_POST_BUILDER_SETTINGS.readingLevel}
            </dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1 md:border-b-0">
            <dt className="text-gray-500">Audience</dt>
            <dd className="ml-2 font-medium text-gray-900 text-right">
              {LOCKED_POST_BUILDER_SETTINGS.audience}
            </dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-gray-500">Tone</dt>
            <dd className="ml-2 font-medium text-gray-900 text-right">
              {LOCKED_POST_BUILDER_SETTINGS.tone}
            </dd>
          </div>
        </dl>
      </div>

      <Link
        href="/post-builder"
        className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
      >
        Open Post Builder →
      </Link>
    </section>
  );
}
