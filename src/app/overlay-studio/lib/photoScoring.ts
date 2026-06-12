// Per-photo quality scorer used by the URL importer to rank candidate
// images. Three signals, then a small "earlier in listing" bonus
// because hosts usually front-load their best shots (we don't trust
// it fully — many listings dump random photos first).
//
//   - Sharpness: variance of pixel-to-pixel luminance differences on
//     a 200px downscale. Blurry / out-of-focus photos collapse this.
//   - Brightness: mean luminance. Penalize too dark (<55) and blown
//     out (>215) — both signal a bad photo for a design carousel.
//   - Aspect: prefer photos that fit a 4:5 or 9:16 frame without
//     extreme cropping. Square is fine. Letterbox is not.
//
// Returns a 0-100 composite. The caller decides the cutoff.

export interface PhotoScore {
  sharpness: number; // raw variance (~0–4000+)
  brightness: number; // 0–255 mean luminance
  aspectFit: number; // 0–1, 1 = perfect fit
  score: number; // 0–100 composite
  width: number;
  height: number;
}

export async function scorePhoto(
  dataUrl: string,
  targetAspect: number, // e.g. 1080/1350 = 0.8 for post, 1080/1920 = 0.5625 for reel
  positionBonus = 0,
): Promise<PhotoScore> {
  const img = await loadImage(dataUrl);
  const longest = 200;
  const ratio = Math.min(longest / img.width, longest / img.height, 1);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      sharpness: 0,
      brightness: 128,
      aspectFit: 0,
      score: 0,
      width: img.width,
      height: img.height,
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Convert to a luminance array, then sample neighbor diffs.
  const lum = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    lum[j] = l;
    sum += l;
  }
  const brightness = sum / (w * h);

  // Sharpness = mean squared diff between each pixel and its right /
  // bottom neighbor (cheap proxy for Laplacian variance).
  let sharpSum = 0;
  let sharpN = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const dx = lum[i] - lum[i + 1];
      const dy = lum[i] - lum[i + w];
      sharpSum += dx * dx + dy * dy;
      sharpN += 2;
    }
  }
  const sharpness = sharpN > 0 ? sharpSum / sharpN : 0;

  // Aspect fit: how much of the photo survives a center-crop into the
  // target aspect (1.0 = no crop needed, 0.5 = half cropped away).
  const sourceAspect = img.width / img.height;
  const aspectFit =
    sourceAspect > targetAspect
      ? targetAspect / sourceAspect // photo wider than target
      : sourceAspect / targetAspect; // photo taller than target

  // Normalize each to 0–1 with realistic ceilings, then weight.
  const sharpNorm = clamp(sharpness / 1200, 0, 1); // 1200 = pretty crisp
  const brightNorm = brightnessScore(brightness);
  const aspectNorm = clamp(aspectFit, 0, 1);
  const composite =
    sharpNorm * 0.55 + brightNorm * 0.2 + aspectNorm * 0.2 + positionBonus * 0.05;

  return {
    sharpness,
    brightness,
    aspectFit,
    score: Math.round(clamp(composite, 0, 1) * 100),
    width: img.width,
    height: img.height,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Sweet-spot bell curve around 128 (mid gray). Falls off below 55
// (too dark) and above 215 (blown out).
function brightnessScore(b: number): number {
  if (b < 55) return clamp(b / 55, 0, 1) * 0.5;
  if (b > 215) return clamp((255 - b) / 40, 0, 1) * 0.5;
  const distance = Math.abs(b - 135) / 80;
  return clamp(1 - distance, 0, 1);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't decode image."));
    img.src = src;
  });
}
