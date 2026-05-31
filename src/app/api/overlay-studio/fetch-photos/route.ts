import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Pulls candidate photo URLs out of any pasted listing URL. Two
// strategies live here: an Airbnb-aware pass (their CDN domain +
// embedded JSON deferred state) and a generic-page fallback (every
// <img>, every og:image, every <source srcset>). The client then
// decides what to actually download via /api/proxy-image and scores
// them locally for sharpness / brightness / aspect.
//
// Anti-bot reality: Airbnb's full-page DOM is React-hydrated, but
// they DO inline a "deferred state" JSON blob in the SSR'd HTML that
// contains every photo URL on a0.muscache.com. We grep that blob
// (plus the og:image meta) — no headless browser needed.

interface FetchResult {
  source: "airbnb" | "generic";
  host: string;
  urls: string[];
}

const AIRBNB_HOST_RE = /(^|\.)airbnb\.[a-z.]+$/i;
const AIRBNB_CDN_RE =
  /https?:\/\/a0\.muscache\.com\/im\/pictures\/[a-z0-9\-\/_.]+\.(?:jpe?g|png|webp)(?:\?[^"'\s]*)?/gi;

// Generic catch-all. Pulls every reasonable image URL out of HTML —
// <img src>, <img srcset>, <source srcset>, og:image, twitter:image,
// link rel=image_src, and JSON-LD "image" fields. Caller filters /
// dedupes.
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SOURCE_TAG_RE = /<source\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc=["']([^"']+)["']/i;
const SRCSET_ATTR_RE = /\bsrcset=["']([^"']+)["']/i;
const META_IMAGE_RE =
  /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi;
const META_IMAGE_REV_RE =
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/gi;
const LINK_IMAGE_RE =
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi;
const JSONLD_IMAGE_RE = /"image"\s*:\s*("[^"]+"|\[[^\]]+\])/gi;

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
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function resolveUrl(raw: string, base: URL): string | null {
  try {
    const u = new URL(decodeEntities(raw.trim()), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Skip the things that obviously aren't real photos: icons, sprites,
// pixel trackers, base64 SVGs, GIFs. Listing photos on every site
// we care about are jpg/jpeg/webp/png at meaningful sizes.
function isLikelyPhotoUrl(url: string): boolean {
  if (url.startsWith("data:")) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".gif")) return false;
  if (lower.endsWith(".ico")) return false;
  if (/\/(?:icons?|sprites?|favicons?|logos?|avatars?|trackers?)\//.test(lower)) {
    return false;
  }
  if (/[?&](?:w|width|size)=(\d+)/.test(lower)) {
    const m = /[?&](?:w|width|size)=(\d+)/.exec(lower);
    if (m && Number(m[1]) < 320) return false;
  }
  return /\.(?:jpe?g|png|webp)(?:\?|$|#)/i.test(lower);
}

function pickLargestFromSrcset(srcset: string): string | null {
  // srcset = "url1 320w, url2 640w, url3 1200w" — return the widest.
  const parts = srcset
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let best: { url: string; w: number } | null = null;
  for (const p of parts) {
    const m = /^(\S+)\s+(\d+)w$/.exec(p);
    if (m) {
      const w = Number(m[2]);
      if (!best || w > best.w) best = { url: m[1], w };
    } else {
      const url = p.split(/\s+/)[0];
      if (url && !best) best = { url, w: 0 };
    }
  }
  return best ? best.url : null;
}

function extractAirbnbUrls(html: string): string[] {
  const hits = html.match(AIRBNB_CDN_RE) ?? [];
  // Airbnb returns 720x and 1200x variants of the same picture id.
  // Group by the picture path (everything up to "/policy:"), keep the
  // largest variant we saw, drop duplicates.
  const byId = new Map<string, string>();
  for (const raw of hits) {
    const u = decodeEntities(raw);
    // The CDN path looks like /im/pictures/<id>/<policy>.jpg — group
    // on the id segment (5th path part) when we can.
    const m = /\/im\/pictures\/([^/]+)/.exec(u);
    const key = m ? m[1] : u;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, u);
      continue;
    }
    // Prefer the URL that looks bigger (longer query / "1200" hint).
    const score = (s: string) =>
      (/1200|1920|original/.test(s) ? 2 : 0) + (s.length > existing.length ? 1 : 0);
    if (score(u) > score(existing)) byId.set(key, u);
  }
  return Array.from(byId.values());
}

function extractGenericUrls(html: string, base: URL): string[] {
  const found = new Set<string>();
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const abs = resolveUrl(raw, base);
    if (abs && isLikelyPhotoUrl(abs)) found.add(abs);
  };

  // og:image / twitter:image / link rel=image_src — usually the hero.
  let m: RegExpExecArray | null;
  while ((m = META_IMAGE_RE.exec(html))) push(m[1]);
  META_IMAGE_RE.lastIndex = 0;
  while ((m = META_IMAGE_REV_RE.exec(html))) push(m[1]);
  META_IMAGE_REV_RE.lastIndex = 0;
  while ((m = LINK_IMAGE_RE.exec(html))) push(m[1]);
  LINK_IMAGE_RE.lastIndex = 0;

  // JSON-LD "image" fields (Schema.org Product / LodgingBusiness / etc.)
  while ((m = JSONLD_IMAGE_RE.exec(html))) {
    const raw = m[1];
    if (raw.startsWith('"')) {
      push(raw.slice(1, -1));
    } else {
      // Array of strings or {url:...} objects.
      const matches = raw.match(/"https?:\/\/[^"]+"/g) ?? [];
      for (const u of matches) push(u.slice(1, -1));
    }
  }
  JSONLD_IMAGE_RE.lastIndex = 0;

  // Every <img> tag — prefer largest from srcset, fall back to src.
  for (const tag of html.match(IMG_TAG_RE) ?? []) {
    const srcset = SRCSET_ATTR_RE.exec(tag)?.[1];
    if (srcset) {
      push(pickLargestFromSrcset(srcset));
      continue;
    }
    push(SRC_ATTR_RE.exec(tag)?.[1]);
  }
  // <picture><source srcset=...> the lazy-loaded variants.
  for (const tag of html.match(SOURCE_TAG_RE) ?? []) {
    const srcset = SRCSET_ATTR_RE.exec(tag)?.[1];
    if (srcset) push(pickLargestFromSrcset(srcset));
  }

  return Array.from(found);
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
          message: `The page returned ${resp.status}. It may be private or require login.`,
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
        message: err instanceof Error ? err.message : "Couldn't fetch the page.",
      },
      { status: 502 },
    );
  }

  const host = parsed.hostname.toLowerCase();
  const isAirbnb = AIRBNB_HOST_RE.test(host);

  let urls: string[];
  let source: FetchResult["source"];
  if (isAirbnb) {
    urls = extractAirbnbUrls(html);
    source = "airbnb";
    // Airbnb sometimes returns the SPA shell with no inlined CDN URLs
    // (geo / login walls). Fall back to generic extraction so the
    // user at least gets the hero shot.
    if (urls.length === 0) {
      urls = extractGenericUrls(html, parsed);
      source = "generic";
    }
  } else {
    urls = extractGenericUrls(html, parsed);
    source = "generic";
  }

  if (urls.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "NO_PHOTOS",
        message:
          "Couldn't find photos on that page. The site may load images via JavaScript only — drag screenshots in instead.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: { source, host, urls } satisfies FetchResult,
  });
}
