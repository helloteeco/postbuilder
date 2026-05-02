// Static recommendation library used by Top Post Mode. When a post
// outperforms, we map its (pillarId, hookId) → these tables to suggest:
//   - 5 follow-up post ideas in the same pillar that extend the angle
//   - alternative hooks in the same family as the winning hook
//   - 5 amplification actions (ads, repurpose, collabs, etc.)
//
// When contentAnalysis is available we ALSO call generateStructuralFollowUps
// below to bias the suggestions toward the actual structural pattern of
// the winning post (list format → more list ideas; math walkthrough →
// more math posts; etc.). The existing generic library is the fallback.
//
// Pure data + functions — no React, no localStorage.

import type { ContentAnalysis, ContentHookStyle } from "./storage";

export interface Recommendations {
  pillarFollowUps: Record<string, string[]>;     // 5 follow-up ideas per pillar
  hookFormulaExtensions: Record<string, string[]>; // alternative hooks in the same family
  amplificationActions: Record<string, string[]>;  // 5 actions per pillar
}

// Follow-up post ideas per pillar id. Each set extends the winning angle —
// the pattern that worked once is more likely to work again on adjacent
// topics. Keyed by the default pillar ids; if the user has custom pillars
// these tables won't have an entry and the modal falls back to "extend
// with the same pillar's existing topic bank".
export const PILLAR_FOLLOW_UPS: Record<string, string[]> = {
  "tax-money": [
    "X tax mistakes high earners make",
    "How [specific authority] just changed the rules",
    "X loopholes most CPAs don't explain",
    "Stack X properties for [outcome]",
    "X dollar move most W2 earners miss",
  ],
  "market-deal": [
    "X markets to AVOID in [year]",
    "X small towns nobody talks about",
    "X mistakes I made picking my first market",
    "X markets where the math has stopped working",
    "Top X markets ranked by [specific metric]",
  ],
  "ops-systems": [
    "X tools running my [number] properties",
    "X hires for [milestone]",
    "Day in the life: [number] hours running [number] properties",
    "X mistakes scaling from 1 to 10 properties",
    "X automations every host needs",
  ],
  "client-wins": [
    "[Client] just hit [milestone]. Here's the play.",
    "From [low number] to [high number] in [timeframe]",
    "The X moves this client made",
    "X clients, X months, X results",
    "Repeat clients are the only proof",
  ],
  "personal-story": [
    "X lessons from [number] years building",
    "What I'd tell my year-one self",
    "The moment everything changed",
    "X wins. X losses. Here are the losses.",
    "Why I left [previous career]",
  ],
};

// Alternative hooks in the same family as a winning hook. Helps the user
// vary the opener without losing the proven structure.
export const HOOK_FORMULA_EXTENSIONS: Record<string, string[]> = {
  authority: [
    "[Bigger authority] said [thing]. Here's the playbook for [audience].",
    "[Authority figure]'s [latest move] just opened [opportunity] for [audience].",
    "What [authority] gets right (and wrong) about [topic].",
  ],
  "data-shift": [
    "The [year] numbers say [old strategy] is gone. [New strategy] is taking over.",
    "[Stat] just flipped. Here's what it means for [audience].",
    "Smart money is moving from [old] → [new]. The data is clear.",
  ],
  "specific-result": [
    "[Number] days. [Outcome]. Here's exactly the steps.",
    "Hit [milestone] in [timeframe]. The non-obvious moves.",
    "From [start] to [end] in [time]. The 3 levers that mattered.",
  ],
  "hidden-benefit": [
    "[Archetype] gets [benefit] most miss — here's how.",
    "The [archetype] loophole nobody talks about.",
    "Why [archetype] are the new [thing] millionaires.",
  ],
  "counter-truth": [
    "Everyone is wrong about [topic]. Here's what's actually winning.",
    "[Conventional wisdom] is dead. [Reframe] is what works in [year].",
    "The opposite of [popular take] is true. Here's why.",
  ],
};

