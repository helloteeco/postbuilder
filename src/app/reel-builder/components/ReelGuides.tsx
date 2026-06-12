"use client";

// Two-tab help modal — "How to use" + "DIY in CapCut". Mirrors the
// Post Builder help pattern but with reel-specific instructions:
// 9:16 canvas, embedded 4:5 cover for IG-grid parity, "See
// description ↓" indicator placement, MP4 export.

interface Props {
  open: "how-to" | "capcut" | null;
  onChange: (next: "how-to" | "capcut" | null) => void;
}

export default function ReelGuides({ open, onChange }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onChange(null)}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange("how-to")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                open === "how-to"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              How to use
            </button>
            <button
              type="button"
              onClick={() => onChange("capcut")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                open === "capcut"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              DIY in CapCut
            </button>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {open === "how-to" && (
          <>
            <h2 className="mb-3 text-lg font-bold text-gray-900">
              How to use Reel Builder
            </h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
              <li>
                <span className="font-semibold text-gray-900">Set up your profile (one-time).</span>{" "}
                Same profile as Post Builder — avatar, display name, handle,
                verified check, font. Edits here propagate to Post Builder
                covers too (same localStorage key).
              </li>
              <li>
                <span className="font-semibold text-gray-900">Paste your 10-section ghostwriter output.</span>{" "}
                Same input you&apos;d feed Post Builder. Reel Builder keeps the
                argument and facts intact and remixes the angle into 3 reel
                hook variations.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Hit Generate 3 Reels.</span>{" "}
                Claude Sonnet returns 3 distinct variations spanning angles
                (counter-intuitive / list-promise / specific-number / news /
                question), each with a paired long-form caption (1,400-2,000
                chars, IG-friendly with line breaks between list items, no
                emojis or hashtags, no markdown bold).
              </li>
              <li>
                <span className="font-semibold text-gray-900">Edit anything inline.</span>{" "}
                Headline, subtitle, and caption are all editable per
                variation. Wrap words in <code className="rounded bg-gray-100 px-1 py-0.5">**double asterisks**</code> to highlight them in the
                accent color on the cover. Asterisks never appear in the
                downloaded PNG/MP4.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Pick a background.</span>{" "}
                7 palettes (white / soft / yellow / dark / cream / forest /
                navy) — same set as Post Builder. Click any swatch under a
                variation to switch.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Save your favorite + download MP4.</span>{" "}
                The MP4 is a 7-second static loop at 1080×1920 with silent
                audio (some platforms require an audio track). PNG fallback
                if ffmpeg.wasm fails to load.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Send to Performance Tracker.</span>{" "}
                Click <em>Send to tracker</em> on the variation you actually
                posted. Coach Mode picks it up the next time you open it,
                pre-fills the log form with the headline + slides parsed from
                the caption, and you just add postedAt + metrics later.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Upload to Instagram.</span>{" "}
                Use the MP4 as your reel; IG&apos;s profile-grid thumbnail
                center-crops the reel to your existing 4:5 carousel ratio,
                showing your headline + face in the same pixels as Post
                Builder posts. The &ldquo;See description ↓&rdquo; cue sits below
                your name as a bird&apos;s-eye-view marker so you can spot
                reels at a glance on your grid.
              </li>
            </ol>
            <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span className="font-semibold">Tip:</span> Generate reels for the same
              ghostwriter output you&apos;re posting as a carousel — gives you
              two formats from the same source content, with the visual
              treatment matched on your profile grid.
            </div>
          </>
        )}

        {open === "capcut" && (
          <>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              Build the same reel by hand in CapCut
            </h2>
            <p className="mb-4 text-xs text-gray-500">
              ~15-25 minutes per reel vs ~30 seconds in this app. Use this if
              you prefer manual control or as a fallback.
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
              <li>
                <span className="font-semibold text-gray-900">Create the canvas.</span>{" "}
                In CapCut: <em>New project</em> → <em>Aspect ratio</em> →{" "}
                <strong>9:16 (1080 × 1920)</strong> Instagram Reel. Don&apos;t
                resize between elements — keep the canvas at this exact size.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Pick a background color.</span>{" "}
                Add a solid-color clip filling the full canvas. Match one of
                Post Builder&apos;s contrast-tested hexes:{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#FFFFFF</code> (white),{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#F5B935</code> (yellow),{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#0F1419</code> (dark),{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#F7F0E1</code> (cream),{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#1B3A2F</code> (forest), or{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5">#0F2645</code> (navy).
              </li>
              <li>
                <span className="font-semibold text-gray-900">Add the headline.</span>{" "}
                Insert a text layer, font <strong>Inter Bold</strong>,{" "}
                <strong>132pt</strong>, line-height 1.04, letter-spacing -2.5%.
                Anchor it about <strong>525 px from the top</strong> and 80 px
                from each side. Same exact values Post Builder uses on its 4:5
                cover, so when IG crops the reel to 4:5 for your profile grid
                the headline lands in identical pixels to a feed post.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Bold 2-4 keywords in color.</span>{" "}
                Highlight numbers and key nouns inside the headline and recolor
                them to the accent that matches the bg:
                teal <code className="rounded bg-gray-100 px-1 py-0.5">#2E86AB</code> on white,
                black on yellow,
                light teal <code className="rounded bg-gray-100 px-1 py-0.5">#5FB4D2</code> on dark,
                terracotta <code className="rounded bg-gray-100 px-1 py-0.5">#B8501F</code> on cream,
                amber <code className="rounded bg-gray-100 px-1 py-0.5">#E8B042</code> on forest,
                coral <code className="rounded bg-gray-100 px-1 py-0.5">#FF8C5C</code> on navy.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Subtitle (optional).</span>{" "}
                One short line, Inter Regular, <strong>48pt</strong>, in the
                muted gray for that palette, 28 px below the headline.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Profile row.</span>{" "}
                Anchor at <strong>y = 1115</strong> from the top (same proportion
                as Post Builder cover). 128×128 circle with your avatar + name
                in Inter Bold 46pt + verified check (52 px tall) + handle in
                Inter Regular 38pt below.
              </li>
              <li>
                <span className="font-semibold text-gray-900">&ldquo;See description ↓&rdquo; cue.</span>{" "}
                Below the profile row at <strong>y = 1290</strong>: text{" "}
                <em>See description ↓</em> in 52pt bold (palette foreground at
                85% opacity), then a big <strong>↓</strong> chevron at 76pt
                in the accent color directly below at y = 1370. Left-align
                with the headline column (x = 80) so it doesn&apos;t feel
                centered-and-floaty.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Set duration to 7 seconds.</span>{" "}
                Reels need video. Keep the canvas static for the full 7s
                (Instagram&apos;s minimum reel length); add a silent audio
                track if your editor doesn&apos;t add one automatically.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Export.</span>{" "}
                <strong>1080 × 1920 MP4</strong> at 30fps, H.264 video +
                AAC audio. Upload to Instagram as a reel.
              </li>
            </ol>
            <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <span className="font-semibold">Tip:</span> Save the finished
              reel as a CapCut template once you&apos;ve dialed in the
              positions. Then you only swap the headline / subtitle text for
              each new reel — keeps your profile grid uniform across every
              post and reel.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
