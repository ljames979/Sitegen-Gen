const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../chat');

const site = { name: 'Palm Roofing', sections: {
  about: { body: 'We fix roofs.' }, meta: { businessType: 'roofer', city: 'Kissimmee, FL' },
  services: { items: [{ title: 'Roof repair', description: 'Fix leaks' }] },
  faq: { items: [{ question: 'Do you repair tile roofs?', answer: 'Yes, we repair tile and shingle roofs.' }] },
  hours: { items: [{ day: 'Mon-Fri', time: '8-5' }] },
  contact: { phone: '(407) 555-0100', email: 'a@b.test', address: '' }, trust: { serviceAreas: ['Orlando'] }
} };

test('context holds only what the site says', () => {
  const c = chat.context(site);
  assert.match(c, /Roof repair: Fix leaks/); assert.match(c, /Mon-Fri 8-5/); assert.match(c, /Orlando/);
  assert.doesNotMatch(c, /licensed|insured|24\/7/i);
  assert.match(chat.system(site), /ONLY the business information/);
});

test('sanitize: roles, length, alternation, must end on a user turn', () => {
  assert.deepEqual(chat.sanitize([{ role: 'system', content: 'x' }, { role: 'user', content: 'hi' }]), [{ role: 'user', content: 'hi' }]);
  assert.deepEqual(chat.sanitize([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'u1' }, { role: 'user', content: 'u2' }]).map(m => m.content), ['u2']);
  assert.deepEqual(chat.sanitize([{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }]), []);
  assert.equal(chat.sanitize([{ role: 'user', content: 'x'.repeat(900) }])[0].content.length, 500);
  assert.deepEqual(chat.sanitize('nope'), []);
});

test('fallback: FAQ match, hours, contact, otherwise hands over without guessing', () => {
  assert.match(chat.fallback(site, 'do you repair tile roofs?'), /tile and shingle/);
  assert.match(chat.fallback(site, 'what are your hours'), /Mon-Fri 8-5/);
  assert.match(chat.fallback(site, 'what is your phone number'), /\(407\) 555-0100/);
  assert.match(chat.fallback(site, 'how much for a new roof'), /don't have that detail/);
});
