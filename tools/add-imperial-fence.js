// One-off (Leo, 2026-11-10): put the Scene decor picket fence on the Imperial Pet Group royalty banner.
// Only needed if you already ran tools/create-imperial-pet-group.js before the fence was built (a site made by that
// script now already has it).
// Run it once:  node tools/add-imperial-fence.js      (then reload the editor; close it first if it is open)
// It first saves the page as it is now as a version named "Before the picket fence" (Editor > History puts it back),
// then on the "Every Pet Is Royalty Here" block:
//   adds a Glass Blue picket fence along its bottom, 190px tall (130px on phones)
//   takes away the "[SCENE DECOR: ...]" placeholder text box
//   moves the dog-and-cat cut-out down so it stands in front of the fence
// Change it later on the Blocks page: the block's Effects > Scene decor.
// Optional: node tools/add-imperial-fence.js <site slug>   (default imperial-pet-group)
const db = require('../db');
const mixPage = require('../mixpage');
const picBoxes = require('../picboxes');
const textBoxes = require('../textboxes');

const slug = process.argv[2] || 'imperial-pet-group';
const site = db.prepare('SELECT * FROM sites WHERE slug = ?').get(slug);
if (!site) { console.error(`No site with the address "${slug}". Nothing changed. (To make the site, run: node tools/create-imperial-pet-group.js)`); process.exit(1); }
const sections = JSON.parse(site.sections || '{}'), theme = JSON.parse(site.theme || '{}'), layout = JSON.parse(site.layout || '{}');
const items = ((sections.blocks || {}).items || []);
const blk = items.find(b => /^every pet is royalty/i.test(String(b.heading || '').trim()));
if (!blk) { console.error('No "Every Pet Is Royalty Here" block on this site. Nothing changed.'); process.exit(1); }
const mix = Array.isArray(theme.mix) ? theme.mix : [];
const it = mix.find(m => m && m.k === 'blk' && m.v === blk.id);
if (!it) { console.error('That block is not on the Blocks home page. Nothing changed.'); process.exit(1); }
if (it.scene) { console.log(`"${blk.heading}" already has scene decor (${it.scene}). Nothing changed.`); process.exit(0); }

// keep a copy of the page as it is now
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(site.id, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'Before the picket fence');

it.scene = 'fence:glassblue:l';
theme.mix = mixPage.clean(mix);
const texts = sections.texts = sections.texts || {};
const at = 'b:' + blk.id;
const before = (texts.items || []).length;
texts.items = textBoxes.clean((texts.items || []).filter(t => !(t && t.at === at && /^\[SCENE DECOR/i.test(String(t.text || '')))));
texts.pics = picBoxes.clean((texts.pics || []).map(p => (p && p.at === at && !p.art && p.x < 20 && p.y >= 40 ? { ...p, y: 50, h: 46 } : p)));
db.prepare("UPDATE sites SET theme = ?, sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(theme), JSON.stringify(sections), site.id);
console.log(`"${blk.heading}" on ${site.name} now has a Glass Blue picket fence along its bottom.`
  + (before > texts.items.length ? ' The placeholder text is gone.' : ''));
console.log('Reload the editor. Change it on the Blocks page: the block\'s Effects > Scene decor.');
