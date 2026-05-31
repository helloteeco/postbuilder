"use client";

// Caption + first comment + audio-vibe suggestion. Editable. Copies
// included so the user can grab each piece individually when posting
// (Instagram makes you paste caption + first comment separately).

import { useState } from "react";

interface Props {
  caption: string;
  firstComment: string;
  audioVibe: string;
  onChange: (next: {
    caption: string;
    firstComment: string;
    audioVibe: string;
  }) => void;
}

export default function OverlayCaptionPanel({
  caption,
  firstComment,
  audioVibe,
  onChange,
}: Props) {
  function patch<K extends "caption" | "firstComment" | "audioVibe">(
    k: K,
    v: string,
  ) {
    onChange({ caption, firstComment, audioVibe, [k]: v });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 7 — Caption + first comment
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Copy this when you post
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Caption goes in the main caption box on Instagram. First comment
        keeps the booking link out of the caption (cleaner + algorithm
        likes it). Music is the last step on your phone.
      </p>

      <div className="mt-3 space-y-3">
        <FieldBlock
          label="Caption"
          value={caption}
          onChange={(v) => patch("caption", v)}
          rows={5}
          placeholder="Generated when you Apply Claude's response."
        />
        <FieldBlock
          label="First comment"
          value={firstComment}
          onChange={(v) => patch("firstComment", v)}
          rows={2}
          placeholder="One line reinforcing the CTA + the booking link."
        />
        <FieldBlock
          label="Suggested music vibe"
          value={audioVibe}
          onChange={(v) => patch("audioVibe", v)}
          rows={1}
          placeholder='e.g. "calm home-tour / aesthetic lo-fi"'
        />
      </div>
    </section>
  );
}

function FieldBlock({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          className={`rounded px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-30 ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-gray-900 text-white hover:bg-black"
          }`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded border border-gray-300 bg-white p-2 text-sm"
      />
    </div>
  );
}
