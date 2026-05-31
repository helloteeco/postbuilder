"use client";

// Copy the prompt → paste into Claude.ai with your photos attached →
// paste the JSON response back here. Same loop Coach Mode uses. Zero
// API cost.

import { useMemo, useState } from "react";
import {
  buildOverlayPrompt,
  mergeParsedIntoMedia,
  parseOverlayResponse,
} from "@/app/overlay-studio/lib/overlayPrompt";
import type {
  OverlayMedia,
  OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  settings: OverlaySettings;
  media: OverlayMedia[];
  onMerge: (next: OverlayMedia[]) => void;
  onCaption: (caption: string, firstComment: string, audioVibe: string) => void;
}

export default function OverlayPromptPanel({
  settings,
  media,
  onMerge,
  onCaption,
}: Props) {
  const prompt = useMemo(
    () => buildOverlayPrompt(settings, media.length || 1),
    [settings, media.length],
  );
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // user can still select the textarea
    }
  }

  function applyResponse() {
    const parsed = parseOverlayResponse(paste);
    if (!parsed) {
      setStatus("Couldn't read JSON from that. Make sure Claude returned the JSON only.");
      return;
    }
    onMerge(mergeParsedIntoMedia(media, parsed));
    onCaption(parsed.caption, parsed.firstComment, parsed.audioVibe);
    setStatus(
      `✓ Applied ${parsed.photos.length} photo overlay${parsed.photos.length === 1 ? "" : "s"}. Caption updated.`,
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 4 — Write the overlays (let Claude draft)
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Claude.ai prompt loop
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Copy this prompt, paste it into Claude.ai{" "}
        <strong>with your photos attached</strong>, then paste Claude&apos;s
        JSON response into the box below. We&apos;ll fill the overlay text +
        caption automatically. You can also skip this and type overlay text
        by hand in the auditor — your call.
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
        <span className="text-[11px] text-gray-500">
          Prompt ({prompt.length.toLocaleString()} chars)
        </span>
        <button
          type="button"
          onClick={copyPrompt}
          className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-gray-900 text-white hover:bg-black"
          }`}
        >
          {copied ? "✓ Copied" : "Copy prompt"}
        </button>
      </div>
      <textarea
        readOnly
        value={prompt}
        className="mt-2 h-36 w-full resize-y rounded border border-gray-300 bg-white p-2 font-mono text-[11px] text-gray-800"
      />

      <div className="mt-4 text-xs font-semibold text-gray-700">
        Paste Claude&apos;s response below
      </div>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={8}
        placeholder='Paste the JSON Claude returned (the full {"photos": [...], "caption": "...", "firstComment": "...", "audioVibe": "..."}).'
        className="mt-1 w-full resize-y rounded border border-gray-300 p-2 font-mono text-[11px] text-gray-800"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={applyResponse}
          disabled={!paste.trim() || media.length === 0}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
        >
          Apply to my photos
        </button>
        {status && <span className="text-xs text-gray-600">{status}</span>}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Tip: if Claude returns text around the JSON, that&apos;s fine — we
        find the JSON inside automatically.
      </p>
    </section>
  );
}
