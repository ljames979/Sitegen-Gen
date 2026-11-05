const { test } = require('node:test');
const assert = require('node:assert/strict');
const mix = require('../mixpage');
const themes = require('../themes');

const site = (o = {}, theme = {}) => ({ name: 'Ridge Roofing', slug: 'ridge', theme: { style: 'modern', ...theme }, layout: { hidden: [] }, sections: Object.assign({ meta: { businessType: 'Roofing contractor', city: 'Orlando, FL' }, hero: { headline: 'Roofs that [last]', subheadline: '', ctaText: 'Get a quote', imageUrl: '' }, about: { heading: 'About', body: '', imageUrl: '' }, services: { heading: 'Services', items: [] }, whyChoose: { items: [] }, testimonials: { items: [] }, faq: { items: [] }, gallery: { images: [] }, contact: { phone: '', email: '' }, trust: { stats: [], serviceAreas: [], badges: [] }, hours: { items: [] }, booking: { services: [] } }, o) });
const full = () => site({
  services: { heading: 'What we do', items: [{ title: 'Roof repair', description: 'Leaks fixed.', price: 'From $350' }, { title: 'Inspections', description: 'Photo report.' }] },
  testimonials: { items: [{ quote: 'They found the leak.', author: 'Maria G.', rating: 5 }] },
  faq: { items: [{ question: 'Free estimates?', answer: 'Yes, written.' }] },
  about: { heading: 'About us', body: 'Family owned since 1999.', imageUrl: '' },
  contact: { phone: '407-555-0100', email: 'a@b.test' }
});
const ctxOf = (s, extra = {}) => ({ site: s, basePath: '/site/ridge', services: (s.sections.services.items || []).map((x, i) => ({ ...x, slug: 's' + i })), areas: [], navPages: [], visible: () => true, ...extra });

test('mix: only real designs are kept, at most 30, and the colors flag only on Style Library blocks', () => {
  const out = mix.clean([
    { k: 'lib', f: 'hero', v: 'spotlight' }, { k: 'lib', f: 'hero', v: 'nope' }, { k: 'lib', f: 'custom', v: 'x' },
    { k: 'sl', f: 'features', v: 'sl-polar', own: 1 }, { k: 'sl', f: 'features', v: 'nope' }, { k: 'sl', f: 'bogus', v: 'polar' },
    { k: 'at', f: 'hero', v: 'at-flap', own: true }, { k: 'at', f: 'pricing', v: 'flap' }, { k: 'x', f: 'hero', v: 'polar' }, null, 'hero'
  ]);
  assert.deepEqual(out, [{ k: 'lib', f: 'hero', v: 'spotlight' }, { k: 'sl', f: 'features', v: 'polar', own: true }, { k: 'at', f: 'hero', v: 'flap' }]);
  assert.equal(mix.clean(Array(40).fill({ k: 'lib', f: 'faq', v: 'side' })).length, mix.MAX);
  assert.deepEqual(mix.clean('[]'), []);
});

test('mix: the catalog lists every design once, each under a known section type', () => {
  const cat = mix.catalog();
  assert.equal(new Set(cat.map(c => c.k + c.f + c.v)).size, cat.length);
  for (const c of cat) assert.ok(mix.TYPES[c.type], c.k + ' ' + c.f);
  for (const k of ['lib', 'sl', 'at']) assert.ok(cat.some(c => c.k === k && c.type === 'hero'), k + ' has heroes');
  assert.ok(cat.length > 600);
});

test('mix: blocks from three sources draw in order from real content; empty ones are left out', () => {
  const s = full();
  const r = mix.render(ctxOf(s), [{ k: 'at', f: 'hero', v: 'flap' }, { k: 'lib', f: 'services', v: 'list' }, { k: 'sl', f: 'quote', v: 'polar', own: true }, { k: 'lib', f: 'gallery', v: 'filmstrip' }, { k: 'at', f: 'faq', v: 'bloom' }, { k: 'at', f: 'services', v: 'bloom' }]);
  assert.deepEqual(r.items.map(i => i.i), [0, 1, 2, 4, 5], 'the gallery has no photos, so it is skipped');
  assert.deepEqual(r.sections, ['hero', 'services', 'testimonials', 'faq', 'services']);
  assert.deepEqual(r.needs, { lib: true, sl: true, at: true });
  assert.equal(r.items[1].lib.id, 'services/list');
  const html = r.items.filter(i => i.html).map(i => i.html).join('');
  assert.match(html, /Maria G\./); assert.match(html, /Free estimates\?/);
  assert.match(html, /querySelector\('\[data-mix-i="0"\] \.p-flap'\)/, 'the artwork starts inside its own block');
  assert.match(html, /class="p-bloom"/);
  assert.doesNotMatch(html, /<style>/, 'piece stylesheets go in the head');
  assert.equal(r.css.split('.p-bloom').length > 1 && r.css.split(':where(.sg-atelier) h1').length - 1, 1, "each piece's stylesheet once, after one reset");
  assert.ok(r.css.includes('.p-flap'));
  assert.match(html, /data-sl-style="polar"/);
  assert.ok(r.fonts.length >= 2);
  assert.doesNotMatch(html.replace(/<script>[\s\S]*?<\/script>/g, ''), /undefined|\{\{[A-Z]+\}\}/);
  assert.deepEqual(mix.render(ctxOf(site()), [{ k: 'lib', f: 'faq', v: 'side' }]).items, []);
});

