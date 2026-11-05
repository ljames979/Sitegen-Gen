const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildChecklist } = require('../checklist');
const { defaultSections } = require('../defaults');

function site(mutate) {
  const sections = defaultSections();
  sections.contact.phone = '407-555-1234';
  sections.hours.items = [{ day: 'Monday', time: '8-4' }];
  sections.about.body = 'We do good work.';
  sections.services.items = [{ title: 'Thing', description: 'Does the thing.' }];
  if (mutate) mutate(sections);
  return { sections, layout: { hidden: [] } };
}
const warns = (s) => buildChecklist(s).filter(i => i.level === 'warn').map(i => i.text);

test('claims like licensed / 24-7 are flagged until the owner backs them up', () => {
  const s = site(x => { x.about.body = 'Our licensed and insured crew is available 24/7.'; });
  const w = warns(s).find(t => /business is or offers/.test(t));
  assert.ok(w, 'expected a claims warning');
  assert.match(w, /licensed/);
  assert.match(w, /insured/);
  assert.match(w, /24\/7/);

  // adding the credential as a badge clears licensed/insured but not 24/7
  s.sections.trust.badges = ['Licensed & Insured'];
  const w2 = warns(s).find(t => /business is or offers/.test(t));
  assert.ok(w2);
  assert.doesNotMatch(w2, /licensed|insured/);
  assert.match(w2, /24\/7/);
});

test('no claims warning when the text makes none', () => {
  assert.equal(warns(site()).some(t => /business is or offers/.test(t)), false);
});

test('service area tip appears only when none is listed', () => {
  const tips = (s) => buildChecklist(s).filter(i => i.level === 'tip').map(i => i.text);
  assert.ok(tips(site()).some(t => /service area/i.test(t)));
  assert.ok(!tips(site(x => { x.trust.serviceAreas = ['Orlando']; })).some(t => /service area/i.test(t)));
});

test('checklist nudges for a main city and for services without page text', () => {
  const { defaultSections } = require('../defaults');
  const sections = defaultSections();
  const site = { sections, layout: { hidden: [] } };
  let texts = buildChecklist(site).map(i => i.text).join('\n');
  assert.match(texts, /No main city set/);
  assert.match(texts, /None of the services have page text/);
  sections.meta.city = 'Orlando, FL';
  sections.services.items.forEach(i => { i.detail = 'Some real text about this service.'; });
  texts = buildChecklist(site).map(i => i.text).join('\n');
  assert.doesNotMatch(texts, /No main city set|page text/);
});

test('a light brand color gets a white-text contrast warning, a dark one does not', () => {
  const light = { ...site(), theme: { primaryColor: '#f5d76e' } };
  const dark = { ...site(), theme: { primaryColor: '#1e4e8c' } };
  assert.ok(warns(light).some(t => /contrast|readable|hard to read/i.test(t)), 'expected a contrast warning');
  assert.ok(!warns(dark).some(t => /contrast|readable|hard to read/i.test(t)));
});

test('full home pages suggest a photo for every service', () => {
  const s = { ...site(), theme: { style: 'agency', primaryColor: '#1e4e8c' } };
  assert.ok(buildChecklist(s).some(i => i.level === 'tip' && /no photo/.test(i.text)));
  const plain = { ...site(), theme: { style: 'modern', primaryColor: '#1e4e8c' } };
  assert.ok(!buildChecklist(plain).some(i => /no photo/.test(i.text)));
});
