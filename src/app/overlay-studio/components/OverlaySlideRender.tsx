"use client";

// OverlaySlideRender — the single source of truth for what a slide
// looks like in both the live preview and the exported PNG.
//
// Supports two output canvases via the `format` prop:
//   "post" → 1080×1350 (IG carousel / matches Post Builder)
//   "reel" → 1080×1920 (IG reel cover / matches Reel Builder)
//
// Draws (bottom-up):
//   1. The user's photo (object-cover full-bleed).
//   2. A scrim gradient when the preset asks for one — keeps text
//      legible without competing with the photo.
//   3. The text overlay (headline + body) anchored by the 9-position
//      grid, padded by the safe-zone insets.
//   4. An optional compact profile row in the top-right corner: the
//      same avatar/name/blue-check/handle the rest of the app uses
//      (postBuilder.profile). Positioned in the corner OPPOSITE the
//      text block so they never collide.

import { forwardRef } from "react";
import type { PostBuilderProfile } from "@/lib/post-templates";
import { PRESETS } from "@/app/overlay-studio/lib/overlayPresets";
import {
  OUTPUT_DIMENSIONS,
  type OutputFormat,
  type OverlayMedia,
  type Position,
} from "@/app/overlay-studio/lib/overlayTypes";

const SAFE = {
  top: 0.06,
  side: 0.06,
  bottom: 0.14, // IG caption peek sits here.
};

const TEXT_COLORS = {
  light: "#FFFFFF",
  dark: "#0A0A0A",
  yellow: "#FBC02D",
};

const LIGHT_SHADOW = "0 4px 24px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)";

interface Props {
  media: OverlayMedia;
  format: OutputFormat;
  slideNumber: number;
  profile: PostBuilderProfile;
  showProfile: boolean;
  scale?: number;
}

const OverlaySlideRender = forwardRef<HTMLDivElement, Props>(function OverlaySlideRender(
  { media, format, slideNumber, profile, showProfile, scale },
  ref,
) {
  const dim = OUTPUT_DIMENSIONS[format];
  const preset = PRESETS[media.preset];
  const transform = scale ? `scale(${scale})` : undefined;
  const color = TEXT_COLORS[media.textColor];
  const shadow = media.textColor === "light" ? LIGHT_SHADOW : undefined;
  const { vAlign, hAlign, textAlign } = positionToFlex(media.position);
  const scrim = media.scrim ? scrimStyle(preset.scrim) : null;

  // Anchor the profile chip to the opposite vertical band from the
  // text — text at top → profile at bottom-right and vice versa. Keeps
  // them from fighting for the same pixels.
  const textIsTop = media.position.startsWith("T");
  const profileAnchor: "top" | "bottom" = textIsTop ? "bottom" : "top";

  return (
    <div
      ref={ref}
      style={{
        width: dim.w,
        height: dim.h,
        position: "relative",
        overflow: "hidden",
        background: "#111",
        transform,
        transformOrigin: "top left",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {scrim && <div style={{ position: "absolute", inset: 0, ...scrim }} />}

      {preset.chip && (
        <div
          style={{
            position: "absolute",
            top: dim.h * SAFE.top,
            right: dim.w * SAFE.side,
            background: "#FBC02D",
            color: "#0A0A0A",
            padding: "10px 22px",
            fontFamily: preset.headlineFont,
            fontWeight: 900,
            fontSize: 38,
            letterSpacing: 4,
            textTransform: "uppercase",
            zIndex: 2,
          }}
        >
          AFTER
        </div>
      )}

      {/* Profile chip — small compact strip, opposite corner from text */}
      {showProfile && (
        <OverlayProfileChip
          profile={profile}
          anchor={profileAnchor}
          canvas={dim}
        />
      )}

      {/* Text block */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${dim.h * SAFE.top}px ${dim.w * SAFE.side}px ${dim.h * SAFE.bottom}px ${dim.w * SAFE.side}px`,
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
        {preset.numbering && (
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

function OverlayProfileChip({
  profile,
  anchor,
  canvas,
}: {
  profile: PostBuilderProfile;
  anchor: "top" | "bottom";
  canvas: { w: number; h: number };
}) {
  const avatar = 78;
  const fallbackInitial = profile.displayName.trim().charAt(0).toUpperCase() || "?";
  const padX = canvas.w * 0.05;
  const padY = canvas.h * 0.04;
  return (
    <div
      style={{
        position: "absolute",
        ...(anchor === "top"
          ? { top: padY }
          : { bottom: padY * 1.2 }),
        right: padX,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 16px 10px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 3,
      }}
    >
      <div
        style={{
          width: avatar,
          height: avatar,
          borderRadius: "50%",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #F5B935 0%, #E8A420 50%, #D99013 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 32,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {profile.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarDataUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          fallbackInitial
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", color: "#fff" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          <span>{profile.displayName || "Your Name"}</span>
          {profile.verified && <VerifiedCheck size={28} />}
        </div>
        <div style={{ fontSize: 22, opacity: 0.85, lineHeight: 1.1 }}>
          {profile.handle || "@yourhandle"}
        </div>
      </div>
    </div>
  );
}

function VerifiedCheck({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fill="#1D9BF0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path
        fill="#FFFFFF"
        d="M9.71 17.18 5.6 13.06l1.41-1.42 2.71 2.71 6.6-6.6 1.41 1.41z"
      />
    </svg>
  );
}

function positionToFlex(p: Position): {
  vAlign: "flex-start" | "center" | "flex-end";
  hAlign: "flex-start" | "center" | "flex-end";
  textAlign: "left" | "center" | "right";
} {
  const v = p[0];
  const h = p[1];
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
  return { background: "rgba(0,0,0,0.45)" };
}
