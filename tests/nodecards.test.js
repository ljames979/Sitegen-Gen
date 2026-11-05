const { test } = require('node:test');
const assert = require('node:assert/strict');
const nc = require('../nodecards');
const fs = require('fs');
const path = require('path');

const site = { name: 'Acme', sections: { hero: { imageUrl: '/uploads/h.jpg' }, gallery: { images: ['/uploads/a.jpg', '/uploads/b.jpg', 'javascript:x'] }, services: { items: [] } } };

test('connected photo cards: the body keeps only small words, photo cards and word cards, cleaned', () => {
  const body = 'sub: We plan | and build\nsub: two\nsub: three\nsub: four\ncard: Roofs | Since 1998 | /uploads/r.jpg javascript:alert(1) http://plain.test/p.jpg /uploads/r.jpg\ntext: Note |  | We listen first\ntext: Empty | x | \nnonsense line\ncard:  |  | ';
  const p = nc.parse(body);
  assert.deepEqual(p.sub, ['We plan and build', 'two', 'three']);
  assert.deepEqual(p.cards, [{ label: 'Roofs', tag: 'Since 1998', words: '', pics: ['/uploads/r.jpg'] }, { label: 'Note', tag: '', words: 'We listen first', pics: [] }]);
  assert.equal(nc.cleanBody(body), 'sub: We plan and build\nsub: two\nsub: three\ncard: Roofs | Since 1998 | /uploads/r.jpg\ntext: Note |  | We listen first');
  assert.equal(nc.parse(Array(9).fill('card: A | B | /uploads/a.jpg').join('\n')).cards.length, nc.MAX_CARDS);
  assert.equal(nc.cleanSide('slide'), 'slide'); assert.equal(nc.cleanSide('<x>'), 'auto');
});

test('connected photo cards: staggered columns, every photo card borrows the site\'s photos so its pictures change', () => {
  const v = nc.view(site, { heading: 'Bright [ideas]', body: 'sub: Small words\ncard: Roofs | Since 1998 | /uploads/r.jpg\ncard: Gutters | | \ntext: Note | | We listen first\ncard: Repairs | | \ncard: Paint | | ', buttonText: 'Call', buttonUrl: '/contact' }, []);
  assert.match(v.headingHtml, /<em class="sg-hl">ideas<\/em>/); assert.deepEqual(v.sub, ['Small words']);
  assert.deepEqual(v.cols.map(c => c.cards.length), [2, 1, 2]); assert.equal(v.grid, '.85fr 1.3fr .85fr');
  assert.equal(v.cols[0].cards[0].pics[0], '/uploads/r.jpg'); assert.ok(v.cols[0].cards.every(c => c.pics.length === 3));
  assert.notEqual(v.cols[0].cards[0].pics.join(), v.cols[0].cards[1].pics.join());
  assert.equal(v.cols[1].cards[0].words, 'We listen first'); assert.ok(v.changes); assert.deepEqual(v.button, { text: 'Call', url: '/contact' });
  // "don't change": one photo a card, no turns
  const s = nc.view(site, { body: 'card: A | | \ncard: B | | \ncard: C | | ', side: 'still' }, []);
  assert.ok(s.cols.every(c => c.cards.every(x => x.pics.length === 1))); assert.equal(s.changes, false);
  // no cards: the services, with their photos; too little to show: null
  const fromSvc = nc.view(site, {}, [{ title: 'Roofs', imageUrl: '/uploads/s1.jpg' }, { title: 'Gutters' }, { title: 'Siding' }]);
  assert.deepEqual(fromSvc.cols.flatMap(c => c.cards.map(x => x.label)), ['Roofs', 'Gutters', 'Siding']); assert.equal(fromSvc.cols[0].cards[0].pics[0], '/uploads/s1.jpg');
  assert.equal(nc.view({ sections: {} }, { body: 'card: A | | \ncard: B | | \ncard: C | | ' }, []), null);
  assert.equal(nc.view(site, { body: 'text: A | | x\ntext: B | | y\ncard: C | | ' }, []), null);
});

test('connected photo cards: the lines and picture turns are in the page script, and stay still with motion off', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8');
  assert.match(js, /\[data-sg-nodes\]/); assert.match(js, /if \(still \|\| box\.getAttribute\('data-change'\) === 'still'/);
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n  \.sg-nc-fade \.sg-nc-pics img\.sg-in/);
  assert.doesNotMatch(js + css, /weavy/i);
});

test('connected photo cards: words that take turns on the heading\'s last line (Leo, 2026-10-31)', () => {
  const body = 'roll: move.\nsub: Small\nroll: stand | out.\nroll:   \ncard: A | | /uploads/a.jpg\ncard: B | | \ncard: C | | ';
  assert.deepEqual(nc.parse(body).roll, ['move.', 'stand out.']);
  assert.equal(nc.cleanBody(body), 'roll: move.\nroll: stand out.\nsub: Small\ncard: A |  | /uploads/a.jpg\ncard: B |  | \ncard: C |  | ');
  assert.equal(nc.parse(Array(9).fill('roll: x').join('\n')).roll.length, 6);
  const v = nc.view(site, { heading: 'We make brands', body }, []);
  assert.deepEqual(v.roll, ['move.', 'stand out.']); assert.equal(v.rolls, true);
  assert.equal(nc.view(site, { heading: 'We make brands', body: 'roll: move.\ncard: A | | \ncard: B | | \ncard: C | | ' }, []).rolls, false);
});
