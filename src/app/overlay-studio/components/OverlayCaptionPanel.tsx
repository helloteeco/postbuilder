"use client";

// Compact caption panel. Auto-composed from each photo's body text +
// the chosen CTA, OR replaced by Claude's response. Always editable.

import { useState } from "react";
import {
  CTA_DEFAULTS,
  type OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";
import type { OverlayMedia } from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia[];
  settings: OverlaySettings;
  caption: string;
  firstComment: string;
  onChange: (next: { caption: string; firstComment: string }) => void;
}

export default function OverlayCaptionPanel({
  media,
  settings,
  caption,
  firstComment,
  onChange,
}: Props) {
  const [copied, setCopied] = useState<"cap" | "fc" | null>(null);

  function compose() {
    onChange({
      caption: composeCaption(media, settings),
      firstComment: composeFirstComment(settings),
    });
  }

  async function copy(field: "cap" | "fc", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900">Caption</div>
        <button
          type="button"
          onClick={compose}
          disabled={media.length === 0}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          title="Build the caption from each photo's description + your CTA"
        >
          Auto-build from photo descriptions
        </button>
      </div>

      <FieldBlock
        label="Caption"
        value={caption}
        onChange={(v) => onChange({ caption: v, firstComment })}
        rows={5}
        placeholder="Each photo's description joins here. Or paste Claude's response."
        copied={copied === "cap"}
        onCopy={() => copy("cap", caption)}
      />
      <div className="mt-3">
        <FieldBlock
          label="First comment"
          value={firstComment}
          onChange={(v) => onChange({ caption, firstComment: v })}
          rows={2}
          placeholder="The booking link goes here, not in the caption."
          copied={copied === "fc"}
          onCopy={() => copy("fc", firstComment)}
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
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
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

// Stitch the user's per-photo descriptions into a caption, finished
// with the chosen CTA. Cover slide's headline opens it.
export function composeCaption(media: OverlayMedia[], s: OverlaySettings): string {
  if (media.length === 0) return "";
  const cover = media[0];
  const open = cover.headline ? `${cover.headline}.` : "";
  const descriptions = media
    .map((m) => m.body.trim())
    .filter(Boolean)
    .join("\n\n");
  const cta = composeCtaLine(s);
  return [open, descriptions, cta].filter(Boolean).join("\n\n");
}

export function composeFirstComment(s: OverlaySettings): string {
  if (s.ctaKind === "book-call" && s.bookingLink) {
    return `Book a free design call → ${s.bookingLink}`;
  }
  return composeCtaLine(s);
}

function composeCtaLine(s: OverlaySettings): string {
  const tmpl = CTA_DEFAULTS[s.ctaKind];
  const filled = tmpl.replace("{KEYWORD}", s.dmKeyword || "DESIGN");
  if (s.ctaKind === "book-call" && s.bookingLink) {
    return `${filled} ${s.bookingLink}`;
  }
  return filled;
}
