// Saved favorites for the Reel Builder. Per spec, all reel-related
// localStorage keys use the reel_ prefix. Storage is intentionally
// flat (one global list, not channel-scoped) — Reel Builder doesn't
// know about Coach Mode channels.

import type { ReelBg, ReelVariation } from "./reelTemplate";

export interface ReelFavorite {
  id: string;
  savedAt: number;
  bg: ReelBg;
  // Custom hex codes when bg === "custom". Optional for the other
  // palettes (their values come from REEL_BG_PALETTES).
  customBg?: string;
  customAccent?: string;
  variation: ReelVariation;
}

const LS_KEY = "reel_favorites";
const MAX_FAVORITES = 24;

const VALID_BGS: ReelBg[] = [
  "white",
  "soft",
  "yellow",
  "dark",
  "cream",
  "forest",
  "navy",
  "custom",
];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newId(): string {
  return `rfv_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isValidBg(v: unknown): v is ReelBg {
  return typeof v === "string" && (VALID_BGS as string[]).includes(v);
}

function isFavoriteShape(f: unknown): f is ReelFavorite {
  if (!f || typeof f !== "object") return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.savedAt === "number" &&
    isValidBg(o.bg) &&
    !!o.variation &&
    typeof (o.variation as Record<string, unknown>).hookHeadline === "string"
  );
}

export function loadFavorites(): ReelFavorite[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavoriteShape);
  } catch {
    return [];
  }
}

function save(list: ReelFavorite[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_FAVORITES)));
  } catch {
    // ignore quota
  }
}

export interface AddFavoriteInput {
  variation: ReelVariation;
  bg: ReelBg;
  customBg?: string;
  customAccent?: string;
}

export function addFavorite(input: AddFavoriteInput): ReelFavorite {
  const fav: ReelFavorite = {
    id: newId(),
    savedAt: Date.now(),
    bg: input.bg,
    customBg: input.customBg,
    customAccent: input.customAccent,
    variation: input.variation,
  };
  save([fav, ...loadFavorites()]);
  return fav;
}

export function removeFavorite(id: string): void {
  save(loadFavorites().filter((f) => f.id !== id));
}
