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
}

export const PILLARS: Pillar[] = [
  {
    id: "tax-money",
    name: "Tax & Money Strategy",
    color: "emerald-500",
    description:
      "Tax loopholes, depreciation, the math behind the wealth-build, and why W2 high-earners need real estate now.",
  },
  {
    id: "market-deal",
    name: "Market & Deal Selection",
    color: "blue-500",
    description:
      "Which markets to buy, the buy-box criteria, comp analysis, and where smart money is moving.",
  },
  {
    id: "ops-systems",
    name: "Operations & Systems",
    color: "purple-500",
    description:
      "How to run a portfolio with 3 hours a week — team, tools, AI stack, and remote operating systems.",
  },
  {
    id: "client-wins",
    name: "Client Wins & Proof",
    color: "amber-500",
    description:
      "Real client revenue, before/afters, transformation case studies, and proof that the system works.",
  },
  {
    id: "personal-story",
    name: "Personal Story & Identity",
    color: "rose-500",
    description:
      "Why I quit pharmacy, the story behind the first cabin, freedom, family, and what the journey actually looks like.",
  },
];

export function getPillarById(id: string): Pillar | undefined {
  return PILLARS.find((p) => p.id === id);
}

// "am" = primary post (~8-10 AM), "pm" = optional second post (~6-9 PM).
// Spaced 8-12 hours apart, well within the 6-18 hour gap that keeps two
// daily posts from cannibalizing each other's reach.
export type Slot = "am" | "pm";

export const SLOT_POST_WINDOW: Record<Slot, string> = {
  am: "8-10 AM",
  pm: "6-9 PM",
};

// JS Date.getDay() returns 0=Sun, 1=Mon, … 6=Sat. Map each day to its
// primary (AM) and secondary (PM) pillar. Secondary is intentionally
// different from primary so a 2x/day creator doesn't post the same
// pillar back-to-back, and the week as a whole hits each pillar 2-3
// times across the 14 slots.
const DAY_TO_AM_PILLAR: Record<number, string> = {
  1: "tax-money",       // Mon AM
  2: "market-deal",     // Tue AM
  3: "client-wins",     // Wed AM
  4: "ops-systems",     // Thu AM
  5: "tax-money",       // Fri AM (second Tax post of the week)
  6: "market-deal",     // Sat AM (second Market post of the week)
  0: "personal-story",  // Sun AM
};

const DAY_TO_PM_PILLAR: Record<number, string> = {
  1: "personal-story",  // Mon PM
  2: "ops-systems",     // Tue PM
  3: "market-deal",     // Wed PM
  4: "client-wins",     // Thu PM
  5: "personal-story",  // Fri PM
  6: "client-wins",     // Sat PM
  0: "ops-systems",     // Sun PM
};

export function getPillarForSlot(date: Date, slot: Slot): Pillar {
  const map = slot === "am" ? DAY_TO_AM_PILLAR : DAY_TO_PM_PILLAR;
  const id = map[date.getDay()] ?? "personal-story";
  return getPillarById(id) ?? PILLARS[0];
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

// Topic banks — exact list from the spec.
export const TOPICS_BY_PILLAR: Record<string, string[]> = {
  "tax-money": [
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
  "market-deal": [
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
  "ops-systems": [
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
  "client-wins": [
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
  "personal-story": [
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
};

// Returns N random topics from the given pillar's bank, never duplicating.
// Stable for the same (date, pillarId) pair so the dashboard doesn't reshuffle
// on every render — uses a tiny seeded shuffle keyed by yyyy-mm-dd + pillarId.
export function getDailyTopics(
  date: Date,
  pillarId: string,
  count = 5,
): string[] {
  const bank = TOPICS_BY_PILLAR[pillarId] ?? [];
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
export function pillarColorClasses(color: string): {
  bg: string;
  bgSoft: string;
  text: string;
  border: string;
  ring: string;
} {
  switch (color) {
    case "emerald-500":
      return {
        bg: "bg-emerald-500",
        bgSoft: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-500",
        ring: "ring-emerald-500/30",
      };
    case "blue-500":
      return {
        bg: "bg-blue-500",
        bgSoft: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-500",
        ring: "ring-blue-500/30",
      };
    case "purple-500":
      return {
        bg: "bg-purple-500",
        bgSoft: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-500",
        ring: "ring-purple-500/30",
      };
    case "amber-500":
      return {
        bg: "bg-amber-500",
        bgSoft: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-500",
        ring: "ring-amber-500/30",
      };
    case "rose-500":
      return {
        bg: "bg-rose-500",
        bgSoft: "bg-rose-50",
        text: "text-rose-700",
        border: "border-rose-500",
        ring: "ring-rose-500/30",
      };
    default:
      return {
        bg: "bg-gray-500",
        bgSoft: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-500",
        ring: "ring-gray-500/30",
      };
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

// Locked Post Builder settings shown in Today's Plan card. The Coach
// Mode is opinionated about what the user should always use.
export const LOCKED_POST_BUILDER_SETTINGS = {
  slideCount: 10,
  readingLevel: "3rd grade",
  audience: "high income earners with $65k saved",
  tone: "confident, direct, no-fluff",
} as const;
