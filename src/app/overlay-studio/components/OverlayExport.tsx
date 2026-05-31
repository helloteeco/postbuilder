"use client";

// Zip export. Same approach as Post Builder: render each slide's full
// 1080×1350 node off-screen via html-to-image and bundle into JSZip.
// Fonts are loaded by the parent page via Google Fonts <link> and
// awaited here with document.fonts.ready before capture so the
// exported PNG matches the preview.

import { useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { SLIDE_H, SLIDE_W } from "./OverlaySlideRender";

interface Props {
  getNodes: () => (HTMLElement | null)[];
  caption: string;
  firstComment: string;
  audioVibe: string;
  listingNickname: string;
}

export default function OverlayExport({
  getNodes,
  caption,
  firstComment,
  audioVibe,
  listingNickname,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function downloadZip() {
    const nodes = getNodes().filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      // Make sure custom fonts are loaded so they appear in the PNG.
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          // not fatal
        }
      }
      const zip = new JSZip();
      for (let i = 0; i < nodes.length; i++) {
        setProgress(`Rendering slide ${i + 1}/${nodes.length}`);
        const node = nodes[i];
        const dataUrl = await toPng(node, {
          cacheBust: true,
          pixelRatio: 1,
          width: SLIDE_W,
          height: SLIDE_H,
          style: { transform: "none" },
        });
        const resp = await fetch(dataUrl);
        const blob = await resp.blob();
        const buf = await blob.arrayBuffer();
        const num = String(i + 1).padStart(2, "0");
        zip.file(`slide-${num}.png`, buf);
      }
      setProgress("Adding caption.txt…");
      zip.file(
        "caption.txt",
        [
          "CAPTION",
          "──────",
          caption || "(none)",
          "",
          "FIRST COMMENT",
          "─────────────",
          firstComment || "(none)",
          "",
          "AUDIO VIBE (pick the actual track on Instagram)",
          "───────────────────────────────────────────────",
          audioVibe || "(none)",
        ].join("\n"),
      );
      setProgress("Zipping…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeName =
        (listingNickname || "overlay-studio")
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-")
          .replace(/^-+|-+$/g, "") || "overlay-studio";
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-carousel.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setProgress("✓ Downloaded");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 2400);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 6 — Export
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        Download the zip
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        1080×1350 PNGs in carousel order, plus a <code>caption.txt</code>{" "}
        with the caption, first comment, and the music vibe suggestion.
        AirDrop to your phone and post.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadZip}
          disabled={busy}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
        >
          {busy ? "Working…" : "Download zip"}
        </button>
        {progress && <span className="text-xs text-gray-600">{progress}</span>}
        {err && (
          <span className="text-xs text-rose-700">Export failed: {err}</span>
        )}
      </div>
    </section>
  );
}
