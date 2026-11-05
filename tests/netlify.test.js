const test = require('node:test');
const assert = require('node:assert/strict');
const netlify = require('../netlify');

test('cleanDomain accepts real domains and rejects junk', () => {
  assert.equal(netlify.cleanDomain('HTTPS://Www.Example.com/path?x=1'), 'www.example.com');
  assert.equal(netlify.cleanDomain('example.co.uk'), 'example.co.uk');
  for (const bad of ['', 'localhost', 'not a domain', 'bad_domain.com', 'a..com', 'x.netlify.app', '-x.com', 'javascript:alert(1)']) assert.equal(netlify.cleanDomain(bad), '', bad);
});

test('dnsInstructions: bare domain, www and subdomain', () => {
  const apex = netlify.dnsInstructions('example.com', 'my-site-ab12c');
  assert.deepEqual(apex.map(r => [r.type, r.host, r.value]), [['A', '@', '75.2.60.5'], ['CNAME', 'www', 'my-site-ab12c.netlify.app']]);
  const www = netlify.dnsInstructions('www.example.com', 'my-site-ab12c');
  assert.deepEqual(www.map(r => [r.type, r.host]), [['CNAME', 'www'], ['A', '@']]);
  assert.deepEqual(netlify.dnsInstructions('shop.example.com', 's').map(r => [r.type, r.host]), [['CNAME', 'shop']]);
  assert.deepEqual(netlify.dnsInstructions('junk', 's'), []);
});

test('site names are safe and different each time', () => {
  const a = netlify.siteName("Stan's Dog Grooming!!", 0), b = netlify.siteName("Stan's Dog Grooming!!", 0);
  assert.match(a, /^stan-s-dog-grooming-[a-z0-9]{5}$/); assert.notEqual(a, b);
  assert.match(netlify.siteName('', 0), /^site-/);
});

test('without a token every call fails with a plain explanation', async () => {
  const saved = process.env.NETLIFY_AUTH_TOKEN; delete process.env.NETLIFY_AUTH_TOKEN;
  try {
    assert.equal(netlify.isConfigured(), false);
    await assert.rejects(() => netlify.createSite('x'), /NETLIFY_AUTH_TOKEN/);
  } finally { if (saved) process.env.NETLIFY_AUTH_TOKEN = saved; }
});
