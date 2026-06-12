"use client";

// Personal Story Bank UI. Two add modes:
//   1. Single story — title + body + pillar tags
//   2. Bulk paste — paste a multi-story Claude.ai export and the app
//      splits it into reviewable drafts you tag and save in one go
//
// Includes a built-in "extraction prompt" the user can copy and paste
// into Claude.ai to summarize all the stories they've shared with it
// over time, formatted for the bulk paste step.
//
// Stories saved here are read by PromptBuilder when generating prompts
// for the active pillar — up to 2 relevant stories get injected into
// the prompt as personal-anchor material so future posts have real
// names / places / dollar amounts / moments instead of generic filler.

import { useEffect, useState } from "react";
import { getEffectivePillars, type Pillar } from "@/app/coach/lib/strategy";
import {
  addStory,
  deleteStory,
  loadStories,
  parseBulkStories,
  replaceStory,
  suggestPillarsForStory,
  type Story,
} from "@/app/coach/lib/storyBank";

// The prompt the user pastes into a long Claude.ai conversation to
// have it summarize every personal story they've shared. The output
// format is tuned to drop straight into the bulk-paste form below.
const EXTRACTION_PROMPT = `List every personal story or anecdote I've shared with you across our conversations.

For each one, format like this:

Story title (3-7 words, plain language, no quotes)
The story itself in 2-4 sentences in my voice. Keep specific people, places, dollar amounts, dates, and emotions I mentioned. No paraphrasing — match how I actually told it.

Separate each story with a blank line. Don't add intros, outros, or any commentary outside the stories — just the list.`;

interface Props {
  onChange?: () => void;
}

