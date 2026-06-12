"use client";

import { forwardRef } from "react";
import type { CoverBg, PostBuilderProfile, Slide } from "@/lib/post-templates";

/**
 * Renders one 1080x1080 carousel slide. Uses inline styles (not Tailwind
 * classes) for fixed pixel measurements — important so html-to-image exports
 * pixel-accurate PNGs regardless of viewport.
 *
 * Two layouts:
 *   - "cover" (hook-opener): big hook headline at top, small profile row
 *     at bottom, optional bg color. Used for slide 1.
 *   - "body" (everything else): profile row at top, content below.
 */

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350; // 4:5 portrait — matches Instagram's default feed aspect
// Deprecated alias kept for older imports.
export const SLIDE_SIZE = SLIDE_WIDTH;

// Accent color applied to inline **bold** spans. Tuned to be readable on
// white, yellow, and dark backgrounds.
const ACCENT_COLOR = "#2E86AB";

interface CarouselSlideProps {
  slide: Slide;
  profile: PostBuilderProfile;
  // When true, applies a subtle overflow warning border — UI hint only.
  warnOverflow?: boolean;
}

// Curated cover palettes. Every combo has been picked for WCAG AA-or-better
// contrast on both body text (fg vs bg) and accent bold (accent vs bg), so
// any user's hook reads cleanly regardless of which they pick.
// Compute relative luminance of a hex color, per the WCAG formula. Used
// to pick black-or-white text color so a custom bg always reads cleanly.
function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1; // unknown → assume light, fall back to dark text
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function customPalette(
  customBg: string | undefined,
  customAccent: string | undefined,
): { bg: string; fg: string; muted: string; accent: string } {
  const bgHex = customBg && /^#?[0-9a-f]{6}$/i.test(customBg.trim()) ? customBg.trim() : "#FFFFFF";
  const normBg = bgHex.startsWith("#") ? bgHex : `#${bgHex}`;
  const lum = relativeLuminance(normBg);
  // Light bg → dark text; dark bg → light text. WCAG threshold ~0.5.
  const isLightBg = lum > 0.5;
  const fg = isLightBg ? "#0F1419" : "#FFFFFF";
  const muted = isLightBg ? "#6B7280" : "#9CA3AF";
  const accentHex = customAccent && /^#?[0-9a-f]{6}$/i.test(customAccent.trim()) ? customAccent.trim() : (isLightBg ? ACCENT_COLOR : "#5FB4D2");
  const normAccent = accentHex.startsWith("#") ? accentHex : `#${accentHex}`;
  return { bg: normBg, fg, muted, accent: normAccent };
}

function coverPalette(
  bg: CoverBg,
  customBg?: string,
  customAccent?: string,
): { bg: string; fg: string; muted: string; accent: string } {
  switch (bg) {
    case "yellow":
      return { bg: "#F5B935", fg: "#0F1419", muted: "#5C4A1F", accent: "#0F1419" };
    case "dark":
      return { bg: "#0F1419", fg: "#FFFFFF", muted: "#9CA3AF", accent: "#5FB4D2" };
    case "cream":
      return { bg: "#F7F0E1", fg: "#2A1F0F", muted: "#76624A", accent: "#B8501F" };
    case "forest":
      return { bg: "#1B3A2F", fg: "#F5F0E1", muted: "#9DBAA9", accent: "#E8B042" };
    case "navy":
      return { bg: "#0F2645", fg: "#F8FAFC", muted: "#94A8C7", accent: "#FF8C5C" };
    case "soft":
      return { bg: "#EEF2F6", fg: "#0F1419", muted: "#6B7280", accent: "#3290B5" };
    case "custom":
      return customPalette(customBg, customAccent);
    case "white":
    default:
      return { bg: "#FFFFFF", fg: "#0F1419", muted: "#6B7280", accent: ACCENT_COLOR };
  }
}

// Palette for photo-backed covers. The scrim is a vertical gradient,
// heavier at top (headline) and bottom (profile row) so text pops while
// the middle of the photo stays visible. Light text gets a warm yellow
// accent; dark text (over bright photos) gets terracotta.
function photoPalette(textColor: "light" | "dark" | undefined): {
  fg: string;
  muted: string;
  accent: string;
  scrim: string;
  textShadow: string;
} {
  if (textColor === "dark") {
    return {
      fg: "#0F1419",
      muted: "#374151",
      accent: "#B8501F",
      scrim:
        "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.38) 48%, rgba(255,255,255,0.82) 100%)",
      textShadow: "0 2px 18px rgba(255,255,255,0.6)",
    };
  }
  return {
    fg: "#FFFFFF",
    muted: "#E5E7EB",
    accent: "#F5C84C",
    scrim:
      "linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.20) 48%, rgba(0,0,0,0.66) 100%)",
    textShadow: "0 2px 24px rgba(0,0,0,0.55)",
  };
}

const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_SERIF =
  "'Lora', Georgia, 'Times New Roman', serif";
const FONT_DISPLAY =
  "'DM Serif Display', 'Lora', Georgia, serif";
