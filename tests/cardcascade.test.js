const test = require('node:test');
const assert = require('node:assert');
const cc = require('../cardcascade');

test('card cascade: settings fall back to medium, normal speed, all content', () => {
  assert.equal(cc.cleanSide('tall:fast:mine'), 'tall:fast:mine');
  assert.equal(cc.cleanSide('huge:fast:mine'), cc.DEFAULT);
  assert.equal(cc.cleanSide('medium:gentle:normal:all'), cc.DEFAULT, 'a brand wall setting is not a cascade setting');
  assert.deepEqual(cc.settings('short:slow:all'), { size: 'short', speed: 'slow', content: 'all', height: 420, secs: 14 });
});

test('card cascade: cards zig-zag from the top to the bottom and stay inside the block', () => {
  const at = cc.place(10);
  assert.equal(at[0].y, 0); assert.equal(at[9].y, 1);
  at.forEach(p => { assert.ok(p.x >= 0 && p.x <= 1); assert.ok(p.y >= 0 && p.y <= 1); });
  assert.ok(at[4].x > at[0].x && at[8].x < at[4].x, 'swings right then back left');
  assert.deepEqual(cc.place(1), [{ x: 0.08, y: 0.5 }]);
});

test('card cascade: cards come from the site and the owner, at most 10, only the owner\'s when asked', () => {
  const site = { name: 'Wave Co', theme: { primaryColor: '#e11d48', accentColor: '#0f172a' },
    sections: { hero: { headline: 'Strategy that moves the needle' }, services: { items: [{ title: 'Brand' }, { title: 'Revenue' }] }, trust: { badges: ['Licensed'] } } };
  const all = cc.cards(site, { body: 'Built to last\n/uploads/a.jpg', side: 'medium:normal:all' });
  assert.ok(all.length <= cc.MAX && all.length > 4);
  assert.ok(all.some(c => c.kind === 'service' && c.text === 'Brand'));
  assert.ok(all.some(c => c.kind === 'photo' && c.src === '/uploads/a.jpg'));
  all.forEach((c, i) => assert.equal(c.i, i));
  const mine = cc.cards(site, { body: 'Built to last\n/uploads/a.jpg', side: 'medium:normal:mine' });
  assert.ok(!mine.some(c => c.kind === 'service'));
  assert.ok(mine.some(c => c.kind === 'line' && c.text === 'Built to last'));
});
