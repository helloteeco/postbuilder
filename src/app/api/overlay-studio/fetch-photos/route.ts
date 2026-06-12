import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Pulls photos from a pasted Airbnb LISTING URL. Lots of strategies
// raced in parallel so the user never has to set up an API key OR
// hand-paste image URLs as a fallback:
//
//   1. Airbnb's own v2 REST API hit with their public web API key.
//      Fast, free, exact gallery — when the IP isn't blocked.
//   2. Jina Reader (https://r.jina.ai) — public free render-as-a-
//      service. Runs real headless Chrome, returns rendered HTML so
//      our extractors see the fully-hydrated gallery. The path that
//      makes URL mode actually work most of the time.
//   3. Direct fetch — usually a stripped React shell, but worth a
//      shot since it's instant when it works.
//   4. AllOrigins CORS proxy — bypasses IP blocking when relevant.
//   5. Wayback Machine cached snapshot — uses the Internet Archive's
//      latest crawl, which captures the fully-rendered page.
//   6. ScrapingBee — only if SCRAPINGBEE_API_KEY is set; kept as a
//      backstop, no longer the primary path.
//
// All strategy results are merged + deduped, so a partial response
// from one source plus a partial from another adds up. Photos go
// through the same listing-only filter (Hosting-/lombard/ paths) to
// keep host avatars, AirCover graphics, and icons out.
//
// URL validation:
//   - Hostname must be airbnb.*  (rejects anything else upfront).
//   - Path must look like a real listing (/rooms/<id>, /h/<slug>,
//     /luxury/listing/<id>).

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
  // Use the final path segment (the photo's filename / UUID). Variants
  // of the same photo share a filename but differ only in their
  // policy/size segment (`/original/`, `/large/`, `/policy:.../`), so
  // this dedupes variants while keeping distinct photos distinct.
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
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
// fetches (their full photo gallery is hydrated client-side). Three
// strategies are tried in order, free → fragile → paid:
//
//   1. Airbnb's v2 REST endpoint (pdp_listing_details) hit with the
//      public web API key. Free, fast, returns the full photo array
//      as structured JSON. This is what their own site / app use
//      under the hood. Can break if Airbnb rotates the key or
//      deprecates the endpoint, but it has been stable for years.
//   2. ScrapingBee (managed headless Chrome) if SCRAPINGBEE_API_KEY
//      is set. Most reliable but costs ~25 credits per listing
//      (free tier covers ~40 listings/month).
//   3. Direct HTML fetch as a last resort. Usually returns only the
//      hero shot because the gallery is client-rendered.

// Airbnb's public web API key, embedded in every page they serve.
// Stable for years; rotates only when they do a major API revamp.
const AIRBNB_PUBLIC_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";

