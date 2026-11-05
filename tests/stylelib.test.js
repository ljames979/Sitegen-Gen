const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contrast = require('../contrast');
const lib = require('../stylelib');
const page = require('../stylelib-page');
const themes = require('../themes');

const tok = (str) => Object.fromEntries(str.split(';').filter(Boolean).map(x => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; }));
const site = (o = {}, theme = {}) => ({ name: 'Test Co', slug: 'test-co', theme: { style: 'sl-meridian', ...theme }, layout: { hidden: [] }, sections: Object.assign({ meta: { businessType: 'Roofing contractor', city: 'Orlando, FL' }, hero: { headline: 'Roofs that last', subheadline: '', ctaText: 'Get a quote', imageUrl: '' }, about: { heading: 'About', body: '', imageUrl: '' }, services: { heading: 'Services', items: [] }, whyChoose: { items: [] }, testimonials: { items: [] }, faq: { items: [] }, gallery: { images: [] }, contact: { phone: '', email: '' }, trust: { stats: [], serviceAreas: [], badges: [] }, hours: { items: [] }, booking: { services: [] } }, o) });
const ctxOf = (s, extra = {}) => ({ site: s, basePath: '/site/test-co', services: (s.sections.services.items || []).map((x, i) => ({ ...x, slug: 's' + i })), areas: [], navPages: [], visible: k => !s.layout.hidden.includes(k), ...extra });

