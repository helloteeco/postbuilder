// LocalStorage helpers for Coach Mode performance tracking.
//
// Posts are stored as LoggedPost — a richer structure than the original
// single-metrics CoachPost, with an array of timed snapshots so we can
// teach users when to log (48h is the most reliable read on Instagram)
// and capture fresh numbers at later checkpoints (7d archival).
//
// CoachPost is preserved as a "view" type for legacy callers
// (TopPostMode, the existing computeAverages/flagOutlier signatures in
// topPostAnalysis.ts) that still want a flattened single-metrics shape.
// PerformanceTracker derives a CoachPost from a LoggedPost via
// toCoachPost() using the 48h-preferred snapshot, so all detection
// downstream is automatically computed against 48h numbers.
//
// Storage is channel-scoped — each Coach Mode channel keeps its own log
// under coach_ch_<id>_posts.

import { channelKey, getCurrentChannelId } from "./channels";

// ── Types ──────────────────────────────────────────────────────────────

export interface PostMetrics {
  reach: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  profileVisits: number;
  follows: number;
}

export interface PostSnapshot {
  // ISO timestamp of when the user actually clicked "Log".
  loggedAt: string;
  // Hours between postedAt and loggedAt at the moment of capture. Stored
  // (not recomputed) so the snapshot's timing classification is stable
  // even if the user later edits postedAt.
  hoursAfterPosting: number;
  metrics: PostMetrics;
}

// One slide's flattened text plus position-based hook/CTA flags. Used
// by Top Post Mode's structural analysis to learn from what actually
// worked at the content level (not just the metadata level).
export interface SlideContent {
  slideNumber: number;
  text: string;
  isHook?: boolean; // true for slide 1
  isCTA?: boolean; // true for the last slide
}

// Format types contentAnalysis can detect on a captured carousel.
export type ContentFormatType =
  | "list"
  | "story"
  | "math_walkthrough"
  | "before_after"
  | "contrarian"
  | "framework"
  | "unknown";

export type ContentHookStyle =
  | "counter_intuitive"
  | "list_promise"
  | "news_driven"
  | "specific_number"
  | "question"
  | "unknown";

export type ContentCtaPattern =
  | "dm_keyword"
  | "soft_offer"
  | "no_cta"
  | "unknown";

// Structural fingerprint of the slides. Computed by contentAnalysis.ts
// from the SlideContent[] captured for a post. Drives the diagnosis
// sentence and the structural follow-up recommendations in Top Post
// Mode.
export interface ContentAnalysis {
  formatType: ContentFormatType;
  slideCount: number;
  // Number density
  dollarAmounts: string[];
  percentages: string[];
  yearReferences: string[];
  // Specificity
  namedCities: string[];
  namedPeople: string[];
  namedBrands: string[];
  // Structural
  hookStyle: ContentHookStyle;
  averageSlideLength: number;
  ctaPattern: ContentCtaPattern;
  ctaKeyword?: string;
  // Emphasis
  boldedTerms: string[];
}

export interface LoggedPost {
  id: string;
  title: string;
  // ISO timestamp — when the post went live on Instagram.
  postedAt: string;
  // Stored explicitly now (was previously inferred from date). For
  // legacy migrated posts these will be empty strings; the UI lets the
  // user fill them in by editing.
  pillar: string;
  hookFormula: string;
  // Empty array is allowed — represents a post the user logged but
  // chose to defer the metrics until 48h ("remind me later").
  snapshots: PostSnapshot[];
  isWinner: boolean;
  // Has Top Post Mode already triggered a strategy lock from this post?
  // Prevents double-firing when a 7-day snapshot updates the metrics.
  lockedStrategyTriggered: boolean;
  // Insertion timestamp, used for sort order.
  createdAt: number;
  // Optional — captured slide content + structural analysis. Both are
  // optional so legacy posts continue to work without slides.
  slides?: SlideContent[];
  contentAnalysis?: ContentAnalysis;
  // Optional reference to the Post Builder draft a user linked.
  postBuilderDraftId?: string;
}

// Legacy single-metrics shape. Still consumed by TopPostMode and the
// old detection signatures in topPostAnalysis.ts.
export interface CoachPost {
  id: string;
  title: string;
  // YYYY-MM-DD; derived from postedAt's local-date portion.
  datePosted: string;
  reach: number;
  saves: number;
  shares: number;
  profileVisits: number;
  createdAt: number;
}

export type PerfTier = "good" | "ok" | "bad";

// Targets per the spec: save rate ≥ 1.5%, share rate ≥ 0.6%.
export const SAVE_RATE_TARGET = 1.5;
export const SHARE_RATE_TARGET = 0.6;

// Default hoursAfterPosting for migrated legacy posts (single-entry
// snapshots that don't know when they were captured). Per spec.
const LEGACY_DEFAULT_HOURS = 48;

// ── Storage primitives ─────────────────────────────────────────────────

function postsKey(): string {
  return channelKey(getCurrentChannelId(), "posts");
}

