"use client";

// Renders a single reel cover at the canonical 1080×1920 export size.
// The export pipeline (videoExport.ts) renders this exact node into a
// PNG, which is then either looped into an MP4 or downloaded directly.
//
// Visual style mirrors Post Builder's slide-1 cover: dark bg, centered
// hook headline + optional subtitle, bold-via-asterisks rendered in
// the palette accent color. Adds a "See description ↓" CTA at the
// bottom (the whole reason a reel exists is to drive viewers to the
// caption) plus a small handle line below it.
//
// Two modes:
//   - When `interactive` is true (the in-page preview card), the node
//     is rendered scaled to fit the card via CSS transform.
//   - When `interactive` is false (the offscreen export node), it
//     renders at the full 1080×1920 with no transform, ready for
//     html-to-image to capture.

import { forwardRef } from "react";
import {
  REEL_BG_PALETTES,
  REEL_HEIGHT,
  REEL_WIDTH,
  type ReelBg,
} from "@/app/reel-builder/lib/reelTemplate";
import type { ReelProfile } from "@/app/reel-builder/lib/reelProfile";

interface Props {
  bg: ReelBg;
  headline: string;
  subtitle?: string;
  profile: ReelProfile;
  // CSS scale to apply for the in-page preview. Pass undefined when
  // rendering the offscreen export node.
  scale?: number;
}

// Splits a string into [{ text, bold }] segments so we can render
// **bold** spans in the accent color. Tolerates stray single
// asterisks (treated as plain text).
function renderInline(text: string, accentColor: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  // Match **bold** spans non-greedily.
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(<span key={key++}>{text.slice(lastIndex, m.index)}</span>);
    }
    out.push(
      <span key={key++} style={{ color: accentColor, fontWeight: 800 }}>
        {m[1]}
      </span>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return out;
}

// Initial-letter fallback when the user hasn't uploaded an avatar.
function avatarInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
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
        color: palette.text,
        position: "relative",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
        transform,
        transformOrigin: "top left",
        textAlign: "left",
      }}
    >
      {/* Top profile bar — small (~10% screen height) */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "#1F2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            fontWeight: 700,
            color: "#FFFFFF",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {profile.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarDataUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            avatarInitial(profile.displayName)
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            <span>{profile.displayName}</span>
            {profile.verified && <VerifiedCheck size={48} fill={palette.checkBg} />}
          </div>
          <div style={{ fontSize: 36, color: palette.muted, lineHeight: 1.1 }}>
            {profile.handle}
          </div>
        </div>
      </div>

      {/* Center hook (vertically centered in the middle 60% of screen) */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: 80,
          right: 80,
          height: "60%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -3,
            color: palette.text,
            overflowWrap: "break-word",
            wordBreak: "keep-all",
            width: "100%",
          }}
        >
          {renderInline(headline || "Your reel hook", palette.accent)}
        </div>
        {subtitle && subtitle.trim().length > 0 && (
          <div
            style={{
              marginTop: 36,
              fontSize: 50,
              fontWeight: 500,
              lineHeight: 1.3,
              color: palette.muted,
              overflowWrap: "break-word",
            }}
          >
            {renderInline(subtitle, palette.accent)}
          </div>
        )}
      </div>

      {/* Bottom CTA — "See description ↓" */}
      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 46,
            fontWeight: 700,
            color: palette.text,
            letterSpacing: 0.5,
          }}
        >
          See description ↓
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: palette.accent,
            lineHeight: 1,
          }}
        >
          ↓
        </div>
      </div>

      {/* Bottom-edge handle (subtle) */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 32,
          color: palette.muted,
          opacity: 0.7,
        }}
      >
        {profile.handle}
      </div>
    </div>
  );
});

function VerifiedCheck({ size, fill }: { size: number; fill: string }) {
  // Same SVG shape as Post Builder's check, recolored for the dark bg.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        d="M22.5 12.5l-2.6-3 .4-3.9-3.8-.9L14.4 1l-3.4 1.7L7.6 1 5.5 4.7l-3.8.9.4 3.9-2.6 3 2.6 3-.4 3.9 3.8.9 2.1 3.7 3.4-1.7 3.4 1.7 2.1-3.7 3.8-.9-.4-3.9z"
        fill={fill}
      />
      <path
        d="M9.7 16.5l-3.7-3.7 1.4-1.4 2.3 2.3 5.9-5.9 1.4 1.4z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export default ReelHookPreview;
