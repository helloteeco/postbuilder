"use client";

// Zip / single PNG export. Same toPng + JSZip pipeline Post Builder
// uses. Header buttons mirror Post Builder's ExportBar.

import { useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  OUTPUT_DIMENSIONS,
  type OutputFormat,
} from "@/app/overlay-studio/lib/overlayTypes";

interface Props {
  format: OutputFormat;
  slideCount: number;
  getSlideNodes: () => (HTMLElement | null)[];
  caption: string;
  firstComment: string;
  listingNickname: string;
}

export default function OverlayExportBar({
  format,
  slideCount,
  getSlideNodes,
  caption,
  firstComment,
  listingNickname,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const dim = OUTPUT_DIMENSIONS[format];
  const disabled = busy || slideCount === 0;

  async function renderBlob(node: HTMLElement): Promise<Blob> {
    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {
        // not fatal
      }
    }
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 1,
      width: dim.w,
      height: dim.h,
      style: { transform: "none" },
    });
    const resp = await fetch(dataUrl);
    return await resp.blob();
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function safeName(): string {
    return (
      (listingNickname || "overlay-studio")
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "") || "overlay-studio"
    );
  }

  async function downloadAll() {
    const nodes = getSlideNodes().filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < nodes.length; i++) {
        setProgress(`Rendering ${i + 1}/${nodes.length}`);
        const blob = await renderBlob(nodes[i]);
        const buf = await blob.arrayBuffer();
        const num = String(i + 1).padStart(2, "0");
        zip.file(`slide-${num}.png`, buf);
      }
      zip.file(
        "caption.txt",
        ["CAPTION", caption || "(none)", "", "FIRST COMMENT", firstComment || "(none)"].join("\n"),
      );
      setProgress("Zipping…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      download(zipBlob, `${safeName()}-${format}.zip`);
      setProgress("✓ Downloaded");
    } catch (e) {
      setProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 2200);
    }
  }

  async function downloadEach() {
    const nodes = getSlideNodes().filter((n): n is HTMLElement => !!n);
    setBusy(true);
    try {
      for (let i = 0; i < nodes.length; i++) {
        setProgress(`Rendering ${i + 1}/${nodes.length}`);
        const blob = await renderBlob(nodes[i]);
        download(blob, `${safeName()}-${String(i + 1).padStart(2, "0")}.png`);
      }
      setProgress("✓ Done");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 2200);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadAll}
        disabled={disabled}
        className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
      >
        Download all (zip)
      </button>
      <button
        type="button"
        onClick={downloadEach}
        disabled={disabled}
        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Download each
      </button>
      {progress && <span className="text-xs text-gray-500">{progress}</span>}
    </div>
  );
}
