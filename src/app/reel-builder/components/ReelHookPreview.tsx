"use client";

// Renders one 1080×1920 reel cover. The 1080×1350 cover area is
// centered vertically inside the reel (top=285) and uses the EXACT
// Post Builder cover layout — same 240/80/380 padding, same 132pt
// headline, same 48pt subtitle, same compact profile row. That way
// the reel's profile-grid thumbnail (which IG center-crops to 4:5 or
// 1:1) is pixel-identical to a Post Builder feed post.
//
//   y=0
//   ┌────────────────────────┐  top empty band (285px)
//   │                        │
//   │   See description ↓    │  y=95   ← single line, 64pt bold
//   │   ↓                    │  y=175  ← chevron, 96pt accent (tight)
//   │                        │
//   y=285
//   ┌────────────────────────┐  EMBEDDED 1080×1350 PB COVER
//   │ (240px top padding)    │  y=285-525
//   │ Headline (132pt bold)  │  y=525  ← matches PB feed-post pixel
//   │ Subtitle (48pt muted)  │
//   │   ...                  │
//   │ [avatar] Name ✓        │  y=1115 ← matches PB feed-post pixel
//   │          @handle       │
//   │ (380px bottom padding) │  y=1255-1635
//   y=1635
//   ┌────────────────────────┐  bottom empty band (285px)
//   │                        │  IG UI overlays this when reel plays
//   y=1920
//
// We deliberately re-implement the renderer instead of importing
// CarouselSlide.tsx — Reel Builder is a separate feature.

import { forwardRef } from "react";
import {
  COVER_AREA_HEIGHT,
  COVER_AREA_TOP,
  COVER_HOOK_MAX_HEIGHT,
  COVER_PADDING_BOTTOM,
  COVER_PADDING_TOP,
  COVER_PADDING_X,
  REEL_BG_PALETTES,
  REEL_FONTS,
  REEL_HEIGHT,
  REEL_WIDTH,
  SEE_DESC_CHEVRON_Y,
  SEE_DESC_TEXT_Y,
  type ReelBg,
  type ReelFont,
} from "@/app/reel-builder/lib/reelTemplate";
import type { ReelProfile } from "@/app/reel-builder/lib/reelProfile";

interface Props {
  bg: ReelBg;
  font: ReelFont;
  headline: string;
  subtitle?: string;
  profile: ReelProfile;
  scale?: number;
}

// Renders **bold** and *emphasis* spans inline with the accent color.
// Strips any leftover stray asterisks. Mirrors the Post Builder slide
// renderer.
function renderInline(text: string, accentColor: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (/^\*{1,2}[^*\n]+\*{1,2}$/.test(part)) {
      const content = part.replace(/^\*+/, "").replace(/\*+$/, "");
      return (
        <span key={i} style={{ fontWeight: 700, color: accentColor }}>
          {content}
        </span>
      );
    }
    return <span key={i}>{part.replace(/\*/g, "")}</span>;
  });
}

function avatarInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
}

function VerifiedCheck({ size = 52 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
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

// Compact profile row — exact Post Builder values: avatar 128, name
// 46pt bold, handle 38pt, verified check 52pt, gradient avatar
// fallback. Identical to ProfileRowCompact in CarouselSlide.tsx.
function ProfileRowCompact({
  profile,
  fg,
  muted,
}: {
  profile: ReelProfile;
  fg: string;
  muted: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: "50%",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #F5B935 0%, #E8A420 50%, #D99013 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 52,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {profile.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarDataUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous"
          />
        ) : (
          avatarInitial(profile.displayName)
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 46,
            fontWeight: 700,
            color: fg,
            lineHeight: 1.1,
          }}
        >
          <span>{profile.displayName || "Your Name"}</span>
          {profile.verified && <VerifiedCheck size={52} />}
        </div>
        <div style={{ fontSize: 38, color: muted, lineHeight: 1.1 }}>
          {profile.handle || "@handle"}
        </div>
      </div>
    </div>
  );
}

const ReelHookPreview = forwardRef<HTMLDivElement, Props>(function ReelHookPreview(
  { bg, font, headline, subtitle, profile, scale },
  ref,
) {
  const palette = REEL_BG_PALETTES[bg];
  const fontFamily = REEL_FONTS[font];
  const transform = scale ? `scale(${scale})` : undefined;

  return (
    <div
      ref={ref}
      style={{
        width: REEL_WIDTH,
        height: REEL_HEIGHT,
        background: palette.bg,
        color: palette.fg,
        fontFamily,
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        transform,
        transformOrigin: "top left",
      }}
    >
      {/* TOP BAND — "See description ↓" + chevron, single line each */}
      <div
        style={{
          position: "absolute",
          top: SEE_DESC_TEXT_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: palette.fg,
          lineHeight: 1,
        }}
      >
        See description ↓
      </div>
      <div
        style={{
          position: "absolute",
          top: SEE_DESC_CHEVRON_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 96,
          fontWeight: 900,
          color: palette.accent,
          lineHeight: 1,
        }}
      >
        ↓
      </div>

      {/* EMBEDDED 1080×1350 POST BUILDER COVER — identical layout to
          CarouselSlide.tsx's hook-opener: padding 240/80/380, flex
          column space-between, hook block at top, profile at bottom. */}
      <div
        style={{
          position: "absolute",
          top: COVER_AREA_TOP,
          left: 0,
          width: REEL_WIDTH,
          height: COVER_AREA_HEIGHT,
          padding: `${COVER_PADDING_TOP}px ${COVER_PADDING_X}px ${COVER_PADDING_BOTTOM}px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowWrap: "break-word",
        }}
      >
        <div style={{ maxHeight: COVER_HOOK_MAX_HEIGHT, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 132,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
            }}
          >
            {renderInline(headline || "Your reel hook", palette.accent)}
          </div>
          {subtitle && subtitle.trim().length > 0 && (
            <div
              style={{
                marginTop: 28,
                fontSize: 48,
                lineHeight: 1.3,
                color: palette.muted,
              }}
            >
              {renderInline(subtitle, palette.accent)}
            </div>
          )}
        </div>
        <ProfileRowCompact profile={profile} fg={palette.fg} muted={palette.muted} />
      </div>
    </div>
  );
});

export default ReelHookPreview;
