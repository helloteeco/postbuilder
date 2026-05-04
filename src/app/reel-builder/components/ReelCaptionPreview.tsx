"use client";

// Caption block under each reel preview. Collapsible (collapsed shows
// the first 100 chars + "…"). Expanded reveals an EDITABLE textarea
// so the user can tweak the generated caption inline before copying.
// Live char-counter color-codes against the IG hard cap.

import { useState } from "react";
import {
  CAPTION_HARD_CAP,
  CAPTION_SOFT_CAP,
} from "@/app/reel-builder/lib/reelTemplate";

interface Props {
  caption: string;
  onChange: (next: string) => void;
}

function counterColor(count: number): string {
  if (count > CAPTION_HARD_CAP) return "text-rose-700 bg-rose-50";
  if (count > CAPTION_SOFT_CAP) return "text-amber-700 bg-amber-50";
  return "text-emerald-700 bg-emerald-50";
}

export default function ReelCaptionPreview({ caption, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = caption.length;
  const preview =
    caption.length > 100 ? caption.slice(0, 100).trimEnd() + "…" : caption;

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — caption is visible, user can manual-copy
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold uppercase tracking-wider text-gray-700 hover:text-gray-900"
        >
          Caption {expanded ? "▴" : "▾"}
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${counterColor(count)}`}
            title={`Instagram caption hard cap is ${CAPTION_HARD_CAP.toLocaleString()} characters`}
          >
            {count.toLocaleString()} / {CAPTION_HARD_CAP.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={copyCaption}
            className={`rounded px-2 py-0.5 text-xs font-semibold transition ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-gray-900 text-white hover:bg-black"
            }`}
          >
            {copied ? "✓ Copied" : "Copy caption"}
          </button>
        </div>
      </div>
      {expanded ? (
        <textarea
          value={caption}
          onChange={(e) => onChange(e.target.value)}
          className="h-64 w-full resize-y rounded border border-gray-300 bg-white p-2 font-mono text-xs text-gray-800"
          placeholder="Your caption — editable. Asterisks like **word** stay literal in the caption (Instagram doesn't render them); use them only on the cover headline / subtitle if you want bold highlights there."
        />
      ) : (
        <div className="text-xs leading-relaxed text-gray-600">{preview}</div>
      )}
    </div>
  );
}
