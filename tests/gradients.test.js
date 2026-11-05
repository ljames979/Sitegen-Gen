const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('../gradients');
const bp = require('../library/blueprints');
const mixpage = require('../mixpage');
const contrast = require('../contrast');

const theme = { primaryColor: '#607882', accentColor: '#263840' };

test('gradient gallery: 30 named presets plus four made from the client\'s own colors, in groups for the pickers', () => {
  assert.equal(g.PRESETS.length, 30); assert.equal(g.GRAD_IDS.length, 34 + 284); assert.equal(g.IDS.length, 34 + 284 + 17);
  g.PRESETS.forEach(p => { assert.ok(p[2].length >= 2 && p[2].every(c => /^#[0-9a-f]{6}$/.test(c)), p[0]); });
  assert.deepEqual(g.stopsOf('brand-bold', theme), ['#607882', '#263840']);
  assert.ok(contrast.luminance(g.stopsOf('brand-soft', theme)[0]) > 0.8, 'soft is light');
  assert.ok(contrast.luminance(g.stopsOf('brand-dark', theme)[0]) < 0.05, 'dark is dark');
  assert.equal(g.stopsOf('nope', theme), null);
  const menu = g.menu(theme);
  assert.equal(menu[0][0], 'From your colors'); assert.equal(g.menu(theme, false).flatMap(m => m[1]).length, 34); assert.equal(menu.flatMap(m => m[1]).length, 51);
});

test('gradient styles: straight with an angle, circle glow, cone and soft mesh; text color that reads on every stop', () => {
  assert.equal(g.image(['#000000', '#ffffff'], 'line', 90), 'linear-gradient(90deg, #000000, #ffffff)');
  assert.match(g.image(['#000000', '#ffffff'], 'circle'), /^radial-gradient\(circle at 50% 0%/);
  assert.match(g.image(['#000000', '#ffffff'], 'cone', 45), /^conic-gradient\(from 45deg at 50% 50%, #000000, #ffffff, #000000\)/);
  assert.equal((g.image(['#ff0000', '#00ff00', '#0000ff'], 'mesh').match(/radial-gradient/g) || []).length, 5);
  assert.equal(g.image(['#000000'], 'line'), '', 'one color is not a gradient');
  assert.equal(g.textOn(['#fceabb', '#f8b500']), '#111111'); assert.equal(g.textOn(['#141e30', '#243b55']), '#ffffff');
  assert.equal(g.cleanAngle('-90'), 270); assert.equal(g.cleanAngle('x'), ''); assert.equal(g.cleanStyle('mesh'), 'mesh'); assert.equal(g.cleanStyle('zig'), '');
});

test('section backgrounds: a gallery pick, its style, angle, drift and grain; the section\'s own page color steps aside', () => {
  const w = bp.wrap({ bg: 'preset', grad: 'ocean', gradStyle: 'cone', gradAngle: 30, gradMove: true, grain: true }, theme);
  assert.match(w.attrs, /data-sg-bg="custom"/); assert.match(w.attrs, /data-sg-gmove="1"/); assert.match(w.attrs, /data-sg-grain="1"/); assert.match(w.attrs, /data-sg-img="1"/);
  assert.match(w.style, /--sg-bgimg: conic-gradient\(from 30deg at 50% 50%, #2e9cca, #1b4f72, #2e9cca\)/); assert.match(w.style, /--sg-onbrand: #ffffff/);
  assert.doesNotMatch(w.style.slice(8, -1), /"/, 'nothing that would end the style attribute');
  assert.match(bp.wrap({ bg: 'preset', grad: 'brand-bold' }, theme).style, /linear-gradient\(135deg, #607882, #263840\)/);
  assert.match(bp.wrap({ bg: 'gradient', bgColor: '#101820', bgColor2: '#203040', gradStyle: 'circle' }).style, /radial-gradient\(circle at 50% 0%, #101820, #203040\)/);
  assert.equal(bp.wrap({ bg: 'preset', grad: 'bogus' }).attrs, '');
  // saved options: the gradient fields only stay with a gradient background
  const o = bp.cleanSectionOpts({ about: { bg: 'preset', grad: 'mint', gradStyle: 'mesh', gradAngle: '400', gradMove: '1', grain: '1' }, faq: { bg: 'alt', grad: 'mint', gradMove: '1' }, stats: { bg: 'preset' } }, e => e, () => true);
  assert.deepEqual([o.about.grad, o.about.gradStyle, o.about.gradAngle, o.about.gradMove, o.about.grain], ['mint', 'mesh', 40, true, true]);
  assert.equal(o.faq.grad, undefined); assert.equal(o.faq.gradMove, undefined); assert.equal(o.stats, undefined, 'a gallery background with no pick is no change');
});

test('Blocks page: a library section keeps its gradient background; anything else is dropped', () => {
  assert.deepEqual(g.cleanMixBg({ g: 'sunset', s: 'mesh', a: '720', m: 1, n: '1', x: 'bad' }), { g: 'sunset', s: 'mesh', a: 0, m: 1, n: 1 });
  assert.equal(g.cleanMixBg({ g: 'bogus' }), null); assert.equal(g.cleanMixBg('sunset'), null);
  assert.deepEqual(g.mixOpts({ g: 'sunset', m: 1 }), { bg: 'preset', grad: 'sunset', gradStyle: '', gradAngle: '', gradMove: true, grain: false, gradBlend: false });
  const src = require('fs').readFileSync(require('path').join(__dirname, '../mixpage.js'), 'utf8');
  assert.match(src, /k === 'lib' && gradients\.cleanMixBg\(b\.bg\)/); assert.match(src, /opts: gradients\.mixOpts\(b\.bg\)/);
  assert.equal(typeof mixpage.clean, 'function');
});

test('site-wide: page wash (still or shifting with the scroll), gradient headings that read, gradient borders and glows', () => {
  assert.deepEqual(g.parse({ theme_pageGrad: 'lilac', theme_pageGradScroll: '1', theme_gradPick: 'nope', theme_gradText: 'on', theme_gradEdge: 'both' }),
    { pageGrad: 'lilac', pageGradScroll: true, gradPick: '', gradText: true, gradEdge: 'both', homeBg: {} });
  assert.equal(g.parse({ theme_gradEdge: 'fire' }).gradEdge, '');
  assert.equal(g.bodyClasses({ pageGrad: 'lilac', pageGradScroll: true, gradText: true, gradEdge: 'both' }), ' sg-pwash sg-pwash-scroll sg-gtext sg-gedge sg-gglow');
  assert.equal(g.bodyClasses({ pageGradScroll: true }), '', 'no wash, no shifting');
  const css = g.headCss({ pageGrad: 'ocean', pageGradScroll: true, gradText: true, gradPick: 'honey', gradEdge: 'border' }, '#ffffff', ['sunset', 'bogus']);
  assert.match(css, /body\.sg-pwash::before \{[^}]*position: fixed/); assert.match(css, /background-size: 100% 400%/);
  assert.match(css, /\.blk\.blk-bg-g-sunset \{ background: linear-gradient/); assert.doesNotMatch(css, /blk-bg-g-bogus|blk-bg-g-ocean/);
  // heading colors lifted to 3:1 on the page: honey's light stop is darkened
  const stops = css.match(/sg-gtext[^{]*\{ background-image: linear-gradient\(90deg, (#[0-9a-f]{6}), (#[0-9a-f]{6})\)/);
  assert.ok(stops && contrast.ratio(stops[1], '#ffffff') >= 3 && contrast.ratio(stops[2], '#ffffff') >= 3);
  assert.match(css, /mask-composite: xor/); assert.doesNotMatch(css, /sg-gglow :is/);
  assert.match(css, /prefers-reduced-motion: no-preference\) \{ \.sg-sec\[data-sg-gmove\]/);
  assert.match(g.SCROLL_JS, /prefers-reduced-motion: reduce/); assert.doesNotThrow(() => new Function(g.SCROLL_JS));
  assert.equal(g.cleanBlockBg('g-ocean'), 'g-ocean'); assert.equal(g.cleanBlockBg('g-nope'), 'none'); assert.equal(g.cleanBlockBg('tint'), 'tint'); assert.equal(g.cleanBlockBg('white'), 'white'); assert.equal(g.blendClass('ocean', 'white'), '');
});

test('home sections in any layout: every gallery gradient and texture, words turned readable, bad picks dropped', () => {
  const g = require('../gradients');
  const t = g.parse({ theme_hbg_intro: 'aurora', theme_hbg_services: 'tx-contour', theme_hbg_faq: 'bogus', theme_hbg_cta: 'night' }).homeBg;
  assert.deepEqual(t, { intro: 'aurora', services: 'tx-contour', cta: 'night' });
  const css = g.headCss({ homeBg: t }, '#ffffff', [], []);
  assert.match(css, /body \.home-intro\.home-intro\.home-intro \{ background: /);
  assert.match(css, /body \.home-services\.home-services\.home-services \{ background: url\('data:image\/svg\+xml/, 'a texture too');
  assert.match(css, /body \.cta-band\.cta-band :is\(h2, p\) \{ color: #ffffff; \}/);
  assert.doesNotMatch(css, /lp-faq/);
  // every gradient and texture of the gallery is offered (the block and section pickers use the same menu)
  const ids = g.menu({}, true, true).flatMap(x => x[1].map(y => y[0]));   // (with the gradient library; per-block pickers open it as a swatch grid)
  assert.deepEqual([...ids].sort(), [...g.IDS].sort());
});

test('gradient library (coolors.co colors): 284 more, in color families, valid for blocks, cards and sections', () => {
  assert.equal(g.LIB.length, 284); assert.ok(g.LIB.every(p => /^c-[a-z0-9-]+x*$/.test(p[0]) && p[2].length >= 2 && p[2].every(c => /^#[0-9a-f]{6}$/.test(c))));
  assert.equal(new Set(g.LIB_IDS).size, 284);
  assert.deepEqual(g.stopsOf('c-neon-lagoon', theme), ['#00ff87', '#60efff']);
  assert.equal(g.cleanBlockBg('g-c-digital-sky'), 'g-c-digital-sky'); assert.equal(g.cleanCardBg('c-digital-sky'), 'c-digital-sky'); assert.equal(g.cleanCardBg('tx-grid'), '', 'no textures on cards');
  const lm = g.libMenu(); assert.equal(lm.flatMap(m => m[1]).length, 284); assert.ok(lm.every(m => /^Library: /.test(m[0])));
  // per-block pickers leave the library out, apart from the pick already made
  assert.equal(g.menu(theme, false).flatMap(m => m[1]).length, 34);
  assert.equal(g.menu(theme, false, false, 'c-neon-lagoon').flatMap(m => m[1]).length, 35);
  assert.equal(g.menu(theme, true, true).flatMap(m => m[1]).length, 51 + 284);
});

test('gradient intensity: 10-150%, weaker fades into the page color, stronger is richer; blocks, blends and cards', () => {
  assert.equal(g.cleanStrength('100'), ''); assert.equal(g.cleanStrength(''), ''); assert.equal(g.cleanStrength('63'), 65); assert.equal(g.cleanStrength('5'), 10); assert.equal(g.cleanStrength('900'), 150);
  const weak = g.background('ocean', theme, '', '', '', 20, '#ffffff');
  assert.ok(contrast.luminance(weak.brand) > contrast.luminance('#2e9cca'), 'faded toward white'); assert.equal(weak.onbrand, '#111111', 'dark words on the faded colors');
  const rich = g.strongStops(['#ffd3a5'], 150, '#ffffff')[0];
  assert.ok(contrast.luminance(rich) < contrast.luminance('#ffd3a5'), 'a pastel deepens when turned up');
  assert.deepEqual(g.strongStops(['#ffd3a5'], '', '#fff'), ['#ffd3a5']);
  const css = g.headCss(theme, '#ffffff', [['ocean', '', 40], ['ocean', '', '']], [['sunset', 'none', '', 130]], [['c-digital-sky', ''], ['mint', 60], ['tx-grid', '']]);
  assert.match(css, /\.blk\.blk-bg-g-ocean\.blk-gx-40 \{ background: linear-gradient/); assert.match(css, /\.blk\.blk-bg-g-ocean \{ background: linear-gradient\(135deg, #2e9cca, #1b4f72\)/);
  assert.match(css, /\.blk\.blk-gb-none-sunset-x130 \{ background-image: radial-gradient\(70% 80% at 0% 0%, #[0-9a-f]{6}c7 0, transparent 82%\)/);
  assert.match(css, /\.blk\.blk-cg-c-digital-sky\.blk-cg-c-digital-sky :is\(\.card, \.step-card/); assert.match(css, /\.blk\.blk-cg-mint-x60\.blk-cg-mint-x60 /); assert.doesNotMatch(css, /blk-cg-tx-grid/);
  assert.equal(g.strengthClass(100), ''); assert.equal(g.strengthClass(55), 'blk-gx-55'); assert.equal(g.cardClass('mint', 100), 'blk-cg-mint'); assert.equal(g.cardClass('nope', 50), '');
  // a texture turned down gets a veil of the page color
  assert.match(g.background('tx-grid', theme, '', '', '', 50, '#ffffff').img, /^linear-gradient\(#ffffff80, #ffffff80\), /);
});
