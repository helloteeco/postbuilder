"use client";

// Caption block under each reel preview. Always-visible editable
// textarea (no collapse — the caption is the primary thing the user
// wants to read and tweak, hiding it behind a toggle was easy to
// miss). Live char-counter color-codes against the IG hard cap.

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
  const [copied, setCopied] = useState(false);
  const count = caption.length;

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Caption
        </span>
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
      <textarea
        value={caption}
        onChange={(e) => onChange(e.target.value)}
        className="h-72 w-full resize-y rounded border border-gray-300 bg-white p-2 font-mono text-xs leading-relaxed text-gray-800"
        placeholder="Your caption — editable. Each blank-line section becomes one body slide when you Send to tracker; Coach Mode runs structural analysis on the result."
      />
    </div>
  );
}
