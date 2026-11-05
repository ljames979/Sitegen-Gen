const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contrast = require('../contrast');
const at = require('../atelier');
const themes = require('../themes');

const DIR = path.join(__dirname, '../atelier/pieces');
const site = (o = {}, theme = {}) => ({ name: 'Ridge Roofing', slug: 'ridge', theme: { style: 'at-undertow', ...theme }, layout: { hidden: [] }, sections: Object.assign({ meta: { businessType: 'Roofing contractor', city: 'Orlando, FL' }, hero: { headline: 'Roofs that last', subheadline: '', ctaText: 'Get a quote', imageUrl: '' }, about: { heading: 'About', body: '', imageUrl: '' }, services: { heading: 'Services', items: [] }, whyChoose: { items: [] }, testimonials: { items: [] }, faq: { items: [] }, gallery: { images: [] }, contact: { phone: '', email: '' }, trust: { stats: [], serviceAreas: [], badges: [] }, hours: { items: [] }, booking: { services: [] } }, o) });
const ctxOf = (s, extra = {}) => ({ site: s, basePath: '/site/ridge', services: (s.sections.services.items || []).map((x, i) => ({ ...x, slug: 's' + i })), areas: [], navPages: [], visible: () => true, ...extra });
const full = () => site({
  services: { heading: 'What we do', items: [{ title: 'Roof repair', description: 'Leaks fixed.', price: 'From $350' }, { title: 'Roof replacement', description: 'New roofs.', price: 'From $9,500' }, { title: 'Inspections', description: 'Photo report.' }] },
  testimonials: { items: [{ quote: 'They found the leak.', author: 'Maria G.', rating: 5 }, { quote: 'Great crew.', author: 'Tom', rating: 5 }, { quote: 'Tidy.', author: 'Ann', rating: 4 }] },
  faq: { items: [{ question: 'Free estimates?', answer: 'Yes, written.' }] },
  about: { heading: 'About us', body: 'Family owned since 1999.', imageUrl: '' },
  trust: { stats: [{ value: '25', label: 'Years' }, { value: '900+', label: 'Roofs' }], serviceAreas: ['Orlando', 'Kissimmee'], badges: ['Licensed', 'Insured'] },
  contact: { phone: '407-555-0100', email: 'a@b.test', acceptSubmissions: true }
});

// Names, places, prices and phrases from the reference file's sample businesses
const SAMPLES = ['Second Light', 'Wildling', 'Ember & Bean', 'Southpaw', 'Orange Hollow', 'Little Molars', 'Clear Day', 'Black Lantern', 'Side B', 'SIDE B', 'Storm Ready', 'STORM', 'Proof Bakehouse', 'Halo Fine', 'Splash Lane', 'Cypress Stars', 'Kerning', 'Blue Lagoon', 'Truline', 'TRU', 'Escapement', 'Fresh Coat', 'Little Prism', 'Coquina', 'Wanderly',
  'KISSIMMEE', 'LISBON', 'KYOTO', 'TROPICAL STORM', '555-01', '$19.99', '$85', 'Huila', 'Batch 1187', 'FC-112', '100% cotton', 'OPEN LATE', '28°17', 'New Smyrna', 'Winter Park', 'Celebration'];

test('atelier: 22 pieces, each with its stylesheet, artwork and hero, and a SiteGen theme', () => {
  assert.equal(at.PIECES.length, 22);
  assert.equal(new Set(at.PIECES.map(p => p.id)).size, 22);
  for (const p of at.PIECES) {
    for (const ext of ['css', 'js', 'html']) assert.ok(fs.existsSync(path.join(DIR, `${p.id}.${ext}`)), `${p.id}.${ext}`);
    const t = themes.byId['at-' + p.id];
    assert.ok(t && t.atelier && t.home === 'atelier', p.id);
    assert.ok(t.heading.param && t.body.param && at.GF[p.id] && at.GRAD[p.id], p.id + ' fonts and card art');
    assert.ok(themes.STYLE_HINTS['at-' + p.id].startsWith('Signature (premium).'));
    assert.doesNotThrow(() => new Function('return (' + fs.readFileSync(path.join(DIR, p.id + '.js'), 'utf8') + ')'), p.id + ' artwork parses');
  }
  assert.equal(themes.ATELIER_IDS.length, 22);
  assert.ok(themes.ALL_STYLES.includes('at-flap'));
  assert.ok(at.isAtelier('at-bloom') && !at.isAtelier('bloom') && !at.isAtelier('at-nope') && !at.isAtelier('sl-polar'));
});

test('atelier: no sample business, place, price or claim from the reference file is left in a piece', () => {
  for (const p of at.PIECES) for (const ext of ['js', 'html']) {
    const src = fs.readFileSync(path.join(DIR, `${p.id}.${ext}`), 'utf8');
    for (const s of SAMPLES) assert.ok(!src.includes(s), `${p.id}.${ext} still has "${s}"`);
  }
  for (const p of at.PIECES) assert.doesNotMatch(p.look, /\$\d|555|sample/i, p.id);
});

