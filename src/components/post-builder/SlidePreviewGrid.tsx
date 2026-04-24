"use client";

import { CarouselSlide, SLIDE_HEIGHT, SLIDE_WIDTH } from "@/components/CarouselSlide";
import { slideCharCount, type PostBuilderParams, type PostBuilderProfile, type Slide } from "@/lib/post-templates";

interface Props {
  slides: Slide[];
  profile: PostBuilderProfile;
  params: PostBuilderParams;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const THUMB_WIDTH = 240;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * SLIDE_HEIGHT) / SLIDE_WIDTH); // preserve 4:5 aspect

export default function SlidePreviewGrid({
  slides,
  profile,
  params,
  selectedId,
  onSelect,
}: Props) {
  if (slides.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
        Your carousel preview will appear here. Paste a competitor post and hit
        Generate.
      </div>
    );
  }

  const scale = THUMB_WIDTH / SLIDE_WIDTH;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {slides.map((slide, i) => {
        const overflow = slideCharCount(slide) > params.maxCharsBody * 2.2;
        const selected = slide.id === selectedId;
        return (
          <button
            key={slide.id}
            type="button"
            onClick={() => onSelect(slide.id)}
            className={`group relative block overflow-hidden rounded-lg border-2 transition ${
              selected
                ? "border-gray-900 ring-2 ring-gray-900/20"
                : "border-gray-200 hover:border-gray-400"
            }`}
            style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
          >
            <div
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <CarouselSlide slide={slide} profile={profile} warnOverflow={overflow} />
            </div>
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {i + 1}
            </span>
            {overflow && (
              <span
                className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white"
                title="Content may overflow"
              >
                !
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
