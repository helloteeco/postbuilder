// Cross-feature handoff between Post Builder and Coach Mode's
// Performance Tracker. When the user finishes a carousel in the Post
// Builder and clicks "Send to Performance Tracker", we stash a
// PendingDraft here. Coach Mode reads it on mount, shows a callout,
// and lets the user log the post WITHOUT re-typing the title or
// re-uploading slides — they just fill in postedAt + metrics later.
//
// Storage is intentionally NOT channel-scoped — the Post Builder is
// channel-agnostic, so drafts go to a single global queue and land in
// whichever Coach Mode channel is active when the user logs them.
//
// The queue is an array (multiple drafts can stack up) but each draft
// only ever produces one logged post. The user explicitly clicks "Use
// this draft" to consume one — nothing is auto-pulled.
//
// Opt-in only: nothing here runs unless the user clicks the
// PostBuilder's "Send" button. Generated posts the user never wanted
// to log don't pollute the tracker.

import type { SlideContent } from "./storage";

export interface PendingDraft {
  id: string;
  createdAt: number;
  // Cleaned plain-text title derived from the cover headline, with
  // ** asterisks stripped so it reads naturally in the tracker form.
  title: string;
  slides: SlideContent[];
  // Optional pointer back to the Post Builder's history entry so we
  // can record postBuilderDraftId on the LoggedPost (matches the
  // behavior of SlideCaptureModal's link tab).
  postBuilderDraftId?: string;
}

const LS_KEY = "coach_pending_drafts";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newId(): string {
  return `pd_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isPendingDraftShape(p: unknown): p is PendingDraft {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "number" &&
    typeof o.title === "string" &&
    Array.isArray(o.slides)
  );
}

export function loadPendingDrafts(): PendingDraft[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingDraftShape);
  } catch {
    return [];
  }
}

function savePendingDrafts(list: PendingDraft[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
}

export interface NewPendingDraftInput {
  title: string;
  slides: SlideContent[];
  postBuilderDraftId?: string;
}

export function addPendingDraft(input: NewPendingDraftInput): PendingDraft {
  const draft: PendingDraft = {
    id: newId(),
    createdAt: Date.now(),
    title: input.title.trim() || "Untitled draft",
    slides: input.slides,
    postBuilderDraftId: input.postBuilderDraftId,
  };
  savePendingDrafts([draft, ...loadPendingDrafts()]);
  // Custom event so an open Coach Mode tab can refresh without
  // requiring the user to reload — same pattern used elsewhere
  // (coach-strategy-changed). Best-effort.
  if (isBrowser()) {
    try {
      window.dispatchEvent(new CustomEvent("coach-pending-drafts-changed"));
    } catch {
      // ignore
    }
  }
  return draft;
}

export function removePendingDraft(id: string): void {
  savePendingDrafts(loadPendingDrafts().filter((d) => d.id !== id));
  if (isBrowser()) {
    try {
      window.dispatchEvent(new CustomEvent("coach-pending-drafts-changed"));
    } catch {
      // ignore
    }
  }
}

// Strip ** ** and stray * markers so the cover headline reads as
// plain text in the tracker form. Mirrors the renderer's plain-text
// fallback — no markdown leaks into the post title.
export function cleanTitle(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
