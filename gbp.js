// Google basics for a client's site: a Google Business Profile checklist, a name / address / phone match check between
// the site and the Google listing, and the addresses to hand Google (website, sitemap). Pure functions.
// Nothing here is sent to Google: Leo (or the client) does the listing at business.google.com, this only checks and guides.
'use strict';
const { defaultSections } = require('./defaults');

// suggested primary category per business type (templates.js ids). Google has thousands; this is a starting point.
const CATEGORY = {
  plumbing: 'Plumber', electrician: 'Electrician', hvac: 'HVAC contractor', landscaping: 'Landscaper', cleaning: 'House cleaning service',
  roofing: 'Roofing contractor', contractor: 'General contractor', 'auto-repair': 'Auto repair shop', salon: 'Hair salon', spa: 'Day spa',
  restaurant: 'Restaurant', bakery: 'Bakery', law: 'Law firm', accounting: 'Accountant', 'real-estate': 'Real estate agency', dentist: 'Dentist',
  veterinary: 'Veterinarian', fitness: 'Gym', photography: 'Photographer', 'pet-grooming': 'Pet groomer', 'it-repair': 'Computer repair service',
  moving: 'Moving company', 'pest-control': 'Pest control service', painting: 'Painter'
};

// the things only a person can do in Google, ticked off by hand
const MANUAL = [
  ['claim', 'Created or claimed the listing at business.google.com'],
  ['verify', 'Verified the listing (Google sends a code by postcard, phone, email or video)'],
  ['website', 'Added the site\'s live address (shown above) to the listing'],
  ['hours', 'Listing hours are the same as the site\'s hours'],
  ['photos', 'Uploaded the logo, a cover photo and a few real photos'],
  ['services', 'Added the services (the same names as on the site)'],
  ['console', 'Added the site to Google Search Console and submitted the sitemap'],
  ['reviews', 'Sent the review link to the first customers']
];
const MANUAL_IDS = MANUAL.map(m => m[0]);

const digits = (s) => String(s || '').replace(/\D/g, '');
// compare phones by their last 10 digits (so +1 (407) 555-0100 and 407.555.0100 match)
const samePhone = (a, b) => { const x = digits(a), y = digits(b); return x.length >= 7 && y.length >= 7 && x.slice(-10) === y.slice(-10); };
const ABBR = { street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', lane: 'ln', court: 'ct', place: 'pl', suite: 'ste', highway: 'hwy', parkway: 'pkwy', north: 'n', south: 's', east: 'e', west: 'w', apartment: 'apt', circle: 'cir', terrace: 'ter' };
function normAddress(s) {
  return String(s || '').toLowerCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean).map(w => ABBR[w] || w).join(' ');
}
const sameAddress = (a, b) => { const x = normAddress(a), y = normAddress(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };
const normName = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(llc|inc|co|ltd|corp)\b/g, '').trim();

// The listing details Leo typed vs what the site shows. Returns one row per field: ok / differs / missing.
function napCheck(site, gbp) {
  const c = site.sections.contact || {};
  const rows = [];
  const row = (field, onSite, onGoogle, same) => rows.push({ field, onSite: onSite || '', onGoogle: onGoogle || '', state: !onGoogle ? 'unknown' : !onSite ? 'missing' : same ? 'ok' : 'differs' });
  row('Business name', site.name, gbp.name, normName(site.name) === normName(gbp.name));
  row('Phone', c.phone, gbp.phone, samePhone(c.phone, gbp.phone));
  row('Address', c.address, gbp.address, sameAddress(c.address, gbp.address));
  return rows;
}

// where the site really lives (what goes into the listing's Website box)
function liveUrl(site, publicOrigin) {
  if (site.netlify_domain) return (site.netlify_ssl ? 'https://' : 'http://') + site.netlify_domain + '/';
  if (site.netlify_url) return site.netlify_url.replace(/\/?$/, '/');
  if (site.custom_domain && site.published) return 'https://' + site.custom_domain + '/';
  if (site.published && publicOrigin) return `${publicOrigin}/site/${site.slug}`;
  return '';
}

