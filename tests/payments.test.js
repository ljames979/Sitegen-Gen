const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_SECRET = 'unit-test-secret';
const p = require('../payments');

test('toCents parses money text safely', () => {
  assert.equal(p.toCents('$1,250.50'), 125050);
  assert.equal(p.toCents('89'), 8900);
  assert.equal(p.toCents('from $70'), 0);
  assert.equal(p.toCents('-5'), 0);
  assert.equal(p.toCents(''), 0);
});
test('depositCents: fixed, percent and minimums', () => {
  assert.equal(p.depositCents({ enabled: true, depositMode: 'fixed', depositAmount: '25' }, 0), 2500);
  assert.equal(p.depositCents({ enabled: true, depositMode: 'percent', depositAmount: '20' }, 20000), 4000);
  assert.equal(p.depositCents({ enabled: true, depositMode: 'percent', depositAmount: '20' }, 0), 0);
  assert.equal(p.depositCents({ enabled: true, depositMode: '', depositAmount: '25' }, 20000), 0);
});
test('keys validate and round-trip encrypted', () => {
  const k = 'sk_test_' + 'abcdefghijklmnop1234';
  assert.ok(p.validKey(k)); assert.ok(!p.validKey('pk_test_abcdefghijklmnop1234')); assert.ok(!p.validKey('junk'));
  const enc = p.encryptKey(k);
  assert.ok(!enc.includes('abcdefgh')); assert.equal(p.decryptKey(enc), k);
  assert.equal(p.decryptKey('garbage'), '');
});