const FONT_ROUNDED =
  "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function fontFamilyFor(profile: PostBuilderProfile): string {
  switch (profile.font) {
    case "serif":
      return FONT_SERIF;
    case "display":
      return FONT_DISPLAY;
    case "rounded":
      return FONT_ROUNDED;
    case "sans":
    default:
      return FONT_SANS;
  }
}

// Render **bold** / *emphasis* spans inline, with the accent color applied.
// Handles both double-asterisk and single-asterisk emphasis and drops any
// leftover stray asterisks so the exported PNG never shows raw * chars.
function renderInline(text: string, accentColor = ACCENT_COLOR) {
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
    // Strip any stray, unpaired asterisks that weren't part of a span.
    return <span key={i}>{part.replace(/\*/g, "")}</span>;
  });
}

const VerifiedCheck = ({ size = 36 }: { size?: number }) => (
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

// Profile row used by body slides (full size, top of slide).
const ProfileRow = ({
  profile,
  color,
  mutedColor,
}: {
  profile: PostBuilderProfile;
  color: string;
  mutedColor: string;
}) => {
  const avatarSize = 120;
  const fallbackInitial =
    profile.displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        marginBottom: 48,
      }}
    >
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
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
          fallbackInitial
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 44,
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          <span>{profile.displayName || "Your Name"}</span>
          {profile.verified && <VerifiedCheck size={50} />}
        </div>
        <div style={{ fontSize: 38, color: mutedColor, lineHeight: 1.1 }}>
          {profile.handle || "@handle"}
        </div>
      </div>
    </div>
  );
};

// Compact profile row used at the bottom of cover slides.
const ProfileRowCompact = ({
  profile,
  color,
  mutedColor,
}: {
  profile: PostBuilderProfile;
  color: string;
  mutedColor: string;
}) => {
  const avatarSize = 128;
  const fallbackInitial =
    profile.displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
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
          fallbackInitial
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
            color,
            lineHeight: 1.1,
          }}
        >
          <span>{profile.displayName || "Your Name"}</span>
          {profile.verified && <VerifiedCheck size={52} />}
        </div>
        <div style={{ fontSize: 38, color: mutedColor, lineHeight: 1.1 }}>
          {profile.handle || "@handle"}
        </div>
      </div>
    </div>
  );
};

// ── Body slide renderers ──

const PersonalStoryBody = ({
  paragraphs,
  accent,
}: {
  paragraphs: string[];
  accent: string;
}) => (
  <div style={{ fontSize: 54, lineHeight: 1.35 }}>
    {paragraphs.map((p, i) => (
      <div key={i} style={{ marginTop: i === 0 ? 0 : 24 }}>
        {renderInline(p, accent)}
      </div>
    ))}
  </div>
);

const CriteriaBulletsBody = ({
  heading,
  bullets,
  footer,
  accent,
}: {
  heading: string;
  bullets: string[];
  footer?: string;
  accent: string;
}) => (
  <>
    <div style={{ fontSize: 54, lineHeight: 1.3 }}>
      {renderInline(heading, accent)}
    </div>
    <div style={{ marginTop: 32, fontSize: 52, lineHeight: 1.35 }}>
      {bullets.map((b, i) => (
        <div
          key={i}
          style={{ marginBottom: 16, paddingLeft: 36, textIndent: -36 }}
        >
          •&nbsp;&nbsp;{renderInline(b, accent)}
        </div>
      ))}
    </div>
    {footer && (
      <div style={{ marginTop: 32, fontSize: 54, lineHeight: 1.3 }}>
        {renderInline(footer, accent)}
      </div>
    )}
  </>
);

