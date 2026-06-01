// Curated design tips for short-term rental hosts. Voice rules:
//   - 3rd grade reading level. Short words. Short sentences.
//   - lowercase first, jeff-style casual
//   - no em dashes, no en dashes. periods, arrows, line breaks only
//   - fun + memorable + tied to bookings or revenue when possible
//
// Used in two places:
//   1. pickTip(idx) seeds each imported photo's body field so the
//      slide editor isn't empty and the slide ships with something
//      useful out of the box.
//   2. composeWarmDesignCaption pulls 3 fresh tips for the caption's
//      "design moves that print money" section.

export const DESIGN_TIPS: string[] = [
  "warm bulbs over white ones. 2700k makes any room look like a hug. cool white = hospital.",
  "layer 3 lights per room. ceiling, lamp, accent. flat light = boring photos = scroll past.",
  "one big plant per room. real or fake. greenery breaks up the boring and photos love it.",
  "soft throws on every couch. guests grab them. photos sell them. low cost. high return.",
  "matching pillows in odd numbers. 3 or 5. even sets look like a hotel. odd sets feel like home.",
  "rugs that are too small kill the vibe. front legs of the couch should touch the rug. always.",
  "one big piece of art beats five small ones. eye lands. brain calms. listing feels expensive.",
  "kitchen needs one bowl of lemons or limes. costs $4. shows up in every photo. closes bookings.",
  "wood tones tie the room. mix max 2 woods. matchy matchy is fine here. random woods look messy.",
  "candles in groups of 3. one big, one medium, one small. instagram photo bait every time.",
  "bedding in cream or sage. white shows every stain. dark shows every wrinkle. middle ground wins.",
  "shower curtain is free real estate. one nice linen one beats every plastic one. guests notice.",
  "books on the coffee table say someone lives here. one design book, one travel book, one local.",
  "the entry is the first photo guests see. a bench, a mirror, a plant. that is the whole formula.",
  "hide the tv when its off. art mode on a samsung frame. or a slide panel. or a curtain. anything.",
  "every room needs one unexpected thing. a vintage chair. a weird lamp. people remember those.",
  "kitchen towels matching the dish towels matching the hand towels. tiny detail. huge feel.",
  "bath mats in pairs. one by the tub, one by the sink. guests notice when its missing.",
  "string lights outside add 30 minutes to every guest hangout. longer stays = better reviews.",
  "one big mirror per main room makes the space feel twice as big in photos. cheap upgrade.",
  "fresh flowers in the kitchen for booked weeks. a $12 bouquet earns you a 5 star review.",
  "throw pillows should be 22 inch minimum on a couch. tiny pillows look sad and cheap.",
  "matching nightstands beat fancy mismatched ones. symmetry feels safe. safe gets booked.",
  "white walls + warm wood + black hardware. boring formula. works every single time.",
  "the bed makes the bedroom. invest there first. linen sheets + a throw + a euro sham. done.",
];

// Stable per-index pick so different photos in the same carousel
// get different tips, but reloading the same project shows the same
// tip on the same slide (no randomness drift).
export function pickTip(index: number): string {
  if (DESIGN_TIPS.length === 0) return "";
  return DESIGN_TIPS[index % DESIGN_TIPS.length];
}

// Pull N distinct tips, offset by a seed so the caption section
// rotates as new batches are made.
export function pickTips(count: number, seed = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < count && i < DESIGN_TIPS.length; i++) {
    out.push(DESIGN_TIPS[(seed + i * 3) % DESIGN_TIPS.length]);
  }
  return out;
}
