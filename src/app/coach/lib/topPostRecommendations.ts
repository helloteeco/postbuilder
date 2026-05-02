// Static recommendation library used by Top Post Mode. When a post
// outperforms, we map its (pillarId, hookId) → these tables to suggest:
//   - 5 follow-up post ideas in the same pillar that extend the angle
//   - alternative hooks in the same family as the winning hook
//   - 5 amplification actions (ads, repurpose, collabs, etc.)
//
// Pure data — no React, no localStorage, safe to import anywhere.

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