// Amplification moves per pillar. Each post that hits gets distributed
// further: ads, repurpose, story sequence, collab pitch. Tuned so the
// suggestions match the pillar's tone (Tax → ad targeting, Wins → DM
// the client, etc.).
export const AMPLIFICATION_ACTIONS: Record<string, string[]> = {
  "tax-money": [
    "Run as a $5-10/day Meta ad targeting high-income W2 zip codes",
    "Pin to profile for 30 days — wealth content gets repeat saves",
    "Repurpose into a 5-story sequence with a poll: \"Did you know this?\"",
    "Cut the strongest 2 lines into a Reel hook",
    "Use as ad creative for the next 30 days while it's still warm",
  ],
  "market-deal": [
    "Run as a $10/day ad geo-targeted to the specific markets mentioned",
    "Repost as carousel cover with a new subtitle 7 days later",
    "Turn into a 7-story sequence with a \"which would you buy?\" poll",
    "Tag the regional accounts (chambers, tourism boards) in a follow-up",
    "Pitch this angle to a real estate podcast as a guest segment",
  ],
  "ops-systems": [
    "Run as a $5/day ad targeting hosts in your follower base",
    "Cut into 3 carousel \"how-to\" follow-ups, one per tool",
    "Repurpose as a Reel showing the actual dashboards (screen record)",
    "Tag the tool accounts (PriceLabs, HostBuddy, etc.) in a follow-up",
    "Pin to profile + use as the opener for your next coaching email",
  ],
  "client-wins": [
    "DM the client and ask if they'll repost it (free amplification)",
    "Run as a $10/day ad with the client's number in the headline",
    "Turn into a 5-story sequence with the before/after photos",
    "Pitch a podcast guest spot featuring the client",
    "Use the win as the lead in your next sales call / coaching email",
  ],
  "personal-story": [
    "Repost on the anniversary of the moment with an updated reflection",
    "Cut into a 4-story sequence with a poll: \"Have you faced this?\"",
    "Pin to profile so cold visitors lead with the human story",
    "Pitch this as a guest essay or podcast intro segment",
    "Repurpose the strongest 30 seconds into a Reel — story content travels",
  ],
};

// ── Structural follow-ups (used when contentAnalysis is available) ────
//
// These are tuned to extend the actual pattern that worked, not just
// the metadata. Pillar id × format type → 5 specific follow-up ideas.
// Falls back to PILLAR_FOLLOW_UPS when no specialized table exists for
// a given (pillar, format) combo.

const STRUCTURAL_FOLLOW_UPS: Record<string, Record<string, string[]>> = {
  "market-deal": {
    list: [
      "5 markets to AVOID in 2026 (and why the math broke)",
      "Top 10 small towns nobody talks about for STRs",
      "7 mistakes I made picking my first market",
      "8 markets where the numbers stopped working",
      "12 rural markets ranked by gross-revenue-per-bed",
    ],
    math_walkthrough: [
      "The full math on a $250K cabin doing $96K gross",
      "4-property stack: the after-tax math nobody runs",
      "Cost-seg savings on a $300K rural buy — line by line",
      "Why a $185K cabin beats a $500K beach house (the math)",
      "Year-1 cash flow walkthrough on the last cabin I bought",
    ],
    contrarian: [
      "The cities everyone is buying are wrong for 2026",
      "Drive-to is dead in fly-to markets — except these 4",
      "Stop chasing Smokies. Start buying these instead.",
      "Why low-comp markets are NOT what you think",
      "$1M Joshua Tree is dead. $250K Cave City is winning.",
    ],
  },
  "tax-money": {
    math_walkthrough: [
      "Stack 4 properties for near-zero federal tax — the math",
      "$25K → $44K refund: the cost-seg breakdown",
      "STR loophole on a $250K buy: 3 numbers that matter",
      "How my $9K depreciation covered a $7K mortgage payment",
      "Bonus depreciation 2026: what $1 of bonus is actually worth",
    ],
    list: [
      "5 tax mistakes high earners make in their first year",
      "10 loopholes most CPAs don't explain (and the IRS hates)",
      "7 dollar moves W2 earners miss every year",
      "6 deductions that disappeared in 2026 (and 4 that came back)",
      "8 reasons your CPA isn't recommending real estate",
    ],
    contrarian: [
      "Why your 401(k) is worse than a single rental",
      "The IRS refund myth: it's actually the worst loan you'll ever make",
      "Roth IRA is overrated for high earners — here's what to do instead",
      "Stop maxing 401(k). Start doing this.",
      "W2 deductions are dead. Real estate deductions are alive.",
    ],
    news_driven: [
      "Trump just restored 100% bonus depreciation. Here's what it means.",
      "The 2026 tax bill rewrote the STR loophole. Read this.",
      "Section 179 changes: what high earners need to know now",
      "New IRS guidance on cost segregation — quick read",
      "What the 2026 tax bill means for your next property",
    ],
  },
  "ops-systems": {
    list: [
      "8 tools running my 50 rural Airbnbs",
      "5 hires for your first property (and the order)",
      "10 automations every host should set up week 1",
      "7 mistakes scaling from 1 to 10 properties",
      "12 dashboards I check every Monday",
    ],
    framework: [
      "The 4-trait framework for hiring your first VA",
      "5 rules for running 50 properties with 7 people",
      "The 6 systems that turn a portfolio into a business",
      "Day-in-the-life: 3 hours, 50 properties, 7 systems",
      "The 5-step audit every operator should run quarterly",
    ],
  },
  "client-wins": {
    before_after: [
      "Rick: $4K → $28K/month in 6 months — the playbook",
      "Roeben: 1300 sqft cabin to $18K July — what changed",
      "Friend's $4,371 booking story (and the 3 design moves)",
      "$20K → $70K/year transformation: line-item walkthrough",
      "Before/after: same property, +$36K from one weekend",
    ],
    math_walkthrough: [
      "Client hit $96K gross — here's the full P&L",
      "From $1,800/mo to $5,200/mo: the math behind the design lift",
      "Repeat client's property #2 numbers vs property #1",
      "12 months later: Rick's actual return on the $250K cabin",
      "$28K month breakdown: ADR × occupancy × seasonality",
    ],
    list: [
      "5 client wins that changed how I coach",
      "8 moves this client made in 90 days",
      "10 transformation case studies from 2026",
      "7 design decisions that doubled revenue",
      "6 clients who replaced their W2 — what they had in common",
    ],
  },
  "personal-story": {
    story: [
      "What I'd tell my year-one self about leaving pharmacy",
      "The moment everything changed — Joshua Tree, January",
      "$150K student loans and the night I decided",
      "The first cabin: things broke, money came in anyway",
      "Pueblo to Salida: the 3-hour drives that built the portfolio",
    ],
    contrarian: [
      "Why I quit a 6-figure career to buy cabins",
      "The pharmacy school sunk-cost trap (and how I escaped)",
      "Stop saving 401(k). Start buying.",
      "Why renting is more expensive than owning in 2026",
      "Everyone says diversify. I went all in on rural STRs.",
    ],
  },
};

