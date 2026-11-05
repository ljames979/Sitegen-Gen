const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/palette.js');

test('palette: contrast math matches known values', () => {
  assert.equal(Math.round(P.contrast('#000000', '#ffffff')), 21);
  assert.equal(P.contrast('#fff', '#ffffff'), 1, 'short hex works');
  assert.ok(Math.abs(P.contrast('#767676', '#ffffff') - 4.54) < 0.05);
  assert.equal(P.parseHex('ABC'), '#aabbcc');
  assert.equal(P.parseHex('nope'), null);
});

test('palette: suggestions from any color keep buttons and dark areas readable', () => {
  for (const base of ['#e11d48', '#facc15', '#2563eb', '#16a34a', '#ffffff', '#000000', '#94a3b8', '#f97316']) {
    const set = P.suggestions(base);
    assert.ok(set.length >= 5, base);
    for (const s of set) {
      assert.ok(P.contrast(s.primary, '#ffffff') >= 4.5, `${base} ${s.name} primary ${s.primary}`);
      assert.ok(P.contrast(s.accent, '#ffffff') >= 4.5, `${base} ${s.name} accent ${s.accent}`);
      assert.match(s.primary + s.accent, /^#[0-9a-f]{6}#[0-9a-f]{6}$/);
    }
  }
  assert.deepEqual(P.suggestions('garbage'), []);
  // a dark color is kept as is
  assert.equal(P.suggestions('#1d4ed8')[0].primary, '#1d4ed8');
});

test('palette: ready-made palettes are readable and the business type ranks matches first', () => {
  for (const p of P.INDUSTRY) assert.deepEqual(P.check(p.primary, p.accent), [], p.id);
  const pets = P.industryFor('mobile pet grooming');
  assert.ok(pets[0].match && /pet/.test(pets[0].id));
  assert.equal(P.industryFor('').length, P.INDUSTRY.length);
  assert.ok(P.industryFor('roofing contractor').find(x => x.match && x.id === 'trade-orange'));
});

test('palette: readability check flags hard-to-read colors and offers a fix', () => {
  assert.deepEqual(P.check('#2563eb', '#1e293b'), []);
  const issues = P.check('#facc15', '#fde68a');
  assert.deepEqual(issues.map(i => i.level + ':' + i.what), ['bad:primary', 'bad:accent']);
  for (const i of issues) assert.ok(P.contrast(i.fix, '#ffffff') >= 4.5);
  assert.equal(P.check('#777777', '#1e293b')[0].level, 'warn');
  assert.equal(P.check('zzz', '#1e293b')[0].what, 'primary');
  assert.equal(P.check('#2563eb', '#2563eb')[0].what, 'both');
});

// build RGBA pixels: [[r,g,b,a,count], ...]
const px = (spec) => { const out = []; for (const [r, g, b, a, n] of spec) for (let i = 0; i < n; i++) out.push(r, g, b, a); return Uint8ClampedArray.from(out); };

test('palette: logo colors ignore the white/transparent background and rank colorful pixels first', () => {
  const data = px([[255, 255, 255, 255, 5000], [0, 0, 0, 0, 3000], [200, 16, 46, 255, 600], [20, 40, 120, 255, 300], [128, 128, 128, 255, 500]]);
  const cols = P.extract(data, 4);
  assert.equal(cols[0], '#c8102e', 'the red outranks bigger grey and white areas');
  assert.ok(cols.includes('#142878'));
  assert.ok(!cols.includes('#ffffff'));
  assert.deepEqual(P.extract(px([[255, 255, 255, 255, 100]])), [], 'an all-white image has no colors');
  assert.deepEqual(P.extract(new Uint8ClampedArray(0)), []);
  // near-identical shades merge into one color
  assert.equal(P.extract(px([[200, 16, 46, 255, 100], [204, 20, 50, 255, 100]]), 5).length, 1);
});

test('palette: the logo pair is readable and uses the logo colors', () => {
  const pair = P.fromLogo(['#c8102e', '#142878']);
  assert.ok(P.contrast(pair.primary, '#ffffff') >= 4.5 && P.contrast(pair.accent, '#ffffff') >= 4.5);
  assert.equal(pair.primary, '#c8102e');
  assert.ok(Math.abs(P.hexToHsl(pair.accent).h - 225) < 10, 'accent keeps the logo\'s second hue');
  assert.ok(P.fromLogo(['#facc15']).primary !== '#facc15', 'a too-light single color is darkened');
  assert.equal(P.fromLogo([]), null);
});
