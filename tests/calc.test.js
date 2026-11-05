const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../calc');

const cfg = calc.normalize({ enabled: true, basePrice: 100, minimum: 150, spread: 10,
  fields: [{ label: 'Size', type: 'radio', options: 'A | 20\nB | 60', required: 'yes' }, { label: 'Rooms', type: 'number', price: 25, min: 1, max: 4, unit: 'rooms' }, { label: 'Extra', type: 'checkbox', price: 15 }] });

test('math: base + choice + qty clamp + add-on, minimum, range', () => {
  const r = calc.compute(cfg, ['1', '10', '1']);
  assert.equal(r.total, 100 + 60 + 4 * 25 + 15); assert.equal(r.low, 275); assert.equal(r.high, 302.5);
  assert.equal(calc.compute(cfg, ['0', '', '']).total, 150, 'minimum applies (100 + 20 = 120 < 150)');
  assert.equal(calc.compute(cfg, ['0', '0', '']).lines[1].value, '1 rooms', 'quantity is clamped up to the minimum');
});
test('required and bad input', () => {
  assert.equal(calc.compute(cfg, []).ok, false);
  assert.equal(calc.compute(cfg, ['9']).ok, false, 'unknown option index');
  assert.equal(calc.compute(cfg, ['-1']).ok, false);
  const r = calc.compute(cfg, ['0', 'abc', 'on']);
  assert.equal(r.ok, true); assert.equal(r.lines.find(l => l.label === 'Rooms').amount, 25, 'junk number becomes the minimum');
});
test('options parsing, money cleaning, usability, price check', () => {
  assert.deepEqual(calc.parseOptions('Small | $1,200\n\nBig|abc\nsmall | 5'), [{ label: 'Small', price: 1200 }, { label: 'Big', price: 0 }]);
  assert.equal(calc.isUsable({ enabled: true, fields: [] }), false);
  assert.equal(calc.isUsable({ enabled: true, fields: [{ label: 'x', type: 'select', options: '' }] }), false);
  assert.equal(calc.isUsable(cfg), true);
  assert.equal(calc.hasPrices(calc.normalize({ fields: [{ type: 'select', options: 'a | 0' }] })), false);
  assert.equal(calc.rangeText({ low: 90, high: 108 }), '$90 to $108'); assert.equal(calc.rangeText({ low: 90, high: 90 }), '$90');
});
test('presets never carry invented prices', () => {
  for (const [k, p] of Object.entries(calc.PRESETS)) {
    const n = calc.normalize({ enabled: true, ...p, fields: p.fields });
    assert.equal(calc.hasPrices(n), false, k);
  }
});
