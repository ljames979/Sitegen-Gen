// Creates a site from a JSON file, e.g.:
//   node scripts/create-site.js examples/sankara.json [account-email]
// The site is added (unpublished) to the account with that email, or to the
// first account if none is given, and can then be edited like any other site.
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { defaultSections, defaultTheme, defaultLayout } = require('../defaults');

const file = process.argv[2];
const email = (process.argv[3] || '').toLowerCase();
if (!file) { console.error('Usage: node scripts/create-site.js <file.json> [account-email]'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
catch (err) { console.error(`Could not read ${file}: ${err.message}`); process.exit(1); }

const user = email
  ? db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  : db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get();
if (!user) {
  console.error(email ? `No account with the email ${email}.` : 'There are no accounts yet. Start SiteGen, sign up, then run this again.');
  process.exit(1);
}

const defaults = defaultSections();
const sections = { ...defaults };
for (const key of Object.keys(defaults)) {
  const given = data.sections && data.sections[key];
  if (given && typeof given === 'object' && !Array.isArray(given) && typeof defaults[key] === 'object') sections[key] = { ...defaults[key], ...given };
}
const theme = { ...defaultTheme(), ...(data.theme || {}) };
const layout = { ...defaultLayout(), ...(data.layout || {}) };
const name = String(data.name || 'New site').slice(0, 80);

const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
let slug = base;
while (db.prepare('SELECT 1 FROM sites WHERE slug = ?').get(slug)) slug = `${base}-${nanoid(4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;

const info = db.prepare(
  'INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
).run(user.id, slug, name, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), sections.seo.title || '', sections.seo.description || '');
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(info.lastInsertRowid, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'Imported from file');

const port = process.env.PORT || 3000;
console.log(`Created "${name}" for ${user.email}.`);
console.log(`Open it: http://localhost:${port}/sites/${info.lastInsertRowid}/edit`);
