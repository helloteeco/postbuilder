"use client";

// Last-2 generated overlay batches. Click a card to reload its
// photos + caption + settings into the active editor; × to delete.
// Mirrors Post Builder's RecentPosts + Reel Builder's RecentReels.

import {
  OVERLAY_HISTORY_LIMIT,
  overlayBatchLabel,
  overlayRelativeTime,
  type SavedOverlayBatch,
} from "@/app/overlay-studio/lib/overlayHistory";

interface Props {
  history: SavedOverlayBatch[];
  activeId: string | null;
  onLoad: (entry: SavedOverlayBatch) => void;
  onDelete: (id: string) => void;
}

export default function RecentOverlays({
  history,
  activeId,
  onLoad,
  onDelete,
}: Props) {
  if (history.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent overlays
        </div>
        <div className="text-[11px] text-gray-400">
          Last {OVERLAY_HISTORY_LIMIT} auto-saved here. Click to keep editing.
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {history.map((entry) => {
          const active = entry.id === activeId;
          const thumb = entry.media[0]?.dataUrl ?? null;
          return (
            <li
              key={entry.id}
              className={`group relative flex items-center gap-3 rounded-lg border p-2 text-sm transition ${
                active
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              {thumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumb}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-12 flex-shrink-0 rounded bg-gray-100" />
              )}
              <button
                type="button"
                onClick={() => onLoad(entry)}
                className="min-w-0 flex-1 text-left"
                title={
                  active
                    ? "Currently editing this batch"
                    : "Load this batch into the editor"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {overlayBatchLabel(entry)}
                  </span>
                  {active && (
                    <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      Editing
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {entry.media.length} photo{entry.media.length === 1 ? "" : "s"} ·{" "}
                  {overlayRelativeTime(entry.savedAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="rounded px-1 text-[11px] text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                aria-label="Delete this saved batch"
                title="Remove from history"
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
