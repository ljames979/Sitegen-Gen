// One-off (Leo, 2026-11-09): put the paw watermarks on the Imperial Pet Group home page.
// Run it once:  node tools/add-imperial-watermarks.js      (then reload the editor; close it first if it is open)
// It first saves the page as it is now as a version named "Before the paw watermarks" (Editor > History puts it back),
// then adds:
//   "Tails Wagging, Coats Gleaming" card       -> Dog paw — card corner
//   "Purr-fectly Pampered" card                -> Cat paw — card corner     (when that card is on the page)
//   "Why Pet Parents Choose Imperial" section  -> Dog paw — section right
//   "Meet the Royal Court" section             -> Cat paw — section left    (when that section is on the page)
// A block or card that already has a watermark is left as it is, so running it again changes nothing.
// Optional: node tools/add-imperial-watermarks.js <site slug>   (default imperial-dog-grooming)
const db = require('../db');
const wm = require('../watermark');

const slug = process.argv[2] || 'imperial-dog-grooming';
const site = db.prepare('SELECT * FROM sites WHERE slug = ?').get(slug);
if (!site) { console.error(`No site with the address "${slug}". Nothing changed.`); process.exit(1); }
const sections = JSON.parse(site.sections || '{}'), theme = JSON.parse(site.theme || '{}'), layout = JSON.parse(site.layout || '{}');
const items = ((sections.blocks || {}).items || []);
const texts = sections.texts = sections.texts || {};
const list = wm.clean(texts.wmarks);

// Where each one goes. A block is found by its heading; the card inside it is named the way the page names it
// (watermark.js / elstyles.js): its overlap card ("div-3" in the Overlap card block), the whole section otherwise.
const WANT = [
  { name: 'Tails Wagging, Coats Gleaming', heading: /^tails wagging, coats gleaming/i, preset: 'dog-card', card: { overlapcard: 'div-3' } },
  { name: 'Purr-fectly Pampered', heading: /^purr-?fectly pampered/i, preset: 'cat-card', card: { overlapcard: 'div-3' } },
  { name: 'Why Pet Parents Choose Imperial', heading: /^why pet parents choose imperial/i, preset: 'dog-section', section: 'section-1' },
  { name: 'Meet the Royal Court', heading: /^meet the royal court/i, preset: 'cat-section', section: 'section-1' }
];
const used = new Set(list.map(t => t.id));
const newId = () => { let id; do { id = 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'); } while (used.has(id) || !/^w[a-z0-9]{7}$/.test(id)); used.add(id); return id; };
const added = [], missing = [], kept = [];
for (const w of WANT) {
  const blk = items.find(b => w.heading.test(String(b.heading || '').trim()));
  if (!blk) { missing.push(w.name); continue; }
  const part = 'b:' + blk.id;
  let el = '';
  if (w.card) { const c = w.card[blk.type]; if (!c) { missing.push(`${blk.heading} (no card in a "${blk.type}" block)`); continue; } el = part + '|' + c; }
  else el = part + '|' + w.section;
  if (list.some(t => t.page === 'home' && t.part === part && t.el === el)) { kept.push(blk.heading); continue; }
  const t = wm.fromPreset(w.preset, { id: newId(), page: 'home', part, el });
  list.push(t); added.push(`${blk.heading}: ${wm.PRESETS.find(p => p.key === w.preset).name}`);
}
if (!added.length) {
  console.log('Nothing to add.' + (kept.length ? ' Already there: ' + kept.join('; ') + '.' : '') + (missing.length ? ' Not on the page: ' + missing.join('; ') + '.' : ''));
  process.exit(0);
}
// keep a copy of the page as it is now
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(site.id, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'Before the paw watermarks');
texts.wmarks = wm.clean(list);
db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), site.id);
console.log(`Added to ${site.name}:\n  ` + added.join('\n  '));
if (kept.length) console.log('Already had one: ' + kept.join('; '));
if (missing.length) console.log('Not on the page yet (add the watermark from the editor once it is): ' + missing.join('; '));
console.log('Reload the editor to see them.');
