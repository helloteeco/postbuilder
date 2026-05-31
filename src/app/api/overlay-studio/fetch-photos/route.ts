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
  setupNeeded: boolean;
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
// the key names are stable enough. Also handles JSON-escaped slashes
// (`a0.muscache.com\/im\/pictures\/...`) which is how Airbnb encodes
// URLs inside their inlined script blob.
function extractUrlsFromJsonBlob(blob: string): string[] {
  const out: string[] = [];
  const keyRe =
    /"(?:baseUrl|pictureUrl|largeUrl|xLargeUrl|xxLargeUrl|originalPicture|picture|url|src|imageUrl|mediaUrl)"\s*:\s*"((?:https?:)?(?:\\?\/){2}a0\.muscache\.com(?:\\?\/)im(?:\\?\/)pictures[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(blob))) {
    let raw = m[1].replace(/\\\//g, "/");
    if (raw.startsWith("//")) raw = `https:${raw}`;
    out.push(decodeEntities(raw));
  }
  // Also grab bare URL strings the keyed pass missed — many newer
  // Airbnb payloads embed photos as plain strings inside arrays.
  const bareRe =
    /"((?:https?:)?(?:\\?\/){2}a0\.muscache\.com(?:\\?\/)im(?:\\?\/)pictures(?:\\?\/)(?:miso(?:\\?\/)Hosting-\d+|hosting|lombard|prohost-api(?:\\?\/)Hosting-\d+)[^"]+\.(?:jpe?g|png|webp))/gi;
  while ((m = bareRe.exec(blob))) {
    let raw = m[1].replace(/\\\//g, "/");
    if (raw.startsWith("//")) raw = `https:${raw}`;
    out.push(decodeEntities(raw));
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

// Airbnb actively serves a stripped React shell to plain server
// fetches (their full photo gallery is hydrated client-side). To get
// the rendered HTML we route through ScrapingBee, a managed headless-
// Chrome proxy. If SCRAPINGBEE_API_KEY isn't set we fall back to a
// direct fetch — it usually returns only 1 hero shot, and the route
// will tell the UI to surface a setup hint.
function hasScrapingBee(): boolean {
  return !!process.env.SCRAPINGBEE_API_KEY;
}

async function fetchAirbnbHtml(url: string): Promise<string | null> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (key) {
    // render_js=true tells ScrapingBee to spin up real Chrome so the
    // Apollo cache fully hydrates. premium_proxy=true rotates through
    // residential IPs so Airbnb doesn't 403 us. country_code=us keeps
    // listings/pricing in the locale the user expects.
    const target = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
      key,
    )}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&country_code=us&wait=2000`;
    try {
      const resp = await fetch(target, {
        signal: AbortSignal.timeout(28_000),
      });
      if (!resp.ok) return null;
      return await resp.text();
    } catch {
      return null;
    }
  }
  // No proxy configured — best-effort direct fetch.
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
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

  // Strip the query + fragment entirely. Pasted URLs nearly always
  // carry ?photo_id=… and ?source_impression_id=… — the first one
  // tells Airbnb's SSR to render just that one photo's viewer state,
  // which is exactly why we were getting back a single image. Keep
  // the path the user pasted (handles /rooms/<id>, /h/<slug>, and
  // /luxury/listing/<id> without reconstruction).
  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  const cleanListing = `${parsed.origin}${cleanPath}`;
  const photosUrl = `${cleanListing}/photos`;

  // Race both URLs. The listing page gives us JSON-LD hero shots;
  // /photos opens the dedicated gallery viewer which SSRs the full
  // picture list. Merging both gives us coverage even if one of them
  // serves a stripped shell.
  const [roomsHtml, photosHtml] = await Promise.all([
    fetchAirbnbHtml(cleanListing),
    fetchAirbnbHtml(photosUrl),
  ]);

  if (!roomsHtml && !photosHtml) {
    return NextResponse.json(
      {
        ok: false,
        code: "FETCH_FAILED",
        message:
          "Couldn't reach Airbnb. The listing may be private, regionally blocked, or rate-limited.",
      },
      { status: 502 },
    );
  }

  const jsonLdHits = [
    ...extractFromJsonLd(roomsHtml ?? ""),
    ...extractFromJsonLd(photosHtml ?? ""),
  ];
  const blobHits = [
    ...extractUrlsFromJsonBlob(roomsHtml ?? ""),
    ...extractUrlsFromJsonBlob(photosHtml ?? ""),
  ];
  const rawHits = [
    ...((roomsHtml ?? "").match(HOSTING_PHOTO_RE) ?? []),
    ...((photosHtml ?? "").match(HOSTING_PHOTO_RE) ?? []),
  ];

  const combined = dedupeAndPickLargest([...jsonLdHits, ...blobHits, ...rawHits]);

  const setupNeeded = !hasScrapingBee();

  if (combined.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: setupNeeded ? "SETUP_NEEDED" : "NO_PHOTOS",
        message: setupNeeded
          ? "Airbnb served a stripped page (their gallery is rendered by JavaScript). Set SCRAPINGBEE_API_KEY in Vercel env vars to import the full gallery — free tier covers ~40 listings/month."
          : "Couldn't find listing photos. The listing may be private, regionally blocked, or in a layout we don't recognize yet.",
        setupNeeded,
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
      setupNeeded,
    } satisfies FetchResult,
  });
}
