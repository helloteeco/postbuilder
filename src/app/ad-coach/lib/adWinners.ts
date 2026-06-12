// Ad Coach — read-only selection of the user's proven organic winners
// from the existing Coach Mode tracker. We NEVER write to the tracker
// from here. The Launch Pack runs ads off content that already worked
// organically (boost winners, don't invent new creative), and the
// Readiness Gate checks "do you even have a proven post yet."

import {
  loadLoggedPosts,
  saveRate,
  shareRate,
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  toCoachPost,
  type LoggedPost,
} from "@/app/coach/lib/storage";
import { getDetectionSnapshot } from "@/app/coach/lib/timingHelpers";

export interface AdWinner {
  post: LoggedPost;
  savePct: number;
  sharePct: number;
  reach: number;
  // A post is "proven" if the user flagged it OR it cleared a rate
  // target. Both are honest signals it resonated.
  reason: string;
}

// Returns proven organic winners, best first. Excludes archived posts
// and posts without a settled snapshot.
export function getAdWinners(): AdWinner[] {
  const out: AdWinner[] = [];
  for (const post of loadLoggedPosts()) {
    if (post.isArchived) continue;
    const snap = getDetectionSnapshot(post);
    if (!snap) continue;
    const cv = toCoachPost(post, snap);
    const savePct = saveRate(cv);
    const sharePct = shareRate(cv);
    const hitSave = savePct >= SAVE_RATE_TARGET;
    const hitShare = sharePct >= SHARE_RATE_TARGET;
    const proven = post.isWinner || hitSave || hitShare;
    if (!proven) continue;
    const reasons: string[] = [];
    if (post.isWinner) reasons.push("you marked it a winner");
    if (hitSave) reasons.push(`save rate ${savePct.toFixed(1)}%`);
    if (hitShare) reasons.push(`share rate ${sharePct.toFixed(1)}%`);
    out.push({
      post,
      savePct,
      sharePct,
      reach: cv.reach,
      reason: reasons.join(" · "),
    });
  }
  // Rank by a simple resonance composite (shares weighted higher).
  out.sort(
    (a, b) => b.savePct + b.sharePct * 2.5 - (a.savePct + a.sharePct * 2.5),
  );
  return out;
}

// Cover hook text of a winner, for labels + the ad-copy prompt.
export function winnerHook(w: AdWinner): string {
  const slide1 = w.post.slides?.[0]?.text;
  const base = slide1 || w.post.title || "(untitled post)";
  return base
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a synthetic AdWinner from a user-pasted hook (+ optional body).
// Used when the user hasn't logged a Coach Mode winner yet but knows
// they've got a post that resonated organically — lets Launch Pack
// build the copy prompt with their REAL hook instead of a placeholder.
// Returns null if the hook is blank.
export function makeManualWinner(
  hook: string,
  body: string,
): AdWinner | null {
  const cleanHook = hook.trim();
  if (!cleanHook) return null;
  const cleanBody = body.trim();
  const slides = [
    { slideNumber: 1, text: cleanHook, isHook: true },
    ...(cleanBody
      ? [{ slideNumber: 2, text: cleanBody, isHook: false, isCTA: false }]
      : []),
  ];
  return {
    post: {
      id: "manual_hook",
      title: cleanHook,
      slides,
      // The fields below only exist on real LoggedPosts; the copy-prompt
      // doesn't read them, so casting to satisfy the type is honest.
    } as unknown as LoggedPost,
    savePct: 0,
    sharePct: 0,
    reach: 0,
    reason: "you marked it a proven organic post",
  };
}
