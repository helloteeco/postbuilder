import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Pulls photos from a pasted Airbnb LISTING URL only. The earlier
// "any page works" mode kept dragging in host avatars, AirCover
// graphics, and amenity icons, so this version is intentionally
// strict:
//
//   1. Hostname must be airbnb.*  (404 anything else).
//   2. Path must look like a real listing (/rooms/<id>, /h/<slug>,
//      /luxury/listing/<id>) — bail on search / wishlist / experience
//      pages.
//   3. Photos come from two listing-specific sources only:
//        - The JSON-LD <script type="application/ld+json"> block.
//          Schema.org Product / LodgingBusiness has an `image` array
//          that is exactly the listing's "Show all photos" gallery.
//        - The hosting-photo URL pattern on Airbnb's CDN — paths that
//          contain /im/pictures/miso/Hosting-, /im/pictures/hosting/,
//          or /im/pictures/lombard/ are listing photos. Everything
//          else on muscache (user/, aircover/, icons/, badges/, etc.)
//          is skipped.

interface FetchResult {
  source: "airbnb";
  host: string;
  listingId: string | null;
  urls: string[];
}

const AIRBNB_HOST_RE = /(^|\.)airbnb\.[a-z.]+$/i;
const AIRBNB_LISTING_PATH_RE =
  /^\/(?:rooms|h|luxury\/listing)\/(?:plus\/|listings\/)?([^/?#]+)/i;

// Real listing photos live under specific path segments. Anything
// outside this set (user avatars, aircover, badges, illustrations) is
// noise.
const HOSTING_PHOTO_RE =
  /https?:\/\/a0\.muscache\.com\/im\/pictures\/(?:miso\/Hosting-\d+|hosting|lombard|prohost-api\/Hosting-\d+)\/[^"'\s)<>\\]+?\.(?:jpe?g|png|webp)(?:\?[^"'\s)<>\\]*)?/gi;

const JSONLD_BLOCK_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

// Pull every `"<key>":"https://...jpg"` pair under image-shaped keys
// out of an arbitrary JSON blob. We don't fully parse the deferred
// state — Airbnb's Apollo cache changes shape between releases — but
// the key names are stable enough.
function extractUrlsFromJsonBlob(blob: string): string[] {
  const out: string[] = [];
  // baseUrl / pictureUrl / largeUrl / xLargeUrl / url all show up in
  // the listing photos arrays.
  const keyRe =
    /"(?:baseUrl|pictureUrl|largeUrl|xLargeUrl|xxLargeUrl|originalPicture|url)"\s*:\s*"((?:https?:)?\/\/a0\.muscache\.com\/im\/pictures\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(blob))) {
    const raw = m[1];
    const abs = raw.startsWith("//") ? `https:${raw}` : raw;
    out.push(decodeEntities(abs));
  }
  return out;
}

function extractFromJsonLd(html: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = JSONLD_BLOCK_RE.exec(html))) {
    const inner = m[1].trim();
    try {
      const parsed = JSON.parse(inner) as unknown;
      collectJsonLdImages(parsed, out);
    } catch {
      // Some pages cram multiple JSON objects in one block separated by
      // commas. Skip — the HOSTING_PHOTO_RE pass below will still catch
      // anything inlined.
    }
  }
  JSONLD_BLOCK_RE.lastIndex = 0;
  return out;
}

function collectJsonLdImages(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) collectJsonLdImages(child, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const img = obj.image;
  if (typeof img === "string") {
    out.push(img);
  } else if (Array.isArray(img)) {
    for (const i of img) {
      if (typeof i === "string") out.push(i);
      else if (i && typeof i === "object") {
        const inner = (i as Record<string, unknown>).url;
        if (typeof inner === "string") out.push(inner);
      }
    }
  } else if (img && typeof img === "object") {
    const url = (img as Record<string, unknown>).url;
    if (typeof url === "string") out.push(url);
  }
  for (const v of Object.values(obj)) collectJsonLdImages(v, out);
}

// Group by the listing-photo id and keep the largest variant we saw.
// Airbnb returns 720w / 1200w / original variants of the same picture
// — only one should reach the user.
function dedupeAndPickLargest(urls: string[]): string[] {
  const byId = new Map<string, string>();
  for (const raw of urls) {
    const u = decodeEntities(raw);
    if (!isHostingPhoto(u)) continue;
    const id = pictureId(u) ?? u;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, u);
      continue;
    }
    if (variantScore(u) > variantScore(existing)) byId.set(id, u);
  }
  return Array.from(byId.values());
}

