// One-click bookmarklet for grabbing Airbnb listing photos from the
// LIVE DOM in the user's own browser tab. Bypasses every server-side
// scraping problem because by the time the user clicks it, Airbnb's
// own JS has already rendered the full gallery.
//
// Setup (once):  Drag the rendered <a> button to the bookmarks bar.
// Use (forever): Open any Airbnb listing tab -> click the bookmark
//                -> N photo URLs auto-copied to clipboard -> come
//                back to Overlay Studio -> paste -> done.
//
// We keep the IIFE small so the resulting javascript: URL fits well
// inside browser bookmark length limits (~64KB in Chrome / Firefox,
// historically much smaller in Safari; this comes in well under 2KB).

const BOOKMARKLET_SOURCE = `(function(){
  var urls = new Set();
  var add = function(u){
    if (!u || typeof u !== 'string') return;
    if (!/muscache\\.com\\/im\\/pictures\\//.test(u)) return;
    if (/\\/(user|users|aircover|safety|guidebook|launch|icons?|badges?|superhost|airbnb-platform-assets|categories|explore|wishlists|reviews|trips)\\//i.test(u)) return;
    if (!/\\/im\\/pictures\\/(miso\\/Hosting-\\d+|hosting\\/|lombard\\/|prohost-api\\/Hosting-\\d+)/i.test(u)) return;
    urls.add(u.replace(/im_w=\\d+/, 'im_w=1200'));
  };
  document.querySelectorAll('img').forEach(function(img){
    add(img.src); add(img.currentSrc);
    var ss = img.srcset || '';
    ss.split(',').forEach(function(p){ add((p||'').trim().split(' ')[0]); });
  });
  document.querySelectorAll('source').forEach(function(s){
    var ss = s.srcset || '';
    ss.split(',').forEach(function(p){ add((p||'').trim().split(' ')[0]); });
  });
  // Also walk inline JSON blobs (Apollo state) just in case the user
  // clicked before scrolling through the photo viewer.
  var scripts = document.querySelectorAll('script');
  var re = /https?:\\/\\/a0\\.muscache\\.com\\/im\\/pictures\\/[^\\"'\\s)<>]+\\.(?:jpe?g|png|webp)(?:\\?[^\\"'\\s)<>]*)?/gi;
  for (var i = 0; i < scripts.length; i++) {
    var m = (scripts[i].textContent || '').match(re);
    if (m) m.forEach(add);
  }
  var text = Array.from(urls).join('\\n');
  if (!text) { alert('No Airbnb photos found on this page. Make sure you opened the listing and clicked Show all photos.'); return; }
  navigator.clipboard.writeText(text).then(function(){
    alert('✓ Copied ' + urls.size + ' photo URLs.\\\\nGo to Overlay Studio, switch to Paste image URLs, and paste.');
  }, function(){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('✓ Copied ' + urls.size + ' photo URLs.\\\\nPaste into Overlay Studio.'); }
    catch(e){ alert(text); }
    document.body.removeChild(ta);
  });
})();`;

// Collapse whitespace + wrap as javascript: URL. URI-encode so any
// stray ` or % survives the drag-to-bookmark serialization.
export function buildBookmarkletUrl(): string {
  const compact = BOOKMARKLET_SOURCE.replace(/\s+/g, " ").trim();
  return `javascript:${encodeURIComponent(compact)}`;
}
