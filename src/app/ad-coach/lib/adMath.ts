// Ad Coach — pure math. No I/O, no React. Three jobs:
//   1. Hold the benchmark "rungs of the ladder" (editable config).
//   2. Turn the user's offer economics into THEIR personal targets,
//      so the coach shows real numbers, not generic benchmarks.
//   3. The Adjustment Engine verdict: take a week's numbers + the
//      personal targets + day-of-test, return ONE verdict + ONE
//      action. Decisions, not dashboards.
//
// Benchmarks are 2026 Meta/Instagram reference points. They drift —
// treat as starting guardrails, review quarterly. Kept here as plain
// constants so they're easy to bump in one place.

import type { AdOffer } from "./adStorage";

// ── Benchmark ladder (reference targets) ───────────────────────────

export const BENCHMARKS = {
  hookRatePct: 25, // 3-sec views ÷ reach. 30%+ is strong.
  linkCtrPct: 1, // IG link CTR runs lower than FB.
  costPerProfileVisit: 0.3, // Jeff's top-of-funnel guardrail.
  cpcLow: 1, // normal IG link CPC range...
  cpcHigh: 3, // ...$1-$3.
  roasStart: 2, // 2-3x to start; ~1 is break-even.
  frequencyRefresh: 3, // rotate creative above this.
  // Healthy-margin spend multiplier: spend up to 30% of what a
  // sale is worth and you keep a fat margin.
  marginMultiplier: 0.3,
} as const;

// ── Personal targets from offer math ───────────────────────────────

export interface PersonalTargets {
  // True only when we have a price to compute from.
  hasOffer: boolean;
  offerPrice: number;
  // Max you can pay per client and still keep healthy margin.
  maxCostPerClient: number;
  // Break-even ceiling per client (= price). Spending up to here is
  // break-even; past it you lose money.
  breakEvenPerClient: number;
  // Derived down the funnel. Null when the needed rate is missing.
  maxCostPerCall: number | null;
  maxCostPerLead: number | null;
}

export function computeTargets(offer: AdOffer): PersonalTargets {
  const P = offer.offerPrice;
  const hasOffer = P > 0;
  const m = BENCHMARKS.marginMultiplier;
  const C = offer.closeRatePct > 0 ? offer.closeRatePct / 100 : null;
  const S = offer.showRatePct > 0 ? offer.showRatePct / 100 : null;

  const maxCostPerClient = hasOffer ? P * m : 0;
  const maxCostPerCall = hasOffer && C !== null ? P * C * m : null;
  const maxCostPerLead =
    hasOffer && C !== null && S !== null ? P * C * S * m : null;

  return {
    hasOffer,
    offerPrice: P,
    maxCostPerClient,
    breakEvenPerClient: hasOffer ? P : 0,
    maxCostPerCall,
    maxCostPerLead,
  };
}

// ── Suggested starting daily budget ────────────────────────────────
//
// Tiny + steady is the rule. We anchor to $15/day default but nudge by
// offer price: a $50 offer doesn't need (and shouldn't risk) the same
// daily spend as an $8k offer. Clamped to a sane $10-$30 beginner band.

export function suggestedDailyBudget(offer: AdOffer): number {
  if (offer.offerPrice <= 0) return 15;
  if (offer.offerPrice >= 5000) return 20;
  if (offer.offerPrice >= 1000) return 15;
  if (offer.offerPrice >= 300) return 12;
  return 10;
}

// ── The Adjustment Engine verdict ──────────────────────────────────

export type VerdictId = "wait" | "scale" | "refresh" | "fix-funnel" | "kill";

export interface VerdictInput {
  dayOfTest: number;
  spend: number;
  reach: number;
  threeSecViews: number;
  linkClicks: number;
  profileVisits: number;
  leads: number;
  callsBooked: number;
  clients: number;
  // From the offer math.
  targets: PersonalTargets;
  // Frequency is optional — many beginners won't pull it.
  frequency?: number;
}

export interface LadderRead {
  hookRatePct: number | null;
  linkCtrPct: number | null;
  costPerProfileVisit: number | null;
  costPerLead: number | null;
  costPerCall: number | null;
  costPerClient: number | null;
}

export function computeLadder(i: VerdictInput): LadderRead {
  const safe = (n: number, d: number) => (d > 0 ? n / d : null);
  return {
    hookRatePct: i.reach > 0 ? (i.threeSecViews / i.reach) * 100 : null,
    linkCtrPct: i.reach > 0 ? (i.linkClicks / i.reach) * 100 : null,
    costPerProfileVisit: safe(i.spend, i.profileVisits),
    costPerLead: safe(i.spend, i.leads),
    costPerCall: safe(i.spend, i.callsBooked),
    costPerClient: safe(i.spend, i.clients),
  };
}

export interface VerdictResult {
  id: VerdictId;
  label: string;
  tone: "neutral" | "good" | "warn" | "bad";
  // One-line headline of what's happening.
  headline: string;
  // The single next action, plain language.
  action: string;
  // Optional concrete number to act on (e.g. new budget).
  detail?: string;
  ladder: LadderRead;
}

// Total bottom-of-funnel results — used to decide if there's enough
// data to judge money metrics yet.
function moneyResults(i: VerdictInput): number {
  return i.callsBooked + i.clients;
}

