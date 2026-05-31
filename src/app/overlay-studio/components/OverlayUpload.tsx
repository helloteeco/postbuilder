"use client";

// Step 2 — Add photos. Per the spec (§8.2): this MUST be a real,
// ref-addressable <input type="file" multiple> so the Claude Chrome
// extension's file-upload tool can drop files straight in. We do NOT
// hide it behind a custom widget — the styled "click to browse" button
// triggers the actual input, and the input itself stays in the DOM
// with a stable id ("overlay-photo-input").

import { useRef, useState } from "react";
import { carouselRecipe, PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import {
  analyzeImage,
  defaultPositionForBand,
} from "@/app/overlay-studio/lib/overlayAnalysis";
import type { OverlayMedia } from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia[];
  onAdd: (next: OverlayMedia[]) => void;
}

const PHOTO_INPUT_ID = "overlay-photo-input";

export default function OverlayUpload({ media, onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function ingest(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const startingCount = media.length;
    const newMedia: OverlayMedia[] = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const dataUrl = await readAsDataUrl(file);
      const auto = await analyzeImage(dataUrl);
      const recipe = carouselRecipe(startingCount + arr.length);
      const slotIdx = startingCount + i;
      const preset = recipe[slotIdx] ?? "editorial";
      const def = PRESETS[preset];
      newMedia.push({
        id: `om_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}_${i}`,
        dataUrl,
        shotType: "living",
        role: def.role,
        preset,
        headline: "",
        body: "",
        textColor: auto.color,
        position: def.defaultPosition || defaultPositionForBand(auto.band),
        scrim: def.scrim !== "none",
        auto,
      });
    }
    onAdd([...media, ...newMedia]);
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 2 — Add your photos
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Upload 6–10 of your best, properly-styled shots
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        The photo does half the work — pick winners. We&apos;ll figure out
        where to place the words so they pop. Drag in files, or click to
        browse. Use the Claude Chrome extension to pull from a listing — see
        the tip below.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) ingest(e.dataTransfer.files);
        }}
        className={`mt-4 rounded-lg border-2 border-dashed p-8 text-center transition ${
          dragOver
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 text-gray-500"
        }`}
      >
        <div className="text-sm">
          Drag photos here, or{" "}
          <label
            htmlFor={PHOTO_INPUT_ID}
            className="cursor-pointer font-semibold text-gray-900 underline"
          >
            click to browse
          </label>
          .
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          JPG / PNG / HEIC. Stored locally only.
        </div>
        <input
          id={PHOTO_INPUT_ID}
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </div>

      <details className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
        <summary className="cursor-pointer font-semibold">
          💡 Pull photos from an Airbnb / teeco.co listing with Claude
        </summary>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5">
          <li>
            In Chrome (logged into the listing&apos;s account), open the
            listing and open its <strong>full photo gallery</strong>.
          </li>
          <li>
            Open the <strong>Claude Chrome extension</strong> and paste:{" "}
            <em>
              &ldquo;Collect the full-resolution photo URLs from this
              listing&apos;s gallery and download the originals into a folder
              named [nickname].&rdquo;
            </em>
          </li>
          <li>
            Then paste:{" "}
            <em>
              &ldquo;Upload the photos in the [nickname] folder into the
              Overlay Studio photo input on this page.&rdquo;
            </em>{" "}
            The agent uses the file input here ({" "}
            <code>#{PHOTO_INPUT_ID}</code>) to drop the files in.
          </li>
          <li>
            Continue with Step 3 (style) → Step 4 (overlay words) → Step 6
            (export).
          </li>
        </ol>
        <div className="mt-1 text-blue-800/80">
          Why this beats scraping: uses your own authenticated browser
          session on your own listings, pulls original-quality files, and
          sidesteps the CORS limits that break canvas exports.
        </div>
      </details>

      {media.length > 0 && (
        <div className="mt-3 text-xs text-gray-600">
          {media.length} photo{media.length === 1 ? "" : "s"} ready. Step 3 (the
          style picker) is per-photo in the auditor below — defaults follow
          the proven cover → teach → proof → CTA arc.
        </div>
      )}
    </section>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
