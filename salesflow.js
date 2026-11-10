// Selling and launching a client's site (Leo, 2026-11-10: "lets do them all"):
//  - Approve and pay: the client approves the preview on the share link, picks a package and pays the deposit Leo set
//    for it, through Leo's own Stripe account (STRIPE_SECRET_KEY). Amounts only ever come from Leo's Packages page.
//  - Launch: the state of the one-click launch (publish, domain, HTTPS, tell the client).
//  - Leads into a CRM: an optional webhook that receives every new lead as JSON (signed), and leads copied in from
//    Netlify Forms for sites hosted on Netlify.
//  - Per-site extras: Google Business Profile details, the Search Console tag and the visit-counter key.
// Pure helpers over a db handle, so they can be tested on their own.
'use strict';
const crypto = require('crypto');

const PAY_STATUSES = ['none', 'pending', 'paid'];
const LAUNCH_STATES = ['', 'publishing', 'waiting-dns', 'live', 'failed'];
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const nowIso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const EMPTY = {
  package: '', approved_at: '', approved_name: '', approved_email: '', approved_note: '', deposit_cents: 0, currency: 'usd',
  stripe_session_id: '', pay_status: 'none', paid_at: '', paid_how: '', launch_domain: '', launch_state: '', launch_tries: 0,
  launch_started_at: '', launched_at: '', launch_notify: '', stats_key: '', extras: '{}', forms_synced_at: ''
};
const COLS = Object.keys(EMPTY);

function get(db, siteId) {
  const r = db.prepare('SELECT * FROM site_sales WHERE site_id = ?').get(siteId);
  const row = { site_id: Number(siteId), ...EMPTY, ...(r || {}) };
  row.ext = cleanExtras(safeJson(row.extras));
  return row;
}
function safeJson(s) { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }

// writes only known columns; creates the row the first time
function set(db, siteId, patch) {
  const keys = Object.keys(patch || {}).filter(k => COLS.includes(k));
  if (!keys.length) return get(db, siteId);
  db.prepare('INSERT OR IGNORE INTO site_sales (site_id) VALUES (?)').run(siteId);
  db.prepare(`UPDATE site_sales SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE site_id = ?`).run(...keys.map(k => patch[k]), siteId);
  return get(db, siteId);
}
function setExtras(db, siteId, patch) {
  const cur = get(db, siteId).ext;
  const next = cleanExtras({ ...cur, ...patch, webhook: { ...cur.webhook, ...((patch && patch.webhook) || {}) }, gbp: { ...cur.gbp, ...((patch && patch.gbp) || {}) } });
  set(db, siteId, { extras: JSON.stringify(next) });
  return next;
}

// ---- per-site extras ----
function cleanExtras(o) {
  o = o && typeof o === 'object' ? o : {};
  const w = o.webhook && typeof o.webhook === 'object' ? o.webhook : {};
  const g = o.gbp && typeof o.gbp === 'object' ? o.gbp : {};
  return {
    webhook: {
      url: cleanWebhookUrl(w.url), secret: /^[A-Za-z0-9_-]{16,64}$/.test(String(w.secret || '')) ? String(w.secret) : '',
      lastStatus: str(w.lastStatus, 120), lastAt: str(w.lastAt, 20)
    },
    gbp: { name: str(g.name, 100), phone: str(g.phone, 40), address: str(g.address, 200), category: str(g.category, 80), done: Array.isArray(g.done) ? g.done.map(x => str(x, 30)).filter(Boolean).slice(0, 40) : [] },
    gsv: cleanVerify(o.gsv)
  };
}

// Search Console "HTML tag" method: accepts the token or the whole <meta> tag Google shows
function cleanVerify(v) {
  const s = String(v == null ? '' : v).trim();
  const m = /content\s*=\s*["']([^"']+)["']/i.exec(s);
  const t = (m ? m[1] : s).trim();
  return /^[A-Za-z0-9_-]{20,100}$/.test(t) ? t : '';
}

// a CRM, Zapier or Make "catch hook" address. https only, except a CRM running on this same computer (localhost).
function cleanWebhookUrl(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 500);
  if (!s) return '';
  let u; try { u = new URL(s); } catch { return ''; }
  if (u.username || u.password) return '';
  if (u.protocol === 'https:') return u.toString();
  if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return u.toString();
  return '';
}
const newSecret = () => crypto.randomBytes(24).toString('base64url');
const sign = (secret, body) => 'sha256=' + crypto.createHmac('sha256', String(secret)).update(body).digest('hex');

