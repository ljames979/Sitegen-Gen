const test = require('node:test');
const assert = require('node:assert');
const oc = require('../overlapcard');

test('photo over a text card: paragraphs and a small note as typed; settings cleaned; the site photo when empty', () => {
  const p = oc.parse('One | two\n\n~ Photo by Jo <b>\nSecond\nThird\nFourth\nFifth');
  assert.deepEqual(p.text, ['One two', 'Second', 'Third', 'Fourth']); assert.equal(p.note, 'Photo by Jo <b>');
  assert.equal(oc.cleanBody('  Hi \n~  Credit  '), 'Hi\n~ Credit');
  assert.equal(oc.cleanBody('~'), '');
  assert.equal(oc.cleanSide('dots:tint:right'), 'dots:tint:right'); assert.equal(oc.cleanSide('x:y:z'), 'stripes:grey:left');
  assert.deepEqual(oc.settings('none:none:left'), { pattern: 'none', band: 'none', side: 'left', card: 'white', finish: 'flat', bottom: '', patColor: '', patFill: '', patFinish: 'flat' });
  const site = { sections: { about: { imageUrl: '/uploads/me.jpg' }, hero: { imageUrl: '/uploads/hero.jpg' } } };
  const v = oc.view(site, { heading: 'Why do we love [pets]?', body: 'Hello', side: 'grid:tint:right', buttonText: 'Read more', buttonUrl: '/about' }, []);
  assert.equal(v.photo, '/uploads/me.jpg'); assert.equal(v.pattern, 'grid'); assert.equal(v.band, 'tint'); assert.equal(v.side, 'right');
  assert.match(v.headingHtml, /<em class="sg-hl">pets<\/em>/);
  assert.deepEqual(v.button, { text: 'Read more', url: '/about' });
  assert.equal(oc.view(site, { imageUrl: '/uploads/cut-abc.webp' }, []).photo, '/uploads/cut-abc.webp');
  assert.equal(oc.view(site, { buttonText: 'x' }, []).button, null);
  assert.equal(oc.view({ sections: {} }, {}, []).photo, '');
});

test('photo over a text card: brand or own card color, flat or gradient, readable words, gradient background fades in', () => {
  const contrast = require('../contrast');
  assert.equal(oc.cleanSide('dots:tint:right:BRAND:gradient'), 'dots:tint:right:brand:gradient');
  assert.equal(oc.cleanSide('dots:tint:right:#AA3355:flat'), 'dots:tint:right:#aa3355:flat');
  assert.equal(oc.cleanSide('dots:tint:right:white:flat'), 'dots:tint:right', 'white and flat keeps the old value');
  assert.equal(oc.cleanSide('dots:tint:right:red;x:shiny'), 'dots:tint:right', 'bad color and finish fall back');
  const site = { theme: { primaryColor: '#1B2A4A' }, sections: {} };
  const brand = oc.view(site, { side: 'grid:grey:left:brand:flat' }, []);
  assert.equal(brand.card, 'brand'); assert.equal(brand.look.color, '#1b2a4a'); assert.equal(brand.look.ink, '#ffffff');
  assert.match(brand.style, /--oc-c:#1b2a4a;/); assert.equal(brand.fade, false);
  const light = oc.view(site, { side: 'grid:grey:left:#ffe08a:gradient', bg: 'g-aurora' }, []);
  assert.equal(light.card, 'own'); assert.equal(light.look.ink, '#111111', 'dark words on a light card');
  assert.equal(light.fade, true, 'a gradient background fades into the card color');
  // the words take the better of white or dark on the color, and the gradient only shades away from them
  ['#ffe08a', '#1b2a4a', '#e63946', '#2a9d8f', '#7b2cbf', '#888888'].forEach(c => {
    const l = oc.view(site, { side: `grid:grey:left:${c}:gradient` }, []).look;
    assert.equal(l.ink, contrast.textOn(c));
    [l.top, l.bottom].forEach(h => assert.ok(contrast.ratio(h, l.ink) >= contrast.ratio(c, l.ink), `the gradient never makes ${c} harder to read`));
    assert.ok(contrast.ratio(l.btnBg, l.btnInk) >= 3, `button on ${c}`);
  });
  const white = oc.view(site, { side: 'grid:grey:left:white:gradient' }, []).look;
  assert.equal(white.top, '#ffffff'); assert.notEqual(white.bottom, '#ffffff'); assert.equal(white.ink, '#111111');
  assert.equal(oc.view(site, { side: 'grid:grey:left', bg: 'g-aurora' }, []).fade, false, 'no fade on a white card');
});

test('photo over a text card: own colors for the top band, the bottom section and the pattern', () => {
  assert.equal(oc.cleanSide('dots:#AABBCC:left'), 'dots:#aabbcc:left');
  assert.equal(oc.cleanSide('dots:grey:left:white:flat:#FFEEDD:#112233'), 'dots:grey:left:white:flat:#ffeedd:#112233');
  assert.equal(oc.cleanSide('dots:grey:left:white:flat::#112233'), 'dots:grey:left:white:flat::#112233');
  assert.equal(oc.cleanSide('dots:grey:left:white:flat:red:x'), 'dots:grey:left', 'bad colors dropped');
  const v = oc.view({ sections: {} }, { side: 'dots:#aabbcc:left:white:flat:#ffeedd:#112233', bg: 'g-aurora' }, []);
  assert.equal(v.band, 'own'); assert.equal(v.bandColor, '#aabbcc'); assert.equal(v.bottom, '#ffeedd'); assert.equal(v.patColor, '#112233');
  assert.equal(v.style, '--oc-band:#aabbcc;--oc-under:#ffeedd;--oc-ink:#112233');
  assert.equal(oc.view({ sections: {} }, { side: 'dots:grey:left' }, []).style, '', 'nothing chosen: no style');
  assert.equal(oc.view({ sections: {} }, { side: 'dots:grey:left:#7b2cbf:flat:#ffeedd:', bg: 'g-aurora' }, []).fade, false, 'an own bottom color replaces the gradient');
});

test('photo over a text card: the shape behind the photo in an own color, flat or gradient, pattern on top', () => {
  assert.equal(oc.cleanSide('dots:grey:left:white:flat:::#FFD6E0:gradient'), 'dots:grey:left:white:flat:::#ffd6e0:gradient');
  assert.equal(oc.cleanSide('dots:grey:left:white:flat:::bad:gradient'), 'dots:grey:left', 'no fill, no finish');
  const v = oc.view({ sections: {} }, { side: 'dots:grey:left:white:flat::#e63946:#ffd6e0:gradient' }, []);
  assert.equal(v.patFill, '#ffd6e0'); assert.equal(v.patFinish, 'gradient');
  assert.match(v.style, /--oc-ink:#e63946;--oc-pfill:#ffd6e0;--oc-pfill2:#[0-9a-f]{6}$/); assert.doesNotMatch(v.style, /--oc-pfill2:#ffd6e0/);
  assert.match(oc.view({ sections: {} }, { side: 'none:grey:left:white:flat:::#ffd6e0:flat' }, []).style, /--oc-pfill:#ffd6e0;--oc-pfill2:#ffd6e0/);
  const css = require('fs').readFileSync(require('path').join(__dirname, '../public/sg-site.css'), 'utf8');
  assert.match(css, /\.sg-oc-pat-dots \.sg-oc-pat \{ background-image: radial-gradient\(var\(--oc-ink\) 1\.6px, transparent 1\.8px\), linear-gradient\(160deg, var\(--oc-pfill\), var\(--oc-pfill2\)\)/);
});
