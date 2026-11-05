const test = require('node:test');
const assert = require('node:assert');
const tb = require('../thirdsblock');

test('photo, words and a big letter: words and photos as typed, cleaned; the big box falls back to the first letter', () => {
  const body = 'bold: Subtly | decorated.\ntext: A paragraph\nstrong: Bold end\nbig: OPEN 7 DAYS\nleft: /uploads/a.jpg javascript:x /uploads/b.jpg /uploads/c.jpg /uploads/d.jpg /uploads/e.jpg\nright: https://x.test/r.jpg\nnoise: y';
  const p = tb.parse(body);
  assert.equal(p.bold, 'Subtly decorated.'); assert.equal(p.big, 'OPEN 7 DAYS');
  assert.deepEqual(p.left, ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', '/uploads/d.jpg']);
  assert.equal(tb.cleanBody(body), 'bold: Subtly decorated.\ntext: A paragraph\nstrong: Bold end\nbig: OPEN 7 DAYS\nleft: /uploads/a.jpg /uploads/b.jpg /uploads/c.jpg /uploads/d.jpg\nright: https://x.test/r.jpg');
  assert.equal(tb.parse('big: ' + 'x'.repeat(60)).big.length, 40);
  assert.equal(tb.cleanSide('brand'), 'brand'); assert.equal(tb.cleanSide('nope'), 'dark');
  assert.equal(tb.fit('N'), '--tb-len: 1; --tb-lines: 1');
  const v = tb.view({ name: 'northwind', sections: {} }, { heading: 'Good to [ride] in.', body: 'left: /uploads/a.jpg /uploads/b.jpg', side: 'light', buttonText: 'Read more', buttonUrl: '/x' }, []);
  assert.equal(v.big, 'N'); assert.equal(v.box, 'light'); assert.equal(v.turns, true);
  assert.deepEqual(v.link, { text: 'Read more', url: '/x' });
  assert.match(v.headingHtml, /ride/);
  assert.equal(tb.view({ sections: {} }, {}, []).big, '');
});
