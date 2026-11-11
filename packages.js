// What Leo sells (Leo, 2026-11-10: "things that would help sell sites"): three packages shown on the Pitch screen,
// and a demo gallery of his own sites to show other business owners what's possible. Kept per SiteGen user in
// user_prefs.data.sales. Prices are never made up: until Leo types his own, a package shows "[Your price]".
'use strict';
const PLACEHOLDER = '[Your price]';
const DEFAULTS = [
  { name: 'Basic', price: '', items: ['A homepage-first site in your colors and fonts', 'Looks right on phones, tablets and computers', 'Call, email and map buttons, and a contact form', 'Set up for Google: page titles, business details, a map'] },
  { name: 'Premium', price: '', items: ['Everything in Basic', 'Premium effects: an envelope that opens as visitors scroll, scene decor, watermarks', 'Photos touched up in the photo editor (colors, light, backgrounds)', 'A private preview link to approve it before it goes live'] },
  { name: 'Premium + CRM', price: '', items: ['Everything in Premium', 'CRM add-on: every enquiry in one list, with follow-up reminders', 'Bookings and reviews collected from the site'] },
];
const MAX_ITEMS = 8, MAX_DEMOS = 12;
const flat = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

function clean(s) {
  const o = s && typeof s === 'object' ? s : {};
  const tiers = DEFAULTS.map((d, i) => {
    const t = (Array.isArray(o.tiers) && o.tiers[i]) || {};
    const items = (Array.isArray(t.items) ? t.items : d.items).map(x => flat(x, 140)).filter(Boolean).slice(0, MAX_ITEMS);
    // the deposit the client can pay online when they approve their preview (Approve and pay); blank = no online deposit
    const deposit = String(t.deposit == null ? '' : t.deposit).replace(/[^0-9.]/g, '').slice(0, 10);
    return { name: flat(t.name, 40) || d.name, price: flat(t.price, 40), deposit: depositCents(deposit) ? deposit : '', items: items.length ? items : d.items.slice(), best: false };
  });
  const best = [0, 1, 2].includes(Number(o.best)) ? Number(o.best) : 1;
  tiers.forEach((t, i) => { t.best = i === best; });
  const demos = (Array.isArray(o.demos) ? o.demos : []).map(Number).filter(n => Number.isInteger(n) && n > 0);
  return { tiers, best, note: flat(o.note, 200), demos: [...new Set(demos)].slice(0, MAX_DEMOS) };
}
// From the Packages form: tier<i>_name, tier<i>_price, tier<i>_items (one per line), best, note, demo (site ids)
function fromForm(b) {
  const tiers = [0, 1, 2].map(i => ({ name: b[`tier${i}_name`], price: b[`tier${i}_price`], deposit: b[`tier${i}_deposit`], items: String(b[`tier${i}_items`] || '').split(/\r?\n/) }));
  return clean({ tiers, best: b.best, note: b.note, demos: [].concat(b.demo || []) });
}
const priceOf = (t) => t.price || PLACEHOLDER;
// "300", "300.50", "$1,200" -> cents (0 = no deposit). Typed by Leo only, never filled in for him.
function depositCents(v) {
  const s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return 0;
  const c = Math.round(parseFloat(s) * 100);
  return c >= 50 ? c : 0;
}

function read(db, userId) {
  try { const r = db.prepare('SELECT data FROM user_prefs WHERE user_id = ?').get(userId); return clean((JSON.parse((r && r.data) || '{}') || {}).sales); } catch { return clean({}); }
}
function write(db, userId, sales) {
  const r = db.prepare('SELECT data FROM user_prefs WHERE user_id = ?').get(userId);
  let data = {}; try { data = JSON.parse((r && r.data) || '{}') || {}; } catch { data = {}; }
  data.sales = clean(sales);
  db.prepare('INSERT INTO user_prefs (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data').run(userId, JSON.stringify(data));
}

module.exports = { DEFAULTS, PLACEHOLDER, clean, fromForm, priceOf, depositCents, read, write };
