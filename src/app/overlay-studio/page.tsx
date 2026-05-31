"use client";

// Overlay Studio (beta) — media-first carousel/reel builder using the
// user's own photos. Layout mirrors Post Builder + Reel Builder:
//   left sidebar = ProfileEditor + Studio settings + Upload + (optional) AI prompt
//   right column = slide preview grid + per-slide editors + caption
//   header      = title + Beta badge + ExportBar
//
// Output is 1080×1350 (post) OR 1080×1920 (reel cover), chosen via a
// toggle in settings. Profile chip rides on each slide using the SAME
// postBuilder.profile the rest of the app reads/writes, so face / name
// / blue check stay consistent across Post Builder, Reel Builder, and
// Overlay Studio.

import { useEffect, useRef, useState } from "react";
import { ensureChannelsInitialized } from "@/app/coach/lib/channels";
import { installCustomData } from "@/app/coach/lib/customization";
import ProfileEditor from "@/components/post-builder/ProfileEditor";
import { DEFAULT_PROFILE, type PostBuilderProfile } from "@/lib/post-templates";
import {
  loadSettings,
  saveSettings,
} from "@/app/overlay-studio/lib/overlayStorage";
import {
  DEFAULT_SETTINGS,
  OUTPUT_DIMENSIONS,
  type OverlayMedia,
  type OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";
import {
  compressMediaForHistory,
  deleteOverlayHistory,
  loadOverlayHistory,
  promoteOverlayHistory,
  pushOverlayHistory,
  updateCurrentOverlayHistory,
  type SavedOverlayBatch,
} from "@/app/overlay-studio/lib/overlayHistory";
import OverlaySetupPanel from "./components/OverlaySetupPanel";
import OverlayUpload from "./components/OverlayUpload";
import OverlayUrlImport from "./components/OverlayUrlImport";
import OverlayPromptPanel from "./components/OverlayPromptPanel";
import OverlayMediaCard from "./components/OverlayMediaCard";
import OverlaySlideRender from "./components/OverlaySlideRender";
import OverlayCaptionPanel from "./components/OverlayCaptionPanel";
import OverlayExportBar from "./components/OverlayExportBar";
import RecentOverlays from "./components/RecentOverlays";

// Loaded for canvas-accurate export (preview + zip share the same DOM).
const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Inter:wght@400;500;600;700;900&family=Work+Sans:wght@400;500;600;700&display=swap');
`;

const PREVIEW_GRID_W = 220;

export default function OverlayStudioPage() {
  const [profile, setProfile] = useState<PostBuilderProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [media, setMedia] = useState<OverlayMedia[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [history, setHistory] = useState<SavedOverlayBatch[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Offscreen full-size export refs, one per slide.
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  exportRefs.current = media.map((_, i) => exportRefs.current[i] ?? null);

  useEffect(() => {
    ensureChannelsInitialized();
    installCustomData();
    setSettings(loadSettings());
    setHistory(loadOverlayHistory());
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Ref-guarded so a same-tick race (push + caption keystroke) can't
  // create two entries before activeHistoryId propagates.
  const pushingRef = useRef(false);

  // Clear the active batch id whenever media empties — a subsequent
  // upload should start a brand-new batch, not overwrite the previous.
  useEffect(() => {
    if (media.length === 0 && activeHistoryId) {
      setActiveHistoryId(null);
    }
  }, [media.length, activeHistoryId]);

  // Auto-push: first photo of a fresh session creates a new history
  // entry; subsequent edits debounce-update it in place.
  useEffect(() => {
    if (media.length === 0 || activeHistoryId || pushingRef.current) return;
    pushingRef.current = true;
    let cancelled = false;
    (async () => {
      const compressed = await compressMediaForHistory(media);
      if (cancelled) {
        pushingRef.current = false;
        return;
      }
      const entry = pushOverlayHistory(
        compressed,
        caption,
        firstComment,
        settings,
      );
      setActiveHistoryId(entry.id);
      setHistory(loadOverlayHistory());
      pushingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [media, activeHistoryId, caption, firstComment, settings]);

  // Debounced in-place save while the user edits the current batch.
  useEffect(() => {
    if (!activeHistoryId || media.length === 0) return;
    const t = setTimeout(async () => {
      const compressed = await compressMediaForHistory(media);
      updateCurrentOverlayHistory({
        media: compressed,
        caption,
        firstComment,
        settings,
      });
      setHistory(loadOverlayHistory());
    }, 1400);
    return () => clearTimeout(t);
  }, [media, caption, firstComment, settings, activeHistoryId]);

  function handleLoadHistoryEntry(entry: SavedOverlayBatch) {
    const next = promoteOverlayHistory(entry.id);
    setHistory(next);
    setMedia(entry.media);
    setCaption(entry.caption);
    setFirstComment(entry.firstComment);
    setSettings(entry.settings);
    setSelectedId(entry.media[0]?.id ?? null);
    setActiveHistoryId(entry.id);
  }

  function handleDeleteHistoryEntry(id: string) {
    const next = deleteOverlayHistory(id);
    setHistory(next);
    if (activeHistoryId === id) setActiveHistoryId(null);
  }

  // Keep the selected slide in sync with the media list.
  useEffect(() => {
    if (media.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !media.some((m) => m.id === selectedId)) {
      setSelectedId(media[0].id);
    }
  }, [media, selectedId]);

  const dim = OUTPUT_DIMENSIONS[settings.outputFormat];
  const selected = media.find((m) => m.id === selectedId) ?? null;
  const selectedIdx = media.findIndex((m) => m.id === selectedId);

  function updateMedia(id: string, patch: Partial<OverlayMedia>) {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function moveMedia(idx: number, dir: -1 | 1) {
    setMedia((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [m] = next.splice(idx, 1);
      next.splice(target, 0, m);
      return next;
    });
  }

  function deleteMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Overlay Studio</h1>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Upload your photos → drop the words on top → download a finished
            carousel or reel cover. Works for both formats.
          </p>
        </div>
        <OverlayExportBar
          format={settings.outputFormat}
          slideCount={media.length}
          getSlideNodes={() => exportRefs.current}
          caption={caption}
          firstComment={firstComment}
          listingNickname={settings.listingNickname}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <ProfileEditor profile={profile} onChange={setProfile} />
          <OverlaySetupPanel settings={settings} onChange={setSettings} />
          <OverlayUpload media={media} onSet={setMedia} />
          <OverlayUrlImport
            media={media}
            format={settings.outputFormat}
            onSet={setMedia}
          />
          <OverlayPromptPanel
            settings={settings}
            media={media}
            onMerge={setMedia}
            onCaption={(c, fc) => {
              setCaption(c);
              setFirstComment(fc);
            }}
          />
        </aside>

        <section className="space-y-4">
          <RecentOverlays
            history={history}
            activeId={activeHistoryId}
            onLoad={handleLoadHistoryEntry}
            onDelete={handleDeleteHistoryEntry}
          />
          {/* Slide preview grid — same shape as Post Builder's grid */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">
                Slide preview
              </div>
              <div className="text-xs text-gray-500">
                {media.length} slide{media.length === 1 ? "" : "s"} ·{" "}
                {dim.label}
              </div>
            </div>
            {media.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                Drop photos into the upload area on the left — your slide
                grid will appear here.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {media.map((m, i) => {
                  const active = m.id === selectedId;
                  const scale = PREVIEW_GRID_W / dim.w;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`group relative overflow-hidden rounded-lg ring-2 transition ${
                        active
                          ? "ring-gray-900"
                          : "ring-transparent hover:ring-gray-300"
                      }`}
                      style={{
                        width: PREVIEW_GRID_W,
                        height: dim.h * scale,
                      }}
                      aria-label={`Select slide ${i + 1}`}
                    >
                      <div
                        style={{
                          width: PREVIEW_GRID_W,
                          height: dim.h * scale,
                          overflow: "hidden",
                        }}
                      >
                        <OverlaySlideRender
                          media={m}
                          format={settings.outputFormat}
                          slideNumber={i + 1}
                          profile={profile}
                          showProfile={settings.showProfile}
                          scale={scale}
                        />
                      </div>
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected slide editor */}
          {selected && (
            <OverlayMediaCard
              media={selected}
              index={selectedIdx}
              total={media.length}
              format={settings.outputFormat}
              profile={profile}
              showProfile={settings.showProfile}
              onChange={(patch) => updateMedia(selected.id, patch)}
              onMoveUp={() => moveMedia(selectedIdx, -1)}
              onMoveDown={() => moveMedia(selectedIdx, 1)}
              onDelete={() => deleteMedia(selected.id)}
            />
          )}

          <OverlayCaptionPanel
            media={media}
            settings={settings}
            caption={caption}
            firstComment={firstComment}
            onChange={(next) => {
              setCaption(next.caption);
              setFirstComment(next.firstComment);
            }}
          />
        </section>
      </div>

      {/* Hidden full-size export nodes */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}
      >
        {media.map((m, i) => (
          <div
            key={`export-${m.id}`}
            ref={(el) => {
              exportRefs.current[i] = el;
            }}
            style={{ width: dim.w, height: dim.h }}
          >
            <OverlaySlideRender
              media={m}
              format={settings.outputFormat}
              slideNumber={i + 1}
              profile={profile}
              showProfile={settings.showProfile}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
