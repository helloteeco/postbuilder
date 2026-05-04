// Client-side wrapper around the /api/reel-builder/generate route.
// Handles JSON marshalling, error normalization, and the soft-cap
// truncation pass on returned captions so a single over-long
// generation doesn't render bad UI.

import {
  CAPTION_HARD_CAP,
  truncateAtSentence,
  type ReelGenerationResult,
} from "./reelTemplate";

interface ApiOk {
  ok: true;
  result: ReelGenerationResult;
}

interface ApiErr {
  ok: false;
  code: string;
  message: string;
  rawText?: string;
}

type ApiResponse = ApiOk | ApiErr;

export interface GenerateReelsResult {
  ok: boolean;
  result?: ReelGenerationResult;
  errorCode?: string;
  errorMessage?: string;
}

export async function generateReels(source: string): Promise<GenerateReelsResult> {
  const trimmed = source.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorCode: "EMPTY_SOURCE",
      errorMessage: "Paste the 10-section ghostwriter output before generating.",
    };
  }
  let resp: Response;
  try {
    resp = await fetch("/api/reel-builder/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: trimmed }),
    });
  } catch (err) {
    return {
      ok: false,
      errorCode: "NETWORK",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  let data: ApiResponse;
  try {
    data = (await resp.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      errorCode: "BAD_JSON",
      errorMessage: `Server returned non-JSON (status ${resp.status}).`,
    };
  }

  if (!data.ok) {
    return {
      ok: false,
      errorCode: data.code,
      errorMessage: data.message,
    };
  }

  // Defensive: enforce the hard cap on the client so a model overshoot
  // doesn't break the renderer or get the user shadowbanned for an
  // over-cap caption.
  const safeResult: ReelGenerationResult = {
    variations: data.result.variations.map((v) => ({
      ...v,
      caption:
        v.caption.length > CAPTION_HARD_CAP
          ? truncateAtSentence(v.caption, CAPTION_HARD_CAP)
          : v.caption,
    })),
  };

  return { ok: true, result: safeResult };
}
