// Modal for attaching slide content to a logged post. Two tabs:
//   1. Link to a Post Builder draft — reads the user's saved drafts
//      from postBuilder.history (READ-ONLY, never written) and lets
//      them click one to import.
//   2. Paste manually — textarea + parse button + preview.
//
// On save, the slides are stored on the LoggedPost via replacePost(),
// and contentAnalysis is computed and stored alongside.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadLoggedPosts,
  replacePost,
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

type Tab = "link" | "paste";

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

  // Reset form state every time the modal opens for a (potentially
  // different) post.
  useEffect(() => {
    if (!open) return;
    setTab("link");
    setPasteText("");
    setParsed(null);
    setError(null);
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

        <div className="mb-4 flex gap-2">
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
