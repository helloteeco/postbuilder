"use client";

// Step 3 of Ad Coach: the Launch Pack. Locked until the Readiness Gate
// says go/caution. Generates a complete copy-paste campaign from a
// PROVEN organic winner — campaign settings (copy buttons), an
// AI-ready ad-copy prompt, and a zero-experience launch walkthrough.

import { useMemo, useState } from "react";
import CopyButton from "./CopyButton";
import {
  getAdWinners,
  winnerHook,
  type AdWinner,
} from "@/app/ad-coach/lib/adWinners";
import { buildAdCopyPrompt } from "@/app/ad-coach/lib/adCopyPrompt";
import { suggestedDailyBudget } from "@/app/ad-coach/lib/adMath";
import type { AdOffer } from "@/app/ad-coach/lib/adStorage";

interface Props {
  offer: AdOffer;
  locked: boolean;
  caution: boolean;
}

export default function LaunchPack({ offer, locked, caution }: Props) {
  const winners = useMemo(() => getAdWinners(), []);
  const [selectedId, setSelectedId] = useState<string | null>(
    winners[0]?.post.id ?? null,
  );

  const selected: AdWinner | null =
    winners.find((w) => w.post.id === selectedId) ?? winners[0] ?? null;

  if (locked) {
    return (
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Step 3 — Launch Pack (locked)
        </div>
        <div className="mt-2 text-3xl">🔒</div>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Pass the readiness check above to unlock your Launch Pack. When
          it&apos;s green, this builds a ready-to-paste ad campaign from your
          best organic post — no guessing.
        </p>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Step 3 — Launch Pack
        </div>
        <p className="mt-2 text-sm text-gray-600">
          No proven winner found to run. Log a few posts in Coach Mode and mark
          (or earn) a winner first — then come back and your ad creative is
          ready.
        </p>
      </section>
    );
  }

  const budget = suggestedDailyBudget(offer);
  const objective =
    offer.closeMethod === "landing-page" || offer.closeMethod === "dm-funnel"
      ? "Leads"
      : "Engagement → Profile visits / Traffic";
  const campaignName = `${(offer.offerName || "Offer").slice(0, 20)} — ${winnerHook(selected).slice(0, 30)}`;

  const adPrompt = buildAdCopyPrompt(selected, offer);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 3 — Your Launch Pack
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Ready-to-paste ad campaign
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Built from your proven winner. Copy each value, paste it into Meta. You
        never type a setting from scratch.
      </p>

      {caution && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          You passed with a caution — start at the low end of the budget and
          tighten the yellow items above as you go.
        </div>
      )}

      {/* Winner picker */}
      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold text-gray-700">
          Which post to run (your best is pre-picked)
        </div>
        <select
          value={selected.post.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {winners.map((w) => (
            <option key={w.post.id} value={w.post.id}>
              {winnerHook(w).slice(0, 60)} — {w.reason}
            </option>
          ))}
        </select>
      </div>

      {/* Campaign setup card */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Campaign settings — copy each into Meta
        </div>
        <div className="space-y-1.5">
          <SettingRow label="Campaign name" value={campaignName} />
          <SettingRow label="Objective" value={objective} />
          <SettingRow label="Audience" value="Advantage+ / broad (let Meta target)" />
          <SettingRow label="Placements" value="Advantage+ placements (default)" />
          <SettingRow label="Daily budget" value={`$${budget}/day`} />
          <SettingRow
            label="Schedule"
            value="14-day test — do NOT edit during days 1-7"
          />
        </div>
        <p className="mt-2 text-[11px] text-amber-800">
          Beginners: keep the audience broad. Meta&apos;s AI + your proven
          creative do the targeting better than guessed interest stacks.
        </p>
      </div>

      {/* Ad copy via Claude.ai prompt */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ad copy — get it written in your voice
          </div>
          <CopyButton value={adPrompt} label="Copy prompt" />
        </div>
        <p className="mb-2 text-[11px] text-gray-600">
          Copy this prompt → paste into Claude.ai (or any AI chat) → get 3
          primary-text variations + a headline + a CTA button, all grounded in
          the post that already worked. Paste your favorite into Meta.
        </p>
        <textarea
          readOnly
          value={adPrompt}
          className="h-40 w-full resize-y rounded border border-gray-300 bg-white p-2 font-mono text-[11px] text-gray-800"
        />
      </div>

      {/* Launch walkthrough */}
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
        <div className="mb-1 font-semibold uppercase tracking-wider text-blue-800">
          Launch in 10 minutes — exact steps
        </div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            On Instagram, open your proven post:{" "}
            <em>&ldquo;{winnerHook(selected).slice(0, 60)}&rdquo;</em>.
          </li>
          <li>
            Tap <strong>Boost post</strong> (simplest) — or open{" "}
            <strong>Meta Ads Manager</strong> for more control.
          </li>
          <li>
            Goal: pick <strong>{objective.split(" ")[0]}</strong> (matches the
            Objective above).
          </li>
          <li>
            Audience: choose <strong>Advantage+ / Automatic</strong>. Don&apos;t
            hand-pick interests.
          </li>
          <li>
            Budget &amp; duration: set <strong>${budget}/day</strong> for{" "}
            <strong>14 days</strong>.
          </li>
          <li>
            Paste the ad copy you generated above into the primary text /
            headline fields.
          </li>
          <li>
            Set the CTA button Claude recommended. Review, then publish.
          </li>
          <li>
            <strong>Walk away for 7 days.</strong> Editing during the learning
            phase resets it and wastes spend. Come back to Step 4.
          </li>
        </ol>
        <div className="mt-2 rounded border border-blue-200 bg-white/60 p-2 text-blue-900/80">
          Ads are a test cost that can be lost — never a guaranteed return. If
          the numbers don&apos;t work, Step 4 tells you exactly what to do.
        </div>
      </div>
    </section>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </div>
        <div className="truncate text-sm text-gray-900">{value}</div>
      </div>
      <CopyButton value={value} />
    </div>
  );
}
