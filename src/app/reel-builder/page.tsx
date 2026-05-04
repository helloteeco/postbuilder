"use client";

// Main Reel Builder page. Wires the input form → API call → 3 variation
// cards. Each card renders a scaled in-page preview, an MP4/PNG export
// button, a caption block, and a save-to-favorites button. Favorites
// surface in a strip at the top.
//
// Hidden offscreen export nodes hold the full 1080×1920 versions used
// by html-to-image; this is the same trick Post Builder uses.

import { useEffect, useMemo, useRef, useState } from "react";
import ReelInputForm from "./components/ReelInputForm";
import ReelHookPreview from "./components/ReelHookPreview";
import ReelCaptionPreview from "./components/ReelCaptionPreview";
import {
  defaultBgForIndex,
  HOOK_ANGLE_LABELS,
  REEL_HEIGHT,
  REEL_WIDTH,
  type ReelBg,
  type ReelGenerationResult,
  type ReelVariation,
} from "./lib/reelTemplate";
import { generateReels } from "./lib/reelGeneration";
import { loadReelProfile, type ReelProfile } from "./lib/reelProfile";
import {
  addFavorite,
  loadFavorites,
  removeFavorite,
  type ReelFavorite,
} from "./lib/reelFavorites";
import {
  exportReelAsMp4,
  exportReelAsPng,
  type ExportProgress,
} from "./lib/videoExport";

// Width of the in-page preview card. Reel is 1080 wide; we scale it
// down to ~280px so 3 cards fit side by side at desktop widths.
const PREVIEW_WIDTH = 280;
const PREVIEW_SCALE = PREVIEW_WIDTH / REEL_WIDTH;

interface CardState {
  bg: ReelBg;
  variation: ReelVariation;
  exportStatus: ExportProgress | null;
  exportBusy: boolean;
}

