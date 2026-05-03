// Timing helpers for the snapshot-based Performance Tracker.
//
// Instagram metrics move on a known curve:
//   - shares lock in around 48h
//   - reach climbs for ~7 days
//   - saves accumulate for 2-3 weeks
//
// These helpers classify "when in the curve are we?" so the UI can pick
// the right copy and decide whether a post needs another snapshot.

import {
  isReminderDismissed,
  type LoggedPost,
  type PostSnapshot,
  type ReminderKind,
} from "./storage";

const ONE_HOUR_MS = 60 * 60 * 1000;

// Hours between postedAt and now. Negative inputs (postedAt in the
// future) clamp to 0 so the timing classifier doesn't get confused by
// minor clock skew.
export function hoursSincePost(postedAt: string): number {
  const t = new Date(postedAt).getTime();
  if (Number.isNaN(t)) return 0;
  const ms = Date.now() - t;
  return Math.max(0, ms / ONE_HOUR_MS);
}

// The 48h-window snapshot if one exists. 36-72h is wide enough to cover
// real-world "I logged this around two days later" while staying close
// to the proven signal point.
export function getDetectionSnapshot(post: LoggedPost): PostSnapshot | null {
  const fortyEight = post.snapshots.find(
    (s) => s.hoursAfterPosting >= 36 && s.hoursAfterPosting <= 72,
  );
  if (fortyEight) return fortyEight;
  // Fall back to the latest snapshot only if it represents settled
  // data. A preliminary <24h snapshot isn't reliable enough for outlier
  // detection — return null so the caller skips the post.
  const latest = post.snapshots[post.snapshots.length - 1];
  if (!latest) return null;
  if (latest.hoursAfterPosting < 24) return null;
  return latest;
}

// Returns the next reminder/checkpoint the user should log for this
// post, or null if nothing is needed right now. Reminders the user has
// dismissed are skipped.
//
// Logic mirrors the spec:
//   - 48h reminder: post has 0 snapshots OR exactly 1 with
//     hoursAfterPosting < 36, AND it's now 48-72h since post.
//   - 7d reminder: post has 1-2 snapshots AND it's now 7-10 days
//     since post.
export function getRecommendedNextSnapshot(post: LoggedPost): {
  shouldLog: boolean;
  reason: string;
  targetHours: number;
  kind: ReminderKind;
} | null {
  const now = hoursSincePost(post.postedAt);
  const snapCount = post.snapshots.length;

  // 48h checkpoint
  const has48h = post.snapshots.some(
    (s) => s.hoursAfterPosting >= 36 && s.hoursAfterPosting <= 72,
  );
  const onlyPreliminary =
    snapCount === 1 && post.snapshots[0].hoursAfterPosting < 36;
  const eligibleFor48h =
    !has48h && (snapCount === 0 || onlyPreliminary) && now >= 48 && now <= 72;
  if (eligibleFor48h && !isReminderDismissed(post.id, "h48")) {
    return {
      shouldLog: true,
      reason: "Your 48-hour reading is the most reliable",
      targetHours: 48,
      kind: "h48",
    };
  }

  // 7d checkpoint — only after we've passed 48h and post has 1-2 snaps
  const has7d = post.snapshots.some((s) => s.hoursAfterPosting >= 7 * 24);
  const eligibleFor7d =
    !has7d &&
    snapCount >= 1 &&
    snapCount <= 2 &&
    now >= 7 * 24 &&
    now <= 10 * 24;
  if (eligibleFor7d && !isReminderDismissed(post.id, "d7")) {
    return {
      shouldLog: true,
      reason: "Final numbers help spot patterns over time",
      targetHours: 7 * 24,
      kind: "d7",
    };
  }

  return null;
}

// Five timing buckets the multi-step logging form switches its
// recommendation card on. The boundary at 24h matches "still climbing —
// wait for 48h". The 72h and 7d boundaries match the spec's other
// states.
export type TimingBucket = "preliminary" | "ideal" | "lateOk" | "mature" | "future";

export function classifyTiming(hoursSincePosting: number): TimingBucket {
  if (hoursSincePosting < 0) return "future";
  if (hoursSincePosting < 24) return "preliminary";
  if (hoursSincePosting < 72) return "ideal";
  if (hoursSincePosting < 7 * 24) return "lateOk";
  return "mature";
}

