// Goal-driven story engine for Overlay Studio carousels.
//
// User picks a goal -> the engine produces a complete carousel arc:
//   slide 1     = a hook framed for the goal
//   slides 2..N-1 = "meat" tailored to the goal, rotated for variety
//   slide N     = goal-matched DM DESIGN CTA
//   caption    = long structured description for the goal
//   first comment = the DM redirect
//
// All copy is marketer-systematized but pulled from pools that rotate
// by seed so back-to-back posts never read the same. Voice rules:
//   - lowercase first, jeff style
//   - no em dashes, no en dashes
//   - 3rd grade reading level, short words, short sentences
//   - every CTA leads with DM DESIGN

import type {
  CarouselGoal,
  OverlayMedia,
  OverlaySettings,
  PresetKey,
} from "./overlayTypes";

export type { CarouselGoal };

export const GOAL_LABELS: Record<
  CarouselGoal,
  { label: string; tag: string; help: string }
> = {
  "design-tips": {
    label: "Design tips (saves)",
    tag: "broad reach",
    help: "Save-worthy quick wins. Best for top-of-funnel discovery posts.",
  },
  "before-after": {
    label: "Before / after reveal",
    tag: "wow factor",
    help: "Visual transformation arc. Best when you have actual before/after photos.",
  },
  mistakes: {
    label: "Mistakes hosts make",
    tag: "engagement",
    help: "Pattern-interrupt. Each slide names a mistake + the fix.",
  },
  "roi-proof": {
    label: "ROI / money math",
    tag: "buyer intent",
    help: "Numbers-heavy. Best for warm audiences who already follow you.",
  },
  "case-study": {
    label: "Case study breakdown",
    tag: "credibility",
    help: "One real listing. What we did. What it earned.",
  },
  process: {
    label: "Our process",
    tag: "conversion",
    help: "Walks a stranger from question to booked design call.",
  },
};

interface CopyPair {
  headline: string;
  body: string;
}

interface ScriptArc {
  hooks: CopyPair[]; // slide 1 — cover preset
  meat: CopyPair[]; // middle slides — rotated by index
  proofs: CopyPair[]; // stat preset slot (typically slide N-1)
  ctas: CopyPair[]; // slide N — cta preset
  captions: ((s: OverlaySettings) => string)[]; // long caption variants
  firstComments: string[]; // DM redirect lines
}

// ── Goal scripts ───────────────────────────────────────────────────

