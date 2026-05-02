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
