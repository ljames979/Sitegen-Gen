const test = require('node:test');
const assert = require('node:assert');
const fix = require('../suggestfix');

test('parse: the ways clients ask for a wording change', () => {
  assert.deepStrictEqual(fix.parse('Please change "Family owned since 2010" to "Family owned since 2008". Thanks!'), { from: 'Family owned since 2010', to: 'Family owned since 2008' });
  assert.deepStrictEqual(fix.parse('Can you replace “Book now” with “Call us”'), { from: 'Book now', to: 'Call us' });
  assert.deepStrictEqual(fix.parse('"Mon-Fri" should be "Mon-Sat"'), { from: 'Mon-Fri', to: 'Mon-Sat' });
  assert.deepStrictEqual(fix.parse('instead of "cheap" please say "affordable"'), { from: 'cheap', to: 'affordable' });
  assert.deepStrictEqual(fix.parse('remove "and more"'), { from: 'and more', to: '' });
  assert.strictEqual(fix.parse('Make the logo bigger please'), null);
});

test('locate and apply touch words only, never links or colors', () => {
  const sections = {
    hero: { headline: 'Best cakes in town', imageUrl: '/uploads/best-cakes-in-town.jpg', ctaText: 'Order cakes' },
    about: { body: 'We bake the best cakes in town. Really the best cakes in town.', color: '#best' },
    blocks: { items: [{ title: 'Best cakes in town', href: '/best cakes in town', story: 'Best cakes in town since 1999' }] },
    kit: { langs: { words: [['Best cakes in town', 'Los mejores pasteles']] } }
  };
  const hits = fix.locate(sections, 'best cakes in town');
  assert.deepStrictEqual(hits.map(h => h.place), ['About']);
  const r = fix.apply(sections, 'Best cakes in town', 'Fresh cakes daily');
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.sections.hero.headline, 'Fresh cakes daily');
  assert.strictEqual(r.sections.hero.imageUrl, '/uploads/best-cakes-in-town.jpg');
  assert.strictEqual(r.sections.blocks.items[0].href, '/best cakes in town');
  assert.strictEqual(r.sections.blocks.items[0].story, 'Fresh cakes daily since 1999');
  assert.strictEqual(r.sections.kit.langs.words[0][0], 'Best cakes in town');
  const rm = fix.apply({ about: { body: 'Fast, friendly and more service.' } }, 'and more', '');
  assert.strictEqual(rm.sections.about.body, 'Fast, friendly service.');
});
