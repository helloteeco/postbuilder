// Ad Coach — offer config + saved ad check-ins. Channel-scoped so it
// rides alongside the rest of Coach Mode's per-channel data (each
// channel = its own offer + ad history). Read/write only its own
// keys; never touches the coach's post tracker, pillars, or settings.
//
// Two stored shapes:
//   ad_offer    → the user's offer economics (price, close rate, etc.)
//   ad_checkins → a light history of Adjustment Engine reads so the
//                 user can see how an ad trended over time

import { channelKey, getCurrentChannelId } from "@/app/coach/lib/channels";

const SUFFIX_OFFER = "ad_offer";
const SUFFIX_CHECKINS = "ad_checkins";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// ── Offer config ────────────────────────────────────────────────────

export type CloseMethod =
  | "booked-call"
  | "dm-funnel"
  | "landing-page"
  | "other";

export const CLOSE_METHOD_LABELS: Record<CloseMethod, string> = {
  "booked-call": "Booked call (they book a call, you close on the call)",
  "dm-funnel": "DM funnel (they DM a keyword, you sell in DMs)",
  "landing-page": "Landing page / checkout (they buy or opt in online)",
  other: "Other / not sure yet",
};

export interface AdOffer {
  // What you sell. Free-form label, e.g. "1:1 coaching", "co-hosting
  // setup", "multifamily lead".
  offerName: string;
  // Price of one sale in dollars. The single most important number —
  // every target is derived from it.
  offerPrice: number;
  // Of the people who take your close step (e.g. booked calls), what %
  // become paying clients. 0-100. Rough is fine.
  closeRatePct: number;
  // Of the leads (DMs / opt-ins), what % actually show up to the close
  // step. 0-100. Optional — only used when a lead step exists before
  // the close step.
  showRatePct: number;
  closeMethod: CloseMethod;
  // Readiness self-reports the coach can't infer from tracked data.
  closedOrganically: boolean; // sold at least once without ads?
  canMeasure: boolean; // pro account + can see calls / sales?
  budgetOk: boolean; // can lose ~$140-280 over a 14-day test?
  // Manual proven-hook escape hatch. If the user hasn't logged anything
  // in Coach Mode yet but has a post they KNOW resonated, pasting the
  // hook + an optional body snippet here counts as a yellow content
  // signal in the Readiness Gate and seeds the Launch Pack's copy
  // prompt with their real organic words. Without this, brand-new
  // users were walled out of Ad Coach entirely.
  provenHook: string;
  provenBody: string;
}

export const EMPTY_OFFER: AdOffer = {
  offerName: "",
  offerPrice: 0,
  closeRatePct: 0,
  showRatePct: 0,
  closeMethod: "booked-call",
  closedOrganically: false,
  canMeasure: false,
  budgetOk: false,
  provenHook: "",
  provenBody: "",
};

function offerKey(): string {
  return channelKey(getCurrentChannelId(), SUFFIX_OFFER);
}

export function loadOffer(): AdOffer {
  if (!isBrowser()) return { ...EMPTY_OFFER };
  try {
    const raw = localStorage.getItem(offerKey());
    if (!raw) return { ...EMPTY_OFFER };
    const parsed = JSON.parse(raw) as Partial<AdOffer>;
    return {
      ...EMPTY_OFFER,
      ...parsed,
      // Coerce numerics defensively in case of older/partial saves.
      offerPrice: Number(parsed.offerPrice) || 0,
      closeRatePct: Number(parsed.closeRatePct) || 0,
      showRatePct: Number(parsed.showRatePct) || 0,
    };
  } catch {
    return { ...EMPTY_OFFER };
  }
}

export function saveOffer(offer: AdOffer): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(offerKey(), JSON.stringify(offer));
  } catch {
    // ignore quota
  }
}

// ── Ad check-ins (Adjustment Engine history) ───────────────────────

export interface AdCheckin {
  id: string;
  loggedAt: number;
  // Which post/reel this ad is running (free-form label, usually the
  // winner's cover hook).
  adLabel: string;
  dayOfTest: number;
  verdict: string; // verdict id, e.g. "scale"
  // Raw numbers the user pasted, kept so they can see the trend.
  spend: number;
  reach: number;
  threeSecViews: number;
  linkClicks: number;
  profileVisits: number;
  leads: number;
  callsBooked: number;
  clients: number;
}

function checkinsKey(): string {
  return channelKey(getCurrentChannelId(), SUFFIX_CHECKINS);
}

export function loadCheckins(): AdCheckin[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(checkinsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is AdCheckin =>
        c && typeof c.id === "string" && typeof c.loggedAt === "number",
    );
  } catch {
    return [];
  }
}

export function addCheckin(c: Omit<AdCheckin, "id" | "loggedAt">): AdCheckin {
  const entry: AdCheckin = {
    ...c,
    id: `adck_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`,
    loggedAt: Date.now(),
  };
  // Keep the most recent 20 so the list doesn't grow unbounded.
  const next = [entry, ...loadCheckins()].slice(0, 20);
  if (isBrowser()) {
    try {
      localStorage.setItem(checkinsKey(), JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return entry;
}

export function deleteCheckin(id: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      checkinsKey(),
      JSON.stringify(loadCheckins().filter((c) => c.id !== id)),
    );
  } catch {
    // ignore
  }
}
