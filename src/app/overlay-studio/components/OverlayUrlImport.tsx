"use client";

// Three ways into the same pipeline (proxy → score → enhance → push
// into media):
//
//   1. Paste an Airbnb listing URL.  Server tries Airbnb's v2 API,
//      then HTML scrape. Works when it works.
//   2. Paste image URLs (one per line). The bulletproof fallback —
//      right-click any image on the Airbnb tab → Copy image address
//      → paste back → done. Bypasses every Airbnb anti-bot defense
//      because we never actually scrape the listing page.
//   3. (Drag-drop still lives in OverlayUpload above this panel.)
//
// Either path produces the same OverlayMedia[] with auto headlines +
// design-tip bodies seeded so the slide deck is export-ready.

import { useEffect, useState } from "react";
import { carouselRecipe, PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import {
  analyzeImage,
  defaultPositionForBand,
} from "@/app/overlay-studio/lib/overlayAnalysis";
import { scorePhoto } from "@/app/overlay-studio/lib/photoScoring";
import { enhancePhoto } from "@/app/overlay-studio/lib/photoEnhance";
import { pickStoryCopy } from "@/app/overlay-studio/lib/storyScripts";
import { readFileAsDataUrl } from "@/lib/shared-utils";
import {
  buildBookmarkletUrl,
  readAirbnbPhotosFromHash,
} from "@/app/overlay-studio/lib/bookmarklet";
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

type Mode = "url" | "paste" | "bookmarklet";
type Pick = "top10" | "all";

interface StrategyDiag {
  name: string;
  ok: boolean;
  bytes: number;
  photos: number;
}

interface FetchOk {
  ok: true;
  result: {
    source: string;
    host: string;
    urls: string[];
    setupNeeded?: boolean;
    diag?: StrategyDiag[];
  };
}
interface FetchErr {
  ok: false;
  code: string;
  message: string;
  setupNeeded?: boolean;
  diag?: StrategyDiag[];
}
type FetchResp = FetchOk | FetchErr;

function formatDiag(diag: StrategyDiag[] | undefined): string {
  if (!diag || diag.length === 0) return "";
  const winners = diag.filter((d) => d.ok && d.photos > 0);
  const reached = diag.filter((d) => d.ok && d.photos === 0);
  const failed = diag.filter((d) => !d.ok);
  const parts: string[] = [];
  if (winners.length > 0)
    parts.push(
      `Found photos via: ${winners.map((d) => `${d.name} (${d.photos})`).join(", ")}`,
    );
  if (reached.length > 0)
    parts.push(`Reached but empty: ${reached.map((d) => d.name).join(", ")}`);
  if (failed.length > 0)
    parts.push(`Couldn't reach: ${failed.map((d) => d.name).join(", ")}`);
  return parts.join(" · ");
}

export default function OverlayUrlImport({
  media,
  format,
  settings,
  onSet,
}: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pick, setPick] = useState<Pick>("top10");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [bookmarkletHref, setBookmarkletHref] = useState<string>("javascript:void(0)");

  // Compute the bookmarklet URL once the window object is available.
  // The bookmarklet bakes in window.location.origin so it opens THIS
  // deployment when the user later clicks it from an Airbnb tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBookmarkletHref(buildBookmarkletUrl(window.location.origin));
  }, []);

  // Auto-import when the page is opened with #airbnbphotos=… in the
  // URL hash — that's how the bookmarklet hands off photos from an
  // Airbnb tab. Reads the hash exactly once, clears it (so refresh
  // doesn't re-import), then runs the same pipeline as the manual
  // Paste image URLs flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const incoming = readAirbnbPhotosFromHash(window.location.hash);
    if (incoming.length === 0) return;
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setMode("paste");
    setPasted(incoming.join("\n"));
    // Defer to next tick so state propagates before the import fires.
    setTimeout(() => {
      void downloadScoreAndPush(incoming);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runUrl() {
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
        const diagLine = formatDiag(data.diag);
        setStatus(diagLine ? `${data.message}\n\n${diagLine}` : data.message);
        return;
      }
      const candidates = data.result.urls;
      if (candidates.length === 0) {
        setStatus("No photos found on that listing.");
        return;
      }
      const diagLine = formatDiag(data.result.diag);
      const headline = `Found ${candidates.length} photo${candidates.length === 1 ? "" : "s"}. Downloading…`;
      setStatus(diagLine ? `${headline}\n${diagLine}` : headline);
      await downloadScoreAndPush(candidates);
      setUrl("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runPaste() {
    const urls = pasted
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    if (urls.length === 0) {
      setStatus(
        "Paste at least one image URL. (Right-click any Airbnb photo → Copy image address.)",
      );
      return;
    }
    setBusy(true);
    setStatus(`Got ${urls.length} URL${urls.length === 1 ? "" : "s"}. Downloading…`);
    try {
      await downloadScoreAndPush(urls);
      setPasted("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadScoreAndPush(urls: string[]) {
    const dim = OUTPUT_DIMENSIONS[format];
    const targetAspect = dim.w / dim.h;

    const downloads = await downloadAll(urls, (i, n) => {
      setStatus(`Downloading ${i}/${n}…`);
    });
    if (downloads.length === 0) {
      setStatus(
        `Couldn't download any of those ${urls.length} URLs. If they came from the bookmarklet, make sure you opened 'Show all photos' on the Airbnb listing BEFORE clicking the bookmark (so the photos finished loading in the DOM). Otherwise the URLs may have been signed-link / expired versions — re-run the bookmarklet and paste fresh.`,
      );
      return;
    }
    setStatus(`Scoring ${downloads.length} photos…`);

    const scored = await Promise.all(
      downloads.map(async (d, idx) => {
        // Position bonus decays linearly so listings that DO front-load
        // their best shots get rewarded.
        const posBonus = Math.max(0, 1 - idx / 30);
        const s = await scorePhoto(d.dataUrl, targetAspect, posBonus);
        return { ...d, ...s, idx };
      }),
    );
    // Drop anything obviously broken (micro icon / bad decode).
    const usable = scored.filter((s) => s.score >= 15);
    usable.sort((a, b) => b.score - a.score);

    const keep = pick === "all" ? usable : usable.slice(0, 10);
    if (keep.length === 0) {
      setStatus("No photos passed scoring. Try the 'All' option.");
      return;
    }

    setStatus(
      settings.enhancePhotos
        ? `Enhancing + analyzing ${keep.length} photos…`
        : `Analyzing ${keep.length} photos…`,
    );
    const fresh: OverlayMedia[] = [];
    for (let i = 0; i < keep.length; i++) {
      const k = keep[i];
      const dataUrl = settings.enhancePhotos
        ? await enhancePhoto(k.dataUrl)
        : k.dataUrl;
      const auto = await analyzeImage(dataUrl);
      const recipe = carouselRecipe(media.length + keep.length);
      const slideIdx = media.length + i;
      const presetKey = recipe[slideIdx] ?? "editorial";
      const def = PRESETS[presetKey];
      const copy = pickStoryCopy(settings.goal, presetKey, slideIdx, settings);
      fresh.push({
        id: `om_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}_${i}`,
        dataUrl,
        shotType: "living",
        role: def.role,
        preset: presetKey,
        headline: copy.headline,
        body: copy.body,
        textColor: auto.color,
        position: def.defaultPosition || defaultPositionForBand(auto.band),
        scrim: def.scrim !== "none",
        auto,
      });
    }
    onSet([...media, ...fresh]);
    setStatus(
      `✓ Added ${fresh.length} photo${fresh.length === 1 ? "" : "s"} — headlines + caption ready.`,
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900">
          Import from Airbnb
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          three ways
        </span>
      </div>

      {/* Mode toggle */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {(
          [
            { key: "bookmarklet", label: "Bookmarklet ⚡" },
            { key: "url", label: "Paste URL" },
            { key: "paste", label: "Paste image URLs" },
          ] as { key: Mode; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            disabled={busy}
            className={`rounded border px-2 py-1.5 text-xs font-medium transition ${
              mode === key
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "bookmarklet" && (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-gray-600">
            <strong>One-time setup. Then 2 clicks forever.</strong> Drag
            this button to your bookmarks bar:
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href={bookmarkletHref}
            onClick={(e) => {
              e.preventDefault();
              alert(
                "Drag this button to your bookmarks bar instead of clicking it. (Bookmarklets can only run on the page they're being clicked from.)",
              );
            }}
            draggable
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 shadow hover:bg-amber-300"
            title="Drag me to the bookmarks bar"
          >
            ⚡ Send to Overlay Studio
          </a>
          <p className="text-[11px] leading-relaxed text-gray-600">
            Then for any Airbnb listing — <strong>one click</strong>:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-[11px] text-gray-700">
            <li>Open the listing in a tab.</li>
            <li>
              Click <em>Show all photos</em> so the full gallery loads in
              the DOM.
            </li>
            <li>
              Click the bookmark. A new tab opens to Overlay Studio with
              the photos already importing. No pasting, no clipboard.
            </li>
          </ol>
          <p className="rounded bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-600">
            Why this exists: Airbnb&apos;s server returns a stripped page
            to anyone who isn&apos;t a logged-in browser, so server-side
            scraping can&apos;t see the gallery. The bookmarklet runs in
            your tab where Airbnb&apos;s own JS has already loaded the
            photos. Works on every listing.
          </p>
        </div>
      )}

      {mode === "url" && (
        <>
          <p className="mb-2 text-[11px] text-gray-600">
            Paste the <code>/rooms/</code> URL. We race Airbnb&apos;s API
            and a few render-the-page services in parallel. Works for some
            listings; if it returns thin, use the bookmarklet instead.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.airbnb.com/rooms/12345678"
            disabled={busy}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </>
      )}

      {mode === "paste" && (
        <>
          <p className="mb-2 text-[11px] leading-relaxed text-gray-600">
            Either paste output from the bookmarklet (recommended) or
            right-click each photo on the Airbnb tab →{" "}
            <strong>Copy image address</strong> → paste here, one per line.
          </p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"https://a0.muscache.com/im/pictures/...\nhttps://a0.muscache.com/im/pictures/...\nhttps://a0.muscache.com/im/pictures/..."}
            rows={6}
            disabled={busy}
            className="w-full resize-y rounded border border-gray-300 p-2 font-mono text-[11px]"
          />
        </>
      )}

      {mode !== "bookmarklet" && (
        <>
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
              All
            </label>
          </div>
          <button
            type="button"
            onClick={mode === "url" ? runUrl : runPaste}
            disabled={busy || (mode === "url" ? !url.trim() : !pasted.trim())}
            className="mt-2 w-full rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
          >
            {busy ? "Working…" : mode === "url" ? "Fetch photos" : "Add photos"}
          </button>
        </>
      )}
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

// Try fetching an image directly from the browser first (muscache and
// most CDNs serve image GETs with CORS-allow-all), then fall back to
// our /api/proxy-image route if the direct fetch fails. The direct
// path matters because Airbnb's CDN sometimes 403s server-IP egress
// (Vercel / DC IPs), but happily serves the user's residential IP.
async function downloadOne(url: string): Promise<DownloadedPhoto | null> {
  // Direct first.
  try {
    const r = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
    if (r.ok) {
      const blob = await r.blob();
      if (blob.type.startsWith("image/")) {
        return { url, dataUrl: await readFileAsDataUrl(blob) };
      }
    }
  } catch {
    // CORS-blocked or network error — fall through to the proxy.
  }
  // Proxy fallback.
  try {
    const r = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (r.ok) {
      const blob = await r.blob();
      if (blob.type.startsWith("image/")) {
        return { url, dataUrl: await readFileAsDataUrl(blob) };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function downloadAll(
  urls: string[],
  onProgress: (done: number, total: number) => void,
): Promise<DownloadedPhoto[]> {
  const out: DownloadedPhoto[] = [];
  // Cap downloads — 60 is plenty even for chunky listings, keeps
  // memory under control if someone pastes a wall of URLs.
  const limited = urls.slice(0, 60);
  for (let i = 0; i < limited.length; i++) {
    onProgress(i + 1, limited.length);
    const got = await downloadOne(limited[i]);
    if (got) out.push(got);
  }
  return out;
}
