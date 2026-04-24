import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { PostBuilderParams, RawCarouselPost } from "@/lib/post-templates";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeRequestBody {
  topic?: string;
  competitorText?: string;
  competitorImages?: string[]; // data URLs (data:image/png;base64,...)
  params: PostBuilderParams;
  // When user already has raw long-form content they wrote and want it
  // compressed into slides rather than analyzing a competitor.
  rawSource?: string;
}

function parseDataUrl(
  dataUrl: string,
): { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/.exec(
    dataUrl,
  );
  if (!m) return null;
  const raw = m[1] === "image/jpg" ? "image/jpeg" : m[1];
  return {
    mediaType: raw as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
    data: m[2],
  };
}

function buildSystemPrompt(params: PostBuilderParams): string {
  return `You are a ghost-writer for a top social media creator. You produce Instagram/Twitter carousel posts in the exact voice, structure, and compression of your client.

Your client's audience: ${params.audience}.
Your client's tone: ${params.tone}.
Reading level target: ${params.readingLevel}. Use short, plain words. No jargon. No fluff.

CARDINAL RULES — follow without exception:
1. Return ONLY valid JSON matching the schema shown below. No commentary before or after.
2. Produce no more than ${Math.min(params.slideCount, 10)} slides TOTAL. Never exceed 10. Produce fewer if the content doesn't need more.
3. Slide 1 is ALWAYS type "hook-opener". It is a COVER slide: one short headline + optional subtitle. Do NOT include items or footer on slide 1 — just the hook. The headline must stop the scroll on its own. Keep it under ~8 words. Treat slide 1 like a magazine cover, not a paragraph.
4. Final slide is always type "cta" — DM keyword, free resource, or clear next step.
5. Compress mercilessly. Each slide must be SCANNABLE in under 4 seconds.
6. Per-slide budgets (HARD LIMITS — never exceed):
   - Body text across a slide: under ~${params.maxCharsBody} characters TOTAL.
   - Bullets per slide: max ${params.maxBullets}.
   - Each bullet: under ~${params.maxCharsBullet} characters AND must fit on ONE LINE when rendered at 48px on a 920px-wide canvas. Roughly: if it's more than 6-7 words, it is too long.
   - Headlines (body slides): under ~60 characters. Under ~8 words.
   - Cover headline (slide 1): under ~50 characters. Under ~8 words. Punchy.
   - Paragraphs: under ~20 words each. Prefer 2-3 short paragraphs over one long one.
7. NEVER flood a slide. If a point needs more space, split it into another slide or cut the word count.
8. If the source copy is long, REWRITE — do not paraphrase. Your job is to cut, not to preserve.
9. Use the client's signature structure when relevant:
   - Cover slide (slide 1, hook-opener)
   - Personal story / credibility slide
   - Criteria / framework slide (bullets)
   - Repeated detail slides (ranked items with bullets + stats)
   - CTA slide (final slide)
10. Inline bold via **double asterisks** is REQUIRED on every slide. Pick 2-4 high-impact words or short phrases per slide and wrap them in ** ** to stop the scroll. On the cover (slide 1), bold the 1-3 words that are the whole point of the post (e.g. **$500K**, **hidden**, **actually buy**, **Passive Income**, **Overrated**). Never bold a whole sentence; bold the nouns and numbers inside it. IMPORTANT: Only ever use DOUBLE asterisks (**like this**) — never use single asterisks (*like this*) or any other markdown. If you want emphasis, always use ** **.
11. Numbers should feel specific, not rounded ($75,940 > "about $76K"). If the source gives a vague number, keep it vague — do not fabricate.

SLIDE TYPES (use the matching \`type\` field):
- "hook-opener": { headline: string; subtitle?: string; bg?: "white" | "yellow" | "dark" }   // COVER slide, slide 1 only. Just headline + optional one-line subtitle. Omit items/footer. You may pick bg: "white" (default), "yellow" (bright brand yellow), or "dark" (black bg, white text) based on the hook's energy — use "yellow" for celebratory/money hooks, "dark" for serious/contrarian hooks, "white" otherwise.
- "personal-story": { paragraphs: string[] }   // 2-5 short paragraphs, **bold** allowed
- "criteria-bullets": { heading: string; bullets: string[]; footer?: string }
- "market-detail": { rank: number; title: string; subtitle?: string; bullets: string[]; stats?: {label: string; value: string}[] }
- "numbered-list": { heading: string; items: string[] }
- "plain-text": { paragraphs: string[] }
- "cta": { paragraphs: string[] }   // **bold** the keyword/CTA phrase

OUTPUT SHAPE (exact keys, order does not matter):
{
  "slides": [
    { "type": "hook-opener", "headline": "...", "items": ["..."], "footer": ["..."] },
    ...
  ],
  "caption": "A 2-4 paragraph Instagram caption. Includes a hook, a short value stack, and ends with the DM keyword or CTA. Use plain line breaks. Do NOT include hashtags at the end — leave them out.",
  "hooks": [
    "Alt hook 1 (different angle)",
    "Alt hook 2 (different angle)",
    "Alt hook 3 (different angle)"
  ]
}

Return the JSON only — no prose, no markdown fences.`;
}

