// Google reviews for a business, via the Places API (New). Needs GOOGLE_PLACES_API_KEY on the server and
// the business's Place ID on the site. Reviews are kept for a day, then refreshed in the background, so
// a page never waits on Google. Nothing is shown unless Google returned it.
const URL_BASE = () => process.env.GOOGLE_PLACES_API_URL || 'https://places.googleapis.com/v1';
const TTL_MS = 24 * 3600 * 1000;
const FIELDS = 'displayName,rating,userRatingCount,googleMapsUri,reviews';

const isConfigured = () => !!process.env.GOOGLE_PLACES_API_KEY;
const cap = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

function cleanPlaceId(v) {
  const s = String(v || '').trim().replace(/^places\//, '');
  return /^[A-Za-z0-9_-]{10,200}$/.test(s) ? s : '';
}

function clean(raw) {
  const rating = Number(raw && raw.rating);
  if (!(rating >= 1 && rating <= 5)) return null;
  return {
    rating: Math.round(rating * 10) / 10,
    count: Math.max(0, parseInt(raw.userRatingCount, 10) || 0),
    url: /^https:\/\/(www\.)?(google\.com|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl)\//.test(raw.googleMapsUri || '') ? raw.googleMapsUri : '',
    reviews: (Array.isArray(raw.reviews) ? raw.reviews : []).slice(0, 5).map(r => ({
      author: cap(r.authorAttribution && r.authorAttribution.displayName, 80) || 'Google user',
      rating: Math.min(5, Math.max(1, parseInt(r.rating, 10) || 0)) || 5,
      text: cap((r.text && r.text.text) || (r.originalText && r.originalText.text), 600),
      when: cap(r.relativePublishTimeDescription, 40)
    })).filter(r => r.text)
  };
}

async function fetchPlace(placeId) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(`${URL_BASE()}/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': FIELDS },
      signal: ctl.signal
    });
    if (!res.ok) return { error: res.status === 404 ? 'Google could not find that Place ID.' : `Google returned an error (HTTP ${res.status}). Check the key and that the Places API (New) is enabled.` };
    const data = clean(await res.json());
    return data ? { data } : { error: 'That place has no rating yet.' };
  } catch (e) { return { error: 'Could not reach Google.' }; } finally { clearTimeout(t); }
}

async function refresh(db, siteId, placeId) {
  const now = new Date().toISOString();
  if (!isConfigured()) return { error: 'No Google key is set up on this server (GOOGLE_PLACES_API_KEY).' };
  const r = await fetchPlace(placeId);
  if (r.data) db.prepare(`INSERT INTO google_reviews_cache (site_id, fetched_at, data, error) VALUES (?, ?, ?, '') ON CONFLICT(site_id) DO UPDATE SET fetched_at = excluded.fetched_at, data = excluded.data, error = ''`).run(siteId, now, JSON.stringify({ ...r.data, placeId }));
  else db.prepare(`INSERT INTO google_reviews_cache (site_id, fetched_at, data, error) VALUES (?, ?, '{}', ?) ON CONFLICT(site_id) DO UPDATE SET fetched_at = excluded.fetched_at, error = excluded.error`).run(siteId, now, r.error);
  return r;
}

function row(db, siteId) { return db.prepare('SELECT * FROM google_reviews_cache WHERE site_id = ?').get(siteId); }

// what the page may show now (never waits on the network); kicks off a refresh when it is stale
function forSite(db, site, onRefreshed) {
  const t = site.sections.testimonials || {};
  const placeId = cleanPlaceId(t.googlePlaceId);
  if (!placeId || !['badge', 'reviews'].includes(t.googleMode)) return null;
  const r = row(db, site.id);
  const stale = !r || Date.now() - new Date(r.fetched_at).getTime() > TTL_MS;
  if (stale && isConfigured() && !inflight.has(site.id)) {
    inflight.add(site.id);
    refresh(db, site.id, placeId).then(() => onRefreshed && onRefreshed()).catch(() => {}).finally(() => inflight.delete(site.id));
  }
  if (!r || !r.data) return null;
  let d; try { d = JSON.parse(r.data); } catch { return null; }
  if (!d || d.placeId !== placeId || !d.rating) return null;
  return { ...d, showReviews: t.googleMode === 'reviews' };
}
const inflight = new Set();

module.exports = { isConfigured, cleanPlaceId, clean, fetchPlace, refresh, row, forSite, TTL_MS };
