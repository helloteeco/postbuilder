"use client";

// Overlay Studio (beta) — image-overlay carousel builder for Teeco's
// design service. Mirrors the Post Builder / Reel Builder shell so it
// feels familiar; sits at /overlay-studio after Reel Builder in the
// top nav. Does NOT touch any other feature's storage or logic.
//
// Phase 1 + the prompt loop. Video (Phase 5) and the design-lead
// tracker (Phase 4) are deferred to follow-up commits.

import { useEffect, useRef, useState } from "react";
import { ensureChannelsInitialized } from "@/app/coach/lib/channels";
import { installCustomData } from "@/app/coach/lib/customization";
import {
  loadSettings,
  saveSettings,
} from "@/app/overlay-studio/lib/overlayStorage";
import type {
  OverlayMedia,
  OverlaySettings,
} from "@/app/overlay-studio/lib/overlayTypes";
import { DEFAULT_SETTINGS } from "@/app/overlay-studio/lib/overlayTypes";
import OverlayStepper from "./components/OverlayStepper";
import OverlaySetup from "./components/OverlaySetup";
import OverlayUpload from "./components/OverlayUpload";
import OverlayPromptPanel from "./components/OverlayPromptPanel";
import OverlayMediaCard from "./components/OverlayMediaCard";
import OverlaySlideRender, {
  SLIDE_H,
  SLIDE_W,
} from "./components/OverlaySlideRender";
import OverlayCaptionPanel from "./components/OverlayCaptionPanel";
import OverlayExport from "./components/OverlayExport";
import WelcomeBanner from "@/components/WelcomeBanner";

// Loaded for canvas-accurate export (preview + zip share the same DOM).
// Pulled via @import in a style tag so we don't have to touch the
// shared root layout. Browsers cache aggressively after first hit.
const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Inter:wght@400;500;600;700;900&family=Work+Sans:wght@400;500;600;700&display=swap');
`;

export default function OverlayStudioPage() {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [media, setMedia] = useState<OverlayMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [audioVibe, setAudioVibe] = useState("");

  // Refs to the hidden 1080×1350 export nodes, one per slide. The zip
  // exporter pulls the live nodes via this same array.
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  exportRefs.current = media.map((_, i) => exportRefs.current[i] ?? null);

  useEffect(() => {
    ensureChannelsInitialized();
    installCustomData();
    setSettings(loadSettings());
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function updateMedia(idx: number, patch: Partial<OverlayMedia>) {
    setMedia((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
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

  function deleteMedia(idx: number) {
    setMedia((prev) => prev.filter((_, i) => i !== idx));
  }

  // Light "where are you" hint for the stepper.
  const activeStep =
    media.length === 0
      ? 2
      : caption.length === 0 && !media.some((m) => m.headline)
        ? 4
        : 5;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Overlay Studio</h1>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            Beta
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Upload your photos. We&apos;ll figure out where to put the words so
          they pop, then ship a finished, on-brand carousel — ready to post
          by hand.
        </p>
      </header>

      <OverlayStepper active={activeStep} />

      <WelcomeBanner
        storageKey="welcome_overlay_studio_v1"
        title="👋 Welcome to Overlay Studio (beta)"
        steps={[
          {
            label: "Tell it who this post is for",
            detail:
              "Pick audience, pillar, and ONE CTA. The prompt + caption follow what you set here.",
          },
          {
            label: "Drop in 6–10 of your best photos",
            detail:
              "Drag in files, or use the Claude Chrome extension to pull from a listing. The photo input is a real file picker the agent can drop straight into.",
          },
          {
            label: "Let Claude draft the overlay text",
            detail:
              "Copy the prompt, paste it into Claude.ai with your photos attached, paste the JSON back here. Or skip it and type headlines yourself.",
          },
          {
            label: "Audit each slide + export",
            detail:
              "Live preview per slide — nudge position, swap color, change the style preset. Then download the zip, AirDrop to your phone, and post. Pick the music on Instagram.",
          },
        ]}
      />

      <OverlaySetup settings={settings} onChange={setSettings} />
      <OverlayUpload media={media} onAdd={setMedia} />
      <OverlayPromptPanel
        settings={settings}
        media={media}
        onMerge={setMedia}
        onCaption={(c, fc, av) => {
          setCaption(c);
          setFirstComment(fc);
          setAudioVibe(av);
        }}
      />

      {media.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Step 5 — Audit each slide
          </div>
          <div className="space-y-3">
            {media.map((m, i) => (
              <OverlayMediaCard
                key={m.id}
                media={m}
                index={i}
                total={media.length}
                onChange={(patch) => updateMedia(i, patch)}
                onMoveUp={() => moveMedia(i, -1)}
                onMoveDown={() => moveMedia(i, 1)}
                onDelete={() => deleteMedia(i)}
              />
            ))}
          </div>
        </section>
      )}

      {media.length > 0 && (
        <OverlayExport
          getNodes={() => exportRefs.current}
          caption={caption}
          firstComment={firstComment}
          audioVibe={audioVibe}
          listingNickname={settings.listingNickname}
        />
      )}

      <OverlayCaptionPanel
        caption={caption}
        firstComment={firstComment}
        audioVibe={audioVibe}
        onChange={(next) => {
          setCaption(next.caption);
          setFirstComment(next.firstComment);
          setAudioVibe(next.audioVibe);
        }}
      />

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
        <div className="font-semibold uppercase tracking-wider text-blue-800">
          Step 7 — Post on Instagram
        </div>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>AirDrop / send the zip to your phone.</li>
          <li>Open Instagram → New post → Carousel → select the slides in order.</li>
          <li>Paste the caption above.</li>
          <li>Pick your music vibe (Instagram does this on the phone — we can&apos;t attach audio for you).</li>
          <li>After posting, paste the first comment with the booking link.</li>
        </ol>
      </div>

      {/* Hidden full-size export nodes — one per slide */}
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
            style={{ width: SLIDE_W, height: SLIDE_H }}
          >
            <OverlaySlideRender media={m} slideNumber={i + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
