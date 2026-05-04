"use client";

// Main Reel Builder page. Wires together:
//   • ProfileEditor (shared with Post Builder, same localStorage key)
//   • Input form → API call → 3 variation cards
//   • Recent reels strip (last 2 saved batches, click to reload)
//   • Help modal with "How to use" + "DIY in CapCut" tabs
//   • Per-card editable headline / subtitle / caption
//   • Per-card bg picker (7 PB palettes)
//   • Send-to-tracker handoff (queues a Coach Mode pending draft with
//     hook + caption flattened into SlideContent[] for structural
//     analysis, exact same pipeline Post Builder uses)
//   • Save-to-favorites + MP4 / PNG export
//
// Hidden offscreen export nodes hold the full 1080×1920 versions used
// by html-to-image.

import { useEffect, useMemo, useRef, useState } from "react";
import ProfileEditor from "@/components/post-builder/ProfileEditor";
import { DEFAULT_PROFILE, type PostBuilderProfile } from "@/lib/post-templates";
import {
  addPendingDraft,
  cleanTitle,
} from "@/app/coach/lib/pendingDraft";
import ReelInputForm from "./components/ReelInputForm";
import ReelHookPreview from "./components/ReelHookPreview";
import ReelCaptionPreview from "./components/ReelCaptionPreview";
import RecentReels from "./components/RecentReels";
import ReelGuides from "./components/ReelGuides";
import WelcomeBanner from "@/components/WelcomeBanner";
import {
  DEFAULT_CUSTOM_ACCENT,
  DEFAULT_CUSTOM_BG,
  defaultBgForIndex,
  HOOK_ANGLE_LABELS,
  paletteFor,
  REEL_BG_LABELS,
  REEL_BG_ORDER,
  REEL_BG_PALETTES,
  REEL_HEIGHT,
  REEL_WIDTH,
  type ReelBg,
  type ReelGenerationResult,
  type ReelVariation,
} from "./lib/reelTemplate";
import { generateReels } from "./lib/reelGeneration";
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
import {
  deleteReelHistory,
  loadReelHistory,
  promoteReelHistory,
  pushReelHistory,
  updateCurrentReelHistory,
  type SavedReelBatch,
} from "./lib/reelHistory";
import { slidesFromReel } from "./lib/slidesFromReel";

// In-page preview width. Reel is 1080 wide; we scale it down to ~280px
// so 3 cards fit side by side at desktop widths.
const PREVIEW_WIDTH = 280;
const PREVIEW_SCALE = PREVIEW_WIDTH / REEL_WIDTH;

type SendStatus = "idle" | "sent";

interface CardState {
  bg: ReelBg;
  // Hex codes when bg === "custom". Persisted so a user can switch
  // away from custom and back without losing their picked colors.
  customBg?: string;
  customAccent?: string;
  variation: ReelVariation;
  exportStatus: ExportProgress | null;
  exportBusy: boolean;
  sendStatus: SendStatus;
}

