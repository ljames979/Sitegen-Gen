const test = require('node:test');
const assert = require('node:assert/strict');
const oh = require('../openhours');

test('open hours: common ways of writing days and times are read', () => {
  assert.deepEqual(oh.parseDays('Mon–Fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(oh.parseDays('Saturday & Sunday'), [0, 6]);
  assert.deepEqual(oh.parseDays('Fri - Mon'), [0, 1, 5, 6]);
  assert.deepEqual(oh.parseDays('Daily'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(oh.parseDays('Weds'), [3]);
  assert.deepEqual(oh.parseTimes('9:00 AM – 5:00 PM'), [[540, 1020]]);
  assert.deepEqual(oh.parseTimes('9-5pm'), [[540, 1020]]);
  assert.deepEqual(oh.parseTimes('noon to 8 PM'), [[720, 1200]]);
  assert.deepEqual(oh.parseTimes('08:00 - 17:30'), [[480, 1050]]);
  assert.deepEqual(oh.parseTimes('9am-12pm, 1pm-5pm'), [[540, 720], [780, 1020]]);
  assert.deepEqual(oh.parseTimes('Closed'), []);
  assert.deepEqual(oh.parseTimes('24 hours'), [[0, 1440]]);
});

test('open hours: anything unclear gives no schedule rather than a guess', () => {
  assert.equal(oh.parse([{ day: 'Mon–Fri', time: 'By appointment' }]), null);
  assert.equal(oh.parse([{ day: 'Most days', time: '9am-5pm' }]), null);
  assert.equal(oh.parse([{ day: 'Mon', time: '9am' }]), null);
  assert.equal(oh.parse([{ day: 'Sat', time: 'Closed' }]), null, 'never open at all');
  assert.equal(oh.parse([]), null);
});

test('open hours: late nights run past midnight into the next day', () => {
  const w = oh.parse([{ day: 'Fri', time: '6pm-2am' }, { day: 'Mon–Thu', time: '9:00 AM – 5:00 PM' }]);
  assert.ok(oh.isOpen(w, 5, 19 * 60));
  assert.ok(oh.isOpen(w, 6, 60), 'Saturday 1 AM is still Friday night');
  assert.ok(!oh.isOpen(w, 6, 3 * 60));
  assert.ok(oh.isOpen(w, 1, 9 * 60) && !oh.isOpen(w, 1, 17 * 60), 'closes at 5:00 exactly');
});
