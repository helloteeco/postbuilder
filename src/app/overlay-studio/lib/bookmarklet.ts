// One-click bookmarklet for grabbing Airbnb listing photos from the
// LIVE DOM in the user's own browser tab. Replaces the older clipboard
// flow — too many sites silently block navigator.clipboard.writeText
// from bookmarklets — with a URL-hash hand-off:
//
//   bookmarklet scrapes muscache URLs out of the DOM
//   → window.open('<our app>/overlay-studio#airbnbphotos=...')
//   → Overlay Studio reads location.hash on mount and auto-imports
//
// Net UX: drag bookmark to bookmarks bar once (setup), then on any
// Airbnb listing it's ONE click — bookmark → new tab appears with the
// photos already importing. No clipboard, no pasting, no manual step.
//
// The target origin (preview / production URL) is baked into the
// bookmarklet at the moment the user drags it from the page, so
// re-install if you switch environments.

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
    alert('Overlay Studio bookmarklet hit an error reading the page: ' + (err && err.message ? err.message : err));
    return;
  }
  if (urls.size === 0) {
    alert("Bookmarklet ran but found 0 Airbnb photos on this page.\\n\\nFix: click 'Show all photos' on the listing, wait for the grid to fully load, then click the bookmark again. (If you're not on an Airbnb listing tab, switch to one first.)");
    return;
  }
  var text = Array.from(urls).join('\\n');
  var url = TARGET + '/overlay-studio#airbnbphotos=' + encodeURIComponent(text);
  var ok = false;
  try {
    var w = window.open(url, '_blank');
    ok = !!(w && !w.closed);
  } catch (e) { ok = false; }
  if (ok) {
    // Popup opened — done.
    return;
  }
  // Popup blocked. Show a confirm dialog so the user gets a clear
  // choice between navigating this tab and copying the URL.
  if (confirm('Found ' + urls.size + ' photos.\\n\\nPopup was blocked by your browser. Click OK to open Overlay Studio in THIS tab, or Cancel to copy the import URL to clipboard.')) {
    window.location.href = url;
    return;
  }
  // Try clipboard. If that also fails, show in prompt so they can
  // hand-select and copy.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){
      alert('Copied the import URL to clipboard. Paste it into a new tab — Overlay Studio will load and auto-import the photos.');
    }, function(){
      window.prompt('Copy this URL and paste into a new tab:', url);
    });
  } else {
    window.prompt('Copy this URL and paste into a new tab:', url);
  }
})();`;

export function buildBookmarkletUrl(targetOrigin: string): string {
  const source = SOURCE_TEMPLATE.replace(/__TARGET__/g, targetOrigin);
  const compact = source.replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(compact)}`;
}

// Parse a window.location.hash of the form '#airbnbphotos=<urlenc>'
// and return the photo URLs. Returns [] for any other hash shape.
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
