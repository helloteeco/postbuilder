// Personal story bank — channel-scoped storage of anecdotes the user
// has shared with Claude.ai over time. Tagged by pillar so the prompt
// builder can pull the right stories into the right post type.
//
// Storage: one entry per channel under coach_ch_<id>_story_bank.
// Each story carries a free-form title (3-7 words ideal), the story
// body in the user's voice, and an array of pillar IDs it fits.
//
// Export / import: hooked into channels.SCOPED_SUFFIXES so a channel
// JSON export round-trips a user's full story library.

import { channelKey, getCurrentChannelId } from "./channels";

export interface Story {
  id: string;
  title: string;
  body: string;
  // Pillars this story fits. Can be empty — untagged stories live in
  // the bank but don't auto-surface in the prompt builder.
  pillarIds: string[];
  createdAt: number;
}

const SUFFIX = "story_bank";

function key(): string {
  return channelKey(getCurrentChannelId(), SUFFIX);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newId(): string {
  return `story_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isStoryShape(s: unknown): s is Story {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    Array.isArray(o.pillarIds) &&
    typeof o.createdAt === "number"
  );
}

export function loadStories(): Story[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoryShape);
  } catch {
    return [];
  }
}

function saveStories(stories: Story[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key(), JSON.stringify(stories));
  } catch {
    // ignore quota
  }
}

export interface NewStoryInput {
  title: string;
  body: string;
  pillarIds?: string[];
}

export function addStory(input: NewStoryInput): Story {
  const story: Story = {
    id: newId(),
    title: input.title.trim() || "Untitled story",
    body: input.body.trim(),
    pillarIds: input.pillarIds ?? [],
    createdAt: Date.now(),
  };
  saveStories([story, ...loadStories()]);
  return story;
}

export function replaceStory(story: Story): void {
  saveStories(loadStories().map((s) => (s.id === story.id ? story : s)));
}

export function deleteStory(id: string): void {
  saveStories(loadStories().filter((s) => s.id !== id));
}

export function storiesForPillar(pillarId: string): Story[] {
  return loadStories().filter((s) => s.pillarIds.includes(pillarId));
}

// Pick up to N stories for the given pillar deterministically by
// (date + pillar id) so the same suggestions surface for an entire
// day instead of reshuffling every render.
export function dailyStoriesForPillar(
  date: Date,
  pillarId: string,
  count = 2,
): Story[] {
  const bank = storiesForPillar(pillarId);
  if (bank.length === 0) return [];
  const seed = `${date.toISOString().slice(0, 10)}-${pillarId}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const shuffled = bank.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) | 0;
    const j = Math.abs(h) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// Bulk parser for the "paste from Claude.ai" flow. Splits on blank
// lines (paragraph breaks) and treats each chunk as a candidate
// story. First line of each chunk becomes the title when it looks
// title-like (short, no terminal punctuation, or has a colon /
// numbered prefix); otherwise the first sentence (capped at 60 chars)
// is used. The body is always the full chunk so the user can review
// and edit before saving.
export function parseBulkStories(
  raw: string,
): Array<{ title: string; body: string }> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const chunks = trimmed
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  return chunks.map((chunk) => {
    const lines = chunk.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine.length > 0 && firstLine.length <= 80) {
      const looksLikeTitle =
        /^[\d.)]+\s+/.test(firstLine) ||
        firstLine.endsWith(":") ||
        !/[.!?]$/.test(firstLine);
      if (looksLikeTitle) {
        const cleanedTitle = firstLine
          .replace(/^[\d.)\-]+\s*/, "")
          .replace(/:$/, "")
          .trim();
        const body = lines.slice(1).join("\n").trim();
        return {
          title: cleanedTitle || firstLine,
          body: body.length > 0 ? body : chunk,
        };
      }
    }
    const firstSentMatch = chunk.match(/^[^.!?\n]+[.!?]/);
    const title = (firstSentMatch?.[0] ?? chunk.slice(0, 60)).trim();
    return { title, body: chunk };
  });
}