export default function StoryBank({ onChange }: Props) {
  const [stories, setStories] = useState<Story[]>([]);
  const [mode, setMode] = useState<"none" | "single" | "bulk">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  // Show only the first N stories by default to keep the section
  // compact when the user has dozens banked. "Show all" expands.
  const [showAllStories, setShowAllStories] = useState(false);
  const STORY_COLLAPSED_COUNT = 3;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pillarIds, setPillarIds] = useState<string[]>([]);

  const [bulkRaw, setBulkRaw] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<
    Array<{ title: string; body: string; pillarIds: string[] }>
  >([]);

  const pillars = getEffectivePillars();

  useEffect(() => {
    setStories(loadStories());
  }, []);

  function refresh() {
    setStories(loadStories());
    onChange?.();
  }

  function resetForm() {
    setMode("none");
    setEditingId(null);
    setTitle("");
    setBody("");
    setPillarIds([]);
    setBulkRaw("");
    setBulkDrafts([]);
  }

  function startEdit(story: Story) {
    setMode("single");
    setEditingId(story.id);
    setTitle(story.title);
    setBody(story.body);
    setPillarIds(story.pillarIds);
  }

  function togglePillar(id: string) {
    setPillarIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function saveSingle() {
    if (!body.trim()) return;
    if (editingId) {
      const original = stories.find((s) => s.id === editingId);
      if (original) {
        replaceStory({
          ...original,
          title: title.trim() || "Untitled story",
          body: body.trim(),
          pillarIds,
        });
      }
    } else {
      addStory({ title, body, pillarIds });
    }
    refresh();
    resetForm();
  }

  function parseBulk() {
    const parsed = parseBulkStories(bulkRaw);
    // Auto-tag each draft with its best-fit pillar(s) based on keyword
    // overlap. User reviews and adjusts before saving.
    setBulkDrafts(
      parsed.map((p) => ({
        ...p,
        pillarIds: suggestPillarsForStory(p.body, pillars, 2),
      })),
    );
  }

  function saveBulk() {
    for (const d of bulkDrafts) {
      if (!d.body.trim()) continue;
      addStory({ title: d.title, body: d.body, pillarIds: d.pillarIds });
    }
    refresh();
    resetForm();
  }

  function patchBulkDraft(
    i: number,
    patch: Partial<{ title: string; body: string; pillarIds: string[] }>,
  ) {
    setBulkDrafts((prev) =>
      prev.map((d, j) => (j === i ? { ...d, ...patch } : d)),
    );
  }

  function dropBulkDraft(i: number) {
    setBulkDrafts((prev) => prev.filter((_, j) => j !== i));
  }

  function copyExtractionPrompt() {
    navigator.clipboard
      .writeText(EXTRACTION_PROMPT)
      .then(() => {
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2000);
      })
      .catch(() => {
        // ignore clipboard failure — pre is selectable
      });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">Story Bank</h2>
          <p className="text-sm text-gray-600">
            Drop in personal stories from your Claude.ai conversations. Tag
            them by pillar — the prompt builder pulls relevant ones into
            future prompts so your posts have real anchor material (names,
            places, numbers, moments) instead of generic filler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          {helpOpen ? "Close help" : "How to extract from Claude.ai"}
        </button>
      </div>

      {helpOpen && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-2">
            Already shared stories with Claude.ai over months of chats? Have
            it summarize them in a clean format you can paste here in one go:
          </p>
          <ol className="mb-2 list-decimal space-y-1 pl-5">
            <li>Open the Claude.ai conversation where you&apos;ve been chatting</li>
            <li>Paste the prompt below into a new message and send</li>
            <li>Copy Claude&apos;s response and paste it into <em>Bulk paste</em> below</li>
            <li>Tag each parsed story with its pillar(s) and save</li>
          </ol>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-gray-800 ring-1 ring-amber-200">
{EXTRACTION_PROMPT}
          </pre>
          <button
            type="button"
            onClick={copyExtractionPrompt}
            className={`mt-2 rounded px-2.5 py-1 text-xs font-semibold transition ${
              promptCopied
                ? "bg-emerald-600 text-white"
                : "bg-gray-900 text-white hover:bg-black"
            }`}
          >
            {promptCopied ? "✓ Copied" : "Copy extraction prompt"}
          </button>
        </div>
      )}

      {mode === "none" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            + Add story
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            ↧ Bulk paste from Claude.ai
          </button>
          <span className="text-xs text-gray-500">
            {stories.length} stor{stories.length === 1 ? "y" : "ies"} saved
          </span>
        </div>
      )}

      {mode === "single" && (
        <SingleStoryForm
          title={title}
          body={body}
          pillarIds={pillarIds}
          pillars={pillars}
          editing={!!editingId}
          onTitle={setTitle}
          onBody={setBody}
          onTogglePillar={togglePillar}
          onSuggestPillars={() => {
            const suggested = suggestPillarsForStory(body, pillars, 2);
            setPillarIds(suggested);
          }}
          onSave={saveSingle}
          onCancel={resetForm}
        />
      )}

      {mode === "bulk" && (
        <BulkPasteForm
          raw={bulkRaw}
          drafts={bulkDrafts}
          pillars={pillars}
          onRaw={setBulkRaw}
          onParse={parseBulk}
          onPatchDraft={patchBulkDraft}
          onDropDraft={dropBulkDraft}
          onSave={saveBulk}
          onCancel={resetForm}
        />
      )}

      <ul className="space-y-2">
        {stories.length === 0 && mode === "none" && (
          <li className="rounded border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
            No stories yet. Add one above, or use bulk paste to import a batch
            from Claude.ai.
          </li>
        )}
        {(showAllStories
          ? stories
          : stories.slice(0, STORY_COLLAPSED_COUNT)
        ).map((s) => (
          <StoryRow
            key={s.id}
            story={s}
            pillars={pillars}
            onEdit={() => startEdit(s)}
            onDelete={() => {
              if (!confirm(`Delete "${s.title}"?`)) return;
              deleteStory(s.id);
              refresh();
            }}
          />
        ))}
      </ul>

      {stories.length > STORY_COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setShowAllStories((v) => !v)}
          className="mt-2 w-full rounded border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {showAllStories
            ? `Hide ${stories.length - STORY_COLLAPSED_COUNT} older stor${stories.length - STORY_COLLAPSED_COUNT === 1 ? "y" : "ies"} ▴`
            : `Show ${stories.length - STORY_COLLAPSED_COUNT} more stor${stories.length - STORY_COLLAPSED_COUNT === 1 ? "y" : "ies"} ▾`}
        </button>
      )}
    </section>
  );
}

