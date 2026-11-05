const test = require('node:test');
const assert = require('node:assert');
const rg = require('../ringcard');

test('words and photo with rings: paragraphs, note, two colors, shapes switch; bad parts dropped; site photo when none', () => {
  const p = rg.parse(['text: One', 'text: Two | parts', 'text: Three', 'text: Four', 'note: Photo by us', 'color: #D9505E', 'bg: pink', 'shapes: off', 'noise'].join('\n'));
  assert.deepEqual(p, { text: ['One', 'Two parts', 'Three'], note: 'Photo by us', color: '#d9505e', bg: '', shapes: false });
  assert.equal(rg.cleanBody('bg: #ffffff\ntext: Hi\nshapes: on'), 'text: Hi\nbg: #ffffff');
  assert.equal(rg.cleanSide('left'), 'left'); assert.equal(rg.cleanSide('x'), 'right');
  const site = { theme: { primaryColor: '#f7c6cc' }, sections: { about: { imageUrl: '/uploads/about.jpg' } } };
  const v = rg.view(site, { heading: 'Why [dogs] love us', body: 'text: Hi', imageUrl: '/uploads/cut-dog.webp' }, []);
  assert.equal(v.cut, true); assert.equal(v.shapes, true);
  assert.equal(v.color, '#f7c6cc'); assert.notEqual(v.headColor, '#f7c6cc', 'a pale color is darkened for the heading');
  assert.equal(v.colorOn, '#111111'); assert.match(v.headingHtml, /<em class="sg-hl">dogs<\/em>/);
  assert.equal(rg.view(site, {}, []).photo, '/uploads/about.jpg');
});
