const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/shapeart.js');
const pics = require('../picboxes');
const fonts = require('../fonts');

test('shapeart: every shape and stamp draws one-color SVG with no outside files', () => {
  for (const [, items] of A.shapeMenu()) for (const [art] of items) {
    const s = A.svg(art, { on: true });
    assert.match(s, /^<svg class="sg-shape on" viewBox="[\d. ]+"/, art);
    assert.match(s, /currentColor/, art);
    assert.doesNotMatch(s, /href="http|<image|<script/i, art);
  }
  for (const [art] of A.stampMenu()) {
    const s = A.svg(art, { uid: 'pabc1234', text: 'Rose Bakery', sub: 'Fresh daily' });
    assert.match(s, /class="sg-stamp"/, art);
    assert.match(s, /ROSE BAKERY/, art);
    assert.match(s, /filter="url\(#sginkpabc1234\)"/, art);
  }
  const ids = A.SHAPES.map(s => s.id).concat(A.STAMPS.map(s => s.id));
  ids.forEach(id => assert.match(id, /^[a-z]{1,20}$/));
  assert.equal(new Set(A.SHAPES.map(s => s.id)).size, A.SHAPES.length);
  assert.ok(A.shapeMenu().some(g => g[0] === 'Odd shapes'));
  assert.equal(A.svg('shape-nope'), '');
  assert.equal(A.isArt('stamp-round'), true);
  assert.equal(A.isArt('stamp-<x>'), false);
});

test('shapeart: stamp words are cleaned and escaped', () => {
  const s = A.svg('stamp-rect', { uid: 'x', text: '<b>Tom & "Jerry"</b>', sub: '' });
  assert.doesNotMatch(s, /<b>/);
  assert.match(s, /TOM &amp; &quot;JERRY&quot;/);
  assert.equal(A.cleanText('a'.repeat(99), A.MAX_TEXT).length, A.MAX_TEXT);
  assert.match(A.svg('stamp-seal', { uid: 'x' }), /YOUR WORDS/, 'empty words get a stand-in');
});

test('picboxes: shapes and stamps are kept, colored and drawn on the page', () => {
  const [shape, stamp, bad] = pics.clean([
    { id: 'pabcdefg', page: 'home', at: 'hero', art: 'shape-sparkle', color: 'accent', x: 5, y: 5, w: 10, h: 10 },
    { id: 'phijklmn', page: 'home', at: 'hero', art: 'stamp-round', text: 'Rose <Bakery>', sub: 'Est 2020', color: '#880d1e' },
    { id: 'popqrstu', page: 'home', at: 'hero', art: 'shape-<script>' }
  ]);
  assert.equal(shape.art, 'shape-sparkle');
  assert.equal(shape.text, undefined);
  assert.equal(stamp.text, 'Rose Bakery');
  assert.equal(stamp.sub, 'Est 2020');
  assert.equal(bad.art, 'turns', 'an unknown art falls back');
  assert.match(pics.html(shape), /color:var\(--accent\)/);
  assert.match(pics.html(shape), /<svg class="sg-shape on"/);
  assert.match(pics.html(stamp), /color:#880d1e/);
  assert.match(pics.html(stamp), /ROSE BAKERY/);
  assert.ok(pics.isInk(shape) && pics.isInk(stamp));
});

test('fonts: special fonts are a group of single-weight Google fonts', () => {
  assert.ok(fonts.SPECIAL.length >= 8);
  for (const f of fonts.SPECIAL) {
    assert.equal(f.group, 'Special fonts');
    assert.equal(fonts.cleanFontName(f.name), f.name);
    assert.ok(f.look && f.single, f.name);
  }
  assert.equal(new Set(fonts.FONTS.map(f => f.name)).size, fonts.FONTS.length, 'no font listed twice');
});
