// "Recent posts" strip — shows the last N saved posts (default 2) so the
// user can hop back into a previous carousel and keep editing it.

"use client";

import {
  HISTORY_LIMIT,
  entryLabel,
  relativeTime,
  type SavedPost,
} from "@/lib/post-history";

interface Props {
  history: SavedPost[];
  // Index 0 is the active working post; clicking another entry promotes
  // it to position 0 in the parent state.
  activeId: string | null;
  onLoad: (entry: SavedPost) => void;
  onDelete: (id: string) => void;
}

export default function RecentPosts({ history, activeId, onLoad, onDelete }: Props) {
  if (history.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent posts
        </div>
        <div className="text-[11px] text-gray-400">
          Last {HISTORY_LIMIT} auto-saved here. Click to keep editing.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {history.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <div
              key={entry.id}
              className={`relative rounded-lg border p-3 text-left transition ${
                isActive
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onLoad(entry)}
                className="block w-full text-left"
                title={isActive ? "Currently editing this post" : "Load this post into the editor"}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {entryLabel(entry)}
                  </span>
                  {isActive && (
                    <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      Editing
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {entry.slides.length} slides · {relativeTime(entry.savedAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="absolute right-1.5 top-1.5 rounded px-1 text-[11px] text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                aria-label="Delete this saved post"
                title="Remove from history"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