// automatic checks: what the site already gives Google, and what is missing
function autoChecks(site, { ext, publicOrigin, templateId, reviewLink }) {
  const s = site.sections, c = s.contact || {}, meta = s.meta || {};
  const out = [];
  const add = (ok, text, fix) => out.push({ ok: !!ok, text, fix: ok ? '' : (fix || '') });
  const url = liveUrl(site, publicOrigin);
  add(url, url ? `Live address for the listing: ${url}` : 'The site is not online yet, so there is no address to give Google.', 'Launch it first (Launch page).');
  add(c.phone, c.phone ? `Phone on the site: ${c.phone}` : 'No phone number on the site.', 'Add it in the editor (Contact).');
  add(c.address || (s.trust.serviceAreas || []).length, c.address ? `Address on the site: ${c.address}` : (s.trust.serviceAreas || []).length ? 'No street address (fine for a business that goes to customers; set it as a service-area business in Google).' : 'No address and no service areas.', 'Add the address, or the towns served (editor, Trust).');
  add(meta.city, meta.city ? `Main city: ${meta.city} (used in page titles and Google's business data)` : 'No main city set.', 'Editor, Local SEO & tracking, Main city.');
  const hrs = (s.hours && s.hours.items) || [];
  const hoursDefault = JSON.stringify(hrs.map(h => [h.day, h.time])) === JSON.stringify(defaultSections().hours.items.map(h => [h.day, h.time]));
  add(hrs.length && !hoursDefault, !hrs.length ? 'No opening hours on the site.' : hoursDefault ? 'The hours are still the default Mon–Fri 9–5.' : 'Opening hours are set (Google reads them from the site\'s business data).', 'Set the real hours in the editor (Hours).');
  add((s.services.items || []).length, `${(s.services.items || []).length} service${(s.services.items || []).length === 1 ? '' : 's'} listed (add the same ones to the listing).`, 'Add the services in the editor.');
  add(site.theme && site.theme.logoUrl, site.theme && site.theme.logoUrl ? 'Logo uploaded (use it as the listing\'s logo too).' : 'No logo uploaded.', 'Upload one in the editor (Theme).');
  const photos = (s.gallery && s.gallery.images ? s.gallery.images.length : 0);
  add(photos >= 3, `${photos} gallery photo${photos === 1 ? '' : 's'} (Google suggests at least 3 real photos on the listing).`, 'Add real photos to the gallery.');
  add(ext.gsv, ext.gsv ? 'Search Console tag is on every page.' : 'No Search Console tag yet.', 'Paste it below, then press Verify in Search Console.');
  add(s.trust.googleReviewsUrl, s.trust.googleReviewsUrl ? 'Google reviews link is set (shown on the Reviews page).' : 'No Google reviews link on the site yet.', 'Once the listing is verified, copy its "Get more reviews" link into the editor (Trust, Google reviews link).');
  return { checks: out, url, category: CATEGORY[templateId] || '', reviewLink: reviewLink || '' };
}

// the description box on the listing allows 750 characters; offer the About text, trimmed at a sentence
function suggestedDescription(site) {
  const t = String((site.sections.about && site.sections.about.body) || '').replace(/\s+/g, ' ').trim();
  if (t === String(defaultSections().about.body).trim()) return ''; // still the placeholder: nothing to offer
  if (t.length <= 750) return t;
  const cut = t.slice(0, 750); const i = cut.lastIndexOf('. ');
  return i > 200 ? cut.slice(0, i + 1) : cut.trim();
}

module.exports = { CATEGORY, MANUAL, MANUAL_IDS, samePhone, sameAddress, normAddress, napCheck, liveUrl, autoChecks, suggestedDescription };
