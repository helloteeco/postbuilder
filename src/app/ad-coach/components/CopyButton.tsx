"use client";

// Small reusable copy-to-clipboard button. The Ad Coach is
// copy-paste-first, so nearly every generated value gets one.

import { useState } from "react";

interface Props {
  value: string;
  label?: string;
  className?: string;
}

export default function CopyButton({ value, label = "Copy", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — value is visible, user can select manually
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        `rounded px-2 py-0.5 text-xs font-semibold transition ${
          copied
            ? "bg-emerald-600 text-white"
            : "bg-gray-900 text-white hover:bg-black"
        }`
      }
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