const MarketDetailBody = ({
  rank,
  title,
  subtitle,
  bullets,
  stats,
  accent,
}: {
  rank: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  stats?: { label: string; value: string }[];
  accent: string;
}) => (
  <>
    <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.2 }}>
      #{rank} {renderInline(title, accent)}
    </div>
    {subtitle && (
      <div style={{ fontSize: 48, lineHeight: 1.3, marginTop: 24 }}>
        {renderInline(subtitle, accent)}
      </div>
    )}
    <div style={{ marginTop: 32, fontSize: 48, lineHeight: 1.3 }}>
      {bullets.map((b, i) => (
        <div
          key={i}
          style={{ marginBottom: 14, paddingLeft: 32, textIndent: -32 }}
        >
          •&nbsp;&nbsp;{renderInline(b, accent)}
        </div>
      ))}
    </div>
    {stats && stats.length > 0 && (
      <div
        style={{
          marginTop: 32,
          fontSize: 48,
          lineHeight: 1.35,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {stats.map((s, i) => (
          <div key={i}>
            {renderInline(s.label, accent)}: {renderInline(s.value, accent)}
          </div>
        ))}
      </div>
    )}
  </>
);

const NumberedListBody = ({
  heading,
  items,
  accent,
}: {
  heading: string;
  items: string[];
  accent: string;
}) => (
  <>
    <div style={{ fontSize: 54, lineHeight: 1.25 }}>
      {renderInline(heading, accent)}
    </div>
    <div
      style={{
        marginTop: 32,
        fontSize: 52,
        lineHeight: 1.4,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {items.map((item, i) => (
        <div key={i} style={{ paddingLeft: 52, textIndent: -52 }}>
          {i + 1}.&nbsp;&nbsp;{renderInline(item, accent)}
        </div>
      ))}
    </div>
  </>
);

const PlainTextBody = ({
  paragraphs,
  accent,
}: {
  paragraphs: string[];
  accent: string;
}) => (
  <div style={{ fontSize: 54, lineHeight: 1.35 }}>
    {paragraphs.map((p, i) => (
      <div key={i} style={{ marginTop: i === 0 ? 0 : 24 }}>
        {renderInline(p, accent)}
      </div>
    ))}
  </div>
);

// ── Main slide wrapper ──

export const CarouselSlide = forwardRef<HTMLDivElement, CarouselSlideProps>(
  function CarouselSlide({ slide, profile, warnOverflow }, ref) {
    // Cover layout: big hook at top, compact profile at bottom. Either a
    // bg color OR a full-bleed personal photo under a gradient scrim.
    if (slide.type === "hook-opener") {
      const hasPhoto = !!slide.photoDataUrl;
      const photoPal = hasPhoto ? photoPalette(slide.photoTextColor) : null;
      const colorPal = coverPalette(
        slide.bg ?? "white",
        slide.customBg,
        slide.customAccent,
      );
      const fg = photoPal?.fg ?? colorPal.fg;
      const muted = photoPal?.muted ?? colorPal.muted;
      const accent = photoPal?.accent ?? colorPal.accent;
      return (
        <div
          ref={ref}
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            background: hasPhoto ? "#0F1419" : colorPal.bg,
            padding: "240px 80px 380px",
            boxSizing: "border-box",
            fontFamily: fontFamilyFor(profile),
            color: fg,
            textAlign: "left",
            overflowWrap: "break-word",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            position: "relative",
            outline: warnOverflow ? "4px solid #F59E0B" : "none",
            outlineOffset: -4,
          }}
        >
          {hasPhoto && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.photoDataUrl}
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
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: photoPal!.scrim,
                }}
              />
            </>
          )}
          {/* Hook+subtitle hard-capped so they never approach the profile.
              Inner height: 1350 - 240 - 380 = 730. Profile ~140. Reserved
              gap ≥ 80. Max hook block = 730 - 140 - 80 = 510. */}
          <div
            style={{
              maxHeight: 510,
              overflow: "hidden",
              position: "relative",
              textShadow: photoPal?.textShadow,
            }}
          >
            <div
              style={{
                fontSize: 132,
                fontWeight: 700,
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
              }}
            >
              {renderInline(slide.headline, accent)}
            </div>
            {slide.subtitle && (
              <div
                style={{
                  marginTop: 28,
                  fontSize: 48,
                  lineHeight: 1.3,
                  color: muted,
                }}
              >
                {renderInline(slide.subtitle, accent)}
              </div>
            )}
          </div>
          <div
            style={{ position: "relative", textShadow: photoPal?.textShadow }}
          >
            <ProfileRowCompact
              profile={profile}
              color={fg}
              mutedColor={muted}
            />
          </div>
        </div>
      );
    }

    // Body layout: profile row at top, content below. Uses the same
    // coverPalette() helper as the cover so any of the 8 bg presets
    // (white default + soft / yellow / dark / cream / forest / navy /
    // custom) themes the entire slide consistently.
    const bodyPalette = coverPalette(slide.bg ?? "white", slide.customBg, slide.customAccent);
    return (
      <div
        ref={ref}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background: bodyPalette.bg,
          padding: "80px 80px",
          boxSizing: "border-box",
          fontFamily: fontFamilyFor(profile),
          color: bodyPalette.fg,
          textAlign: "left",
          overflowWrap: "break-word",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: warnOverflow ? "4px solid #F59E0B" : "none",
          outlineOffset: -4,
        }}
      >
        <ProfileRow
          profile={profile}
          color={bodyPalette.fg}
          mutedColor={bodyPalette.muted}
        />
        <div style={{ flex: 1 }}>
          {slide.type === "personal-story" && (
            <PersonalStoryBody paragraphs={slide.paragraphs} accent={bodyPalette.accent} />
          )}
          {slide.type === "criteria-bullets" && (
            <CriteriaBulletsBody
              heading={slide.heading}
              bullets={slide.bullets}
              footer={slide.footer}
              accent={bodyPalette.accent}
            />
          )}
          {slide.type === "market-detail" && (
            <MarketDetailBody
              rank={slide.rank}
              title={slide.title}
              subtitle={slide.subtitle}
              bullets={slide.bullets}
              stats={slide.stats}
              accent={bodyPalette.accent}
            />
          )}
          {slide.type === "numbered-list" && (
            <NumberedListBody
              heading={slide.heading}
              items={slide.items}
              accent={bodyPalette.accent}
            />
          )}
          {slide.type === "plain-text" && (
            <PlainTextBody paragraphs={slide.paragraphs} accent={bodyPalette.accent} />
          )}
          {slide.type === "cta" && (
            <PlainTextBody paragraphs={slide.paragraphs} accent={bodyPalette.accent} />
          )}
        </div>
      </div>
    );
  },
);
