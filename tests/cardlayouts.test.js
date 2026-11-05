const test = require('node:test'); const assert = require('node:assert/strict');
const cl = require('../cardlayouts');

test('card layouts: parse keeps only known arrangements and footers', () => {
  assert.deepEqual(cl.parse({ theme_cards_services: 'zigzag', theme_cards_why: 'spin', theme_cards_gallery: 'list', theme_cards_testimonials: 'scroll', theme_footerStyle: 'wordmark' }),
    { cards: { services: 'zigzag', testimonials: 'scroll' }, footerStyle: 'wordmark' }, 'gallery cannot be one per row');
  assert.deepEqual(cl.parse({ theme_cards_services: '', theme_footerStyle: 'disco' }), { cards: {}, footerStyle: '' });
  assert.deepEqual(cl.cleanCards({ services: 'cols2', why: 'nope', other: 'cols3' }), { services: 'cols2' });
  assert.ok(!cl.allowed('gallery').includes('zigzag')); assert.ok(cl.allowed('services').includes('zigzag'));
});

test('card layouts: css carries only the rules in use', () => {
  assert.equal(cl.css({}), ''); assert.equal(cl.css({ cards: {}, footerStyle: '' }), '');
  const css = cl.css({ cards: { services: 'feature' }, footerStyle: 'brand' });
  assert.match(css, /\[data-sg-cards="services"\], \[data-sg-section\^="services\/"\] \[data-sg-cards\]/);
  assert.match(css, /grid-row: span 2/); assert.doesNotMatch(css, /data-sg-cards="why"/);
  assert.match(css, /data-foot="brand"/); assert.doesNotMatch(css, /data-foot="wordmark"/);
  for (const a of cl.ARRANGEMENTS.filter(a => a.id)) assert.ok(cl.ruleFor('why', a.id).length > 20, a.id);
});
