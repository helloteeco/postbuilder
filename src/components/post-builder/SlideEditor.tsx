"use client";

import type { CoverBg, Slide } from "@/lib/post-templates";

interface Props {
  slide: Slide;
  onChange: (next: Slide) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// Generic textarea that edits an array of strings via newline-separated text.
function Lines({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs text-gray-600">
      {label}
      <textarea
        value={value.join("\n")}
        onChange={(e) =>
          onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))
        }
        rows={rows}
        className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
      />
    </label>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-gray-600">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </label>
  );
}

export default function SlideEditor({
  slide,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  function patch<T extends Slide>(p: Partial<T>) {
    onChange({ ...(slide as T), ...p } as Slide);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-gray-500">
          Slide type: <span className="font-semibold text-gray-800">{slide.type}</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 disabled:opacity-40"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 disabled:opacity-40"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {slide.type === "hook-opener" && (
        <>
          <Text
            label="Headline (the hook — keep it under 8 words)"
            value={slide.headline}
            onChange={(v) => patch({ headline: v })}
          />
          <Text
            label="Subtitle (optional, small line below the hook)"
            value={slide.subtitle ?? ""}
            onChange={(v) => patch({ subtitle: v })}
          />
          <div>
            <div className="mb-1.5 text-xs text-gray-600">Background</div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { bg: "white", swatch: "#FFFFFF" },
                  { bg: "soft", swatch: "#EEF2F6" },
                  { bg: "yellow", swatch: "#F5B935" },
                  { bg: "dark", swatch: "#0F1419" },
                  { bg: "cream", swatch: "#F7F0E1" },
                  { bg: "forest", swatch: "#1B3A2F" },
                  { bg: "navy", swatch: "#0F2645" },
                  { bg: "custom", swatch: "linear-gradient(135deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6)" },
                ] as { bg: CoverBg; swatch: string }[]
              ).map(({ bg, swatch }) => {
                const active = (slide.bg ?? "white") === bg;
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => patch({ bg })}
                    className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs transition ${
                      active
                        ? "border-gray-900 ring-2 ring-gray-900/10"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: swatch,
                        border:
                          bg === "white" || bg === "cream" || bg === "soft"
                            ? "1px solid #D1D5DB"
                            : "none",
                      }}
                    />
                    <span className="capitalize">{bg}</span>
                  </button>
                );
              })}
            </div>
            {slide.bg === "custom" && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-gray-600">
                  Background color
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={slide.customBg ?? "#ffffff"}
                      onChange={(e) => patch({ customBg: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={slide.customBg ?? ""}
                      onChange={(e) => patch({ customBg: e.target.value })}
                      placeholder="#FFFFFF"
                      className="flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </label>
                <label className="text-xs text-gray-600">
                  Accent (bold) color
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={slide.customAccent ?? "#2e86ab"}
                      onChange={(e) => patch({ customAccent: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={slide.customAccent ?? ""}
                      onChange={(e) => patch({ customAccent: e.target.value })}
                      placeholder="#2E86AB"
                      className="flex-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </label>
                <div className="text-[11px] text-gray-500 sm:col-span-2">
                  Body text color is auto-picked (black on light bg, white on dark) so the headline always reads clean.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {slide.type === "personal-story" && (
        <Lines
          label="Paragraphs (one per line, **bold** supported)"
          value={slide.paragraphs}
          onChange={(v) => patch({ paragraphs: v })}
          rows={6}
        />
      )}

      {slide.type === "criteria-bullets" && (
        <>
          <Text
            label="Heading"
            value={slide.heading}
            onChange={(v) => patch({ heading: v })}
          />
          <Lines
            label="Bullets"
            value={slide.bullets}
            onChange={(v) => patch({ bullets: v })}
          />
          <Text
            label="Footer (optional)"
            value={slide.footer ?? ""}
            onChange={(v) => patch({ footer: v })}
          />
        </>
      )}

      {slide.type === "market-detail" && (
        <>
          <label className="block text-xs text-gray-600">
            Rank
            <input
              type="number"
              value={slide.rank}
              onChange={(e) => patch({ rank: Number(e.target.value) || 1 })}
              className="mt-1 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <Text label="Title" value={slide.title} onChange={(v) => patch({ title: v })} />
          <Text
            label="Subtitle"
            value={slide.subtitle ?? ""}
            onChange={(v) => patch({ subtitle: v })}
          />
          <Lines label="Bullets" value={slide.bullets} onChange={(v) => patch({ bullets: v })} />
          <Lines
            label="Stats (format: Label|Value per line)"
            value={(slide.stats ?? []).map((s) => `${s.label}|${s.value}`)}
            onChange={(v) =>
              patch({
                stats: v.map((line) => {
                  const [label, value] = line.split("|");
                  return { label: (label ?? "").trim(), value: (value ?? "").trim() };
                }),
              })
            }
          />
        </>
      )}

      {slide.type === "numbered-list" && (
        <>
          <Text
            label="Heading"
            value={slide.heading}
            onChange={(v) => patch({ heading: v })}
          />
          <Lines label="Items" value={slide.items} onChange={(v) => patch({ items: v })} />
        </>
      )}

      {slide.type === "plain-text" && (
        <Lines
          label="Paragraphs"
          value={slide.paragraphs}
          onChange={(v) => patch({ paragraphs: v })}
        />
      )}

      {slide.type === "cta" && (
        <Lines
          label="Paragraphs (**bold** for the DM keyword)"
          value={slide.paragraphs}
          onChange={(v) => patch({ paragraphs: v })}
        />
      )}
    </div>
  );
}
