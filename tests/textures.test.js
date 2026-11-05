const test = require('node:test');
const assert = require('node:assert');
const tx = require('../textures');
const g = require('../gradients');
const bp = require('../library/blueprints');

const theme = { primaryColor: '#c2410c', accentColor: '#f59e0b' };

test('every texture draws: an SVG (safe inside a style attribute) over a gradient, the same each time', () => {
  tx.IDS.forEach(id => {
    const img = tx.image(id, theme);
    assert.match(img, /(linear|radial)-gradient\(/, id);
    if (id !== 'tx-prism') assert.match(img, /^url\('data:image\/svg\+xml,%3Csvg/, id);
    assert.doesNotMatch(img.replace(/^url\('[^']*'\)/, ''), /'/, id);
    assert.doesNotMatch(img, /["<>\s]%|[<>"]/, id);
    assert.ok(img.length < 20000, id + ' is ' + img.length + ' long');
    assert.equal(tx.image(id, theme), img);
  });
  assert.equal(tx.image('sunset', theme), ''); assert.equal(tx.stopsOf('bogus'), null);
});

test('"your colors" textures follow the brand color; plain ones do not', () => {
  assert.notEqual(tx.image('txb-globe', theme), tx.image('txb-globe', { primaryColor: '#0f766e' }));
  assert.equal(tx.image('tx-globe', theme), tx.image('tx-globe', { primaryColor: '#0f766e' }));
  assert.ok(!tx.IDS.includes('txb-prism'));
});

test('the gradient gallery offers textures for sections and blocks only, and draws them as they are', () => {
  assert.equal(g.cleanId('tx-mesh'), 'tx-mesh'); assert.equal(g.cleanBlockBg('g-txb-burst'), 'g-txb-burst');
  assert.deepEqual(g.cleanMixBg({ g: 'tx-stream', m: 1 }), { g: 'tx-stream', m: 1 });
  assert.equal(g.parse({ theme_pageGrad: 'tx-grid', theme_gradPick: 'txb-mesh' }).pageGrad, '');
  assert.equal(g.parse({ theme_gradPick: 'txb-mesh' }).gradPick, '');
  const b = g.background('tx-prism', theme, 'cone', 40);
  assert.equal(b.img, tx.image('tx-prism', theme)); assert.equal(b.onbrand, '#111111');
  assert.equal(g.background('tx-sphere', theme, '', '').onbrand, '#ffffff');
  const labels = g.menu(theme).map(x => x[0]);
  assert.deepEqual(labels.slice(-2), ['Textures', 'Textures in your colors']);
  assert.ok(!g.menu(theme, false).some(x => /Texture/.test(x[0])));
  // previews stay small (no drawings repeated in every picker)
  g.menu(theme).slice(-2).forEach(grp => grp[1].forEach(x => assert.match(x[2], /^linear-gradient\(180deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/)));
  const w = bp.wrap({ bg: 'preset', grad: 'txb-contour' }, theme);
  assert.match(w.style, /--sg-bgimg: url\('data:image\/svg\+xml,/);
  assert.match(g.headCss(theme, '#ffffff', ['tx-globe', 'bogus']), /\.blk\.blk-bg-g-tx-globe \{ background: url\('data:image\/svg\+xml,/);
});

test('blend into the color already there: glows and drawings with nothing painted under them, for sections, blocks and the Blocks page', () => {
  const sun = g.blendImage('sunset', theme, 'light');
  assert.match(sun, /^radial-gradient\(70% 80% at 0% 0%, #[0-9a-f]{6}99 0, transparent 70%\)/);
  assert.doesNotMatch(sun, /linear-gradient/);
  const globe = g.blendImage('tx-globe', theme, 'light');
  assert.match(globe, /^url\('data:image\/svg\+xml,/); assert.doesNotMatch(globe, /linear-gradient/);
  assert.match(decodeURIComponent(globe.split("')")[0]), /stroke="#c2410c"/);   // the brand color, on a light base
  assert.notEqual(g.blendImage('tx-globe', theme, 'brand'), globe);
  assert.match(g.blendImage('tx-prism', theme, 'light'), /^linear-gradient\(174deg, transparent 36%/);
  assert.equal(g.blendImage('bogus', theme, 'light'), '');
  // blocks: the plain color it blends into; the call-to-action band is brand colored
  assert.equal(g.cleanBlockMix('tint'), 'tint'); assert.equal(g.cleanBlockMix('g-x'), '');
  assert.equal(g.blockMix({ type: 'cta', bgmix: 'none' }), 'brand'); assert.equal(g.blockMix({ type: 'steps', bgmix: 'none' }), 'none');
  assert.equal(g.blendClass('tx-mesh', 'dark'), 'blk-gb-dark-tx-mesh'); assert.equal(g.blendClass('tx-mesh', 'x'), '');
  const css = g.headCss(theme, '#ffffff', [], [['sunset', 'tint'], ['sunset', 'tint'], ['tx-grid', 'dark']]);
  assert.equal((css.match(/\.blk\.blk-gb-tint-sunset \{/g) || []).length, 1);
  assert.match(css, /\.blk\.blk-gb-dark-tx-grid \{ background-image: url\('data:image\/svg\+xml,/);
  assert.match(css, /\.sg-sec\[data-sg-gb\] \.sg-lib > div:first-child \{ background-image: var\(--sg-gb\)/);
  // sections: the section keeps its own color (no data-sg-bg), the blend goes in --sg-gb
  const w = bp.wrap({ bg: 'preset', grad: 'aurora', gradBlend: true, gradMove: true }, theme);
  assert.match(w.attrs, /data-sg-gb="1"/); assert.doesNotMatch(w.attrs, /data-sg-bg|data-sg-img/); assert.match(w.style, /--sg-gb: radial-gradient/);
  assert.match(w.attrs, /data-sg-gmove="1"/);
  assert.equal(bp.cleanSectionOpts({ about: { bg: 'preset', grad: 'mint', gradBlend: '1' } }, e => e, () => true).about.gradBlend, true);
  assert.equal(bp.cleanSectionOpts({ about: { bg: 'alt', grad: 'mint', gradBlend: '1' } }, e => e, () => true).about.gradBlend, undefined);
  assert.deepEqual(g.cleanMixBg({ g: 'tx-stream', b: 1 }), { g: 'tx-stream', b: 1 });
  assert.equal(g.mixOpts({ g: 'tx-stream', b: 1 }).gradBlend, true);
});

test('texture colors: brand, one to three own colors or a rainbow, for sections, content blocks and the Blocks page', () => {
  assert.equal(tx.cleanInk('#FF0000, #00ff00'), '#ff0000,#00ff00'); assert.equal(tx.cleanInk('rainbow'), 'rainbow'); assert.equal(tx.cleanInk('brand'), 'brand');
  ['#ff0000,#00ff00,#0000ff,#ffffff', '#ff0000,red', 'url(x)', '#fff', 'nope'].forEach(v => assert.equal(tx.cleanInk(v), '', v));
  assert.equal(tx.inkMode('#a1b2c3,#ffffff'), 'two'); assert.equal(tx.inkMode(''), ''); assert.equal(tx.inkKey('#a1b2c3,#ffffff'), 'a1b2c3-ffffff');
  tx.IDS.forEach(id => ['brand', '#ff0000', '#ff0000,#00ff00', '#ff0000,#00ff00,#0000ff', 'rainbow'].forEach(ink => {
    const img = tx.image(id, theme, ink);
    if (!(id.startsWith('txb-') && ink === 'brand')) assert.ok(img !== tx.image(id, theme), id + ' ' + ink);
    assert.doesNotMatch(img.replace(/^url\('[^']*'\)/, ''), /'/, id);
    assert.doesNotMatch(img, /["<>\s]%|[<>"]/, id);
  }));
  // one color draws in it; more sweep across the drawing; a rainbow has all its colors
  assert.match(decodeURIComponent(tx.image('tx-globe', theme, '#ff0000')), /stroke="#ff0000"/);
  const two = decodeURIComponent(tx.image('tx-globe', theme, '#ff0000,#00ff00'));
  assert.match(two, /linearGradient id="ink"/); assert.match(two, /stroke="url\(#ink\)"/);
  tx.RAINBOW.forEach(c => assert.ok(decodeURIComponent(tx.image('tx-grid', theme, 'rainbow')).includes(c), c));
  // a txb- texture with no pick stays in the brand color; 'brand' on a plain one matches it
  assert.equal(tx.image('tx-globe', theme, 'brand'), tx.image('txb-globe', theme));
  // sections and the Blocks page
  assert.deepEqual(g.cleanMixBg({ g: 'tx-globe', c: 'rainbow' }), { g: 'tx-globe', c: 'rainbow' });
  assert.deepEqual(g.cleanMixBg({ g: 'sunset', c: 'rainbow' }), { g: 'sunset' }, 'plain gradients keep their own colors');
  assert.equal(g.mixOpts({ g: 'tx-globe', c: '#ff0000' }).gradInk, '#ff0000');
  const o = bp.cleanSectionOpts({ about: { bg: 'preset', grad: 'tx-globe', gradInk: '#FF0000,#00ff00' }, faq: { bg: 'alt', grad: 'tx-globe', gradInk: 'rainbow' } }, e => e, () => true);
  assert.equal(o.about.gradInk, '#ff0000,#00ff00'); assert.equal(o.faq.gradInk, undefined, 'only with a gallery background');
  assert.ok(g.background('tx-globe', theme, '', '', 'rainbow').img.includes('linearGradient'));
  // content blocks: an ink class with its own rule, plain and blended
  assert.equal(g.inkClass('tx-globe', 'rainbow'), 'blk-gi-rainbow'); assert.equal(g.inkClass('sunset', 'rainbow'), ''); assert.equal(g.inkClass('tx-globe', ''), '');
  const css = g.headCss(theme, '#ffffff', ['tx-globe', ['tx-globe', '#ff0000,#00ff00']], [['tx-grid', 'dark', 'rainbow']]);
  assert.match(css, /\.blk\.blk-bg-g-tx-globe \{/); assert.match(css, /\.blk\.blk-bg-g-tx-globe\.blk-gi-ff0000-00ff00 \{/);
  assert.match(css, /\.blk\.blk-gb-dark-tx-grid-rainbow \{/); assert.equal(g.blendClass('tx-grid', 'dark', 'rainbow'), 'blk-gb-dark-tx-grid-rainbow');
});