export default function ReelBuilderPage() {
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PostBuilderProfile>(DEFAULT_PROFILE);
  const [cards, setCards] = useState<CardState[]>([]);
  const [favorites, setFavorites] = useState<ReelFavorite[]>([]);
  const [history, setHistory] = useState<SavedReelBatch[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<"how-to" | "capcut" | null>(null);

  const cardExportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const favExportRefs = useRef<(HTMLDivElement | null)[]>([]);
  cardExportRefs.current = cards.map((_, i) => cardExportRefs.current[i] ?? null);
  favExportRefs.current = favorites.map((_, i) => favExportRefs.current[i] ?? null);

  useEffect(() => {
    setFavorites(loadFavorites());
    setHistory(loadReelHistory());
  }, []);

  // Auto-save the active history entry when the user edits the cards
  // or the source. Debounced ~1.2s to avoid thrashing localStorage on
  // every keystroke. Mirrors Post Builder's history auto-save.
  useEffect(() => {
    if (cards.length === 0) return;
    if (!activeHistoryId) return;
    const t = setTimeout(() => {
      updateCurrentReelHistory({
        source,
        cards: cards.map((c) => ({
          bg: c.bg,
          customBg: c.customBg,
          customAccent: c.customAccent,
          variation: c.variation,
        })),
      });
      setHistory(loadReelHistory());
    }, 1200);
    return () => clearTimeout(t);
  }, [cards, source, activeHistoryId]);

  function handleLoadHistory(entry: SavedReelBatch) {
    const next = promoteReelHistory(entry.id);
    setHistory(next);
    setSource(entry.source);
    setCards(
      entry.cards.map((c) => ({
        bg: c.bg,
        customBg: c.customBg,
        customAccent: c.customAccent,
        variation: c.variation,
        exportStatus: null,
        exportBusy: false,
        sendStatus: "idle",
      })),
    );
    setActiveHistoryId(entry.id);
  }

  function handleDeleteHistory(id: string) {
    const next = deleteReelHistory(id);
    setHistory(next);
    if (activeHistoryId === id) setActiveHistoryId(null);
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await generateReels(source);
      if (!res.ok || !res.result) {
        setError(`${res.errorCode ?? "ERROR"}: ${res.errorMessage ?? "Unknown error"}`);
        return;
      }
      const fresh = buildInitialCards(res.result);
      setCards(fresh);
      // Save to history.
      const entry = pushReelHistory(
        source,
        fresh.map((c) => ({
          bg: c.bg,
          customBg: c.customBg,
          customAccent: c.customAccent,
          variation: c.variation,
        })),
      );
      setHistory(loadReelHistory());
      setActiveHistoryId(entry.id);
    } finally {
      setBusy(false);
    }
  }

  function setCardStatus(i: number, partial: Partial<CardState>) {
    setCards((prev) => prev.map((c, j) => (j === i ? { ...c, ...partial } : c)));
  }

  function patchVariation(i: number, patch: Partial<ReelVariation>) {
    setCards((prev) =>
      prev.map((c, j) =>
        j === i ? { ...c, variation: { ...c.variation, ...patch } } : c,
      ),
    );
  }

  function setCardBg(i: number, bg: ReelBg) {
    setCards((prev) =>
      prev.map((c, j) => {
        if (j !== i) return c;
        // When switching INTO custom for the first time, seed the
        // hex codes with the defaults so the color inputs have
        // something to show. Preserves whatever the user already
        // picked if they're toggling back.
        if (bg === "custom" && !c.customBg) {
          return {
            ...c,
            bg,
            customBg: DEFAULT_CUSTOM_BG,
            customAccent: c.customAccent ?? DEFAULT_CUSTOM_ACCENT,
          };
        }
        return { ...c, bg };
      }),
    );
  }

  function setCardCustomBg(i: number, hex: string) {
    setCards((prev) =>
      prev.map((c, j) => (j === i ? { ...c, customBg: hex } : c)),
    );
  }

  function setCardCustomAccent(i: number, hex: string) {
    setCards((prev) =>
      prev.map((c, j) => (j === i ? { ...c, customAccent: hex } : c)),
    );
  }

  async function handleExport(cardIdx: number, format: "mp4" | "png") {
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
    addFavorite({
      variation: c.variation,
      bg: c.bg,
      customBg: c.customBg,
      customAccent: c.customAccent,
    });
    setFavorites(loadFavorites());
  }

  // Queue a Coach Mode pending draft from the variation. Hook +
  // caption sections get flattened into SlideContent[] so Coach
  // Mode's structural-fingerprint pipeline (format, hook style,
  // named entities, bolded terms, CTA pattern) runs the same way it
  // does on Post Builder carousels.
  function handleSendToTracker(cardIdx: number) {
    const c = cards[cardIdx];
    if (!c) return;
    addPendingDraft({
      title: cleanTitle(c.variation.hookHeadline),
      slides: slidesFromReel(c.variation),
    });
    setCardStatus(cardIdx, { sendStatus: "sent" });
    window.setTimeout(
      () => setCardStatus(cardIdx, { sendStatus: "idle" }),
      2400,
    );
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
      alert("Export failed — try again.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reel Builder</h1>
          <p className="text-sm text-gray-600">
            Same input as Post Builder → 3 single-screen reel covers + matching
            long-form captions, ready to upload to Instagram.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp("how-to")}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            How to use
          </button>
          <button
            type="button"
            onClick={() => setShowHelp("capcut")}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            DIY in CapCut
          </button>
        </div>
      </header>

      <WelcomeBanner
        storageKey="welcome_reel_builder_v1"
        title="👋 Welcome to Reel Builder"
        steps={[
          {
            label: "Set your profile (left panel)",
            detail:
              "Same profile as Post Builder — avatar, display name, handle, verified check, font. Edits here propagate to Post Builder covers too. Replace the 'Your Name' placeholder before you generate so reels carry your real identity.",
          },
          {
            label: "Paste your 10-section ghostwriter output",
            detail:
              "Same input you'd feed Post Builder. Click Generate 3 Reels — Claude returns 3 hook variations + matching long-form captions, each tuned to a different angle.",
          },
          {
            label: "Edit + customize each variation",
            detail:
              "Headline, subtitle, caption, background (7 palettes + custom hex), and accent color are all editable per card. Wrap words in **double asterisks** to highlight them in the accent color on the cover.",
          },
          {
            label: "Download + send to tracker",
            detail:
              "Each card has Download MP4 (7-second 1080×1920 static loop with silent audio) and a PNG fallback. Send-to-tracker queues the reel in Coach Mode like a Post Builder carousel.",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <ProfileEditor profile={profile} onChange={setProfile} />
        </aside>

        <section className="space-y-5">
          <RecentReels
            history={history}
            activeId={activeHistoryId}
            onLoad={handleLoadHistory}
            onDelete={handleDeleteHistory}
          />

          {favorites.length > 0 && (
            <FavoritesStrip
              favorites={favorites}
              profile={profile}
              onRemove={handleRemoveFavorite}
              onExport={handleExportFavorite}
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {cards.map((c, i) => (
                <VariationCard
                  key={i}
                  index={i}
                  card={c}
                  profile={profile}
                  onExport={handleExport}
                  onSaveFavorite={handleSaveFavorite}
                  onSendToTracker={handleSendToTracker}
                  onPatchVariation={patchVariation}
                  onSetBg={setCardBg}
                  onSetCustomBg={setCardCustomBg}
                  onSetCustomAccent={setCardCustomAccent}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Hidden full-size export nodes — one per visible card + one per favorite */}
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
              customBg={c.customBg}
              customAccent={c.customAccent}
              headline={c.variation.hookHeadline}
              subtitle={c.variation.hookSubtitle}
              profile={profile}
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
              customBg={f.customBg}
              customAccent={f.customAccent}
              headline={f.variation.hookHeadline}
              subtitle={f.variation.hookSubtitle}
              profile={profile}
            />
          </div>
        ))}
      </div>

      <ReelGuides open={showHelp} onChange={setShowHelp} />
    </div>
  );
}

function buildInitialCards(result: ReelGenerationResult): CardState[] {
  return result.variations.slice(0, 3).map((v, i) => ({
    bg: defaultBgForIndex(i),
    variation: v,
    exportStatus: null,
    exportBusy: false,
    sendStatus: "idle",
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

interface BgPickerProps {
  value: ReelBg;
  customBg?: string;
  customAccent?: string;
  onChange: (next: ReelBg) => void;
  onCustomBgChange: (hex: string) => void;
  onCustomAccentChange: (hex: string) => void;
}

// Multi-color gradient used for the "custom" swatch when the user
// hasn't picked a color yet — signals "any color you want."
const CUSTOM_PREVIEW_GRADIENT =
  "linear-gradient(135deg, #ec4899 0%, #f59e0b 33%, #10b981 66%, #3b82f6 100%)";

function BgPicker({
  value,
  customBg,
  customAccent,
  onChange,
  onCustomBgChange,
  onCustomAccentChange,
}: BgPickerProps) {
  const customPalette = paletteFor("custom", customBg, customAccent);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {REEL_BG_ORDER.map((bg) => {
          const active = value === bg;
          const isCustom = bg === "custom";
          // For custom: show the user's picked bg if any, else a
          // rainbow gradient as a "pick your own" affordance.
          const swatchStyle: React.CSSProperties = isCustom
            ? customBg
              ? { background: customPalette.bg }
              : { background: CUSTOM_PREVIEW_GRADIENT }
            : { background: REEL_BG_PALETTES[bg].bg };
          return (
            <button
              key={bg}
              type="button"
              onClick={() => onChange(bg)}
              title={REEL_BG_LABELS[bg]}
              aria-label={`Set background to ${REEL_BG_LABELS[bg]}`}
              className={`h-7 w-7 rounded-full border-2 transition ${
                active
                  ? "border-gray-900 scale-110"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              style={{
                ...swatchStyle,
                boxShadow: active ? "0 0 0 2px white inset" : undefined,
              }}
            />
          );
        })}
      </div>
      {value === "custom" && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-700">
            <span>BG</span>
            <input
              type="color"
              value={customPalette.bg}
              onChange={(e) => onCustomBgChange(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-gray-300"
              aria-label="Custom background color"
            />
            <code className="text-[10px] uppercase text-gray-500">
              {customPalette.bg}
            </code>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-700">
            <span>Accent</span>
            <input
              type="color"
              value={customPalette.accent}
              onChange={(e) => onCustomAccentChange(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-gray-300"
              aria-label="Custom accent color"
            />
            <code className="text-[10px] uppercase text-gray-500">
              {customPalette.accent}
            </code>
          </label>
        </div>
      )}
    </div>
  );
}

interface VariationCardProps {
  index: number;
  card: CardState;
  profile: PostBuilderProfile;
  onExport: (idx: number, format: "mp4" | "png") => void;
  onSaveFavorite: (idx: number) => void;
  onSendToTracker: (idx: number) => void;
  onPatchVariation: (idx: number, patch: Partial<ReelVariation>) => void;
  onSetBg: (idx: number, bg: ReelBg) => void;
  onSetCustomBg: (idx: number, hex: string) => void;
  onSetCustomAccent: (idx: number, hex: string) => void;
}

function VariationCard({
  index,
  card,
  profile,
  onExport,
  onSaveFavorite,
  onSendToTracker,
  onPatchVariation,
  onSetBg,
  onSetCustomBg,
  onSetCustomAccent,
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
          customBg={card.customBg}
          customAccent={card.customAccent}
          headline={card.variation.hookHeadline}
          subtitle={card.variation.hookSubtitle}
          profile={profile}
          scale={PREVIEW_SCALE}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-gray-500">
          Variation {index + 1} ·{" "}
          {HOOK_ANGLE_LABELS[card.variation.angle] ?? card.variation.angle}
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

      <BgPicker
        value={card.bg}
        customBg={card.customBg}
        customAccent={card.customAccent}
        onChange={(bg) => onSetBg(index, bg)}
        onCustomBgChange={(hex) => onSetCustomBg(index, hex)}
        onCustomAccentChange={(hex) => onSetCustomAccent(index, hex)}
      />

      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Headline
        <input
          type="text"
          value={card.variation.hookHeadline}
          onChange={(e) =>
            onPatchVariation(index, { hookHeadline: e.target.value })
          }
          placeholder="Your reel headline"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-bold text-gray-900"
        />
      </label>

      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Subtitle
        <input
          type="text"
          value={card.variation.hookSubtitle}
          onChange={(e) =>
            onPatchVariation(index, { hookSubtitle: e.target.value })
          }
          placeholder="Optional one-liner"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
        />
      </label>
      <p className="-mt-2 text-[10px] text-gray-500">
        Wrap words in <code>**double asterisks**</code> to highlight them in
        the accent color on the cover.
      </p>

      <ReelCaptionPreview
        caption={card.variation.caption}
        onChange={(next) => onPatchVariation(index, { caption: next })}
      />

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
        <button
          type="button"
          onClick={() => onSendToTracker(index)}
          className={`w-full rounded border px-3 py-1.5 text-xs font-medium transition ${
            card.sendStatus === "sent"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          title="Queue this reel in Coach Mode → Performance Tracker. You'll add the time posted + metrics later."
        >
          {card.sendStatus === "sent" ? "✓ Sent to tracker" : "Send to tracker"}
        </button>
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
  profile: PostBuilderProfile;
  onRemove: (id: string) => void;
  onExport: (favIdx: number, format: "mp4" | "png") => void;
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
                  customBg={f.customBg}
                  customAccent={f.customAccent}
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
