"use client";

// OverlaySlideRender — single source of truth for what a slide looks
// like. Used both for the live in-page preview AND for the offscreen
// 1080×1350 export node. Because both use the same React tree, the
// exported PNG matches the preview pixel-for-pixel (the spec's Phase 1
// acceptance criterion).
//
// We render at the native 1080×1350 size with a CSS transform scale
// when the parent passes `scale`. html-to-image captures the inner
// 1080×1350 frame, transform-independent.

import { forwardRef } from "react";
import { PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import type { OverlayMedia, Position } from "@/app/overlay-studio/lib/overlayTypes";

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

const SAFE = {
  top: 0.06,
  side: 0.06,
  bottom: 0.14, // IG caption peek sits here — leave room.
};

const TEXT_COLORS = {
  light: "#FFFFFF",
  dark: "#0A0A0A",
  yellow: "#FBC02D",
};

// Soft drop shadow on light text so it survives a busy background even
// without a scrim. Tuned per spec ("soft shadow when text is light").
const LIGHT_SHADOW = "0 4px 24px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)";

interface Props {
  media: OverlayMedia;
  // The carousel position number this slide will live at (1-based) —
  // shown by the tip preset.
  slideNumber: number;
  // When set, the whole 1080×1350 node is CSS-scaled. Use null/undefined
  // for the offscreen export node.
  scale?: number;
}

const OverlaySlideRender = forwardRef<HTMLDivElement, Props>(function OverlaySlideRender(
  { media, slideNumber, scale },
  ref,
) {
  const preset = PRESETS[media.preset];
  const transform = scale ? `scale(${scale})` : undefined;
  const color = TEXT_COLORS[media.textColor];
  const shadow = media.textColor === "light" ? LIGHT_SHADOW : undefined;

  // Position → flex anchor + text-align. The 9-position grid maps
  // top/center/bottom to vertical anchor and L/C/R to horizontal +
  // text alignment.
  const { vAlign, hAlign, textAlign } = positionToFlex(media.position);

  // Scrim gradient — drawn as an absolutely positioned overlay between
  // the photo and the text. Always darker than the underlying image so
  // text stays legible.
  const scrim = scrimStyle(preset.scrim);

  // "01" leading number for tip-preset slides.
  const showNumbering = !!preset.numbering;
  // BEFORE / AFTER chip for the before/after preset.
  const showChip = !!preset.chip;

  return (
    <div
      ref={ref}
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        position: "relative",
        overflow: "hidden",
        background: "#111",
        transform,
        transformOrigin: "top left",
      }}
    >
      {/* Photo */}
      <img
        src={media.dataUrl}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Scrim */}
      {scrim && <div style={{ position: "absolute", inset: 0, ...scrim }} />}

      {/* Before/After chip in the opposite corner of the text */}
      {showChip && (
        <div
          style={{
            position: "absolute",
            top: SLIDE_H * SAFE.top,
            right: SLIDE_W * SAFE.side,
            background: "#FBC02D",
            color: "#0A0A0A",
            padding: "10px 22px",
            fontFamily: preset.headlineFont,
            fontWeight: 900,
            fontSize: 38,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          AFTER
        </div>
      )}

      {/* Text block — anchored by position, padded by SAFE insets */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${SLIDE_H * SAFE.top}px ${SLIDE_W * SAFE.side}px ${SLIDE_H * SAFE.bottom}px ${SLIDE_W * SAFE.side}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: vAlign,
          alignItems: hAlign,
          textAlign,
          color,
          textShadow: shadow,
          gap: 18,
        }}
      >
        {showNumbering && (
          <div
            style={{
              fontFamily: preset.headlineFont,
              fontWeight: 900,
              fontSize: 220,
              lineHeight: 0.9,
              letterSpacing: -8,
              color: "#FBC02D",
              textShadow: shadow,
            }}
          >
            {String(slideNumber).padStart(2, "0")}
          </div>
        )}

        {media.headline && (
          <div
            style={{
              fontFamily: preset.headlineFont,
              fontWeight: preset.headlineWeight,
              fontSize: preset.headlineSize,
              letterSpacing: `${preset.headlineLetterSpacing}em`,
              lineHeight: 1.02,
              textTransform: preset.headlineUppercase ? "uppercase" : "none",
              maxWidth: "100%",
              wordBreak: "break-word",
            }}
          >
            {media.headline}
          </div>
        )}

        {media.body && (
          <div
            style={{
              fontFamily: preset.bodyFont,
              fontWeight: preset.bodyWeight,
              fontSize: preset.bodySize,
              lineHeight: 1.25,
              maxWidth: "92%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {media.body}
          </div>
        )}
      </div>
    </div>
  );
});

export default OverlaySlideRender;

function positionToFlex(p: Position): {
  vAlign: "flex-start" | "center" | "flex-end";
  hAlign: "flex-start" | "center" | "flex-end";
  textAlign: "left" | "center" | "right";
} {
  const v = p[0]; // T/C/B
  const h = p[1]; // L/C/R
  return {
    vAlign: v === "T" ? "flex-start" : v === "B" ? "flex-end" : "center",
    hAlign: h === "L" ? "flex-start" : h === "R" ? "flex-end" : "center",
    textAlign: h === "L" ? "left" : h === "R" ? "right" : "center",
  };
}

function scrimStyle(
  kind: "none" | "top" | "bottom" | "full",
): React.CSSProperties | null {
  if (kind === "none") return null;
  if (kind === "top") {
    return {
      background:
        "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0) 60%)",
    };
  }
  if (kind === "bottom") {
    return {
      background:
        "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0) 65%)",
    };
  }
  // full
  return { background: "rgba(0,0,0,0.45)" };
}
