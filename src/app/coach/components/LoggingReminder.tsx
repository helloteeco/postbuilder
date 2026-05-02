// Reminder card surfaced at the top of the Performance Tracker section
// when one or more logged posts need an updated snapshot.
//
// Two trigger windows mirror the shape of Instagram's metric curve:
//   - 48h reminder  → most reliable read; shares are ~done, reach has
//                     mostly settled.
//   - 7-day reminder → archival accuracy on saves + late reach.
//
// Reminders the user explicitly skips are stored in localStorage so the
// card never re-appears for that (post, kind) pair.

"use client";

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
}

interface Props {
  posts: LoggedPost[];
  // Open the logging form pre-filled for an update on the given post.
  onLogUpdate: (post: LoggedPost) => void;
  // Bumps the parent's revision so dismissals re-render the list.
  onChanged: () => void;
}

export function pendingReminders(posts: LoggedPost[]): PendingReminder[] {
  const out: PendingReminder[] = [];
  for (const p of posts) {
    const rec = getRecommendedNextSnapshot(p);
    if (rec && rec.shouldLog) {
      out.push({
        post: p,
        reason: rec.reason,
        kind: rec.kind,
        targetHours: rec.targetHours,
      });
    }
  }
  return out;
}

function reminderTitle(kind: ReminderKind, targetHours: number): string {
  if (kind === "h48" || targetHours === 48) return "Time for the 48-hour update";
  return "One last update at 7 days";
}

function reminderCopy(reminder: PendingReminder): string {
  if (reminder.kind === "h48") {
    return `Time to update "${reminder.post.title}". ${reminder.reason}.`;
  }
  return `One last update on "${reminder.post.title}". ${reminder.reason}.`;
}

export default function LoggingReminder({ posts, onLogUpdate, onChanged }: Props) {
  const reminders = pendingReminders(posts);
  if (reminders.length === 0) return null;

  function handleSkip(r: PendingReminder) {
    dismissReminder(r.post.id, r.kind);
    onChanged();
  }

  function handleUpdate(r: PendingReminder) {
    onLogUpdate(r.post);
  }

  return (
    <div className="mb-4 space-y-2">
      {reminders.map((r) => (
        <div
          key={`${r.post.id}-${r.kind}`}
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              {reminderTitle(r.kind, r.targetHours)}
            </div>
            <div className="mt-0.5">{reminderCopy(r)}</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => handleUpdate(r)}
              className="rounded bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Update now
            </button>
            <button
              type="button"
              onClick={() => handleSkip(r)}
              className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
            >
              Skip this one
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
