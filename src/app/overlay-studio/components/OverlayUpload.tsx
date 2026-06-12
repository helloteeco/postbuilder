"use client";

// Compact photo uploader. Real <input type="file" multiple> with a
// stable id ("overlay-photo-input") so the Claude Chrome extension's
// file-upload tool can drop files straight in — no hidden widget.

import { useRef, useState } from "react";
import { carouselRecipe, PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import {
  analyzeImage,
  defaultPositionForBand,
} from "@/app/overlay-studio/lib/overlayAnalysis";
import { enhancePhoto } from "@/app/overlay-studio/lib/photoEnhance";
import { readFileAsDataUrl } from "@/lib/shared-utils";
import { pickTip } from "@/app/overlay-studio/lib/designTips";
import type {
  OverlayMedia,
  OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia[];
  settings: OverlaySettings;
  onSet: (next: OverlayMedia[]) => void;
}

const PHOTO_INPUT_ID = "overlay-photo-input";

export default function OverlayUpload({ media, settings, onSet }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function ingest(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const startingCount = media.length;
    const fresh: OverlayMedia[] = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const raw = await readFileAsDataUrl(file);
      const dataUrl = settings.enhancePhotos ? await enhancePhoto(raw) : raw;
      const auto = await analyzeImage(dataUrl);
      const recipe = carouselRecipe(startingCount + arr.length);
      const preset = recipe[startingCount + i] ?? "editorial";
      const def = PRESETS[preset];
      fresh.push({
        id: `om_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}_${i}`,
        dataUrl,
        shotType: "living",
        role: def.role,
        preset,
        headline: "",
        body: pickTip(startingCount + i),
        textColor: auto.color,
        position: def.defaultPosition || defaultPositionForBand(auto.band),
        scrim: def.scrim !== "none",
        auto,
      });
    }
    onSet([...media, ...fresh]);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900">Your photos</div>
        <span className="text-xs text-gray-500">
          {media.length} loaded
        </span>
      </div>
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
        className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition ${
          dragOver
            ? "border-gray-900 bg-gray-50"
            : "border-gray-300 text-gray-500"
        }`}
      >
        Drag photos here, or{" "}
        <label
          htmlFor={PHOTO_INPUT_ID}
          className="cursor-pointer font-semibold text-gray-900 underline"
        >
          click to browse
        </label>
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
    </div>
  );
}

