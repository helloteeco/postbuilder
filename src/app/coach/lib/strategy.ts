// Coach Mode strategy data + day-of-week rotation logic.
//
// All static — pillars, hook formulas, topic suggestions per pillar, plus
// helpers that turn a Date into "today's pillar / hook / topic candidates"
// and "the next 7 days' assignments".
//
// Pure functions only. No React, no localStorage. Safe to import from any
// component (server or client).

export interface Pillar {
  id: string;
  name: string;
  // Tailwind color fragment, e.g. "emerald-500". Use pillarColorClasses()
  // to get the safelist-friendly full class strings (bg-, text-, border-).
  color: string;
  description: string;
  // 8-12 topic ideas per pillar — the bank that getDailyTopics samples 5
  // from. Lives on the pillar so a custom pillar travels with its topics.
  topics: string[];
}

export const PILLARS: Pillar[] = [
  {
    id: "tax-money",
    name: "Tax & Money Strategy",
    color: "emerald-500",
    description:
      "Tax loopholes, depreciation, the math behind the wealth-build, and why W2 high-earners need real estate now.",
    topics: [
      "Trump's Big Beautiful Bill restored 100% bonus depreciation",
      "The STR loophole explained for high earners",
      "Stay at home moms unlock the STR tax loophole",
      "Stacking 3-4 properties for near-zero federal tax",
      "Cost segregation walkthrough on a $250K property",
      "How the IRS refund covers your 10% down payment",
      "Why W2 earners need real estate before AI takes their job",
      "The depreciation math most CPAs don't explain",
      "Pharmacist/doctor pivot to passive income",
      "Why renting is more expensive than owning in 2026",
    ],
  },
  {
    id: "market-deal",
    name: "Market & Deal Selection",
    color: "blue-500",
    description:
      "Which markets to buy, the buy-box criteria, comp analysis, and where smart money is moving.",
    topics: [
      "6 rural markets I'd actually buy in 2026",
      "Best small towns near national parks for STRs",
      "10 affordable military base towns",
      "Markets to avoid (heavily regulated cities)",
      "How to analyze a rural market in 30 minutes",
      "Buy box checklist for rural Airbnbs",
      "The $250K/3-4 bed/12+ sleeps formula",
      "Why drive-to markets beat fly-to markets",
      "AirDNA 2026 outlook key takeaways",
      "Where the smart money is buying right now",
    ],
  },
  {
    id: "ops-systems",
    name: "Operations & Systems",
    color: "purple-500",
    description:
      "How to run a portfolio with 3 hours a week — team, tools, AI stack, and remote operating systems.",
    topics: [
      "The 7 people running my 50 rural Airbnbs",
      "AI tools for Airbnb hosts (HostBuddy, PriceLabs, etc.)",
      "3 hours a week to run a portfolio",
      "The first 4 hires for your first property",
      "How to build a remote operating system",
      "Photolab.teeco.co for listing photos",
      "Edge.teeco.co for market analysis",
      "Self-managing vs hiring a property manager",
      "Tools that pay for themselves in week 1",
      "The team structure for 1, 5, and 50 properties",
    ],
  },
  {
    id: "client-wins",
    name: "Client Wins & Proof",
    color: "amber-500",
    description:
      "Real client revenue, before/afters, transformation case studies, and proof that the system works.",
    topics: [
      "Rick's $28K month on a 1300 sqft cabin",
      "Roeben's Wolfsong Ridge $18K July",
      "Friend's $4,371 booking story",
      "Before/after a Teeco design transformation",
      "Client transitioning from W2 to first property",
      "Repeat client buying property #2",
      "A client's 12-month transformation",
      "The first month story (revenue + lessons)",
      "A client doubling revenue with design changes",
      "The $20K to $70K transformation case study",
    ],
  },
  {
    id: "personal-story",
    name: "Personal Story & Identity",
    color: "rose-500",
    description:
      "Why I quit pharmacy, the story behind the first cabin, freedom, family, and what the journey actually looks like.",
    topics: [
      "Why I quit my 6-figure pharmacy career",
      "28 days a month working as a travel pharmacist",
      "$150K student loans and the sunk cost trap",
      "The first cabin in Joshua Tree",
      "The $12K month that changed my brain",
      "Working out 5 days a week while running 50 properties",
      "My fiance, friends, family, and what freedom means",
      "Coaching, acquiring, designing, managing — all 4",
      "The Detroit property journey",
      "Why I bet on rural over cities",
    ],
  },
];

// Lazy resolver — when the user has saved custom pillars in localStorage,
// we want the rest of the module to read from those. The customization
// module fills this in at app init (see customization.ts:installCustomData).
// Defaults to the built-in PILLARS list.
let effectivePillarsRef: Pillar[] = PILLARS;

export function getEffectivePillars(): Pillar[] {
  return effectivePillarsRef;
}

export function setEffectivePillars(next: Pillar[] | null): void {
  effectivePillarsRef = next && next.length > 0 ? next : PILLARS;
}

