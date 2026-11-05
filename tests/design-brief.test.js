const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('../design-brief');
const salon = { sections: { meta: { businessType: 'hair salon' } } };

test('copy brief carries the look, page flow and what to avoid, and never adds facts', () => {
  const t = b.copyBrief('hair salon', 'luxe');
  assert.match(t, /Design direction for salon sites/); assert.match(t, /never adds facts/);
  assert.match(t, /Page flow that works/); assert.match(t, /Avoid in the wording and feel/); assert.match(t, /calm/);
  assert.ok(t.length < 1200, 'short enough for a prompt');
  assert.equal(b.copyBrief('zzz unknown thing', 'modern'), '', 'no guidance for unknown businesses');
  assert.equal(b.copyBrief('', ''), '');
});

test('edit brief lists styles to prefer and avoid, usable colours, and tells the AI the owner still decides', () => {
  const t = b.editBrief(salon);
  assert.match(t, /Styles that suit this business: japandi, luxe/); assert.match(t, /usually not recommended: poster, midnight, noir/);
  assert.match(t, /do what they ask and mention the concern/);
  assert.match(t, /Lively motion style/);
  assert.ok(!/#1c1917/.test(t), 'near-black palettes are not offered');
  assert.equal(b.editBrief({ sections: { meta: { businessType: 'zzz' } } }), '');
  assert.equal(b.editBrief({}), '');
});

test('warnings flag requests that go against the guidance without blocking them', () => {
  assert.equal(b.warnings(salon, [{ op: 'set', path: 'theme.style', value: 'luxe' }]).length, 0);
  const w = b.warnings(salon, [{ op: 'set', path: 'theme.style', value: 'noir' }, { op: 'set', path: 'hero.headline', value: 'x' }, null, 5]);
  assert.equal(w.length, 1); assert.match(w[0], /"noir" style is usually not recommended for salon sites/);
  assert.deepEqual(b.warnings({ sections: { meta: { businessType: 'zzz' } } }, [{ op: 'set', path: 'theme.style', value: 'noir' }]), []);
  assert.deepEqual(b.warnings(salon, undefined), []);
});
