// Smarter automatic generator (autosite.js): industry detection, logo colors -> our palettes, new blocks per industry
const test = require('node:test');
const assert = require('node:assert');
const auto = require('../autosite');
const { TEMPLATES, GENERIC_TEMPLATE, findTemplate } = require('../templates');
const mixPage = require('../mixpage');
const aboutBlocks = require('../aboutblocks');

test('detect: finds the industry from everyday words, whole words only', () => {
  const cases = { 'dog groomer': 'pet-grooming', 'mobile pet grooming': 'mobile-grooming', 'roofing contractor': 'roofing', 'painting contractor': 'painting',
    'handyman': 'contractor', 'pizza place': 'restaurant', 'auto body shop': 'auto-repair', 'coding for kids': 'tutoring', 'DJ services': 'wedding',
    'med spa': 'spa', 'café de paris': 'coffee-shop', 'attorney': 'law', 'HVAC tech': 'hvac', 'barbershop': 'barber' };
  for (const [t, id] of Object.entries(cases)) assert.equal(auto.detect(t).id, id, t);
  // "spa" is not in "space", "tax" not in "taxi", "vet" not in "velvet", "paint" not in "paintball"
  for (const t of ['office space rental', 'taxi service', 'velvet boutique', 'paintball park']) assert.equal(auto.detect(t).id, 'generic', t);
  // the name and the extra details help when the type is vague
  assert.equal(auto.detect({ type: 'family business', name: 'Happy Paws Dog Grooming' }).id, 'pet-grooming');
  assert.equal(auto.detect({ type: 'small business', more: 'we fix leaks and water heaters' }).id, 'plumbing');
  assert.equal(auto.detect({ type: 'small business', more: 'we fix leaks' }).sure, false, 'found only from the details');
  // every template keyword still finds the same industry as before
  for (const t of TEMPLATES) for (const k of t.keywords) assert.equal(auto.detect(k).id, findTemplate(k).id, k);
});

test('aiDetect: only ever one of our industries', async () => {
  assert.equal((await auto.aiDetect(async () => 'veterinary', 'animal friend')).id, 'veterinary');
  assert.equal(await auto.aiDetect(async () => 'rocket-science', 'x'), null);
  assert.equal(await auto.aiDetect(async () => { throw new Error('down'); }, 'x'), null);
  assert.equal(await auto.aiDetect(null, 'x'), null);
});

