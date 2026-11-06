const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/colorlabel.js');

test('colorlabel: codes are shown like 880D1E', () => {
  assert.equal(C.label('#880d1e'), '880D1E');
  assert.equal(C.label('abc'), 'AABBCC');
  assert.equal(C.label('nope'), '');
  assert.equal(C.cssToHex('rgb(136, 13, 30)'), '#880d1e');
  assert.equal(C.cssToHex('rgba(0, 0, 0, 0)'), null, 'see-through has no code');
});

test('colorlabel: plain names for common colors', () => {
  assert.equal(C.name('#ffffff'), 'White');
  assert.equal(C.name('#000000'), 'Black');
  assert.equal(C.name('#ff0000'), 'Red');
  assert.equal(C.name('#000080'), 'Navy');
  assert.equal(C.name('#008080'), 'Teal');
  assert.match(C.name('#880d1e'), /red|maroon|burgundy|wine/i);
  assert.match(C.name('#cbeef3'), /blue|cyan|turquoise/i);
  assert.equal(C.name('nope'), '');
  const names = C.NAMES.map(n => n[0]);
  assert.equal(new Set(names).size, names.length, 'no name twice');
});

test('colorlabel: five shades, darkest to lightest, same hue', () => {
  for (const base of ['#880d1e', '#2563eb', '#16a34a', '#808080', '#ffffff', '#000000', '#facc15']) {
    const s = C.shades(base);
    assert.equal(s.length, 5, base);
    s.forEach(x => assert.match(x, /^#[0-9a-f]{6}$/));
    const lum = s.map(x => parseInt(x.slice(1, 3), 16) + parseInt(x.slice(3, 5), 16) + parseInt(x.slice(5, 7), 16));
    for (let i = 1; i < 5; i++) assert.ok(lum[i] > lum[i - 1], `${base} shade ${i} lighter`);
    const i = C.nearestStep(base); assert.ok(i >= 0 && i < 5);
  }
  assert.equal(C.nearestStep('#000000'), 0);
  assert.equal(C.nearestStep('#ffffff'), 4);
  C.shades('#808080').forEach(x => assert.ok(x.slice(1, 3) === x.slice(3, 5) && x.slice(3, 5) === x.slice(5, 7), 'grey stays grey ' + x));
  assert.equal(C.inkOn('#ffffff'), '#1f2937');
  assert.equal(C.inkOn('#000000'), '#ffffff');
});
