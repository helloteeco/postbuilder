// Read-only access to the Post Builder's profile so reels render with
// the user's same avatar / name / handle / verified badge. We read the
// SAME localStorage key Post Builder writes to (postBuilder.profile)
// but never write — reel builder is downstream of profile editing.
//
// If the user hasn't set up Post Builder yet, falls back to a sensible
// default so the page still renders something useful.

const LS_KEY = "postBuilder.profile";

export interface ReelProfile {
  displayName: string;
  handle: string;
  avatarDataUrl: string | null;
  verified: boolean;
}

const DEFAULT_PROFILE: ReelProfile = {
  displayName: "Dr. Jeff Chheuy",
  handle: "@jeffchheuy",
  avatarDataUrl: null,
  verified: true,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadReelProfile(): ReelProfile {
  if (!isBrowser()) return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<ReelProfile>;
    return {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName
          : DEFAULT_PROFILE.displayName,
      handle:
        typeof parsed.handle === "string" && parsed.handle.trim()
          ? parsed.handle
          : DEFAULT_PROFILE.handle,
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" ? parsed.avatarDataUrl : null,
      verified:
        typeof parsed.verified === "boolean"
          ? parsed.verified
          : DEFAULT_PROFILE.verified,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}
