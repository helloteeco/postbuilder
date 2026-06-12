"use client";

// Optional AI assist for headlines + body + caption. Collapsed by
// default — the Overlay Studio is meant to work without it. If the
// user does open it, the loop matches Coach Mode / Post Builder:
// copy a prompt, paste it into Claude.ai with the photos attached,
// paste the JSON response back.

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
  onCaption: (caption: string, firstComment: string) => void;
}

export default function OverlayPromptPanel({
  settings,
  media,
  onMerge,
  onCaption,
}: Props) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(
    () => buildOverlayPrompt(settings, media.length || 1),
    [settings, media.length],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function applyResponse() {
    const parsed = parseOverlayResponse(paste);
    if (!parsed) {
      setStatus("Couldn't read JSON from that — paste Claude's response only.");
      return;
    }
    onMerge(mergeParsedIntoMedia(media, parsed));
    onCaption(parsed.caption, parsed.firstComment);
    setStatus(`✓ Applied ${parsed.photos.length} overlays. Caption updated.`);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-bold text-gray-900">
          ✨ Use AI to write the overlays (optional)
        </span>
        <span className="text-xs text-gray-500">{open ? "Hide ▴" : "Show ▾"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-600">
            Copy the prompt → paste into Claude.ai{" "}
            <strong>with your photos attached</strong> → paste the JSON
            response back. Or skip it and type headlines yourself in each
            slide card.
          </p>
          <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 p-2">
            <span className="text-[11px] text-gray-500">
              {prompt.length.toLocaleString()} chars
            </span>
            <button
              type="button"
              onClick={copyPrompt}
              className={`rounded px-2 py-1 text-xs font-semibold transition ${
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
            className="h-28 w-full resize-y rounded border border-gray-300 bg-gray-50 p-2 font-mono text-[11px] text-gray-800"
          />
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder="Paste Claude's JSON response here."
            className="w-full resize-y rounded border border-gray-300 p-2 font-mono text-[11px] text-gray-800"
          />
          <div className="flex items-center gap-2">
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
        </div>
      )}
    </section>
  );
}