test('mix: a Style Library block uses the client color unless asked for the style\'s own', () => {
  const s = full(); s.theme.primaryColor = '#123456';
  const st = require('../stylelib').get('sl-polar');
  const brand = mix.render(ctxOf(s), [{ k: 'sl', f: 'features', v: 'polar' }]).items[0].html;
  const own = mix.render(ctxOf(s), [{ k: 'sl', f: 'features', v: 'polar', own: true }]).items[0].html;
  assert.notEqual(brand, own);
  assert.ok(own.toLowerCase().includes(st.c.accent.toLowerCase()));
});

test('mix: starting blocks come from the home page the site has now', () => {
  const s = full();
  const bp = mix.seed(s, '', 'blueprint');
  assert.ok(bp.length && bp.every(b => b.k === 'lib') && bp[0].f === 'hero');
  const sl = mix.seed(site({}, { style: 'sl-polar' }), '', 'stylelib');
  assert.ok(sl.every(b => b.k === 'sl' && b.v === 'polar')); assert.equal(sl[0].f, 'hero');
  const at = mix.seed(site({}, { style: 'at-flap' }), '', 'atelier');
  assert.ok(at.every(b => b.k === 'at' && b.v === 'flap')); assert.equal(at[0].f, 'hero');
});

test('mix: the Mix and match home layout needs at least one block', () => {
  assert.equal(themes.homeLayoutOf({ style: 'modern', homeLayout: 'mix', mix: [{ k: 'lib', f: 'faq', v: 'side' }] }), 'mix');
  assert.notEqual(themes.homeLayoutOf({ style: 'modern', homeLayout: 'mix', mix: [] }), 'mix');
  assert.notEqual(themes.homeLayoutOf({ style: 'modern', homeLayout: 'mix' }), 'mix');
});