// Strategy 1 — Airbnb's own v2 REST endpoint, free.
//
// GET https://www.airbnb.com/api/v2/pdp_listing_details/<id>
//      ?_format=for_rooms_show
// Headers: X-Airbnb-API-Key, browser-like User-Agent.
//
// Response (abbrev): { pdp_listing_detail: { photos: [{ xx_large_url: ... }, ...] } }
async function tryAirbnbApi(listingId: string): Promise<string[] | null> {
  // The id must be the numeric listing id. Non-numeric (e.g. /h/<slug>)
  // ids won't work here — we'll fall through to the HTML strategies.
  if (!/^\d+$/.test(listingId)) return null;
  const url = `https://www.airbnb.com/api/v2/pdp_listing_details/${listingId}?_format=for_rooms_show`;
  try {
    const resp = await fetch(url, {
      headers: {
        "X-Airbnb-API-Key": AIRBNB_PUBLIC_API_KEY,
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as unknown;
    return extractPhotosFromV2Response(data);
  } catch {
    return null;
  }
}

// Walk the v2 response and pull every photo URL we can find. The
// response shape is stable but has nested wrappers and a few alias
// fields per photo — we accept any of them and dedupe later.
function extractPhotosFromV2Response(data: unknown): string[] {
  const out: string[] = [];
  const PHOTO_KEYS = new Set([
    "xx_large_url",
    "x_large_url",
    "large_url",
    "picture",
    "url",
    "scrim_color",
    "thumbnail_url",
  ]);

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (
        typeof v === "string" &&
        PHOTO_KEYS.has(k) &&
        v.includes("muscache.com/im/pictures/")
      ) {
        out.push(v);
      } else if (v && typeof v === "object") {
        walk(v);
      }
    }
  }
  walk(data);
  return out;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

// Direct fetch. Often gets a stripped SPA shell from Vercel's IPs
// because Airbnb anti-bots cloud egress, but it's free and instant
// when it works.
async function fetchDirect(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Jina Reader — public render-as-a-service that runs real headless
// Chrome on their backend, waits for hydration, and returns the
// rendered HTML. Free, no API key required, no env var to set.
// This is the path that turns the user's pasted listing URL into the
// fully-loaded gallery — same effect ScrapingBee gives us but with
// zero setup. Rate-limited (~50 req/min on the free tier) which is
// generous for the user's volume.
async function fetchViaJinaReader(url: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        ...BROWSER_HEADERS,
        // Ask Jina to return raw HTML (not their default markdown
        // extraction) so our existing regex extractors fire on the
        // same shape they fire on for direct fetches.
        "X-Return-Format": "html",
        // Bypass Jina's own cache — listings change.
        "X-No-Cache": "true",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Public CORS proxy. AllOrigins fetches the URL server-side and
// returns the raw response. Doesn't render JS, so it only helps when
// the issue is IP-blocking (not SPA shells) — kept as a cheap belt-
// and-suspenders pass.
async function fetchViaAllOrigins(url: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Wayback Machine — fetch the most recent archived snapshot of the
// listing page. The Internet Archive captures Airbnb listings
// regularly; cached snapshots include the fully-rendered HTML
// because Wayback uses a real browser to crawl.
async function fetchViaWayback(url: string): Promise<string | null> {
  try {
    const lookup = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!lookup.ok) return null;
    const data = (await lookup.json()) as {
      archived_snapshots?: { closest?: { url?: string; available?: boolean } };
    };
    const snap = data.archived_snapshots?.closest;
    if (!snap?.url || !snap.available) return null;
    const html = await fetch(snap.url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    if (!html.ok) return null;
    return await html.text();
  } catch {
    return null;
  }
}

// Optional ScrapingBee path if the user did set the key — kept as a
// final fallback because it's the most reliable when configured.
async function fetchViaScrapingBee(url: string): Promise<string | null> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) return null;
  const target = `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
    key,
  )}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&country_code=us&wait=2000`;
  try {
    const resp = await fetch(target, { signal: AbortSignal.timeout(28_000) });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Run a list of HTML-fetching strategies in parallel, return the
// merged list of photo URLs every strategy contributed. Each strategy
// gets its own timeout so a slow one doesn't sink the whole request.
async function gatherPhotosFromHtmlStrategies(
  cleanListing: string,
  photosUrl: string,
): Promise<string[]> {
  const strategies: Array<() => Promise<string | null>> = [
    () => fetchViaJinaReader(photosUrl),
    () => fetchViaJinaReader(cleanListing),
    () => fetchDirect(photosUrl),
    () => fetchDirect(cleanListing),
    () => fetchViaAllOrigins(photosUrl),
    () => fetchViaAllOrigins(cleanListing),
    () => fetchViaWayback(cleanListing),
    () => fetchViaScrapingBee(cleanListing),
  ];
  const settled = await Promise.allSettled(strategies.map((s) => s()));
  const out: string[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const html = r.value;
    out.push(...extractFromJsonLd(html));
    out.push(...extractUrlsFromJsonBlob(html));
    out.push(...(html.match(HOSTING_PHOTO_RE) ?? []));
  }
  return out;
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

  // Two strategy groups, run in parallel so the worst-case latency is
  // the slowest single strategy not the sum.
  //   Group A: Airbnb's own v2 JSON API. Free, fast, works for most
  //            numeric-id listings.
  //   Group B: Render-the-page strategies — Jina Reader (free headless
  //            Chrome), direct fetch, public CORS proxies, Wayback
  //            cached snapshot, optional ScrapingBee. Whichever ones
  //            succeed contribute photo URLs; we merge them all.
  const [apiHits, htmlHits] = await Promise.all([
    tryAirbnbApi(classified.id).then((r) => r ?? []),
    gatherPhotosFromHtmlStrategies(cleanListing, photosUrl),
  ]);

  const combined = dedupeAndPickLargest([...apiHits, ...htmlHits]);

  if (combined.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "NO_PHOTOS",
        message:
          "Couldn't find listing photos. The listing may be private or geo-restricted. As a backup, switch to 'Paste image URLs' above.",
        setupNeeded: false,
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
      setupNeeded: false,
    } satisfies FetchResult,
  });
}
