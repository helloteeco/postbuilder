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
   - Maximum 7 words
   - Maximum 40 characters
   - No individual word over 12 characters
   - Same hook formula style as the original section 1
   - Different angle from the other 2 variations

2. An optional subtitle
   - Maximum 60 characters
   - Reinforces the headline

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
- No bold/asterisk markdown — Instagram doesn't render it, so don't include ** in the caption (it's fine in the headline since the reel cover renders it visually)
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
      "hookHeadline": "string",
      "hookSubtitle": "string (use empty string if no subtitle)",
      "caption": "string"
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