test('matchPalette: the logo colors land on the closest palette we already have', () => {
  const ids = new Set(auto.PALETTES.map(p => p.id));
  const m = auto.matchPalette(['#e11d48'], 'salon');
  assert.ok(ids.has(m.palette.id) && auto.deltaE(m.palette.primary, '#e11d48') < 10, m.palette.name);
  // the Color Hunt palettes are in the list the logo is matched against
  assert.ok(auto.PALETTES.filter(p => /^ch-/.test(p.id)).length >= 18);
  assert.equal(auto.matchPalette(['#8e1ea2', '#98e8de'], 'tattoo').palette.id, 'ch-plum-mint');
  assert.equal(auto.matchPalette(['#425b9a', '#ff95a5'], 'daycare').palette.id, 'ch-denim-coral');
  assert.ok(auto.PALETTES.filter(p => /^cr-/.test(p.id)).length >= 22);
  assert.ok(auto.PALETTES.filter(p => /^cb-/.test(p.id)).length >= 25);
  assert.equal(new Set(auto.PALETTES.map(p => p.id)).size, auto.PALETTES.length, 'no duplicate ids');
  assert.equal(auto.matchPalette(['#800020', '#f3e6d5'], 'law').palette.id, 'cr-burgundy-cream');
  assert.equal(auto.matchPalette(['#0ea5e9'], 'plumbing').palette.id, 'trade-blue');
  assert.equal(auto.matchPalette(['#22c55e', '#14532d'], 'landscaping').palette.id, 'green-grow');
  assert.equal(auto.matchPalette(['#111111', '#888888'], 'law').palette.id, 'mono', 'grey logo -> black and white');
  // a navy logo matches a palette with a navy accent
  assert.match(auto.matchPalette(['#1b2a4a'], 'law').palette.accent, /^#(0f1f45|14213d)$/);
  // the industry's own palette wins a near tie
  const a = auto.matchPalette(['#c2410c'], 'pet-grooming'), b = auto.matchPalette(['#c2410c'], 'roofing');
  assert.equal(a.palette.id, 'pet-warm'); assert.equal(b.palette.id, 'trade-orange');
  assert.equal(m.others.length, 3); assert.ok(!m.others.some(o => o.id === m.palette.id));
  assert.equal(m.exact.id, 'logo');
  assert.equal(auto.matchPalette([], 'law'), null);
  assert.equal(auto.matchPalette(['not a color'], 'law'), null);
});

test('logoColors: reads a real image (sharp)', async (t) => {
  let sharp; try { sharp = require('sharp'); } catch { return t.skip('no sharp'); }
  const png = await sharp({ create: { width: 60, height: 60, channels: 4, background: { r: 225, g: 29, b: 72, alpha: 1 } } }).png().toBuffer();
  const c = await auto.logoColors(png, sharp);
  assert.ok(c.length >= 1); assert.ok(auto.deltaE(c[0], '#e11d48') < 5, c[0]);
  assert.deepEqual(await auto.logoColors(Buffer.from('nope'), sharp), []);
});

function site(industry, extra) {
  const tpl = TEMPLATES.find(x => x.id === industry) || GENERIC_TEMPLATE;
  return { name: 'Test Co', theme: { primaryColor: '#0369a1', accentColor: '#0c2a43', homeLayout: 'full' }, sections: {
    hero: { ctaText: 'Get a Quote' }, about: { body: 'We started in our garage. We care about doing it right. Call us any time.' },
    services: { items: tpl.services.slice() }, contact: { phone: '407-555-0100', social: {} }, trust: { stats: [], badges: [], serviceAreas: [] },
    meta: { city: 'Orlando' }, gallery: { images: [] }, blocks: { items: (tpl.blocks || []).map(b => ({ ...b })) }, ...(extra || {}) } };
}

test('plan: industry blocks filled from the site, laid out as a Blocks home page', () => {
  const gallery = ['https://img.example/1.jpg', 'https://img.example/2.jpg', 'https://img.example/3.jpg', 'https://img.example/4.jpg'];
  for (const id of ['pet-grooming', 'plumbing', 'salon', 'restaurant', 'law', 'daycare', 'wedding', 'generic']) {
    const s = site(id);
    const p = auto.plan(s, { industryId: id, label: 'Label', gallery });
    assert.ok(p.blocks.length >= 2, id);
    const types = p.blocks.map(b => b.type);
    assert.deepEqual(types.filter(t => auto.PICKS[auto.groupOf(id)].includes(t) || t === 'aboutstory').length, types.length, id + ' ' + types);
    // every block has an id, is on the home page, and is in the Mix list exactly once
    for (const b of s.sections.blocks.items) assert.match(b.id, /^b[a-z0-9]{7}$/);
    for (const b of p.blocks) assert.equal(p.mix.filter(m => m.k === 'blk' && m.v === b.id).length, 1, id);
    assert.equal(p.mix[0].f, 'hero');
    assert.equal(p.mix[p.mix.length - 1].v, p.blocks[p.blocks.length - 1].id, 'the contact block closes the page');
    assert.ok(!p.mix.some(m => m.f === 'about'), 'the new About block takes the About spot');
    assert.deepEqual(mixPage.clean(p.mix), p.mix);
    // words come from the site only
    const all = s.sections.blocks.items.map(b => b.heading + '\n' + b.body).join('\n');
    assert.doesNotMatch(all, /undefined|null|\{name\}/);
    // bodies are already in the block's own clean form
    for (const b of s.sections.blocks.items.filter(x => aboutBlocks.SPECS[x.type])) assert.equal(aboutBlocks.cleanBody(b.type, b.body), b.body);
  }
});

test('plan: nothing made up, social only with links, Signature home kept', () => {
  // trades: facts only from what the client gave; none -> the story block instead
  const s1 = site('plumbing'); auto.plan(s1, { industryId: 'plumbing' });
  assert.ok(!s1.sections.blocks.items.some(b => b.type === 'aboutfacts'));
  const s2 = site('plumbing'); s2.sections.trust = { stats: [{ value: '12', label: 'Years in business' }], badges: ['Licensed & Insured'], serviceAreas: ['Orlando', 'Kissimmee'] };
  auto.plan(s2, { industryId: 'plumbing' });
  const facts = s2.sections.blocks.items.find(b => b.type === 'aboutfacts');
  assert.match(facts.body, /fact: 12 years in business/); assert.match(facts.body, /fact: Licensed & Insured/); assert.match(facts.body, /fact: Serving Orlando, Kissimmee/);
  // no about text -> no about block
  const s3 = site('salon'); s3.sections.about.body = ''; const p3 = auto.plan(s3, { industryId: 'law' });
  assert.ok(!p3.blocks.some(b => b.type === 'offsetphoto'));
  // social blocks only with a link
  assert.ok(!auto.plan(site('salon'), { industryId: 'salon' }).blocks.some(b => /^social/.test(b.type)));
  const s4 = site('salon'); s4.sections.contact.social = { instagram: 'https://instagram.com/test.co' };
  const p4 = auto.plan(s4, { industryId: 'salon', gallery: ['https://a.example/1.jpg', 'https://a.example/2.jpg', 'https://a.example/3.jpg'] });
  const feed = s4.sections.blocks.items.find(b => b.type === 'socialfeed');
  assert.ok(feed && /handle: @test\.co/.test(feed.body), p4.blocks.map(b => b.type).join());
  const s5 = site('plumbing'); s5.sections.contact.social = { facebook: 'https://facebook.com/x' };
  assert.ok(auto.plan(s5, { industryId: 'plumbing' }).blocks.some(b => b.type === 'socialphoto'));
  // Signature (Atelier) and Style Library home pages stay as they are
  const s6 = site('bakery'); s6.theme.homeLayout = 'atelier';
  assert.equal(auto.plan(s6, { industryId: 'bakery' }).mix, null);
});

test('recolor: the added blocks follow a new palette, other blocks are untouched', () => {
  const s = site('pet-grooming'); const from = { primary: '#0369a1', accent: '#0c2a43' }, to = { primary: '#be185d', accent: '#4a1d33' };
  const other = { id: 'bzzzzzzz', type: 'split', heading: 'x', body: 'color: #0369a1' }; s.sections.blocks.items.push(other);
  const p = auto.plan(s, { industryId: 'pet-grooming', colors: from });
  auto.recolor(s.sections.blocks.items, p.blocks.map(b => b.id), from, to);
  const added = s.sections.blocks.items.filter(b => p.blocks.some(x => x.id === b.id)).map(b => b.body).join('\n');
  assert.doesNotMatch(added, /#0369a1|#0c2a43/i); assert.match(added, /#be185d/);
  assert.equal(other.body, 'color: #0369a1');
});
