"use client";

// URL-based photo importer. Paste an Airbnb (or any) listing link →
// the server scrapes candidate image URLs → we proxy each one through
// /api/proxy-image, score them client-side for sharpness / brightness
// / aspect, and add the top N (or all) to the slide deck.
//
// The "best 10" heuristic leans slightly toward the listing's source
// order (hosts often front-load hero shots) but doesn't trust it
// fully — many Airbnb listings dump random pictures first, so we
// also bias toward sharper, well-lit, well-aspect photos.

import { useState } from "react";
import { carouselRecipe, PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import {
  analyzeImage,
  defaultPositionForBand,
} from "@/app/overlay-studio/lib/overlayAnalysis";
import { scorePhoto } from "@/app/overlay-studio/lib/photoScoring";
import { enhancePhoto } from "@/app/overlay-studio/lib/photoEnhance";
import { pickTip } from "@/app/overlay-studio/lib/designTips";
import { readFileAsDataUrl } from "@/lib/shared-utils";
import {
  OUTPUT_DIMENSIONS,
  type OutputFormat,
  type OverlayMedia,
  type OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  media: OverlayMedia[];
  format: OutputFormat;
  settings: OverlaySettings;
  onSet: (next: OverlayMedia[]) => void;
}

type Pick = "top10" | "all";

interface FetchOk {
  ok: true;
  result: {
    source: string;
    host: string;
    urls: string[];
    setupNeeded?: boolean;
  };
}
interface FetchErr {
  ok: false;
  code: string;
  message: string;
  setupNeeded?: boolean;
}
type FetchResp = FetchOk | FetchErr;

const SETUP_HINT =
  "Tip: this listing's gallery came back thin. If it happens often, set SCRAPINGBEE_API_KEY in Vercel (free tier ~40 listings/mo) as a fallback for when Airbnb blocks our server.";

export default function OverlayUrlImport({
  media,
  format,
  settings,
  onSet,
}: Props) {
  const [url, setUrl] = useState("");
  const [pick, setPick] = useState<Pick>("top10");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function run() {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus("Paste a listing URL first.");
      return;
    }
    setBusy(true);
    setStatus("Fetching listing…");
    try {
      const resp = await fetch("/api/overlay-studio/fetch-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await resp.json()) as FetchResp;
      if (!data.ok) {
        const hint = data.setupNeeded ? `\n\n${SETUP_HINT}` : "";
        setStatus(`${data.code}: ${data.message}${hint}`);
        return;
      }
      const candidates = data.result.urls;
      if (candidates.length === 0) {
        setStatus("No photos found on that page.");
        return;
      }
      // Thin result + no rendering proxy = SSR shell. Tell the user.
      if (candidates.length < 5 && data.result.setupNeeded) {
        setStatus(
          `Found only ${candidates.length} photo${candidates.length === 1 ? "" : "s"} (Airbnb served a stripped shell). Downloading anyway…\n\n${SETUP_HINT}`,
        );
      } else {
        setStatus(
          `Found ${candidates.length} photo${candidates.length === 1 ? "" : "s"}. Downloading…`,
        );
      }

      const dim = OUTPUT_DIMENSIONS[format];
      const targetAspect = dim.w / dim.h;

      const downloads = await downloadAll(candidates, (i, n) => {
        setStatus(`Downloading ${i}/${n}…`);
      });
      if (downloads.length === 0) {
        setStatus("Photos came back empty — the host may block downloads.");
        return;
      }
      setStatus(`Scoring ${downloads.length} photos…`);

      const scored = await Promise.all(
        downloads.map(async (d, idx) => {
          // Position bonus decays linearly: first photo = +1, fades
          // to 0 by the 30th. Hosts that DO list best-first get
          // rewarded; hosts that don't aren't punished.
          const posBonus = Math.max(0, 1 - idx / 30);
          const s = await scorePhoto(d.dataUrl, targetAspect, posBonus);
          return { ...d, ...s, idx };
        }),
      );
      // Drop anything that scored sub-15 (broken image, micro icon).
      const usable = scored.filter((s) => s.score >= 15);
      usable.sort((a, b) => b.score - a.score);

      const keep = pick === "all" ? usable : usable.slice(0, 10);
      if (keep.length === 0) {
        setStatus("No photos passed scoring — try the 'All' option.");
        return;
      }

      setStatus(
        settings.enhancePhotos
          ? `Enhancing + analyzing ${keep.length} photos…`
          : `Analyzing ${keep.length} photos for text placement…`,
      );
      const fresh: OverlayMedia[] = [];
      for (let i = 0; i < keep.length; i++) {
        const k = keep[i];
        const dataUrl = settings.enhancePhotos
          ? await enhancePhoto(k.dataUrl)
          : k.dataUrl;
        const auto = await analyzeImage(dataUrl);
        const recipe = carouselRecipe(media.length + keep.length);
        const presetKey = recipe[media.length + i] ?? "editorial";
        const def = PRESETS[presetKey];
        fresh.push({
          id: `om_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}_${i}`,
          dataUrl,
          shotType: "living",
          role: def.role,
          preset: presetKey,
          headline: "",
          body: pickTip(media.length + i),
          textColor: auto.color,
          position: def.defaultPosition || defaultPositionForBand(auto.band),
          scrim: def.scrim !== "none",
          auto,
        });
      }
      onSet([...media, ...fresh]);
      setStatus(
        `✓ Added ${fresh.length} photo${fresh.length === 1 ? "" : "s"} from ${data.result.host}.`,
      );
      setUrl("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900">
          From an Airbnb listing
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          Airbnb only
        </span>
      </div>
      <p className="mb-2 text-[11px] text-gray-600">
        Paste a listing URL (the one with <code>/rooms/</code> in it). We pull
        only the photos from <em>Show all photos</em> — no host avatars,
        AirCover graphics, or icons.
      </p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.airbnb.com/rooms/12345678"
        disabled={busy}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
      />
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-700">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={pick === "top10"}
            onChange={() => setPick("top10")}
            disabled={busy}
          />
          Top 10 (scored)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={pick === "all"}
            onChange={() => setPick("all")}
            disabled={busy}
          />
          All photos
        </label>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy || !url.trim()}
        className="mt-2 w-full rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
      >
        {busy ? "Working…" : "Fetch photos"}
      </button>
      {status && (
        <div className="mt-2 whitespace-pre-wrap text-[11px] text-gray-600">
          {status}
        </div>
      )}
    </div>
  );
}

interface DownloadedPhoto {
  url: string;
  dataUrl: string;
}

async function downloadAll(
  urls: string[],
  onProgress: (done: number, total: number) => void,
): Promise<DownloadedPhoto[]> {
  const out: DownloadedPhoto[] = [];
  // Cap downloads — 60 is plenty even for chunky Airbnb listings, and
  // keeps memory under control if someone pastes a wall of photos.
  const limited = urls.slice(0, 60);
  for (let i = 0; i < limited.length; i++) {
    onProgress(i + 1, limited.length);
    try {
      const r = await fetch(
        `/api/proxy-image?url=${encodeURIComponent(limited[i])}`,
      );
      if (!r.ok) continue;
      const blob = await r.blob();
      if (!blob.type.startsWith("image/")) continue;
      out.push({ url: limited[i], dataUrl: await readFileAsDataUrl(blob) });
    } catch {
      // skip and continue
    }
  }
  return out;
}
