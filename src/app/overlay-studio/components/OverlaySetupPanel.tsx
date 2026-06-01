"use client";

// Sidebar setup panel. Compact — mirrors the ParamsPanel feel from
// Post Builder. The user picks: output format (post / reel), whether
// to show the profile chip on slides, audience / pillar / CTA / DM
// keyword / booking link, plus an optional listing-context dropdown
// for the Claude prompt path.

import {
  AUDIENCE_LABELS,
  CTA_DEFAULTS,
  OUTPUT_DIMENSIONS,
  PILLAR_LABELS,
  type Audience,
  type CtaKind,
  type DesignPillar,
  type OutputFormat,
  type OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  settings: OverlaySettings;
  onChange: (next: OverlaySettings) => void;
}

export default function OverlaySetupPanel({ settings, onChange }: Props) {
  function patch<K extends keyof OverlaySettings>(k: K, v: OverlaySettings[K]) {
    onChange({ ...settings, [k]: v });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 text-sm font-bold text-gray-900">Studio settings</div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Output format
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(OUTPUT_DIMENSIONS) as OutputFormat[]).map((f) => {
              const active = settings.outputFormat === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => patch("outputFormat", f)}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {OUTPUT_DIMENSIONS[f].label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.showProfile}
            onChange={(e) => patch("showProfile", e.target.checked)}
          />
          Show profile chip on each slide
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.enhancePhotos}
            onChange={(e) => patch("enhancePhotos", e.target.checked)}
          />
          Enhance new photos (soft warm preset)
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.captionStyle === "warm-design"}
            onChange={(e) =>
              patch("captionStyle", e.target.checked ? "warm-design" : "plain")
            }
          />
          Auto-write the warm-design caption
        </label>

        <label className="block text-xs text-gray-600">
          Audience
          <select
            value={settings.audience}
            onChange={(e) => patch("audience", e.target.value as Audience)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-600">
          Pillar
          <select
            value={settings.pillar}
            onChange={(e) => patch("pillar", e.target.value as DesignPillar)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(PILLAR_LABELS) as DesignPillar[]).map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-600">
          CTA
          <select
            value={settings.ctaKind}
            onChange={(e) => patch("ctaKind", e.target.value as CtaKind)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(CTA_DEFAULTS) as CtaKind[]).map((c) => (
              <option key={c} value={c}>
                {CTA_DEFAULTS[c]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            DM keyword
            <input
              type="text"
              value={settings.dmKeyword}
              onChange={(e) => patch("dmKeyword", e.target.value.toUpperCase())}
              placeholder="DESIGN"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm uppercase tracking-wider"
            />
          </label>
          <label className="text-xs text-gray-600">
            Booking link
            <input
              type="url"
              value={settings.bookingLink}
              onChange={(e) => patch("bookingLink", e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>

        <details className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
          <summary className="cursor-pointer font-medium">
            Listing context (optional)
          </summary>
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={settings.listingNickname}
              onChange={(e) => patch("listingNickname", e.target.value)}
              placeholder="Nickname (e.g. Desert Cabin)"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={settings.listingCity}
              onChange={(e) => patch("listingCity", e.target.value)}
              placeholder="City"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={settings.listingSpecs}
              onChange={(e) => patch("listingSpecs", e.target.value)}
              placeholder="3 bd · 2 ba · sleeps 10"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <textarea
              value={settings.sellingPoints}
              onChange={(e) => patch("sellingPoints", e.target.value)}
              rows={2}
              placeholder="Selling points, one per line"
              className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </details>
      </div>
    </div>
  );
}
