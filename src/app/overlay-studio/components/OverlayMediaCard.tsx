"use client";

// Per-photo editor. Live preview on the left, controls on the right.
// Body field is the "what do you want this image to say" copy — it's
// the description that appears under the headline on the photo AND
// gets folded into the post caption.

import OverlaySlideRender from "./OverlaySlideRender";
import { PRESETS, PRESET_ORDER } from "@/app/overlay-studio/lib/overlayPresets";
import {
  OUTPUT_DIMENSIONS,
  type OutputFormat,
  type OverlayMedia,
  type Position,
  type PresetKey,
  type TextColor,
} from "@/app/overlay-studio/lib/overlayTypes";
import type { PostBuilderProfile } from "@/lib/post-templates";

interface Props {
  media: OverlayMedia;
  index: number;
  total: number;
  format: OutputFormat;
  profile: PostBuilderProfile;
  showProfile: boolean;
  onChange: (patch: Partial<OverlayMedia>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

const PREVIEW_W = 220;
const POSITIONS: Position[] = [
  "TL", "TC", "TR",
  "CL", "CC", "CR",
  "BL", "BC", "BR",
];
const COLOR_SWATCHES: Array<{ k: TextColor; bg: string }> = [
  { k: "light", bg: "#FFFFFF" },
  { k: "dark", bg: "#0A0A0A" },
  { k: "yellow", bg: "#FBC02D" },
];

export default function OverlayMediaCard({
  media,
  index,
  total,
  format,
  profile,
  showProfile,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const preset = PRESETS[media.preset];
  const dim = OUTPUT_DIMENSIONS[format];
  const scale = PREVIEW_W / dim.w;
  const previewH = dim.h * scale;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Slide {index + 1} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
            title="Drop this slide"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        <div
          style={{
            width: PREVIEW_W,
            height: previewH,
            overflow: "hidden",
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          <OverlaySlideRender
            media={media}
            format={format}
            slideNumber={index + 1}
            profile={profile}
            showProfile={showProfile}
            scale={scale}
          />
        </div>

        <div className="flex min-w-[260px] flex-1 flex-col gap-2">
          <label className="text-[11px] text-gray-600">
            Style
            <select
              value={media.preset}
              onChange={(e) =>
                onChange({ preset: e.target.value as PresetKey })
              }
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {PRESET_ORDER.map((k) => (
                <option key={k} value={k}>
                  {PRESETS[k].label}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[10px] italic text-gray-500">
              {preset.why}
            </span>
          </label>

          <div>
            <div className="text-[11px] text-gray-600">Text position</div>
            <div className="mt-0.5 grid grid-cols-3 gap-0.5">
              {POSITIONS.map((p) => {
                const active = p === media.position;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChange({ position: p })}
                    className={`h-6 rounded border text-[10px] font-bold transition ${
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                    title={p}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-600">Color</span>
              {COLOR_SWATCHES.map((s) => {
                const active = s.k === media.textColor;
                return (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => onChange({ textColor: s.k })}
                    aria-label={s.k}
                    className={`h-5 w-5 rounded-full border-2 transition ${
                      active
                        ? "border-gray-900 scale-110"
                        : "border-gray-300 hover:border-gray-500"
                    }`}
                    style={{ background: s.bg }}
                  />
                );
              })}
            </div>
            <label className="flex items-center gap-1 text-[11px] text-gray-600">
              <input
                type="checkbox"
                checked={media.scrim}
                onChange={(e) => onChange({ scrim: e.target.checked })}
              />
              Scrim
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-[11px] text-gray-600">
          Headline on the photo (≤6 words)
          <input
            type="text"
            value={media.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder="Short bold hook"
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm font-semibold"
            maxLength={60}
          />
          {media.headline.split(/\s+/).filter(Boolean).length > 6 && (
            <span className="mt-0.5 block text-[10px] text-amber-700">
              Over 6 words — tighten it.
            </span>
          )}
        </label>
        <label className="text-[11px] text-gray-600">
          What this image should say (description — also goes in the caption)
          <textarea
            value={media.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={2}
            placeholder="One short line about this photo. Feeds the caption too."
            className="mt-0.5 w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
      </div>
    </div>
  );
}
