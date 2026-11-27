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

test('a special offer turns the announcement bar on; an empty one turns it off', () => {
  const site = mk();
  const r = applyOps(site, [{ op: 'set', path: 'announcement.text', value: 'Winter special: 15% off gutter cleaning' }], { styles });
  assert.equal(r.sections.announcement.enabled, true);
  assert.equal(r.changes[0].label, 'Announcement bar at the top'); assert.equal(r.changes[0].i, 0);
  const off = applyOps({ ...site, sections: r.sections }, [{ op: 'set', path: 'announcement.text', value: '' }], { styles });
  assert.equal(off.sections.announcement.enabled, false);
});
test('changes carry plain labels and the index of their operation', () => {
  const site = mk();
  const r = applyOps(site, [{ op: 'set', path: 'contact.phone', value: '1' }, { op: 'set', path: 'services.items.0.description', value: 'Fresh words' }], { styles });
  assert.equal(r.changes[0].label, 'Service 1: description'); assert.equal(r.changes[0].i, 1);
});
test('honesty: new claims are held back unless the site or the request says them', () => {
  const { honesty } = require('../chatedit');
  const site = mk(); site.name = 'Honest Roofing';
  const r = applyOps(site, [
    { op: 'set', path: 'hero.headline', value: 'Licensed roofers on call 24/7' },
    { op: 'set', path: 'announcement.text', value: 'Winter special: 15% off gutter cleaning' },
    { op: 'set', path: 'hero.subheadline', value: 'Roof repairs explained plainly.' }
  ], { styles });
  const h = honesty(site, r.changes, 'Add a winter special, 15% off gutter cleaning');
  assert.deepEqual(h.ok.map(c => c.i).sort(), [1, 2]);
  assert.equal(h.held.length, 1); assert.equal(h.held[0].i, 0); assert.ok(h.held[0].reasons.length);
  const h2 = honesty(site, r.changes, 'say we are licensed and answer 24/7');
  assert.ok(h2.ok.some(c => c.i === 0), 'the owner saying it in the request counts');
});
