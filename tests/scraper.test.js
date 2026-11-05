const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertPublicHost } = require('../scraper');

test('SSRF guard blocks loopback, private, and link-local addresses', async () => {
  const blocked = ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.5', '192.168.0.1', '169.254.169.254', '::1'];
  for (const host of blocked) {
    await assert.rejects(() => assertPublicHost(host), `expected ${host} to be blocked`);
  }
});

test('SSRF guard allows a normal public hostname', async () => {
  // google.com is about as stable a "this resolves to a public IP" fixture
  // as exists; if DNS is unreachable in this environment the test is skipped.
  try {
    await assertPublicHost('google.com');
  } catch (err) {
    if (/resolve/i.test(err.message)) {
      return; // no DNS/network available in this sandbox — not what we're testing
    }
    throw err;
  }
});