test('arrange: only valid paths and sizes are kept, and they become scoped CSS', () => {
  const lay = mix.cleanLay({
    pad: { p: 'section:1', t: 1000, b: 37 },
    hm: true,
    els: {
      'section:1/div:1/h2:1': { w: 7, al: 'c', fs: 400, junk: 1 },
      'section:1/div:2/img:1': { sh: 'circle', fx: 20, fy: 80, hm: true },
      'section:1/p:2': { w: 1, sh: 'blob' },
      'bad path': { w: 6 }, 'section:1/div:1"]{}': { w: 6 }
    },
    ord: { 'section:1/div:1': [2, 1, 3], 'section:1/ul:1': [1, 1], 'x:y': [2, 1] },
    ordM: { 'section:1/div:1': [3, 2, 1] },
    fx: ['section:1/div:1', 'nope nope'], fxM: [], extra: 'x'
  });
  assert.deepEqual(lay, {
    pad: { p: 'section:1', t: 320, b: 37 }, hm: true,
    els: { 'section:1/div:1/h2:1': { w: 7, al: 'c', fs: 160 }, 'section:1/div:2/img:1': { sh: 'circle', fx: 20, fy: 80, hm: true }, 'section:1/p:2': { w: 2 } },
    ord: { 'section:1/div:1': [2, 1, 3] }, ordM: { 'section:1/div:1': [3, 2, 1] }, fx: ['section:1/div:1']
  });
  assert.equal(mix.cleanLay({ els: { 'bad path': { w: 3 } } }), null);
  const kept = mix.clean([{ k: 'lib', f: 'faq', v: 'side', lay }, { k: 'lib', f: 'faq', v: 'side', lay: { nothing: 1 } }]);
  assert.ok(kept[0].lay && !('lay' in kept[1]));
  const css = mix.arrangeCss(kept);
  const h2 = '.sg-mix[data-mix-i="0"] > section:nth-child(1) > div:nth-child(1) > h2:nth-child(1)';
  assert.ok(css.includes('.sg-mix[data-mix-i="0"] > section:nth-child(1){padding-top:320px!important;padding-bottom:37px!important;}'));
  assert.ok(css.includes(h2 + '{font-size:clamp(96px, 12.5vw, 160px)!important}'));
  assert.ok(css.includes(h2 + '{margin-left:auto!important;margin-right:auto!important;text-align:center!important'));
  assert.match(css, /@media \(min-width: 700px\)\{[^@]*h2:nth-child\(1\)\{width:58\.333%!important/, 'widths only on wider screens');
  assert.match(css, /@media \(max-width: 699px\)\{\.sg-mix\[data-mix-i="0"\]\{display:none!important\}/, 'block hidden on phones');
  assert.ok(css.includes('.sg-mix[data-mix-i="0"] > section:nth-child(1) > div:nth-child(1){display:flex!important;flex-direction:column}'));
  assert.ok(css.includes('.sg-mix[data-mix-i="0"] > section:nth-child(1) > div:nth-child(1) > :nth-child(2){order:1}'));
  assert.match(css, /border-radius:50%!important/); assert.match(css, /object-position:20% 80%!important/);
  assert.doesNotMatch(css, /<|undefined|NaN/);
  assert.equal(mix.arrangeCss([{ k: 'lib', f: 'faq', v: 'side' }]), '');
});

test('arrange: heights set by dragging are kept, clamped and drawn per screen size', () => {
  const lay = mix.cleanLay({ pad: { p: 'section:1', t: 0, b: 0 }, els: { 'section:1': { h: 5000, hM: 300 }, 'section:1/img:1': { h: 10 }, 'section:1/p:1': { h: 'x' } } });
  assert.deepEqual(lay.els, { 'section:1': { h: 2400, hM: 300 }, 'section:1/img:1': { h: 40 } });
  const css = mix.arrangeCss(mix.clean([{ k: 'lib', f: 'faq', v: 'side', lay }]));
  const s = '.sg-mix[data-mix-i="0"] > section:nth-child(1)';
  assert.ok(css.includes(s + ':not(img){min-height:2400px!important'), 'section height on wide screens');
  assert.ok(css.includes(s + ':not(img){min-height:300px!important'), 'its own phone height');
  assert.ok(css.includes(s + ' > img:nth-child(1):is(img){height:40px!important;object-fit:cover!important}'), 'photo height');
  assert.ok(css.includes('.sg-mix[data-mix-i="0"] :is(.sg-lib > div, .sl-sec > section, .sg-mix-at > div > section){min-height:0!important}'), 'a block\'s own tall minimum gives way');
  assert.doesNotMatch(css, /<|undefined|NaN/);
});

test('arrange: photos cropped by Size (hx, hxM on phones) get an exact height per screen size', () => {
  const lay = mix.cleanLay({ els: { 'section:1': { h: 260 }, 'section:1/div:1': { hx: 180, hxM: 10 }, 'section:1/img:1': { hx: 'x' } } });
  assert.deepEqual(lay.els, { 'section:1': { h: 260 }, 'section:1/div:1': { hx: 180, hxM: 40 } });
  const css = mix.arrangeCss(mix.clean([{ k: 'lib', f: 'faq', v: 'side', lay }]));
  const s = '.sg-mix[data-mix-i="0"] > section:nth-child(1) > div:nth-child(1)';
  assert.match(css, /@media \(min-width: 700px\)\{[^]*> div:nth-child\(1\)\{height:180px!important;min-height:0!important;overflow:clip!important\}/);
  assert.match(css, /@media \(max-width: 699px\)\{[^]*> div:nth-child\(1\)\{height:40px!important/);
  assert.ok(css.includes(s + ':is(img){object-fit:cover!important}'));
  assert.match(css, /overflow:clip!important/, 'clip keeps a sticky scroll scene inside working');
  const sp = mix.arrangeCss(mix.clean([{ k: 'lib', f: 'faq', v: 'side', lay: mix.cleanLay({ els: { 'section:1/div:1': { py: 12, pyM: 999 } } }) }]));
  assert.match(sp, /@media \(min-width: 700px\)\{[^]*\{padding-top:12px!important;padding-bottom:12px!important\}/);
  assert.match(sp, /@media \(max-width: 699px\)\{[^]*\{padding-top:320px!important/);
  assert.doesNotMatch(css, /<|undefined|NaN/);
});

test('mix: More effects for one block are kept (known ones, opener on heroes only) and passed to the page', () => {
  const kept = mix.clean([{ k: 'lib', f: 'faq', v: 'side', xfx: ['glow', 'cursor', 'zoom', 'glow', 'bogus'] }, { k: 'lib', f: 'faq', v: 'side', xfx: 'glow' }]);
  assert.deepEqual(kept[0].xfx, ['glow']); assert.ok(!('xfx' in kept[1]));
  const s = full();
  const r = mix.render(ctxOf(s), [{ k: 'lib', f: 'services', v: 'list', xfx: ['flip', 'roll'] }]);
  assert.deepEqual(r.items[0].xfx, ['flip', 'roll']);
});
