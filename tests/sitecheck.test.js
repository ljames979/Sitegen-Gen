const test = require('node:test');
const assert = require('node:assert');
const siteCheck = require('../sitecheck');

const site = (extra = {}) => ({ id: 7, name: 'Acme Plumbing', sections: { contact: { phone: '(407) 555-0100', email: 'hi@acme.com' }, ...extra } });
const page = (label, path, body) => ({ label, path, html: `<html><head><title>${label}</title></head><body>${body}</body></html>` });
const base = '/sites/7/preview';

test('finds placeholders, sample words and sample contact details', () => {
  const r = siteCheck.check(site(), [page('Home', '', '<h1>Hi</h1><p>Call [Phone] today. Lorem ipsum dolor.</p><a href="mailto:you@example.com">mail</a>')], { basePath: base });
  const ids = r.items.map(i => i.id);
  assert.ok(ids.includes('pages-placeholder'));
  assert.ok(ids.includes('pages-lorem'));
  assert.ok(ids.includes('pages-sample-contact'));
  assert.match(r.items.find(i => i.id === 'pages-placeholder').detail, /\[Phone\] on Home/);
});

test('a clean site passes', () => {
  const r = siteCheck.check(site(), [
    page('Home', '', `<h1>Acme</h1><a href="${base}/about">About</a><a href="#top">Top</a><a href="tel:+14075550100">Call</a><img src="a.jpg" alt="Van">`),
    page('About', '/about', `<h1>About</h1><a href="${base}">Home</a><a href="#team">Team</a><div id="team"></div><a href="mailto:hi@acme.com">Mail</a>`)
  ], { basePath: base });
  assert.deepStrictEqual(r.items.map(i => i.id), []);
  assert.strictEqual(r.pages, 2);
});

test('broken page links, empty jumps, other phone numbers and headings', () => {
  const r = siteCheck.check(site(), [
    page('Home', '', `<h1>A</h1><h1>B</h1><a href="${base}/faq">FAQ</a><a href="#prices">Prices</a><a href="tel:4075559999">Call</a><img src="x.jpg">`),
    page('About', '/about', '<p>No heading</p>')
  ], { basePath: base });
  const ids = r.items.map(i => i.id);
  for (const id of ['pages-links', 'pages-jumps', 'pages-phone', 'pages-h1-many', 'pages-h1-none', 'pages-alt']) assert.ok(ids.includes(id), id);
  assert.match(r.items.find(i => i.id === 'pages-links').detail, /\/faq on Home/);
});

test('missing translations when the language switch is on', () => {
  const s = site({ kit: { langs: { on: true, code: 'es', words: [['Welcome', 'Bienvenidos'], ['Our services', '']] } } });
  const r = siteCheck.check(s, [page('Home', '', '<h1>Welcome</h1><h2>Our services</h2><p>Acme Plumbing</p><a aria-label="Facebook" href="https://facebook.com/x">f</a>')], { basePath: base });
  const it = r.items.find(i => i.id === 'pages-lang');
  assert.ok(it);
  assert.match(it.title, /^2 pieces/);   // "Our services" (empty) and the page title "Home"; the business name and Facebook are skipped
});

test('phoneKey treats +1 the same', () => {
  assert.strictEqual(siteCheck.phoneKey('+1 (407) 555-0100'), siteCheck.phoneKey('407.555.0100'));
});
