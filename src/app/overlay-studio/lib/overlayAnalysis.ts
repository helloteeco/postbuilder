// Overlay Studio — auto placement + contrast analysis. Per the spec
// (§9), each photo gets analyzed when it lands so the first overlay
// the user sees is already in the cleanest spot in the right color.
// User can override everything in the auditor; this just keeps them
// from staring at a blank starting state.
//
// Algorithm:
//   1. Downscale the image to ~80px wide on an offscreen canvas.
//   2. Compute mean + std-dev of luminance (per ITU-R BT.709) for
//      three horizontal bands: top (0–34%), center (33–67%), bottom
//      (66–100%).
//   3. Pick the cleanest band = lowest std-dev, with a placement
//      penalty {top:0, center:6, bottom:18} — avoid the bottom
//      because Instagram's caption preview sits there.
//   4. Text color: chosen band mean < 128 → light (white) text;
//      else dark (black). Yellow stays a manual option.

import type { AutoAnalysis } from "./overlayTypes";

const PENALTY = { top: 0, center: 6, bottom: 18 } as const;

interface BandStat {
  band: "top" | "center" | "bottom";
  mean: number;
  std: number;
}

export async function analyzeImage(dataUrl: string): Promise<AutoAnalysis> {
  // Defensive fallback if anything goes sideways — return a sane
  // default so the auditor still renders.
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const w = 80;
    const h = Math.max(1, Math.round((img.height / img.width) * w));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { band: "bottom", color: "light" };
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const bands: BandStat[] = [
      sample(data, w, h, 0, 0.34, "top"),
      sample(data, w, h, 0.33, 0.67, "center"),
      sample(data, w, h, 0.66, 1.0, "bottom"),
    ];

    let best = bands[0];
    let bestScore = best.std + PENALTY[best.band];
    for (const b of bands) {
      const score = b.std + PENALTY[b.band];
      if (score < bestScore) {
        best = b;
        bestScore = score;
      }
    }
    return {
      band: best.band,
      color: best.mean < 128 ? "light" : "dark",
    };
  } catch {
    return { band: "bottom", color: "light" };
  }
}

function sample(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  yStartFrac: number,
  yEndFrac: number,
  band: "top" | "center" | "bottom",
): BandStat {
  const y0 = Math.max(0, Math.floor(h * yStartFrac));
  const y1 = Math.min(h, Math.ceil(h * yEndFrac));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // ITU-R BT.709 luminance.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
  }
  if (n === 0) return { band, mean: 128, std: 999 };
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { band, mean, std: Math.sqrt(variance) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// Map an analyzed band → a default 9-position. Top/center/bottom
// choose the centered slot in that band; the auditor lets the user
// move it.
export function defaultPositionForBand(
  band: "top" | "center" | "bottom",
): "TC" | "CC" | "BC" {
  if (band === "top") return "TC";
  if (band === "center") return "CC";
  return "BC";
}
