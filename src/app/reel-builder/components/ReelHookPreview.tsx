"use client";

// Renders one 1080×1920 reel cover. The 1080×1350 cover area is
// centered vertically inside the reel (top=285) and uses the EXACT
// Post Builder cover layout — same 240/80/380 padding, same 132pt
// headline, same 48pt subtitle, same compact profile row. That way
// the reel's profile-grid thumbnail (which IG center-crops to 4:5 or
// 1:1) shows the headline + face in the same pixels as a Post Builder
// feed post.
//
// "See description ↓" sits BELOW the profile row in the cover's
// bottom-padding zone (y=1310). Single clean line, left-aligned at
// x=80 to match the headline column. The arrow is inline with the
// text (accent color, same size) — no separate giant chevron below.
// The previous two-line stack of white text + 76pt accent chevron
// felt tacky and competed with the headline; one line reads as a
// quiet, native-feeling affordance.
//
//   y=0
//   ┌────────────────────────┐  top empty band — IG reel-UI overlay
//   y=285
//   ┌────────────────────────┐  EMBEDDED 1080×1350 PB COVER
//   │ Headline (132pt bold)  │  y=525
//   │ Subtitle (48pt muted)  │
//   │                        │
//   │ [avatar] Name ✓        │  y=1115
//   │          @handle       │
//   │                        │
//   │ See description ↓      │  y=1310 single line, ↓ inline accent
//   y=1635
//   ┌────────────────────────┐  bottom band — IG bottom-UI overlay
//   y=1920
//
// Profile (font + name + handle + avatar + verified) comes from the
// SAME postBuilder.profile localStorage key as Post Builder, so any
// font/avatar/handle change in either feature propagates to both.

import { forwardRef } from "react";
import {
  COVER_AREA_HEIGHT,
  COVER_AREA_TOP,
  COVER_HOOK_MAX_HEIGHT,
  COVER_PADDING_BOTTOM,
  COVER_PADDING_TOP,
  COVER_PADDING_X,
  REEL_BG_PALETTES,
  REEL_HEIGHT,
  REEL_WIDTH,
  SEE_DESC_TEXT_Y,
  type ReelBg,
} from "@/app/reel-builder/lib/reelTemplate";
import type { PostBuilderProfile, ProfileFont } from "@/lib/post-templates";

interface Props {
  bg: ReelBg;
  headline: string;
  subtitle?: string;
  profile: PostBuilderProfile;
  scale?: number;
}

const FONT_FAMILY: Record<ProfileFont, string> = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  display: "'DM Serif Display', 'Lora', Georgia, serif",
  rounded: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

function fontFamilyFor(profile: PostBuilderProfile): string {
  return FONT_FAMILY[profile.font ?? "sans"];
}

// Renders **bold** and *emphasis* spans inline with the accent color.
// Strips any leftover stray asterisks. Mirrors Post Builder's
// renderInline behavior.
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

function ProfileRowCompact({
  profile,
  fg,
  muted,
}: {
  profile: PostBuilderProfile;
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
  const fontFamily = fontFamilyFor(profile);
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
      {/* EMBEDDED 1080×1350 POST BUILDER COVER */}
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

      {/* "See description ↓" — single clean line, left-aligned at
          x=80 to match the headline column. The arrow is inline with
          the text (same size, accent color) instead of a separate
          giant chevron below; that two-line stack felt tacky and
          competed visually with the headline. Now reads as a quiet,
          native-feeling affordance. */}
      <div
        style={{
          position: "absolute",
          top: SEE_DESC_TEXT_Y,
          left: COVER_PADDING_X,
          right: COVER_PADDING_X,
          textAlign: "left",
          fontSize: 56,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: palette.fg,
          opacity: 0.82,
          lineHeight: 1,
        }}
      >
        See description{" "}
        <span style={{ color: palette.accent, fontWeight: 800, opacity: 1 }}>
          ↓
        </span>
      </div>
    </div>
  );
});

export default ReelHookPreview;
