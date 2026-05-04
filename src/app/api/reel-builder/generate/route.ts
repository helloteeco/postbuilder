// Server route for the Reel Builder. Takes the user's pasted 10-section
// ghostwriter output (the same kind of text they'd paste into Post
// Builder's "raw" mode) and returns 3 reel variations: each one an
// on-screen hook (headline + subtitle) plus a paired long-form
// Instagram caption.
//
// Locked-in voice rules per spec:
//   - 3rd grade reading level
//   - Confident, direct, no fluff
//   - No em dashes, no emojis, no hashtags
//   - No bold/asterisk markdown in the caption (IG ignores it)
//   - Short paragraphs, line breaks between list items
//   - Caption ≤2,200 chars hard, target 1,400-2,000
//   - Headline ≤7 words, ≤40 chars, no individual word over 12 chars
//   - Subtitle ≤60 chars
//
// Spec called for "claude-sonnet-4-5" — that ID doesn't exist in the
// 4.x family. Using the current Sonnet (4.6).

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReelGenerationResult } from "@/app/reel-builder/lib/reelTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateRequestBody {
  source: string;
}

interface GenerateOk {
  ok: true;
  result: ReelGenerationResult;
}

interface GenerateErr {
  ok: false;
  code: string;
  message: string;
  rawText?: string;
}

const SYSTEM_PROMPT = `You are remixing a 10-section Instagram carousel into an Instagram Reel + caption pair. The user is providing the full 10-section ghostwriter output from Claude. Your job is to produce 3 variations of a single-screen Reel with paired long-form captions.

INPUT: The user's 10-section ghostwriter output (sections 1-10).

OUTPUT: 3 reel variations. Each variation contains:

1. A hook headline (slide-1 cover style)
   - TARGET 32-38 characters (5-7 words) so it wraps cleanly into 3 BALANCED lines on the cover. 40 chars / 7 words is a hard cap, not a goal.
   - No individual word over 12 characters (longer words orphan a line and break the layout).
   - Same hook formula style as the original section 1.
   - Different angle from the other 2 variations.
   - FIT VERIFICATION before you output: the cover renders at 132pt on a 920px-wide canvas; each line fits ~12 characters. Mentally split your headline into the 3 lines it'd wrap to. Are they balanced? Is any single short word stranded? Does any word need to break across lines? If yes, rewrite — pick shorter synonyms, drop filler ("the", "a", "is"), or find a different angle that compresses cleaner. If you can't make a hook fit AND hit, change the angle, don't lengthen the hook.
   - REQUIRED: wrap 1-2 high-impact words in **double asterisks** so they render in the cover's accent color. Pick the words that ARE the hook — dollar amounts, percentages, specific numbers, surprise nouns, emotional triggers ($250K, hidden, never, free, secret, 16.4%, etc.). Never bold function words like "the", "is", "of". A headline with ZERO bolded words is invalid output.
   - REQUIRED: NO INSIDER JARGON. Write the headline so a viewer with zero context on the niche understands it instantly. Banned: niche acronyms (STR, ADR, RevPAR, OTA, PMS, ARV, BRRRR, COC, KPI, MQL, CAC, LTV, EBITDA, ROAS, NPS, etc.), industry shorthand ("the loophole", "1031", "buy box", "cap rate", "the stack") unless universally known to a non-specialist. Spelling the term in parentheses ("STR (short term rental)") is NOT a fix — it eats valuable hook space. Rephrase entirely. Prefer everyday brand names (Airbnb, Amazon, Google, Uber) and plain English (rental, guest, booking, customer, deal, profit) over insider terms. Bad: "8 things I learned starting my STR." Good: "8 things I learned hosting my first Airbnb." or "8 lessons from my first rental."

2. An optional subtitle
   - TARGET ≤45 characters to GUARANTEE single-line fit on the cover (rendered at 48pt across the 920px canvas). 60 chars is a hard cap and risks wrapping to 2 lines, which breaks the layout. Aim for ONE clean line.
   - Must ADD NEW VALUE — a sharper detail, specific number, date, or concrete payoff that the headline doesn't already say. Do NOT paraphrase the headline. If the subtitle would just be a rephrase, OMIT it (set hookSubtitle to empty string).
   - REQUIRED: if the subtitle has 1-2 standout words (numbers, dates, dollar amounts, key nouns), wrap them in **double asterisks** for accent-color rendering. Same selection rule as the headline. Skip the bolding if there's no obvious standout — better to have no bold than a forced one.
   - REQUIRED: NO INSIDER JARGON. Same rule as the headline — write for an outsider scrolling past. The CAPTION (below) may use precise industry terms once the reader has chosen to dig in, but the cover (headline + subtitle) is for attraction, not explanation.

3. A long-form caption (1,400-2,000 characters, hard cap 2,200)
   - Opens with a hook line that matches the on-screen reel headline (or paraphrases it tightly)
   - Body content: turn sections 2-9 of the original ghostwriter output into a numbered or bulleted list inside the caption, condensed for Instagram readability
   - Each item in the list is 1-3 sentences max
   - Keep all specific numbers, dollar amounts, percentages, named cities, named people, named brands from the original
   - Use the exact CTA from section 10 of the original output, verbatim
   - Close with a confident sign-off line

VOICE RULES (locked):
- 3rd grade reading level
- Confident, direct, no-fluff tone
- No em dashes (use periods, commas, colons)
- No emojis, no hashtags
- The headline + subtitle USE ** ** for bolding (rendered in accent color on the cover). The CAPTION does NOT use ** ** — Instagram doesn't render markdown in captions, so plain text only there.
- Short paragraphs and line breaks between list items for mobile readability
- Specific numbers, never rounded
- Stay under 2,200 characters total in the caption

ANGLE COVERAGE:
The 3 variations must cover three distinct angles drawn from this set: counter-intuitive, list-promise, specific-number, news-driven, question. Each variation gets ONE angle and the angles must differ across the three.

OUTPUT SHAPE — return ONLY this JSON, no commentary, no markdown fences:
{
  "variations": [
    {
      "angle": "counter-intuitive" | "list-promise" | "specific-number" | "news-driven" | "question",
      "hookHeadline": "string with **bold** spans on 1-2 high-impact words",
      "hookSubtitle": "string (use empty string if no subtitle), bold the standout word(s) if any",
      "caption": "string with NO ** ** markdown"
    },
    { ... },
    { ... }
  ]
}

Return the JSON only — no prose, no markdown fences, no preface.`;

