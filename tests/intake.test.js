const test = require('node:test');
const assert = require('node:assert/strict');
const intake = require('../intake');

const full = {
  biz_name: 'Maria Bakery', biz_type: 'Bakery', city: 'Orlando', years: '12 yrs',
  svc_name: ['Cakes', 'Bread', ''], svc_desc: ['Custom cakes', 'Fresh daily', 'ignored'],
  contact_name: 'Maria', contact_email: 'maria@x.test', agree: '1',
  mood: 'warm', brand_color: '#aa3300', photos: ['/uploads/a.jpg', 'http://evil/x.jpg', '/uploads/../x.jpg'],
  logo: '/uploads/logo.png', features: ['chat', 'bogus'], facebook: 'javascript:alert(1)'
};

test('clean keeps only safe, known values', () => {
  const d = intake.clean(full);
  assert.equal(d.years, '12');
  assert.deepEqual(d.services.map(s => s.name), ['Cakes', 'Bread']);
  assert.deepEqual(d.photos, ['/uploads/a.jpg']);
  assert.equal(d.logo, '/uploads/logo.png');
  assert.deepEqual(d.features, ['chat']);
  assert.equal(d.facebook, '');
  assert.equal(d.mood, 'warm');
  assert.equal(d.brandColor, '#aa3300');
  assert.equal(intake.clean({ ...full, no_color: '1' }).brandColor, '');
  assert.equal(intake.clean({ ...full, mood: 'nope' }).mood, '');
});

test('problems lists what is missing', () => {
  assert.deepEqual(intake.problems(intake.clean(full)), []);
  assert.ok(intake.problems(intake.clean({})).length >= 4);
  assert.ok(intake.problems(intake.clean({ ...full, contact_email: 'bad' })).length >= 1);
  assert.ok(intake.problems(intake.clean({ ...full, agree: '' })).length >= 1);
});

test('todo and claims reflect the answers', () => {
  const d = intake.clean({ ...full, badges: 'Licensed and insured' });
  assert.ok(intake.claimsToCheck(d).some(c => /Licensed/.test(c)));
  assert.ok(intake.todoList(intake.clean({ ...full, logo: '' })).some(t => /logo/i.test(t)));
});

test('clean keeps prices, up to five differences, tone, and six questions', () => {
  const d = intake.clean({ ...full, svc_price: ['From $85', '', 'x'], diff_item: ['a', '', 'b', 'c', 'd', 'e', 'f'], tone: 'warm', faq_q: ['1', '2', '3', '4', '5', '6', '7'], faq_a: ['a', 'a', 'a', 'a', 'a', 'a', 'a'] });
  assert.equal(d.services[0].price, 'From $85'); assert.equal(d.services[1].price, '');
  assert.deepEqual(d.diffs, ['a', 'b', 'c', 'd', 'e']); assert.equal(d.tone, 'warm'); assert.equal(d.faq.length, 6);
  assert.equal(intake.clean({ ...full, tone: 'nope' }).tone, '');
  assert.deepEqual(intake.clean({ ...full, diff: 'Old single box' }).diffs, ['Old single box']);
});
test('todo tells the owner what the client left out', () => {
  const t = intake.todoList(intake.clean({ biz_name: 'X', biz_type: 'Y' })).join(' ');
  assert.match(t, /listed no services/); assert.match(t, /no "about" text/); assert.match(t, /No customer questions/);
});
