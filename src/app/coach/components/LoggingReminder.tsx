// Compact reminder card at the top of the Performance Tracker section.
//
// The previous design rendered one tall amber card per pending update.
// At 5-6 pending reminders that consumed half the page and pushed the
// "Log a new post" button + the post list far down the screen — the
// user reported this felt overwhelming.
//
// New shape: a single condensed card. Collapsed by default (when ≥ 3
// reminders are pending), shows just the count + a 48h/7d breakdown.
// Expanded shows each pending reminder as a compact one-line row with
// the post title, last-logged timestamp, Update + Skip buttons. When
// only 1-2 reminders are pending, it stays expanded (no point hiding
// nearly-nothing behind a click).
//
// Above the reminder rows when expanded: a small "Faster way" tip
// that explains how to use Claude desktop / browser extension to
// auto-read IG insights numbers off the screen, which skips the
// manual transcription step entirely. The user reported using this
// workflow last time and finding it dramatically faster — surface it
// so they (and any friend using the app) remember the option.
//
// Reminders the user skips are stored in localStorage so the card
// never re-appears for that (post, kind) pair.

"use client";

import { useState } from "react";
import {
  dismissReminder,
  type LoggedPost,
  type ReminderKind,
} from "@/app/coach/lib/storage";
import { getRecommendedNextSnapshot } from "@/app/coach/lib/timingHelpers";

interface PendingReminder {
  post: LoggedPost;
  reason: string;
  kind: ReminderKind;
  targetHours: number;
  // ISO of the most recent snapshot the user has on this post, or
  // null when they used the "remind me at 48h" path and haven't
  // logged anything yet.
  lastLoggedAt: string | null;
}

interface Props {
  posts: LoggedPost[];
  onLogUpdate: (post: LoggedPost) => void;
  onChanged: () => void;
}

export function pendingReminders(posts: LoggedPost[]): PendingReminder[] {
  const out: PendingReminder[] = [];
  for (const p of posts) {
    const rec = getRecommendedNextSnapshot(p);
    if (rec && rec.shouldLog) {
      const lastSnap = p.snapshots[p.snapshots.length - 1];
      out.push({
        post: p,
        reason: rec.reason,
        kind: rec.kind,
        targetHours: rec.targetHours,
        lastLoggedAt: lastSnap?.loggedAt ?? null,
      });
    }
  }
  return out;
}

// "Last logged 2d ago" / "Last logged 6h ago" / "Never logged".
// Short, dense — fits as a sub-line under the post title.
function relativeShort(iso: string | null): string {
  if (!iso) return "Never logged";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60 * 1000) return "Just now";
  const min = Math.floor(ms / (60 * 1000));
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(ms / (60 * 60 * 1000));
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  return `${d}d ago`;
}

export default function LoggingReminder({
  posts,
  onLogUpdate,
  onChanged,
}: Props) {
  const reminders = pendingReminders(posts);
  // Pro-tip is always shown by default — user wants the
  // Claude co-work workflow front-and-center. Still collapsible
  // for users who've memorized the steps and want it out of the way.
  const [tipOpen, setTipOpen] = useState(true);
  // The actual list of reminder rows is hidden by default. The
  // header count + the pro-tip carry the surface area. User clicks
  // "Show posts" when they're ready to triage.
  const [rowsOpen, setRowsOpen] = useState(false);

  if (reminders.length === 0) return null;

  const count48 = reminders.filter((r) => r.kind === "h48").length;
  const count7d = reminders.filter((r) => r.kind === "d7").length;

  function handleSkip(r: PendingReminder) {
    dismissReminder(r.post.id, r.kind);
    onChanged();
  }

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
      {/* Header — count + breakdown. Always visible. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2.5">
        <span className="text-sm font-semibold text-amber-900">
          🟡 {reminders.length} post{reminders.length === 1 ? "" : "s"} need
          updating
        </span>
        <span className="text-xs text-amber-800/80">
          {count48 > 0 && `${count48} at 48h`}
          {count48 > 0 && count7d > 0 && " · "}
          {count7d > 0 && `${count7d} at 7d`}
        </span>
      </div>

      {/* Pro-tip: Claude co-work workflow. Open by default — the user
          wants this prominent so the shortcut is obvious every time
          they see the reminder block. Still collapsible for users who
          know the steps and want it tucked away. */}
      <div className="border-t border-amber-200 bg-amber-100/40 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
        <button
          type="button"
          onClick={() => setTipOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left font-semibold"
        >
          <span>
            💡 Faster way — let Claude read the numbers off Instagram for you
          </span>
          <span className="text-amber-800">
            {tipOpen ? "Hide ▴" : "Show ▾"}
          </span>
        </button>
        {tipOpen && (
          <>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5">
              <li>
                Open the post on Instagram → tap{" "}
                <strong>View insights</strong>. Don&apos;t worry about finding
                everything on one screen — IG splits them across sections.
              </li>
              <li>
                Open <strong>Claude desktop app</strong> (or the Chrome
                extension) and paste:{" "}
                <em>
                  &ldquo;I&apos;m going to scroll through ALL the Instagram
                  insights screens for one of my posts. As I scroll, watch the
                  screen and track these numbers as you see them: reach, saves,
                  shares, likes, comments, profile visits, follows. Tell me
                  which ones you&apos;ve captured after each screen so I know
                  when to stop scrolling. Then give me the final list.&rdquo;
                </em>
              </li>
              <li>
                Scroll / swipe through every IG insights section (overview →
                engagement → profile activity → audience). Claude accumulates
                the numbers across screens.
              </li>
              <li>
                When Claude confirms it has everything, click{" "}
                <strong>Update</strong> below, paste the numbers, save.
              </li>
            </ol>
            <div className="mt-1 text-amber-800/80">
              Skips manual lookup + transcription. Same shortcut works for 7-day
              updates and works on web IG or mirrored phone screens.
            </div>
          </>
        )}
      </div>

      {/* Reminder rows — hidden by default. The header count + pro-tip
          carry the surface area; user clicks Show when they're ready
          to triage. */}
      <button
        type="button"
        onClick={() => setRowsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-t border-amber-200 px-3 py-2 text-left text-xs font-medium text-amber-800 hover:bg-amber-100/50"
      >
        <span>
          {rowsOpen
            ? `Hide post list`
            : `Show ${reminders.length} post${reminders.length === 1 ? "" : "s"} to update`}
        </span>
        <span>{rowsOpen ? "Hide ▴" : "Show ▾"}</span>
      </button>

      {rowsOpen && (
        <ul className="divide-y divide-amber-200 border-t border-amber-200">
          {reminders.map((r) => (
            <li
              key={`${r.post.id}-${r.kind}`}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
            >
              <span
                className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900"
                title={
                  r.kind === "h48"
                    ? "48-hour reading window — most reliable for save / share rate"
                    : "7-day reading window — final reach + saves"
                }
              >
                {r.kind === "h48" ? "48h" : "7d"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-amber-900">
                  {r.post.title}
                </div>
                <div className="text-[11px] text-amber-800/70">
                  Last logged: {relativeShort(r.lastLoggedAt)}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onLogUpdate(r.post)}
                  className="rounded bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(r)}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                  title="Hide this reminder permanently"
                >
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
