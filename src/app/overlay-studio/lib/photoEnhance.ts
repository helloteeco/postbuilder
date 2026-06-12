// Soft warm Lightroom-ish preset baked into every imported photo.
// Applied client-side via canvas so the result is consistent across
// upload + URL import paths. The recipe is intentionally subtle (it
// should look "well-lit", not "filtered"):
//
//   warmth      shifts the white point about 200K cooler -> warmer
//               via per-channel multipliers (R up, B down, G barely)
//   brightness  lifts mids slightly so dark interior corners pop
//   saturation  bumps textiles + food + greenery
//   contrast    gentle S-curve so the photo doesn't go flat from
//               the brightness lift
//
// Output is a JPEG data URL at q=0.92 so the file stays reasonable
// for the export zip without visible quality loss.

const WARMTH_R = 1.06;
const WARMTH_G = 1.01;
const WARMTH_B = 0.94;
const BRIGHTNESS = 12;
const SAT = 1.15;
const CONTRAST = 1.08;

export async function enhancePhoto(dataUrl: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        applyPreset(data.data);
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
  });
}

export async function enhanceMany(dataUrls: string[]): Promise<string[]> {
  return Promise.all(dataUrls.map((u) => enhancePhoto(u)));
}

function applyPreset(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    r = clamp(r * WARMTH_R + BRIGHTNESS);
    g = clamp(g * WARMTH_G + BRIGHTNESS);
    b = clamp(b * WARMTH_B + BRIGHTNESS);

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = clamp(gray + (r - gray) * SAT);
    g = clamp(gray + (g - gray) * SAT);
    b = clamp(gray + (b - gray) * SAT);

    r = sCurve(r);
    g = sCurve(g);
    b = sCurve(b);

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function sCurve(v: number): number {
  const x = v / 255 - 0.5;
  const out = 0.5 + x * CONTRAST;
  return clamp(out * 255);
}
