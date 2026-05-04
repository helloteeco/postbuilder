// Client-side wrapper that holds cross-component state — the active
// channel, the "selected slot" for the prompt builder, and a revision
// counter that forces children to re-read from localStorage after any
// channel switch or customization save.

"use client";

import { useEffect, useState } from "react";
import CoachGuides, { type GuideTab } from "@/app/coach/components/CoachGuides";
import HookFormulas from "@/app/coach/components/HookFormulas";
import PerformanceTracker from "@/app/coach/components/PerformanceTracker";
import PillarReference from "@/app/coach/components/PillarReference";
import PillarsScheduleEditor from "@/app/coach/components/PillarsScheduleEditor";
import PromptBuilder from "@/app/coach/components/PromptBuilder";
import StoryBank from "@/app/coach/components/StoryBank";
import TodaysPlan from "@/app/coach/components/TodaysPlan";
import WeekCalendar from "@/app/coach/components/WeekCalendar";
import WelcomeBanner from "@/components/WelcomeBanner";
import type { Slot } from "@/app/coach/lib/strategy";
import { installCustomData } from "@/app/coach/lib/customization";
import {
  createChannel,
  deleteChannel,
  ensureChannelsInitialized,
  exportChannel,
  getCurrentChannelId,
  importChannel,
  loadChannels,
  renameChannel,
  setCurrentChannelId,
  type Channel,
  type ChannelExport,
} from "@/app/coach/lib/channels";

export interface SelectedSlot {
  // Stored as ISO date-only string (yyyy-mm-dd) so it round-trips cleanly
  // and JSON-stringifies without timezone surprises.
  isoDate: string;
  slot: Slot;
}

