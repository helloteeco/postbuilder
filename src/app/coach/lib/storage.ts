// LocalStorage helpers for Coach Mode performance tracking.
//
// All keys are prefixed coach_ to keep them clearly separate from
// the Post Builder's localStorage keys. No schema migrations — if the
// shape changes, old data is dropped and the user starts fresh.

export interface CoachPost {
  id: string;
  title: string;
  // ISO date string (yyyy-mm-dd). Stored as string so date math is
  // explicit and there are no Date-vs-string surprises.
  datePosted: string;
  reach: number;
  saves: number;
  shares: number;
  profileVisits: number;
  // Insertion timestamp, used for sort order in the recent-posts list.
  createdAt: number;
}

import { channelKey, getCurrentChannelId } from "./channels";

// Per-channel scoped key. Each channel keeps its own performance log so
// switching channels gives you a fresh tracker.
function postsKey(): string {
  return channelKey(getCurrentChannelId(), "posts");
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadPosts(): CoachPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(postsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out anything that doesn't look like a CoachPost so we don't
    // crash later on malformed/old data.
    return parsed.filter(
      (p): p is CoachPost =>
        p &&
        typeof p.id === "string" &&
        typeof p.title === "string" &&
        typeof p.datePosted === "string" &&
        typeof p.reach === "number" &&
        typeof p.saves === "number" &&
        typeof p.shares === "number" &&
        typeof p.profileVisits === "number" &&
        typeof p.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function savePosts(posts: CoachPost[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(postsKey(), JSON.stringify(posts));
  } catch {
    // Quota exceeded or storage disabled — nothing to do.
  }
}

export function addPost(input: Omit<CoachPost, "id" | "createdAt">): CoachPost {
  const post: CoachPost = {
    ...input,
    id: `post_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
    createdAt: Date.now(),
  };
  const next = [post, ...loadPosts()];
  savePosts(next);
  return post;
}

export function deletePost(id: string): void {
  savePosts(loadPosts().filter((p) => p.id !== id));
}

// Save rate = saves / reach, expressed as a percentage. Returns 0 if
// reach is 0 or missing so the UI never divides by zero.
export function saveRate(post: CoachPost): number {
  if (!post.reach) return 0;
  return (post.saves / post.reach) * 100;
}

// Share rate = shares / reach, percentage. Same zero-guard as saveRate.
export function shareRate(post: CoachPost): number {
  if (!post.reach) return 0;
  return (post.shares / post.reach) * 100;
}

// Performance tier for a metric. Used to color-code a rate in the UI:
//   good   → ≥ target
//   ok     → ≥ half target but < target
//   bad    → below half target
export type PerfTier = "good" | "ok" | "bad";

export function ratePerf(rate: number, target: number): PerfTier {
  if (rate >= target) return "good";
  if (rate >= target / 2) return "ok";
  return "bad";
}

// Targets per the spec: save rate >1.5%, share rate >0.6%.
export const SAVE_RATE_TARGET = 1.5;
export const SHARE_RATE_TARGET = 0.6;
