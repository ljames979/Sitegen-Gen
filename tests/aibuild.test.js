const test = require('node:test');
const assert = require('node:assert');
const grounding = require('../grounding');
const aibuild = require('../aibuild');

const facts = grounding.quickFacts({ name: 'Joe Plumbing', type: 'plumber', city: 'Orlando, FL' });

test('markText marks only the sentences with claims, numbers or places the details do not back', () => {
  const r = grounding.markText('We fix leaks. We offer 24/7 emergency plumbing. We look no further.', facts, grounding.corpusOf(facts));
  assert.equal(r.text, 'We fix leaks. [Confirm with client] We offer 24/7 emergency plumbing. We look no further.');
  assert.deepEqual(r.marked, ['We offer 24/7 emergency plumbing.']);
  const again = grounding.markText(r.text, facts, grounding.corpusOf(facts));
  assert.equal(again.text, r.text);   // never marked twice
  const ok = grounding.quickFacts({ name: 'Joe Plumbing', type: 'plumber', badges: 'Licensed & Insured' });
  assert.deepEqual(grounding.markText('All our plumbers are licensed and insured.', ok, grounding.corpusOf(ok)).marked, []);
});

test('markBody leaves photo links, colors and owner facts alone', () => {
  const r = grounding.markBody('label: About us\ntext: Open 24/7.\ncard: https://x.test/123.jpg | #22aa33 | Repairs | 30 years of work\ncolor: #123456\nfact: 12 years in business', facts, grounding.corpusOf(facts));
  assert.equal(r.text, 'label: About us\ntext: [Confirm with client] Open 24/7.\ncard: https://x.test/123.jpg | #22aa33 | Repairs | [Confirm with client] 30 years of work\ncolor: #123456\nfact: 12 years in business');
});

test('markSections swaps claiming headings for the name (brackets in headings mean highlight) and SEO for plain text', () => {
  const s = { hero: { headline: 'Same-day plumbing', subheadline: 'Fast help.', ctaText: 'Get a Free Estimate' }, about: { heading: 'About', body: 'We are award-winning.' },
    services: { items: [{ title: 'Drains', description: 'Cleared in 2 hours.' }] }, faq: { items: [{ question: 'Insured?', answer: 'Yes, fully insured.' }] },
    blocks: { items: [{ type: 'x', heading: 'Top-rated plumbers', body: 'text: Hello.' }] }, seo: { title: 'Top-rated plumber in Orlando', description: 'Plumbing.' } };
  const list = grounding.markSections(s, facts);
  assert.equal(s.hero.headline, 'Joe Plumbing');
  assert.equal(s.hero.ctaText, 'Request a Quote');
  assert.match(s.about.body, /^\[Confirm with client\] We are award-winning/);
  assert.match(s.services.items[0].description, /^\[Confirm with client\]/);
  assert.match(s.faq.items[0].answer, /^\[Confirm with client\]/);
  assert.equal(s.blocks.items[0].heading, 'Joe Plumbing');
  assert.equal(s.seo.title, 'Joe Plumbing | plumber in Orlando, FL');
  assert.ok(list.length >= 5);
  assert.ok(list.some(x => /heading swapped/.test(x.where) && x.text === 'Same-day plumbing'));
});

test('checkCopy in guessed mode does not ask for services or questions the client listed', () => {
  const copy = { hero: { headline: 'Clear drains', subheadline: '', ctaText: '' }, about: '', services: [{ title: 'Drains', description: 'Cleared.' }], faq: [{ question: 'How?', answer: 'Call us.' }] };
  assert.equal(grounding.checkCopy(copy, facts, { guessed: true }).length, 0);
  assert.ok(grounding.checkCopy(copy, facts).length > 0);
});

