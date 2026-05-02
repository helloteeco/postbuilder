// Top Post Mode modal — opens when a logged post outperforms (or the
// user manually flags it) and walks them through:
//   1. Why this post worked (stats, comparison, diagnosis)
//   2. 5 follow-up post ideas in the same pillar
//   3. 3-5 cross-platform amplification moves
//   4. Lock in the strategy (14-day pillar/hook bias)

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HOOK_FORMULAS,
  LOCK_DURATION_DAYS,
  getEffectivePillars,
  pillarColorClasses,
  type HookFormula,
  type Pillar,
} from "@/app/coach/lib/strategy";
import {
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  saveRate,
  shareRate,
  type CoachPost,
} from "@/app/coach/lib/storage";
import {
  buildLockedStrategy,
  computeAverages,
  flagOutlier,
  formatLockExpiry,
  inferPostMetadata,
  installLockedStrategy,
  loadLockedStrategy,
  saveLockedStrategy,
  type AveragesSummary,
  type OutlierFlags,
} from "@/app/coach/lib/topPostAnalysis";
import {
  AMPLIFICATION_ACTIONS,
  HOOK_FORMULA_EXTENSIONS,
  PILLAR_FOLLOW_UPS,
} from "@/app/coach/lib/topPostRecommendations";

interface Props {
  open: boolean;
  post: CoachPost | null;
  allPosts: CoachPost[];
  onClose: () => void;
  // Called after the user locks in or resets the strategy so the parent
  // (PerformanceTracker → CoachDashboard) can refresh dependent UI.
  onStrategyChanged: () => void;
}

function fmtRate(n: number): string {
  return `${n.toFixed(2)}%`;
}

function fmtMultiplier(n: number): string {
  return n > 0 ? `${n.toFixed(1)}×` : "—";
}

