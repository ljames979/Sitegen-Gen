// Prospect finder (Leo, 2026-11-23): find local businesses that need a website, make them a demo, and keep track of
// who was contacted. Free data only: OpenStreetMap (Nominatim finds the town, Overpass lists the businesses in it).
//   find       a kind of business in a town: name, phone, address and website as OpenStreetMap has them
//   checkSite  opens a prospect's own website and lists plain reasons it could use a new one (no https, not built
//              for phones, an old copyright year, no page title or description, slow); never guesses beyond that
//   pitch      a short first email Leo can copy and send himself, using only those facts
// OpenStreetMap is filled in by volunteers, so some businesses are missing and "no website" can mean "no website
// listed there": the page says so. Nothing is sent to anyone from here.
'use strict';

const cheerio = require('cheerio');

const UA = 'SiteGen/1.0 (local website builder; prospect search)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// [id, label, business type for the generator, OpenStreetMap tags]
const NICHES = [
  ['hair', 'Hair salons and barbers', 'hair salon', [['shop', 'hairdresser']]],
  ['beauty', 'Nail and beauty salons', 'nail salon', [['shop', 'beauty']]],
  ['restaurant', 'Restaurants', 'restaurant', [['amenity', 'restaurant']]],
  ['fastfood', 'Fast food and food trucks', 'food truck', [['amenity', 'fast_food']]],
  ['cafe', 'Cafes', 'cafe', [['amenity', 'cafe']]],
  ['bakery', 'Bakeries', 'bakery', [['shop', 'bakery']]],
  ['plumber', 'Plumbers', 'plumbing company', [['craft', 'plumber']]],
  ['electrician', 'Electricians', 'electrician', [['craft', 'electrician']]],
  ['hvac', 'Heating and air conditioning', 'HVAC company', [['craft', 'hvac']]],
  ['roofer', 'Roofers', 'roofing company', [['craft', 'roofer']]],
  ['painter', 'Painters', 'painting company', [['craft', 'painter']]],
  ['landscaping', 'Landscaping and lawn care', 'landscaping company', [['craft', 'gardener'], ['shop', 'garden_centre']]],
  ['autorepair', 'Auto repair', 'auto repair shop', [['shop', 'car_repair']]],
  ['carwash', 'Car washes and detailing', 'car detailing', [['amenity', 'car_wash']]],
  ['petgrooming', 'Pet grooming', 'pet grooming', [['shop', 'pet_grooming']]],
  ['vet', 'Vets', 'veterinary clinic', [['amenity', 'veterinary']]],
  ['dentist', 'Dentists', 'dental office', [['amenity', 'dentist']]],
  ['chiro', 'Chiropractors', 'chiropractor', [['healthcare', 'chiropractor']]],
  ['gym', 'Gyms and fitness', 'gym', [['leisure', 'fitness_centre']]],
  ['florist', 'Florists', 'florist', [['shop', 'florist']]],
  ['tattoo', 'Tattoo shops', 'tattoo studio', [['shop', 'tattoo']]],
  ['childcare', 'Daycare and childcare', 'daycare', [['amenity', 'childcare']]],
  ['realestate', 'Real estate agents', 'real estate agent', [['office', 'estate_agent']]],
  ['lawyer', 'Lawyers', 'law firm', [['office', 'lawyer']]],
  ['accountant', 'Accountants and tax', 'accounting firm', [['office', 'accountant'], ['office', 'tax_advisor']]],
  ['cleaning', 'Dry cleaners and laundry', 'dry cleaner', [['shop', 'dry_cleaning'], ['shop', 'laundry']]]
];
const niche = (id) => NICHES.find(n => n[0] === id) || null;
const STATUSES = [['new', 'New'], ['demo', 'Demo made'], ['contacted', 'Contacted'], ['interested', 'Interested'], ['client', 'Became a client'], ['no', 'Not interested']];

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const okUrl = (u) => { const s = str(u, 400); if (!s) return ''; const w = /^https?:\/\//i.test(s) ? s : 'http://' + s; try { const x = new URL(w); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href : ''; } catch { return ''; } };

async function jsonFetch(fetchFn, url, init) {
  const r = await fetchFn(url, { ...(init || {}), headers: { 'User-Agent': UA, Accept: 'application/json', ...((init && init.headers) || {}) } });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  return r.json();
}

// the town's box on the map
async function geocode(place, { fetchFn }) {
  const q = str(place, 120);
  if (!q) throw new Error('Type a town or city.');
  const rows = await jsonFetch(fetchFn, `${NOMINATIM}?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`);
  if (!Array.isArray(rows) || !rows.length) throw new Error(`Could not find "${q}" on the map. Try "Town, State".`);
  const b = rows[0].boundingbox.map(Number);   // [south, north, west, east]
  // keep the search to a town-sized box (about 30 km), centred on the place
  const lat = Number(rows[0].lat), lon = Number(rows[0].lon), d = 0.14;
  return { name: str(rows[0].display_name, 160), box: [Math.max(b[0], lat - d), Math.max(b[2], lon - d), Math.min(b[1], lat + d), Math.min(b[3], lon + d)] };
}

function overpassQuery(tags, box) {
  const bb = box.map(v => v.toFixed(5)).join(',');
  return `[out:json][timeout:40];(${tags.map(([k, v]) => `nwr["${k}"="${v}"]["name"](${bb});`).join('')});out tags center 300;`;
}

// one business as SiteGen keeps it
function fromOsm(el, nicheId) {
  const t = el.tags || {};
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const address = [street, t['addr:city'], [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    osm_id: `${el.type}/${el.id}`, niche: nicheId, name: str(t.name, 120),
    phone: str(t.phone || t['contact:phone'], 40),
    website: okUrl(t.website || t['contact:website'] || t.url),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(t.email || t['contact:email'], 120)) ? str(t.email || t['contact:email'], 120) : '',
    facebook: okUrl(t['contact:facebook'] || t.facebook),
    address: str(address, 200), city: str(t['addr:city'], 80),
    lat: Number((el.center || el).lat) || null, lon: Number((el.center || el).lon) || null
  };
}

async function find(place, nicheId, { fetchFn }) {
  const n = niche(nicheId);
  if (!n) throw new Error('Pick a kind of business.');
  const g = await geocode(place, { fetchFn });
  const body = 'data=' + encodeURIComponent(overpassQuery(n[3], g.box));
  let data = null, lastErr = null;
  for (const url of OVERPASS) {
    try { data = await jsonFetch(fetchFn, url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); break; } catch (e) { lastErr = e; }
  }
  if (!data) throw new Error(`The OpenStreetMap search is busy (${lastErr ? lastErr.message : 'no answer'}). Try again in a minute.`);
  const seen = new Set();
  const list = (data.elements || []).map(el => fromOsm(el, nicheId)).filter(p => p.name && !seen.has(p.name.toLowerCase() + p.address) && seen.add(p.name.toLowerCase() + p.address));
  return { place: g.name, list };
}

// plain reasons the business's own site could use a new one (fetchFn as sitewatch: follows redirects, throws when down)
async function checkSite(url, { fetchFn, now = new Date() }) {
  const reasons = [];
  const u = okUrl(url);
  if (!u) return { ok: false, reasons: ['No website listed'] };
  const t0 = Date.now();
  let res, html = '', finalUrl = u;
  try {
    const r = await fetchFn(u);
    res = r.response || r; finalUrl = r.finalUrl || u;
    html = res.status < 400 ? await res.text() : '';
  } catch (e) { return { ok: false, reasons: ['Their website does not open'] }; }
  const ms = Date.now() - t0;
  if (res.status >= 400) return { ok: false, reasons: [`Their website answers with an error (${res.status})`] };
  const $ = cheerio.load(html);
  if (!/^https:/i.test(finalUrl)) reasons.push('Not secure (no https), so browsers show "Not secure"');
  if (!$('meta[name="viewport"]').length) reasons.push('Not built for phones');
  const years = (($('footer').text() || $('body').text()).match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i) || [])[1];
  if (years && +years <= now.getFullYear() - 3) reasons.push(`Copyright says ${years}, so it looks unattended`);
  if (!$('title').text().trim()) reasons.push('No page title for Google');
  if (!$('meta[name="description"]').attr('content')) reasons.push('No description for Google');
  if ($('table').length >= 4 && !$('meta[name="viewport"]').length) reasons.push('Laid out with old-style tables');
  if (/\.swf\b|<embed[^>]+flash/i.test(html)) reasons.push('Uses Flash, which no browser plays any more');
  if (ms > 5000) reasons.push(`Slow to open (${Math.round(ms / 1000)} seconds)`);
  if (/wixsite\.com|weebly\.com|godaddysites\.com|business\.site|square\.site/i.test(finalUrl)) reasons.push('On a free site-builder address, not its own domain');
  return { ok: true, reasons };
}

