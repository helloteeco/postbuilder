"use client";

// Step 1 of Ad Coach: capture the offer economics ONCE. Everything
// else (personal targets, readiness, verdicts) derives from this.
// Kept short and plain — most fields are a number or a yes/no.

import { useEffect, useState } from "react";
import {
  CLOSE_METHOD_LABELS,
  EMPTY_OFFER,
  loadOffer,
  saveOffer,
  type AdOffer,
  type CloseMethod,
} from "@/app/ad-coach/lib/adStorage";
import { computeTargets, fmtMoney } from "@/app/ad-coach/lib/adMath";

interface Props {
  onSaved: () => void;
}

export default function OfferSetup({ onSaved }: Props) {
  const [offer, setOffer] = useState<AdOffer>(EMPTY_OFFER);
  const [open, setOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const loaded = loadOffer();
    setOffer(loaded);
    // Auto-open the form if the offer hasn't been set up yet.
    if (!loaded.offerName || loaded.offerPrice <= 0) setOpen(true);
  }, []);

  function patch<K extends keyof AdOffer>(k: K, v: AdOffer[K]) {
    setOffer((o) => ({ ...o, [k]: v }));
  }

  function handleSave() {
    saveOffer(offer);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
    onSaved();
    setOpen(false);
  }

  const targets = computeTargets(offer);
  const isSetUp = offer.offerName.length > 0 && offer.offerPrice > 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Step 1 — Your offer
          </div>
          <h2 className="mt-0.5 text-lg font-bold text-gray-900">
            {isSetUp ? offer.offerName : "Set up your offer"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            We use this to show YOUR real numbers — what you can pay per lead,
            per call, per client — instead of generic benchmarks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {open ? "Close" : isSetUp ? "Edit" : "Set up"}
        </button>
      </div>

      {/* Personal targets summary, shown when set up */}
      {isSetUp && !open && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <TargetCard
            label="Offer price"
            value={`$${offer.offerPrice.toLocaleString()}`}
          />
          <TargetCard
            label="Max per client"
            value={`$${fmtMoney(targets.maxCostPerClient)}`}
            hint="for healthy margin"
          />
          <TargetCard
            label="Max per call"
            value={
              targets.maxCostPerCall !== null
                ? `$${fmtMoney(targets.maxCostPerCall)}`
                : "—"
            }
            hint={targets.maxCostPerCall === null ? "add close rate" : "booked call"}
          />
          <TargetCard
            label="Max per lead"
            value={
              targets.maxCostPerLead !== null
                ? `$${fmtMoney(targets.maxCostPerLead)}`
                : "—"
            }
            hint={
              targets.maxCostPerLead === null ? "add show rate" : "DM / opt-in"
            }
          />
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-gray-600">
              What do you sell?
              <input
                type="text"
                value={offer.offerName}
                onChange={(e) => patch("offerName", e.target.value)}
                placeholder="e.g. 1:1 coaching, co-hosting setup, lead"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              Price of one sale ($)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={offer.offerPrice || ""}
                onChange={(e) => patch("offerPrice", Number(e.target.value) || 0)}
                placeholder="e.g. 8000"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              Close rate (%) — of people who take your close step, how many buy?
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={offer.closeRatePct || ""}
                onChange={(e) =>
                  patch("closeRatePct", Number(e.target.value) || 0)
                }
                placeholder="e.g. 25"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              Show rate (%) — of leads, how many show up to the close step?
              <span className="text-gray-400"> (optional)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={offer.showRatePct || ""}
                onChange={(e) =>
                  patch("showRatePct", Number(e.target.value) || 0)
                }
                placeholder="e.g. 60"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs text-gray-600">
            How do people buy from you?
            <select
              value={offer.closeMethod}
              onChange={(e) => patch("closeMethod", e.target.value as CloseMethod)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {(Object.keys(CLOSE_METHOD_LABELS) as CloseMethod[]).map((m) => (
                <option key={m} value={m}>
                  {CLOSE_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              A few honest yes/no questions
            </div>
            <Check
              label="I've already sold this at least once WITHOUT ads."
              checked={offer.closedOrganically}
              onChange={(v) => patch("closedOrganically", v)}
            />
            <Check
              label="I have an Instagram pro account and can see profile visits + count my calls/sales."
              checked={offer.canMeasure}
              onChange={(v) => patch("canMeasure", v)}
            />
            <Check
              label="I can run about $10-$20/day for 14 days (~$140-$280) without it hurting."
              checked={offer.budgetOk}
              onChange={(v) => patch("budgetOk", v)}
            />
          </div>

          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <summary className="cursor-pointer font-semibold">
              Don&apos;t have a Coach Mode winner logged yet? Paste a hook
              that already worked. (Optional)
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
              The Launch Pack needs at least one proven post to base the ad
              on. If you have one in your head (or in Overlay Studio /
              Post Builder) but haven&apos;t logged it in Coach Mode,
              paste its cover hook here and the gate counts it as a yellow
              content signal — you&apos;ll unlock at <em>caution</em>{" "}
              instead of <em>green</em>, so you start at a smaller budget.
            </p>
            <label className="mt-2 block text-[11px] text-gray-600">
              Proven hook (cover line of the post)
              <input
                type="text"
                value={offer.provenHook}
                onChange={(e) => patch("provenHook", e.target.value)}
                placeholder="e.g. designed for bookings"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="mt-2 block text-[11px] text-gray-600">
              One line of body copy (optional — sharpens the AI prompt)
              <textarea
                value={offer.provenBody}
                onChange={(e) => patch("provenBody", e.target.value)}
                placeholder="e.g. 10 design moves that print money"
                rows={2}
                className="mt-1 w-full resize-y rounded border border-gray-300 p-2 text-sm"
              />
            </label>
          </details>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              {savedFlash ? "✓ Saved" : "Save offer"}
            </button>
            <span className="text-[11px] text-gray-500">
              Stored only in your browser. Each channel has its own offer.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function TargetCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-base font-bold text-gray-900">{value}</div>
      {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}
