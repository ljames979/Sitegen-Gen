const test = require('node:test');
const assert = require('node:assert');
const pb = require('../photobanner');
const contrast = require('../contrast');

test('photo banner: settings fall back to words on the left, medium, brand button', () => {
  assert.equal(pb.cleanSide('right:tall:lime'), 'right:tall:lime');
  assert.equal(pb.cleanSide('auto'), pb.DEFAULT);
  assert.deepEqual(pb.settings('right:short:accent'), { text: 'right', size: 'short', button: 'accent', height: 420 });
});

test('photo banner: needs a heading, uses the hero photo when it has none of its own, italic words from brackets', () => {
  const site = { theme: { primaryColor: '#e11d48', accentColor: '#0f172a' }, sections: { hero: { imageUrl: '/uploads/hero.jpg' } } };
  assert.equal(pb.view(site, { heading: '  ' }), null);
  const v = pb.view(site, { heading: 'Imagine [this] <b>', body: 'One.\n\nTwo.', buttonText: 'Go', buttonUrl: '/contact', side: 'left:medium:lime' });
  assert.equal(v.headingHtml, 'Imagine <em class="sg-hl">this</em> &lt;b&gt;');
  assert.equal(v.image, '/uploads/hero.jpg'); assert.deepEqual(v.paras, ['One.', 'Two.']);
  assert.deepEqual(v.button, { text: 'Go', url: '/contact' });
  assert.match(v.vars, /--sc-rgb: \d+, \d+, \d+/); assert.match(v.vars, /--pb-btn: #d4f57a; --pb-btn-ink: #111111/);
  assert.equal(pb.view(site, { heading: 'Hi', imageUrl: '/uploads/own.jpg', buttonText: 'Go' }).button, null, 'a button needs a link');
  assert.equal(pb.view(site, { heading: 'Hi', imageUrl: '/uploads/own.jpg' }).image, '/uploads/own.jpg');
  const ink = /--pb-btn-ink: (#[0-9a-f]{6})/.exec(pb.styleVars(site.theme, 'brand'))[1];
  assert.ok(contrast.ratio(ink, '#e11d48') >= 3.5);
});
