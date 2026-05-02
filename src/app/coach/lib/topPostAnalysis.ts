// Outlier detection + lock-strategy storage for Top Post Mode.
//
// What this module does:
//   - decides whether a logged post outperformed the user's averages
//   - infers the pillar / hook formula a logged post used (from its date)
//   - persists + retrieves the active 14-day "locked strategy" so Coach
//     Mode can bias its rotation toward what's working
//
// The lock type itself + the biased lookup live in strategy.ts so
// getPillarForSlot / getHookForSlot can consult the lock without
// importing this module (avoids a circular dep). This module owns the
// localStorage layer and the install/uninstall lifecycle.
//
// The lock is channel-scoped (consistent with the rest of Coach Mode's
// per-channel data), so each channel has its own lock independent of
// the others.

import {
  LOCK_DURATION_DAYS,
  getHookForSlot,
  getPillarForSlot,
  setEffectiveLock,
  setLockProvider,
  type HookFormula,
  type LockedStrategy,
  type Pillar,
} from "./strategy";
import {
  CoachPost,
  saveRate,
  shareRate,
  type LoggedPost,
  type PostMetrics,
} from "./storage";
import { channelKey, getCurrentChannelId } from "./channels";
import { getDetectionSnapshot } from "./timingHelpers";

const SUFFIX_LOCKED = "locked_strategy";

// Register a lazy lock provider with strategy.ts so getEffectiveLock can
// read from localStorage on first use without strategy.ts importing this
// module (which would create a cycle). Runs once at module-import time;
// any subsequent install via installLockedStrategy() calls setEffectiveLock
// directly, which preempts the lazy path.
setLockProvider(() => loadLockedStrategy());

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function lockKey(): string {
  return channelKey(getCurrentChannelId(), SUFFIX_LOCKED);
}

export function loadLockedStrategy(): LockedStrategy | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(lockKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockedStrategy;
    if (
      !parsed ||
      typeof parsed.pillarId !== "string" ||
      typeof parsed.hookId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      try {
        localStorage.removeItem(lockKey());
      } catch {
        // ignore
      }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLockedStrategy(lock: LockedStrategy | null): void {
  if (!isBrowser()) return;
  try {
    if (lock === null) {
      localStorage.removeItem(lockKey());
    } else {
      localStorage.setItem(lockKey(), JSON.stringify(lock));
    }
  } catch {
    // ignore
  }
}

// Reads the active lock from localStorage and installs it into the
// strategy module's effective ref, so getPillarForSlot / getHookForSlot
// pick it up. Idempotent — call after any lock change and on app boot.
export function installLockedStrategy(): void {
  setEffectiveLock(loadLockedStrategy());
}

// Build a fresh lock that starts now and expires LOCK_DURATION_DAYS later.
export function buildLockedStrategy(args: {
  pillarId: string;
  hookId: string;
  post: CoachPost;
}): LockedStrategy {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const expiresAt = dayStart.getTime() + LOCK_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return {
    pillarId: args.pillarId,
    hookId: args.hookId,
    lockedAt: now.getTime(),
    expiresAt,
    startDayMs: dayStart.getTime(),
    postId: args.post.id,
    postTitle: args.post.title,
  };
}

// ── Outlier detection ────────────────────────────────────────────────────

export const MIN_POSTS_FOR_DETECTION = 3;
export const OUTLIER_MULTIPLIER = 2;

export interface AveragesSummary {
  avgSaveRate: number;
  avgShareRate: number;
  avgReach: number;
}

export function computeAverages(posts: CoachPost[]): AveragesSummary {
  if (posts.length === 0) {
    return { avgSaveRate: 0, avgShareRate: 0, avgReach: 0 };
  }
  let totalSave = 0;
  let totalShare = 0;
  let totalReach = 0;
  for (const p of posts) {
    totalSave += saveRate(p);
    totalShare += shareRate(p);
    totalReach += p.reach;
  }
  return {
    avgSaveRate: totalSave / posts.length,
    avgShareRate: totalShare / posts.length,
    avgReach: totalReach / posts.length,
  };
}

export interface OutlierFlags {
  saveRate: boolean;
  shareRate: boolean;
  reach: boolean;
  // any === true → post is considered outperforming
  any: boolean;
  // Multiplier of post's metric vs the user's average. Drives the
  // "3.2× your average share rate" copy in the modal.
  saveRateMultiplier: number;
  shareRateMultiplier: number;
  reachMultiplier: number;
}

export function flagOutlier(
  post: CoachPost,
  averages: AveragesSummary,
): OutlierFlags {
  const saveMul = averages.avgSaveRate > 0 ? saveRate(post) / averages.avgSaveRate : 0;
  const shareMul = averages.avgShareRate > 0 ? shareRate(post) / averages.avgShareRate : 0;
  const reachMul = averages.avgReach > 0 ? post.reach / averages.avgReach : 0;
  const saveBeat = saveMul >= OUTLIER_MULTIPLIER;
  const shareBeat = shareMul >= OUTLIER_MULTIPLIER;
  const reachBeat = reachMul >= OUTLIER_MULTIPLIER;
  return {
    saveRate: saveBeat,
    shareRate: shareBeat,
    reach: reachBeat,
    any: saveBeat || shareBeat || reachBeat,
    saveRateMultiplier: saveMul,
    shareRateMultiplier: shareMul,
    reachMultiplier: reachMul,
  };
}

// Detection runs only after the user has logged enough posts to have
// meaningful averages. Below the threshold we surface the message
// "Log more posts to unlock outlier detection."
export function isDetectionEligible(posts: CoachPost[]): boolean {
  return posts.length >= MIN_POSTS_FOR_DETECTION;
}

// ── 48-hour-snapshot-aware detection (LoggedPost shape) ──────────────────

// Returns the PostMetrics we should use to evaluate this post. Prefers
// the 48-hour snapshot via getDetectionSnapshot. Returns null if the
// post hasn't reached a settled state yet (only preliminary <24h data),
// in which case callers should skip outlier detection on this post.
export function getDetectionMetrics(post: LoggedPost): PostMetrics | null {
  const snapshot = getDetectionSnapshot(post);
  return snapshot?.metrics ?? null;
}

// Filter for "posts the detection layer should evaluate". Excludes
// LoggedPosts whose only snapshot is preliminary (<24h) — averages
// computed from preliminary numbers would be misleading.
export function detectionEligiblePosts(posts: LoggedPost[]): LoggedPost[] {
  return posts.filter((p) => getDetectionMetrics(p) !== null);
}

// ── Pillar / hook inference for a logged post ────────────────────────────

// Performance Tracker doesn't store pillar/hook with each post, so we
// infer from the post's date using the AM-slot rotation that was active
// that day. The user can override the inference in the Top Post Mode
// modal before locking in.
export function inferPostMetadata(post: CoachPost): {
  date: Date | null;
  pillar: Pillar | null;
  hook: HookFormula | null;
} {
  const d = parseISODate(post.datePosted);
  if (!d) return { date: null, pillar: null, hook: null };
  return {
    date: d,
    pillar: getPillarForSlot(d, "am"),
    hook: getHookForSlot(d, "am"),
  };
}

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Format a lock's expiry as a friendly local date string for the banner.
export function formatLockExpiry(lock: LockedStrategy): string {
  return new Date(lock.expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
