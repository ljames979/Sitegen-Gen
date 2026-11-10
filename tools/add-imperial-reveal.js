// One-off (Leo, 2026-11-10): turn the Imperial Pet Group welcome card into the Invitation Reveal envelope.
// Only needed if you already ran tools/create-imperial-pet-group.js before the envelope was built (a site made by
// that script now already has it).
// Run it once:  node tools/add-imperial-reveal.js      (then reload the editor; close it first if it is open)
// It first saves the page as it is now as a version named "Before the Invitation Reveal" (Editor > History puts it
// back), then on the "Welcome to Imperial Pet Group" Decorative card:
//   turns on the envelope (pink #F2A9C6, flap #E57FAA, deep pink wax seal with a crown)
//   adds the faint pink crown wallpaper (55%) and the blush ledge along the bottom
//   moves the two peeking-pet rows on that card so they peek over the ledge
// A card that already has the envelope is left as it is, so running it again changes nothing.
// Optional: node tools/add-imperial-reveal.js <site slug>   (default imperial-pet-group)
const db = require('../db');
const decoCard = require('../decocard');
const picBoxes = require('../picboxes');

const slug = process.argv[2] || 'imperial-pet-group';
const site = db.prepare('SELECT * FROM sites WHERE slug = ?').get(slug);
if (!site) { console.error(`No site with the address "${slug}". Nothing changed. (To make the site, run: node tools/create-imperial-pet-group.js)`); process.exit(1); }
const sections = JSON.parse(site.sections || '{}'), theme = JSON.parse(site.theme || '{}'), layout = JSON.parse(site.layout || '{}');
const items = ((sections.blocks || {}).items || []);
const blk = items.find(b => b.type === 'decocard' && /^welcome to imperial/i.test(String(b.heading || '').trim())) || items.find(b => b.type === 'decocard');
if (!blk) { console.error('No Decorative card on this site. Nothing changed.'); process.exit(1); }
const now = decoCard.parse(blk.body);
if (now.reveal) { console.log(`"${blk.heading}" already opens from an envelope. Nothing changed.`); process.exit(0); }

// keep a copy of the page as it is now
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(site.id, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'Before the Invitation Reveal');

const add = ['reveal: envelope', 'env: #f2a9c6', 'flap: #e57faa', 'seal: #d9578f', 'liner: #fdeef4'];
if (!now.pat) add.push('pat: crowns', 'patc: #f2a9c6', 'patop: 55');
if (!now.ledge) add.push('ledge: #fbd9e7');
blk.body = decoCard.cleanBody(String(blk.body || '') + '\n' + add.join('\n'));

// the peeking pets on this card: just above the ledge
const texts = sections.texts = sections.texts || {};
let moved = 0;
texts.pics = picBoxes.clean((texts.pics || []).map(p => {
  if (p && p.at === 'b:' + blk.id && p.art === 'peek') { moved++; return { ...p, y: 77, h: 18 }; }
  return p;
}));
db.prepare("UPDATE sites SET sections = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(sections), site.id);
console.log(`"${blk.heading}" on ${site.name} now opens from a pink envelope, on a crown wallpaper with a blush ledge.`
  + (moved ? ` Moved ${moved} peeking-pet row${moved > 1 ? 's' : ''} onto the ledge.` : ''));
console.log('Reload the editor. The preview shows the card open; open the live site and scroll to watch the envelope.');
