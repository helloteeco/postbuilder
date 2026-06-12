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

// ── Auto-classifier ────────────────────────────────────────────────
//
// Suggests which pillar(s) a story fits based on keyword overlap with
// each pillar's name + description + topic bank. Cheap heuristic: no
// API call, no model — just tokenize both sides, count matches, return
// the top N pillars. Good enough to save the user the 80% of clicks
// where the right pillar is obvious; they can still adjust the rest.
//
// Works for ANY pillar set (default seed or user-customized), since
// keywords are derived from the pillar's own data at call time.

import type { Pillar } from "./strategy";

// Common English filler words that match across all pillars and add
// noise. Only includes 3+ char words since the tokenizer already
// drops 1-2 char tokens.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "you",
  "but", "have", "had", "has", "are", "was", "were", "what", "when",
  "how", "why", "who", "out", "off", "all", "any", "can", "did", "get",
  "got", "may", "new", "now", "old", "one", "two", "see", "way", "yet",
  "own", "lot", "big", "top", "into", "onto", "over", "they", "them",
  "their", "there", "here", "about", "where", "which", "while",
  "would", "could", "should", "than", "then", "very", "much", "more",
  "most", "some", "many", "every", "each", "also", "just", "even",
  "still", "only", "really", "actually", "always", "never", "often",
  "sometimes", "again", "another", "other", "same", "different",
  "doing", "doesn", "didn", "won", "wasn", "weren", "isn", "aren",
  "been", "being", "before", "after", "during", "between", "across",
  "through", "without", "within", "around", "above", "below",
  "because", "since", "until", "though", "instead", "rather", "either",
  "neither", "both", "few", "less", "least", "first", "last", "next",
  "thing", "things", "stuff", "kind", "sort", "type", "way", "ways",
  "back", "forth", "going", "make", "made", "makes", "take", "took",
  "taking", "give", "gave", "given", "let", "lets", "say", "said",
  "says", "tell", "told", "tells", "use", "used", "using", "want",
  "wanted", "wants", "need", "needs", "needed", "know", "knew", "known",
  "knows", "think", "thought", "thinks", "feel", "felt", "feels",
  "look", "looked", "looking", "looks", "find", "found", "finds",
  "come", "came", "comes", "coming", "year", "years", "month", "months",
  "week", "weeks", "day", "days", "today", "yesterday", "tomorrow",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep $ and % so dollar amounts / percentages survive tokenization.
    .split(/[^a-z0-9$%]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function buildPillarKeywords(pillar: Pillar): Set<string> {
  const text = [pillar.name, pillar.description, ...pillar.topics].join(" ");
  return new Set(tokenize(text));
}

// Suggest up to `max` pillar IDs that the story body likely belongs to.
// Returns IDs sorted by descending match score; pillars with zero
// matches are excluded. Caller should treat this as a starting point —
// user adjustment is always allowed.
export function suggestPillarsForStory(
  storyBody: string,
  pillars: Pillar[],
  max = 2,
): string[] {
  const tokens = new Set(tokenize(storyBody));
  if (tokens.size === 0 || pillars.length === 0) return [];

  const scored = pillars.map((p) => {
    const keywords = buildPillarKeywords(p);
    let score = 0;
    keywords.forEach((kw) => {
      if (tokens.has(kw)) score++;
    });
    return { id: p.id, score };
  });

  // Threshold: require at least 2 matches OR a clear lead over the
  // runner-up. Single-match results are too noisy — almost any story
  // about money will match "tax-money" with a single hit on "money."
  const filtered = scored.filter((s) => s.score >= 2);
  if (filtered.length === 0) {
    // Fallback: if nothing crosses the 2-match threshold but one pillar
    // clearly leads (≥1 match and ≥2× the next-best), still tag it.
    const sorted = scored.sort((a, b) => b.score - a.score);
    if (
      sorted[0].score >= 1 &&
      (sorted[1]?.score ?? 0) * 2 <= sorted[0].score
    ) {
      return [sorted[0].id];
    }
    return [];
  }

  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.id);
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
