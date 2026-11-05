const test = require('node:test');
const assert = require('node:assert');
const sf = require('../shapeform');

test('contact form with shapes: line, four colors, shapes switch; bad parts dropped; owner phone and email for the card', () => {
  const p = sf.parse(['text: We answer | fast', 'color: #2F3FD0', 'accent: orange', 'panel: #f5c518', 'bg: #e6e6e6', 'shapes: off', 'noise'].join('\n'));
  assert.deepEqual(p, { text: 'We answer fast', color: '#2f3fd0', accent: '', panel: '#f5c518', bg: '#e6e6e6', shapes: false });
  assert.equal(sf.cleanBody('bg: #ffffff\ntext: Hi\nshapes: on'), 'text: Hi\nbg: #ffffff');
  assert.equal(sf.cleanSide('right'), 'right'); assert.equal(sf.cleanSide('x'), 'left');
  const site = { theme: { primaryColor: '#f7c6cc' }, sections: { about: { imageUrl: '/uploads/about.jpg' }, contact: { phone: '(407) 555-0100', email: 'hi@paws.test' } } };
  const v = sf.view(site, { heading: 'Contact [us]', imageUrl: '/uploads/cut-me.webp' }, []);
  assert.equal(v.cut, true); assert.equal(v.tel, '4075550100'); assert.equal(v.email, 'hi@paws.test');
  assert.notEqual(v.headColor, '#f7c6cc', 'a pale color is darkened for the heading'); assert.match(v.headingHtml, /<em class="sg-hl">us<\/em>/);
  assert.equal(sf.view(site, {}, []).photo, '/uploads/about.jpg');
});
