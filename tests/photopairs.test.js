const test = require('node:test');
const assert = require('node:assert');
const pp = require('../photopairs');

test('photo and words pairs: label, up to 4 pairs, color, shapes; bad photos dropped; site photos fill the gaps', () => {
  const body = ['label: Kids | code', 'pair: /uploads/a.jpg | Math | Sums | more', 'pair: javascript:x | Games | Fun', 'pair:  |  | ', 'pair: | C | c', 'pair: | D | d', 'pair: | E | e', 'color: #12B5C4', 'shapes: off', 'noise'].join('\n');
  const p = pp.parse(body);
  assert.equal(p.label, 'Kids code'); assert.equal(p.pairs.length, 4);
  assert.deepEqual(p.pairs[0], { photo: '/uploads/a.jpg', title: 'Math', text: 'Sums more' });
  assert.equal(p.pairs[1].photo, ''); assert.equal(p.color, '#12b5c4'); assert.equal(p.shapes, false);
  assert.equal(pp.cleanBody('shapes: on\ncolor: red\npair: | T | w'), 'pair:  | T | w');
  assert.equal(pp.cleanSide('left'), 'center');
  const site = { theme: { primaryColor: '#1b2a4a' }, sections: { about: { imageUrl: '/uploads/about.jpg' } } };
  const v = pp.view(site, { heading: 'Learn', body: 'pair: /uploads/cut-x.webp | A | a\npair: | B | b' }, []);
  assert.equal(v.pairs[0].cut, true); assert.equal(v.pairs[1].photo, '/uploads/about.jpg');
  assert.equal(v.color, '#1b2a4a'); assert.equal(v.on, '#ffffff'); assert.equal(v.shapes, true); assert.equal(v.button, null);
  assert.equal(pp.view(site, {}, []).pairs.length, 1, 'an empty block still shows one pair');
});
