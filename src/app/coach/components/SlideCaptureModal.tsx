// Modal for attaching slide content to a logged post. Two tabs:
//   1. Link to a Post Builder draft — reads the user's saved drafts
//      from postBuilder.history (READ-ONLY, never written) and lets
//      them click one to import.
//   2. Paste manually — textarea + parse button + preview.
//
// On save, the slides are stored on the LoggedPost via replacePost(),
// and contentAnalysis is computed and stored alongside.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadLoggedPosts,
  replacePost,
  type ContentAnalysis,
  type LoggedPost,
  type SlideContent,
} from "@/app/coach/lib/storage";
import {
  analyzeContent,
  parseManualSlides,
  slidesFromPostBuilder,
} from "@/app/coach/lib/contentAnalysis";
import { loadHistory, type SavedPost } from "@/lib/post-history";

interface Props {
  open: boolean;
  postId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "link" | "paste" | "upload";

export default function SlideCaptureModal({
  open,
  postId,
  onClose,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<Tab>("link");
  const [drafts, setDrafts] = useState<SavedPost[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<SlideContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Upload tab state — JPEG-compressed data URLs of dropped/picked
  // images, plus extraction status.
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Reset form state every time the modal opens for a (potentially
  // different) post.
  useEffect(() => {
    if (!open) return;
    setTab("link");
    setPasteText("");
    setParsed(null);
    setError(null);
    setUploadedImages([]);
    setExtracting(false);
    try {
      setDrafts(loadHistory());
    } catch {
      setDrafts([]);
    }
  }, [open, postId]);

  const post: LoggedPost | null = useMemo(() => {
    if (!postId) return null;
    return loadLoggedPosts().find((p) => p.id === postId) ?? null;
  }, [postId, open]);

  if (!open || !post) return null;

  // Compress a data URL to a max-1600px JPEG so iPhone screenshots
  // (~5-10MB each) fit inside Vercel's 4.5MB request body limit when
  // we POST to /api/coach/extract-slides. Identical approach to the
  // Post Builder's compress flow — kept inline here to avoid coupling
  // the two features.
  async function compressImageDataUrl(
    dataUrl: string,
    maxDim = 1600,
    quality = 0.85,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = dataUrl;
    });
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    try {
      const compressed = await Promise.all(
        arr.map(async (f) => {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((res, rej) => {
            reader.onload = () => res(reader.result as string);
            reader.onerror = () => rej(new Error("Could not read file"));
            reader.readAsDataURL(f);
          });
          return compressImageDataUrl(dataUrl);
        }),
      );
      setUploadedImages((prev) => [...prev, ...compressed]);
    } catch (e) {
      setError(
        `Couldn't read one of the images: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  function removeUploadedImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveUploadedImage(index: number, direction: -1 | 1) {
    setUploadedImages((prev) => {
      const next = prev.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleExtract() {
    if (uploadedImages.length === 0) return;
    setExtracting(true);
    setError(null);
    try {
      const resp = await fetch("/api/coach/extract-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: uploadedImages }),
      });
      const rawText = await resp.text();
      if (!resp.ok) {
        if (resp.status === 413 || /entity too large|payload too large/i.test(rawText)) {
          setError(
            "Images too large even after compression. Try fewer images, or use the Paste tab.",
          );
          return;
        }
        setError(`Server error ${resp.status}: ${rawText.slice(0, 200)}`);
        return;
      }
      let data: { ok: true; texts: string[] } | { ok: false; code: string; message: string };
      try {
        data = JSON.parse(rawText);
      } catch {
        setError("Server returned an unexpected response.");
        return;
      }
      if (!data.ok) {
        setError(`${data.code}: ${data.message}`);
        return;
      }
      const slides: SlideContent[] = data.texts
        .map((t, i) => ({
          slideNumber: i + 1,
          text: t,
          isHook: i === 0,
          isCTA: i === data.texts.length - 1,
        }))
        .filter((s) => s.text.trim().length > 0);
      if (slides.length === 0) {
        setError(
          "Couldn't read any text from those images. Try clearer screenshots, or use the Paste tab.",
        );
        return;
      }
      // Renumber after filtering empties so slide 1 is whichever image
      // first had readable text.
      const renumbered = slides.map((s, i) => ({
        ...s,
        slideNumber: i + 1,
        isHook: i === 0,
        isCTA: i === slides.length - 1,
      }));
      setParsed(renumbered);
    } finally {
      setExtracting(false);
    }
  }

  function commit(slides: SlideContent[], draftId?: string) {
    if (!post) return;
    if (slides.length === 0) {
      setError("No slides parsed — paste at least one slide.");
      return;
    }
    const analysis = analyzeContent(slides);
    const updated: LoggedPost = {
      ...post,
      slides,
      contentAnalysis: analysis,
      postBuilderDraftId: draftId ?? post.postBuilderDraftId,
    };
    replacePost(updated);
    onSaved();
    onClose();
  }

  function clearSlides() {
    if (!post) return;
    if (
      !confirm(
        "Clear the slides + structural analysis from this post? Top Post Mode will fall back to metadata-only diagnosis until new slides are added.",
      )
    ) {
      return;
    }
    const updated: LoggedPost = {
      ...post,
      slides: undefined,
      contentAnalysis: undefined,
      postBuilderDraftId: undefined,
    };
    replacePost(updated);
    onSaved();
    onClose();
  }

  const hasExistingSlides = (post.slides?.length ?? 0) > 0;

  function handleLinkDraft(draft: SavedPost) {
    const slides = slidesFromPostBuilder(draft.slides);
    commit(slides, draft.id);
  }

  function handleParse() {
    setError(null);
    const slides = parseManualSlides(pasteText);
    if (slides.length === 0) {
      setError("Couldn't parse any slides from that input.");
      setParsed(null);
      return;
    }
    if (slides.length === 1) {
      setError(
        "Only got 1 slide back — try separating slides with blank lines, '---', or 'Slide N:' markers.",
      );
    }
    setParsed(slides);
  }

  function handleSavePasted() {
    if (!parsed) return;
    commit(parsed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Add slide content
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-gray-900">
              {post.title || "(untitled post)"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Top Post Mode runs structural analysis on these slides — format
              type, named cities, dollar amounts, hook style, CTA pattern — to
              generate way more specific follow-up recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasExistingSlides && (
              <button
                type="button"
                onClick={clearSlides}
                className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                title="Remove the slides + structural analysis from this post"
              >
                Clear slides
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>

        {hasExistingSlides && (
          <CapturedContentView
            slides={post.slides ?? []}
            analysis={post.contentAnalysis}
          />
        )}

        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          {hasExistingSlides ? "Replace with new content" : "Add slide content"}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("link")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              tab === "link"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Link a Post Builder draft
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              tab === "upload"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Upload slide images
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              tab === "paste"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Paste slides manually
          </button>
        </div>

        {tab === "link" && (
          <LinkTab drafts={drafts} onPick={handleLinkDraft} />
        )}

        {tab === "upload" && (
          <UploadTab
            images={uploadedImages}
            extracting={extracting}
            parsed={parsed}
            onFiles={handleFiles}
            onRemove={removeUploadedImage}
            onMove={moveUploadedImage}
            onExtract={handleExtract}
            onSave={() => parsed && commit(parsed)}
          />
        )}

        {tab === "paste" && (
          <PasteTab
            pasteText={pasteText}
            onPasteText={setPasteText}
            onParse={handleParse}
            parsed={parsed}
            onSave={handleSavePasted}
          />
        )}

        {error && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only view of the content currently captured on this post.
// Shows the actual slide-by-slide copy PLUS the structural fingerprint
// that contentAnalysis derived from it. This is the data that feeds
// Coach Mode's prompt builder (winner deep-study block + structural
// mirror rules) when the post is a top performer — so the user can
// verify exactly what's driving their prompts.
function CapturedContentView({
  slides,
  analysis,
}: {
  slides: SlideContent[];
  analysis?: ContentAnalysis;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
          Currently captured · {slides.length} slide{slides.length === 1 ? "" : "s"}
        </span>
        <span className="text-xs text-emerald-700">{open ? "Hide ▴" : "Show ▾"}</span>
      </button>

      {open && (
        <>
          <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/80">
            This is the exact copy + structure feeding your Coach Mode prompts.
            When this post is a top performer, the prompt builder mirrors this
            structure and pulls this slide text in as a deep-study model for
            new posts.
          </p>

          {/* Slide-by-slide copy */}
          <ol className="mt-3 space-y-2">
            {slides.map((s) => (
              <li
                key={s.slideNumber}
                className="rounded border border-emerald-200 bg-white p-2"
              >
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Slide {s.slideNumber}
                  {s.isHook ? " · hook" : s.isCTA ? " · CTA" : ""}
                </div>
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800">
                  {s.text || "(empty)"}
                </div>
              </li>
            ))}
          </ol>

          {/* Structural fingerprint */}
          {analysis && (
            <div className="mt-3 rounded border border-emerald-200 bg-white p-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Structural fingerprint (what the prompt builder reads)
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FpChip label="Format" value={fmtEnum(analysis.formatType)} />
                <FpChip label="Hook style" value={fmtEnum(analysis.hookStyle)} />
                <FpChip label="Slides" value={String(analysis.slideCount)} />
                <FpChip
                  label="Avg words/slide"
                  value={String(analysis.averageSlideLength)}
                />
                <FpChip
                  label="CTA"
                  value={
                    fmtEnum(analysis.ctaPattern) +
                    (analysis.ctaKeyword ? ` "${analysis.ctaKeyword}"` : "")
                  }
                />
              </div>
              <FpList label="Dollar amounts" items={analysis.dollarAmounts} />
              <FpList label="Percentages" items={analysis.percentages} />
              <FpList label="Years" items={analysis.yearReferences} />
              <FpList label="Named cities" items={analysis.namedCities} />
              <FpList label="Named people" items={analysis.namedPeople} />
              <FpList label="Named brands" items={analysis.namedBrands} />
              <FpList label="Bolded terms" items={analysis.boldedTerms} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmtEnum(v: string): string {
  return v.replace(/_/g, " ");
}

function FpChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-900">
      {label}: <span className="font-semibold">{value}</span>
    </span>
  );
}

function FpList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-1.5 text-[11px] text-gray-700">
      <span className="font-semibold text-emerald-800">{label}:</span>{" "}
      {items.join(", ")}
    </div>
  );
}

function LinkTab({
  drafts,
  onPick,
}: {
  drafts: SavedPost[];
  onPick: (d: SavedPost) => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No Post Builder drafts found in this browser. Either build a post in{" "}
        <a
          href="/post-builder"
          className="font-semibold text-gray-900 underline hover:no-underline"
        >
          Post Builder
        </a>{" "}
        first, or use the &ldquo;Paste slides manually&rdquo; tab above.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Pick a draft to import. The slide contents copy in — your Post
        Builder drafts stay untouched.
      </p>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200">
        {drafts.map((d) => {
          const headline =
            d.slides[0]?.type === "hook-opener"
              ? d.slides[0].headline
              : "(no cover headline)";
          return (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900">
                  {headline}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(d.savedAt).toLocaleString()} · {d.slides.length}{" "}
                  slides
                </div>
              </div>
              <button
                type="button"
                onClick={() => onPick(d)}
                className="rounded bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-black"
              >
                Link this draft
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PasteTab({
  pasteText,
  onPasteText,
  onParse,
  parsed,
  onSave,
}: {
  pasteText: string;
  onPasteText: (v: string) => void;
  onParse: () => void;
  parsed: SlideContent[] | null;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Paste your slides separated by blank lines, <code>---</code>, or{" "}
        <code>Slide N:</code> markers. Or paste the whole carousel — we&apos;ll
        figure it out.
      </p>
      <textarea
        value={pasteText}
        onChange={(e) => onPasteText(e.target.value)}
        rows={10}
        placeholder={
          "Slide 1:\n6 rural markets I'd actually buy\n\nSlide 2:\n…"
        }
        className="w-full rounded-lg border border-gray-300 p-3 font-mono text-xs leading-relaxed text-gray-800"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onParse}
          disabled={!pasteText.trim()}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          Parse slides
        </button>
        {parsed && parsed.length > 0 && (
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            Save {parsed.length} slide{parsed.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {parsed && parsed.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Preview ({parsed.length} slide{parsed.length === 1 ? "" : "s"})
          </div>
          <ol className="space-y-2 rounded border border-gray-200 p-3 text-xs text-gray-800">
            {parsed.map((s) => (
              <li key={s.slideNumber} className="border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Slide {s.slideNumber}
                  {s.isHook && " · hook"}
                  {s.isCTA && " · CTA"}
                </div>
                <pre className="mt-0.5 whitespace-pre-wrap font-sans">{s.text}</pre>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Upload tab ────────────────────────────────────────────────────────
//
// Drop zone + thumbnail strip + Extract button. The extracted text
// runs through the same analyzeContent pipeline as paste/link, so
// downstream behavior (structural diagnosis, follow-up suggestions,
// hook variants) is identical regardless of how the slides got in.

function UploadTab({
  images,
  extracting,
  parsed,
  onFiles,
  onRemove,
  onMove,
  onExtract,
  onSave,
}: {
  images: string[];
  extracting: boolean;
  parsed: SlideContent[] | null;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onExtract: () => void;
  onSave: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Drag slide screenshots in or click to pick. We&apos;ll read the
        text off each one with Claude Vision and feed it into the same
        structural analysis as the paste flow — so Coach Mode&apos;s
        recommendations work the same way regardless of how the slides
        get in.
      </p>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? "border-emerald-500 bg-emerald-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <div className="text-sm font-semibold text-gray-700">
          Drop slide images here
        </div>
        <div className="mt-1 text-xs text-gray-500">
          or click to pick — PNG, JPEG, HEIC; multiple files OK
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = ""; // allow re-uploading the same file
          }}
        />
      </div>

      {images.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {images.length} image{images.length === 1 ? "" : "s"} ·
              order = slide order
            </div>
            <button
              type="button"
              onClick={onExtract}
              disabled={extracting}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {extracting
                ? `Reading text from ${images.length} image${images.length === 1 ? "" : "s"}…`
                : `Extract text from ${images.length} image${images.length === 1 ? "" : "s"}`}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Slide ${i + 1}`}
                  className="h-24 w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {i + 1}
                </span>
                <div className="absolute right-1 top-1 flex gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(i, -1);
                    }}
                    disabled={i === 0}
                    className="rounded bg-white/90 px-1 text-[10px] font-bold text-gray-700 hover:bg-white disabled:opacity-30"
                    title="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(i, 1);
                    }}
                    disabled={i === images.length - 1}
                    className="rounded bg-white/90 px-1 text-[10px] font-bold text-gray-700 hover:bg-white disabled:opacity-30"
                    title="Move later"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(i);
                    }}
                    className="rounded bg-white/90 px-1 text-[10px] font-bold text-rose-700 hover:bg-white"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed && parsed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Extracted text — preview
            </div>
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              Save {parsed.length} slide{parsed.length === 1 ? "" : "s"}
            </button>
          </div>
          <ol className="space-y-2 rounded border border-gray-200 p-3 text-xs text-gray-800">
            {parsed.map((s) => (
              <li
                key={s.slideNumber}
                className="border-b border-gray-100 pb-2 last:border-b-0 last:pb-0"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Slide {s.slideNumber}
                  {s.isHook && " · hook"}
                  {s.isCTA && " · CTA"}
                </div>
                <pre className="mt-0.5 whitespace-pre-wrap font-sans">{s.text}</pre>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
