"use client";

// Step 2 of Ad Coach: the Readiness Gate. The differentiator. It will
// NOT let a beginner spend until they've earned it — and when it locks,
// it shows the organic fix to do first. This is the money-saving,
// brand-protecting core of the module.

import { computeReadiness, type GateStatus } from "@/app/ad-coach/lib/adReadiness";
import type { AdOffer } from "@/app/ad-coach/lib/adStorage";

interface Props {
  offer: AdOffer;
  // Bumped by the parent whenever offer/tracker changes so this
  // recomputes. (We read fresh each render anyway.)
  refreshKey: number;
}

const DOT: Record<GateStatus, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

export default function ReadinessGate({ offer }: Props) {
  const result = computeReadiness(offer);

  const verdictStyle =
    result.overall === "go"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : result.overall === "caution"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-rose-300 bg-rose-50 text-rose-900";

  const verdictLabel =
    result.overall === "go"
      ? "🟢 Green light"
      : result.overall === "caution"
        ? "🟡 Almost ready"
        : "🔴 Not yet — and that's good";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 2 — Are you ready to run ads?
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">Readiness check</h2>
      <p className="mt-1 text-sm text-gray-600">
        Ads don&apos;t fix a weak offer — they expose it. Paid traffic just
        pours fuel on a fire that&apos;s already lit. This check makes sure
        there&apos;s a fire first.
      </p>

      <div className={`mt-3 rounded-lg border p-3 ${verdictStyle}`}>
        <div className="text-sm font-bold">{verdictLabel}</div>
        <div className="mt-0.5 text-xs">{result.summary}</div>
      </div>

      <ul className="mt-3 space-y-2">
        {result.items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-gray-200 p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT[item.status]}`}
              />
              <span className="text-sm font-semibold text-gray-900">
                {item.title}
              </span>
            </div>
            <div className="mt-1 pl-[18px] text-xs text-gray-600">
              {item.detail}
            </div>
            {item.fix && (
              <div className="mt-1.5 ml-[18px] rounded border border-amber-200 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
                <span className="font-semibold">Do this first: </span>
                {item.fix}
              </div>
            )}
          </li>
        ))}
      </ul>

      {result.overall === "stop" && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          The Launch Pack stays locked until the red items are green. This
          isn&apos;t the app being difficult — spending before this is ready is
          the #1 way beginners lose money on ads.
        </div>
      )}
    </section>
  );
}