function extractJson(text: string): ReelGenerationResult {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON object found in model response");
  }
  const parsed = JSON.parse(cleaned.slice(first, last + 1)) as ReelGenerationResult;
  if (!parsed.variations || !Array.isArray(parsed.variations)) {
    throw new Error("Response missing variations array");
  }
  // Defensively coerce types so downstream rendering doesn't crash on
  // a malformed entry.
  parsed.variations = parsed.variations.map((v) => ({
    angle: v.angle,
    hookHeadline: typeof v.hookHeadline === "string" ? v.hookHeadline : "",
    hookSubtitle: typeof v.hookSubtitle === "string" ? v.hookSubtitle : "",
    caption: typeof v.caption === "string" ? v.caption : "",
  }));
  return parsed;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json<GenerateErr>(
      {
        ok: false,
        code: "NO_KEY",
        message:
          "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local for local dev or Vercel → Settings → Environment Variables for deploys.",
      },
      { status: 500 },
    );
  }

  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json<GenerateErr>(
      { ok: false, code: "BAD_JSON", message: "Request body was not valid JSON." },
      { status: 400 },
    );
  }

  if (!body.source || !body.source.trim()) {
    return NextResponse.json<GenerateErr>(
      {
        ok: false,
        code: "NO_SOURCE",
        message: "Paste the 10-section ghostwriter output before generating.",
      },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here is the 10-section ghostwriter output to remix into 3 reel variations:\n\n${body.source.trim()}`,
            },
          ],
        },
      ],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    if (!text.trim()) {
      return NextResponse.json<GenerateErr>(
        {
          ok: false,
          code: "EMPTY_RESPONSE",
          message: "Claude returned no text. Try again.",
        },
        { status: 502 },
      );
    }

    let result: ReelGenerationResult;
    try {
      result = extractJson(text);
    } catch (err) {
      return NextResponse.json<GenerateErr>(
        {
          ok: false,
          code: "PARSE_FAILED",
          message: `Could not parse Claude's response as JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
          rawText: text.slice(0, 2000),
        },
        { status: 502 },
      );
    }

    return NextResponse.json<GenerateOk>({ ok: true, result });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json<GenerateErr>(
        {
          ok: false,
          code: "AUTH_FAILED",
          message:
            "ANTHROPIC_API_KEY is set but invalid. Check the value in .env.local.",
        },
        { status: 401 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json<GenerateErr>(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Rate limit hit. Wait a few seconds and try again.",
        },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json<GenerateErr>(
        {
          ok: false,
          code: "API_ERROR",
          message: `Claude API error ${err.status}: ${err.message}`,
        },
        { status: 502 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<GenerateErr>(
      { ok: false, code: "UNKNOWN", message: msg },
      { status: 500 },
    );
  }
}