test('atelier: every stylesheet stays inside its piece and loads nothing from outside', () => {
  for (const p of at.PIECES) {
    const css = fs.readFileSync(path.join(DIR, p.id + '.css'), 'utf8').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
    assert.doesNotMatch(css, /@import|url\(\s*["']?https?:/i, p.id);
    for (const rule of css.replace(/@media[^{]+\{/g, '').replace(/@container[^{]+\{/g, '').split('}')) {
      const sel = rule.split('{')[0].trim();
      if (!sel || !rule.includes('{')) continue;
      for (const one of sel.split(/,(?![^()]*\))/)) assert.ok(/^\.(p-|[a-z]{1,2}-)|^:where\(\.p-|^\.stage\b/.test(one.trim()), `${p.id}: ${one.trim()}`);
    }
  }
});

test('atelier: colors stay readable, and the closing band carries white text', () => {
  for (const p of at.PIECES) {
    const c = at.colors(p);
    assert.ok(contrast.ratio(c.text, c.bg) >= 4.5, p.id + ' text');
    assert.ok(contrast.ratio(c.text, c.surface) >= 4.5, p.id + ' text on cards');
    assert.ok(contrast.ratio(c.muted, c.bg) >= 4.5, p.id + ' muted text');
    assert.ok(contrast.ratio(c.muted, c.surface) >= 4.5, p.id + ' muted text on cards');
    assert.ok(contrast.ratio(c.accentInk, c.bg) >= 4.5, p.id + ' accent as text');
    assert.ok(contrast.ratio('#ffffff', at.themeEntry(p).palette.accent) >= 4.5, p.id + ' band');
  }
});

test('atelier: a bare site shows only the artwork hero, with nothing invented', () => {
  for (const p of at.PIECES) {
    const r = at.render(ctxOf(site({}, { style: 'at-' + p.id })));
    assert.deepEqual(r.sections, ['hero'], p.id + ': ' + r.sections);
    assert.match(r.html, /Roofs <em>that last<\/em>|Roofs that last|ROOFS/, p.id + ' headline');
    assert.doesNotMatch(r.html.replace(/<script>[\s\S]*?<\/script>/g, ''), /undefined|\{\{[A-Z]+\}\}|\$\d/, p.id);
    assert.match(r.html, new RegExp(`<script>\\(function\\(\\)\\{var root=document.querySelector\\('.sg-atelier .p-${p.id}'\\)`), p.id + ' artwork starts');
  }
  assert.deepEqual(at.render(ctxOf(site({}, { style: 'modern' }))).sections, []);
});

test('atelier: real content fills the sections, the board and the panels', () => {
  for (const p of at.PIECES) {
    const s = full(); s.theme.style = 'at-' + p.id;
    const r = at.render(ctxOf(s, { still: true }));
    assert.deepEqual(r.sections, ['hero', 'services', 'about', 'stats', 'reviews', 'faq', 'cta'], p.id);
    assert.match(r.html, /Maria G\./); assert.match(r.html, /Free estimates\?/); assert.match(r.html, /From \$9,500/);
    assert.match(r.html, /data-still/); assert.match(r.html, /still=true/);
  }
  const flap = at.render(ctxOf((() => { const s = full(); s.theme.style = 'at-flap'; return s; })()));
  assert.match(flap.html, /"sets":\[\[\["ROOF REPAIR","FROM \$350"\],\["ROOF REPLACEMENT","FROM \$9,500"\],\["INSPECTIONS",""\]\]\]/);
  const thermal = at.render(ctxOf((() => { const s = full(); s.theme.style = 'at-thermal'; return s; })()));
  assert.match(thermal.html, /<div class="r-row"><span>Roof repair<\/span><b>From \$350<\/b><\/div>/);
  const radar = at.render(ctxOf((() => { const s = full(); s.theme.style = 'at-radar'; return s; })(), { areas: [{ name: 'Sanford' }] }));
  assert.match(radar.html, /"places":\["Orlando","Sanford"\]/);
  const ink = at.render(ctxOf((() => { const s = full(); s.theme.style = 'at-ink'; return s; })()));
  assert.match(ink.html, /<div class="n-mark" role="heading" aria-level="1" style="font-size:min\(12\.2cqw, [\d.]+cqw\)">Ridge Roofing<\/div>/);
  assert.equal(at.flapText('Roof & gutter repair (residential)', 16), 'ROOF AND GUTTER');
  assert.match(flap.html, /"wid":\[16,11\]/);
  const unpriced = full(); unpriced.theme.style = 'at-flap'; unpriced.sections.services.items.forEach(x => { delete x.price; });
  const plain = at.render(ctxOf(unpriced)).html;
  assert.match(plain, /"wid":\[18\]/); assert.doesNotMatch(plain, />PRICE</);
});

test('atelier: each piece is the default for its own industry, and other businesses get none', () => {
  for (const p of at.PIECES) assert.equal(at.forBusiness(p.kind), 'at-' + p.id, p.kind);
  for (const [bt, id] of [['Surf lessons', 'undertow'], ['Wedding venue', 'firefly'], ['Pediatric dentist', 'papercut'], ['Custom pool builder', 'lagoon'], ['Sourdough bakery', 'dough'], ['Tattoo parlor', 'ink']]) assert.equal(at.forBusiness(bt), 'at-' + id, bt);
  for (const bt of ['roofer', 'plumber', 'law firm', '']) assert.equal(at.forBusiness(bt), null, bt);
});

test('atelier: the Signature home layout only applies to Signature pieces', () => {
  assert.equal(themes.homeLayoutOf({ style: 'at-bloom' }), 'atelier');
  assert.equal(themes.homeLayoutOf({ style: 'at-bloom', homeLayout: 'full' }), 'full');
  assert.notEqual(themes.homeLayoutOf({ style: 'modern', homeLayout: 'atelier' }), 'atelier');
});
