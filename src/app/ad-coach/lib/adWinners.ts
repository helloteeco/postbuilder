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
