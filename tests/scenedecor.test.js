const test = require('node:test');
const assert = require('node:assert');
const sd = require('../scenedecor');
const mixPage = require('../mixpage');

test('scene decor values: a kind, a preset or own colors, and a size; anything else is dropped', () => {
  assert.equal(sd.clean('fence:glassblue:l'), 'fence:glassblue:l');
  assert.deepEqual(sd.parse('fence:glassblue:l').colors, { fill: '#d6ebf8', shade: '#a9d0ea', hi: '#ffffff' });
  assert.equal(sd.parse('fence:glassblue:l').h, 190);
  assert.equal(sd.parse('fence:glassblue:l').hm, 130);
  assert.equal(sd.parse('hedge:own-112233-445566-778899:s').colors.shade, '#445566');
  assert.equal(sd.own('#D6EBF8', '#a9d0ea', '#fff'), '');
  assert.equal(sd.own('#D6EBF8', '#a9d0ea', '#ffffff'), 'own-d6ebf8-a9d0ea-ffffff');
  ['', 'fence', 'fence:glassblue', 'wall:glassblue:l', 'fence:nope:l', 'fence:glassblue:huge', 'fence:own-12-34-56:l', 'fence:glassblue:l"><script>'].forEach(v => assert.equal(sd.clean(v), '', v));
});

test('scene decor markup: drawn, hidden from screen readers, with its heights; kept on the Blocks page item', () => {
  const h = sd.html('fence:glassblue:l');
  assert.match(h, /^<span class="sg-scene sg-scene-fence" aria-hidden="true" style="--sc-h: 190px; --sc-hm: 130px; background-image: url\(&quot;data:image\/svg\+xml,/);
  assert.ok(!/<svg/.test(h), 'the drawing is inside the url, encoded');
  assert.match(sd.html('hills:mint:m'), /background-size: 100% 100%/);
  assert.equal(sd.html('bad'), '');
  assert.deepEqual(sd.attrs('grass:garden:xl'), { cls: ' sg-has-scene', style: '--sc-room: 240px; --sc-roomm: 160px;' });
  assert.ok(sd.menu().some(o => o[0] === 'fence:glassblue' && o[1] === 'Picket fence, Glass Blue'));
  const m = mixPage.clean([{ k: 'blk', f: 'own', v: 'b1234567', scene: 'fence:glassblue:l' }, { k: 'blk', f: 'own', v: 'b7654321', scene: 'fence:nope:l' }]);
  assert.equal(m[0].scene, 'fence:glassblue:l');
  assert.equal(m[1].scene, undefined);
});