// Variants per hook style — alternate openers in the same family. Used
// alongside the existing HOOK_FORMULA_EXTENSIONS table when contentAnalysis
// is available.
const STRUCTURAL_HOOK_VARIANTS: Record<ContentHookStyle, string[]> = {
  list_promise: [
    "X [things] [authority] doesn't want you to know",
    "X [things] that prove [contrarian truth]",
    "X [things] running my [scale]",
    "X [things] I'd buy in [year]",
  ],
  specific_number: [
    "$X in [timeframe]: the breakdown",
    "$X [outcome]: how it actually worked",
    "$X → $Y in [N] days. Here's the playbook.",
    "[N]% of my [thing] comes from [source] — the math",
  ],
  counter_intuitive: [
    "Everyone is wrong about [topic] — here's what's actually winning",
    "[Conventional wisdom] is dead. [Reframe] is what works in [year].",
    "Stop [popular action]. Start [the real move].",
    "The opposite of [popular take] is true.",
  ],
  news_driven: [
    "[Authority] just did [thing]. Here's what it means for [audience].",
    "[Stat] just flipped. Here's the playbook for [audience].",
    "[Year] data shows [shift]. Here's what to do.",
  ],
  question: [
    "What if [conventional truth] is wrong?",
    "Why is [phenomenon] happening — and what now?",
    "Are you making [common mistake]?",
  ],
  unknown: [],
};

// Returns up to 5 follow-up ideas tuned to the structural pattern of
// the winning post. Falls back to the generic pillar library when no
// specialized combo exists.
export function generateStructuralFollowUps(
  pillarId: string,
  analysis: ContentAnalysis,
): string[] {
  const byFormat = STRUCTURAL_FOLLOW_UPS[pillarId]?.[analysis.formatType];
  if (byFormat && byFormat.length > 0) return byFormat.slice(0, 5);

  // No specialized combo — fall back to the generic pillar list.
  const generic = PILLAR_FOLLOW_UPS[pillarId];
  if (generic && generic.length > 0) return generic.slice(0, 5);

  return [];
}

export function getStructuralHookVariants(
  hookStyle: ContentHookStyle,
): string[] {
  return STRUCTURAL_HOOK_VARIANTS[hookStyle] ?? [];
}
