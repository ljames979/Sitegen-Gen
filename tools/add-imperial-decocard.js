// One-off (Leo, 2026-11-09): add the Decorative card to the Imperial Pet Grooming home page, right under the hero.
// Run it once with SiteGen open or closed:  node tools/add-imperial-decocard.js
// It first saves the page as it is now as a version named "Before the Decorative card" (Editor > History puts it
// back), then adds the card. Running it again does nothing once the card is there.
// Optional: node tools/add-imperial-decocard.js <site slug>   (default imperial-dog-grooming)
const db = require('../db');
const decoCard = require('../decocard');

const slug = process.argv[2] || 'imperial-dog-grooming';
const site = db.prepare('SELECT * FROM sites WHERE slug = ?').get(slug);
if (!site) { console.error(`No site with the address "${slug}". Nothing changed.`); process.exit(1); }
const sections = JSON.parse(site.sections || '{}'), theme = JSON.parse(site.theme || '{}'), layout = JSON.parse(site.layout || '{}');
sections.blocks = sections.blocks || {}; sections.blocks.items = sections.blocks.items || [];
const items = sections.blocks.items;
if (items.some(b => b.type === 'decocard')) { console.log(`${site.name} already has a Decorative card. Nothing changed.`); process.exit(0); }

const body = decoCard.cleanBody([
  'style: royal', 'icon: crown',
  'eyebrow: By Royal Appointment',
  'tagline: Purveyors of Fine Dog & Cat Grooming',
  'text: At Imperial Pet Group, every dog and cat who walks through our doors gets the royal treatment. Our experienced groomers combine gentle handling with professional skill, so your pet leaves looking great and feeling even better.',
  'quote: Because to you, they\'re not just a pet. They\'re family.',
  'detail: [ADDRESS]', 'detail: [PHONE]', 'detail: [HOURS]',
  'border: #b8923a', 'card: #ffffff', 'btnc: #b8326a',
  'sec: glow', 'sec1: #fdeef4', 'sec2: #c9e4f5'
].join('\n'));
const used = new Set(items.map(b => b.id));
let id; do { id = 'b' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'); } while (used.has(id) || !/^b[a-z0-9]{7}$/.test(id));
const block = { id, type: 'decocard', heading: 'Welcome to Imperial Pet Group', body, imageUrl: '', buttonText: 'Book Your Visit', buttonUrl: '#book',
  side: 'auto', bg: 'none', bgmix: '', bgink: '', gx: '', cardbg: '', cardgx: '', edge: 'none', place: 'bottom', page: 'home', pin: '', film: '', imgfx: '', height: '' };

// keep a copy of the page as it is now
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(site.id, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'Before the Decorative card');

items.push(block);
layout.items = (layout.items || []).concat('blk:' + id);
// on a Blocks (mix) home page the card goes right after the first section (the hero); otherwise it is added at
// the top of the lower blocks and shows after the hero
if (Array.isArray(theme.mix) && theme.mix.length) theme.mix.splice(1, 0, { k: 'blk', f: 'own', v: id });
else block.place = 'top';
db.prepare("UPDATE sites SET theme = ?, sections = ?, layout = ?, updated_at = datetime('now') WHERE id = ?")
  .run(JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), site.id);
console.log(`Added the Decorative card (block ${id}) to ${site.name}, under the hero. Reload the editor to see it.`);
