const test = require('node:test');
const assert = require('node:assert');
const ab = require('../aboutblob');

test('about with phone: paragraphs, bold line and phone as typed; the site phone when empty; hidden with none', () => {
  const body = 'text: One | two\ntext: Second\ntext: Third\ntext: Fourth\nbold: Call us\nphone: +1 (234) 567-8910<script>\nnoise';
  const p = ab.parse(body);
  assert.deepEqual(p.text, ['One two', 'Second', 'Third']); assert.equal(p.bold, 'Call us'); assert.equal(p.phone, '+1 (234) 567-8910');
  assert.equal(ab.cleanBody('text: Hi\nphone: none'), 'text: Hi\nphone: none');
  assert.equal(ab.cleanSide('soft:right'), 'soft:right'); assert.equal(ab.cleanSide('x:y'), 'brand:left');
  const site = { sections: { contact: { phone: '(555) 010-2030' }, about: { imageUrl: '/uploads/me.jpg' }, hero: { imageUrl: '/uploads/hero.jpg' } } };
  const v = ab.view(site, { heading: 'About [us]', body: 'text: Hello', side: 'grey:right' }, []);
  assert.deepEqual(v.phone, { label: '(555) 010-2030', tel: '5550102030' });
  assert.equal(v.photo, '/uploads/me.jpg'); assert.equal(v.colors, 'grey'); assert.equal(v.side, 'right');
  assert.match(v.headingHtml, /About/);
  assert.equal(ab.view(site, { body: 'phone: none' }, []).phone, null);
  assert.deepEqual(ab.view(site, { body: 'phone: 0800 123', imageUrl: '/uploads/x.png' }, []).phone, { label: '0800 123', tel: '0800123' });
  assert.equal(ab.view({ sections: {} }, {}, []).phone, null);
});
