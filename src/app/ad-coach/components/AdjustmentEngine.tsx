"use client";

// Step 4 of Ad Coach: the Adjustment Engine. The "and adjust them"
// part. The user pastes a handful of numbers; the coach computes the
// whole ladder against THEIR personal targets and returns ONE verdict
// + ONE action. Decisions, not dashboards.

import { useEffect, useMemo, useState } from "react";
import {
  computeVerdict,
  fmtMoney,
  type VerdictResult,
} from "@/app/ad-coach/lib/adMath";
import { computeTargets } from "@/app/ad-coach/lib/adMath";
import {
  addCheckin,
  deleteCheckin,
  loadCheckins,
  type AdCheckin,
  type AdOffer,
} from "@/app/ad-coach/lib/adStorage";

interface Props {
  offer: AdOffer;
}

interface NumForm {
  adLabel: string;
  dayOfTest: string;
  spend: string;
  reach: string;
  threeSecViews: string;
  linkClicks: string;
  profileVisits: string;
  leads: string;
  callsBooked: string;
  clients: string;
  frequency: string;
}

const EMPTY: NumForm = {
  adLabel: "",
  dayOfTest: "",
  spend: "",
  reach: "",
  threeSecViews: "",
  linkClicks: "",
  profileVisits: "",
  leads: "",
  callsBooked: "",
  clients: "",
  frequency: "",
};

const VERDICT_STYLE: Record<VerdictResult["tone"], string> = {
  neutral: "border-gray-300 bg-gray-50 text-gray-900",
  good: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  bad: "border-rose-300 bg-rose-50 text-rose-900",
};

