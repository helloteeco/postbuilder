"use client";

// Renders one 1080×1920 reel cover. Layout is absolute-positioned so
// each block lands in a fixed pixel position regardless of content
// length. The y-coordinates are tuned in reelTemplate.ts for the IG
// Reels safe zone (no content under the bottom UI overlay) and for
// visual parity with the Post Builder cover (headline ~20% from top,
// profile row ~61% from top, breathing room everywhere).
//
//   y=110   "See description ↓"   — title text, 64pt bold
//   y=200   ↓                     — chevron, 96pt accent
//   y=380   Headline (132pt)      — Post Builder cover values
//           Subtitle (48pt muted) — 28px below headline
//   y=1170  [avatar] Name ✓
//                   @handle       — compact profile row
//
// We deliberately re-implement the renderer instead of importing
// CarouselSlide.tsx — Reel Builder is a separate feature.

import { forwardRef } from "react";
import {
  HOOK_BLOCK_MAX_HEIGHT,
  HOOK_BLOCK_TOP,
  PROFILE_ROW_TOP,
  REEL_BG_PALETTES,
  REEL_FONTS,
  REEL_HEIGHT,
  REEL_WIDTH,
  SEE_DESC_CHEVRON_Y,
  SEE_DESC_TEXT_Y,
  SIDE_PAD,
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
// Strips any leftover stray asterisks so the exported PNG never shows
// raw markdown. Mirrors the Post Builder slide renderer.
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
      {/* "See description" — single line, centered. Fixed y. */}
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

      {/* Chevron, tight to the text above (gap ~10px). */}
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

      {/* Hook block — pinned at HOOK_BLOCK_TOP, max-height clamped so
          a long headline never crashes into the profile row. */}
      <div
        style={{
          position: "absolute",
          top: HOOK_BLOCK_TOP,
          left: SIDE_PAD,
          right: SIDE_PAD,
          maxHeight: HOOK_BLOCK_MAX_HEIGHT,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            overflowWrap: "break-word",
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
              overflowWrap: "break-word",
            }}
          >
            {renderInline(subtitle, palette.accent)}
          </div>
        )}
      </div>

      {/* Profile row — pinned at PROFILE_ROW_TOP. Compact (avatar 128,
          name 46pt, handle 38pt) — exact Post Builder values. */}
      <div
        style={{
          position: "absolute",
          top: PROFILE_ROW_TOP,
          left: SIDE_PAD,
          right: SIDE_PAD,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
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
              color: palette.fg,
              lineHeight: 1.1,
            }}
          >
            <span>{profile.displayName || "Your Name"}</span>
            {profile.verified && <VerifiedCheck size={52} />}
          </div>
          <div style={{ fontSize: 38, color: palette.muted, lineHeight: 1.1 }}>
            {profile.handle || "@handle"}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ReelHookPreview;
