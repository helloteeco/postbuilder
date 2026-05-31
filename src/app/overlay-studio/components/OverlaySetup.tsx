"use client";

// Step 1 — set audience / pillar / CTA / listing context. Persists to
// the active channel's overlay_settings key. Stored once, drives the
// prompt + caption for every post under this channel.

import {
  AUDIENCE_LABELS,
  CTA_DEFAULTS,
  PILLAR_LABELS,
  type Audience,
  type CtaKind,
  type DesignPillar,
  type OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  settings: OverlaySettings;
  onChange: (next: OverlaySettings) => void;
}

export default function OverlaySetup({ settings, onChange }: Props) {
  function patch<K extends keyof OverlaySettings>(k: K, v: OverlaySettings[K]) {
    onChange({ ...settings, [k]: v });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 1 — Setup
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Who's this post for + what should it teach?
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Set this once per channel. It drives the prompt for Claude and the
        caption voice. Saved automatically.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-600">
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

        <label className="text-xs text-gray-600">
          Design pillar (what this post teaches)
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
          <span className="mt-1 block text-[10px] text-gray-500">
            {PILLAR_LABELS[settings.pillar].definition}
          </span>
        </label>

        <label className="text-xs text-gray-600">
          Single call to action
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
          <span className="mt-1 block text-[10px] text-gray-500">
            One ask per post. Never two.
          </span>
        </label>

        <label className="text-xs text-gray-600">
          DM keyword
          <input
            type="text"
            value={settings.dmKeyword}
            onChange={(e) => patch("dmKeyword", e.target.value.toUpperCase())}
            placeholder="DESIGN"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase tracking-wider"
          />
        </label>

        <label className="text-xs text-gray-600 md:col-span-2">
          Booking link (the page you want clicks to land on)
          <input
            type="url"
            value={settings.bookingLink}
            onChange={(e) => patch("bookingLink", e.target.value)}
            placeholder="https://calendly.com/your-link"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <details className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
          Listing context (optional but helps Claude — open to fill in)
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-600">
            Nickname
            <input
              type="text"
              value={settings.listingNickname}
              onChange={(e) => patch("listingNickname", e.target.value)}
              placeholder="e.g. The Desert Cabin"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            City
            <input
              type="text"
              value={settings.listingCity}
              onChange={(e) => patch("listingCity", e.target.value)}
              placeholder="e.g. Joshua Tree, CA"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 md:col-span-2">
            Specs
            <input
              type="text"
              value={settings.listingSpecs}
              onChange={(e) => patch("listingSpecs", e.target.value)}
              placeholder="e.g. 3 bd · 2 ba · sleeps 10"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 md:col-span-2">
            Selling points (one per line)
            <textarea
              value={settings.sellingPoints}
              onChange={(e) => patch("sellingPoints", e.target.value)}
              rows={3}
              placeholder={"$28K booked month one\nJapandi desert design\n5-star reviews"}
              className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </details>
    </section>
  );
}
