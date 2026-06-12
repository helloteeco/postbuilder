"use client";

// Ad Coach micro-lessons — short, 3rd-grade, no jargon. Collapsed
// accordion so it's there when wanted, invisible when not. Pure
// reference content; no state beyond which lesson is open.

import { useState } from "react";

interface Lesson {
  title: string;
  body: string;
}

const LESSONS: Lesson[] = [
  {
    title: "1. Why you don't run ads yet",
    body: "Ads don't fix a bad offer. They show everyone how good or bad it already is, faster. If nobody buys when it's free to see your posts, paying to show more people won't change that. Get one or two sales the normal way first. Then ads pour gas on a fire that's already lit.",
  },
  {
    title: "2. The only 4 numbers that matter",
    body: "Read them in order. 1) Hook rate: do people stop scrolling? 2) Cost per profile visit: is attention cheap? 3) Cost per lead: are people raising their hand? 4) Cost per client: does it make money? If the top one is broken, the rest don't matter yet. Fix from the top down.",
  },
  {
    title: "3. Your money number",
    body: "Forget generic targets. Your number comes from your price. If a sale is worth $8,000 and you want a healthy margin, you can spend up to about $2,400 to get one client and still win. The app does this math for you in Step 1. Beating a cheap-but-useless number means nothing if nobody buys.",
  },
  {
    title: "4. Run your winner, not a guess",
    body: "Don't make a brand-new ad from scratch. Use the post that already did well on its own. It proved real people like it. The app picks your best one and builds the ad from it. New creative is a guess. A proven post is a head start.",
  },
  {
    title: "5. Launch, then don't touch it",
    body: "For the first 7 days, Meta is learning who to show your ad to. If you edit it, the learning resets and you waste money. Set it and walk away. Days 1-7 are learning. Day 7-14 is your first real read. Patience here is the whole game.",
  },
  {
    title: "6. Read it in 60 seconds",
    body: "After day 7, paste your numbers into Step 4. You get one word back. SCALE: it works, raise budget 20%. REFRESH: people are tired of it, swap in your next winner. FIX FUNNEL: cheap clicks but no sales, the problem is after the click. KILL: it's losing money, cut it. One verdict, one move.",
  },
  {
    title: "7. When ads aren't the problem",
    body: "Sometimes the ad does its job: cheap clicks, lots of visits, but no sales. That's not an ad problem. It's your offer, your DMs, or your call. Adding budget just loses money faster. Fix the step after the click first, then turn spending back up.",
  },
];

export default function AdLessons() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Learn the playbook
      </div>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900">
        7 short lessons
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Each one is a 30-second read. Tap to open.
      </p>
      <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {LESSONS.map((lesson, i) => {
          const open = openIdx === i;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">
                  {lesson.title}
                </span>
                <span className="text-xs text-gray-400">{open ? "▴" : "▾"}</span>
              </button>
              {open && (
                <div className="px-3 pb-3 text-sm leading-relaxed text-gray-700">
                  {lesson.body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
