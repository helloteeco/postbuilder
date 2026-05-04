"use client";

// Modal that surfaces the Claude.ai-ready remix prompt for a single
// top-performing post. Pure presentation — generates the prompt via
// buildRemixPrompt(), shows it in a textarea, and offers a Copy button
// (with clipboard-fallback to selecting the textarea) plus a link to
// open Claude.ai in a new tab.
//
// The user pastes the prompt into Claude.ai, gets back 5 cover-hook
// variations + the locked body, then picks one to schedule.

import { useEffect, useMemo, useState } from "react";
import type { LoggedPost } from "@/app/coach/lib/storage";
import { buildRemixPrompt } from "@/app/coach/lib/remixPrompt";

interface Props {
  open: boolean;
  post: LoggedPost | null;
  onClose: () => void;
}

export default function RemixPromptModal({ open, post, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // Reset the copied state whenever the modal opens/closes for a
  // different post — otherwise the green "Copied" pill sticks across
  // openings.
  useEffect(() => {
    setCopied(false);
  }, [open, post?.id]);

  const prompt = useMemo(
    () => (post ? buildRemixPrompt(post) : ""),
    [post],
  );

  if (!open || !post) return null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.getElementById(
        "coach-remix-output",
      ) as HTMLTextAreaElement | null;
      ta?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Remix top performer
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-gray-900">
              {post.title}
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Claude brainstorms 5 cover-hook angles internally, picks the
              strongest one, and returns a single ready-to-publish post. Body
              slides + CTA stay nearly identical — just paste straight into the
              Post Builder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-xs text-gray-700">
            <li>
              <span className="font-semibold">Copy</span> the prompt below.
            </li>
            <li>
              Paste it into{" "}
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 underline hover:text-indigo-900"
              >
                claude.ai
              </a>{" "}
              and send.
            </li>
            <li>
              Copy Claude&apos;s response and paste it straight into the Post
              Builder (Paste text mode) to render slides.
            </li>
          </ol>

          <textarea
            id="coach-remix-output"
            readOnly
            value={prompt}
            className="h-[55vh] w-full resize-none rounded border border-gray-300 bg-gray-50 p-3 font-mono text-xs text-gray-800"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4">
          <span className="text-xs text-gray-500">
            {prompt.length.toLocaleString()} characters
          </span>
          <div className="flex items-center gap-2">
            <a
              href="https://claude.ai/new"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Open Claude.ai →
            </a>
            <button
              type="button"
              onClick={copyPrompt}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-900 text-white hover:bg-black"
              }`}
            >
              {copied ? "✓ Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
