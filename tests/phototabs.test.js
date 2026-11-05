const test = require('node:test');
const assert = require('node:assert');
const pt = require('../phototabs');

test('photo picks the words: up to 4 cards with photo, color, title and words; bad parts dropped; brand color and site photos fill gaps', () => {
  const body = ['card: /uploads/a.jpg | #1D6FA5 | Puppy classes | Start early | really', 'card: javascript:x | red | Walks | Daily walks',
    'card:  |  |  | ', 'card: /uploads/c.jpg | #f4d03f | Agility | Jump', 'card: /uploads/d.jpg | | Four | 4', 'card: /uploads/e.jpg | | Five | 5', 'noise'].join('\n');
  const p = pt.parse(body);
  assert.equal(p.cards.length, 4);
  assert.deepEqual(p.cards[0], { photo: '/uploads/a.jpg', color: '#1d6fa5', title: 'Puppy classes', text: 'Start early really' });
  assert.deepEqual(p.cards[1], { photo: '', color: '', title: 'Walks', text: 'Daily walks' });
  assert.equal(pt.cleanBody('card: /uploads/a.jpg | #ffffff | A | B'), 'card: /uploads/a.jpg | #ffffff | A | B');
  assert.equal(pt.cleanSide('right'), 'right'); assert.equal(pt.cleanSide('x'), 'left');
  const site = { theme: { primaryColor: '#225588' }, sections: { hero: { imageUrl: '/uploads/hero.jpg' } } };
  const v = pt.view(site, { heading: 'Dog [training]', body, buttonText: 'Contact us', buttonUrl: '/contact' }, []);
  assert.equal(v.tabs, true); assert.equal(v.cards[1].photo, '/uploads/hero.jpg', 'a card without a photo borrows a site photo');
  assert.equal(v.cards[1].color, '#225588', 'a card without a color takes the brand color');
  assert.equal(v.cards[0].on, '#ffffff'); assert.equal(v.cards[2].on, '#111111', 'dark words on a light card color');
  const one = pt.view(site, { heading: 'Dog [training]' }, []);
  assert.equal(one.cards.length, 1); assert.equal(one.tabs, false); assert.match(one.cards[0].titleHtml, /<em class="sg-hl">training<\/em>/, 'the heading titles a lone card');
  assert.equal(one.cards[0].photo, '/uploads/hero.jpg');
});
