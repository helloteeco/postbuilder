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
  DEFAULT_ROTATION,
  PILLARS,
  setEffectivePillars,
  setEffectiveRotation,
  type Pillar,
  type Rotation,
} from "./strategy";

const LS_KEY_PILLARS = "coach_custom_pillars";
const LS_KEY_ROTATION = "coach_custom_rotation";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadCustomPillars(): Pillar[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LS_KEY_PILLARS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.filter(
      (p): p is Pillar =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.color === "string" &&
        typeof p.description === "string" &&
        Array.isArray(p.topics),
    );
  } catch {
    return null;
  }
}

export function saveCustomPillars(pillars: Pillar[] | null): void {
  if (!isBrowser()) return;
  try {
    if (pillars === null) {
      localStorage.removeItem(LS_KEY_PILLARS);
    } else {
      localStorage.setItem(LS_KEY_PILLARS, JSON.stringify(pillars));
    }
  } catch {
    // ignore quota issues
  }
}

export function loadCustomRotation(): Rotation | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LS_KEY_ROTATION);
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
      localStorage.removeItem(LS_KEY_ROTATION);
    } else {
      localStorage.setItem(LS_KEY_ROTATION, JSON.stringify(rotation));
    }
  } catch {
    // ignore
  }
}

// Wires custom data from localStorage into the strategy module's
// effective refs. Call once on app boot. Idempotent.
export function installCustomData(): void {
  setEffectivePillars(loadCustomPillars());
  setEffectiveRotation(loadCustomRotation());
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