test('style library: 44 styles on 8 blueprints, each a SiteGen theme with a hint', () => {
  assert.equal(lib.STYLES.length, 44);
  assert.deepEqual(lib.BLUEPRINT_IDS, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.equal(new Set(lib.STYLES.map(s => s.id)).size, 44, 'ids are unique');
  for (const st of lib.STYLES) {
    assert.ok(lib.BLUEPRINTS[st.bp], st.id + ' blueprint');
    const t = themes.byId['sl-' + st.id];
    assert.ok(t && t.lib && t.home === 'stylelib', st.id + ' is a theme');
    assert.ok(t.label.length <= st.name.length + 48, st.id + ' label is short: ' + t.label);
    assert.ok(lib.HINTS['sl-' + st.id] && themes.STYLE_HINTS['sl-' + st.id], st.id + ' hint');
    assert.ok(t.heading.param, st.id + ' fonts');
    assert.match(t.palette.primary, /^#[0-9a-f]{6}$/i);
  }
  assert.ok(themes.ALL_STYLES.includes('sl-graphite'));
  assert.ok(lib.isLib('sl-polar') && !lib.isLib('modern') && !lib.isLib('sl-nope'));
});

test('style library: descriptions never promise sample content the client does not have', () => {
  for (const st of lib.STYLES) assert.doesNotMatch(st.look, /live chart|client logos|wait[- ]time|555|testimonial from/i, st.id);
});

test('style library: text colors stay readable with any brand color, light or dark style', () => {
  const brands = ['', '#facc15', '#ffffff', '#111111', '#0ea5e9', '#ef4444', '#a3e635', '#7c3aed'];
  for (const st of lib.STYLES) for (const primaryColor of brands) {
    const t = tok(lib.tokens(st, { primaryColor }));
    assert.ok(contrast.ratio(t['--t-text'], t['--t-bg']) >= 4.5, `${st.id} ${primaryColor} body text`);
    assert.ok(contrast.ratio(t['--t-accent-ink'], t['--t-bg']) >= 4.5, `${st.id} ${primaryColor} accent used as text`);
    assert.ok(contrast.ratio(t['--t-accent2-ink'], t['--t-bg']) >= 3, `${st.id} ${primaryColor} second accent as large text`);
    const on = contrast.ratio(t['--t-on'], t['--t-accent']); assert.ok(on >= 4.5 || on >= contrast.ratio(contrast.textOn(t['--t-accent']), t['--t-accent']), `${st.id} ${primaryColor} button label reads`);
    if (primaryColor) assert.equal(t['--t-accent'].toLowerCase(), primaryColor, 'the brand color replaces the accent');
  }
  for (const st of lib.STYLES) {
    const p = lib.palette(st);
    assert.ok(contrast.ratio('#ffffff', p.accent) >= 4.5, st.id + ' palette accent carries white text in the closing band');
  }
});

test('style library: the owner can pick another blueprint; bad values fall back', () => {
  const st = lib.get('meridian');
  assert.equal(lib.blueprintOf(st, {}), st.bp);
  assert.equal(lib.blueprintOf(st, { slBlueprint: 'H' }), 'H');
  assert.equal(lib.blueprintOf(st, { slBlueprint: 'Z' }), st.bp);
  assert.ok(lib.forBusiness('Roofing contractor').length >= 1);
  assert.deepEqual(lib.forBusiness(''), []);
});

test('style library: home layout only applies to library styles', () => {
  assert.equal(themes.homeLayoutOf({ style: 'sl-polar' }), 'stylelib');
  assert.equal(themes.homeLayoutOf({ style: 'sl-polar', homeLayout: 'full' }), 'full');
  assert.notEqual(themes.homeLayoutOf({ style: 'modern', homeLayout: 'stylelib' }), 'stylelib');
});

test('style library: emphasis follows [brackets], then a short last phrase', () => {
  assert.equal(page.emphasize('Roofs that hold up to [Florida storms].'), 'Roofs that hold up to <span class="t-em">Florida storms</span>.');
  assert.equal(page.emphasize('Fast, friendly plumbing'), 'Fast, <span class="t-em">friendly plumbing</span>');
  assert.match(page.emphasize('<b>x</b> & co'), /&lt;b&gt;/, 'escaped');
});

test('style library: a bare site shows only its hero, with nothing invented', () => {
  for (const bp of lib.BLUEPRINT_IDS) {
    const r = page.render(ctxOf(site({}, { slBlueprint: bp })));
    assert.deepEqual(r.sections, ['hero'], bp + ': ' + r.sections);
    assert.equal(r.blueprint, bp);
    assert.doesNotMatch(r.html, /555-|\$\d|★|Lorem|Jane|John/, bp + ' no sample content');
    assert.match(r.html, /Roofs <span class="t-em">that last<\/span>/);
  }
  assert.deepEqual(page.render(ctxOf(site({}, { style: 'modern' }))).sections, [], 'not a library style');
  assert.equal(page.ratingOf({ items: [{ rating: 5 }, { rating: 5 }] }), null, 'two reviews are not a rating');
});

test('style library: real content fills the blueprint sections', () => {
  const s = site({
    services: { heading: 'What we do', items: [{ title: 'Roof repair', description: 'Leaks fixed.', price: 'From $350' }, { title: 'Replacement', description: 'New roofs.', price: 'From $9,500' }, { title: 'Inspections', description: 'Photo report.' }] },
    testimonials: { items: [{ quote: 'They found the leak.', author: 'Maria G.', rating: 5 }, { quote: 'Great.', author: 'Tom', rating: 5 }, { quote: 'Tidy.', author: 'Ann', rating: 4 }] },
    faq: { items: [{ question: 'Free estimates?', answer: 'Yes.' }, { question: 'Insurance?', answer: 'We help.' }] },
    trust: { stats: [{ value: '25', label: 'Years' }, { value: '900+', label: 'Roofs' }, { value: 'A+', label: 'BBB' }], serviceAreas: ['Orlando', 'Kissimmee', 'Sanford'], badges: [] },
    contact: { phone: '407-555-0100', email: 'a@b.test', acceptSubmissions: true }
  }, { slBlueprint: 'C' });
  const r = page.render(ctxOf(s));
  assert.deepEqual(r.sections, ['hero', 'stats', 'features', 'quote', 'faq', 'cta']);
  assert.match(r.html, /Maria G\./); assert.match(r.html, /Free estimates\?/); assert.match(r.html, /900\+/);
  assert.match(r.html, /action="\/site\/test-co\/contact"/, 'the lead-gen hero posts to the real contact form');
  assert.match(r.html, /name="website"/, 'with the honeypot');
  assert.match(r.html, /4\.7★/, 'average from three real reviews');
  const off = page.render(ctxOf({ ...s, sections: { ...s.sections, contact: { ...s.sections.contact, acceptSubmissions: false } } }));
  assert.doesNotMatch(off.html, /<form/, 'no form when the site does not take messages');
  assert.match(page.render(ctxOf(s, { still: true })).html, /data-still/);
});

test('style library: stylesheet uses readable ink for accent text and is linked only when used', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-stylelib.css'), 'utf8');
  assert.ok(css.includes('var(--t-accent-ink)'));
  assert.match(css, /\.tpl\[data-still\]/);
  const view = fs.readFileSync(path.join(__dirname, '../views/public-site.ejs'), 'utf8');
  assert.match(view, /if \(slHome\)[^\n]*sg-stylelib\.css|slHome[\s\S]{0,200}sg-stylelib\.css/);
});
