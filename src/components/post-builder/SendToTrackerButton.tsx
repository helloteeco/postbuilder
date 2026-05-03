"use client";

// Opt-in handoff from Post Builder → Coach Mode Performance Tracker.
//
// Click → flatten the current carousel via slidesFromPostBuilder(),
// strip ** asterisks from the cover headline for the title, stash the
// draft in localStorage under coach_pending_drafts, show a brief
// confirmation. Coach Mode picks it up the next time the user opens
// /coach (or live, if they have it open in another tab — we dispatch
// a custom event).
//
// Nothing is auto-sent — the user must click this button. If they
// don't like the post, they just don't send it.

import { useState } from "react";
import type { Slide } from "@/lib/post-templates";
import {
  addPendingDraft,
  cleanTitle,
} from "@/app/coach/lib/pendingDraft";
import { slidesFromPostBuilder } from "@/app/coach/lib/contentAnalysis";

interface Props {
  slides: Slide[];
  // ID of the Post Builder history entry this carousel came from, if
  // any. Stored on the LoggedPost so the user can later click through
  // back to the original draft from Coach Mode if they want to revise.
  historyId: string | null;
}

export default function SendToTrackerButton({ slides, historyId }: Props) {
  const [status, setStatus] = useState<"idle" | "sent">("idle");

  const disabled = slides.length === 0;

  function handleClick() {
    if (disabled) return;
    const cover = slides[0];
    const rawTitle =
      cover && cover.type === "hook-opener" && cover.headline
        ? cover.headline
        : "Untitled draft";
    addPendingDraft({
      title: cleanTitle(rawTitle),
      slides: slidesFromPostBuilder(slides),
      postBuilderDraftId: historyId ?? undefined,
    });
    setStatus("sent");
    // Reset after a couple seconds so the user can send another draft
    // later in the same session.
    window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        disabled
          ? "Generate a carousel first"
          : "Queue this post in Coach Mode → Performance Tracker. You'll add the time posted + metrics later, after it's live."
      }
      className={`rounded border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        status === "sent"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-gray-300 text-gray-700 hover:bg-gray-100"
      }`}
    >
      {status === "sent" ? "✓ Sent to tracker" : "Send to tracker"}
    </button>
  );
}
