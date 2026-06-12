// MP4 + PNG export for the Reel Builder.
//
// MP4 path uses ffmpeg.wasm SINGLE-THREADED build (UMD core from CDN,
// fetched as a same-origin Blob URL). The single-threaded build does
// not require SharedArrayBuffer, which means we don't have to set
// COOP/COEP headers on the Next.js app — those headers can break
// Post Builder's image proxy + third-party embeds, so scoping the
// reel feature to a non-isolated context is the safer trade.
//
// Encoding pipeline:
//   1. Render the offscreen reel <div> to a PNG via html-to-image
//   2. Convert PNG → input file in ffmpeg's virtual FS
//   3. Encode 7 seconds of static frames at 30fps as H.264 MP4 with a
//      silent AAC audio track (some platforms reject video-only files)
//   4. Read the MP4 buffer back out and trigger a Blob download
//
// PNG fallback path skips ffmpeg entirely — used when ffmpeg fails to
// load (iOS Safari quirks, blocked CDNs, etc.) or when the user
// explicitly clicks "or download as PNG".

import { toPng } from "html-to-image";
import { REEL_HEIGHT, REEL_WIDTH } from "./reelTemplate";

// 7-second static loop at 30fps per spec. 7 * 30 = 210 frames, but
// we only render ONE frame and let ffmpeg loop it — much faster than
// emitting 210 distinct PNGs.
const REEL_DURATION_SECS = 7;
const REEL_FPS = 30;

// Pinned to the matching @ffmpeg/ffmpeg version we installed. UMD
// build (single-threaded) — works without SharedArrayBuffer / COEP.
const FFMPEG_CORE_VERSION = "0.12.6";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

export type ExportProgressStage =
  | "rendering"
  | "loading-encoder"
  | "encoding"
  | "downloading"
  | "done"
  | "fallback-png";

export interface ExportProgress {
  stage: ExportProgressStage;
  message: string;
}

type ProgressCallback = (p: ExportProgress) => void;

// We instantiate a single FFmpeg instance per session and reuse it
// for subsequent exports. Type any so we don't have to import the
// FFmpeg type at module top-level (keeps the bundler from including
// the wasm payload in the page's initial JS).
let ffmpegInstance: unknown = null;
let ffmpegLoadPromise: Promise<unknown> | null = null;

async function loadFFmpeg(onProgress?: ProgressCallback): Promise<unknown> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  onProgress?.({
    stage: "loading-encoder",
    message: "Loading video encoder (one-time, ~30MB)…",
  });

  ffmpegLoadPromise = (async () => {
    // Dynamic imports so the ~30MB ffmpeg payload doesn't ship in the
    // page's initial JS bundle.
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const instance = new FFmpeg();
    await instance.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = instance;
    return instance;
  })();

  return ffmpegLoadPromise;
}

interface FFmpegLike {
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  exec: (args: string[]) => Promise<number>;
  deleteFile: (path: string) => Promise<void>;
}

async function renderNodeToPng(node: HTMLElement): Promise<string> {
  return await toPng(node, {
    cacheBust: true,
    pixelRatio: 1,
    width: REEL_WIDTH,
    height: REEL_HEIGHT,
    style: { transform: "none" },
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  // toPng returns a "data:image/png;base64,..." URL. Strip the prefix
  // and decode the base64 payload to a Uint8Array.
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function exportReelAsPng(
  node: HTMLElement,
  filename: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  onProgress?.({ stage: "rendering", message: "Rendering reel…" });
  const dataUrl = await renderNodeToPng(node);
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  onProgress?.({ stage: "downloading", message: "Downloading…" });
  downloadBlob(blob, filename);
  onProgress?.({ stage: "done", message: "Done" });
}

// Encode the rendered reel as a 7-second 1080x1920 H.264 MP4 with a
// silent AAC audio track. Static image looped — ffmpeg's -loop input
// option makes this almost free CPU-wise.
export async function exportReelAsMp4(
  node: HTMLElement,
  filename: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  onProgress?.({ stage: "rendering", message: "Rendering reel…" });
  const dataUrl = await renderNodeToPng(node);
  const pngBytes = dataUrlToBytes(dataUrl);

  let ffmpeg: FFmpegLike;
  try {
    ffmpeg = (await loadFFmpeg(onProgress)) as FFmpegLike;
  } catch (err) {
    // Fall back to PNG so the user still gets something usable.
    onProgress?.({
      stage: "fallback-png",
      message: `Video encoder failed to load (${
        err instanceof Error ? err.message : String(err)
      }). Falling back to PNG — you can convert to video in CapCut.`,
    });
    const fallbackName = filename.replace(/\.mp4$/i, "") + ".png";
    await exportReelAsPng(node, fallbackName, onProgress);
    return;
  }

  onProgress?.({ stage: "encoding", message: "Encoding MP4…" });

  try {
    await ffmpeg.writeFile("input.png", pngBytes);

    // -loop 1 + -t N: emit N seconds of looped frames from a single image.
    // -f lavfi + anullsrc: silent audio source so the MP4 has an audio
    //   stream (Instagram occasionally rejects video-only files).
    // -shortest: stop the silent audio when video ends.
    // -pix_fmt yuv420p + libx264 = the canonical IG-friendly combo.
    await ffmpeg.exec([
      "-y",
      "-loop",
      "1",
      "-i",
      "input.png",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-c:v",
      "libx264",
      "-tune",
      "stillimage",
      "-r",
      String(REEL_FPS),
      "-t",
      String(REEL_DURATION_SECS),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);

    const out = await ffmpeg.readFile("output.mp4");
    if (typeof out === "string") {
      throw new Error("ffmpeg returned text instead of binary output");
    }
    // Copy into a fresh ArrayBuffer-backed Uint8Array so the Blob ctor
    // accepts it on TS 5.x (where Uint8Array can be backed by either
    // ArrayBuffer or SharedArrayBuffer and the latter isn't a BlobPart).
    const ab = new ArrayBuffer(out.byteLength);
    new Uint8Array(ab).set(out);
    const blob = new Blob([ab], { type: "video/mp4" });
    onProgress?.({ stage: "downloading", message: "Downloading…" });
    downloadBlob(blob, filename);
    onProgress?.({ stage: "done", message: "Done" });
  } catch (err) {
    onProgress?.({
      stage: "fallback-png",
      message: `Encoding failed (${
        err instanceof Error ? err.message : String(err)
      }). Falling back to PNG.`,
    });
    const fallbackName = filename.replace(/\.mp4$/i, "") + ".png";
    await exportReelAsPng(node, fallbackName, onProgress);
  } finally {
    // Clean the virtual FS so a follow-up encode doesn't trip on stale
    // input/output paths. Failure here is harmless.
    try {
      await ffmpeg.deleteFile("input.png");
    } catch {
      /* noop */
    }
    try {
      await ffmpeg.deleteFile("output.mp4");
    } catch {
      /* noop */
    }
  }
}
