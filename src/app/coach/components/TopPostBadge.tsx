// Small clickable badge that appears next to a logged post in the
// Performance Tracker when that post has met one of the outlier
// thresholds (save rate, share rate, or reach > 2× the user's average).
// Click → opens the Top Post Mode modal for that post.

"use client";

import type { OutlierFlags } from "@/app/coach/lib/topPostAnalysis";

interface Props {
  flags: OutlierFlags;
  onClick: () => void;
}

function topMultiplier(flags: OutlierFlags): {
  label: string;
  value: number;
} | null {
  // Pick the metric with the largest multiplier so the badge tooltip
  // reflects the most impressive number.
  const candidates: { label: string; value: number; flagged: boolean }[] = [
    { label: "save rate", value: flags.saveRateMultiplier, flagged: flags.saveRate },
    { label: "share rate", value: flags.shareRateMultiplier, flagged: flags.shareRate },
    { label: "reach", value: flags.reachMultiplier, flagged: flags.reach },
  ];
  const winners = candidates.filter((c) => c.flagged);
  if (winners.length === 0) return null;
  return winners.reduce((best, c) => (c.value > best.value ? c : best), winners[0]);
}

export default function TopPostBadge({ flags, onClick }: Props) {
  if (!flags.any) return null;
  const top = topMultiplier(flags);
  const tooltip = top
    ? `${top.value.toFixed(1)}× your average ${top.label} — open Top Post Mode`
    : "Outperforming post — open Top Post Mode";
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200"
    >
      <span aria-hidden>★</span>
      <span>Top post{top ? ` · ${top.value.toFixed(1)}×` : ""}</span>
    </button>
  );
}