function dismissedRemindersKey(): string {
  return channelKey(getCurrentChannelId(), "dismissed_reminders");
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newPostId(): string {
  return `post_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

// ── LoggedPost shape guards + migration ────────────────────────────────

function isLoggedPostShape(p: unknown): p is LoggedPost {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.postedAt === "string" &&
    typeof o.pillar === "string" &&
    typeof o.hookFormula === "string" &&
    Array.isArray(o.snapshots) &&
    typeof o.isWinner === "boolean" &&
    typeof o.lockedStrategyTriggered === "boolean" &&
    typeof o.createdAt === "number"
  );
}

function isLegacyCoachPostShape(p: unknown): p is CoachPost {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.datePosted === "string" &&
    typeof o.reach === "number" &&
    typeof o.saves === "number" &&
    typeof o.shares === "number" &&
    typeof o.createdAt === "number"
  );
}

// Convert a legacy CoachPost (single metrics, datePosted only) into the
// new LoggedPost shape with one snapshot at the legacy default hours.
function migrateLegacyPost(old: CoachPost): LoggedPost {
  // Approximate postedAt: take the date and pin to local midnight.
  const postedAt = `${old.datePosted}T00:00:00.000`;
  const loggedAt = new Date(old.createdAt).toISOString();
  return {
    id: old.id,
    title: old.title,
    postedAt,
    pillar: "",
    hookFormula: "",
    snapshots: [
      {
        loggedAt,
        hoursAfterPosting: LEGACY_DEFAULT_HOURS,
        metrics: {
          reach: old.reach,
          saves: old.saves,
          shares: old.shares,
          likes: 0,
          comments: 0,
          profileVisits:
            typeof (old as unknown as { profileVisits?: number }).profileVisits ===
            "number"
              ? (old as unknown as { profileVisits: number }).profileVisits
              : 0,
          follows: 0,
        },
      },
    ],
    isWinner: false,
    lockedStrategyTriggered: false,
    createdAt: old.createdAt,
  };
}

// Reads + migrates posts. If any entries were in the old shape they get
// written back to localStorage so subsequent loads are pure.
// Derive the canonical title for a post from its captured slide 1
// hook. Posts with no slides keep whatever the user typed. The user
// explicitly wants "anything with slides" to use the cover hook as
// title, so this runs on every load + on every capture/replace.
// Strips ** asterisks, collapses whitespace, caps at 110 chars so
// the title stays scannable in the row.
function deriveTitleFromSlides(post: LoggedPost): string {
  const slide1Text = post.slides?.[0]?.text;
  if (!slide1Text) return post.title;
  const cleaned = slide1Text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return post.title;
  return cleaned.length > 110 ? cleaned.slice(0, 107).trimEnd() + "…" : cleaned;
}

export function loadLoggedPosts(): LoggedPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(postsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let didMigrate = false;
    const result: LoggedPost[] = [];
    for (const p of parsed) {
      if (isLoggedPostShape(p)) {
        // Title self-heal: when slides exist, title MUST be the
        // slide-1 cover hook. Idempotent — no write unless we
        // actually change something.
        const derived = deriveTitleFromSlides(p);
        if (derived !== p.title) {
          result.push({ ...p, title: derived });
          didMigrate = true;
        } else {
          result.push(p);
        }
      } else if (isLegacyCoachPostShape(p)) {
        result.push(migrateLegacyPost(p));
        didMigrate = true;
      }
      // anything else: silently drop — malformed
    }
    if (didMigrate) {
      // Write back so subsequent loads are pure no-ops.
      try {
        localStorage.setItem(postsKey(), JSON.stringify(result));
      } catch {
        // ignore quota
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveLoggedPosts(posts: LoggedPost[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(postsKey(), JSON.stringify(posts));
  } catch {
    // ignore
  }
}

// Legacy adapter for callers that still consume the flat CoachPost
// shape (PromptBuilder's "what's worked" analysis, etc.). Each LoggedPost
// is flattened into a CoachPost using its best available snapshot:
//   - detection snapshot (48h preferred) when present
//   - else the latest snapshot
//   - posts with NO snapshots (the "remind me at 48h" pre-fills) are
//     dropped from the legacy view
// New code should call loadLoggedPosts() directly.
export function loadPosts(): CoachPost[] {
  const out: CoachPost[] = [];
  for (const lp of loadLoggedPosts()) {
    const fortyEight = lp.snapshots.find(
      (s) => s.hoursAfterPosting >= 36 && s.hoursAfterPosting <= 72,
    );
    const snap = fortyEight ?? lp.snapshots[lp.snapshots.length - 1] ?? null;
    if (!snap) continue;
    out.push(toCoachPost(lp, snap));
  }
  return out;
}

// Old name kept for backward compat with any code that imports it.
// Internally this is a no-op shim that ignores the legacy shape and
// expects callers to migrate to saveLoggedPosts.
export function savePosts(posts: LoggedPost[]): void {
  saveLoggedPosts(posts);
}

// ── Public mutators ────────────────────────────────────────────────────

export interface NewLoggedPostInput {
  title: string;
  postedAt: string; // ISO timestamp
  pillar: string;
  hookFormula: string;
  // Optional first snapshot. If omitted, the post is created with an
  // empty snapshots array — used for the "remind me at 48h" flow where
  // the user hasn't entered metrics yet.
  initialMetrics?: PostMetrics;
  initialHoursAfterPosting?: number;
}

export function addLoggedPost(input: NewLoggedPostInput): LoggedPost {
  const now = Date.now();
  const post: LoggedPost = {
    id: newPostId(),
    title: input.title,
    postedAt: input.postedAt,
    pillar: input.pillar,
    hookFormula: input.hookFormula,
    snapshots:
      input.initialMetrics === undefined
        ? []
        : [
            {
              loggedAt: new Date(now).toISOString(),
              hoursAfterPosting:
                typeof input.initialHoursAfterPosting === "number"
                  ? input.initialHoursAfterPosting
                  : 0,
              metrics: input.initialMetrics,
            },
          ],
    isWinner: false,
    lockedStrategyTriggered: false,
    createdAt: now,
  };
  saveLoggedPosts([post, ...loadLoggedPosts()]);
  return post;
}

export interface AddSnapshotInput {
  postId: string;
  metrics: PostMetrics;
  hoursAfterPosting: number;
}

export function addSnapshotToPost(input: AddSnapshotInput): void {
  const all = loadLoggedPosts();
  const idx = all.findIndex((p) => p.id === input.postId);
  if (idx < 0) return;
  const snapshot: PostSnapshot = {
    loggedAt: new Date().toISOString(),
    hoursAfterPosting: input.hoursAfterPosting,
    metrics: input.metrics,
  };
  const updated: LoggedPost = {
    ...all[idx],
    snapshots: [...all[idx].snapshots, snapshot],
  };
  const next = all.slice();
  next[idx] = updated;
  saveLoggedPosts(next);
}

export function setPostWinner(postId: string, isWinner: boolean): void {
  const all = loadLoggedPosts();
  saveLoggedPosts(
    all.map((p) => (p.id === postId ? { ...p, isWinner } : p)),
  );
}

export function markLockedStrategyTriggered(postId: string): void {
  const all = loadLoggedPosts();
  saveLoggedPosts(
    all.map((p) =>
      p.id === postId ? { ...p, lockedStrategyTriggered: true } : p,
    ),
  );
}

export function deletePost(id: string): void {
  saveLoggedPosts(loadLoggedPosts().filter((p) => p.id !== id));
}

// Replace a post in place. Used by the edit-log form to commit changes
// to title / pillar / hook / individual snapshots / snapshot deletions
// without re-typing any storage logic per field.
export function replacePost(post: LoggedPost): void {
  saveLoggedPosts(
    loadLoggedPosts().map((p) => (p.id === post.id ? post : p)),
  );
}

// ── Reminder dismissal (so the LoggingReminder doesn't nag forever) ───

export type ReminderKind = "h48" | "d7";

interface DismissedReminder {
  postId: string;
  kind: ReminderKind;
  dismissedAt: number;
}

function loadDismissed(): DismissedReminder[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(dismissedRemindersKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is DismissedReminder =>
        d &&
        typeof d.postId === "string" &&
        (d.kind === "h48" || d.kind === "d7") &&
        typeof d.dismissedAt === "number",
    );
  } catch {
    return [];
  }
}

function saveDismissed(list: DismissedReminder[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(dismissedRemindersKey(), JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function dismissReminder(postId: string, kind: ReminderKind): void {
  const next = loadDismissed().filter(
    (d) => !(d.postId === postId && d.kind === kind),
  );
  next.push({ postId, kind, dismissedAt: Date.now() });
  saveDismissed(next);
}

export function isReminderDismissed(postId: string, kind: ReminderKind): boolean {
  return loadDismissed().some((d) => d.postId === postId && d.kind === kind);
}

// ── Snapshot-derived rates + tier classification ──────────────────────

// Save rate / share rate accept anything with reach/saves/shares — works
// for both PostMetrics and CoachPost so existing TopPostMode usage stays
// identical.
export function saveRate(p: { reach: number; saves: number }): number {
  if (!p.reach) return 0;
  return (p.saves / p.reach) * 100;
}

export function shareRate(p: { reach: number; shares: number }): number {
  if (!p.reach) return 0;
  return (p.shares / p.reach) * 100;
}

export function ratePerf(rate: number, target: number): PerfTier {
  if (rate >= target) return "good";
  if (rate >= target / 2) return "ok";
  return "bad";
}

// ── LoggedPost ↔ CoachPost view conversion ────────────────────────────

// Flatten a (post, snapshot) pair into the legacy CoachPost shape.
// Used wherever existing code (TopPostMode, the old detection
// signatures) needs a single-metrics view.
export function toCoachPost(post: LoggedPost, snapshot: PostSnapshot): CoachPost {
  const m = snapshot.metrics;
  return {
    id: post.id,
    title: post.title,
    datePosted: post.postedAt.slice(0, 10),
    reach: m.reach,
    saves: m.saves,
    shares: m.shares,
    profileVisits: m.profileVisits,
    createdAt: post.createdAt,
  };
}
