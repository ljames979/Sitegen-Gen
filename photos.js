// Real stock photos from Pexels (https://www.pexels.com/api/) for the
// "generate a site" feature. Requires a free PEXELS_API_KEY in .env.
// The editor's photo picker can also search Unsplash (https://unsplash.com/developers) when an
// UNSPLASH_ACCESS_KEY is in .env. Unsplash asks apps to hotlink its photo URLs, to tell it when a photo is used
// (trackUnsplashDownload) and to credit the photographer, which the published site does in its footer.
// Everything here fails soft: with no key, or if a request errors out or
// times out, callers just get an empty array back and the site is created
// without photos (still fully usable, just no gallery/hero image).

const pexelsEndpoint = () => process.env.PEXELS_API_URL || 'https://api.pexels.com/v1/search';

function hasPhotoProvider() {
  return Boolean(process.env.PEXELS_API_KEY);
}
const hasUnsplash = () => Boolean(process.env.UNSPLASH_ACCESS_KEY);
// Which sources the picker can search, Pexels first
const pickerSources = () => [hasPhotoProvider() && 'pexels', hasUnsplash() && 'unsplash'].filter(Boolean);

// Stock photo URLs at a chosen width. Both services resize on their side from URL settings, so a site can ask for
// a big copy for full-width photos and smaller ones for cards. Pexels' "large" size is only 940px wide, which is
// what made full-width photos look soft. `amp` is the separator ('&' or '&amp;' inside HTML).
const PEXELS_RE = /^https:\/\/images\.pexels\.com\/photos\//;
const UNSPLASH_RE = /^https:\/\/(images|plus)\.unsplash\.com\//;
const isStock = u => PEXELS_RE.test(u) || UNSPLASH_RE.test(u);
function sizedStock(url, w, amp = '&') {
  const u = String(url || ''), q = u.indexOf('?'), base = q < 0 ? u : u.slice(0, q);
  if (PEXELS_RE.test(u)) return `${base}?auto=compress${amp}cs=tinysrgb${amp}w=${w}`;
  if (UNSPLASH_RE.test(u)) {
    const keep = (q < 0 ? [] : u.slice(q + 1).split(/&amp;|&/)).filter(kv => kv && !/^(w|h|dpr)=/.test(kv));
    if (!keep.some(kv => /^q=/.test(kv))) keep.push('q=80');
    if (!keep.some(kv => /^fit=/.test(kv))) keep.push('fit=max');
    return `${base}?${keep.concat('w=' + w).join(amp)}`;
  }
  return u;
}

async function searchPhotos(query, count = 4, page = 1) {
  return (await searchPhotosPage(query, count, page)).photos;
}

// Same search, also reporting whether another page of results exists (used by
// the editor's photo picker).
async function searchPhotosPage(query, count = 4, page = 1) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return { photos: [], hasMore: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${pexelsEndpoint()}?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal
    });
    if (!res.ok) return { photos: [], hasMore: false };
    const data = await res.json();
    const photos = (data.photos || []).map(p => ({
      url: sizedStock(p.src.original || p.src.large, 1920),
      thumb: p.src.medium || p.src.large,
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      pageUrl: p.url
    }));
    return { photos, hasMore: Boolean(data.next_page) };
  } catch {
    return { photos: [], hasMore: false };
  } finally {
    clearTimeout(timeout);
  }
}

// Fetches a hero image plus a small gallery from a list of search terms,
// spreading requests across terms so the gallery isn't all one subject.
async function fetchPhotoSet(queries, { heroCount = 1, galleryCount = 6 } = {}) {
  if (!hasPhotoProvider() || !queries.length) {
    return { hero: null, gallery: [] };
  }

  const perQuery = Math.max(2, Math.ceil((heroCount + galleryCount) / queries.length));
  const batches = await Promise.all(queries.map(q => searchPhotos(q, perQuery)));
  const all = batches.flat();

  const seen = new Set();
  const deduped = all.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const hero = deduped[0] || null;
  const gallery = deduped.slice(1, 1 + galleryCount);
  return { hero, gallery };
}

// ---- Unsplash (editor picker only) ----
const unsplashEndpoint = () => process.env.UNSPLASH_API_URL || 'https://api.unsplash.com';
const UTM = 'utm_source=sitegen&utm_medium=referral';
const withUtm = u => (u ? u + (u.includes('?') ? '&' : '?') + UTM : '');
// recent search results by id, so "use this photo" is checked against what Unsplash really sent (not the browser)
const recent = new Map();
function remember(p) { recent.delete(p.id); recent.set(p.id, p); if (recent.size > 600) recent.delete(recent.keys().next().value); }
const recentUnsplash = id => recent.get(String(id || '')) || null;

async function searchUnsplashPage(query, count = 15, page = 1) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return { photos: [], hasMore: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${unsplashEndpoint()}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape&content_filter=high`;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal: controller.signal });
    if (!res.ok) return { photos: [], hasMore: false };
    const data = await res.json();
    const photos = (data.results || []).filter(p => p && p.id && p.urls && p.urls.raw && UNSPLASH_RE.test(p.urls.raw)).map(p => {
      const user = p.user || {}, links = p.links || {};
      const out = {
        id: String(p.id), source: 'unsplash',
        url: sizedStock(p.urls.raw, 1920), thumb: p.urls.small || p.urls.thumb || p.urls.raw,
        width: p.width, height: p.height, alt: String(p.alt_description || '').slice(0, 160),
        photographer: String(user.name || 'Unsplash photographer').slice(0, 80), photographerUrl: withUtm((user.links || {}).html || ''),
        pageUrl: withUtm(links.html || ''), downloadLocation: links.download_location || '',
      };
      remember(out);
      return out;
    });
    return { photos, hasMore: page < (data.total_pages || 0) };
  } catch {
    return { photos: [], hasMore: false };
  } finally {
    clearTimeout(timeout);
  }
}

// Unsplash's rule: tell it each time a photo is actually used. Only its own API address is ever called.
async function trackUnsplashDownload(photo) {
  const key = process.env.UNSPLASH_ACCESS_KEY, loc = photo && photo.downloadLocation;
  if (!key || !loc || !loc.startsWith(unsplashEndpoint() + '/photos/')) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(loc, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { hasPhotoProvider, hasUnsplash, pickerSources, searchPhotos, searchPhotosPage, fetchPhotoSet, sizedStock, isStock, searchUnsplashPage, recentUnsplash, trackUnsplashDownload, UNSPLASH_UTM: UTM };
