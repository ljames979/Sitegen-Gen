const test = require('node:test');
const assert = require('node:assert');
const pets = require('../petpatterns');
const tx = require('../textures');
const g = require('../gradients');
const bp = require('../library/blueprints');

const theme = { primaryColor: '#0f766e', accentColor: '#f59e0b' };
const svgOf = (css) => decodeURIComponent(css.match(/^url\('data:image\/svg\+xml,([^']*)'\)/)[1]);

test('pet patterns: seven repeating drawings of our own, each tile inside its edges, in the gallery and every picker', () => {
  assert.equal(pets.LIST.length, 7); assert.equal(tx.PET_IDS.length, 7);
  pets.LIST.forEach(([k]) => {
    const p = pets.PATTERNS[k];
    p.items.forEach(([m, x, y, s]) => { assert.ok(pets.MOTIFS[m], m); assert.ok(x >= 0 && y >= 0 && x + s <= p.w && y + s <= p.h, k + ' ' + m + ' ' + x + ',' + y); });
    const s = pets.svg(k, ['#112233']);
    assert.match(s, /<pattern id="pp" width="\d+" height="\d+" patternUnits="userSpaceOnUse">/);
    assert.ok(!/<svg[^>]* width=/.test(s), 'no size of its own: it fills the section');
    assert.ok(s.length < 6000, k + ' is ' + s.length);
    assert.ok(g.cleanId('txp-' + k)); assert.equal(g.cleanBlockBg('g-txp-' + k), 'g-txp-' + k);
  });
  const grp = g.menu(theme).find(x => x[0] === 'Pet patterns');
  assert.equal(grp[1].length, 7); assert.equal(grp[1][0][0], 'txp-dogcat');
});

test('pet pattern colors: all black, all white, brand, palettes, own colors; as drawn shows on light and dark', () => {
  ['black', 'white', 'p-classic', 'p-candy', 'p-brand'].forEach(v => assert.equal(tx.cleanInk(v), v));
  assert.equal(tx.cleanInk('p-nope'), ''); assert.equal(tx.inkMode('p-ocean'), 'p-ocean'); assert.equal(tx.inkKey('p-ocean'), 'p-ocean');
  const colorsIn = (css) => [...new Set([...svgOf(css).matchAll(/color="(#[0-9a-f]{6})"/g)].map(m => m[1]))].sort();
  assert.deepEqual(colorsIn(tx.petLayer('txp-dogcat', theme, 'light', 'white')), ['#ffffff']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-dogcat', theme, 'light', 'black')), ['#1d1c1f']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-dogcat', theme, 'light', '')), ['#2e2a2d', '#c4874a']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-dogcat', theme, 'dark', '')), ['#ffffff']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-dogcat', theme, '#123456', '')), ['#ffffff']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-cats', theme, 'light', 'p-candy')), ['#22b5c9', '#ff5d8f', '#ffb000']);
  assert.deepEqual(colorsIn(tx.petLayer('txp-paws', theme, 'light', 'p-brand')), ['#0f766e', '#828a3d', '#f59e0b'].sort());
  assert.deepEqual(colorsIn(tx.petLayer('txp-paws', theme, 'light', 'brand')), ['#0f766e']);
  assert.ok(colorsIn(tx.petLayer('txp-paws', theme, 'light', 'rainbow')).length > 3);
  // the black and white choices work on the other textures too
  assert.match(svgOf(tx.image('tx-globe', theme, 'white')), /#ffffff/);
});

test('pet patterns go over the color already there: blends, own section colors and gradients, plain sections', () => {
  // a block or section blend: just the pattern, no glow under it
  assert.match(g.blendImage('txp-paws', theme, 'dark', 'p-pastel'), /^url\('data:image\/svg\+xml,[^']*'\)$/);
  // replacing the color: the pattern over a soft base of its own
  assert.match(tx.image('txp-bones', theme), /^url\('data:image\/svg\+xml,[^']*'\), linear-gradient\(180deg, #fbf7f1, #f3eadd\)$/);
  // a section in the owner's own color keeps it, the pattern on top
  const own = bp.wrap({ bg: 'color', bgColor: '#ffd6e0', grad: 'txp-dogcat', gradInk: 'black' }, theme);
  assert.match(own.attrs, /data-sg-bg="custom"/); assert.match(own.attrs, /data-sg-pat="1"/); assert.match(own.style, /--sg-brand: #ffd6e0/); assert.match(own.style, /--sg-pat: url\('data:image\/svg\+xml,[^']*'\)/);
  assert.match(decodeURIComponent(own.style), /color="#1d1c1f"/);
  const grad = bp.wrap({ bg: 'gradient', bgColor: '#1d4e89', bgColor2: '#0aa1bd', grad: 'txp-paws' }, theme);
  assert.match(grad.style, /--sg-bgimg: linear-gradient/); assert.match(grad.style, /--sg-pat: url\(/);
  assert.match(decodeURIComponent(grad.style), /color="#ffffff"/);   // white on the dark gradient
  const plain = bp.wrap({ bg: 'brand', grad: 'txp-hearts' }, theme);
  assert.match(plain.attrs, /data-sg-bg="brand"/); assert.match(plain.attrs, /data-sg-pat="1"/); assert.match(plain.style, /--sg-pat: url\(/);
  assert.match(g.headCss(theme, '#ffffff'), /\.sg-sec\[data-sg-pat\] \.sg-lib > div:first-child \{ background-image: var\(--sg-pat\)/);
  // a plain gradient is still dropped when the background is not the gallery; a pet pattern is kept
  const opts = bp.cleanSectionOpts({ about: { bg: 'color', bgColor: '#ffd6e0', grad: 'txp-paws', gradInk: 'white' }, faq: { bg: 'color', bgColor: '#ffd6e0', grad: 'sunset' } }, e => e, () => true);
  assert.equal(opts.about.grad, 'txp-paws'); assert.equal(opts.about.gradInk, 'white'); assert.equal(opts.faq.grad, undefined);
});

test('pet pattern size and see-through ride on the colors value; other textures ignore them', () => {
  assert.equal(tx.cleanInk('p-candy_l_o60'), 'p-candy_l_o60'); assert.equal(tx.cleanInk('_s'), '_s');
  assert.equal(tx.cleanInk('p-candy_x_o65'), 'p-candy'); assert.equal(tx.cleanInk('nope_l'), '_l');
  assert.deepEqual(tx.inkOpts('white_s_o40'), { size: 's', op: 40 }); assert.equal(tx.inkMode('white_s_o40'), 'white');
  const s = svgOf(tx.petLayer('txp-paws', theme, 'light', 'black_l_o60'));
  assert.match(s, /patternTransform="scale\(1.4\)"/); assert.match(s, /opacity="0.6"/);
  assert.doesNotMatch(svgOf(tx.petLayer('txp-paws', theme, 'light', 'black')), /patternTransform|opacity=/);
  assert.equal(tx.image('tx-globe', theme, '#ff0000_l_o60'), tx.image('tx-globe', theme, '#ff0000'));
  // headings get a soft glow of the color under the pattern
  assert.match(bp.wrap({ bg: 'color', bgColor: '#ffd6e0', grad: 'txp-paws' }, theme).style, /--sg-pat-halo: #ffd6e0/);
  assert.match(g.headCss(theme, '#ffffff', [], [['txp-paws', 'tint', 'black', '']]), /:is\(h2, h3\) \{ text-shadow: 0 0 3px/);
});
