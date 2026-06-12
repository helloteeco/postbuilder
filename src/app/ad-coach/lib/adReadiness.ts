// Ad Coach — the Readiness Gate. The brand-protecting core: it refuses
// to unlock the Launch Pack until the user has earned the right to
// spend. Scores 5 checks from data the coach already has, only relying
// on self-reports for what it genuinely can't infer.

import type { AdOffer } from "./adStorage";
import { getAdWinners } from "./adWinners";

export type GateStatus = "green" | "yellow" | "red";

export interface GateItem {
  id: string;
  title: string;
  status: GateStatus;
  // Plain-language explanation of where they stand.
  detail: string;
  // If not green: the organic fix to do FIRST.
  fix?: string;
}

export interface ReadinessResult {
  items: GateItem[];
  // overall: "go" unlocks the Launch Pack; "caution" unlocks with a
  // smaller-budget warning; "stop" keeps it locked.
  overall: "go" | "caution" | "stop";
  // One-line summary for the header.
  summary: string;
}

export function computeReadiness(offer: AdOffer): ReadinessResult {
  const winners = getAdWinners();
  const items: GateItem[] = [];

  // 1. Proven offer — sold organically OR strong intent signal.
  const hasStrongIntent = winners.length > 0;
  items.push({
    id: "offer",
    title: "Proven offer",
    status: offer.closedOrganically
      ? "green"
      : hasStrongIntent
        ? "yellow"
        : "red",
    detail: offer.closedOrganically
      ? "You've closed at least one sale without ads. The offer works."
      : hasStrongIntent
        ? "You have posts that resonated, but no organic sale logged yet. Intent is there; proof of sale isn't."
        : "Nothing has sold organically yet, and no strong-intent posts are tracked.",
    fix: offer.closedOrganically
      ? undefined
      : "Close 1-2 people organically first. Ads amplify what already works — they can't fix an offer nobody's buying yet. Use your best content + a clear DM ask to land the first sale.",
  });

  // 2. A way to close — defined close step + a known close rate.
  const hasCloseStep = offer.closeMethod !== "other";
  const hasCloseRate = offer.closeRatePct > 0;
  items.push({
    id: "close",
    title: "A way to close",
    status: hasCloseStep && hasCloseRate ? "green" : hasCloseStep ? "yellow" : "red",
    detail:
      hasCloseStep && hasCloseRate
        ? "You have a clear next step and a rough close rate. The coach can compute your real targets."
        : hasCloseStep
          ? "You have a close step but no close rate yet. Add a rough % so targets are accurate."
          : "No clear way for an interested person to become a paying client.",
    fix:
      hasCloseStep && hasCloseRate
        ? undefined
        : "Pick how you close (booked call, DM funnel, or checkout) and estimate your close rate in the Offer step above. Even a rough guess beats none.",
  });

  // 3. Proven content — at least 1 organic winner to run as the ad.
  // Counts auto-detected Coach Mode winners first; if there are none
  // but the user pasted a manual provenHook in the Offer step, that
  // counts as a yellow signal (good enough to start, not as strong as
  // verified-organic data).
  const manualHookFilled = offer.provenHook.trim().length > 0;
  const contentStatus: GateStatus =
    winners.length >= 2
      ? "green"
      : winners.length === 1
        ? "yellow"
        : manualHookFilled
          ? "yellow"
          : "red";
  items.push({
    id: "content",
    title: "Proven content to run",
    status: contentStatus,
    detail:
      winners.length >= 2
        ? `You have ${winners.length} proven posts. These become your ads — no guessing on creative.`
        : winners.length === 1
          ? "You have 1 proven post. Workable, but 2+ gives you a backup to rotate in."
          : manualHookFilled
            ? "You marked a hook as proven organically. Workable to launch, but the strongest signal is a logged Coach Mode winner."
            : "No proven winners tracked yet. Ads should run your best organic content, not untested creative.",
    fix:
      contentStatus !== "red"
        ? undefined
        : "Either log a Coach Mode winner (best) OR paste a hook that already worked organically in the Offer step above. Ads should run your best organic content, not untested creative.",
  });

  // 4. Measurement — can they see profile visits / leads / calls.
  items.push({
    id: "measure",
    title: "You can measure it",
    status: offer.canMeasure ? "green" : "yellow",
    detail: offer.canMeasure
      ? "You can see profile visits, leads, and calls. You'll be able to judge the ad honestly."
      : "You haven't confirmed you can track results. Without numbers, you're flying blind.",
    fix: offer.canMeasure
      ? undefined
      : "Switch to an Instagram pro account (free) so you get insights, and set up a way to count calls/sales (calendar, DM log, or checkout). Confirm this in the Offer step.",
  });

  // 5. Sane budget — can they run a real test without it hurting.
  items.push({
    id: "budget",
    title: "Test budget you can lose",
    status: offer.budgetOk ? "green" : "yellow",
    detail: offer.budgetOk
      ? "You can run a ~$140-$280 test over 14 days. That's a test cost, not a guarantee."
      : "You haven't confirmed a test budget. Ads are a cost that can be lost — never spend rent money.",
    fix: offer.budgetOk
      ? undefined
      : "Only start when you can run ~$10-$20/day for 14 days without stress. Confirm in the Offer step.",
  });

  // Verdict: any RED on the first three (offer / close / content) hard-
  // locks. Reds on measure/budget are yellow-only by construction.
  const coreReds = items
    .filter((it) => ["offer", "close", "content"].includes(it.id))
    .some((it) => it.status === "red");
  const anyYellow = items.some((it) => it.status === "yellow");

  let overall: ReadinessResult["overall"];
  let summary: string;
  if (coreReds) {
    overall = "stop";
    summary =
      "Not yet. Fix the red items below organically before you spend a dollar — that's what protects your money.";
  } else if (anyYellow) {
    overall = "caution";
    summary =
      "Almost. You can start small, but tighten the yellow items first and keep the budget conservative.";
  } else {
    overall = "go";
    summary = "Green light. You've earned the right to spend. Build your Launch Pack below.";
  }

  return { items, overall, summary };
}