export default function CoachDashboard() {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [guidesTab, setGuidesTab] = useState<GuideTab | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  // Bumped after any save / channel switch to force children to remount
  // and re-read from localStorage.
  const [revision, setRevision] = useState(0);

  // Bootstrap on mount: ensure channels list exists (migrating any legacy
  // unprefixed data into the Main channel), then install custom data for
  // the active channel.
  useEffect(() => {
    ensureChannelsInitialized();
    const list = loadChannels();
    setChannels(list);
    setActiveChannelId(getCurrentChannelId());
    installCustomData();
    setRevision((v) => v + 1);
  }, []);

  function refreshAfterChannelChange() {
    setChannels(loadChannels());
    setActiveChannelId(getCurrentChannelId());
    installCustomData();
    setSelectedSlot(null);
    setRevision((v) => v + 1);
  }

  function handleSwitchChannel(id: string) {
    setCurrentChannelId(id);
    refreshAfterChannelChange();
  }

  function handleNewChannel() {
    const name = prompt("Name your new channel (e.g. \"Side hustle\", \"Friend's account\")", "");
    if (name === null) return;
    const ch = createChannel(name);
    setCurrentChannelId(ch.id);
    refreshAfterChannelChange();
  }

  function handleRename() {
    const current = channels.find((c) => c.id === activeChannelId);
    if (!current) return;
    const name = prompt("Rename this channel", current.name);
    if (name === null) return;
    renameChannel(current.id, name);
    setChannels(loadChannels());
  }

  function handleDelete() {
    if (channels.length <= 1) return;
    const current = channels.find((c) => c.id === activeChannelId);
    if (!current) return;
    // Typed confirmation — destructive op deserves more than a one-click
    // OK. The user must literally type DELETE to confirm.
    const typed = prompt(
      `Delete channel "${current.name}"?\n\nThis wipes EVERYTHING for this channel — pillars, schedule, settings, every logged post, every snapshot, every captured slide deck and structural analysis, plus the active locked strategy. Other channels are unaffected. There is no undo.\n\nType DELETE (in caps) to confirm:`,
      "",
    );
    if (typed !== "DELETE") return;
    deleteChannel(current.id);
    refreshAfterChannelChange();
  }

  function handleExport() {
    const current = channels.find((c) => c.id === activeChannelId);
    if (!current || typeof document === "undefined") return;
    const exported = exportChannel(current.id, current.name);
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = current.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `coach-mode-${safeName}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as ChannelExport;
        if (!parsed || parsed.version !== 1 || typeof parsed.channelName !== "string") {
          alert(
            "That doesn't look like a Coach Mode export — expected a JSON file produced by the Export button.",
          );
          return;
        }
        const newChannel = importChannel(parsed);
        if (!newChannel) {
          alert("Couldn't import — the file looked valid but writing it failed.");
          return;
        }
        setCurrentChannelId(newChannel.id);
        refreshAfterChannelChange();
      } catch {
        alert("Couldn't read that file. Make sure it's a valid Coach Mode JSON export.");
      }
    };
    input.click();
  }

  function handleSelectSlot(s: SelectedSlot) {
    setSelectedSlot(s);
    if (typeof document !== "undefined") {
      const el = document.getElementById("coach-prompt-builder");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function handleEditorSaved() {
    installCustomData();
    setRevision((v) => v + 1);
  }

  const canDelete = channels.length > 1;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Channel
          </span>
          <select
            value={activeChannelId}
            onChange={(e) => handleSwitchChannel(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm font-medium"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewChannel}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            + New
          </button>
          <button
            type="button"
            onClick={handleRename}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            title="Download this channel's data as a JSON backup"
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            title="Load a channel from a JSON export — creates a new channel, never overwrites the active one"
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            title={canDelete ? "Delete this channel (requires typed confirmation)" : "Need at least one channel"}
          >
            Delete
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGuidesTab("how-to")}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            How to use
          </button>
          <button
            type="button"
            onClick={() => setGuidesTab("diy")}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            DIY in Claude
          </button>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Customize pillars &amp; schedule
          </button>
        </div>
      </div>

      <WelcomeBanner
        storageKey="welcome_coach_v1"
        title="👋 Welcome to Coach Mode"
        steps={[
          {
            label: "Make it yours",
            detail:
              'Click "Customize pillars & schedule" above. Update your audience, tone, and creator identity (the line that says "You are a ghostwriter for…" in your generated prompts) so every post sounds like you, not like the demo.',
          },
          {
            label: "Adjust pillars + schedule",
            detail:
              "The 5 default pillars are starter examples. In the same Customize panel, edit pillar names / topics or replace them with your own niche, then arrange the weekly AM/PM rotation.",
          },
          {
            label: "Generate your first prompt",
            detail:
              "Click any slot in the 7-day calendar below. Pick a topic, copy the prompt, and paste it into Claude.ai. Bring the response back into Post Builder or Reel Builder to render slides / reels.",
          },
          {
            label: "(Optional) Drop in personal stories",
            detail:
              "The Story Bank lets you save anecdotes from your Claude.ai chats so future prompts pull real names + numbers + moments instead of generic filler. Has a built-in extraction prompt to grab them all from a long conversation.",
          },
        ]}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <div className="mb-1 font-semibold uppercase tracking-wider text-amber-800">
          Why we post · the flywheel
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium">
          <span>Content</span>
          <span className="text-amber-500">→</span>
          <span>Trust</span>
          <span className="text-amber-500">→</span>
          <span>Capital</span>
          <span className="text-amber-500">→</span>
          <span>Deals</span>
          <span className="text-amber-500">→</span>
          <span>Case Studies</span>
          <span className="text-amber-500">→</span>
          <span>More Content</span>
        </div>
        <div className="mt-1 text-amber-800/80">
          Every post feeds the next stage. If a post doesn&apos;t move
          someone closer to trusting you, skip it.
        </div>
      </div>

      <PromptBuilder key={`pb-${revision}`} selectedSlot={selectedSlot} />
      <TodaysPlan key={`tp-${revision}`} />
      <WeekCalendar
        key={`wc-${revision}`}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
      />
      <PerformanceTracker key={`pt-${revision}`} />
      <StoryBank
        key={`sb-${revision}`}
        onChange={() => setRevision((v) => v + 1)}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HookFormulas />
        <PillarReference key={`pr-${revision}`} />
      </div>

      <PillarsScheduleEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={handleEditorSaved}
      />
      <CoachGuides
        open={guidesTab}
        onClose={() => setGuidesTab(null)}
      />
    </>
  );
}