function buildUserPrompt(body: AnalyzeRequestBody): string {
  const lines: string[] = [];
  if (body.topic) {
    lines.push(`TOPIC / ANGLE: ${body.topic}`);
    lines.push("");
  }
  if (body.rawSource) {
    lines.push("SOURCE CONTENT (compress this into the carousel):");
    lines.push(body.rawSource);
    lines.push("");
  }
  if (body.competitorText) {
    lines.push("COMPETITOR POST (study the structure and angle; do NOT copy wording — rewrite in our voice):");
    lines.push(body.competitorText);
    lines.push("");
  }
  if (body.competitorImages && body.competitorImages.length > 0) {
    lines.push(
      "Competitor screenshots are attached below. Study their hook pattern, slide count, structure, and pacing — then produce OUR version on the same topic.",
    );
    lines.push("");
  }
  lines.push(
    `Produce the carousel now. Remember: exactly ${body.params.slideCount} slides if the content supports it, ${body.params.readingLevel} reading level, audience = ${body.params.audience}. Return JSON only.`,
  );
  return lines.join("\n");
}

function extractJson(text: string): RawCarouselPost {
  // Strip accidental markdown fences
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  // If the model added any prose, grab the outermost JSON object.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON object found in model response");
  }
  const slice = cleaned.slice(first, last + 1);
  const parsed = JSON.parse(slice) as RawCarouselPost;
  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error("Response missing slides array");
  }
  if (typeof parsed.caption !== "string") parsed.caption = "";
  if (!Array.isArray(parsed.hooks)) parsed.hooks = [];
  return parsed;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        code: "NO_KEY",
        message:
          "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local (for local dev) or Vercel → Project → Settings → Environment Variables (for deploys), then restart/redeploy.",
      },
      { status: 500 },
    );
  }

  let body: AnalyzeRequestBody;
  try {
    body = (await req.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_JSON", message: "Request body was not valid JSON." },
      { status: 400 },
    );
  }

  if (!body.params) {
    return NextResponse.json(
      { ok: false, code: "MISSING_PARAMS", message: "params field is required." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  // Build the content array — text first, then any attached images.
  const content: Anthropic.MessageParam["content"] = [
    { type: "text" as const, text: buildUserPrompt(body) },
  ];

  if (body.competitorImages) {
    for (const dataUrl of body.competitorImages) {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) continue;
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType,
          data: parsed.data,
        },
      });
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(body.params),
      messages: [{ role: "user", content }],
    });

    // Find the first text block in the response.
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    if (!text.trim()) {
      return NextResponse.json(
        {
          ok: false,
          code: "EMPTY_RESPONSE",
          message:
            "Claude returned no text. Try again, or reduce the number of attached images.",
        },
        { status: 502 },
      );
    }

    let result: RawCarouselPost;
    try {
      result = extractJson(text);
    } catch (err) {
      return NextResponse.json(
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

    return NextResponse.json({ ok: true, post: result });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
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
      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Rate limit hit. Wait a few seconds and try again.",
        },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          ok: false,
          code: "API_ERROR",
          message: `Claude API error ${err.status}: ${err.message}`,
        },
        { status: 502 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, code: "UNKNOWN", message: msg },
      { status: 500 },
    );
  }
}