export function getPillarById(id: string): Pillar | undefined {
  return getEffectivePillars().find((p) => p.id === id);
}

// "am" = primary post (~8-10 AM), "pm" = optional second post (~6-9 PM).
// Spaced 8-12 hours apart, well within the 6-18 hour gap that keeps two
// daily posts from cannibalizing each other's reach.
export type Slot = "am" | "pm";

export const SLOT_POST_WINDOW: Record<Slot, string> = {
  am: "8-10 AM",
  pm: "6-9 PM",
};

// Day-of-week × slot → pillar id map. JS Date.getDay() returns 0=Sun…6=Sat.
// AM and PM intentionally use different pillars so a 2x/day creator doesn't
// post the same pillar back-to-back; across the week each pillar lands 2-3
// times across the 14 slots.
export type Rotation = {
  am: Record<number, string>;
  pm: Record<number, string>;
};

export const DEFAULT_ROTATION: Rotation = {
  am: {
    1: "tax-money",       // Mon AM
    2: "market-deal",     // Tue AM
    3: "client-wins",     // Wed AM
    4: "ops-systems",     // Thu AM
    5: "tax-money",       // Fri AM (second Tax post of the week)
    6: "market-deal",     // Sat AM (second Market post of the week)
    0: "personal-story",  // Sun AM
  },
  pm: {
    1: "personal-story",  // Mon PM
    2: "ops-systems",     // Tue PM
    3: "market-deal",     // Wed PM
    4: "client-wins",     // Thu PM
    5: "personal-story",  // Fri PM
    6: "client-wins",     // Sat PM
    0: "ops-systems",     // Sun PM
  },
};

let effectiveRotationRef: Rotation = DEFAULT_ROTATION;

export function getEffectiveRotation(): Rotation {
  return effectiveRotationRef;
}

export function setEffectiveRotation(next: Rotation | null): void {
  effectiveRotationRef = next ?? DEFAULT_ROTATION;
}

export function getPillarForSlot(date: Date, slot: Slot): Pillar {
  const rotation = getEffectiveRotation();
  const map = slot === "am" ? rotation.am : rotation.pm;
  const id = map[date.getDay()] ?? getEffectivePillars()[0]?.id ?? "personal-story";
  // Fall back gracefully if the schedule references a pillar that was
  // deleted from the user's custom list.
  return getPillarById(id) ?? getEffectivePillars()[0] ?? PILLARS[0];
}

// Backwards-compatible alias used by Section A (Today's Plan) — defaults
// to the primary AM slot.
export function getPillarForDate(date: Date): Pillar {
  return getPillarForSlot(date, "am");
}

export interface HookFormula {
  id: string;
  template: string;
  // Day-of-week (0=Sun..6=Sat) this formula is the recommended pick for.
  dayOfWeek: number;
}

export const HOOK_FORMULAS: HookFormula[] = [
  {
    id: "authority",
    template:
      "[Authority figure] just did [thing]. Here's what it means for [audience].",
    dayOfWeek: 1, // Mon
  },
  {
    id: "data-shift",
    template:
      "[News/data] proves [old strategy] is dead. [New strategy] is winning.",
    dayOfWeek: 2, // Tue
  },
  {
    id: "specific-result",
    template:
      "[Specific number] of [outcome] in [timeframe]. Here's exactly how.",
    dayOfWeek: 3, // Wed
  },
  {
    id: "hidden-benefit",
    template:
      "[Specific person archetype] unlocks [benefit] most don't know about.",
    dayOfWeek: 4, // Thu
  },
  {
    id: "counter-truth",
    template:
      "[Counter-intuitive truth]. [Reframe of who's winning].",
    // Used Fri/Sat/Sun — picked when day-of-week is one of those.
    dayOfWeek: 5,
  },
];

export function getHookForDate(date: Date): HookFormula {
  const day = date.getDay();
  if (day === 1) return HOOK_FORMULAS[0];
  if (day === 2) return HOOK_FORMULAS[1];
  if (day === 3) return HOOK_FORMULAS[2];
  if (day === 4) return HOOK_FORMULAS[3];
  // Fri/Sat/Sun → counter-truth
  return HOOK_FORMULAS[4];
}

// Hook formula for a (date, slot) pair. AM uses the day's normal hook;
// PM rotates +2 in the formula list so the same day's two posts don't
// share a hook structure.
export function getHookForSlot(date: Date, slot: Slot): HookFormula {
  const am = getHookForDate(date);
  if (slot === "am") return am;
  const amIndex = HOOK_FORMULAS.findIndex((h) => h.id === am.id);
  const pmIndex = (amIndex + 2) % HOOK_FORMULAS.length;
  return HOOK_FORMULAS[pmIndex];
}