test('checkRead keeps only details found in the pasted text', () => {
  const src = 'Bella Paws, mobile grooming. Call (407) 555-0123 or hi@bellapaws.test. Serving Kissimmee and St. Cloud. Since 2015. Licensed and insured. Full groom $85. "Bella did an amazing job with our poodle!" - Maria G. https://www.facebook.com/bellapaws';
  const got = aibuild.checkRead({ name: 'Bella Paws', phone: '(407) 555-0123', email: 'hi@bellapaws.test', years: String(new Date().getFullYear() - 2015), badges: ['Licensed', 'Fear Free certified'],
    areas: ['Kissimmee', 'Orlando'], services: [{ name: 'Full groom', price: '$85' }, { name: 'Teeth whitening', price: '$20' }],
    reviews: [{ quote: 'Bella did an amazing job with our poodle!', author: 'Maria G.' }, { quote: 'Best groomer in all of Florida', author: 'Tom' }],
    facebook: 'https://www.facebook.com/bellapaws', instagram: 'https://instagram.com/made-up' }, src);
  assert.equal(got.phone, '(407) 555-0123');
  assert.equal(got.email, 'hi@bellapaws.test');
  assert.equal(got.years_in_business, String(new Date().getFullYear() - 2015));
  assert.equal(got.badges, 'Licensed');
  assert.equal(got.service_areas, 'Kissimmee');
  assert.equal(got.services_list, 'Full groom | $85');
  assert.equal(got.reviews_list, 'Bella did an amazing job with our poodle! — Maria G.');
  assert.equal(got.facebook, 'https://www.facebook.com/bellapaws');
  assert.equal(got.instagram, undefined);
  assert.equal(aibuild.checkRead({ phone: '(321) 555-9999' }, src).phone, undefined);
});

test('readPaste without AI still finds the phone, email and links; fillBlanks keeps typed values', async () => {
  const got = await aibuild.readPaste('Call 407.555.0123, email a@b.test, https://instagram.com/abc');
  assert.equal(got.how, 'basic');
  assert.equal(got.fields.phone, '407.555.0123');
  assert.equal(got.fields.instagram, 'https://instagram.com/abc');
  const body = { phone: '111-222-3333', email: '' };
  assert.deepEqual(aibuild.fillBlanks(body, got.fields).sort(), ['email', 'instagram']);
  assert.equal(body.phone, '111-222-3333');
});

test('parseServices and parseReviews read the simple one-per-line format', () => {
  assert.deepEqual(aibuild.parseServices('Full groom | $85\nBath - $45\nNail trim'), [
    { name: 'Full groom', price: '$85', desc: '' }, { name: 'Bath', price: '$45', desc: '' }, { name: 'Nail trim', price: '', desc: '' }]);
  assert.deepEqual(aibuild.parseReviews('Great job with Max — Maria G.\nLoved it'), [{ quote: 'Great job with Max', author: 'Maria G.' }, { quote: 'Loved it', author: '' }]);
});

test('blockSlots never sends links, colors or service names; applyBlockWords drops claims and brackets', () => {
  const s = { about: { heading: 'About Us' }, services: { heading: 'What We Offer' },
    blocks: { items: [{ type: 'phototabs', heading: 'What we offer', buttonText: 'Contact Us', body: 'card: https://x.test/1.jpg | #112233 | Drains | Clearing drains.\ncolor: #445566' }] } };
  const slots = aibuild.blockSlots(s);
  const ids = slots.map(x => x.id);
  assert.deepEqual(ids, ['s.about.heading', 's.services.heading', 'b0.h', 'b0.btn', 'b0.l0.p3']);
  assert.ok(!JSON.stringify(slots).includes('https://') && !JSON.stringify(slots).includes('#112233') && !slots.some(x => x.text === 'Drains'));
  const n = aibuild.applyBlockWords(s, slots, JSON.stringify({ 's.about.heading': 'The [plumbers] next door', 's.services.heading': 'Open 24/7', 'b0.h': 'Drains and more', 'b0.l0.p3': 'Slow drains | cleared out' }), facts);
  assert.equal(n, 3);
  assert.equal(s.about.heading, 'The plumbers next door');
  assert.equal(s.services.heading, 'What We Offer');   // claim not used
  assert.equal(s.blocks.items[0].body, 'card: https://x.test/1.jpg | #112233 | Drains | Slow drains - cleared out\ncolor: #445566');
});
