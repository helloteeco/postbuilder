// Last-2 saved overlay batches so the user can hop back to a recent
// deck (photos + per-slide text + caption + settings). Channel-scoped
// to match overlayStorage.ts — design content stays separate from
// coaching content when Jeff switches channels.
//
// Behavior:
//   - First photo uploaded after a clean slate creates a NEW entry.
//   - Manual edits debounce-update entry[0] in place.
//   - Clicking a non-current entry promotes it to position 0 so future
//     edits hit the right batch.
//   - Photos are downscaled to 1080px wide JPEG @ 0.9 before storage —
//     full IG resolution, but ~10× smaller than raw phone PNGs so the
//     localStorage quota survives.

import { channelKey, getCurrentChannelId } from "@/app/coach/lib/channels";
import type { OverlayMedia, OverlaySettings } from "./overlayTypes";

const SUFFIX = "overlay_history";
export const OVERLAY_HISTORY_LIMIT = 2;

export interface SavedOverlayBatch {
  id: string;
  media: OverlayMedia[];
  caption: string;
  firstComment: string;
  settings: OverlaySettings;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function key(): string {
  return channelKey(getCurrentChannelId(), SUFFIX);
}

function newId(): string {
  return `ov_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isBatchShape(b: unknown): b is SavedOverlayBatch {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    Array.isArray(o.media) &&
    typeof o.caption === "string" &&
    typeof o.firstComment === "string" &&
    typeof o.settings === "object" &&
    typeof o.savedAt === "number"
  );
}

export function loadOverlayHistory(): SavedOverlayBatch[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBatchShape).slice(0, OVERLAY_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeRaw(history: SavedOverlayBatch[]): boolean {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(
      key(),
      JSON.stringify(history.slice(0, OVERLAY_HISTORY_LIMIT)),
    );
    return true;
  } catch {
    return false;
  }
}

// Best-effort persist. If the first attempt blows past quota, drop
// the oldest entry and try again — better to lose history than to
// fail the save and lose the current edits.
function saveOverlayHistory(history: SavedOverlayBatch[]): void {
  const trimmed = history.slice(0, OVERLAY_HISTORY_LIMIT);
  if (writeRaw(trimmed)) return;
  if (trimmed.length > 1 && writeRaw(trimmed.slice(0, 1))) return;
  // If even the single entry won't fit, give up silently — the active
  // session in memory still works.
}

export function pushOverlayHistory(
  media: OverlayMedia[],
  caption: string,
  firstComment: string,
  settings: OverlaySettings,
): SavedOverlayBatch {
  const entry: SavedOverlayBatch = {
    id: newId(),
    media,
    caption,
    firstComment,
    settings,
    savedAt: Date.now(),
  };
  saveOverlayHistory([entry, ...loadOverlayHistory()]);
  return entry;
}

export function updateCurrentOverlayHistory(
  patch: Partial<
    Pick<SavedOverlayBatch, "media" | "caption" | "firstComment" | "settings">
  >,
): void {
  const h = loadOverlayHistory();
  if (h.length === 0) return;
  h[0] = { ...h[0], ...patch, savedAt: Date.now() };
  saveOverlayHistory(h);
}

export function promoteOverlayHistory(id: string): SavedOverlayBatch[] {
  const h = loadOverlayHistory();
  const idx = h.findIndex((e) => e.id === id);
  if (idx <= 0) return h;
  const next = h.slice();
  const [moved] = next.splice(idx, 1);
  next.unshift(moved);
  saveOverlayHistory(next);
  return next;
}

export function deleteOverlayHistory(id: string): SavedOverlayBatch[] {
  const next = loadOverlayHistory().filter((e) => e.id !== id);
  saveOverlayHistory(next);
  return next;
}

export function overlayBatchLabel(entry: SavedOverlayBatch): string {
  const cover = entry.media[0];
  if (cover?.headline) return cover.headline;
  if (entry.caption.trim()) return entry.caption.trim().slice(0, 60);
  if (entry.settings.listingNickname)
    return `${entry.settings.listingNickname} (${entry.media.length} photos)`;
  return entry.media.length > 0
    ? `${entry.media.length} photo${entry.media.length === 1 ? "" : "s"}`
    : "(empty)";
}

export { relativeTime as overlayRelativeTime } from "@/lib/shared-utils";

// Compress a single photo data URL to keep history snapshots under
// localStorage quota. 1080px wide is exactly IG's post width, so this
// is lossless from the viewer's perspective. JPEG q=0.9.
export async function compressForHistory(
  dataUrl: string,
  maxWidth = 1080,
  quality = 0.9,
): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function compressMediaForHistory(
  media: OverlayMedia[],
): Promise<OverlayMedia[]> {
  return Promise.all(
    media.map(async (m) => ({
      ...m,
      dataUrl: await compressForHistory(m.dataUrl),
    })),
  );
}