// a first email Leo can copy: only the facts above, his own demo link, no claims
function pitch(p, { link = '', reasons = [], fromName = '' } = {}) {
  const first = p.website ? (reasons.length ? `I had a look at your website and noticed a few things that may be costing you customers: ${reasons.slice(0, 3).map(r => r.charAt(0).toLowerCase() + r.slice(1)).join('; ')}.` : 'I had a look at your website and had some ideas to make it bring in more customers.')
    : `I couldn't find a website for ${p.name}, and most people look a business up on their phone before they call or visit.`;
  return [
    `Hi ${p.name} team,`,
    '',
    `I build websites for local businesses${p.city ? ' in ' + p.city : ''}. ${first}`,
    '',
    `I made a free demo of what a new site for ${p.name} could look like: ${link || '[your preview link]'}`,
    '',
    'If you like it, I can have it online quickly, with your own photos, services and contact details. No obligation.',
    '',
    `Thanks,\n${fromName || '[Your name]'}`
  ].join('\n');
}

// ---- storage ----
function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    osm_id TEXT NOT NULL,
    niche TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    facebook TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    lat REAL, lon REAL,
    status TEXT NOT NULL DEFAULT 'new',
    reasons TEXT NOT NULL DEFAULT '',
    checked INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    site_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, osm_id)
  )`);
}
// adds the new ones, refreshes the details of the ones already there (status, note and demo are kept)
function saveFound(db, userId, place, list) {
  ensureTable(db);
  const up = db.prepare(`INSERT INTO prospects (user_id, osm_id, niche, name, phone, email, website, facebook, address, city, place, lat, lon)
    VALUES (@user_id, @osm_id, @niche, @name, @phone, @email, @website, @facebook, @address, @city, @place, @lat, @lon)
    ON CONFLICT(user_id, osm_id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, website = excluded.website,
      facebook = excluded.facebook, address = excluded.address, city = excluded.city`);
  let added = 0;
  const before = db.prepare('SELECT COUNT(*) n FROM prospects WHERE user_id = ?').get(userId).n;
  db.transaction(() => { for (const p of list.slice(0, 300)) up.run({ ...p, user_id: userId, place: str(place, 160) }); })();
  added = db.prepare('SELECT COUNT(*) n FROM prospects WHERE user_id = ?').get(userId).n - before;
  return added;
}
function list(db, userId, { niche: nicheId = '', status = '', web = '', q = '' } = {}) {
  ensureTable(db);
  const where = ['user_id = ?'], args = [userId];
  if (nicheId) { where.push('niche = ?'); args.push(nicheId); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (web === 'none') where.push("website = ''");
  if (web === 'has') where.push("website != ''");
  if (q) { where.push('(name LIKE ? OR address LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  return db.prepare(`SELECT * FROM prospects WHERE ${where.join(' AND ')} ORDER BY (website = '') DESC, checked DESC, name LIMIT 500`).all(...args)
    .map(r => ({ ...r, reasonList: r.reasons ? r.reasons.split('\n').filter(Boolean) : [] }));
}
const get = (db, userId, id) => { ensureTable(db); return db.prepare('SELECT * FROM prospects WHERE id = ? AND user_id = ?').get(id, userId) || null; };
function update(db, userId, id, patch) {
  const keys = Object.keys(patch).filter(k => ['status', 'note', 'reasons', 'checked', 'site_id'].includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE prospects SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(...keys.map(k => patch[k]), id, userId);
}

module.exports = { NICHES, STATUSES, niche, geocode, overpassQuery, fromOsm, find, checkSite, pitch, ensureTable, saveFound, list, get, update, okUrl };
