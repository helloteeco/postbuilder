"use client";

// Opt-in handoff from Overlay Studio → Coach Mode Performance Tracker.
// Same queue Post Builder and Reel Builder use (coach_pending_drafts):
// flatten each photo's headline + description into SlideContent[] so
// Coach Mode's structural analysis works on overlay carousels too.

import { useState } from "react";
import { addPendingDraft, cleanTitle } from "@/app/coach/lib/pendingDraft";
import type { OverlayMedia } from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia[];
  listingNickname: string;
}

export default function OverlaySendToTracker({ media, listingNickname }: Props) {
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const disabled = media.length === 0;

  function handleClick() {
    if (disabled) return;
    const title =
      cleanTitle(media[0]?.headline ?? "") ||
      listingNickname.trim() ||
      "Overlay carousel";
    addPendingDraft({
      title,
      slides: media.map((m, i) => ({
        slideNumber: i + 1,
        text: [m.headline, m.body].filter(Boolean).join(". "),
        isHook: i === 0,
        isCTA: i === media.length - 1,
      })),
    });
    setStatus("sent");
    window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        disabled
          ? "Add photos first"
          : "Queue this carousel in Coach Mode → Performance Tracker. You'll add the time posted + metrics after it's live."
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