// ── Time normalization ────────────────────────────────────────────────
//
// Instagram metrics aren't done at the moment they're logged — reach
// climbs for ~7 days, saves accumulate for 2-3 weeks, shares mostly
// settle by 48h. Two posts with the same raw numbers but logged at
// different points in their curves represent very different audience
// responses (e.g. "600 reach at 24h" >>> "600 reach at 14 days").
//
// To compare posts fairly, we normalize each snapshot back to its
// 48-hour-equivalent — what the metric likely WAS / WILL BE at 48h
// based on the fraction of the curve that's elapsed. Posts logged at
// exactly 48h are a no-op (curve factor = 1.0). Earlier posts scale
// UP (their numbers are still climbing). Later posts scale DOWN
// (their numbers have already accumulated past the 48h mark).
//
// The curves below are piecewise-linear approximations of the standard
// Instagram metric trajectory. Tunable as the team gathers real data.
// For now they're documented anchor points the curve passes through:
//
//   reach:  f(0)=0.10  f(24)=0.65  f(48)=1.00  f(72)=1.10  f(168)=1.30  f(336)=1.40  f(720)=1.55
//   saves:  f(0)=0.05  f(24)=0.70  f(48)=1.00  f(72)=1.15  f(168)=1.55  f(336)=1.80  f(720)=2.10
//   shares: f(0)=0.40  f(24)=0.85  f(48)=1.00  f(72)=1.05  f(168)=1.10  f(336)=1.12  f(720)=1.15
//
// (Saves keep growing the longest; shares finish the fastest.)

import type { PostMetrics } from "./storage";

// Anchor points. Each pair is [hoursAfterPosting, fractionOf48hValue].
// Must be ordered by hour, ascending, with f(48) === 1.0 as the pivot.
const REACH_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.10],
  [24, 0.65],
  [48, 1.0],
  [72, 1.10],
  [168, 1.30],
  [336, 1.40],
  [720, 1.55],
];

const SAVES_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.05],
  [24, 0.70],
  [48, 1.0],
  [72, 1.15],
  [168, 1.55],
  [336, 1.80],
  [720, 2.10],
];

const SHARES_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.40],
  [24, 0.85],
  [48, 1.0],
  [72, 1.05],
  [168, 1.10],
  [336, 1.12],
  [720, 1.15],
];

// Linear interpolation between anchor points. Clamps outside the
// declared range.
function interpolate(
  hours: number,
  anchors: ReadonlyArray<readonly [number, number]>,
): number {
  if (hours <= anchors[0][0]) return anchors[0][1];
  if (hours >= anchors[anchors.length - 1][0]) {
    return anchors[anchors.length - 1][1];
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const [h1, v1] = anchors[i];
    const [h2, v2] = anchors[i + 1];
    if (hours >= h1 && hours <= h2) {
      const t = (hours - h1) / (h2 - h1);
      return v1 + t * (v2 - v1);
    }
  }
  return 1.0;
}

export function reachCurveFraction(hours: number): number {
  return interpolate(hours, REACH_ANCHORS);
}
export function savesCurveFraction(hours: number): number {
  return interpolate(hours, SAVES_ANCHORS);
}
export function sharesCurveFraction(hours: number): number {
  return interpolate(hours, SHARES_ANCHORS);
}

// Returns the metric's projected 48h-equivalent value. metric / curve(h).
// Guards against divide-by-zero with a tiny floor.
function project(metric: number, fraction: number): number {
  if (!metric) return 0;
  const f = Math.max(0.05, fraction);
  return Math.round(metric / f);
}

// Normalize a snapshot's metrics back to its 48h-equivalent using the
// curves above. Reach / saves / shares are normalized independently;
// likes / comments / profileVisits / follows are passed through
// unchanged because we don't currently use them in detection (and
// their curves vary too much by post type to assume a default).
export function normalizeMetricsTo48h(
  metrics: PostMetrics,
  hoursAfterPosting: number,
): PostMetrics {
  return {
    reach: project(metrics.reach, reachCurveFraction(hoursAfterPosting)),
    saves: project(metrics.saves, savesCurveFraction(hoursAfterPosting)),
    shares: project(metrics.shares, sharesCurveFraction(hoursAfterPosting)),
    likes: metrics.likes,
    comments: metrics.comments,
    profileVisits: metrics.profileVisits,
    follows: metrics.follows,
  };
}

// Returns true when normalization meaningfully changes the snapshot's
// numbers — i.e. the snapshot was NOT logged at the 48h reference. Used
// by the UI to decide whether to show the "values normalized to 48h"
// note. Anything inside the 36-72h window is close enough that we
// consider it the canonical read.
export function snapshotIsNormalized(hoursAfterPosting: number): boolean {
  return hoursAfterPosting < 36 || hoursAfterPosting > 72;
}
