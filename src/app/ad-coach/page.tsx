"use client";

// Ad Coach (beta) — a standalone tab that teaches users WHEN and HOW
// to run Instagram ads off the content the coach already helped them
// make. Reads the existing Coach Mode tracker READ-ONLY (proven
// winners) and stores only its own ad_* keys. Never touches Post
// Builder, Reel Builder, or Coach Mode logic.
//
// Flow: Offer setup → Readiness Gate → Launch Pack (locked until
// ready) → Adjustment Engine → lessons.

import { useEffect, useState } from "react";
import {
  ensureChannelsInitialized,
} from "@/app/coach/lib/channels";
import { installCustomData } from "@/app/coach/lib/customization";
import { loadOffer, type AdOffer, EMPTY_OFFER } from "@/app/ad-coach/lib/adStorage";
import { computeReadiness } from "@/app/ad-coach/lib/adReadiness";
import OfferSetup from "@/app/ad-coach/components/OfferSetup";
import ReadinessGate from "@/app/ad-coach/components/ReadinessGate";
import LaunchPack from "@/app/ad-coach/components/LaunchPack";
import AdjustmentEngine from "@/app/ad-coach/components/AdjustmentEngine";
import AdLessons from "@/app/ad-coach/components/AdLessons";
import WelcomeBanner from "@/components/WelcomeBanner";

export default function AdCoachPage() {
  const [offer, setOffer] = useState<AdOffer>(EMPTY_OFFER);
  // Bumped on any save so children recompute from fresh storage.
  const [rev, setRev] = useState(0);

  useEffect(() => {
    // Make sure channel-scoped storage + effective settings are wired,
    // in case the user lands here without opening Coach Mode first.
    ensureChannelsInitialized();
    installCustomData();
    setOffer(loadOffer());
  }, []);

  function refresh() {
    setOffer(loadOffer());
    setRev((v) => v + 1);
  }

  const readiness = computeReadiness(offer);
  const locked = readiness.overall === "stop";
  const caution = readiness.overall === "caution";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Ad Coach</h1>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            Beta
          </span>
        </div>
        <p className="text-sm text-gray-600">
          When (and how) to put money behind the content that&apos;s already
          working. Built so a total beginner can&apos;t torch cash on ads.
        </p>
      </header>

      <WelcomeBanner
        storageKey="welcome_ad_coach_v1"
        title="👋 Welcome to Ad Coach (beta)"
        steps={[
          {
            label: "Set your offer",
            detail:
              "Tell it what you sell + your price. It turns that into YOUR real targets — what you can pay per lead, call, and client — so you're never guessing against generic benchmarks.",
          },
          {
            label: "Pass the readiness check",
            detail:
              "It won't let you spend until your offer + content are proven. If it says 'not yet,' it shows the organic fix to do first. That refusal is the point — it protects your money.",
          },
          {
            label: "Build your Launch Pack",
            detail:
              "Once green, it builds a copy-paste ad campaign from your best organic post — settings, copy (written in your voice by your AI), and exact launch steps.",
          },
          {
            label: "Read & adjust weekly",
            detail:
              "Paste your ad numbers (or let Claude read your Ads Manager screen) and get ONE verdict: scale, refresh, fix the funnel, or kill. No dashboards to decode.",
          },
        ]}
      />

      <OfferSetup onSaved={refresh} />
      <ReadinessGate offer={offer} refreshKey={rev} />
      <LaunchPack offer={offer} locked={locked} caution={caution} />
      <AdjustmentEngine offer={offer} />
      <AdLessons />

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
        Honest note: ad spend is a cost that can be lost, never a guaranteed
        return. The benchmarks here are starting reference points — they drift,
        so treat them as guardrails, not promises. No income claims. The math
        does the talking.
      </div>
    </div>
  );
}
