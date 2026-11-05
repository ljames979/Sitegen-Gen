// Edit on the page (Blocks screen): words and photos matched back to the one box that holds them
const test = require('node:test');
const assert = require('node:assert');
const ie = require('../inlineedit');

const sample = () => ({
  hero: { headline: 'Fast [roof] repair', subheadline: 'We fix roofs', imageUrl: '/uploads/a-960.webp', ctaLink: '#contact' },
  about: { heading: 'About us', body: 'We fix roofs', imageUrl: '/uploads/b.jpg' },
  services: { items: [{ title: 'Repairs', description: 'Leaks fixed', imageUrl: '/uploads/c.jpg' }] },
  gallery: { images: ['/uploads/b.jpg', '/uploads/d.jpg'], alts: ['', ''] },
  faq: { items: [{ question: 'Same?', answer: 'Yes' }, { question: 'Same?', answer: 'No' }] },
});

test('inline edit: words go to the box that holds them, the clicked block\'s section first', () => {
  const s = sample();
  // the page shows the headline in capitals and without its [brackets]; the highlight stays on the words still there
  assert.deepEqual(ie.apply(s, { kind: 'text', old: 'FAST ROOF REPAIR', new: 'Quick roof repair', fam: 'hero' }), { ok: true, where: 'hero.headline' });
  assert.equal(s.hero.headline, 'Quick [roof] repair');
  // the same words in two sections: the clicked block's section wins
  assert.equal(ie.apply(s, { kind: 'text', old: 'We fix roofs', new: 'Roofs, fixed', fam: 'about' }).where, 'about.body');
  assert.equal(s.about.body, 'Roofs, fixed'); assert.equal(s.hero.subheadline, 'We fix roofs');
  assert.equal(ie.apply(s, { kind: 'text', old: 'Leaks fixed', new: 'Leaks found and fixed', fam: 'services' }).where, 'services.description');
  assert.equal(s.services.items[0].description, 'Leaks found and fixed');
  // a line break the page drew is not kept in a one-line box
  ie.apply(s, { kind: 'text', old: 'About us', new: 'About\nthe crew', fam: 'about' });
  assert.equal(s.about.heading, 'About the crew');
});
test('inline edit: nothing changes when the words are not in one box', () => {
  const s = sample(), before = JSON.stringify(s);
  assert.equal(ie.apply(s, { kind: 'text', old: 'Talk to Acme Roofing', new: 'x', fam: 'cta' }).ok, false, 'words the design writes');
  assert.equal(ie.apply(s, { kind: 'text', old: 'Same?', new: 'x', fam: 'faq' }).ok, false, 'the same words in two boxes');
  assert.equal(ie.apply(s, { kind: 'text', old: 'About us', new: '   ', fam: 'about' }).ok, false, 'empty');
  assert.equal(ie.apply(s, { kind: 'text', old: '#contact', new: '#x', fam: 'hero' }).ok, false, 'settings are not words');
  assert.equal(JSON.stringify(s), before);
});
test('inline edit: photos are matched by file (any size) and must be safe addresses', () => {
  const s = sample();
  assert.equal(ie.apply(s, { kind: 'photo', old: '/uploads/b-480.jpg', new: '/uploads/z.jpg', fam: 'gallery' }).where, 'gallery.0');
  assert.deepEqual(s.gallery.images, ['/uploads/z.jpg', '/uploads/d.jpg']); assert.equal(s.about.imageUrl, '/uploads/b.jpg');
  assert.equal(ie.apply(s, { kind: 'photo', old: '/uploads/b.jpg', new: 'javascript:alert(1)', fam: 'about' }).ok, false);
  assert.equal(ie.apply(s, { kind: 'photo', old: '/uploads/b.jpg', new: '/uploads/x.jpg" onerror="y', fam: 'about' }).ok, false);
  assert.ok(ie.photos(s).includes('/uploads/z.jpg'));
  assert.equal(ie.keepMarks('Hi {{big words|bold}} here', 'Hello big words there'), 'Hello {{big words|bold}} there');
});
