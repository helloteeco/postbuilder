"use client";

// The guided stepper that sits at the top of Overlay Studio. Per the
// spec: it teaches a first-timer the workflow without revealing the
// whole thing at once. Currently a passive indicator (clicking doesn't
// jump scroll); the steps map to the major sections rendered below it
// on the page.

const STEPS = [
  { id: 1, label: "Setup" },
  { id: 2, label: "Media" },
  { id: 3, label: "Pick a style" },
  { id: 4, label: "Write overlays" },
  { id: 5, label: "Audit" },
  { id: 6, label: "Export" },
  { id: 7, label: "Post + music" },
];

interface Props {
  active: number; // 1-based
}

export default function OverlayStepper({ active }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 text-[11px]">
      {STEPS.map((s, i) => {
        const done = s.id < active;
        const current = s.id === active;
        return (
          <div key={s.id} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                current
                  ? "bg-gray-900 text-white"
                  : done
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-gray-500"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  current
                    ? "bg-white/20 text-white"
                    : done
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {done ? "✓" : s.id}
              </span>
              <span className="font-medium">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="text-gray-300">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