// the JSON a CRM receives for one lead (the same shape for every source)
function leadPayload(site, lead, event = 'lead.created') {
  let answers = [];
  try { answers = lead.answers ? JSON.parse(lead.answers) : []; } catch { answers = []; }
  return {
    event,
    site: { id: site.id, name: site.name, slug: site.slug },
    lead: {
      id: lead.id, name: lead.name || '', email: lead.email || '', phone: lead.phone || '', service: lead.service || '',
      message: lead.message || '', source: lead.source || 'form', status: lead.status || 'new', created_at: lead.created_at || nowIso(),
      answers: Array.isArray(answers) ? answers.slice(0, 40) : []
    }
  };
}

// POSTs one lead to the site's webhook. Never throws: returns a short status line that the page shows.
async function sendWebhook(hook, payload, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  if (!hook || !hook.url) return { ok: false, status: 'No webhook address set.' };
  const body = JSON.stringify(payload);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(hook.url, {
      method: 'POST', signal: ctl.signal, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SiteGen-Leads/1', 'X-SiteGen-Event': payload.event, ...(hook.secret ? { 'X-SiteGen-Signature': sign(hook.secret, body) } : {}) },
      body
    });
    return res.ok ? { ok: true, status: `Delivered (HTTP ${res.status})` } : { ok: false, status: `The CRM answered HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: e.name === 'AbortError' ? 'The CRM did not answer within 8 seconds' : 'Could not reach the CRM: ' + String(e.message).slice(0, 80) };
  } finally { clearTimeout(t); }
}

// ---- Netlify Forms -> Leads ----
// One Netlify form submission as a lead row. Known fields fill the usual columns, everything else becomes answers.
const KNOWN = { name: 'name', 'full-name': 'name', full_name: 'name', email: 'email', phone: 'phone', tel: 'phone', message: 'message', service: 'service' };
const SKIP = new Set(['form-name', 'bot-field', 'website', 'ip', 'user_agent', 'referrer', 'g-recaptcha-response']);
function fromNetlify(sub) {
  const d = (sub && sub.data && typeof sub.data === 'object') ? sub.data : {};
  const out = { ext_id: str(sub && sub.id, 64), name: '', email: '', phone: '', message: '', service: '', answers: [], created_at: '' };
  for (const [k, v] of Object.entries(d)) {
    const key = String(k).toLowerCase();
    if (SKIP.has(key)) continue;
    const val = Array.isArray(v) ? v.join(', ') : (v && typeof v === 'object' ? (v.url || '') : v);
    const col = KNOWN[key];
    if (col && !out[col]) out[col] = str(val, col === 'message' ? 5000 : 254);
    else if (String(val || '').trim()) out.answers.push({ label: str(k, 80), value: str(val, 1000) });
  }
  if (!out.name) out.name = str(sub && (sub.name || [sub.first_name, sub.last_name].filter(Boolean).join(' ')), 100);
  if (!out.email) out.email = str(sub && sub.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) out.email = '';
  const when = Date.parse(sub && sub.created_at);
  out.created_at = Number.isFinite(when) ? new Date(when).toISOString().slice(0, 19).replace('T', ' ') : nowIso();
  if (out.answers.length > 30) out.answers = out.answers.slice(0, 30);
  return out;
}
// whether a submission is a real message and not an empty or bot one (Netlify already filters spam into its own list)
const isUsable = (l) => !!(l.ext_id && (l.email || l.phone || l.message));

// inserts the leads that are new; returns the inserted rows (with ids)
function importLeads(db, siteId, subs) {
  const ins = db.prepare(`INSERT OR IGNORE INTO contact_submissions (site_id, name, email, phone, message, service, answers, source, ext_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'netlify', ?, ?)`);
  const added = [];
  for (const sub of subs || []) {
    const l = fromNetlify(sub);
    if (!isUsable(l)) continue;
    const info = ins.run(siteId, l.name, l.email, l.phone, l.message, l.service, l.answers.length ? JSON.stringify(l.answers) : '', l.ext_id, l.created_at);
    if (info.changes) added.push({ ...l, id: info.lastInsertRowid, source: 'netlify', status: 'new', answers: l.answers.length ? JSON.stringify(l.answers) : '' });
  }
  return added;
}

// ---- visits on a Netlify copy (a no-cookie counter that calls back to SiteGen) ----
function statsKey(db, siteId) {
  const r = get(db, siteId);
  if (r.stats_key) return r.stats_key;
  const key = crypto.randomBytes(15).toString('base64url');
  set(db, siteId, { stats_key: key });
  return key;
}
// where a hosted copy sends its counts: only when SiteGen has a public https address (PUBLIC_URL)
function statsBase(env = process.env) {
  let u; try { u = new URL(String(env.PUBLIC_URL || '')); } catch { return ''; }
  if (u.protocol !== 'https:' && !(env.NODE_ENV === 'test' && u.hostname === 'localhost')) return '';
  return u.origin;
}

// ---- approve and pay ----
// the packages a client can pick on the preview link: Leo's three, with only what he typed (no placeholder prices)
function clientPackages(sales, depositCentsOf) {
  return sales.tiers.map((t, i) => ({ i, name: t.name, price: t.price, items: t.items, best: t.best, depositCents: depositCentsOf(t.deposit) }));
}
// the client's approval, cleaned. pkgIndex must be one of Leo's packages (or -1 for "not sure yet").
function cleanApproval(b, pkgs) {
  b = b || {};
  const i = Number.isInteger(Number(b.pkg)) ? Number(b.pkg) : -1;
  const pkg = pkgs.find(p => p.i === i) || null;
  const email = str(b.email, 254);
  const out = {
    name: str(b.name, 100), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '', note: str(b.note, 1000),
    pkg, agree: b.agree === true || b.agree === '1' || b.agree === 'on'
  };
  const errors = [];
  if (!out.name) errors.push('Please type your name.');
  if (!out.email) errors.push('Please add a valid email address.');
  if (!out.agree) errors.push('Please tick the box to approve the design.');
  return { approval: out, errors };
}
const isApproved = (row) => !!(row && row.approved_at);
const canPay = (row, stripeOn) => !!(stripeOn && isApproved(row) && row.deposit_cents > 0 && row.pay_status !== 'paid');

function money(cents, currency = 'usd') {
  const sym = { usd: '$', cad: 'CA$', eur: '€', gbp: '£', aud: 'A$' }[currency] || '$';
  return sym + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- launch: the steps and where each one stands ----
function launchSteps({ site, row, netlifyOn, quality }) {
  const st = (done, wait) => (done ? 'done' : wait ? 'wait' : 'todo');
  const domain = site.netlify_domain || row.launch_domain || '';
  return [
    { key: 'quality', label: 'Quality check', state: quality == null ? 'todo' : st(quality.ok, false), note: quality == null ? '' : quality.ok ? 'No red items.' : `${quality.red} red item${quality.red === 1 ? '' : 's'} to fix (or launch anyway).` },
    { key: 'approved', label: 'Client approved the design', state: st(isApproved(row), false), note: isApproved(row) ? `${row.approved_name} on ${row.approved_at.slice(0, 10)}${row.package ? ' · ' + row.package : ''}` : 'Optional. Send the preview link from Pitch.' },
    { key: 'deposit', label: 'Deposit paid', state: row.pay_status === 'paid' ? 'done' : row.pay_status === 'pending' ? 'wait' : 'todo', note: row.pay_status === 'paid' ? `${money(row.deposit_cents, row.currency)}${row.paid_how === 'manual' ? ' (marked paid by you)' : ' through Stripe'}` : row.deposit_cents ? `${money(row.deposit_cents, row.currency)} not paid yet` : 'Optional. No deposit asked.' },
    { key: 'publish', label: 'Published online', state: st(!!site.netlify_site_id && !!site.netlify_deployed_at, row.launch_state === 'publishing'), note: site.netlify_url ? site.netlify_url : netlifyOn ? '' : 'Connect Netlify first (one time).' },
    { key: 'domain', label: 'Own domain', state: st(!!site.netlify_domain, false), note: domain || 'Optional. Without one the site stays on its netlify.app address.' },
    { key: 'https', label: 'HTTPS (the padlock)', state: site.netlify_domain ? st(!!site.netlify_ssl, row.launch_state === 'waiting-dns') : 'todo', note: site.netlify_ssl ? 'On.' : row.launch_state === 'waiting-dns' ? `Waiting for the domain's DNS. SiteGen tries again every 15 minutes (${row.launch_tries} tr${row.launch_tries === 1 ? 'y' : 'ies'} so far).` : '' },
    { key: 'told', label: 'Client told it is live', state: st(!!row.launched_at, row.launch_notify && !row.launched_at), note: row.launched_at ? `Emailed ${row.launch_notify || ''} on ${row.launched_at.slice(0, 10)}` : row.launch_notify ? `Will email ${row.launch_notify} once it is live.` : '' }
  ];
}
// HTTPS retries: every 15 minutes for 3 days, then the launch is marked failed and Leo is told
const LAUNCH_RETRY_MS = 15 * 60 * 1000, LAUNCH_MAX_TRIES = 3 * 24 * 4;

module.exports = {
  PAY_STATUSES, LAUNCH_STATES, get, set, setExtras, cleanExtras, cleanVerify, cleanWebhookUrl, newSecret, sign, leadPayload,
  sendWebhook, fromNetlify, isUsable, importLeads, statsKey, statsBase, clientPackages, cleanApproval, isApproved, canPay, money,
  launchSteps, LAUNCH_RETRY_MS, LAUNCH_MAX_TRIES, nowIso
};
