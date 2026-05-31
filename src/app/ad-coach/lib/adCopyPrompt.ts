// Ad Coach — builds the copy-paste-ready Claude.ai prompt that writes
// the ad copy from a proven winner. Same philosophy as Coach Mode's
// PromptBuilder: zero API cost, the user pastes it into Claude.ai (or
// any AI chat) and gets back the copy. We assemble it from the
// winner's actual slide content + the user's offer + voice settings,
// so the ad is grounded in what already worked, not a fresh guess.

import { getEffectiveSettings } from "@/app/coach/lib/strategy";
import type { AdOffer } from "./adStorage";
import { CLOSE_METHOD_LABELS } from "./adStorage";
import { winnerHook, type AdWinner } from "./adWinners";

export function buildAdCopyPrompt(winner: AdWinner, offer: AdOffer): string {
  const settings = getEffectiveSettings();
  const hook = winnerHook(winner);

  // Pull the winner's slide-by-slide text so Claude grounds the ad in
  // the exact content that resonated organically.
  const slideText =
    winner.post.slides && winner.post.slides.length > 0
      ? winner.post.slides
          .map(
            (s) =>
              `Slide ${s.slideNumber}${s.isHook ? " (hook)" : s.isCTA ? " (CTA)" : ""}: ${s.text}`,
          )
          .join("\n")
      : "(No slide text captured — base the ad on the headline above.)";

  const offerLine =
    offer.offerName && offer.offerPrice > 0
      ? `${offer.offerName} (about $${offer.offerPrice.toLocaleString()})`
      : offer.offerName || "my offer";

  const closeLine = CLOSE_METHOD_LABELS[offer.closeMethod];

  const lines: string[] = [];
  lines.push(
    "You are writing Instagram ad copy for me. This ad will run a post that ALREADY performed well organically — so keep the voice and angle that worked, just sharpen it for paid traffic.",
    "",
    `MY VOICE / WHO I AM: ${settings.creatorIdentity}`,
    `MY AUDIENCE: ${settings.audience}`,
    `MY OFFER: ${offerLine}`,
    `HOW PEOPLE BUY: ${closeLine}`,
    "",
    "THE PROVEN POST THIS AD IS BASED ON:",
    `Cover hook: "${hook}"`,
    `Why it worked: ${winner.reason}.`,
    "",
    "Full slide content of the proven post:",
    slideText,
    "",
    "WRITE THE AD. Output exactly this, with each block clearly labeled so I can copy them one at a time:",
    "",
    "PRIMARY TEXT — 3 variations. Each one:",
    "- Opens with a scroll-stopping first line (the algorithm + the reader both judge the first line hardest).",
    "- 3rd-grade reading level. Short sentences. No jargon. No hype words like 'unlock', 'crush', 'game-changer'.",
    "- Sounds like a real person who has done the thing, not a guru. Specific numbers over vague claims. It's OK to be a little imperfect/honest.",
    "- Ends with ONE clear call to action that matches how people buy (above). No emojis, no hashtags.",
    "- 80-150 words each.",
    "",
    "HEADLINE — 1 short line (under 40 characters) for the ad headline field.",
    "",
    "CTA BUTTON — pick the best Meta CTA button for this offer (e.g. 'Learn more', 'Send message', 'Book now', 'Sign up') and say why in one line.",
    "",
    "Rules: no income promises, no 'guaranteed results', no fake urgency. Teach/show, don't pitch-scream. Keep my voice.",
  );

  return lines.join("\n");
}
