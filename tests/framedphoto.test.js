const test = require('node:test');
const assert = require('node:assert');
const fp = require('../framedphoto');
const rp = require('../roundphoto');

test('photo in frames with a card: paragraphs, note, three colors; bad parts dropped; defaults and site photo', () => {
  const p = fp.parse(['text: One', 'text: Two | x', 'text: 3', 'text: 4', 'note: By us', 'color: #B9A383', 'bg: dark', 'card: #fff4e0', 'noise'].join('\n'));
  assert.deepEqual(p, { text: ['One', 'Two x', '3'], note: 'By us', color: '#b9a383', bg: '', card: '#fff4e0' });
  assert.equal(fp.cleanBody('card: #ffffff\ntext: Hi'), 'text: Hi\ncard: #ffffff');
  assert.equal(fp.cleanSide('left'), 'left'); assert.equal(fp.cleanSide('x'), 'right');
  const site = { sections: { about: { imageUrl: '/uploads/about.jpg' } } };
  const v = fp.view(site, { heading: 'Our [menu]' }, []);
  assert.equal(v.photo, '/uploads/about.jpg'); assert.equal(v.bg, '#2b2b2b'); assert.equal(v.card, '#ffffff'); assert.equal(v.ink, '#111111');
  assert.notEqual(v.headColor, '#b9a383', 'the tan heading is darkened enough to read on white');
  assert.equal(fp.view(site, { body: 'card: #1b2a4a', imageUrl: '/uploads/cut-a.webp' }, []).ink, '#ffffff');
});

test('round photo with a color card: paragraphs, note, two colors, shapes switch; text color follows the card color', () => {
  const p = rp.parse(['text: One', 'note: By us', 'color: #2EC4B6', 'bg: #ffffff', 'shapes: off'].join('\n'));
  assert.deepEqual(p, { text: ['One'], note: 'By us', color: '#2ec4b6', bg: '#ffffff', shapes: false });
  assert.equal(rp.cleanBody('shapes: on\nbg: #000000'), 'bg: #000000');
  const site = { theme: { primaryColor: '#1b2a4a' }, sections: { about: { imageUrl: '/uploads/about.jpg' } } };
  const v = rp.view(site, { imageUrl: '/uploads/cut-me.webp' }, []);
  assert.equal(v.color, '#1b2a4a'); assert.equal(v.on, '#ffffff'); assert.equal(v.cut, true); assert.equal(v.shapes, true);
  assert.equal(rp.view(site, { body: 'color: #2ec4b6' }, []).on, '#111111');
});
