"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_PROFILE,
  LS_KEY_PROFILE,
  LS_KEY_SAVED_PROFILES,
  SAVED_PROFILE_LIMIT,
  normalizeHandle,
  type PostBuilderProfile,
  type ProfileFont,
  type SavedProfile,
} from "@/lib/post-templates";

interface Props {
  profile: PostBuilderProfile;
  onChange: (next: PostBuilderProfile) => void;
}

function loadSavedProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(LS_KEY_SAVED_PROFILES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.displayName === "string")
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function persistSavedProfiles(list: SavedProfile[]) {
  try {
    localStorage.setItem(LS_KEY_SAVED_PROFILES, JSON.stringify(list));
  } catch {
    // ignore (likely quota exceeded — heavy avatar payload)
  }
}

export default function ProfileEditor({ profile, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedProfile[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_PROFILE);
      if (raw) onChange({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    setSaved(loadSavedProfiles());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<PostBuilderProfile>) {
    const next = { ...profile, ...patch };
    onChange(next);
    try {
      localStorage.setItem(LS_KEY_PROFILE, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  async function onFile(file: File) {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update({ avatarDataUrl: reader.result });
      }
      setLoading(false);
    };
    reader.onerror = () => setLoading(false);
    reader.readAsDataURL(file);
  }

  function saveCurrent() {
    if (!profile.displayName.trim()) return;
    // De-dupe by displayName+handle so re-saving the same persona updates
    // its timestamp instead of stacking duplicates.
    const key = `${profile.displayName}|${profile.handle}`;
    const without = saved.filter(
      (s) => `${s.displayName}|${s.handle}` !== key,
    );
    const entry: SavedProfile = {
      ...profile,
      label: profile.displayName.trim(),
      savedAt: Date.now(),
    };
    const next = [entry, ...without].slice(0, SAVED_PROFILE_LIMIT);
    setSaved(next);
    persistSavedProfiles(next);
  }

  function loadSaved(s: SavedProfile) {
    const next: PostBuilderProfile = {
      displayName: s.displayName,
      handle: s.handle,
      avatarDataUrl: s.avatarDataUrl,
      verified: s.verified,
      font: s.font ?? "sans",
    };
    onChange(next);
    try {
      localStorage.setItem(LS_KEY_PROFILE, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function deleteSaved(label: string, handle: string) {
    const next = saved.filter(
      (s) => !(s.label === label && s.handle === handle),
    );
    setSaved(next);
    persistSavedProfiles(next);
  }

  const currentKey = `${profile.displayName}|${profile.handle}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Profile</div>
        <button
          type="button"
          onClick={saveCurrent}
          disabled={!profile.displayName.trim()}
          className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          title="Save current profile so you can switch back to it later"
        >
          Save profile
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gray-200 bg-gradient-to-br from-amber-300 to-yellow-600"
          title="Upload avatar"
        >
          {profile.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarDataUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
              {profile.displayName.charAt(0).toUpperCase() || "?"}
            </span>
          )}
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">
              …
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={profile.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            placeholder="Display name"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={profile.handle}
            onChange={(e) => update({ handle: normalizeHandle(e.target.value) })}
            placeholder="@handle"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={profile.verified}
              onChange={(e) => update({ verified: e.target.checked })}
            />
            Show verified check
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
        <span>Font:</span>
        {(["sans", "serif"] as ProfileFont[]).map((f) => {
          const active = (profile.font ?? "sans") === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => update({ font: f })}
              className={`rounded border px-2 py-0.5 transition ${
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
              style={{
                fontFamily:
                  f === "serif"
                    ? "'Lora', Georgia, serif"
                    : "'Inter', sans-serif",
              }}
            >
              {f === "serif" ? "Serif (Wilson-style)" : "Sans (Jeff-style)"}
            </button>
          );
        })}
      </div>

      {saved.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="mb-2 text-xs font-medium text-gray-600">
            Saved profiles
          </div>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => {
              const isActive = `${s.displayName}|${s.handle}` === currentKey;
              return (
                <div
                  key={`${s.label}|${s.handle}|${s.savedAt}`}
                  className={`group flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${
                    isActive
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadSaved(s)}
                    className="flex items-center gap-1.5"
                    title={`Load ${s.label} (${s.handle})`}
                  >
                    {s.avatarDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatarDataUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 text-[10px] font-bold text-white">
                        {s.displayName.charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                    <span className="max-w-[120px] truncate">{s.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSaved(s.label, s.handle)}
                    className={`rounded-full px-1 text-[11px] leading-none ${
                      isActive
                        ? "text-white/70 hover:text-white"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                    title="Remove from saved"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-400">
            Up to {SAVED_PROFILE_LIMIT} saved per browser. Click to switch, × to remove.
          </div>
        </div>
      )}
    </div>
  );
}
