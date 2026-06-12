// Adapter: convert a ReelVariation into the SlideContent[] shape Coach
// Mode expects. Used when the user clicks "Send to tracker" on a reel
// card — the same handoff Post Builder uses for carousels, but tuned
// for the reel's hook+caption structure.
//
// Mapping rules:
//   • Slide 1 (isHook): the on-screen reel headline + subtitle. This
//     is what a viewer actually sees on the cover, and it's the hook
//     Coach Mode's contentAnalysis fingerprints for hook style.
//   • Slides 2..N: each section of the long-form caption, split on
//     blank lines. Captions are written in numbered/bulleted list
//     format per the API spec, so blank-line splitting naturally
//     mirrors what would be slide 2 / 3 / 4... in a carousel.
//   • Slide N (isCTA): the LAST caption section gets the CTA flag —
//     in the API spec this is reserved for the CTA paragraph that
//     mirrors section 10 of the original ghostwriter output.
//
// Result feeds straight into addPendingDraft() the same way
// slidesFromPostBuilder() does for carousels, so Coach Mode runs the
// exact same structural-fingerprint pipeline (format type, hook
// style, named entities, bolded terms, CTA pattern) on reels.

import type { SlideContent } from "@/app/coach/lib/storage";
import type { ReelVariation } from "./reelTemplate";

export function slidesFromReel(variation: ReelVariation): SlideContent[] {
  const hookText = [variation.hookHeadline, variation.hookSubtitle]
    .filter((s) => s && s.trim())
    .join("\n");

  // Split caption on 2+ consecutive newlines = paragraph / section
  // breaks. Single-newline breaks within a section (e.g. between
  // bullets in a numbered list) stay together as one slide's worth
  // of body content — that mirrors how Coach Mode treats a multi-
  // bullet criteria slide.
  const captionChunks = variation.caption
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const slides: SlideContent[] = [
    { slideNumber: 1, text: hookText, isHook: true },
  ];

  captionChunks.forEach((chunk, i) => {
    const isLast = i === captionChunks.length - 1;
    slides.push({
      slideNumber: slides.length + 1,
      text: chunk,
      isCTA: isLast,
    });
  });

  return slides;
}
