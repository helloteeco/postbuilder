// Last-N saved reel batches (3 variations + source input + per-card
// edits) so the user can hop back to a previous generation. Mirrors
// post-history.ts behavior — limit 2 entries — but stores reel-shaped
// data instead of carousel slides.
//
// Auto-save semantics in the Reel Builder page:
//   - Generate creates a NEW entry at position 0; older entries shift
//     down, oldest dropped past the limit.
//   - Manual headline / subtitle / caption / bg edits update entry[0]
//     in place (debounced).
//   - Clicking a non-current entry promotes it to position 0 so future
//     edits hit the right entry.

import type { ReelBg, ReelVariation } from "./reelTemplate";

const LS_KEY = "reel_history";
export const REEL_HISTORY_LIMIT = 2;

export interface SavedReelCard {
  bg: ReelBg;
  // Custom hex codes when bg === "custom". Optional otherwise.
  customBg?: string;
  customAccent?: string;
  variation: ReelVariation;
}

export interface SavedReelBatch {
  id: string;
  source: string;
  cards: SavedReelCard[];
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newId(): string {
  return `reel_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isBatchShape(b: unknown): b is SavedReelBatch {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.source === "string" &&
    Array.isArray(o.cards) &&
    typeof o.savedAt === "number"
  );
}

export function loadReelHistory(): SavedReelBatch[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBatchShape).slice(0, REEL_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveReelHistory(history: SavedReelBatch[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify(history.slice(0, REEL_HISTORY_LIMIT)),
    );
  } catch {
    // ignore quota
  }
}

export function pushReelHistory(
  source: string,
  cards: SavedReelCard[],
): SavedReelBatch {
  const entry: SavedReelBatch = {
    id: newId(),
    source,
    cards,
    savedAt: Date.now(),
  };
  saveReelHistory([entry, ...loadReelHistory()].slice(0, REEL_HISTORY_LIMIT));
  return entry;
}

export function updateCurrentReelHistory(
  patch: Partial<Pick<SavedReelBatch, "source" | "cards">>,
): void {
  const h = loadReelHistory();
  if (h.length === 0) return;
  h[0] = { ...h[0], ...patch, savedAt: Date.now() };
  saveReelHistory(h);
}

export function promoteReelHistory(id: string): SavedReelBatch[] {
  const h = loadReelHistory();
  const idx = h.findIndex((e) => e.id === id);
  if (idx <= 0) return h;
  const next = h.slice();
  const [moved] = next.splice(idx, 1);
  next.unshift(moved);
  saveReelHistory(next);
  return next;
}

export function deleteReelHistory(id: string): SavedReelBatch[] {
  const next = loadReelHistory().filter((e) => e.id !== id);
  saveReelHistory(next);
  return next;
}

export function batchLabel(entry: SavedReelBatch): string {
  return entry.cards[0]?.variation.hookHeadline || "(untitled)";
}

export function relativeTime(ts: number): string {
  const ms = Date.now() - ts;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
