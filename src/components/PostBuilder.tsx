"use client";

import { useMemo, useRef, useState } from "react";
import { CarouselSlide, SLIDE_HEIGHT, SLIDE_WIDTH } from "@/components/CarouselSlide";
import {
  DEFAULT_PARAMS,
  DEFAULT_PROFILE,
  attachIds,
  type PostBuilderParams,
  type PostBuilderProfile,
  type RawCarouselPost,
  type Slide,
} from "@/lib/post-templates";
import ProfileEditor from "@/components/post-builder/ProfileEditor";
import ParamsPanel from "@/components/post-builder/ParamsPanel";
import InputPanel, {
  EMPTY_INPUT,
  type InputState,
} from "@/components/post-builder/InputPanel";
import SlideEditor from "@/components/post-builder/SlideEditor";
import SlidePreviewGrid from "@/components/post-builder/SlidePreviewGrid";
import CaptionPanel from "@/components/post-builder/CaptionPanel";
import ExportBar from "@/components/post-builder/ExportBar";

interface AnalyzeOk {
  ok: true;
  post: RawCarouselPost;
}
interface AnalyzeErr {
  ok: false;
  code: string;
  message: string;
  rawText?: string;
}
type AnalyzeResponse = AnalyzeOk | AnalyzeErr;

interface IgOk {
  ok: true;
  result: { caption: string | null; imageUrls: string[]; author: string | null; source: string };
}
interface IgErr {
  ok: false;
  code: string;
  message: string;
}
type IgResponse = IgOk | IgErr;

