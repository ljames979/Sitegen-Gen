const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../redirects');

test('normPath lowercases, drops query and trailing slash, rejects non-paths', () => {
  assert.equal(r.normPath('/About-Us.HTML/?x=1#top'), '/about-us.html');
  assert.equal(r.normPath('//evil.example/x'), '');
  assert.equal(r.normPath('about'), '');
  assert.equal(r.normPath(''), '');
  assert.equal(r.normPath('/old/*'), '/old/*');
  assert.equal(r.normPath('/'), '/');
});

test('clean keeps only usable, non-looping, de-duplicated rules', () => {
  const rows = r.clean([
    { from: '/a', to: '/b' }, { from: '/A/', to: '/c' }, // duplicate of /a
    { from: '/', to: '/home' },                           // the home page cannot be redirected
    { from: '/loop', to: '/loop/' },                      // points at itself
    { from: '/x', to: 'javascript:alert(1)' }, { from: '/y', to: '//evil.example' }, { from: '/z', to: 'https://ok.example/p' },
    { from: '/t', to: '/u', code: 302 }, { from: 'nope', to: '/u' }, null
  ]);
  assert.deepEqual(rows, [{ from: '/a', to: '/b', code: 301 }, { from: '/z', to: 'https://ok.example/p', code: 301 }, { from: '/t', to: '/u', code: 302 }]);
  assert.equal(r.clean(Array.from({ length: 300 }, (_, i) => ({ from: '/p' + i, to: '/x' }))).length, r.MAX);
  assert.deepEqual(r.clean('nonsense'), []);
});

test('find: exact beats prefix, longest prefix wins, * carries the rest over', () => {
  const rules = r.clean([
    { from: '/blog/*', to: '/news/*' }, { from: '/blog/special', to: '/offers' },
    { from: '/shop/*', to: '/services' }, { from: '/shop/old/*', to: '/archive' }
  ]);
  assert.deepEqual(r.find(rules, '/blog/special'), { to: '/offers', code: 301 });
  assert.equal(r.find(rules, '/blog/2020/a-post').to, '/news/2020/a-post');
  assert.equal(r.find(rules, '/blog').to, '/news');
  assert.equal(r.find(rules, '/shop/old/thing').to, '/archive');
  assert.equal(r.find(rules, '/shop/new').to, '/services');
  assert.equal(r.find(rules, '/Blog/Special/').to, '/offers', 'case and trailing slash do not matter');
  assert.equal(r.find(rules, '/other'), null);
  assert.equal(r.find([], '/x'), null);
});

test('fromBody reads the editor rows', () => {
  const rows = r.fromBody({ rd_from: ['/old', '', '/b'], rd_to: ['/new', '/x', 'https://e.example'], rd_code: ['301', '301', '302'] });
  assert.deepEqual(rows, [{ from: '/old', to: '/new', code: 301 }, { from: '/b', to: 'https://e.example', code: 302 }]);
  assert.deepEqual(r.fromBody({ rd_from: '/one', rd_to: '/two' }), [{ from: '/one', to: '/two', code: 301 }]);
  assert.deepEqual(r.fromBody({}), []);
});