export default function AdjustmentEngine({ offer }: Props) {
  const [form, setForm] = useState<NumForm>(EMPTY);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [checkins, setCheckins] = useState<AdCheckin[]>([]);

  useEffect(() => {
    setCheckins(loadCheckins());
  }, []);

  const targets = useMemo(() => computeTargets(offer), [offer]);

  function set<K extends keyof NumForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function num(v: string): number {
    return Number(v) || 0;
  }

  function handleCheck() {
    const input = {
      dayOfTest: num(form.dayOfTest),
      spend: num(form.spend),
      reach: num(form.reach),
      threeSecViews: num(form.threeSecViews),
      linkClicks: num(form.linkClicks),
      profileVisits: num(form.profileVisits),
      leads: num(form.leads),
      callsBooked: num(form.callsBooked),
      clients: num(form.clients),
      frequency: form.frequency ? num(form.frequency) : undefined,
      targets,
    };
    setVerdict(computeVerdict(input));
  }

  function handleSave() {
    if (!verdict) return;
    addCheckin({
      adLabel: form.adLabel || "(unlabeled ad)",
      dayOfTest: num(form.dayOfTest),
      verdict: verdict.id,
      spend: num(form.spend),
      reach: num(form.reach),
      threeSecViews: num(form.threeSecViews),
      linkClicks: num(form.linkClicks),
      profileVisits: num(form.profileVisits),
      leads: num(form.leads),
      callsBooked: num(form.callsBooked),
      clients: num(form.clients),
    });
    setCheckins(loadCheckins());
  }

  function handleDelete(id: string) {
    deleteCheckin(id);
    setCheckins(loadCheckins());
  }

  const fields: { key: keyof NumForm; label: string; optional?: boolean }[] = [
    { key: "dayOfTest", label: "Day of test (1-14+)" },
    { key: "spend", label: "Total spent ($)" },
    { key: "reach", label: "Reach" },
    { key: "threeSecViews", label: "3-sec video views" },
    { key: "linkClicks", label: "Link clicks" },
    { key: "profileVisits", label: "Profile visits" },
    { key: "leads", label: "Leads (DMs / opt-ins)" },
    { key: "callsBooked", label: "Calls booked" },
    { key: "clients", label: "Clients / sales" },
    { key: "frequency", label: "Frequency", optional: true },
  ];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 4 — Read your ad &amp; adjust
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Paste your numbers, get one decision
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Drop in what Meta shows you. We compute the whole picture against your
        targets and give you one verdict and one next move. No dashboards to
        decode.
      </p>

      {/* Co-work tip: let Claude read the Ads Manager screen */}
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
        <button
          type="button"
          onClick={() => setTipOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left font-semibold"
        >
          <span>💡 Faster way — let Claude read your Ads Manager screen</span>
          <span className="text-blue-800">{tipOpen ? "Hide ▴" : "Show ▾"}</span>
        </button>
        {tipOpen && (
          <ol className="mt-2 list-decimal space-y-0.5 pl-5">
            <li>Open Meta Ads Manager with your ad&apos;s stats on screen.</li>
            <li>
              In the <strong>Claude desktop app</strong> (or extension) paste:{" "}
              <em>
                &ldquo;Read my Meta Ads Manager numbers on screen and list:
                day of test, total spent, reach, 3-second video views, link
                clicks, profile visits, leads, calls booked, clients,
                frequency.&rdquo;
              </em>
            </li>
            <li>Paste the numbers Claude returns into the fields below.</li>
          </ol>
        )}
      </div>

      {!targets.hasOffer && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          Set your offer price in Step 1 first — without it, the verdict
          can&apos;t tell scale from kill.
        </div>
      )}

      <label className="mt-4 block text-xs text-gray-600">
        Which ad is this? (optional label)
        <input
          type="text"
          value={form.adLabel}
          onChange={(e) => set("adLabel", e.target.value)}
          placeholder="e.g. the $25K down reel"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        {fields.map(({ key, label, optional }) => (
          <label key={key} className="text-xs text-gray-600">
            {label}
            {optional && <span className="text-gray-400"> (opt)</span>}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCheck}
        className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
      >
        Get my verdict
      </button>

      {verdict && (
        <div className={`mt-4 rounded-lg border p-4 ${VERDICT_STYLE[verdict.tone]}`}>
          <div className="text-xs font-bold uppercase tracking-wider">
            {verdict.label}
          </div>
          <div className="mt-1 text-sm font-semibold">{verdict.headline}</div>
          <div className="mt-1 text-sm">{verdict.action}</div>
          {verdict.detail && (
            <div className="mt-1 text-xs font-medium opacity-90">
              {verdict.detail}
            </div>
          )}

          {/* Ladder read */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill
              label="Hook rate"
              value={
                verdict.ladder.hookRatePct !== null
                  ? `${verdict.ladder.hookRatePct.toFixed(0)}%`
                  : "—"
              }
            />
            <Pill
              label="Cost / visit"
              value={
                verdict.ladder.costPerProfileVisit !== null
                  ? `$${fmtMoney(verdict.ladder.costPerProfileVisit)}`
                  : "—"
              }
            />
            <Pill
              label="Cost / lead"
              value={
                verdict.ladder.costPerLead !== null
                  ? `$${fmtMoney(verdict.ladder.costPerLead)}`
                  : "—"
              }
            />
            <Pill
              label="Cost / call"
              value={
                verdict.ladder.costPerCall !== null
                  ? `$${fmtMoney(verdict.ladder.costPerCall)}`
                  : "—"
              }
            />
            <Pill
              label="Cost / client"
              value={
                verdict.ladder.costPerClient !== null
                  ? `$${fmtMoney(verdict.ladder.costPerClient)}`
                  : "—"
              }
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="mt-3 rounded border border-current px-2.5 py-1 text-xs font-semibold hover:opacity-80"
          >
            Save this check-in
          </button>
        </div>
      )}

      {/* History */}
      {checkins.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Past check-ins
          </div>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {checkins.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{c.adLabel}</span>
                  <span className="text-gray-500">
                    {" "}
                    · day {c.dayOfTest} ·{" "}
                    {new Date(c.loggedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-700">
                    {c.verdict}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="rounded border border-gray-200 px-1.5 py-0.5 text-gray-400 hover:bg-gray-100"
                    aria-label="Delete check-in"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium ring-1 ring-current/20">
      {label}: <span className="font-bold">{value}</span>
    </span>
  );
}
