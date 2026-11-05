const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../booking');

const hoursAll = (open, close, extra = {}) => { const h = {}; for (const d of B.DAYS) h[d] = { closed: false, open, close }; return { ...h, ...extra }; };
// a fixed "now": Monday 2030-01-07 10:00 in New York (15:00 UTC)
const NOW = new Date('2030-01-07T15:00:00Z');
const base = (o = {}) => ({ ...B.defaultBooking(), enabled: true, hours: hoursAll('09:00', '12:00'), stepMinutes: 60, leadHours: 0, windowDays: 30, capacity: 1, ...o });

test('slots: business-local time decides what is in the past', () => {
  // it is 10:00 local: 09:00 has passed, 10:00 (right now) and 11:00 are still open
  assert.deepEqual(B.slotsFor(base(), '2030-01-07', 60, [], NOW), ['10:00', '11:00']);
  assert.deepEqual(B.slotsFor(base(), '2030-01-07', 60, [], new Date('2030-01-07T15:01:00Z')), ['11:00']);
  assert.deepEqual(B.slotsFor(base(), '2030-01-08', 60, [], NOW), ['09:00', '10:00', '11:00']);
  // a longer service needs room before closing time
  assert.deepEqual(B.slotsFor(base(), '2030-01-08', 120, [], NOW), ['09:00', '10:00']);
});

test('slots: lead time, window, closed days and bad input', () => {
  assert.deepEqual(B.slotsFor(base({ leadHours: 24 }), '2030-01-08', 60, [], NOW), ['10:00', '11:00'], '24h from Mon 10:00 is Tue 10:00: 09:00 is too soon');
  assert.deepEqual(B.slotsFor(base({ windowDays: 3 }), '2030-01-11', 60, [], NOW), []);
  assert.deepEqual(B.slotsFor(base({ hours: hoursAll('09:00', '12:00', { tue: { closed: true, open: '09:00', close: '12:00' } }) }), '2030-01-08', 60, [], NOW), []);
  assert.deepEqual(B.slotsFor(base(), '2030-01-06', 60, [], NOW), [], 'yesterday');
  assert.deepEqual(B.slotsFor(base(), 'not-a-date', 60, [], NOW), []);
});

test('slots: existing bookings block overlapping starts; capacity allows more at once', () => {
  const taken = [{ start_at: '2030-01-08 10:00', duration: 60 }];
  assert.deepEqual(B.slotsFor(base(), '2030-01-08', 60, taken, NOW), ['09:00', '11:00']);
  // a 90 minute booking at 09:30 blocks 09:00 (overlaps), 10:00 and 11:00 (until 11:00 exactly -> 11:00 free)
  assert.deepEqual(B.slotsFor(base({ stepMinutes: 30 }), '2030-01-08', 60, [{ start_at: '2030-01-08 09:30', duration: 90 }], NOW), ['11:00']);
  assert.deepEqual(B.slotsFor(base({ capacity: 2 }), '2030-01-08', 60, taken, NOW), ['09:00', '10:00', '11:00']);
  assert.deepEqual(B.slotsFor(base({ capacity: 2 }), '2030-01-08', 60, taken.concat(taken), NOW), ['09:00', '11:00']);
});

test('presets: every industry template maps to a real preset; grooming asks about the pet', () => {
  for (const [tpl, kind] of Object.entries(B.TEMPLATE_KIND)) assert.ok(B.PRESETS[kind], `${tpl} -> ${kind}`);
  const g = B.applyPreset(B.defaultBooking(), 'grooming', [{ title: 'Full groom', description: 'Bath and cut' }, { title: '' }]);
  assert.equal(g.kind, 'grooming');
  assert.deepEqual(g.services.map(s => s.name), ['Full groom']);
  assert.ok(g.fields.some(f => /breed/i.test(f.label) && f.required));
  assert.ok(g.fields.some(f => /size/i.test(f.label) && f.type === 'select' && f.options.length));
  assert.equal(g.enabled, false, 'a preset never switches booking on by itself');
  const m = B.applyPreset(B.defaultBooking(), 'mobile-grooming', []);
  assert.equal(m.askAddress, true);
  // honest content: no invented prices or claims in any preset
  const text = JSON.stringify(B.PRESETS);
  assert.doesNotMatch(text, /\$\d|licensed|insured|guarantee|24\/7|best /i);
});