const TIPS: ScriptArc = {
  hooks: [
    {
      headline: "8 design rules that book more nights",
      body: "save this. your future bookings will thank you.",
    },
    {
      headline: "save this if your airbnb isnt booking",
      body: "boring formulas. wild results.",
    },
    {
      headline: "the design moves top hosts hide",
      body: "rules. not opinions. apply them.",
    },
    {
      headline: "what every top airbnb has in common",
      body: "8 things they all do. you can too.",
    },
    {
      headline: "the design playbook for higher ADR",
      body: "small moves. big nights.",
    },
  ],
  meat: [
    { headline: "warm light wins", body: "2700k bulbs only. cool white reads as hospital. warm reads as home." },
    { headline: "layer 3 lights per room", body: "ceiling lamp accent. flat light kills photos and bookings." },
    { headline: "one statement piece per room", body: "a chair. a plant. a lamp. give the eye a place to land." },
    { headline: "soft throws on every couch", body: "guests grab them. photos sell them. $40 each pays back fast." },
    { headline: "fresh flowers in the kitchen", body: "$12 a week per booked stay. earns 5 star reviews." },
    { headline: "matching nightstands always", body: "symmetry feels safe. safe feels like home. home gets booked." },
    { headline: "art bigger than you think", body: "one huge piece beats five small ones every time." },
    { headline: "fluffy white bath towels", body: "stacked 3 high. guests notice. listings glow." },
    { headline: "books on the coffee table", body: "one design. one travel. one local. says someone lives here." },
    { headline: "hide the tv when its off", body: "samsung frame or a curtain. blank black screens look sad." },
    { headline: "rugs the right size", body: "front legs of the couch touch the rug. always." },
    { headline: "linen sheets only", body: "cotton wrinkles. linen ages well. guests sleep better." },
  ],
  proofs: [
    { headline: "+$12,500 / yr", body: "$50 ADR bump x 250 nights. usually more." },
    { headline: "6 weeks to ROI", body: "design pays for itself fast. then upside forever." },
    { headline: "+47% bookings", body: "real number from a real listing we did." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to see if were a fit to design your high cash flow airbnb",
    },
    {
      headline: "DM DESIGN",
      body: "for a free pricing call. san diego local or remote anywhere.",
    },
    {
      headline: "comment DESIGN",
      body: "and i will dm you the full playbook + pricing",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "design is the difference between rented and remembered.",
      sub: "these are the moves top hosts run on every listing. boring. predictable. profitable.",
      lines: [
        "warm bulbs over white. 2700k makes every room look like home.",
        "layer 3 lights per room. one big piece of art. one throw per couch.",
        "fresh flowers in the kitchen. matching nightstands. linen on the bed.",
      ],
      roi: "design $50 ADR bump x 250 nights = $12,500 a year. pays back in 6 weeks.",
      s,
    }),
    (s) => warmCap({
      hook: "this is the airbnb design playbook.",
      sub: "no tricks. no trends. just the rules that make every room feel intentional.",
      lines: [
        "soft throws people grab. plants people remember. art big enough to land.",
        "warm light wins every photo. cool light loses every booking.",
        "the bowl of lemons in the kitchen costs $4 a week and shows up in every listing photo.",
      ],
      roi: "real number from a real listing we did. 47% more bookings 90 days after the refresh.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to see if were a fit to design your high cash flow airbnb 👇",
    "DM DESIGN for a free pricing call. san diego or remote anywhere 👇",
    "comment DESIGN and ill send the full playbook + pricing 👇",
  ],
};

const BA: ScriptArc = {
  hooks: [
    {
      headline: "$180 to $420 a night",
      body: "same airbnb. one design refresh. 9 months apart.",
    },
    {
      headline: "before and after a real design",
      body: "this is what 2 weeks of styling does to a listing.",
    },
    {
      headline: "this is what design ROI looks like",
      body: "swipe to see the receipts.",
    },
  ],
  meat: [
    { headline: "the entry", body: "before: blank wall. after: bench mirror plant. first photo guests see." },
    { headline: "the living room", body: "matched the wood tones. one big art piece. listing feels expensive now." },
    { headline: "the kitchen", body: "white + warm wood + a bowl of lemons. photo bait every booking." },
    { headline: "the primary bedroom", body: "linen sheets. layered lighting. one chair people sit in." },
    { headline: "the bath", body: "stacked towels. linen shower curtain. moody mirror. costs almost nothing." },
    { headline: "the patio", body: "string lights. one rug. two chairs people argue over." },
    { headline: "the small details", body: "books on the table. matching towels. real plants. tiny stuff. huge feel." },
    { headline: "the cover photo", body: "this is the shot that doubled the saves on the listing in week one." },
  ],
  proofs: [
    { headline: "+$240 / night", body: "ADR went from $180 to $420 after the refresh." },
    { headline: "+67% reviews", body: "5 star reviews more than doubled in 90 days." },
    { headline: "9 weeks to ROI", body: "total design cost paid back in nightly rate jumps." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to see if your listing has this potential",
    },
    {
      headline: "DM DESIGN",
      body: "for a free walk through of your listing photos",
    },
    {
      headline: "comment DESIGN",
      body: "and i will price a refresh for your listing",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "same airbnb. different listing. one design refresh in between.",
      sub: "this is what real airbnb design does to nightly rate and saves.",
      lines: [
        "we matched the wood tones. layered the lighting. added one statement piece per room.",
        "swapped cotton sheets for linen. cool bulbs for warm. blank walls for big art.",
        "every move was cheap on its own. together they pushed nightly rate from $180 to $420.",
      ],
      roi: "ADR up $240 a night. saves doubled. reviews jumped. design paid for itself in 9 weeks.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to see if your listing has this potential 👇",
    "DM DESIGN for a free walk through of your photos 👇",
    "comment DESIGN and ill price a refresh for your listing 👇",
  ],
};

const MISTAKES: ScriptArc = {
  hooks: [
    {
      headline: "8 reasons your airbnb isnt booking",
      body: "swipe. fix. watch your calendar fill.",
    },
    {
      headline: "stop doing this if you want bookings",
      body: "the design mistakes killing your nightly rate.",
    },
    {
      headline: "your listing has 1 of these",
      body: "probably more. heres how to fix each one.",
    },
  ],
  meat: [
    { headline: "cool white bulbs", body: "fix: 2700k warm bulbs. cozy reads as home. cold reads as motel." },
    { headline: "flat overhead light", body: "fix: layer 3 lights per room. one ceiling. one lamp. one accent." },
    { headline: "tiny art on big walls", body: "fix: one big piece. eye lands. brain calms. listing feels expensive." },
    { headline: "matching everything", body: "fix: one unexpected piece per room. a chair. a lamp. people remember those." },
    { headline: "rugs that are too small", body: "fix: front legs of the couch touch the rug. always. no exceptions." },
    { headline: "no throws or texture", body: "fix: one soft throw per couch. plus pillows in odd numbers." },
    { headline: "empty kitchen counter", body: "fix: a bowl of lemons. a board. a hand towel. signals life." },
    { headline: "blank tv on the wall", body: "fix: samsung frame in art mode. or a curtain. or a slide panel." },
  ],
  proofs: [
    { headline: "+47% bookings", body: "real lift from fixing the 8 mistakes on one real listing." },
    { headline: "-$300 to fix", body: "average cost to fix all 8. days not weeks." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to see how many of these your listing has",
    },
    {
      headline: "DM DESIGN",
      body: "for a 30 min audit of your current listing photos",
    },
    {
      headline: "comment DESIGN",
      body: "and ill walk through your listing on a free call",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "your airbnb isnt under booked. its under designed.",
      sub: "8 mistakes hosts make every day. easy to spot. easier to fix.",
      lines: [
        "cool bulbs in the kitchen. flat ceiling light in the living room. tiny art on big walls.",
        "rugs too small. couches with no throws. blank tv. empty counter. matching everything.",
        "any one of these costs you bookings. all of them together costs you the listing.",
      ],
      roi: "fixing the 8 on one of our listings lifted bookings 47% in 60 days. cost under $300.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to see how many your listing has 👇",
    "DM DESIGN for a free 30 min audit of your photos 👇",
    "comment DESIGN and ill walk your listing live 👇",
  ],
};

const ROI: ScriptArc = {
  hooks: [
    {
      headline: "$15k design = $50k more bookings",
      body: "the math no one shows you.",
    },
    {
      headline: "what an airbnb designer pays for",
      body: "spoiler: themself. fast.",
    },
    {
      headline: "design ROI isnt theory",
      body: "heres the actual math on one real listing.",
    },
  ],
  meat: [
    { headline: "the spend", body: "$15k average for a full design. furniture + styling + photography." },
    { headline: "the ADR bump", body: "$50 a night minimum. usually $80 to $200 after a real refresh." },
    { headline: "nights booked", body: "250 a year on a healthy listing. 320+ on a hot one." },
    { headline: "the math", body: "$50 x 250 = $12,500 more per year. forever." },
    { headline: "review lift", body: "5 star reviews mean top of search. top of search means more nights." },
    { headline: "longer stays", body: "designed listings book longer trips. fewer turnovers. lower cleaning cost." },
    { headline: "payback window", body: "6 weeks to make back $15k. then pure upside year after year." },
    { headline: "the comp", body: "you cant get this kind of return from a stock. you can from your airbnb." },
  ],
  proofs: [
    { headline: "+$12,500 / yr", body: "every year. forever. on one listing." },
    { headline: "6 weeks to ROI", body: "average payback window across our last 12 builds." },
    { headline: "+$240 / night", body: "biggest ADR jump we have shipped this year." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to run your numbers on a free call",
    },
    {
      headline: "DM DESIGN",
      body: "and ill build the ROI model for your listing",
    },
    {
      headline: "comment DESIGN",
      body: "for the pricing and the math on your listing",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "this is what an airbnb designer actually pays for.",
      sub: "themselves. usually in 6 weeks. then upside year after year.",
      lines: [
        "$15k average for a full design. furniture + styling + photography.",
        "ADR bump of $50 a night minimum. real refreshes do $80 to $200.",
        "$50 x 250 booked nights = $12,500 more per year on one listing. forever.",
      ],
      roi: "you cant get this return from a stock. you can from your airbnb. heres how the math works.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to run your numbers on a free call 👇",
    "DM DESIGN and ill build the ROI model for your listing 👇",
    "comment DESIGN for pricing and the math 👇",
  ],
};

const CASE: ScriptArc = {
  hooks: [
    {
      headline: "how we 2xd this listing",
      body: "90 days. one full design. real numbers inside.",
    },
    {
      headline: "$180 to $420 in 90 days",
      body: "what we changed. what it earned.",
    },
    {
      headline: "from rented to remembered",
      body: "this is what a real refresh looks like.",
    },
  ],
  meat: [
    { headline: "the brief", body: "host wanted higher ADR without raising the cleaning fee. solvable." },
    { headline: "the walk through", body: "we read the photos. we read the reviews. we read the bookings calendar." },
    { headline: "the mood board", body: "warm wood. soft white. brass accents. one moody bedroom." },
    { headline: "the buy list", body: "linen bedding. layered lights. one big art piece per room. plants." },
    { headline: "the install week", body: "5 days on site. 3 rooms staged. fresh photos shot day 5." },
    { headline: "the launch", body: "new photos uploaded. ADR bumped 20 percent. saves doubled by day 14." },
    { headline: "30 days later", body: "calendar full through quarter end. first 5 reviews all 5 stars." },
    { headline: "90 days later", body: "ADR settled at $420. up from $180. listing pays for the refresh and then some." },
  ],
  proofs: [
    { headline: "+$240 / night", body: "ADR went from $180 to $420 in 90 days." },
    { headline: "+93% saves", body: "saves nearly doubled within the first 2 weeks." },
    { headline: "9 weeks to ROI", body: "full design cost recovered through nightly rate jump." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to be the next case study",
    },
    {
      headline: "DM DESIGN",
      body: "for the full breakdown of this build",
    },
    {
      headline: "comment DESIGN",
      body: "and ill send you the case study deck",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "this is the real math from one real listing we designed this year.",
      sub: "no inflated numbers. no guru talk. just the receipts.",
      lines: [
        "ADR went from $180 to $420 in 90 days. saves nearly doubled in 2 weeks.",
        "we matched wood tones. layered the lighting. swapped the bedding. shot new photos.",
        "calendar booked through the quarter. first 5 reviews all 5 stars. pays for itself in 9 weeks.",
      ],
      roi: "this is what design ROI looks like when its done by people who book the math first.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to be the next case study 👇",
    "DM DESIGN for the full breakdown 👇",
    "comment DESIGN and ill send the case study deck 👇",
  ],
};

const PROCESS: ScriptArc = {
  hooks: [
    {
      headline: "how we design an airbnb",
      body: "from a phone call to a fully booked listing.",
    },
    {
      headline: "what working with us looks like",
      body: "start to finish. no surprises. real timelines.",
    },
    {
      headline: "design call to first booking",
      body: "the whole process. swipe through.",
    },
  ],
  meat: [
    { headline: "step 1: design call", body: "30 min free. we walk your photos with you and price the work." },
    { headline: "step 2: mood board", body: "we send a full vision board in your style. you approve before we buy." },
    { headline: "step 3: the buy list", body: "every chair. every lamp. every linen. priced and sourced." },
    { headline: "step 4: install week", body: "5 days on site if local. or shipped + coordinated if remote." },
    { headline: "step 5: photo refresh", body: "we shoot the new listing photos. you upload. saves climb." },
    { headline: "step 6: launch + tweak", body: "first 30 days we watch the data and adjust the listing." },
    { headline: "step 7: the lift", body: "ADR jumps. reviews land. calendar fills. design pays for itself." },
    { headline: "step 8: optional co host", body: "want us running the listing too? we offer cohosting on every build." },
  ],
  proofs: [
    { headline: "30 to 60 days", body: "typical timeline from design call to live listing." },
    { headline: "6 weeks to ROI", body: "average payback window after launch." },
  ],
  ctas: [
    {
      headline: "DM DESIGN",
      body: "to book your free 30 min call",
    },
    {
      headline: "DM DESIGN",
      body: "and ill walk you through pricing live",
    },
    {
      headline: "comment DESIGN",
      body: "for the calendar link and pricing",
    },
  ],
  captions: [
    (s) => warmCap({
      hook: "this is exactly what working with us looks like.",
      sub: "from the first call to a fully booked listing. no surprises. real timelines.",
      lines: [
        "step 1: 30 min free design call. we walk your photos and price the work.",
        "step 2: mood board you approve. step 3: full buy list. step 4: install week.",
        "step 5: new photos. step 6: launch + tweak. step 7: ADR jumps and calendar fills.",
      ],
      roi: "30 to 60 days from call to lift. 6 week average payback. cohosting available if you want us running it too.",
      s,
    }),
  ],
  firstComments: [
    "DM DESIGN to book your free 30 min call 👇",
    "DM DESIGN and ill walk you through pricing live 👇",
    "comment DESIGN for the calendar link 👇",
  ],
};

const SCRIPTS: Record<CarouselGoal, ScriptArc> = {
  "design-tips": TIPS,
  "before-after": BA,
  mistakes: MISTAKES,
  "roi-proof": ROI,
  "case-study": CASE,
  process: PROCESS,
};

// ── Helpers ────────────────────────────────────────────────────────

// Caption template used by every goal. Sections vary; structure is
// the same so every post reads like the same brand voice.
function warmCap(args: {
  hook: string;
  sub: string;
  lines: string[];
  roi: string;
  s: OverlaySettings;
}): string {
  const { hook, sub, lines, roi, s } = args;
  const keyword = (s.dmKeyword || "DESIGN").toUpperCase();
  const isLocal = s.audience === "local";
  const service = [
    "we run two playbooks:",
    isLocal
      ? "🏡 san diego: full local install. we walk your property, source, stage, photograph. you sleep."
      : "🏡 san diego local install if youre nearby. we walk your property and run the whole build.",
    isLocal
      ? "✈️ everywhere else: full remote setup. we design + ship + coordinate with your handyman. you sleep."
      : "✈️ remote anywhere: we design, ship, coordinate with your handyman. fully done for you.",
    "🛎️ co hosting available if you want us running the listing too.",
  ].join("\n");
  const cta = `DM ${keyword} to see if were a fit to design your high cash flow airbnb 👇`;
  return [hook, sub, lines.join("\n"), roi, service, cta]
    .filter(Boolean)
    .join("\n\n");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

// Stable seed per batch so the same upload session keeps consistent
// picks, but new batches (different listing or different day) rotate.
function batchSeed(s: OverlaySettings): number {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return hash(`${s.listingNickname}::${dayOfYear}::${s.goal}`);
}

// ── Public API ─────────────────────────────────────────────────────

// Pick the copy for a single slide based on the goal, preset, and the
// slide's position in the carousel. Slide 1 (cover) gets the hook;
// slide N (cta preset) gets the goal-matched CTA; stat preset slots
// get proof lines; everything else rotates through meat copy so 8
// middle slides don't repeat.
export function pickStoryCopy(
  goal: CarouselGoal,
  preset: PresetKey,
  slideIndex: number,
  settings: OverlaySettings,
): { headline: string; body: string } {
  const arc = SCRIPTS[goal];
  const seed = batchSeed(settings) + slideIndex;
  switch (preset) {
    case "cover":
      return pick(arc.hooks, seed);
    case "cta":
      return pick(arc.ctas, seed);
    case "stat":
      return pick(arc.proofs, seed);
    case "label": {
      const tag = String((slideIndex % 99) + 1).padStart(2, "0");
      return { headline: `DESIGN ${tag}`, body: arc.meat[slideIndex % arc.meat.length].headline };
    }
    case "before-after":
      // Before/After preset slots reuse the BA arc's meat regardless
      // of the user's selected goal — it's the slot that demands it.
      return BA.meat[slideIndex % BA.meat.length];
    case "tip":
    case "editorial":
    default:
      return pick(arc.meat, seed * 7 + slideIndex * 3);
  }
}

// Long caption for the post description, varied by seed.
export function pickStoryCaption(
  goal: CarouselGoal,
  settings: OverlaySettings,
): string {
  const arc = SCRIPTS[goal];
  const seed = batchSeed(settings);
  const builder = pick(arc.captions, seed);
  return builder(settings);
}

// Short DM redirect for the first comment.
export function pickStoryFirstComment(
  goal: CarouselGoal,
  settings: OverlaySettings,
): string {
  const arc = SCRIPTS[goal];
  const seed = batchSeed(settings);
  return pick(arc.firstComments, seed);
}

// Detect whether any media has been edited by the user. Used when the
// goal changes so we only auto-rewrite headlines/bodies the user
// hasn't customized — never overwriting their work.
export function isUntouched(
  media: OverlayMedia[],
  goal: CarouselGoal,
  settings: OverlaySettings,
  presetForIndex: (i: number) => PresetKey,
): boolean {
  for (let i = 0; i < media.length; i++) {
    const expected = pickStoryCopy(goal, presetForIndex(i), i, settings);
    if (media[i].headline && media[i].headline !== expected.headline) return false;
    if (media[i].body && media[i].body !== expected.body) return false;
  }
  return true;
}
