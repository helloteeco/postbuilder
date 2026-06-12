"use client";

// Single unified input panel — no tabs. The user pastes their
// long-form content (typically a Claude.ai or other AI chat output)
// into the main textarea; can ALSO drop screenshots in the same flow
// without switching modes; can ALSO paste an Instagram URL and click
// Resolve to auto-fetch caption + images.
//
// Removed the old explicit "competitor paste-text" mode — it
// duplicated the long-form flow at the API layer (different field
// name, near-identical handling) and forced the user to pick a tab
// for a distinction they didn't care about. Now all typed text goes
// to rawSource. Screenshots still flow as competitorImages. IG-URL
// fetch populates both.

import { useMemo, useState } from "react";
import { readFileAsDataUrl } from "@/lib/shared-utils";

export interface InputState {
  topic: string;
  // Either the user's long-form draft (going to rawSource on the
  // server) or an Instagram URL (auto-detected and resolved on click).
  text: string;
  images: string[]; // data URLs for screenshots
}

export const EMPTY_INPUT: InputState = {
  topic: "",
  text: "",
  images: [],
};

interface Props {
  value: InputState;
  onChange: (next: InputState) => void;
  busy: boolean;
  onGenerate: () => void;
  onFetchIg: () => void;
  igStatus?: string | null;
}

// Detect a single Instagram URL in the textarea. Returns the URL
// string if `text` is JUST a URL (with possible whitespace), null
// otherwise. We don't try to extract URLs from prose — the user
// either pastes a URL alone, or they don't.
const IG_URL_RE =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/[^\s]+\/?$/i;

export function detectInstagramUrl(text: string): string | null {
  const trimmed = text.trim();
  if (IG_URL_RE.test(trimmed)) return trimmed;
  return null;
}

export default function InputPanel({
  value,
  onChange,
  busy,
  onGenerate,
  onFetchIg,
  igStatus,
}: Props) {
  const [dragActive, setDragActive] = useState(false);

  function setField<K extends keyof InputState>(k: K, v: InputState[K]) {
    onChange({ ...value, [k]: v });
  }

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const dataUrls = await Promise.all(arr.map(readFileAsDataUrl));
    onChange({ ...value, images: [...value.images, ...dataUrls] });
  }

  function removeImage(i: number) {
    const next = value.images.slice();
    next.splice(i, 1);
    onChange({ ...value, images: next });
  }

  const igUrl = useMemo(() => detectInstagramUrl(value.text), [value.text]);

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-xs text-gray-600">
        Topic / angle (optional but helpful)
        <input
          type="text"
          value={value.topic}
          onChange={(e) => setField("topic", e.target.value)}
          placeholder="e.g. how my reader can save $5k on their first Airbnb"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Your content
          </span>
          {igUrl && !busy && (
            <button
              type="button"
              onClick={onFetchIg}
              className="rounded bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-800 hover:bg-gray-300"
            >
              ↗ Resolve Instagram post
            </button>
          )}
        </div>
        <textarea
          value={value.text}
          onChange={(e) => setField("text", e.target.value)}
          rows={8}
          placeholder={
            "Paste long-form content from Claude.ai / ChatGPT / your draft — Claude will compress it into the carousel.\n\nOr paste an Instagram URL (https://www.instagram.com/p/…) and click Resolve to auto-fetch the post."
          }
          className="w-full resize-y rounded border border-gray-300 p-2 text-sm"
        />
        {igUrl && (
          <p className="mt-1 text-[11px] text-gray-500">
            Looks like an Instagram URL. Click <em>Resolve Instagram post</em>{" "}
            to fetch its caption + images, then Generate. If the fetch fails
            (IG often blocks), drop screenshots below instead.
          </p>
        )}
        {igStatus && (
          <div className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
            {igStatus}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-gray-700">
          Screenshots (optional — competitor posts you want to remix)
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-4 text-center text-xs transition ${
            dragActive
              ? "border-gray-900 bg-gray-50"
              : "border-gray-300 text-gray-500"
          }`}
        >
          Drag screenshots here, or
          <label className="ml-1 cursor-pointer text-gray-900 underline">
            click to browse
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
        </div>
        {value.images.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {value.images.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-20 w-full rounded border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={busy}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate carousel"}
      </button>
    </div>
  );
}
