// Multi-channel support for Coach Mode. Each "channel" is its own
// workspace — own pillars, schedule, settings, performance log. Switching
// channels swaps every storage read/write to the active channel's keys.
//
// Storage layout:
//   coach_channels            → Channel[]      (list of all channels on this browser)
//   coach_current_channel     → string         (id of the active channel)
//   coach_ch_<id>_<suffix>    → channel-scoped data
//                                 e.g. coach_ch_main_custom_pillars
//
// Backwards compatibility:
//   The original (single-channel) build wrote to unprefixed keys like
//   coach_custom_pillars / coach_posts. ensureChannelsInitialized() runs
//   once on first boot of the multi-channel build and migrates any
//   existing unprefixed data into a "Main" channel before deleting the
//   legacy keys. Idempotent — runs every boot but no-ops once the
//   channels list exists.

export interface Channel {
  id: string;
  name: string;
  createdAt: number;
}

const LS_KEY_CHANNELS = "coach_channels";
const LS_KEY_CURRENT = "coach_current_channel";

export const DEFAULT_CHANNEL_ID = "main";
export const DEFAULT_CHANNEL_NAME = "Main";

// Suffixes of every channel-scoped storage key. Used by the migration
// to walk legacy unprefixed keys into the Main channel, by deleteChannel
// to wipe a channel cleanly, and by exportChannel / importChannel to
// round-trip a channel's full state.
const SCOPED_SUFFIXES = [
  "custom_pillars",
  "custom_rotation",
  "custom_settings",
  "posts",
  "locked_strategy",
  "dismissed_reminders",
] as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function channelKey(channelId: string, suffix: string): string {
  return `coach_ch_${channelId}_${suffix}`;
}

export function loadChannels(): Channel[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY_CHANNELS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Channel =>
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function saveChannels(channels: Channel[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LS_KEY_CHANNELS, JSON.stringify(channels));
  } catch {
    // ignore quota
  }
}

export function getCurrentChannelId(): string {
  if (!isBrowser()) return DEFAULT_CHANNEL_ID;
  try {
    return (
      localStorage.getItem(LS_KEY_CURRENT) || DEFAULT_CHANNEL_ID
    );
  } catch {
    return DEFAULT_CHANNEL_ID;
  }
}

export function setCurrentChannelId(id: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LS_KEY_CURRENT, id);
  } catch {
    // ignore
  }
}

function newChannelId(): string {
  return `ch_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

// Creates a new empty channel. Doesn't write any pillar/rotation/settings
// data — those default to the Dr. Jeff seed via the existing fallback in
// the strategy module, so a new channel is genuinely "blank to fill in".
export function createChannel(name: string): Channel {
  const ch: Channel = {
    id: newChannelId(),
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
  };
  saveChannels([...loadChannels(), ch]);
  return ch;
}

export function renameChannel(id: string, name: string): void {
  const next = name.trim();
  if (!next) return;
  saveChannels(
    loadChannels().map((c) => (c.id === id ? { ...c, name: next } : c)),
  );
}

// Removes a channel and all of its scoped storage. Returns the channel
// that should become active afterwards (or null if you're trying to
// delete the last channel — caller should refuse in the UI).
export function deleteChannel(id: string): Channel | null {
  const channels = loadChannels();
  if (channels.length <= 1) return null;
  const remaining = channels.filter((c) => c.id !== id);
  saveChannels(remaining);
  // Wipe the channel's scoped keys.
  if (isBrowser()) {
    for (const suffix of SCOPED_SUFFIXES) {
      try {
        localStorage.removeItem(channelKey(id, suffix));
      } catch {
        // ignore
      }
    }
  }
  // If we deleted the active channel, fall back to the first remaining.
  if (getCurrentChannelId() === id) {
    setCurrentChannelId(remaining[0].id);
  }
  return remaining[0];
}

// ── Export / Import ────────────────────────────────────────────────────
//
// Round-trips a channel's full state as a single JSON document so users
// can back up their data, restore after a browser wipe, or share a
// pillars+schedule+settings setup with someone else. Imports always
// create a NEW channel so there's no risk of accidentally overwriting
// the active workspace.

export interface ChannelExport {
  version: 1;
  channelName: string;
  exportedAt: number;
  // Map of suffix → raw localStorage value (JSON-encoded string), or
  // null when that key isn't set. Storing the raw values lets the
  // import code write them back without parsing/re-serializing each
  // shape.
  data: Record<string, string | null>;
}

export function exportChannel(
  channelId: string,
  channelName: string,
): ChannelExport {
  const data: Record<string, string | null> = {};
  if (isBrowser()) {
    for (const suffix of SCOPED_SUFFIXES) {
      try {
        data[suffix] = localStorage.getItem(channelKey(channelId, suffix));
      } catch {
        data[suffix] = null;
      }
    }
  }
  return {
    version: 1,
    channelName,
    exportedAt: Date.now(),
    data,
  };
}

// Imports the export into a brand-new channel. Returns the new
// channel so the caller can switch to it. The new channel's name is
// the export's channelName + " (imported)" to make it clear what
// happened, and to avoid name collisions.
export function importChannel(exported: ChannelExport): Channel | null {
  if (!exported || exported.version !== 1) return null;
  const baseName = (exported.channelName || "Imported channel").trim();
  const channel = createChannel(`${baseName} (imported)`);
  if (!isBrowser()) return channel;
  for (const suffix of SCOPED_SUFFIXES) {
    const raw = exported.data?.[suffix];
    if (typeof raw !== "string") continue;
    try {
      localStorage.setItem(channelKey(channel.id, suffix), raw);
    } catch {
      // ignore quota — partial import beats no import
    }
  }
  return channel;
}

// One-time bootstrap. Idempotent. Run on every Coach Mode mount.
export function ensureChannelsInitialized(): void {
  if (!isBrowser()) return;
  const channels = loadChannels();
  if (channels.length > 0) {
    // Already initialized. Just make sure the current id points at a
    // channel that still exists (defensive against cross-tab deletes).
    const currentId = getCurrentChannelId();
    if (!channels.find((c) => c.id === currentId)) {
      setCurrentChannelId(channels[0].id);
    }
    return;
  }
  // First boot of the multi-channel build. Create Main + migrate.
  const main: Channel = {
    id: DEFAULT_CHANNEL_ID,
    name: DEFAULT_CHANNEL_NAME,
    createdAt: Date.now(),
  };
  saveChannels([main]);
  setCurrentChannelId(main.id);

  // Migrate any legacy unprefixed keys into the Main channel.
  for (const suffix of SCOPED_SUFFIXES) {
    const legacyKey = `coach_${suffix}`;
    try {
      const value = localStorage.getItem(legacyKey);
      if (value !== null) {
        localStorage.setItem(channelKey(main.id, suffix), value);
        localStorage.removeItem(legacyKey);
      }
    } catch {
      // ignore
    }
  }
}