export function computeVerdict(i: VerdictInput): VerdictResult {
  const ladder = computeLadder(i);
  const t = i.targets;

  // 1. WAIT — still in the learning phase or not enough data.
  //    Days 1-7 = learning; editing resets it. Also wait if money
  //    results are too thin to judge.
  if (i.dayOfTest < 7 || (moneyResults(i) < 3 && i.dayOfTest < 10)) {
    return {
      id: "wait",
      label: "WAIT",
      tone: "neutral",
      headline:
        i.dayOfTest < 7
          ? `Day ${i.dayOfTest} — still in the learning phase.`
          : "Not enough results yet to judge.",
      action:
        "Don't touch it. Editing now resets Meta's learning and wastes your spend. Come back after day 7 (ideally day 10-14).",
      detail:
        i.dayOfTest < 7
          ? `Check back on day 7. You're ${7 - i.dayOfTest} day${7 - i.dayOfTest === 1 ? "" : "s"} away.`
          : undefined,
      ladder,
    };
  }

  // Money metric we judge on: cost per client if we have clients,
  // else cost per booked call.
  const costPerClient = ladder.costPerClient;
  const costPerCall = ladder.costPerCall;
  const targetClient = t.maxCostPerClient > 0 ? t.maxCostPerClient : null;
  const targetCall = t.maxCostPerCall;

  // Pick the tightest money read available.
  const moneyActual = costPerClient ?? costPerCall;
  const moneyTarget =
    costPerClient !== null ? targetClient : costPerCall !== null ? targetCall : null;

  // Top-of-funnel health (rungs 1-2): are clicks/visits cheap + is the
  // hook working?
  const topOk =
    (ladder.costPerProfileVisit === null ||
      ladder.costPerProfileVisit <= BENCHMARKS.costPerProfileVisit * 1.5) &&
    (ladder.hookRatePct === null ||
      ladder.hookRatePct >= BENCHMARKS.hookRatePct * 0.8);

  // 5. KILL — money metric is 50%+ over target after day 10.
  if (
    i.dayOfTest >= 10 &&
    moneyActual !== null &&
    moneyTarget !== null &&
    moneyActual > moneyTarget * 1.5
  ) {
    return {
      id: "kill",
      label: "KILL",
      tone: "bad",
      headline: `Cost to get a ${costPerClient !== null ? "client" : "call"} is way over what you can pay.`,
      action:
        "Cut this ad. The numbers say it's losing money. Note what the hook + offer were, then test a different proven post or tighten the offer before spending again.",
      detail:
        moneyTarget !== null
          ? `You're paying ~$${fmt(moneyActual)} vs your max of $${fmt(moneyTarget)}.`
          : undefined,
      ladder,
    };
  }

  // 4. FIX FUNNEL — traffic is cheap/healthy (rungs 1-2) but the money
  //    rung is bad. The leak is after the click, not the ad.
  if (
    topOk &&
    moneyActual !== null &&
    moneyTarget !== null &&
    moneyActual > moneyTarget
  ) {
    return {
      id: "fix-funnel",
      label: "FIX THE FUNNEL",
      tone: "warn",
      headline:
        "Your ad is working — the offer or next step is leaking.",
      action:
        "Don't add budget. Cheap clicks but expensive clients means the problem is AFTER the click: your DM flow, call show-up, or the offer/close. Fix that step, then re-judge.",
      detail:
        "Pause spend increases until cost-per-client comes down. The ad isn't the problem.",
      ladder,
    };
  }

  // 3. REFRESH — creative fatigue.
  if (i.frequency !== undefined && i.frequency > BENCHMARKS.frequencyRefresh) {
    return {
      id: "refresh",
      label: "REFRESH CREATIVE",
      tone: "warn",
      headline: `Frequency is ${fmt(i.frequency)} — the same people keep seeing it.`,
      action:
        "Not broken, just tired. Swap in your next proven post + a fresh copy block and relaunch. Keep the winning audience + budget.",
      ladder,
    };
  }

  // 2. SCALE — money metric at/below target.
  if (
    moneyActual !== null &&
    moneyTarget !== null &&
    moneyActual <= moneyTarget
  ) {
    return {
      id: "scale",
      label: "SCALE",
      tone: "good",
      headline: "Winner — it's making money.",
      action:
        "Raise the daily budget about 20%. Don't make big jumps — large changes reset Meta's learning. Wait 3-4 days, then judge again.",
      detail: `New daily budget: $${fmt(suggestFromSpend(i))}.`,
      ladder,
    };
  }

  // Fallback — money metric not yet readable but past learning phase.
  // Most often: cheap top-of-funnel, no calls/clients logged yet.
  return {
    id: "fix-funnel",
    label: "WATCH THE CLOSE",
    tone: "warn",
    headline: "Traffic is flowing but no calls/clients logged yet.",
    action:
      "Make sure your close step is set up and you're counting it. If clicks are cheap but nobody books, the leak is your next step — fix that before adding budget.",
    ladder,
  };
}

// Suggest a +20% scaled budget from current daily spend. We infer
// daily spend from total spend ÷ days (rough but fine for a nudge).
function suggestFromSpend(i: VerdictInput): number {
  const daily = i.dayOfTest > 0 ? i.spend / i.dayOfTest : 15;
  return Math.round(daily * 1.2);
}

function fmt(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export { fmt as fmtMoney };
