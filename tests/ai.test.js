const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCopy, buildPrompt } = require('../ai');

const good = {
  hero: { headline: 'Roofs that last', subheadline: 'Plain-spoken roofing.', ctaText: 'Request a Quote' },
  about: 'We fix roofs.',
  services: [{ title: 'Repair', description: 'Leaks and storm damage.' }, { title: 'Replacement', description: 'New roofs.' }],
  faq: [{ question: 'Q?', answer: 'A.' }]
};

test('parseCopy accepts JSON wrapped in prose or code fences', () => {
  const out = parseCopy('Sure!\n```json\n' + JSON.stringify(good) + '\n```\nHope that helps.');
  assert.equal(out.hero.headline, 'Roofs that last');
  assert.equal(out.services.length, 2);
  assert.equal(out.faq.length, 1);
});

test('parseCopy rejects unusable replies so callers fall back to templates', () => {
  assert.equal(parseCopy(''), null);
  assert.equal(parseCopy(undefined), null);
  assert.equal(parseCopy('no json here'), null);
  assert.equal(parseCopy('{ not valid json }'), null);
  assert.equal(parseCopy(JSON.stringify({ ...good, services: [good.services[0]] })), null, 'needs at least 2 services');
  assert.equal(parseCopy(JSON.stringify({ ...good, about: '' })), null);
  assert.equal(parseCopy(JSON.stringify({ ...good, hero: { headline: '', subheadline: 'x' } })), null);
});

test('parseCopy caps lengths to the editor limits and drops incomplete items', () => {
  const out = parseCopy(JSON.stringify({
    ...good,
    hero: { headline: 'H'.repeat(500), subheadline: 'S'.repeat(500), ctaText: 'C'.repeat(500) },
    about: 'A'.repeat(5000),
    services: [...good.services, { title: '', description: 'no title' }, { title: 'T'.repeat(200), description: 'D'.repeat(900) }],
    faq: [{ question: 'only a question' }, { question: 'Q', answer: 'A' }]
  }));
  assert.equal(out.hero.headline.length, 100);
  assert.equal(out.hero.subheadline.length, 160);
  assert.equal(out.hero.ctaText.length, 40);
  assert.equal(out.about.length, 2000);
  assert.equal(out.services.length, 3);
  assert.equal(out.services[2].title.length, 60);
  assert.equal(out.services[2].description.length, 300);
  assert.equal(out.faq.length, 1);
});

test('buildPrompt only includes facts that were provided', () => {
  const p = buildPrompt({ name: 'Acme Roofing', type: 'roofing company', badges: [], serviceAreas: [] }, '');
  assert.match(p, /Acme Roofing/);
  assert.doesNotMatch(p, /Years in business/);
  assert.doesNotMatch(p, /Credentials/);
  assert.doesNotMatch(p, /Areas served/);
  const q = buildPrompt({ name: 'Acme', type: 'roofing', years: '12', badges: ['Licensed & Insured'], serviceAreas: ['Orlando'], address: '1 Main St' }, 'warmer tone');
  assert.match(q, /Years in business \(stated by the owner\): 12/);
  assert.match(q, /Licensed & Insured/);
  assert.match(q, /Orlando/);
  assert.match(q, /warmer tone/);
});

test('parseCopy keeps a per-service detail text, capped', () => {
  const out = parseCopy(JSON.stringify({
    hero: { headline: 'H', subheadline: 'S', ctaText: 'Go' }, about: 'A',
    services: [{ title: 'One', description: 'd', detail: 'x'.repeat(5000) }, { title: 'Two', description: 'd' }], faq: []
  }));
  assert.equal(out.services[0].detail.length, 1500);
  assert.equal(out.services[1].detail, '');
});
