// Overlay Studio — channel-scoped settings persistence. Reuses the
// existing channel helper so design content lives next to Coach Mode
// data without mixing it (Jeff posts coaching on Main, design on
// Teeco; the channel selector at the top of Coach Mode flips both).

import { channelKey, getCurrentChannelId } from "@/app/coach/lib/channels";
import {
  DEFAULT_SETTINGS,
  type OverlaySettings,
} from "./overlayTypes";

const SUFFIX = "overlay_settings";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function key(): string {
  return channelKey(getCurrentChannelId(), SUFFIX);
}

export function loadSettings(): OverlaySettings {
  if (!isBrowser()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: OverlaySettings): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key(), JSON.stringify(settings));
  } catch {
    // ignore quota
  }
}
