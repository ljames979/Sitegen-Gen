const test = require('node:test');
const assert = require('node:assert');
const improve = require('../improve');

const mkSite = () => ({
  name: 'Sunny Paws', theme: { style: 'modern', bands: false, buttonShape: 'rounded' },
  layout: { order: ['about', 'services', 'faq', 'testimonials'], hidden: ['faq'], items: [] },
  sections: {
    meta: { businessType: 'dog grooming', city: 'Kissimmee, FL' },
    hero: { headline: 'Sunny Paws', subheadline: 'Dog grooming in Kissimmee.', ctaText: 'Submit', imageUrl: '/a.jpg' },
    about: { heading: 'About Us', body: 'We groom dogs of every size. [Confirm with client] We have 20 years of experience.' },
    services: { heading: 'What We Offer', items: [{ title: 'Full groom', description: 'Bath, cut and nails. Licensed groomers.' }, { title: 'Nail trim', description: 'Quick and calm.' }] },
    faq: { heading: 'FAQ', items: [{ question: 'Do you take big dogs?', answer: 'Yes.' }] },
    testimonials: { heading: 'Reviews', items: [{ quote: 'Lovely people', name: 'Ana' }] },
    trust: { badges: [], stats: [], serviceAreas: ['Kissimmee'] },
    contact: { phone: '407-555-0100', email: '', address: '' },
    hours: { items: [] }, gallery: { images: [] },
    seo: { title: '', description: '' },
    blocks: { items: [{ id: 'babcdefg', type: 'cta', heading: 'Ready for a fresh pup?', buttonText: 'Click here', body: '' }] }
  }
});

test('fieldMap offers wording only: never reviews, contact, service names or [Confirm with client] text', () => {
  const f = improve.fieldMap(mkSite());
  assert.ok(f['hero.headline'] && f['services.items.0.description'] && f['blk:b0.h'] && f['blk:b0.btn']);
  assert.equal(f['about.body'], undefined, 'text still waiting on the client is left alone');
  assert.ok(!Object.keys(f).some(k => /testimonials\.items|contact|services\.items\.\d+\.title/.test(k)));
  assert.equal(f['blk:b0.btn'].area, 'action');
});

test('facts leave out sentences marked [Confirm with client]', () => {
  const f = improve.siteFacts(mkSite());
  assert.doesNotMatch(f.extra, /20 years/);
  assert.match(f.extra, /Licensed groomers/);
});

test('quick checks work without AI: empty Google text, vague button, hidden section with content, tips', () => {
  const l = improve.localReview(mkSite());
  const ids = l.changes.map(c => c.id);
  assert.deepEqual(ids.sort(), ['hero.ctaText', 'seo.description', 'seo.title']);
  assert.equal(l.changes.find(c => c.id === 'seo.title').value, 'Sunny Paws | dog grooming in Kissimmee, FL');
  assert.deepEqual(l.show.map(x => x.key), ['faq']);
  assert.ok(l.tips.some(t => /Confirm with client/.test(t)));
});

test('AI suggestions are checked: invented claims are held back, unknown ids and bad look values ignored', async () => {
  const site = mkSite();
  const reply = {
    summary: 'Clearer headline and buttons.',
    changes: [
      { id: 'hero.headline', value: 'A calm, clean pup in Kissimmee', why: 'Says what you get.' },
      { id: 'hero.subheadline', value: 'Award-winning groomers open 24/7.', why: 'x' },
      { id: 'services.items.0.description', value: 'Bath, haircut and nails by licensed groomers.', why: 'Clearer.' },
      { id: 'blk:b0.btn', value: 'Book a Groom', why: 'Says what happens next.' },
      { id: 'contact.phone', value: '555', why: 'nope' },
      { id: 'seo.title', value: 'Dog Grooming in Kissimmee | Sunny Paws', why: 'Google.' },
      { id: 'hero.ctaText', value: 'Book a [Groom]', why: 'x' }
    ],
    look: [{ key: 'bands', value: true, why: 'Separates sections.' }, { key: 'corners', value: 'wobbly' }, { key: 'primaryColor', value: '#000' }],
    tips: ['Add a photo of a finished groom.']
  };
  const r = await improve.review(site, { complete: async () => JSON.stringify(reply) });
  assert.equal(r.how, 'ai');
  const by = Object.fromEntries(r.suggestions.map(s => [s.op.kind === 'text' ? s.op.id : s.op.kind + ':' + s.op.key, s]));
  assert.equal(by['hero.headline'].after, 'A calm, clean pup in Kissimmee');
  assert.ok(by['services.items.0.description'], 'licensed is already on the site, so it may stay');
  assert.equal(by['hero.ctaText'].after, 'Book a Groom', 'square brackets removed (they mean highlight)');
  assert.equal(by['seo.title'].after, 'Dog Grooming in Kissimmee | Sunny Paws', 'AI wins over the quick check');
  assert.ok(by['seo.description'], 'quick check fills what the AI skipped');
  assert.ok(by['theme:bands'] && by['show:faq']);
  assert.equal(by['contact.phone'], undefined); assert.equal(by['theme:corners'], undefined); assert.equal(by['theme:primaryColor'], undefined);
  assert.equal(r.held.length, 1); assert.match(r.held[0].reasons.join(' '), /award|24/);
  assert.ok(r.tips.includes('Add a photo of a finished groom.'));
  // order: wording first, look last
  assert.equal(r.suggestions[r.suggestions.length - 1].area, 'look');
});

test('a broken AI reply falls back to the quick checks', async () => {
  const r = await improve.review(mkSite(), { complete: async () => 'sorry' });
  assert.equal(r.how, 'failed');
  assert.ok(r.suggestions.length >= 3);
});

test('applySuggestions applies only the ticked ones, to copies, and skips parts that changed meanwhile', async () => {
  const site = mkSite();
  const reply = { changes: [
    { id: 'hero.headline', value: 'A calm, clean pup in Kissimmee' },
    { id: 'blk:b0.btn', value: 'Book a Groom' },
    { id: 'blk:b0.h', value: 'Book your pup in' },
    { id: 'services.items.1.description', value: 'A quick, calm nail trim.' }
  ], look: [{ key: 'bands', value: true }] };
  const r = await improve.review(site, { complete: async () => JSON.stringify(reply) });
  const sid = (pred) => r.suggestions.find(pred).sid;
  const pick = [sid(s => s.op.id === 'hero.headline'), sid(s => s.op.id === 'blk:b0.btn'), sid(s => s.op.id === 'services.items.1.description'), sid(s => s.op.kind === 'show'), sid(s => s.op.kind === 'theme')];
  site.sections.services.items[1].description = 'Leo changed this meanwhile.';
  const a = improve.applySuggestions(site, r.suggestions, pick);
  assert.equal(a.applied, 4); assert.equal(a.stale, 1);
  assert.equal(a.sections.hero.headline, 'A calm, clean pup in Kissimmee');
  assert.equal(a.sections.blocks.items[0].buttonText, 'Book a Groom');
  assert.equal(a.sections.blocks.items[0].heading, 'Ready for a fresh pup?', 'not ticked');
  assert.equal(a.sections.services.items[1].description, 'Leo changed this meanwhile.');
  assert.deepEqual(a.layout.hidden, []); assert.equal(a.theme.bands, true);
  assert.equal(site.sections.hero.headline, 'Sunny Paws', 'the site passed in is untouched');
});
