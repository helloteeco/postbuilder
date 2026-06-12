"use client";

// Personal-photo cover picker for the Post Builder's slide 1.
//
// Drop one or more photos → each is downscaled to 1080w, run through
// the same soft-warm enhancement preset Overlay Studio uses, scored
// for sharpness / brightness / aspect fit, and luminance-analyzed for
// text color. The best-scoring photo is applied automatically; the
// rest stay as candidates the user can click to swap. Candidates live
// only in component state — the chosen photo is the only one persisted
// on the slide (keeps history snapshots small).

import { useState } from "react";
import { readFileAsDataUrl } from "@/lib/shared-utils";
import { enhancePhoto } from "@/app/overlay-studio/lib/photoEnhance";
import { scorePhoto } from "@/app/overlay-studio/lib/photoScoring";
import { analyzeImage } from "@/app/overlay-studio/lib/overlayAnalysis";
import { compressForHistory } from "@/app/overlay-studio/lib/overlayHistory";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/components/CarouselSlide";

interface Candidate {
  dataUrl: string;
  score: number;
  textColor: "light" | "dark";
}

interface Props {
  photoDataUrl?: string;
  photoTextColor?: "light" | "dark";
  onApply: (dataUrl: string, textColor: "light" | "dark") => void;
  onFlipTextColor: (next: "light" | "dark") => void;
  onRemove: () => void;
}

export default function CoverPhotoPicker({
  photoDataUrl,
  photoTextColor,
  onApply,
  onFlipTextColor,
  onRemove,
}: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function ingest(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setBusy(true);
    try {
      const fresh: Candidate[] = [];
      for (let i = 0; i < arr.length; i++) {
        setStatus(`Enhancing ${i + 1}/${arr.length}…`);
        const raw = await readFileAsDataUrl(arr[i]);
        // Downscale BEFORE enhancing — a 12MP phone photo would make
        // the per-pixel enhancement pass crawl; 1080w is plenty for
        // the 1080×1350 export.
        const small = await compressForHistory(raw);
        const enhanced = await enhancePhoto(small);
        const auto = await analyzeImage(enhanced);
        const s = await scorePhoto(enhanced, SLIDE_WIDTH / SLIDE_HEIGHT);
        fresh.push({ dataUrl: enhanced, score: s.score, textColor: auto.color });
      }
      const all = [...candidates, ...fresh].sort((a, b) => b.score - a.score);
      setCandidates(all);
      // Auto-apply the best-scoring photo so the cover updates without
      // an extra click. User can swap below.
      const best = all[0];
      if (best) {
        onApply(best.dataUrl, best.textColor);
        setStatus(
          all.length > 1
            ? `✓ Picked the sharpest of ${all.length} — click another to swap.`
            : "✓ Photo applied.",
        );
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          Cover photo (optional)
        </span>
        {photoDataUrl && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          >
            Remove photo
          </button>
        )}
      </div>
      <p className="mb-2 text-[11px] text-gray-500">
        Drop your own photos — we auto-enhance them (soft warm preset),
        pick the sharpest, and set the text color so your hook pops.
      </p>
      <label
        className={`block cursor-pointer rounded border-2 border-dashed p-3 text-center text-xs transition ${
          busy
            ? "border-gray-200 text-gray-400"
            : "border-gray-300 text-gray-500 hover:border-gray-400"
        }`}
      >
        {busy ? status ?? "Working…" : "Click to add photos (or drop several — we pick the best)"}
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </label>

      {candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {candidates.map((c, i) => {
            const active = c.dataUrl === photoDataUrl;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onApply(c.dataUrl, c.textColor)}
                className={`relative overflow-hidden rounded ring-2 transition ${
                  active ? "ring-gray-900" : "ring-transparent hover:ring-gray-300"
                }`}
                title={`Quality score ${c.score}/100`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.dataUrl}
                  alt=""
                  className="h-16 w-16 object-cover"
                />
                <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] font-bold text-white">
                  {c.score}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {photoDataUrl && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
          <span>
            Text over photo:{" "}
            <strong>{photoTextColor === "dark" ? "dark" : "white"}</strong>{" "}
            (auto)
          </span>
          <button
            type="button"
            onClick={() =>
              onFlipTextColor(photoTextColor === "dark" ? "light" : "dark")
            }
            className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100"
          >
            Flip
          </button>
        </div>
      )}

      {!busy && status && candidates.length > 0 && (
        <div className="mt-1.5 text-[11px] text-gray-500">{status}</div>
      )}
    </div>
  );
}