interface SingleStoryFormProps {
  title: string;
  body: string;
  pillarIds: string[];
  pillars: Pillar[];
  editing: boolean;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onTogglePillar: (id: string) => void;
  onSuggestPillars: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function SingleStoryForm({
  title,
  body,
  pillarIds,
  pillars,
  editing,
  onTitle,
  onBody,
  onTogglePillar,
  onSuggestPillars,
  onSave,
  onCancel,
}: SingleStoryFormProps) {
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="block text-xs text-gray-600">
        Title (3-7 words)
        <input
          type="text"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="A short label you'll recognize"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Story (2-4 sentences in your voice — keep specific names, places,
        numbers, dates)
        <textarea
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={5}
          placeholder="The actual story…"
          className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-600">
            Tag with pillar(s) — the prompt builder surfaces this story when
            you generate posts for that pillar
          </span>
          <button
            type="button"
            onClick={onSuggestPillars}
            disabled={!body.trim()}
            className="rounded border border-gray-300 px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            title="Auto-pick pillars based on keyword overlap with this story"
          >
            ✨ Suggest pillars
          </button>
        </div>
        <PillarChips
          ids={pillarIds}
          pillars={pillars}
          onToggle={onTogglePillar}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!body.trim()}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
        >
          {editing ? "Save changes" : "Save story"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface BulkPasteFormProps {
  raw: string;
  drafts: Array<{ title: string; body: string; pillarIds: string[] }>;
  pillars: Pillar[];
  onRaw: (v: string) => void;
  onParse: () => void;
  onPatchDraft: (
    i: number,
    patch: Partial<{ title: string; body: string; pillarIds: string[] }>,
  ) => void;
  onDropDraft: (i: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

function BulkPasteForm({
  raw,
  drafts,
  pillars,
  onRaw,
  onParse,
  onPatchDraft,
  onDropDraft,
  onSave,
  onCancel,
}: BulkPasteFormProps) {
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="block text-xs text-gray-600">
        Paste the response from Claude.ai (one story per paragraph, separated
        by blank lines)
        <textarea
          value={raw}
          onChange={(e) => onRaw(e.target.value)}
          rows={10}
          placeholder={"Story title\nStory body…\n\nNext story title\nNext story body…"}
          className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onParse}
          disabled={!raw.trim()}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          Parse into drafts
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="space-y-0.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {drafts.length} candidate{drafts.length === 1 ? "" : "s"} —
              review and save
            </div>
            <div className="text-[11px] text-gray-500">
              ✨ Pillars auto-tagged based on each story&apos;s keywords. Adjust
              the chips if anything looks off.
            </div>
          </div>
          <ul className="space-y-2">
            {drafts.map((d, i) => (
              <li
                key={i}
                className="space-y-2 rounded border border-gray-200 bg-white p-2"
              >
                <input
                  type="text"
                  value={d.title}
                  onChange={(e) => onPatchDraft(i, { title: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-semibold"
                />
                <textarea
                  value={d.body}
                  onChange={(e) => onPatchDraft(i, { body: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PillarChips
                    ids={d.pillarIds}
                    pillars={pillars}
                    onToggle={(pid) => {
                      const next = d.pillarIds.includes(pid)
                        ? d.pillarIds.filter((x) => x !== pid)
                        : [...d.pillarIds, pid];
                      onPatchDraft(i, { pillarIds: next });
                    }}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => onDropDraft(i)}
                    className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Drop
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
          >
            Save all {drafts.length} stor{drafts.length === 1 ? "y" : "ies"}
          </button>
        </>
      )}
    </div>
  );
}

interface PillarChipsProps {
  ids: string[];
  pillars: Pillar[];
  onToggle: (id: string) => void;
  size?: "sm" | "md";
}

function PillarChips({ ids, pillars, onToggle, size = "md" }: PillarChipsProps) {
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <div className="flex flex-wrap gap-1.5">
      {pillars.map((p) => {
        const active = ids.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`rounded-full border ${sizeClass} transition ${
              active
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

interface StoryRowProps {
  story: Story;
  pillars: Pillar[];
  onEdit: () => void;
  onDelete: () => void;
}

function StoryRow({ story, pillars, onEdit, onDelete }: StoryRowProps) {
  const tagged = pillars.filter((p) => story.pillarIds.includes(p.id));
  return (
    <li className="rounded border border-gray-200 p-3 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">
            {story.title}
          </div>
          <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">
            {story.body}
          </div>
          {tagged.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {tagged.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700"
                >
                  {p.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[10px] italic text-gray-400">
              Untagged — won&apos;t auto-surface in prompts. Edit to add a
              pillar.
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
            aria-label="Delete story"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
