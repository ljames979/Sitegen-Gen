const test = require('node:test');
const assert = require('node:assert');
const cb = require('../crossband');

test('card over a color band: words, checklist, photos and colors as typed; brand colors when not picked; readable card words', () => {
  const body = 'text: Hello | there\nlist: Dogs improve your mood:\n' + Array.from({ length: 8 }, (_, i) => `item: Point ${i}`).join('\n') +
    '\nleft: /uploads/a.jpg bad /uploads/b.jpg\nright: https://x.test/c.jpg\ncard: #E3808C\nband: nope\nnoise: y';
  const p = cb.parse(body);
  assert.equal(p.text, 'Hello there'); assert.equal(p.items.length, 6); assert.deepEqual(p.left, ['/uploads/a.jpg', '/uploads/b.jpg']);
  assert.equal(p.card, '#e3808c'); assert.equal(p.band, '');
  assert.match(cb.cleanBody(body), /^text: Hello there\nlist: Dogs improve your mood:\nitem: Point 0/);
  assert.doesNotMatch(cb.cleanBody(body), /band:/);
  const c = cb.colors({ card: '', band: '' }, { primaryColor: '#1d4ed8', accentColor: '#f59e0b' });
  assert.equal(c.card, '#1d4ed8'); assert.equal(c.ink, '#ffffff');
  assert.equal(cb.colors({ card: '#ffe066', band: '#a9c9e8' }, {}).ink, '#111111');
  const v = cb.view({ theme: {}, sections: {} }, { heading: 'Why [dogs]', body: 'left: /uploads/a.jpg /uploads/b.jpg', buttonText: 'Learn more', buttonUrl: '/x' }, []);
  assert.equal(v.turns, true); assert.deepEqual(v.button, { text: 'Learn more', url: '/x' }); assert.match(v.style, /--cb-card: #2563eb/);
});
