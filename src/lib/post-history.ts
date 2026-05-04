// Last-N saved posts in localStorage so the user can hop back to a recent
// carousel and keep editing it. Limit is 2 by default — just enough to
// recover from "oh wait, I liked the previous one better" without
// hoarding storage.
//
// Auto-save semantics in PostBuilder:
//   - Generate creates a NEW entry (pushed to position 0; old entries
//     shift down, oldest dropped past the limit).
//   - Manual slide/caption/hook edits update entry[0] in place.
//   - Clicking a non-current entry promotes it to position 0 (so future
//     edits update it), and the previously-current entry slides to
//     position 1.
//
// We deliberately omit competitor images from the snapshot — they're
// huge data URLs and would blow past localStorage quota fast.

import type { CarouselPost, Slide } from "@/lib/post-templates";

const LS_KEY = "postBuilder.history";
export const HISTORY_LIMIT = 2;

// Snapshot of the user's input controls when they last generated.
// New fields: topic + text. Legacy fields (mode / raw / igUrl) are
// kept optional for backwards compatibility — the InputPanel was
// simplified to a single text field, but old localStorage entries
// have the previous shape and we want them to load gracefully.
export interface SavedPostInputSnapshot {
  topic: string;
  text: string;
  // ── Legacy, optional ─────────────────────────────────────────
  // Older saves split text/raw/igUrl across mode-specific fields.
  // PostBuilder.handleLoadHistoryEntry collapses any of these into
  // the single `text` field on read.
  mode?: "screenshots" | "text" | "instagram" | "raw";
  raw?: string;
  igUrl?: string;
}

export interface SavedPost {
  id: string;
  slides: Slide[];
  caption: string;
  hooks: string[];
  input: SavedPostInputSnapshot;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newSavedId(): string {
  return `saved_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function loadHistory(): SavedPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is SavedPost =>
          p &&
          typeof p.id === "string" &&
          Array.isArray(p.slides) &&
          typeof p.caption === "string" &&
          Array.isArray(p.hooks) &&
          typeof p.savedAt === "number",
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(history: SavedPost[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch {
    // ignore quota
  }
}

// Push a brand-new snapshot onto the history (called after Generate).
export function pushHistoryEntry(
  post: CarouselPost,
  input: SavedPostInputSnapshot,
): SavedPost {
  const entry: SavedPost = {
    id: newSavedId(),
    slides: post.slides,
    caption: post.caption,
    hooks: post.hooks,
    input,
    savedAt: Date.now(),
  };
  const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  saveHistory(next);
  return entry;
}

// Update the most-recent entry's slide / caption / hook content. Called
// debounced after manual edits in the SlideEditor / CaptionPanel.
export function updateCurrentEntry(
  patch: Partial<Pick<SavedPost, "slides" | "caption" | "hooks" | "input">>,
): void {
  const history = loadHistory();
  if (history.length === 0) return;
  history[0] = { ...history[0], ...patch, savedAt: Date.now() };
  saveHistory(history);
}

// Promote an entry to position 0 (the "current working post"). Returns
// the resulting history list so callers can drive UI state from it.
export function promoteEntry(id: string): SavedPost[] {
  const history = loadHistory();
  const idx = history.findIndex((e) => e.id === id);
  if (idx <= 0) return history; // already current, or not found
  const next = history.slice();
  const [moved] = next.splice(idx, 1);
  next.unshift(moved);
  saveHistory(next);
  return next;
}

export function deleteEntry(id: string): SavedPost[] {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

// Best-effort label used in the recent-posts strip. Reads the cover
// slide's headline if present, falls back to the first slide's text.
export function entryLabel(entry: SavedPost): string {
  if (entry.slides.length === 0) return "(empty)";
  const first = entry.slides[0];
  if (first.type === "hook-opener" && first.headline) return first.headline;
  if (first.type === "personal-story" && first.paragraphs[0]) return first.paragraphs[0];
  if (first.type === "criteria-bullets" && first.heading) return first.heading;
  if (first.type === "market-detail" && first.title) return first.title;
  if (first.type === "numbered-list" && first.heading) return first.heading;
  if (first.type === "plain-text" && first.paragraphs[0]) return first.paragraphs[0];
  if (first.type === "cta" && first.paragraphs[0]) return first.paragraphs[0];
  return entry.caption.slice(0, 60) || "(untitled)";
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
