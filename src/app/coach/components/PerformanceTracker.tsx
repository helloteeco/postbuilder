// Section C of Coach Mode: log a published post's metrics over time so
// Coach Mode can teach you what's working.
//
// Posts are stored as LoggedPost — a sequence of timed snapshots, not a
// single metrics row — so the tracker can:
//   - tell you when in the curve to log (48h is the sweet spot)
//   - prompt for a 7-day update to nail down archival numbers
//   - run outlier detection against your 48h reading specifically
//
// TopPostMode still consumes the legacy CoachPost shape; we convert at
// the boundary using the 48h-preferred snapshot via toCoachPost(post,
// getDetectionSnapshot(post)).

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HOOK_FORMULAS,
  getEffectivePillars,
  type HookFormula,
  type Pillar,
} from "@/app/coach/lib/strategy";
import {
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  addLoggedPost,
  addSnapshotToPost,
  deletePost,
  loadLoggedPosts,
  replacePost,
  ratePerf,
  saveRate,
  shareRate,
  toCoachPost,
  type CoachPost,
  type LoggedPost,
  type PerfTier,
  type PostMetrics,
  type PostSnapshot,
  type SlideContent,
} from "@/app/coach/lib/storage";
import { analyzeContent } from "@/app/coach/lib/contentAnalysis";
import {
  loadPendingDrafts,
  removePendingDraft,
  type PendingDraft,
} from "@/app/coach/lib/pendingDraft";
import {
  computeAverages,
  detectionEligiblePosts,
  flagOutlier,
  isDetectionEligible,
  MIN_POSTS_FOR_DETECTION,
} from "@/app/coach/lib/topPostAnalysis";
import {
  classifyTiming,
  getDetectionSnapshot,
  getRecommendedNextSnapshot,
  hoursSincePost,
  normalizeMetricsTo48h,
  type TimingBucket,
} from "@/app/coach/lib/timingHelpers";
import LoggingReminder from "@/app/coach/components/LoggingReminder";
import TopPostBadge from "@/app/coach/components/TopPostBadge";
import SlideCaptureModal from "@/app/coach/components/SlideCaptureModal";
import TopPostMode from "@/app/coach/components/TopPostMode";
import RemixPromptModal from "@/app/coach/components/RemixPromptModal";

// ── Form types ─────────────────────────────────────────────────────────

interface MetricsForm {
  reach: string;
  saves: string;
  shares: string;
  likes: string;
  comments: string;
  profileVisits: string;
  follows: string;
}

interface NewPostDraft {
  mode: "new";
  title: string;
  postedAt: string; // datetime-local format (yyyy-mm-ddThh:mm)
  pillar: string;
  hookFormula: string;
  metrics: MetricsForm;
  // When the form was prefilled from a Post Builder handoff. After
  // save we attach these slides + run structural analysis, then drop
  // the pending draft from the queue. Absent for from-scratch logs.
  pendingDraftId?: string;
  pendingSlides?: SlideContent[];
  pendingPostBuilderDraftId?: string;
}

interface UpdateDraft {
  mode: "update";
  postId: string;
  metrics: MetricsForm;
}

// Pre-existing snapshots inflated into editable form rows. We carry
// loggedAt / hoursAfterPosting through unchanged on save so the
// snapshot's timing classification stays stable.
interface SnapshotEditEntry {
  loggedAt: string;
  hoursAfterPosting: number;
  metrics: MetricsForm;
}

interface EditDraft {
  mode: "edit";
  postId: string;
  title: string;
  // datetime-local format (yyyy-mm-ddThh:mm). Editable so users can fix
  // a mistyped post time. Snapshots' hoursAfterPosting get recomputed
  // against the corrected value on save.
  postedAt: string;
  pillar: string;
  hookFormula: string;
  snapshots: SnapshotEditEntry[];
}

type FormDraft = NewPostDraft | UpdateDraft | EditDraft | null;

const EMPTY_METRICS: MetricsForm = {
  reach: "",
  saves: "",
  shares: "",
  likes: "",
  comments: "",
  profileVisits: "",
  follows: "",
};

function tierClasses(t: PerfTier): string {
  if (t === "good") return "text-emerald-700 bg-emerald-50";
  if (t === "ok") return "text-amber-700 bg-amber-50";
  return "text-rose-700 bg-rose-50";
}

function fmtRate(n: number): string {
  return `${n.toFixed(2)}%`;
}

