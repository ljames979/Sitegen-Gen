const { test } = require('node:test');
const assert = require('node:assert/strict');
const sk = require('../stackcards');

const site = { name: 'Acme', sections: { hero: { imageUrl: '/uploads/h.jpg' }, gallery: { images: ['/uploads/a.jpg'] }, services: { items: [] } } };

test('stacked cards: the body keeps the label, the owner\'s rating, the colors and up to 8 cards, cleaned', () => {
  const body = 'label: Customer | love\nrating: 4.74 | from 40 <b>reviews</b>\ncolors: neon\ncard: Ann | Owner | 9 | javascript:alert(1) | Great | work\ncard:  |  |  | /uploads/p.jpg | \nnonsense';
  const p = sk.parse(body);
  assert.equal(p.label, 'Customer love'); assert.equal(p.rating, 4.5); assert.equal(p.ratingText, 'from 40 <b>reviews</b>'); assert.equal(p.colors, 'soft');
  assert.deepEqual(p.cards[0], { name: 'Ann', line: 'Owner', stars: 5, photo: '', words: 'Great work' });
  assert.equal(p.cards[1].photo, '/uploads/p.jpg');
  assert.equal(sk.cleanBody(body), 'label: Customer love\nrating: 4.5 | from 40 <b>reviews</b>\ncard: Ann | Owner | 5 |  | Great work\ncard:  |  |  | /uploads/p.jpg | ');
  assert.equal(sk.parse(Array(12).fill('card: A | | | | x').join('\n')).cards.length, sk.MAX);
  assert.equal(sk.cleanSide('12'), '8'); assert.equal(sk.cleanSide('1'), '2'); assert.equal(sk.cleanSide('x'), '4');
});

test('stacked cards: as many cards as picked; plain cards borrow site photos; nothing made up', () => {
  const v = sk.view(site, { heading: 'Loved [locally]', side: '3', body: 'card: Ann | Owner | 5 |  | Great work' }, []);
  assert.equal(v.cards.length, 3); assert.match(v.headingHtml, /<em class="sg-hl">locally<\/em>/);
  assert.equal(v.cards[0].photo, ''); assert.equal(v.cards[0].plain, false);
  assert.ok(v.cards[1].plain && v.cards[1].photo); assert.notEqual(v.cards[1].photo, v.cards[2].photo);
  assert.equal(v.rating, null); assert.equal(v.label, ''); assert.equal(v.ratingText, '');
  const r = sk.view(site, { body: 'rating: 4.5 | from 40 reviews' }, []);
  assert.deepEqual(r.rating, { full: 4, half: true, empty: 0, value: 4.5 }); assert.equal(r.cards.length, 4);
});
