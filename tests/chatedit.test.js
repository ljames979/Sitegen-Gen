const test = require('node:test');
const assert = require('node:assert/strict');
const { applyOps, parseReply } = require('../chatedit');
const { defaultSections, defaultTheme } = require('../defaults');
const mk = () => ({ name: 'T', sections: defaultSections(), theme: defaultTheme() });
const styles = ['modern', 'bold'];

test('parseReply tolerates fences and rejects junk', () => {
  assert.equal(parseReply('```json\n{"reply":"ok","ops":[]}\n```').reply, 'ok');
  assert.equal(parseReply('nope'), null);
  assert.equal(parseReply('{broken'), null);
});
test('only allow-listed fields change', () => {
  const site = mk();
  const r = applyOps(site, [
    { op: 'set', path: 'hero.headline', value: 'New' },
    { op: 'set', path: 'contact.phone', value: '555' },
    { op: 'set', path: 'payments.enabled', value: 'true' },
    { op: 'set', path: 'services.items.0.price', value: '1' },
    { op: 'set', path: 'hero.headline.x', value: 'a' },
    { op: 'set', path: 'constructor.prototype.x', value: 'a' },
    { op: 'set', path: 'hero.ctaText', value: 42 }
  ], { styles });
  assert.equal(r.sections.hero.headline, 'New');
  assert.equal(r.changes.length, 1); assert.equal(r.rejected, 6);
  assert.equal(site.sections.hero.headline, 'Your Business Name', 'original untouched');
});
test('theme values are validated and clients cannot touch style', () => {
  const site = mk();
  const r = applyOps(site, [
    { op: 'set', path: 'theme.primaryColor', value: '#abc123' },
    { op: 'set', path: 'theme.accentColor', value: 'red' },
    { op: 'set', path: 'theme.style', value: 'nonsense' },
    { op: 'set', path: 'theme.corners', value: 'round' },
    { op: 'set', path: 'theme.logoUrl', value: 'http://x' }
  ], { styles });
  assert.equal(r.theme.primaryColor, '#abc123'); assert.equal(r.theme.corners, 'round');
  assert.equal(r.theme.accentColor, site.theme.accentColor); assert.equal(r.rejected, 3);
  const c = applyOps(site, [{ op: 'set', path: 'theme.primaryColor', value: '#111111' }], { scope: 'client', styles });
  assert.equal(c.changes.length, 0); assert.equal(c.rejected, 1);
});
test('list add/remove respect limits and keep at least one item', () => {
  const site = mk();
  const r = applyOps(site, [
    { op: 'add', path: 'faq.items', value: { question: 'Parking?', answer: 'Yes.' } },
    { op: 'add', path: 'faq.items', value: { question: '', answer: 'x' } },
    { op: 'remove', path: 'services.items', index: 99 },
    { op: 'remove', path: 'services.items', index: 0 },
    { op: 'add', path: 'hours.items', value: { day: 'x' } }
  ], { styles });
  assert.equal(r.sections.faq.items.length, 2);
  assert.equal(r.sections.services.items.length, 2);
  assert.equal(r.rejected, 3);
});
