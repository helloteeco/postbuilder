// Per-user customization storage for Coach Mode. Friends opening the app
// in their own browsers get isolated localStorage by default, so this
// just gives them the UI to swap in their own pillars + posting schedule.
//
// Two pieces:
//   - coach_custom_pillars  — full Pillar[] override (with their own topic banks)
//   - coach_custom_rotation — Rotation override (which pillar lands on which slot)
//
// On app boot, installCustomData() is called once from CoachDashboard so the
// strategy module's effective references point at the user's data.

import {
  DEFAULT_COACH_SETTINGS,
  DEFAULT_ROTATION,
  PILLARS,
  setEffectivePillars,
  setEffectiveRotation,
  setEffectiveSettings,
  type CoachSettings,
  type Pillar,
  type Rotation,
} from "./strategy";
import { channelKey, getCurrentChannelId } from "./channels";

// Storage keys are scoped per channel via channelKey(channelId, suffix).
// The "current" channel is read from localStorage on every storage call,
// so switching channels in the UI immediately changes which keys are read.
const SUFFIX_PILLARS = "custom_pillars";
const SUFFIX_ROTATION = "custom_rotation";
const SUFFIX_SETTINGS = "custom_settings";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadCustomPillars(): Pillar[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(channelKey(getCurrentChannelId(), SUFFIX_PILLARS));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter(
      (p): p is Pillar =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.color === "string" &&
        typeof p.description === "string" &&
        Array.isArray(p.topics),
    );
    // Sanitize: strip any phantom topics from older saves. If a pillar's
    // topic bank empties out as a result, fall back to that pillar's
    // default seed topics so the user never sees a blank dropdown.
    const { sanitized, changed } = sanitizePillarTopics(valid);
    if (changed) saveCustomPillars(sanitized);
    return sanitized;
  } catch {
    return null;
  }
}

// Topic strings the user explicitly told us were stale and shouldn't
// appear anywhere again. Matched case-insensitively as a substring on
// each pillar topic. Adding new entries here scrubs them on next load
// (idempotent — if there's nothing to remove, the saved data isn't
// touched).
const FORBIDDEN_TOPIC_SUBSTRINGS = ["detroit"];

function isForbidden(topic: string): boolean {
  const t = topic.toLowerCase();
  return FORBIDDEN_TOPIC_SUBSTRINGS.some((s) => t.includes(s));
}

// Strips forbidden topics. If a pillar ends up with zero topics after
// the scrub, its bank gets restored from the matching PILLARS seed
// (or just emptied if no seed match — should never happen for the
// default pillar ids).
function sanitizePillarTopics(
  pillars: Pillar[],
): { sanitized: Pillar[]; changed: boolean } {
  let changed = false;
  const sanitized = pillars.map((p) => {
    const filtered = p.topics.filter((t) => {
      const bad = isForbidden(t);
      if (bad) changed = true;
      return !bad;
    });
    if (filtered.length === 0 && p.topics.length > 0) {
      const seed = PILLARS.find((s) => s.id === p.id);
      if (seed) {
        return { ...p, topics: [...seed.topics] };
      }
    }
    if (filtered.length !== p.topics.length) {
      return { ...p, topics: filtered };
    }
    return p;
  });
  return { sanitized, changed };
}

export function saveCustomPillars(pillars: Pillar[] | null): void {
  if (!isBrowser()) return;
  try {
    if (pillars === null) {
      localStorage.removeItem(channelKey(getCurrentChannelId(), SUFFIX_PILLARS));
    } else {
      localStorage.setItem(channelKey(getCurrentChannelId(), SUFFIX_PILLARS), JSON.stringify(pillars));
    }
  } catch {
    // ignore quota issues
  }
}

export function loadCustomRotation(): Rotation | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(channelKey(getCurrentChannelId(), SUFFIX_ROTATION));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.am || !parsed.pm) return null;
    return parsed as Rotation;
  } catch {
    return null;
  }
}

export function saveCustomRotation(rotation: Rotation | null): void {
  if (!isBrowser()) return;
  try {
    if (rotation === null) {
      localStorage.removeItem(channelKey(getCurrentChannelId(), SUFFIX_ROTATION));
    } else {
      localStorage.setItem(channelKey(getCurrentChannelId(), SUFFIX_ROTATION), JSON.stringify(rotation));
    }
  } catch {
    // ignore
  }
}

export function loadCustomSettings(): CoachSettings | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(channelKey(getCurrentChannelId(), SUFFIX_SETTINGS));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.slideCount !== "number" ||
      typeof parsed.readingLevel !== "string" ||
      typeof parsed.audience !== "string" ||
      typeof parsed.tone !== "string"
    ) {
      return null;
    }
    // Backfill creatorIdentity for older saves that pre-date the field.
    // Falls back to the default placeholder so the prompt doesn't end
    // up reading "You are a ghostwriter for ." if a stale settings row
    // is loaded.
    const creatorIdentity =
      typeof parsed.creatorIdentity === "string" && parsed.creatorIdentity.trim()
        ? parsed.creatorIdentity
        : DEFAULT_COACH_SETTINGS.creatorIdentity;
    return { ...parsed, creatorIdentity } as CoachSettings;
  } catch {
    return null;
  }
}

export function saveCustomSettings(settings: CoachSettings | null): void {
  if (!isBrowser()) return;
  try {
    if (settings === null) {
      localStorage.removeItem(channelKey(getCurrentChannelId(), SUFFIX_SETTINGS));
    } else {
      localStorage.setItem(channelKey(getCurrentChannelId(), SUFFIX_SETTINGS), JSON.stringify(settings));
    }
  } catch {
    // ignore
  }
}

// Wires custom data from localStorage into the strategy module's
// effective refs. Call once on app boot, plus after any save in the
// editor. Idempotent.
export function installCustomData(): void {
  setEffectivePillars(loadCustomPillars());
  setEffectiveRotation(loadCustomRotation());
  setEffectiveSettings(loadCustomSettings());
}

// Convenience: the default pillars + rotation, used to seed the editor
// the first time and as the "Reset to defaults" target.
export function defaultPillars(): Pillar[] {
  return PILLARS.map((p) => ({ ...p, topics: [...p.topics] }));
}

export function defaultRotation(): Rotation {
  return {
    am: { ...DEFAULT_ROTATION.am },
    pm: { ...DEFAULT_ROTATION.pm },
  };
}

export function defaultSettings(): CoachSettings {
  return { ...DEFAULT_COACH_SETTINGS };
}
