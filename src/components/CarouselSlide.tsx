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

function coverPalette(bg: CoverBg): { bg: string; fg: string; muted: string; accent: string } {
  switch (bg) {
    case "yellow":
      return { bg: "#F5B935", fg: "#0F1419", muted: "#5C4A1F", accent: "#0F1419" };
    case "dark":
      return { bg: "#0F1419", fg: "#FFFFFF", muted: "#9CA3AF", accent: "#5FB4D2" };
    case "white":
    default:
      return { bg: "#FFFFFF", fg: "#0F1419", muted: "#6B7280", accent: ACCENT_COLOR };
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
          {profile.verified && <VerifiedCheck size={40} />}
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
          {profile.verified && <VerifiedCheck size={40} />}
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
    // Cover layout: big hook at top, compact profile at bottom, bg color.
    if (slide.type === "hook-opener") {
      const palette = coverPalette(slide.bg ?? "white");
      return (
        <div
          ref={ref}
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            background: palette.bg,
            padding: "240px 80px 380px",
            boxSizing: "border-box",
            fontFamily:
              "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: palette.fg,
            textAlign: "left",
            overflowWrap: "break-word",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            outline: warnOverflow ? "4px solid #F59E0B" : "none",
            outlineOffset: -4,
          }}
        >
          {/* Hook+subtitle hard-capped so they never approach the profile.
              Inner height: 1350 - 240 - 380 = 730. Profile ~140. Reserved
              gap ≥ 80. Max hook block = 730 - 140 - 80 = 510. */}
          <div style={{ maxHeight: 510, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 132,
                fontWeight: 700,
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
              }}
            >
              {renderInline(slide.headline, palette.accent)}
            </div>
            {slide.subtitle && (
              <div
                style={{
                  marginTop: 28,
                  fontSize: 48,
                  lineHeight: 1.3,
                  color: palette.muted,
                }}
              >
                {renderInline(slide.subtitle, palette.accent)}
              </div>
            )}
          </div>
          <ProfileRowCompact
            profile={profile}
            color={palette.fg}
            mutedColor={palette.muted}
          />
        </div>
      );
    }

    // Body layout: profile row at top, content below.
    return (
      <div
        ref={ref}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background: "#FFFFFF",
          padding: "80px 80px",
          boxSizing: "border-box",
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#0F1419",
          textAlign: "left",
          overflowWrap: "break-word",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: warnOverflow ? "4px solid #F59E0B" : "none",
          outlineOffset: -4,
        }}
      >
        <ProfileRow profile={profile} color="#0F1419" mutedColor="#6B7280" />
        <div style={{ flex: 1 }}>
          {slide.type === "personal-story" && (
            <PersonalStoryBody paragraphs={slide.paragraphs} accent={ACCENT_COLOR} />
          )}
          {slide.type === "criteria-bullets" && (
            <CriteriaBulletsBody
              heading={slide.heading}
              bullets={slide.bullets}
              footer={slide.footer}
              accent={ACCENT_COLOR}
            />
          )}
          {slide.type === "market-detail" && (
            <MarketDetailBody
              rank={slide.rank}
              title={slide.title}
              subtitle={slide.subtitle}
              bullets={slide.bullets}
              stats={slide.stats}
              accent={ACCENT_COLOR}
            />
          )}
          {slide.type === "numbered-list" && (
            <NumberedListBody
              heading={slide.heading}
              items={slide.items}
              accent={ACCENT_COLOR}
            />
          )}
          {slide.type === "plain-text" && (
            <PlainTextBody paragraphs={slide.paragraphs} accent={ACCENT_COLOR} />
          )}
          {slide.type === "cta" && (
            <PlainTextBody paragraphs={slide.paragraphs} accent={ACCENT_COLOR} />
          )}
        </div>
      </div>
    );
  },
);