export default function TopPostMode({
  open,
  post,
  allPosts,
  onClose,
  onStrategyChanged,
}: Props) {
  const [pillarId, setPillarId] = useState<string>("");
  const [hookId, setHookId] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Pre-fill pillar/hook from inferred metadata each time the modal
  // opens for a new post.
  useEffect(() => {
    if (!open || !post) return;
    const meta = inferPostMetadata(post);
    setPillarId(meta.pillar?.id ?? getEffectivePillars()[0]?.id ?? "");
    setHookId(meta.hook?.id ?? HOOK_FORMULAS[0]?.id ?? "");
    setConfirmation(null);
  }, [open, post]);

  const averages: AveragesSummary = useMemo(
    () => computeAverages(allPosts),
    [allPosts],
  );

  const flags: OutlierFlags | null = useMemo(() => {
    if (!post) return null;
    return flagOutlier(post, averages);
  }, [post, averages]);

  const pillars = getEffectivePillars();
  const selectedPillar: Pillar | undefined = pillars.find((p) => p.id === pillarId);
  const selectedHook: HookFormula | undefined = HOOK_FORMULAS.find((h) => h.id === hookId);

  const followUps = useMemo(() => {
    if (!selectedPillar) return [];
    // Prefer the curated library; fall back to the pillar's own topic
    // bank for custom pillars that aren't in the library.
    const curated = PILLAR_FOLLOW_UPS[selectedPillar.id];
    if (curated && curated.length > 0) return curated;
    return selectedPillar.topics.slice(0, 5);
  }, [selectedPillar]);

  const hookExtensions = useMemo(() => {
    if (!selectedHook) return [];
    return HOOK_FORMULA_EXTENSIONS[selectedHook.id] ?? [];
  }, [selectedHook]);

  const amplification = useMemo(() => {
    if (!selectedPillar) return [];
    return (
      AMPLIFICATION_ACTIONS[selectedPillar.id] ?? [
        "Run as a $5-10/day Meta ad to your follower lookalike",
        "Pin to profile for 30 days while it's still warm",
        "Cut into a 3-5 story sequence with a poll",
        "Repost as a carousel cover with a new subtitle 7-10 days later",
        "Use as ad creative for the next 30 days",
      ]
    );
  }, [selectedPillar]);

  const existingLock = open ? loadLockedStrategy() : null;

  // Tells any sibling component (TodaysPlan, etc.) that the lock changed
  // so they can re-read getEffectiveLock and rerender. Cleaner than
  // threading callbacks through CoachDashboard, which the spec says we
  // can't modify.
  function broadcastStrategyChange() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("coach-strategy-changed"));
    }
  }

  function handleLockIn() {
    if (!post || !selectedPillar || !selectedHook) return;
    const lock = buildLockedStrategy({
      pillarId: selectedPillar.id,
      hookId: selectedHook.id,
      post,
    });
    saveLockedStrategy(lock);
    installLockedStrategy();
    broadcastStrategyChange();
    onStrategyChanged();
    setConfirmation(
      `Strategy locked. Coach Mode will bias the next ${LOCK_DURATION_DAYS} days toward "${selectedPillar.name}" with the "${selectedHook.id}" hook formula. Expires ${formatLockExpiry(lock)}.`,
    );
  }

  function handleResetLock() {
    saveLockedStrategy(null);
    installLockedStrategy();
    broadcastStrategyChange();
    onStrategyChanged();
    setConfirmation("Lock cleared. Coach Mode is back on the default rotation.");
  }

  if (!open || !post || !flags) return null;

  const colors = selectedPillar
    ? pillarColorClasses(selectedPillar.color)
    : pillarColorClasses("gray-500");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              ★ Top post mode
            </div>
            <h2 className="mt-0.5 text-xl font-bold text-gray-900">
              {post.title}
            </h2>
            <div className="text-xs text-gray-500">
              Posted {post.datePosted}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {/* Section 1 — Why this post worked */}
        <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Why this post worked
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Stat label="Reach" value={post.reach.toLocaleString()} multiplier={flags.reachMultiplier} flagged={flags.reach} />
            <Stat label="Saves" value={post.saves.toLocaleString()} sub={`${fmtRate(saveRate(post))} rate`} multiplier={flags.saveRateMultiplier} flagged={flags.saveRate} />
            <Stat label="Shares" value={post.shares.toLocaleString()} sub={`${fmtRate(shareRate(post))} rate`} multiplier={flags.shareRateMultiplier} flagged={flags.shareRate} />
          </div>
          <div className="mt-3 text-xs text-emerald-900/90">
            Targets: save rate ≥ {SAVE_RATE_TARGET}%, share rate ≥{" "}
            {SHARE_RATE_TARGET}%. Multipliers above are vs. your own average
            across {allPosts.length} logged post{allPosts.length === 1 ? "" : "s"}.
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-gray-600">
              Pillar (inferred from date — change if needed)
              <select
                value={pillarId}
                onChange={(e) => setPillarId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Hook formula (inferred — change if needed)
              <select
                value={hookId}
                onChange={(e) => setHookId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {HOOK_FORMULAS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.template}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedPillar && selectedHook && (
            <div className="mt-3 rounded border border-emerald-300 bg-white p-3 text-sm text-gray-800">
              <span className="font-semibold">Diagnosis:</span> Your
              audience responds to{" "}
              <span className={`font-semibold ${colors.text}`}>
                {selectedPillar.name}
              </span>{" "}
              content with the{" "}
              <em>{selectedHook.template}</em> hook structure. Lean into it.
            </div>
          )}
        </section>

        {/* Section 2 — 5 follow-up post ideas */}
        <section className="mb-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            5 follow-up post ideas
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-800">
            {followUps.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ol>
          {hookExtensions.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Hook variants in the same family
              </div>
              <ul className="space-y-1 pl-5 text-sm italic text-gray-700">
                {hookExtensions.map((tpl, i) => (
                  <li key={i} className="list-disc">
                    {tpl}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Section 3 — Cross-platform amplification */}
        <section className="mb-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Cross-platform amplification
          </div>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {amplification.map((action, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-gray-400">→</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 4 — Lock in the strategy */}
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Lock in the strategy
          </div>
          <p className="mb-3 text-sm text-gray-700">
            Override the next {LOCK_DURATION_DAYS} days of Coach Mode to bias
            toward what just worked: 8 of 14 AM slots will use the winning
            pillar, 5 of 14 will use the winning hook formula. PM slots stay
            on rotation for variety. You can reset at any time.
          </p>
          {existingLock && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              A lock is already active — locking again will replace it.
              Currently locked: <span className="font-semibold">{existingLock.postTitle}</span>{" "}
              until {formatLockExpiry(existingLock)}.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLockIn}
              disabled={!selectedPillar || !selectedHook}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              Make this my strategy for the next {LOCK_DURATION_DAYS} days
            </button>
            {existingLock && (
              <button
                type="button"
                onClick={handleResetLock}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Reset to default rotation
              </button>
            )}
          </div>
          {confirmation && (
            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
              {confirmation}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  multiplier,
  flagged,
}: {
  label: string;
  value: string;
  sub?: string;
  multiplier: number;
  flagged: boolean;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
      <div
        className={`mt-1 text-[11px] font-semibold ${
          flagged ? "text-emerald-700" : "text-gray-400"
        }`}
      >
        {fmtMultiplier(multiplier)} avg
      </div>
    </div>
  );
}