function nowDateTimeLocal(): string {
  // datetime-local expects yyyy-mm-ddThh:mm in the user's local zone.
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Inverse of dateTimeLocalToIso — used by the edit-log form to seed
// the datetime-local input from the post's stored ISO timestamp.
function isoToDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowDateTimeLocal();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateTimeLocalToIso(local: string): string {
  // Treat input as local time → convert to ISO (UTC). new Date(localStr)
  // does this correctly when the string lacks a Z suffix.
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function metricsFromForm(m: MetricsForm): PostMetrics {
  return {
    reach: Number(m.reach) || 0,
    saves: Number(m.saves) || 0,
    shares: Number(m.shares) || 0,
    likes: Number(m.likes) || 0,
    comments: Number(m.comments) || 0,
    profileVisits: Number(m.profileVisits) || 0,
    follows: Number(m.follows) || 0,
  };
}

// Inverse of metricsFromForm — used by the edit-log form to populate
// inputs from a stored snapshot. Empty number → empty string so the
// inputs render blank instead of "0".
function metricsToForm(m: PostMetrics): MetricsForm {
  const s = (n: number) => (n ? String(n) : "");
  return {
    reach: s(m.reach),
    saves: s(m.saves),
    shares: s(m.shares),
    likes: s(m.likes),
    comments: s(m.comments),
    profileVisits: s(m.profileVisits),
    follows: s(m.follows),
  };
}

function emptyNewDraft(pillars: Pillar[]): NewPostDraft {
  return {
    mode: "new",
    title: "",
    postedAt: nowDateTimeLocal(),
    pillar: pillars[0]?.id ?? "",
    hookFormula: HOOK_FORMULAS[0]?.id ?? "",
    metrics: { ...EMPTY_METRICS },
  };
}

function snapshotsBadgeForPost(post: LoggedPost): string {
  // The badge is driven by POST AGE first, snapshot data second. Once
  // a post crosses 36h with any data logged, the badge auto-flips to
  // "48h" — same logic as the detection-snapshot tier-3 fallback in
  // timingHelpers.ts, so the visible label and the outlier-detection
  // pool stay in sync.
  //
  // The strict 36-72h window in getDetectionSnapshot is unchanged for
  // posts that DO have a settled snapshot in that range — this is
  // about catching the case where the user logged early and never
  // came back to update.
  const hoursOld = hoursSincePost(post.postedAt);
  const hasSnapshot = post.snapshots.length > 0;

  if (hoursOld < 36) {
    return hasSnapshot ? "preliminary" : "pending";
  }
  if (hoursOld < 6.5 * 24) {
    return hasSnapshot ? "48h" : "needs 48h";
  }
  // 7d+
  if (!hasSnapshot) return "needs 7d";

  // If the user logged BOTH a 48h-window snapshot AND a 7d+ one, show
  // both badges so they can see they have paired data points.
  const has48Snap = post.snapshots.some(
    (s) => s.hoursAfterPosting >= 36 && s.hoursAfterPosting < 6.5 * 24,
  );
  return has48Snap ? "48h · 7d" : "7d";
}

// Pick the snapshot we'd pass to TopPostMode if the user clicked
// "Mark as winner". Prefers detection-eligible (48h+ settled) data, but
// falls back to the latest snapshot so manual flagging still works
// pre-48h. Returns null when the post has no snapshots at all.
function snapshotForModal(post: LoggedPost): PostSnapshot | null {
  return getDetectionSnapshot(post) ?? post.snapshots[post.snapshots.length - 1] ?? null;
}

export default function PerformanceTracker() {
  const [posts, setPosts] = useState<LoggedPost[]>([]);
  const [draft, setDraft] = useState<FormDraft>(null);
  const [topPostId, setTopPostId] = useState<string | null>(null);
  // ID of the post we're currently capturing slides for. Mutually
  // exclusive with topPostId — the modal closes Top Post Mode while
  // open so we don't stack overlays.
  const [slideCaptureFor, setSlideCaptureFor] = useState<string | null>(null);
  // ID of the post the user is remixing (Claude.ai prompt modal).
  const [remixingPostId, setRemixingPostId] = useState<string | null>(null);
  // Bumped on dismissal so LoggingReminder re-evaluates after a skip.
  const [reminderRev, setReminderRev] = useState(0);
  // Drafts handed off from the Post Builder, awaiting log. Mount load +
  // live update via the coach-pending-drafts-changed CustomEvent so a
  // user with both /coach and / open in separate tabs sees new drafts
  // appear without a reload.
  const [pendingDrafts, setPendingDrafts] = useState<PendingDraft[]>([]);

  useEffect(() => {
    setPosts(loadLoggedPosts());
    setPendingDrafts(loadPendingDrafts());
    function refreshPending() {
      setPendingDrafts(loadPendingDrafts());
    }
    window.addEventListener("coach-pending-drafts-changed", refreshPending);
    // Cross-tab: storage event fires on the other tab when localStorage
    // changes. Catches the case where the Post Builder lives in another
    // tab on the same origin.
    function onStorage(e: StorageEvent) {
      if (e.key === "coach_pending_drafts") refreshPending();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("coach-pending-drafts-changed", refreshPending);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const pillars = getEffectivePillars();

  // Outlier detection runs on the CoachPost views derived from each
  // post's detection snapshot (48h preferred), with each snapshot's
  // metrics normalized to its 48h-equivalent. That way a post logged
  // at 24h is compared on equal footing with one logged at 7d — same
  // raw numbers don't get treated as equivalent when they came in at
  // wildly different times in the curve.
  const eligibleCoachViews: CoachPost[] = useMemo(() => {
    return detectionEligiblePosts(posts).map((p) => {
      const snap = getDetectionSnapshot(p);
      // detectionEligiblePosts already filtered, so snap is non-null.
      const s = snap as PostSnapshot;
      const normalized: PostSnapshot = {
        ...s,
        metrics: normalizeMetricsTo48h(s.metrics, s.hoursAfterPosting),
      };
      return toCoachPost(p, normalized);
    });
  }, [posts]);

  const averages = useMemo(
    () => computeAverages(eligibleCoachViews),
    [eligibleCoachViews],
  );
  const detectionOn = isDetectionEligible(eligibleCoachViews);

  // What we pass into TopPostMode when the user clicks a badge or
  // "Mark as winner". Same normalization as eligibleCoachViews so the
  // multipliers shown in the modal compare apples to apples.
  const openedView: { post: CoachPost | null; allPosts: CoachPost[] } = useMemo(() => {
    if (!topPostId) return { post: null, allPosts: eligibleCoachViews };
    const lp = posts.find((p) => p.id === topPostId);
    if (!lp) return { post: null, allPosts: eligibleCoachViews };
    const snap = snapshotForModal(lp);
    if (!snap) return { post: null, allPosts: eligibleCoachViews };
    const normalized: PostSnapshot = {
      ...snap,
      metrics: normalizeMetricsTo48h(snap.metrics, snap.hoursAfterPosting),
    };
    return {
      post: toCoachPost(lp, normalized),
      allPosts: eligibleCoachViews,
    };
  }, [topPostId, posts, eligibleCoachViews]);

  // ── Form helpers ────────────────────────────────────────────────────

  function startNewDraft() {
    setDraft(emptyNewDraft(pillars));
  }

  // Pre-fill the new-post form from a Post Builder handoff. Title +
  // slides come from the pending draft; postedAt / pillar / hook /
  // metrics still need to be filled in manually since the post may
  // not be live yet.
  function startNewDraftFromPending(pending: PendingDraft) {
    const base = emptyNewDraft(pillars);
    setDraft({
      ...base,
      title: pending.title,
      pendingDraftId: pending.id,
      pendingSlides: pending.slides,
      pendingPostBuilderDraftId: pending.postBuilderDraftId,
    });
  }

  function discardPending(id: string) {
    removePendingDraft(id);
    setPendingDrafts(loadPendingDrafts());
  }

  // After addLoggedPost succeeds, attach slides + structural analysis
  // (mirrors SlideCaptureModal.commit) and drop the pending draft from
  // the queue. Called by both saveNewWithMetrics and
  // saveNewWithoutMetrics so either flow works seamlessly with a
  // pending handoff.
  function attachPendingSlidesAndCleanup(
    d: NewPostDraft,
    newPostId: string,
  ) {
    if (!d.pendingSlides || d.pendingSlides.length === 0) return;
    const all = loadLoggedPosts();
    const post = all.find((p) => p.id === newPostId);
    if (!post) return;
    const analysis = analyzeContent(d.pendingSlides);
    replacePost({
      ...post,
      slides: d.pendingSlides,
      contentAnalysis: analysis,
      postBuilderDraftId: d.pendingPostBuilderDraftId,
    });
    if (d.pendingDraftId) {
      removePendingDraft(d.pendingDraftId);
      setPendingDrafts(loadPendingDrafts());
    }
  }

  function startUpdateDraft(post: LoggedPost) {
    setDraft({
      mode: "update",
      postId: post.id,
      metrics: { ...EMPTY_METRICS },
    });
  }

  function startEditDraft(post: LoggedPost) {
    setDraft({
      mode: "edit",
      postId: post.id,
      title: post.title,
      postedAt: isoToDateTimeLocal(post.postedAt),
      pillar: post.pillar,
      hookFormula: post.hookFormula,
      snapshots: post.snapshots.map((s) => ({
        loggedAt: s.loggedAt,
        hoursAfterPosting: s.hoursAfterPosting,
        metrics: metricsToForm(s.metrics),
      })),
    });
  }

  function cancelDraft() {
    setDraft(null);
  }

  function updateNew<K extends keyof NewPostDraft>(k: K, v: NewPostDraft[K]) {
    setDraft((d) => (d && d.mode === "new" ? { ...d, [k]: v } : d));
  }

  // Updates the new-post or update form's single metrics block. Edit
  // mode has multiple snapshots so it uses updateEditSnapshotMetric
  // instead.
  function updateMetrics<K extends keyof MetricsForm>(k: K, v: string) {
    setDraft((d) => {
      if (!d) return d;
      if (d.mode === "edit") return d; // not the right updater
      return { ...d, metrics: { ...d.metrics, [k]: v } };
    });
  }

  function updateEditMeta<K extends keyof EditDraft>(k: K, v: EditDraft[K]) {
    setDraft((d) => (d && d.mode === "edit" ? { ...d, [k]: v } : d));
  }

  function updateEditSnapshotMetric(
    snapIdx: number,
    key: keyof MetricsForm,
    value: string,
  ) {
    setDraft((d) => {
      if (!d || d.mode !== "edit") return d;
      const next = d.snapshots.slice();
      next[snapIdx] = {
        ...next[snapIdx],
        metrics: { ...next[snapIdx].metrics, [key]: value },
      };
      return { ...d, snapshots: next };
    });
  }

  function removeEditSnapshot(snapIdx: number) {
    setDraft((d) => {
      if (!d || d.mode !== "edit") return d;
      const next = d.snapshots.slice();
      next.splice(snapIdx, 1);
      return { ...d, snapshots: next };
    });
  }

  // Save the new post WITH initial metrics (after Step 3).
  function saveNewWithMetrics(d: NewPostDraft, isPreliminary: boolean) {
    if (!d.title.trim()) return;
    const isoPostedAt = dateTimeLocalToIso(d.postedAt);
    const hours = hoursSincePost(isoPostedAt);
    const created = addLoggedPost({
      title: d.title.trim(),
      postedAt: isoPostedAt,
      pillar: d.pillar,
      hookFormula: d.hookFormula,
      initialMetrics: metricsFromForm(d.metrics),
      initialHoursAfterPosting: isPreliminary ? Math.round(hours) : Math.round(hours),
    });
    attachPendingSlidesAndCleanup(d, created.id);
    setPosts(loadLoggedPosts());
    setDraft(null);
  }

  // "Remind me at 48 hours" — saves the post WITHOUT a snapshot. The
  // LoggingReminder component will surface it once 48-72h has passed.
  function saveNewWithoutMetrics(d: NewPostDraft) {
    if (!d.title.trim()) return;
    const created = addLoggedPost({
      title: d.title.trim(),
      postedAt: dateTimeLocalToIso(d.postedAt),
      pillar: d.pillar,
      hookFormula: d.hookFormula,
    });
    attachPendingSlidesAndCleanup(d, created.id);
    setPosts(loadLoggedPosts());
    setDraft(null);
  }

  function saveUpdate(d: UpdateDraft) {
    const post = posts.find((p) => p.id === d.postId);
    if (!post) return;
    const hours = hoursSincePost(post.postedAt);
    addSnapshotToPost({
      postId: post.id,
      metrics: metricsFromForm(d.metrics),
      hoursAfterPosting: Math.round(hours),
    });
    setPosts(loadLoggedPosts());
    setDraft(null);
  }

  function saveEdit(d: EditDraft) {
    const original = posts.find((p) => p.id === d.postId);
    if (!original) return;
    // Convert the datetime-local back to ISO. If the user edited
    // postedAt, recompute each snapshot's hoursAfterPosting against
    // the corrected timestamp so detection-window classification
    // stays accurate.
    const newPostedAtIso = dateTimeLocalToIso(d.postedAt);
    const newPostedAtMs = new Date(newPostedAtIso).getTime();

    // Validate: postedAt must be on or before every snapshot's loggedAt.
    // Otherwise hoursAfterPosting clamps to 0 and the normalization
    // curve floor multiplies metrics ~1.67×, creating false outliers.
    const invalidSnap = d.snapshots.find((s) => {
      const loggedMs = new Date(s.loggedAt).getTime();
      return !Number.isNaN(loggedMs) && loggedMs < newPostedAtMs;
    });
    if (invalidSnap) {
      const loggedAtFmt = new Date(invalidSnap.loggedAt).toLocaleString();
      alert(
        `Posted-at (${new Date(newPostedAtIso).toLocaleString()}) is after one of this post's snapshots was logged (${loggedAtFmt}). The post must go live before any snapshot is taken — fix the time and try again.`,
      );
      return;
    }

    const updated: LoggedPost = {
      ...original,
      title: d.title.trim() || original.title,
      postedAt: newPostedAtIso,
      pillar: d.pillar,
      hookFormula: d.hookFormula,
      snapshots: d.snapshots.map((s) => {
        const loggedMs = new Date(s.loggedAt).getTime();
        const recomputed = Number.isNaN(loggedMs) || Number.isNaN(newPostedAtMs)
          ? s.hoursAfterPosting
          : Math.max(0, Math.round((loggedMs - newPostedAtMs) / (60 * 60 * 1000)));
        return {
          loggedAt: s.loggedAt,
          hoursAfterPosting: recomputed,
          metrics: metricsFromForm(s.metrics),
        };
      }),
    };
    replacePost(updated);
    setPosts(loadLoggedPosts());
    setDraft(null);
  }

  function onDelete(id: string) {
    deletePost(id);
    setPosts(loadLoggedPosts());
  }

  function bumpReminderRev() {
    setReminderRev((r) => r + 1);
    setPosts(loadLoggedPosts());
  }

  // Currently-selected new-post form data (or null if not in new mode).
  const newDraft = draft && draft.mode === "new" ? draft : null;
  const updateDraft = draft && draft.mode === "update" ? draft : null;
  const updatingPost = updateDraft
    ? posts.find((p) => p.id === updateDraft.postId) ?? null
    : null;
  const editDraft = draft && draft.mode === "edit" ? draft : null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Performance tracker</h2>
      <p className="mb-2 text-sm text-gray-600">
        Targets: save rate ≥ {SAVE_RATE_TARGET}%, share rate ≥ {SHARE_RATE_TARGET}%.
        Every post you log here teaches Coach Mode what works for your audience
        and reshapes future Claude prompts.
      </p>
      <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <span className="font-semibold">When to log:</span> the most reliable
        read is at <strong>48 hours</strong>. Reach climbs for ~7 days, saves
        accumulate for 2-3 weeks, but shares — the strongest resonance signal —
        mostly lock in by 48h. You can log a preliminary read sooner; we&apos;ll
        remind you to update at 48h and again at 7 days for archival accuracy.
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {/* reminderRev is used to trigger re-mount of LoggingReminder after dismissal */}
      <LoggingReminder
        key={`rem-${reminderRev}`}
        posts={posts}
        onLogUpdate={(p) => startUpdateDraft(p)}
        onChanged={bumpReminderRev}
      />

      {draft === null && pendingDrafts.length > 0 && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                {pendingDrafts.length === 1
                  ? "Draft from Post Builder"
                  : `${pendingDrafts.length} drafts from Post Builder`}
              </div>
              <div className="text-xs text-indigo-900/80">
                Title + slides are ready. Click <em>Use this draft</em> to log it
                — you&apos;ll add the time posted and metrics on the next screen.
              </div>
            </div>
          </div>
          <ul className="space-y-1.5">
            {pendingDrafts.map((pd) => (
              <li
                key={pd.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-indigo-200 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-900">
                    {pd.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pd.slides.length} slide{pd.slides.length === 1 ? "" : "s"}
                    {" · queued "}
                    {new Date(pd.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startNewDraftFromPending(pd)}
                    className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Use this draft
                  </button>
                  <button
                    type="button"
                    onClick={() => discardPending(pd.id)}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                    aria-label="Discard this draft"
                    title="Discard — won't log this post"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft === null && (
        <div className="mb-6">
          <button
            type="button"
            onClick={startNewDraft}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            + Log a new post
          </button>
        </div>
      )}

      {newDraft && (
        <NewPostForm
          draft={newDraft}
          pillars={pillars}
          hooks={HOOK_FORMULAS}
          onChange={updateNew}
          onMetricChange={updateMetrics}
          onCancel={cancelDraft}
          onSubmitWithMetrics={(isPreliminary) =>
            saveNewWithMetrics(newDraft, isPreliminary)
          }
          onRemindLater={() => saveNewWithoutMetrics(newDraft)}
        />
      )}

      {updateDraft && updatingPost && (
        <UpdateForm
          post={updatingPost}
          metrics={updateDraft.metrics}
          pillars={pillars}
          hooks={HOOK_FORMULAS}
          onMetricChange={updateMetrics}
          onCancel={cancelDraft}
          onSubmit={() => saveUpdate(updateDraft)}
        />
      )}

      {editDraft && (
        <EditForm
          draft={editDraft}
          pillars={pillars}
          hooks={HOOK_FORMULAS}
          onMetaChange={updateEditMeta}
          onSnapshotMetricChange={updateEditSnapshotMetric}
          onRemoveSnapshot={removeEditSnapshot}
          onCancel={cancelDraft}
          onSubmit={() => saveEdit(editDraft)}
        />
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent posts
        </div>
        {posts.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No posts logged yet. Click &ldquo;Log a new post&rdquo; above to start tracking.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                detectionOn={detectionOn}
                averages={averages}
                onMarkWinner={() => setTopPostId(p.id)}
                onDelete={() => onDelete(p.id)}
                onLogUpdate={() => startUpdateDraft(p)}
                onEdit={() => startEditDraft(p)}
                onAddSlides={() => setSlideCaptureFor(p.id)}
                onRemix={() => setRemixingPostId(p.id)}
              />
            ))}
          </ul>
        )}
        {posts.length > 0 && !detectionOn && (
          <div className="mt-2 rounded border border-dashed border-gray-300 p-2 text-xs text-gray-500">
            Log {MIN_POSTS_FOR_DETECTION - eligibleCoachViews.length} more post
            {MIN_POSTS_FOR_DETECTION - eligibleCoachViews.length === 1 ? "" : "s"}{" "}
            (with 48h+ data) to unlock outlier detection. You can still hit{" "}
            <em>Mark as winner</em> manually on any post.
          </div>
        )}
      </div>

      <TopPostMode
        open={openedView.post !== null}
        post={openedView.post}
        loggedPost={
          topPostId ? posts.find((p) => p.id === topPostId) ?? null : null
        }
        allPosts={openedView.allPosts}
        onClose={() => setTopPostId(null)}
        onStrategyChanged={() => {
          /* Strategy changes are propagated via the
             "coach-strategy-changed" CustomEvent on the window — see
             TopPostMode.tsx. TodaysPlan listens for it, this component
             doesn't need to. */
        }}
        onRequestSlideCapture={(id) => {
          // Close Top Post Mode and open the slide capture modal so
          // we don't stack overlays. After save, the user can re-open
          // Top Post Mode to see the new structural analysis.
          setTopPostId(null);
          setSlideCaptureFor(id);
        }}
      />

      <SlideCaptureModal
        open={slideCaptureFor !== null}
        postId={slideCaptureFor}
        onClose={() => setSlideCaptureFor(null)}
        onSaved={() => {
          // Reload the post list so any consumer (PostRow icons,
          // the next Top Post Mode open, etc.) sees the new slides
          // + analysis.
          setPosts(loadLoggedPosts());
        }}
      />

      <RemixPromptModal
        open={remixingPostId !== null}
        post={
          remixingPostId
            ? posts.find((p) => p.id === remixingPostId) ?? null
            : null
        }
        onClose={() => setRemixingPostId(null)}
      />
    </section>
  );
}

// ── Sub-components below ───────────────────────────────────────────────

interface PostRowProps {
  post: LoggedPost;
  detectionOn: boolean;
  averages: ReturnType<typeof computeAverages>;
  onMarkWinner: () => void;
  onDelete: () => void;
  onLogUpdate: () => void;
  onEdit: () => void;
  onAddSlides: () => void;
  onRemix: () => void;
}

function PostRow({
  post,
  detectionOn,
  averages,
  onMarkWinner,
  onDelete,
  onLogUpdate,
  onEdit,
  onAddSlides,
  onRemix,
}: PostRowProps) {
  const detectionSnap = getDetectionSnapshot(post);
  // Use the detection snapshot for the rate pills — that's what
  // outlier detection uses, so the user sees the same numbers.
  const display = detectionSnap ?? post.snapshots[post.snapshots.length - 1] ?? null;
  const rateBasis: { reach: number; saves: number; shares: number } = display
    ? {
        reach: display.metrics.reach,
        saves: display.metrics.saves,
        shares: display.metrics.shares,
      }
    : { reach: 0, saves: 0, shares: 0 };
  const sR = saveRate(rateBasis);
  const shR = shareRate(rateBasis);
  const sTier = ratePerf(sR, SAVE_RATE_TARGET);
  const shTier = ratePerf(shR, SHARE_RATE_TARGET);

  // Outlier flag uses the detection-eligible CoachPost view, with
  // metrics normalized to their 48h-equivalent so the comparison is
  // fair across posts logged at different points in their curves.
  const flags = (() => {
    if (!detectionOn || !detectionSnap) return null;
    const normalized: PostSnapshot = {
      ...detectionSnap,
      metrics: normalizeMetricsTo48h(
        detectionSnap.metrics,
        detectionSnap.hoursAfterPosting,
      ),
    };
    return flagOutlier(toCoachPost(post, normalized), averages);
  })();

  // Yellow border + Update CTA when the post is sitting in a reminder
  // window without an updated snapshot.
  const recommended = getRecommendedNextSnapshot(post);
  const needsUpdate = recommended !== null;

  const snapshotsLabel = snapshotsBadgeForPost(post);
  const datePostedLocal = new Date(post.postedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 p-3 text-sm ${
        needsUpdate ? "border-l-4 border-amber-300 pl-2" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-gray-900">{post.title}</span>
          {snapshotsLabel && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
              {snapshotsLabel}
            </span>
          )}
          {flags && (
            <TopPostBadge flags={flags} onClick={onMarkWinner} />
          )}
          {post.isWinner && !flags && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              ★ winner
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {datePostedLocal}
          {display
            ? ` · reach ${display.metrics.reach.toLocaleString()} · saves ${display.metrics.saves} · shares ${display.metrics.shares}`
            : " · awaiting 48h snapshot"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {display && (
          <>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${tierClasses(sTier)}`}
              title={`Save rate (target ${SAVE_RATE_TARGET}%)`}
            >
              Save {fmtRate(sR)}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${tierClasses(shTier)}`}
              title={`Share rate (target ${SHARE_RATE_TARGET}%)`}
            >
              Share {fmtRate(shR)}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={onLogUpdate}
          className={`rounded border px-2 py-0.5 text-xs ${
            needsUpdate
              ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          title={
            needsUpdate
              ? `${recommended?.reason ?? "Update recommended"}`
              : "Log another snapshot for this post"
          }
        >
          {needsUpdate ? "Update now" : "Log update"}
        </button>
        <button
          type="button"
          onClick={onAddSlides}
          className={`rounded border px-2 py-0.5 text-xs ${
            post.slides && post.slides.length > 0
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-dashed border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
          }`}
          title={
            post.slides && post.slides.length > 0
              ? `${post.slides.length} slides captured — click to view or replace`
              : "Add slide content to unlock structural analysis in Top Post Mode"
          }
        >
          {post.slides && post.slides.length > 0
            ? `▣ Slides · ${post.slides.length}`
            : "▢ Add slides"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
          title="Edit this post's title, pillar, hook, or any snapshot's metrics"
        >
          Edit
        </button>
        {(post.isWinner || flags !== null) &&
          post.slides &&
          post.slides.length > 0 && (
            <button
              type="button"
              onClick={onRemix}
              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              title="Generate a Claude.ai prompt that returns a single remix — fresh cover, every body slide rewritten in new wording (same facts), CTA locked. Paste straight into Post Builder."
            >
              ↻ Remix
            </button>
          )}
        {display && (
          <button
            type="button"
            onClick={onMarkWinner}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
            title="Open Top Post Mode for this post"
          >
            Mark as winner
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
          aria-label="Delete this post"
        >
          ×
        </button>
      </div>
    </li>
  );
}

interface NewPostFormProps {
  draft: NewPostDraft;
  pillars: Pillar[];
  hooks: HookFormula[];
  onChange: <K extends keyof NewPostDraft>(k: K, v: NewPostDraft[K]) => void;
  onMetricChange: (k: keyof MetricsForm, v: string) => void;
  onCancel: () => void;
  onSubmitWithMetrics: (isPreliminary: boolean) => void;
  onRemindLater: () => void;
}

function NewPostForm({
  draft,
  pillars,
  hooks,
  onChange,
  onMetricChange,
  onCancel,
  onSubmitWithMetrics,
  onRemindLater,
}: NewPostFormProps) {
  const isoPostedAt = dateTimeLocalToIso(draft.postedAt);
  const hours = hoursSincePost(isoPostedAt);
  const bucket = classifyTiming(hours);
  const titleOk = draft.title.trim().length > 0;
  const showMetrics =
    bucket === "ideal" || bucket === "lateOk" || bucket === "mature";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titleOk) return;
    onSubmitWithMetrics(bucket === "preliminary");
  }

  const pendingSlideCount = draft.pendingSlides?.length ?? 0;

  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      {pendingSlideCount > 0 && (
        <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <span className="font-semibold">From Post Builder:</span>{" "}
          title pre-filled, {pendingSlideCount} slide
          {pendingSlideCount === 1 ? "" : "s"} will attach automatically when you
          save (no need to click <em>Add slides</em> after).
        </div>
      )}
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 1 — Choose the post
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label className="text-xs text-gray-600 md:col-span-3">
          Post title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="e.g. 6 rural markets I'd buy"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          When did you post this?
          <input
            type="datetime-local"
            value={draft.postedAt}
            onChange={(e) => onChange("postedAt", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          Pillar
          <select
            value={draft.pillar}
            onChange={(e) => onChange("pillar", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          Hook formula
          <select
            value={draft.hookFormula}
            onChange={(e) => onChange("hookFormula", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {hooks.map((h) => (
              <option key={h.id} value={h.id}>
                {h.template}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TimingCard hours={hours} bucket={bucket} />

      {showMetrics || bucket === "preliminary" ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Step {bucket === "preliminary" ? "2 — Preliminary metrics" : "3 — Metrics"}
          </div>
          <MetricsFormGrid
            metrics={draft.metrics}
            onChange={onMetricChange}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {bucket === "preliminary" ? (
          <>
            <button
              type="submit"
              disabled={!titleOk}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              Log preliminary snapshot
            </button>
            <button
              type="button"
              onClick={onRemindLater}
              disabled={!titleOk}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              Remind me at 48 hours
            </button>
          </>
        ) : showMetrics ? (
          <button
            type="submit"
            disabled={!titleOk}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
          >
            Save snapshot
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface UpdateFormProps {
  post: LoggedPost;
  metrics: MetricsForm;
  pillars: Pillar[];
  hooks: HookFormula[];
  onMetricChange: (k: keyof MetricsForm, v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function UpdateForm({
  post,
  metrics,
  pillars,
  hooks,
  onMetricChange,
  onCancel,
  onSubmit,
}: UpdateFormProps) {
  const hours = hoursSincePost(post.postedAt);
  const bucket = classifyTiming(hours);
  const pillarName =
    pillars.find((p) => p.id === post.pillar)?.name ?? post.pillar ?? "—";
  const hookTpl =
    hooks.find((h) => h.id === post.hookFormula)?.template ?? post.hookFormula ?? "—";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Log update — {post.title}
      </div>
      <div className="text-xs text-gray-500">
        Posted {new Date(post.postedAt).toLocaleString()} · pillar {pillarName} ·{" "}
        hook {hookTpl}
      </div>

      <TimingCard hours={hours} bucket={bucket} />

      <MetricsFormGrid metrics={metrics} onChange={onMetricChange} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
        >
          Save snapshot
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface EditFormProps {
  draft: EditDraft;
  pillars: Pillar[];
  hooks: HookFormula[];
  onMetaChange: <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => void;
  onSnapshotMetricChange: (
    snapIdx: number,
    key: keyof MetricsForm,
    value: string,
  ) => void;
  onRemoveSnapshot: (snapIdx: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function EditForm({
  draft,
  pillars,
  hooks,
  onMetaChange,
  onSnapshotMetricChange,
  onRemoveSnapshot,
  onCancel,
  onSubmit,
}: EditFormProps) {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <form
      onSubmit={submit}
      className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Edit logged post
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <label className="text-xs text-gray-600 md:col-span-3">
          Post title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onMetaChange("title", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          When did you post this?
          <input
            type="datetime-local"
            value={draft.postedAt}
            onChange={(e) => onMetaChange("postedAt", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          Pillar
          <select
            value={draft.pillar}
            onChange={(e) => onMetaChange("pillar", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600 md:col-span-3">
          Hook formula
          <select
            value={draft.hookFormula}
            onChange={(e) => onMetaChange("hookFormula", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {hooks.map((h) => (
              <option key={h.id} value={h.id}>
                {h.template}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="-mt-2 text-[11px] text-gray-500">
        Editing the posted-at time recomputes each snapshot&apos;s &ldquo;hours
        after posting&rdquo; against the new timestamp, so the 48h / 7d
        classifications stay accurate.
      </p>

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Snapshots ({draft.snapshots.length})
        </div>
        {draft.snapshots.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-500">
            This post has no snapshots yet — click <em>Log update</em> on the
            post row to add one.
          </div>
        ) : (
          draft.snapshots.map((s, idx) => (
            <div
              key={`${s.loggedAt}-${idx}`}
              className="rounded border border-gray-200 bg-white p-3"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-500">
                <span>
                  Snapshot {idx + 1} · logged{" "}
                  {new Date(s.loggedAt).toLocaleString()} · {s.hoursAfterPosting}h
                  after posting
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSnapshot(idx)}
                  className="rounded border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700 hover:bg-rose-50"
                  title="Remove this snapshot"
                >
                  Delete snapshot
                </button>
              </div>
              <MetricsFormGrid
                metrics={s.metrics}
                onChange={(k, v) => onSnapshotMetricChange(idx, k, v)}
              />
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface MetricsFormGridProps {
  metrics: MetricsForm;
  onChange: (k: keyof MetricsForm, v: string) => void;
}

function MetricsFormGrid({ metrics, onChange }: MetricsFormGridProps) {
  const fields: { key: keyof MetricsForm; label: string; optional?: boolean }[] = [
    { key: "reach", label: "Reach" },
    { key: "saves", label: "Saves" },
    { key: "shares", label: "Shares" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "profileVisits", label: "Profile visits", optional: true },
    { key: "follows", label: "Follows", optional: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {fields.map(({ key, label, optional }) => (
        <label key={key} className="text-xs text-gray-600">
          {label}
          {optional && <span className="text-gray-400"> (optional)</span>}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={metrics[key]}
            onChange={(e) => onChange(key, e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      ))}
    </div>
  );
}

function TimingCard({ hours, bucket }: { hours: number; bucket: TimingBucket }) {
  const display = Math.max(0, Math.round(hours));
  switch (bucket) {
    case "future":
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
          Posted-at is in the future. Adjust the timestamp once it&apos;s live.
        </div>
      );
    case "preliminary":
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="font-semibold">It&apos;s only been {display} hours.</span>{" "}
          Reach and saves are still climbing. The most reliable time to log this
          post is at <strong>48 hours</strong> — we&apos;ll remind you. You can
          log a preliminary snapshot anyway if you want a baseline.
        </div>
      );
    case "ideal":
      return (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <span className="font-semibold">Perfect timing.</span> {display}h since
          posting. 48 hours is the sweet spot for an accurate read — log your
          numbers below.
        </div>
      );
    case "lateOk":
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <span className="font-semibold">Most of your reach is locked in.</span>{" "}
          {display}h since posting. Log your current numbers — we&apos;ll suggest
          one more update at 7 days for archival accuracy.
        </div>
      );
    case "mature":
      return (
        <div className="rounded-lg border border-gray-200 bg-gray-100 p-3 text-xs text-gray-700">
          <span className="font-semibold">This post is mature.</span> {display}h
          since posting. Numbers are mostly final — log them now for the
          historical record.
        </div>
      );
  }
}
