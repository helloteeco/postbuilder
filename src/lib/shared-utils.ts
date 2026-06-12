// Small helpers shared across Post Builder, Reel Builder, Overlay
// Studio, and Coach Mode. Consolidated here from per-feature copies so
// there's exactly one implementation of each.

// Read a File/Blob into a data URL. Replaces the six per-feature
// FileReader wrappers that previously lived inline.
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

// "just now" / "5 min ago" / "3h ago" / "2d ago" / locale date.
// Single source of truth for every Recent-X strip.
export function relativeTime(ts: number): string {
  const ms = Date.now() - ts;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
