// Top navigation bar shown above every page. Links: Post Builder
// (/post-builder), Reel Builder (/reel-builder), Coach Mode (/coach),
// Ad Coach (/ad-coach, beta). The active route gets a dark underline.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/post-builder", label: "Post Builder", beta: false },
  { href: "/reel-builder", label: "Reel Builder", beta: false },
  { href: "/coach", label: "Coach Mode", beta: false },
  { href: "/ad-coach", label: "Ad Coach", beta: true },
] as const;

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link
          href="/post-builder"
          className="text-sm font-bold tracking-tight text-gray-900"
        >
          Post Builder
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {link.label}
                {link.beta && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                    Beta
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
