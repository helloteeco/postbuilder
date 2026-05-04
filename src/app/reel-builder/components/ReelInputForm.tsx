"use client";

// The paste-the-ghostwriter-output area + the Generate button. Pure
// presentation — controlled by the parent page, no localStorage of its
// own. Empty / busy / error states are surfaced via props.

interface Props {
  source: string;
  onSourceChange: (next: string) => void;
  onGenerate: () => void;
  busy: boolean;
  error: string | null;
}

export default function ReelInputForm({
  source,
  onSourceChange,
  onGenerate,
  busy,
  error,
}: Props) {
  const charCount = source.length;
  const canGenerate = !busy && source.trim().length >= 50;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-bold text-gray-900">
        Paste your 10-section ghostwriter output
      </h2>
      <p className="mb-3 text-xs text-gray-600">
        Same input you&apos;d feed Post Builder. Reel Builder turns it into 3
        single-screen reel covers + matching long-form Instagram captions.
      </p>
      <textarea
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        placeholder="Paste the full 10-section ghostwriter output from Claude here. Reel Builder will turn it into 3 hook variations with matching captions."
        rows={12}
        disabled={busy}
        className="w-full resize-y rounded border border-gray-300 p-3 font-mono text-xs text-gray-800 disabled:bg-gray-50"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">
          {charCount.toLocaleString()} characters
          {charCount > 0 && charCount < 200 && (
            <span className="ml-2 text-amber-700">
              · short input — paste the full 10 sections for best results
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate 3 Reels"}
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </section>
  );
}
