const test = require('node:test');
const assert = require('node:assert');
const pin = require('../pinfx');
const ix = require('../imgfx');
const sfx = require('../scrollfx');
const vm = require('../videomask');

test('stacked cards: pile and fan are Pin and cards choices', () => {
  assert.deepEqual(pin.attrs('deck'), { cls: ' sg-pin sg-pin-deck', style: '' });
  assert.deepEqual(pin.attrs('fan'), { cls: ' sg-pin sg-pin-fan', style: '' });
  assert.match(pin.CSS, /\.sg-deck-card\{transform:var\(--dk-t,none\) !important/);
  assert.doesNotThrow(() => new Function(pin.SCRIPT));
});

test('image text animation: hover and scroll, nothing else', () => {
  assert.equal(ix.clean('hover'), 'hover'); assert.equal(ix.clean('spin'), '');
  assert.deepEqual(ix.attrs('scroll'), { cls: ' sg-ix sg-ix-scroll' }); assert.deepEqual(ix.attrs(''), { cls: '' });
  assert.match(ix.CSS, /@media \(hover:hover\)/); assert.match(ix.CSS, /prefers-reduced-motion/);
  assert.doesNotThrow(() => new Function(ix.SCRIPT));
});

test('scroll elements: settings, styles and script only when on', () => {
  assert.deepEqual(sfx.parse({ theme_scrollEl: 'flip', theme_scrollElWhat: 'parts', theme_scrollElSpeed: 'slow', theme_scrollElPlay: 'always' }),
    { scrollEl: 'flip', scrollElWhat: 'parts', scrollElSpeed: 'slow', scrollElPlay: 'always' });
  assert.deepEqual(sfx.parse({ theme_scrollEl: 'spin' }), { scrollEl: '', scrollElWhat: 'sections', scrollElSpeed: 'normal', scrollElPlay: 'once' });
  assert.equal(sfx.script({}), ''); assert.equal(sfx.css({ scrollEl: '' }), '');
  const t = { scrollEl: 'sides', scrollElWhat: 'parts', scrollElSpeed: 'quick', scrollElPlay: 'once' };
  assert.match(sfx.script(t), /var C = \{"fx":"sides","parts":true,"ms":450,"again":false\}/);
  assert.match(sfx.css(t), /\.sg-sfx \.sg-sfx-el\.sg-sfx-r\{transform:translateX\(80px\)\}/);
  assert.doesNotThrow(() => new Function(sfx.script(t)));
});

test('video mask: known looks only; shapes have a clip', () => {
  assert.equal(vm.clean('text'), 'text'); assert.equal(vm.clean('star'), 'auto');
  assert.equal(vm.masked('auto'), false); assert.equal(vm.masked('grow'), true);
  for (const k of ['circle', 'arch', 'blob', 'diamond']) assert.ok(vm.SHAPES[k], k);
  assert.match(vm.BLOB_SVG, /<clipPath id="sgBlob"/);
  assert.doesNotThrow(() => new Function(vm.SCRIPT));
});

test('section height: presets, full screen and the hero', () => {
  const ht = require('../heightfx');
  assert.deepEqual(ht.attrs('roomy'), { cls: ' sg-ht sg-ht-roomy', style: '--sg-ht: 128px;' });
  assert.deepEqual(ht.attrs('screen'), { cls: ' sg-ht sg-ht-screen', style: '' });
  assert.deepEqual(ht.attrs('huge'), { cls: '', style: '' });
  assert.equal(ht.clean('tight'), 'tight'); assert.equal(ht.clean('<x>'), '');
  // every kind of block: library sections, content blocks, Style Library and Signature pieces
  for (const box of ['.sg-lib > div > div:first-child', 'section.blk', '.sl-sec > section', '.sg-mix-at > div > section']) {
    assert.ok(ht.CSS.includes('.sg-ht:not(.sg-ht-screen) ' + box), box);
    assert.ok(ht.CSS.includes('.sg-ht-screen ' + box), box);
  }
  assert.match(ht.CSS, /\{padding-top:var\(--sg-ht\) !important;padding-bottom:var\(--sg-ht\) !important\}/);
  assert.match(ht.CSS, /\.sg-ht-screen section\.blk,[^{]*\{min-height:calc\(100svh/);
  assert.ok(ht.CSS.includes('.sg-ht-tall[data-mix-f="hero"] :is(.sg-lib > div, .sl-sec > section, .sg-mix-at > div > section){min-height:135svh !important}'));
});

test('effects share one scroll listener (sgOnScroll) and keep a fallback without it', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'sg-fx.js'), 'utf8');
  for (const code of [src, pin.SCRIPT, vm.SCRIPT]) { assert.match(code, /window\.sgOnScroll \|\| function \(f\)/); }
  assert.doesNotMatch(src + pin.SCRIPT + vm.SCRIPT, /addEventListener\('scroll', (ask|function)/);
});

test('look packs set only valid effects, replace earlier ones and never pin the hero; Surprise me stays within taste', () => {
  const L = require('../lookpacks'), film = require('../filmfx'), ht = require('../heightfx');
  for (const pk of L.PACKS) for (const r of pk.rules) {
    if (r.set.pin) assert.ok(pin.clean(r.set.pin), pk.id + ' pin'); if (r.set.film) assert.ok(film.clean(r.set.film), pk.id + ' film');
    if (r.set.imgfx) assert.ok(ix.clean(r.set.imgfx), pk.id + ' imgfx'); if (r.set.height) assert.ok(ht.clean(r.set.height), pk.id + ' height');
  }
  const fams = ['hero', 'services', 'about', 'gallery', 'testimonials', 'why', 'stats', 'cta', 'banner', 'faq', 'own'];
  const page = fams.map(f => ({ k: 'lib', f, v: 'x', pin: 'cover', film: 'brand:80' }));
  const bold = L.applyPack(page, L.PACKS.find(p => p.id === 'bold'));
  assert.deepEqual(bold[0], { k: 'lib', f: 'hero', v: 'x', height: 'screen' }); assert.equal(bold[1].pin, 'stack'); assert.deepEqual(bold[9], { k: 'lib', f: 'faq', v: 'x' });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 200; n++) {
    const out = L.surprise(page, rnd);
    assert.ok(!out[0].pin); const pins = out.map(b => b.pin).filter(Boolean); assert.equal(new Set(pins).size, pins.length, 'each card effect once');
    out.forEach((b, i) => { if (i && b.pin) assert.ok(!out[i - 1].pin, 'no two pinned in a row'); });
    assert.ok(out.filter(b => b.film).length <= 2); out.forEach(b => { if (b.pin) assert.ok(pin.clean(b.pin)); if (b.height) assert.ok(ht.clean(b.height)); });
  }
});
