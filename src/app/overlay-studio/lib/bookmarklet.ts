// One-shot JS that scrapes Airbnb's photo gallery from the live DOM
// and hands the URLs off to Overlay Studio via a URL hash. Used in
// TWO surfaces:
//
//   1. Bookmarklet (drag to bookmarks bar). Convenient but a lot of
//      modern browsers block `javascript:` execution on sites with
//      strict CSP — Airbnb included. When this fails, the user sees
//      literally nothing happen.
//
//   2. DevTools Console paste. The exact same JS, but pasted into
//      Chrome / Firefox DevTools console on the Airbnb tab. Console
//      execution bypasses page CSP, so this path works on every
//      site, every browser. Slightly more clicks than the bookmark
//      but actually reliable.

const SOURCE_TEMPLATE = `(function(){
  var TARGET = '__TARGET__';
  var urls = new Set();
  var add = function(u){
    if (!u || typeof u !== 'string') return;
    if (!/muscache\\.com\\/im\\/pictures\\//.test(u)) return;
    if (/\\/(user|users|aircover|safety|guidebook|launch|icons?|badges?|superhost|airbnb-platform-assets|categories|explore|wishlists|reviews|trips)\\//i.test(u)) return;
    if (!/\\/im\\/pictures\\/(miso\\/Hosting-\\d+|hosting\\/|lombard\\/|prohost-api\\/Hosting-\\d+)/i.test(u)) return;
    urls.add(u.replace(/im_w=\\d+/, 'im_w=1200'));
  };
  try {
    document.querySelectorAll('img').forEach(function(img){
      add(img.src); add(img.currentSrc);
      var ss = img.srcset || '';
      ss.split(',').forEach(function(p){ add((p||'').trim().split(' ')[0]); });
    });
    document.querySelectorAll('source').forEach(function(s){
      var ss = s.srcset || '';
      ss.split(',').forEach(function(p){ add((p||'').trim().split(' ')[0]); });
    });
    var scripts = document.querySelectorAll('script');
    var re = /https?:\\/\\/a0\\.muscache\\.com\\/im\\/pictures\\/[^\\"'\\s)<>]+\\.(?:jpe?g|png|webp)(?:\\?[^\\"'\\s)<>]*)?/gi;
    for (var i = 0; i < scripts.length; i++) {
      var m = (scripts[i].textContent || '').match(re);
      if (m) m.forEach(add);
    }
  } catch (err) {
    alert('Overlay Studio scraper hit an error reading the page: ' + (err && err.message ? err.message : err));
    return;
  }
  if (urls.size === 0) {
    alert("Found 0 Airbnb photos on this page.\\n\\nFix: click 'Show all photos' on the listing, wait for the grid to fully load, then run this again.");
    return;
  }
  var text = Array.from(urls).join('\\n');
  var url = TARGET + '/overlay-studio#airbnbphotos=' + encodeURIComponent(text);
  console.log('[Overlay Studio] Found ' + urls.size + ' photos. Opening:', url);
  var ok = false;
  try {
    var w = window.open(url, '_blank');
    ok = !!(w && !w.closed);
  } catch (e) { ok = false; }
  if (ok) return;
  if (confirm('Found ' + urls.size + ' photos.\\n\\nPopup was blocked. Click OK to open Overlay Studio in THIS tab, or Cancel to copy the URL to clipboard.')) {
    window.location.href = url;
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){
      alert('Copied the import URL to clipboard. Paste into a new tab to load Overlay Studio.');
    }, function(){
      window.prompt('Copy this URL and paste into a new tab:', url);
    });
  } else {
    window.prompt('Copy this URL and paste into a new tab:', url);
  }
})();`;

function bakedSource(targetOrigin: string): string {
  return SOURCE_TEMPLATE.replace(/__TARGET__/g, targetOrigin);
}

// Bookmarklet: javascript: URL form, minified.
export function buildBookmarkletUrl(targetOrigin: string): string {
  const compact = bakedSource(targetOrigin).replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(compact)}`;
}

// Console snippet: human-readable JS the user can paste into DevTools
// Console on the Airbnb tab. Same logic as the bookmarklet but doesn't
// require the `javascript:` protocol — bypasses page-level CSP that
// blocks bookmarklet execution on hardened sites like Airbnb.
export function buildConsoleSnippet(targetOrigin: string): string {
  return bakedSource(targetOrigin);
}

export function readAirbnbPhotosFromHash(hash: string): string[] {
  const m = /^#airbnbphotos=(.+)$/.exec(hash);
  if (!m) return [];
  try {
    return decodeURIComponent(m[1])
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
  } catch {
    return [];
  }
}

