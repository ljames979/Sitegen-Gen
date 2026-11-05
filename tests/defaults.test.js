const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaultSections } = require('../defaults');

test('defaultSections does not include a fabricated testimonial', () => {
  const sections = defaultSections();
  assert.deepEqual(sections.testimonials.items, []);
});

test('defaultSections includes an empty about.imageUrl field', () => {
  const sections = defaultSections();
  assert.equal(sections.about.imageUrl, '');
});
