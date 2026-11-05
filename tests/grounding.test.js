const test = require('node:test'); const assert = require('node:assert/strict');
const g = require('../grounding'); const intake = require('../intake');
const facts = () => g.buildFacts(intake.clean({ biz_name: 'Paws', biz_type: 'Dog groomer', city: 'Kissimmee', years: '9', areas: 'Kissimmee, St. Cloud', badges: 'Insured',
  svc_name: ['Full groom', 'Nail trim'], svc_desc: ['Bath, cut and dry', ''], svc_price: ['From $60', '$15'], diff_item: ['We answer the phone ourselves'], tone: 'friendly' }));
const text = (t) => g.checkText(t, facts());

test('plain text built from the facts passes', () => {
  assert.deepEqual(text('Paws is a dog groomer in Kissimmee. A full groom starts from $60 and a nail trim is $15.'), []);
  assert.deepEqual(text('Serving Kissimmee for 9 years. We are insured.'), []);
});
test('claims the client did not make are caught', () => {
  assert.ok(text('Our licensed groomers are the best in town').length >= 2);
  assert.ok(text('Free estimates on every job').length);
  assert.ok(text('Open 24/7 for emergencies').length);
  assert.ok(text('Family-owned and award-winning').length);
  assert.ok(text('100% satisfaction guaranteed').length);
  assert.ok(text('Over twenty years of experience').length);
  assert.ok(text('Trusted by hundreds of local pet owners').length);
});
test('claims the client did make are allowed', () => {
  const f = g.buildFacts(intake.clean({ biz_name: 'X', biz_type: 'Plumber', badges: 'Licensed and insured, 24/7 emergency service' }));
  assert.deepEqual(g.checkText('Licensed and insured, with 24/7 emergency service.', f), []);
});
test('numbers, places and filler', () => {
  assert.ok(text('We charge $99 per groom').some(r => /number/.test(r)));
  assert.ok(text('Serving families in Orlando').some(r => /place/.test(r)));
  assert.ok(text('Look no further for world-class care').some(r => /filler/.test(r)));
  assert.deepEqual(text('Get in touch today'), []);
});
test('checkCopy flags invented services, extra FAQ and bad fields', () => {
  const copy = { hero: { headline: 'Happy dogs', subheadline: '', ctaText: 'Request a Quote' }, about: 'Paws grooms dogs.', services: [{ title: 'Full groom', description: 'x', detail: '' }, { title: 'Dog training', description: 'y', detail: '' }], faq: [{ question: 'Q', answer: 'A' }] };
  const p = g.checkCopy(copy, facts());
  assert.ok(p.some(x => /did not list/.test(x.reason))); assert.ok(p.some(x => x.field === 'faq'));
  assert.deepEqual(g.checkCopy({ hero: { headline: 'Happy dogs' }, about: 'Paws grooms dogs.', services: [{ title: 'Full groom', description: 'Bath', detail: '' }], faq: [] }, facts()), []);
});
test('scrubSections replaces or removes unsupported wording and keeps the client\'s services and FAQ', () => {
  const f = facts(); f.faq = [{ q: 'Do you take walk-ins?', a: 'Yes, when we have room.' }];
  const s = { hero: { headline: 'Licensed groomers', subheadline: 'Free estimates, 24/7', ctaText: 'Get a Free Estimate' }, about: { body: 'We are the best.' },
    services: { items: [{ title: 'Full groom', description: 'Award-winning cuts', detail: '' }, { title: 'Pet taxi', description: 'x' }] },
    faq: { items: [{ question: 'Are you insured?', answer: 'Fully licensed.' }] }, blocks: { items: [{ heading: 'Why us', body: 'Guaranteed' }, { heading: 'Our process', body: 'You book, we groom.' }] },
    whyChoose: { items: [] }, seo: { title: 'The best Paws in town', description: 'Top-rated' } };
  const r = g.scrubSections(s, f);
  assert.equal(s.hero.headline, 'Paws'); assert.equal(s.hero.ctaText, 'Request a Quote'); assert.equal(s.hero.subheadline, '');
  assert.match(s.about.body, /Paws is a dog groomer serving Kissimmee/);
  assert.deepEqual(s.services.items.map(x => x.title), ['Full groom', 'Nail trim']);
  assert.equal(s.services.items[0].description, 'From $60 · Bath, cut and dry'); assert.equal(s.services.items[1].description, '$15');
  assert.deepEqual(s.faq.items, [{ question: 'Do you take walk-ins?', answer: 'Yes, when we have room.' }]);
  assert.equal(s.blocks.items.length, 1); assert.equal(s.seo.title, 'Paws | Dog groomer in Kissimmee');
  assert.ok(r.notes.length >= 5); assert.equal(r.hideFaq, false);
});
test('with no client FAQ, unsupported template answers are dropped and the FAQ is hidden', () => {
  const f = g.buildFacts(intake.clean({ biz_name: 'X', biz_type: 'Plumber' }));
  const s = { hero: { headline: 'X', subheadline: '', ctaText: 'Contact' }, about: { body: 'X is a plumber.' }, services: { items: [] }, faq: { items: [{ question: 'Emergency?', answer: 'Yes, 24/7.' }] }, blocks: { items: [] }, whyChoose: { items: [] }, seo: {} };
  assert.equal(g.scrubSections(s, f).hideFaq, true); assert.equal(s.faq.items.length, 0);
});
