"use client";

// Per-photo audit row: preview on the left, controls on the right.
// Controls cover the 9-position grid, color, scrim toggle, preset
// picker, reorder, delete. Headline + body live underneath so they
// have room to breathe across the full card width.

import OverlaySlideRender, {
  SLIDE_H,
  SLIDE_W,
} from "./OverlaySlideRender";
import { PRESETS, PRESET_ORDER } from "@/app/overlay-studio/lib/overlayPresets";
import type {
  OverlayMedia,
  PresetKey,
  Position,
  TextColor,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia;
  index: number;
  total: number;
  onChange: (patch: Partial<OverlayMedia>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

const PREVIEW_W = 220;
const PREVIEW_SCALE = PREVIEW_W / SLIDE_W;
const PREVIEW_H = SLIDE_H * PREVIEW_SCALE;

const POSITIONS: Position[] = [
  "TL", "TC", "TR",
  "CL", "CC", "CR",
  "BL", "BC", "BR",
];

const COLOR_SWATCHES: Array<{ k: TextColor; bg: string; ring: string }> = [
  { k: "light", bg: "#FFFFFF", ring: "#0A0A0A" },
  { k: "dark", bg: "#0A0A0A", ring: "#FFFFFF" },
  { k: "yellow", bg: "#FBC02D", ring: "#0A0A0A" },
];

export default function OverlayMediaCard({
  media,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const preset = PRESETS[media.preset];

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
        {/* Preview */}
        <div
          style={{
            width: PREVIEW_W,
            height: PREVIEW_H,
            overflow: "hidden",
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          <OverlaySlideRender
            media={media}
            slideNumber={index + 1}
            scale={PREVIEW_SCALE}
          />
        </div>

        {/* Controls */}
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
            <div className="text-[11px] text-gray-600">Position</div>
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
          Headline (≤ 6 words)
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
          Body (1–2 lines, skimmable)
          <textarea
            value={media.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={2}
            placeholder="One descriptive line that teaches the point."
            className="mt-0.5 w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
      </div>
    </div>
  );
}
