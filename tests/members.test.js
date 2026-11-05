const test = require('node:test'); const assert = require('node:assert/strict');
const m = require('../members');
test('members.clean: defaults, limits and url safety', () => {
  const d = m.clean(undefined); assert.equal(d.enabled, false); assert.equal(d.signup, 'approval'); assert.deepEqual(d.pages, []);
  const c = m.clean({ enabled: '1', signup: 'bogus', pages: Array.from({ length: 10 }, (_, i) => ({ title: 'P' + i, body: 'b', linkUrl: 'javascript:alert(1)', linkLabel: 'x' })) });
  assert.equal(c.signup, 'approval'); assert.equal(c.pages.length, 6);
  assert.ok(c.pages.every(p => !/^javascript:/i.test(p.linkUrl)));
  assert.equal(m.clean({ pages: [{ title: '', body: '', linkUrl: '' }] }).pages.length, 0);
});
test('members: email, password and token helpers', () => {
  assert.equal(m.normEmail('  A@B.Co '), 'a@b.co'); assert.ok(m.okEmail('a@b.co')); assert.ok(!m.okEmail('nope'));
  assert.ok(m.passwordProblem('short')); assert.ok(!m.passwordProblem('longenough1')); assert.ok(m.passwordProblem('x'.repeat(80)));
  const t = m.newToken(); assert.match(t, /^[a-f0-9]{48}$/); assert.match(m.hashToken(t), /^[a-f0-9]{64}$/); assert.notEqual(m.hashToken(t), t);
});
