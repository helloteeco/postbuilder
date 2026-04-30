// Section C of Coach Mode: log a published post (title, date, reach, saves,
// shares, profile visits) and see save/share rates color-coded against
// the targets defined in storage.ts.

"use client";

import { useEffect, useState } from "react";
import {
  SAVE_RATE_TARGET,
  SHARE_RATE_TARGET,
  addPost,
  deletePost,
  loadPosts,
  ratePerf,
  saveRate,
  shareRate,
  type CoachPost,
  type PerfTier,
} from "@/app/coach/lib/storage";

interface FormState {
  title: string;
  datePosted: string;
  reach: string;
  saves: string;
  shares: string;
  profileVisits: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  datePosted: new Date().toISOString().slice(0, 10),
  reach: "",
  saves: "",
  shares: "",
  profileVisits: "",
};

function tierClasses(t: PerfTier): string {
  if (t === "good") return "text-emerald-700 bg-emerald-50";
  if (t === "ok") return "text-amber-700 bg-amber-50";
  return "text-rose-700 bg-rose-50";
}

function fmtRate(n: number): string {
  return `${n.toFixed(2)}%`;
}

export default function PerformanceTracker() {
  const [posts, setPosts] = useState<CoachPost[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    addPost({
      title: form.title.trim(),
      datePosted: form.datePosted,
      reach: Number(form.reach) || 0,
      saves: Number(form.saves) || 0,
      shares: Number(form.shares) || 0,
      profileVisits: Number(form.profileVisits) || 0,
    });
    setPosts(loadPosts());
    setForm(EMPTY_FORM);
  }

  function onDelete(id: string) {
    deletePost(id);
    setPosts(loadPosts());
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">
        Performance tracker
      </h2>
      <p className="mb-2 text-sm text-gray-600">
        Targets: save rate ≥ {SAVE_RATE_TARGET}%, share rate ≥{" "}
        {SHARE_RATE_TARGET}%. Every post you log here teaches Coach Mode what
        works for your audience and reshapes future Claude prompts.
      </p>
      <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <span className="font-semibold">When to log:</span> wait{" "}
        <strong>7-14 days after posting</strong>. By then ~85% of saves and
        shares have rolled in on Instagram, so the numbers stop moving and
        the data is stable. Logging too early gives Coach Mode misleading
        signal.
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-6"
      >
        <label className="md:col-span-3 text-xs text-gray-600">
          Post title
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. 6 rural markets I'd buy"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="md:col-span-3 text-xs text-gray-600">
          Date posted
          <input
            type="date"
            value={form.datePosted}
            onChange={(e) => update("datePosted", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-2">
          Reach
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.reach}
            onChange={(e) => update("reach", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-1">
          Saves
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.saves}
            onChange={(e) => update("saves", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-1">
          Shares
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.shares}
            onChange={(e) => update("shares", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-2">
          Profile visits <span className="text-gray-400">(optional)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.profileVisits}
            onChange={(e) => update("profileVisits", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="md:col-span-6">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Log post
          </button>
        </div>
      </form>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent posts
        </div>
        {posts.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No posts logged yet. Log your first one above to start tracking.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {posts.map((p) => {
              const sR = saveRate(p);
              const shR = shareRate(p);
              const sTier = ratePerf(sR, SAVE_RATE_TARGET);
              const shTier = ratePerf(shR, SHARE_RATE_TARGET);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">
                      {p.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.datePosted} · reach {p.reach.toLocaleString()} · saves{" "}
                      {p.saves} · shares {p.shares} · visits {p.profileVisits}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${tierClasses(sTier)}`}
                      title={`Save rate (target ${SAVE_RATE_TARGET}%)`}
                    >
                      Save {fmtRate(sR)}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${tierClasses(shTier)}`}
                      title={`Share rate (target ${SHARE_RATE_TARGET}%)`}
                    >
                      Share {fmtRate(shR)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                      aria-label="Delete this post"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