// Returns N topics from the given pillar's bank, never duplicating. Stable
// for the same (date, pillarId) pair so the dashboard doesn't reshuffle on
// every render — uses a tiny seeded shuffle keyed by yyyy-mm-dd + pillarId.
// Reads from the EFFECTIVE pillar list (custom-or-default), so users with
// their own pillars see their own topic banks.
export function getDailyTopics(
  date: Date,
  pillarId: string,
  count = 5,
): string[] {
  const pillar = getPillarById(pillarId);
  const bank = pillar?.topics ?? [];
  if (bank.length === 0) return [];
  const seed = `${date.toISOString().slice(0, 10)}-${pillarId}`;
  return seededShuffle(bank, seed).slice(0, count);
}

// Cheap deterministic shuffle so daily topics don't reshuffle every render.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) | 0;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Map a pillar's color fragment to full Tailwind class strings. Spelling
// every class out keeps Tailwind's content scanner happy (no dynamic
// `bg-${color}` tricks, which the JIT can't see).
// Whitelist of pillar color fragments. Spelled out so Tailwind's JIT
// scanner can find every class. When users add custom pillars they pick
// from these colors only.
export const PILLAR_COLOR_OPTIONS = [
  "emerald-500",
  "blue-500",
  "purple-500",
  "amber-500",
  "rose-500",
  "teal-500",
  "indigo-500",
  "orange-500",
  "sky-500",
  "fuchsia-500",
] as const;

export function pillarColorClasses(color: string): {
  bg: string;
  bgSoft: string;
  text: string;
  border: string;
  ring: string;
} {
  switch (color) {
    case "emerald-500":
      return { bg: "bg-emerald-500", bgSoft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-500", ring: "ring-emerald-500/30" };
    case "blue-500":
      return { bg: "bg-blue-500", bgSoft: "bg-blue-50", text: "text-blue-700", border: "border-blue-500", ring: "ring-blue-500/30" };
    case "purple-500":
      return { bg: "bg-purple-500", bgSoft: "bg-purple-50", text: "text-purple-700", border: "border-purple-500", ring: "ring-purple-500/30" };
    case "amber-500":
      return { bg: "bg-amber-500", bgSoft: "bg-amber-50", text: "text-amber-700", border: "border-amber-500", ring: "ring-amber-500/30" };
    case "rose-500":
      return { bg: "bg-rose-500", bgSoft: "bg-rose-50", text: "text-rose-700", border: "border-rose-500", ring: "ring-rose-500/30" };
    case "teal-500":
      return { bg: "bg-teal-500", bgSoft: "bg-teal-50", text: "text-teal-700", border: "border-teal-500", ring: "ring-teal-500/30" };
    case "indigo-500":
      return { bg: "bg-indigo-500", bgSoft: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-500", ring: "ring-indigo-500/30" };
    case "orange-500":
      return { bg: "bg-orange-500", bgSoft: "bg-orange-50", text: "text-orange-700", border: "border-orange-500", ring: "ring-orange-500/30" };
    case "sky-500":
      return { bg: "bg-sky-500", bgSoft: "bg-sky-50", text: "text-sky-700", border: "border-sky-500", ring: "ring-sky-500/30" };
    case "fuchsia-500":
      return { bg: "bg-fuchsia-500", bgSoft: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-500", ring: "ring-fuchsia-500/30" };
    default:
      return { bg: "bg-gray-500", bgSoft: "bg-gray-50", text: "text-gray-700", border: "border-gray-500", ring: "ring-gray-500/30" };
  }
}

// Builds the next N days starting at `start`, each tagged with both
// AM and PM pillar assignments. Used by the 7-day calendar.
export interface DayPlan {
  date: Date;
  amPillar: Pillar;
  pmPillar: Pillar;
  isToday: boolean;
}

export function getNextDays(start: Date, count = 7): DayPlan[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DayPlan[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    out.push({
      date: d,
      amPillar: getPillarForSlot(d, "am"),
      pmPillar: getPillarForSlot(d, "pm"),
      isToday: d.getTime() === today.getTime(),
    });
  }
  return out;
}

// Settings the user copies into the Post Builder when they go to write.
// Editable per user via the customization editor — defaults match the
// Dr. Jeff seed.
export interface CoachSettings {
  slideCount: number;
  readingLevel: string;
  audience: string;
  tone: string;
}

export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  slideCount: 10,
  readingLevel: "3rd grade",
  audience: "high income earners with $65k saved",
  tone: "confident, direct, no-fluff",
};

let effectiveSettingsRef: CoachSettings = DEFAULT_COACH_SETTINGS;

export function getEffectiveSettings(): CoachSettings {
  return effectiveSettingsRef;
}

export function setEffectiveSettings(next: CoachSettings | null): void {
  effectiveSettingsRef = next ?? DEFAULT_COACH_SETTINGS;
}

// Deprecated: kept as an alias for callers that haven't migrated to
// getEffectiveSettings(). Always reflects the current (possibly customized)
// values, so nothing breaks if a stale import lingers.
export const LOCKED_POST_BUILDER_SETTINGS = new Proxy({} as CoachSettings, {
  get(_, key: string) {
    return getEffectiveSettings()[key as keyof CoachSettings];
  },
});