export default function PostBuilder() {
  const [profile, setProfile] = useState<PostBuilderProfile>(DEFAULT_PROFILE);
  const [params, setParams] = useState<PostBuilderParams>(DEFAULT_PARAMS);
  const [input, setInput] = useState<InputState>(EMPTY_INPUT);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [igStatus, setIgStatus] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Hidden full-size render targets for PNG export. Each ref is 1080x1350 (4:5 portrait).
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  exportRefs.current = slides.map((_, i) => exportRefs.current[i] ?? null);

  const selected = useMemo(
    () => slides.find((s) => s.id === selectedId) ?? null,
    [slides, selectedId],
  );

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { params };
      if (input.topic) payload.topic = input.topic;
      if (input.mode === "screenshots" && input.images.length > 0) {
        payload.competitorImages = input.images;
      } else if (input.mode === "text" && input.text.trim()) {
        payload.competitorText = input.text.trim();
      } else if (input.mode === "raw" && input.raw.trim()) {
        payload.rawSource = input.raw.trim();
      } else if (input.mode === "instagram" && input.igUrl) {
        setError("Resolve the Instagram URL first, then generate.");
        setBusy(false);
        return;
      } else {
        setError("Add some input — screenshots, text, or a resolved IG post.");
        setBusy(false);
        return;
      }

      const resp = await fetch("/api/post-builder/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as AnalyzeResponse;
      if (!data.ok) {
        setError(`${data.code}: ${data.message}`);
        return;
      }
      const post = attachIds(data.post);
      setSlides(post.slides);
      setCaption(post.caption);
      setHooks(post.hooks);
      setSelectedId(post.slides[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFetchIg() {
    setIgStatus("Fetching…");
    try {
      const resp = await fetch("/api/post-builder/fetch-ig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.igUrl }),
      });
      const data = (await resp.json()) as IgResponse;
      if (!data.ok) {
        setIgStatus(`${data.code}: ${data.message}`);
        return;
      }
      const caption = data.result.caption ?? "";
      const images: string[] = [];
      for (const url of data.result.imageUrls) {
        try {
          // IG CDN blocks browser CORS — proxy through our server.
          const r = await fetch(
            `/api/proxy-image?url=${encodeURIComponent(url)}`,
          );
          const blob = await r.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          images.push(dataUrl);
        } catch {
          // skip
        }
      }
      setInput({
        ...input,
        mode: images.length > 0 ? "screenshots" : "text",
        text: input.text || caption,
        images: [...input.images, ...images],
      });
      setIgStatus(
        `Resolved via ${data.result.source}. Switched you to ${images.length > 0 ? "Screenshots" : "Paste text"} tab.`,
      );
    } catch (err) {
      setIgStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function updateSlide(id: string, next: Slide) {
    setSlides((prev) => prev.map((s) => (s.id === id ? next : s)));
  }

  function deleteSlide(id: string) {
    setSlides((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function moveSlide(id: string, dir: -1 | 1) {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const selectedIdx = slides.findIndex((s) => s.id === selectedId);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post builder</h1>
          <p className="text-sm text-gray-600">
            Paste a competitor post → get your carousel in your template.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            How to use
          </button>
          <ExportBar
            slideCount={slides.length}
            getSlideNodes={() =>
              exportRefs.current.filter((n): n is HTMLDivElement => !!n)
            }
          />
        </div>
      </header>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">How to use the Post Builder</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
              <li>
                <span className="font-semibold text-gray-900">Set up your profile (one-time).</span>{" "}
                Open the Profile panel on the left, upload your avatar photo, type
                your display name and handle, and toggle the verified check if
                you want it. Saved automatically — only do this once.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Pick your inputs.</span>{" "}
                In the Input panel pick a tab: <em>Screenshots</em> (drop a competitor
                post image), <em>Paste text</em> (write or paste long-form copy),{" "}
                <em>Instagram URL</em> (we&apos;ll resolve it), or <em>Topic</em> (give
                Claude an angle and let it write from scratch).
              </li>
              <li>
                <span className="font-semibold text-gray-900">Hit Generate.</span>{" "}
                Claude rewrites your input into 6-10 short, punchy slides at a
                3rd-grade reading level. Slide 1 is always a big cover hook;
                final slide is always a CTA.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Tweak any slide.</span>{" "}
                Click a slide in the grid → edit the copy in the right-side
                editor. For the cover slide you can also pick a background:
                White, Yellow, Dark, Cream, Forest, or Navy. Bold accent
                color is automatic.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Download.</span>{" "}
                Hit <em>Download all (zip)</em> to grab every slide as a 1080×1350
                PNG, or <em>Download each</em> to save them one at a time. Caption
                + 3 hook variations are in the right column for copy-paste into
                Instagram.
              </li>
            </ol>
            <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span className="font-semibold">Tip:</span> Every cover background option is contrast-tested for legibility, so pick whichever matches your brand or the post&apos;s mood.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <ProfileEditor profile={profile} onChange={setProfile} />
          <ParamsPanel params={params} onChange={setParams} />
          <InputPanel
            value={input}
            onChange={setInput}
            busy={busy}
            onGenerate={onGenerate}
            onFetchIg={onFetchIg}
            igStatus={igStatus}
          />
        </aside>

        <section className="space-y-4">
          <SlidePreviewGrid
            slides={slides}
            profile={profile}
            params={params}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {selected && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-gray-700">
                Edit slide {selectedIdx + 1}
              </div>
              <SlideEditor
                slide={selected}
                onChange={(s) => updateSlide(selected.id, s)}
                onDelete={() => deleteSlide(selected.id)}
                onMoveUp={selectedIdx > 0 ? () => moveSlide(selected.id, -1) : undefined}
                onMoveDown={
                  selectedIdx < slides.length - 1
                    ? () => moveSlide(selected.id, 1)
                    : undefined
                }
              />
            </div>
          )}

          <CaptionPanel
            caption={caption}
            hooks={hooks}
            onCaptionChange={setCaption}
            onHookChange={(i, v) =>
              setHooks((prev) => prev.map((h, j) => (j === i ? v : h)))
            }
          />
        </section>
      </div>

      {/* Hidden full-size slides for PNG export. Positioned off-screen. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              exportRefs.current[i] = el;
            }}
            style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
          >
            <CarouselSlide slide={s} profile={profile} />
          </div>
        ))}
      </div>
    </div>
  );
}
