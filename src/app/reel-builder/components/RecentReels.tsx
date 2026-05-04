"use client";

// Last-2 generated reel batches. Click a card to reload its 3
// variations into the active editor; × to delete. Mirrors the Post
// Builder RecentPosts strip both visually and semantically.

import {
  batchLabel,
  relativeTime,
  type SavedReelBatch,
} from "@/app/reel-builder/lib/reelHistory";

interface Props {
  history: SavedReelBatch[];
  activeId: string | null;
  onLoad: (entry: SavedReelBatch) => void;
  onDelete: (id: string) => void;
}

export default function RecentReels({
  history,
  activeId,
  onLoad,
  onDelete,
}: Props) {
  if (history.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent reels
        </div>
        <div className="text-[11px] text-gray-400">
          Last 2 auto-saved here. Click to keep editing.
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {history.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li
              key={entry.id}
              className={`group relative flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                active
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onLoad(entry)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-medium text-gray-900">
                  {batchLabel(entry)}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.cards.length} variation
                  {entry.cards.length === 1 ? "" : "s"} ·{" "}
                  {relativeTime(entry.savedAt)}
                </div>
              </button>
              {active && (
                <span className="rounded bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Editing
                </span>
              )}
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                aria-label="Delete this reel batch"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