export default function ReelBuilderPage() {
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ReelProfile | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [favorites, setFavorites] = useState<ReelFavorite[]>([]);

  // Refs to the offscreen full-size export nodes — one per visible card,
  // plus one per favorite (favorites have their own export targets).
  const cardExportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const favExportRefs = useRef<(HTMLDivElement | null)[]>([]);
  cardExportRefs.current = cards.map((_, i) => cardExportRefs.current[i] ?? null);
  favExportRefs.current = favorites.map((_, i) => favExportRefs.current[i] ?? null);

  useEffect(() => {
    setProfile(loadReelProfile());
    setFavorites(loadFavorites());
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await generateReels(source);
      if (!res.ok || !res.result) {
        setError(`${res.errorCode ?? "ERROR"}: ${res.errorMessage ?? "Unknown error"}`);
        return;
      }
      setCards(buildInitialCards(res.result));
    } finally {
      setBusy(false);
    }
  }

  function setCardStatus(i: number, partial: Partial<CardState>) {
    setCards((prev) => prev.map((c, j) => (j === i ? { ...c, ...partial } : c)));
  }

  async function handleExport(
    cardIdx: number,
    format: "mp4" | "png",
  ) {
    const node = cardExportRefs.current[cardIdx];
    if (!node) return;
    setCardStatus(cardIdx, { exportBusy: true, exportStatus: null });
    const filename = filenameFor(cards[cardIdx].variation, cardIdx, format);
    try {
      const onProgress = (p: ExportProgress) =>
        setCardStatus(cardIdx, { exportStatus: p });
      if (format === "mp4") {
        await exportReelAsMp4(node, filename, onProgress);
      } else {
        await exportReelAsPng(node, filename, onProgress);
      }
    } catch (err) {
      setCardStatus(cardIdx, {
        exportStatus: {
          stage: "fallback-png",
          message: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    } finally {
      setCardStatus(cardIdx, { exportBusy: false });
    }
  }

  function handleSaveFavorite(cardIdx: number) {
    const c = cards[cardIdx];
    if (!c) return;
    addFavorite({ variation: c.variation, bg: c.bg });
    setFavorites(loadFavorites());
  }

  function handleRemoveFavorite(id: string) {
    removeFavorite(id);
    setFavorites(loadFavorites());
  }

  async function handleExportFavorite(favIdx: number, format: "mp4" | "png") {
    const node = favExportRefs.current[favIdx];
    if (!node) return;
    const fav = favorites[favIdx];
    const filename = filenameFor(fav.variation, favIdx, format);
    try {
      if (format === "mp4") {
        await exportReelAsMp4(node, filename);
      } else {
        await exportReelAsPng(node, filename);
      }
    } catch {
      // Fall back already handled inside videoExport for MP4. PNG
      // failures are rare and surfaced as alerts to keep the UI simple.
      alert("Export failed — try again.");
    }
  }

  const safeProfile = profile ?? {
    displayName: "Dr. Jeff Chheuy",
    handle: "@jeffchheuy",
    avatarDataUrl: null,
    verified: true,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Reel Builder</h1>
        <p className="text-sm text-gray-600">
          Same input as Post Builder → 3 single-screen reel covers + matching
          long-form captions, ready to upload to Instagram.
        </p>
      </header>

      {favorites.length > 0 && (
        <FavoritesStrip
          favorites={favorites}
          profile={safeProfile}
          onRemove={handleRemoveFavorite}
          onExport={handleExportFavorite}
          exportRefs={favExportRefs}
        />
      )}

      <ReelInputForm
        source={source}
        onSourceChange={setSource}
        onGenerate={handleGenerate}
        busy={busy}
        error={error}
      />

      {cards.length > 0 && (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <VariationCard
              key={i}
              index={i}
              card={c}
              profile={safeProfile}
              onExport={handleExport}
              onSaveFavorite={handleSaveFavorite}
            />
          ))}
        </section>
      )}

      {/* Hidden full-size export nodes — one per visible card */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {cards.map((c, i) => (
          <div
            key={`export-${i}`}
            ref={(el) => {
              cardExportRefs.current[i] = el;
            }}
            style={{ width: REEL_WIDTH, height: REEL_HEIGHT }}
          >
            <ReelHookPreview
              bg={c.bg}
              headline={c.variation.hookHeadline}
              subtitle={c.variation.hookSubtitle}
              profile={safeProfile}
            />
          </div>
        ))}
        {favorites.map((f, i) => (
          <div
            key={`fav-export-${f.id}`}
            ref={(el) => {
              favExportRefs.current[i] = el;
            }}
            style={{ width: REEL_WIDTH, height: REEL_HEIGHT }}
          >
            <ReelHookPreview
              bg={f.bg}
              headline={f.variation.hookHeadline}
              subtitle={f.variation.hookSubtitle}
              profile={safeProfile}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function buildInitialCards(result: ReelGenerationResult): CardState[] {
  return result.variations.slice(0, 3).map((v, i) => ({
    bg: defaultBgForIndex(i),
    variation: v,
    exportStatus: null,
    exportBusy: false,
  }));
}

function filenameFor(
  variation: ReelVariation,
  index: number,
  format: "mp4" | "png",
): string {
  const slug =
    variation.hookHeadline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `variation-${index + 1}`;
  return `reel-${slug}.${format}`;
}

interface VariationCardProps {
  index: number;
  card: CardState;
  profile: ReelProfile;
  onExport: (idx: number, format: "mp4" | "png") => void;
  onSaveFavorite: (idx: number) => void;
}

function VariationCard({
  index,
  card,
  profile,
  onExport,
  onSaveFavorite,
}: VariationCardProps) {
  const previewHeight = useMemo(() => REEL_HEIGHT * PREVIEW_SCALE, []);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div
        style={{
          width: PREVIEW_WIDTH,
          height: previewHeight,
          overflow: "hidden",
          borderRadius: 12,
          alignSelf: "center",
        }}
      >
        <ReelHookPreview
          bg={card.bg}
          headline={card.variation.hookHeadline}
          subtitle={card.variation.hookSubtitle}
          profile={profile}
          scale={PREVIEW_SCALE}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-gray-500">
          Variation {index + 1} · {HOOK_ANGLE_LABELS[card.variation.angle] ?? card.variation.angle}
        </span>
        <button
          type="button"
          onClick={() => onSaveFavorite(index)}
          className="rounded border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100"
          title="Save this reel to favorites"
        >
          ☆ Save
        </button>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-bold text-gray-900">
          {card.variation.hookHeadline}
        </div>
        {card.variation.hookSubtitle && (
          <div className="text-xs text-gray-600">
            {card.variation.hookSubtitle}
          </div>
        )}
      </div>

      <ReelCaptionPreview caption={card.variation.caption} />

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onExport(index, "mp4")}
          disabled={card.exportBusy}
          className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {card.exportBusy ? "Working…" : "Download MP4"}
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => onExport(index, "png")}
            disabled={card.exportBusy}
            className="text-[11px] text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
          >
            or download as PNG
          </button>
        </div>
        {card.exportStatus && (
          <div
            className={`rounded p-2 text-[11px] ${
              card.exportStatus.stage === "fallback-png"
                ? "bg-amber-50 text-amber-800"
                : card.exportStatus.stage === "done"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-gray-50 text-gray-600"
            }`}
          >
            {card.exportStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

interface FavoritesStripProps {
  favorites: ReelFavorite[];
  profile: ReelProfile;
  onRemove: (id: string) => void;
  onExport: (favIdx: number, format: "mp4" | "png") => void;
  exportRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

function FavoritesStrip({
  favorites,
  profile,
  onRemove,
  onExport,
}: FavoritesStripProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
        Favorites · {favorites.length}
      </div>
      <ul className="space-y-2">
        {favorites.map((f, i) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-white p-3"
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 60,
                  height: 60 * (REEL_HEIGHT / REEL_WIDTH),
                  overflow: "hidden",
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                <ReelHookPreview
                  bg={f.bg}
                  headline={f.variation.hookHeadline}
                  subtitle={f.variation.hookSubtitle}
                  profile={profile}
                  scale={60 / REEL_WIDTH}
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {f.variation.hookHeadline}
                </div>
                <div className="text-xs text-gray-500">
                  {HOOK_ANGLE_LABELS[f.variation.angle] ?? f.variation.angle}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onExport(i, "mp4")}
                className="rounded bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black"
              >
                MP4
              </button>
              <button
                type="button"
                onClick={() => onExport(i, "png")}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                PNG
              </button>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                aria-label="Remove favorite"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
