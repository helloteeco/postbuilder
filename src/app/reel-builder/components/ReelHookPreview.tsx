"use client";

// Renders one 1080×1920 reel cover. The layout is split into two zones:
//
//   • TOP (570px tall): "See description ↓" CTA + chevron, vertically
//     centered. Bigger than IG's caption peek so it reads at a glance.
//
//   • BOTTOM (1350px tall): a pixel-identical mirror of Post Builder's
//     slide-1 cover layout. Same padding (240/80/380), same headline
//     font (132pt bold, lineHeight 1.04, letterSpacing -0.025em),
//     same subtitle (48pt at 28px margin in palette.muted), same
//     compact profile row at the bottom (avatar 128, name 46pt,
//     handle 38pt, verified-check 52pt). Visual parity is the whole
//     point — when the user downloads the reel, the bottom 1350px
//     looks exactly like a Post Builder cover.
//
// Two render modes:
//   - When `scale` is set (in-page preview card), the entire 1080×1920
//     node is CSS-scaled.
//   - When `scale` is undefined (offscreen export node used by the
//     html-to-image pipeline), it renders at full size with no
//     transform applied.
//
// We deliberately re-implement the renderer instead of importing from
// CarouselSlide.tsx — Reel Builder is a separate feature per the
// original spec and shouldn't share files with Post Builder.

import { forwardRef } from "react";
import {
  COVER_PADDING_BOTTOM,
  COVER_PADDING_TOP,
  COVER_PADDING_X,
  REEL_BG_PALETTES,
  REEL_COVER_HEIGHT,
  REEL_HEIGHT,
  REEL_TOP_ZONE_HEIGHT,
  REEL_WIDTH,
  type ReelBg,
} from "@/app/reel-builder/lib/reelTemplate";
import type { ReelProfile } from "@/app/reel-builder/lib/reelProfile";

interface Props {
  bg: ReelBg;
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

// Twitter-style verified check, blue. Same SVG paths as Post Builder.
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

// Compact profile row at the bottom of the cover area. Mirrors
// ProfileRowCompact in CarouselSlide.tsx (avatar 128, name 46pt,
// handle 38pt, verified 52pt, gradient avatar fallback).
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
  { bg, headline, subtitle, profile, scale },
  ref,
) {
  const palette = REEL_BG_PALETTES[bg];
  const transform = scale ? `scale(${scale})` : undefined;

  return (
    <div
      ref={ref}
      style={{
        width: REEL_WIDTH,
        height: REEL_HEIGHT,
        background: palette.bg,
        color: palette.fg,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        textAlign: "left",
        overflow: "hidden",
        transform,
        transformOrigin: "top left",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* TOP ZONE — "See description ↓" + chevron, centered in 570px */}
      <div
        style={{
          width: REEL_WIDTH,
          height: REEL_TOP_ZONE_HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: palette.fg,
            letterSpacing: 0.5,
          }}
        >
          See description ↓
        </div>
        <div
          style={{
            fontSize: 130,
            fontWeight: 900,
            color: palette.accent,
            lineHeight: 1,
          }}
        >
          ↓
        </div>
      </div>

      {/* BOTTOM ZONE — pixel-identical mirror of Post Builder cover */}
      <div
        style={{
          width: REEL_WIDTH,
          height: REEL_COVER_HEIGHT,
          padding: `${COVER_PADDING_TOP}px ${COVER_PADDING_X}px ${COVER_PADDING_BOTTOM}px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowWrap: "break-word",
          flexShrink: 0,
        }}
      >
        {/* Hook block. Same maxHeight clamp as Post Builder so the
            headline never crashes into the profile row. */}
        <div style={{ maxHeight: 510, overflow: "hidden" }}>
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
        <ProfileRowCompact
          profile={profile}
          fg={palette.fg}
          muted={palette.muted}
        />
      </div>
    </div>
  );
});

export default ReelHookPreview;