function isHostingPhoto(url: string): boolean {
  if (!/^https?:\/\/a0\.muscache\.com\//.test(url)) return false;
  if (!/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url)) return false;
  // Block the known non-listing paths.
  if (/\/(?:user|users|aircover|safety|guidebook|launch|icons?|badges?|superhost|airbnb-platform-assets|categories|explore|wishlists|reviews|trips)\//i.test(url)) {
    return false;
  }
  // Whitelist the listing-photo paths.
  return /\/im\/pictures\/(?:miso\/Hosting-\d+|hosting\/|lombard\/|prohost-api\/Hosting-\d+)\//i.test(url);
}

function pictureId(url: string): string | null {
  const m = /\/im\/pictures\/[^/]+\/([^/]+)/.exec(url);
  return m ? m[1] : null;
}

function variantScore(u: string): number {
  let s = u.length;
  if (/original/.test(u)) s += 100;
  if (/1200|1920|2048/.test(u)) s += 50;
  if (/im_w=(\d+)/.exec(u)) {
    const w = Number(/im_w=(\d+)/.exec(u)?.[1] ?? 0);
    s += w / 20;
  }
  return s;
}

function classifyAirbnbUrl(parsed: URL): { ok: true; id: string } | { ok: false; reason: string } {
  if (!AIRBNB_HOST_RE.test(parsed.hostname)) {
    return {
      ok: false,
      reason: "Only Airbnb listings are supported — paste a URL from airbnb.com.",
    };
  }
  const m = AIRBNB_LISTING_PATH_RE.exec(parsed.pathname);
  if (!m) {
    return {
      ok: false,
      reason:
        "That looks like Airbnb, but not a listing page. Open the listing (URL contains /rooms/<id>) and copy that URL.",
    };
  }
  return { ok: true, id: m[1] };
}

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_JSON", message: "Invalid JSON body." },
      { status: 400 },
    );
  }
  if (!body.url) {
    return NextResponse.json(
      { ok: false, code: "MISSING_URL", message: "Request must include { url }." },
      { status: 400 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url.trim());
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_URL", message: "That doesn't look like a URL." },
      { status: 400 },
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      { ok: false, code: "BAD_URL", message: "URL must be http(s)." },
      { status: 400 },
    );
  }

  const classified = classifyAirbnbUrl(parsed);
  if (!classified.ok) {
    return NextResponse.json(
      { ok: false, code: "NOT_AIRBNB_LISTING", message: classified.reason },
      { status: 400 },
    );
  }

  let html: string;
  try {
    const resp = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "UPSTREAM",
          message: `Airbnb returned ${resp.status}. The listing may be private or unavailable in your region.`,
        },
        { status: 502 },
      );
    }
    html = await resp.text();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "FETCH_FAILED",
        message: err instanceof Error ? err.message : "Couldn't fetch the listing.",
      },
      { status: 502 },
    );
  }

  // Pull candidates from BOTH sources, then merge.
  //   - JSON-LD: Schema.org image array, ~5 hero shots, exact match to
  //     what the listing's "Show all photos" hero section shows first.
  //   - Apollo deferred-state JSON: full gallery embedded in
  //     <script id="data-deferred-state-0"> (or similar). We don't
  //     parse the whole tree — we grep for image-keyed URLs under the
  //     listing-photo path whitelist.
  //   - Raw HTML scan: catches anything the first two passes missed,
  //     filtered by the same hosting-photo whitelist.
  const jsonLdHits = extractFromJsonLd(html);
  const blobHits = extractUrlsFromJsonBlob(html);
  const rawHits = html.match(HOSTING_PHOTO_RE) ?? [];

  const combined = dedupeAndPickLargest([...jsonLdHits, ...blobHits, ...rawHits]);

  if (combined.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "NO_PHOTOS",
        message:
          "Couldn't find listing photos in that page. Airbnb sometimes serves a stripped shell — try again, or take screenshots from 'Show all photos' instead.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: {
      source: "airbnb",
      host: parsed.hostname,
      listingId: classified.id,
      urls: combined,
    } satisfies FetchResult,
  });
}
