// OCR endpoint for Coach Mode's SlideCaptureModal upload tab.
//
// Accepts an array of image data URLs (one per carousel slide) and
// returns one extracted-text string per image, in the same order.
// Each image runs through Claude Haiku 4.5's vision capability with a
// strict OCR-only prompt — no summarization, no commentary, just the
// raw text exactly as it appears.
//
// Per-image extractions run in parallel (Promise.all). A 7-slide
// carousel takes ~3-5s end-to-end instead of ~14-21s sequential.
// Per-image failures degrade to empty strings rather than failing the
// whole batch, so one bad image doesn't kill the upload.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ExtractRequestBody {
  images: string[]; // data URLs, base64-encoded JPEG/PNG/GIF/WebP
}

interface ExtractOk {
  ok: true;
  texts: string[];
}

interface ExtractErr {
  ok: false;
  code: string;
  message: string;
}

const SYSTEM_PROMPT = `You are an OCR engine reading text off Instagram carousel slide images. Extract ALL visible text from the image exactly as it appears — headlines, subtitles, list items, body paragraphs, CTAs, anything text-like. Preserve line breaks where they appear in the image. Do NOT add commentary, do NOT summarize, do NOT paraphrase, do NOT label sections. Output only the raw text from the slide. If there is no readable text, output an empty response.`;

function parseDataUrl(
  dataUrl: string,
):
  | { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string }
  | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const raw = m[1] === "image/jpg" ? "image/jpeg" : m[1];
  return {
    mediaType: raw as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
    data: m[2],
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json<ExtractErr>(
      {
        ok: false,
        code: "NO_KEY",
        message:
          "ANTHROPIC_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  let body: ExtractRequestBody;
  try {
    body = (await req.json()) as ExtractRequestBody;
  } catch {
    return NextResponse.json<ExtractErr>(
      { ok: false, code: "BAD_JSON", message: "Request body was not valid JSON." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return NextResponse.json<ExtractErr>(
      { ok: false, code: "NO_IMAGES", message: "Provide at least one image." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  const texts = await Promise.all(
    body.images.map(async (dataUrl) => {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return "";
      try {
        const resp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: parsed.mediaType,
                    data: parsed.data,
                  },
                },
                {
                  type: "text",
                  text: "Extract all text from this carousel slide image.",
                },
              ],
            },
          ],
        });
        let text = "";
        for (const block of resp.content) {
          if (block.type === "text") text += block.text;
        }
        return text.trim();
      } catch {
        return "";
      }
    }),
  );

  return NextResponse.json<ExtractOk>({ ok: true, texts });
}
