// Automatic database snapshots (data/backups), site-file export/import helpers.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const NAME_RE = /^sitegen-\d{4}-\d{2}-\d{2}-\d{4}\.db\.gz$/;

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function list(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter(n => NAME_RE.test(n)).sort().reverse().map(n => {
    const st = fs.statSync(path.join(dir, n));
    return { name: n, size: st.size, when: st.mtime };
  });
}

// snapshot the live database safely, compress it, and drop the oldest beyond `keep`
async function run(db, dir, keep = 14, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true });
  const raw = path.join(dir, `.tmp-${process.pid}-${Date.now()}.db`);
  const name = `sitegen-${stamp(now)}.db.gz`;
  const out = path.join(dir, name);
  try {
    await db.backup(raw);
    await pipeline(fs.createReadStream(raw), zlib.createGzip({ level: 9 }), fs.createWriteStream(out + '.part'));
    fs.renameSync(out + '.part', out);
  } finally {
    fs.rmSync(raw, { force: true });
    fs.rmSync(out + '.part', { force: true });
  }
  prune(dir, keep);
  return name;
}

function prune(dir, keep) {
  const all = list(dir);
  for (const f of all.slice(Math.max(1, keep))) fs.rmSync(path.join(dir, f.name), { force: true });
}

// has a snapshot already been taken today (local time)?
function hasToday(dir, now = new Date()) {
  const day = stamp(now).slice(0, 10);
  return list(dir).some(f => f.name.startsWith(`sitegen-${day}`));
}

function pathFor(dir, name) { return NAME_RE.test(name || '') ? path.join(dir, name) : null; }

// ---- one site as a portable file ----
const FORMAT = 'sitegen-site';
function exportSite(site) {
  return {
    format: FORMAT, version: 1, exportedAt: new Date().toISOString(),
    name: site.name, theme: site.theme, sections: site.sections, layout: site.layout,
    seo_title: site.seo_title || '', seo_description: site.seo_description || ''
  };
}

// drop script-capable links anywhere in the data; imported files are not trusted
function scrub(v, depth = 0) {
  if (depth > 12) return null;
  if (typeof v === 'string') return /^\s*(javascript|vbscript|data):/i.test(v) ? '' : v.slice(0, 20000);
  if (Array.isArray(v)) return v.slice(0, 500).map(x => scrub(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 200)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; o[k] = scrub(v[k], depth + 1); }
    return o;
  }
  return (typeof v === 'number' || typeof v === 'boolean' || v === null) ? v : null;
}

function parseSiteFile(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { error: 'That file is not a SiteGen site file.' }; }
  if (!j || j.format !== FORMAT || !j.theme || !j.sections || !j.layout) return { error: 'That file is not a SiteGen site file.' };
  if (j.version > 1) return { error: 'That file was made by a newer SiteGen. Update first, then try again.' };
  return {
    name: String(j.name || 'Imported site').slice(0, 80),
    theme: scrub(j.theme), sections: scrub(j.sections), layout: scrub(j.layout),
    seo_title: String(j.seo_title || '').slice(0, 70), seo_description: String(j.seo_description || '').slice(0, 160)
  };
}

// start a copy for a different client: keep the design and wording, drop everything that belongs to the old business
function asTemplate(sections) {
  const s = JSON.parse(JSON.stringify(sections));
  const c = s.contact || {};
  c.phone = ''; c.email = ''; c.address = ''; c.notifyEmail = ''; c.locations = []; c.social = {};
  s.contact = c;
  if (s.meta) { s.meta.gaId = ''; s.meta.metaPixelId = ''; s.meta.reportEmail = ''; s.meta.city = ''; }
  if (s.trust) { s.trust.googleReviewsUrl = ''; s.trust.legalNote = ''; }
  if (s.seo) { s.seo.redirects = []; s.seo.shareImage = ''; }
  if (s.legal) { s.legal.email = ''; s.legal.address = ''; s.legal.ownerName = ''; }
  return s;
}

module.exports = { NAME_RE, list, run, prune, hasToday, pathFor, exportSite, parseSiteFile, asTemplate, scrub };
