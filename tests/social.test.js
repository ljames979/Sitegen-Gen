// These tests mock fetch, so skip the DNS lookup of the SSRF guard: they should
// pass offline too. (Must be set before the modules are loaded.)
process.env.ALLOW_PRIVATE_IMPORT_HOSTS = 'true';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scrapeSocialInspiration, applySocialInspiration, platformFromHost } = require('../social');

test('platformFromHost recognizes the major platforms', () => {
  assert.equal(platformFromHost('www.facebook.com'), 'facebook');
  assert.equal(platformFromHost('m.facebook.com'), 'facebook');
  assert.equal(platformFromHost('instagram.com'), 'instagram');
  assert.equal(platformFromHost('www.google.com'), 'google');
  assert.equal(platformFromHost('g.page'), 'google');
  assert.equal(platformFromHost('www.linkedin.com'), 'linkedin');
  assert.equal(platformFromHost('somerandombiz.com'), 'other');
});

test('scrapeSocialInspiration rejects a garbage URL without throwing', async () => {
  const result = await scrapeSocialInspiration('not a url at all');
  assert.ok(result.error);
});

test('scrapeSocialInspiration returns null for an empty input', async () => {
  const result = await scrapeSocialInspiration('');
  assert.equal(result, null);
});

test('scrapeSocialInspiration extracts og:image/title/description and filters generic images', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h === 'content-type' ? 'text/html' : null) },
    text: async () => `
      <html><head>
        <meta property="og:title" content="Whitfield Legal Group" />
        <meta property="og:description" content="Experienced legal counsel." />
        <meta property="og:image" content="https://cdn.example.com/photos/office.jpg" />
        <meta property="og:image" content="https://cdn.example.com/favicon.png" />
        <meta name="theme-color" content="#be123c" />
      </head><body></body></html>
    `
  });
  try {
    const result = await scrapeSocialInspiration('https://facebook.com/whitfieldlegal');
    assert.equal(result.platform, 'facebook');
    assert.equal(result.error, null);
    assert.equal(result.name, 'Whitfield Legal Group');
    assert.equal(result.bio, 'Experienced legal counsel.');
    assert.equal(result.themeColor, '#be123c');
    assert.deepEqual(result.images, ['https://cdn.example.com/photos/office.jpg']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('scrapeSocialInspiration returns a friendly note when a platform gives back nothing usable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h === 'content-type' ? 'text/html' : null) },
    text: async () => '<html><head></head><body>Log in to see this content</body></html>'
  });
  try {
    const result = await scrapeSocialInspiration('https://www.instagram.com/somebusiness');
    assert.equal(result.platform, 'instagram');
    assert.match(result.note, /Instagram/);
    assert.deepEqual(result.images, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test('applySocialInspiration fills an empty hero image but does not clobber an existing one by default', () => {
  const theme = { primaryColor: '#2563eb' };
  const sections = { hero: { imageUrl: '' }, gallery: { images: [] } };
  applySocialInspiration(theme, sections, {
    error: null, images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'], themeColor: '#be123c'
  });
  assert.equal(sections.hero.imageUrl, 'https://cdn.example.com/a.jpg');
  assert.deepEqual(sections.gallery.images, ['https://cdn.example.com/b.jpg']);
  assert.equal(theme.primaryColor, '#be123c');
});

test('applySocialInspiration leaves a real hero image alone unless preferOverHero is set', () => {
  const theme = { primaryColor: '#0f766e' };
  const sections = { hero: { imageUrl: 'https://cdn.example.com/existing-hero.jpg' }, gallery: { images: [] } };
  applySocialInspiration(theme, sections, {
    error: null, images: ['https://cdn.example.com/social.jpg'], themeColor: '#be123c'
  });
  assert.equal(sections.hero.imageUrl, 'https://cdn.example.com/existing-hero.jpg');
  assert.deepEqual(sections.gallery.images, ['https://cdn.example.com/social.jpg']);
  // theme wasn't the default fallback blue, and preferOverHero wasn't set, so it's left alone
  assert.equal(theme.primaryColor, '#0f766e');
});

test('applySocialInspiration replaces the hero when preferOverHero is set', () => {
  const theme = { primaryColor: '#4d7c0f' };
  const sections = { hero: { imageUrl: 'https://cdn.example.com/stock-photo.jpg' }, gallery: { images: [] } };
  applySocialInspiration(theme, sections, {
    error: null, images: ['https://cdn.example.com/social.jpg'], themeColor: '#be123c'
  }, { preferOverHero: true });
  assert.equal(sections.hero.imageUrl, 'https://cdn.example.com/social.jpg');
  assert.equal(theme.primaryColor, '#be123c');
});

test('applySocialInspiration does nothing when the scrape errored', () => {
  const theme = { primaryColor: '#2563eb' };
  const sections = { hero: { imageUrl: '' }, gallery: { images: [] } };
  applySocialInspiration(theme, sections, { error: 'boom' });
  assert.equal(sections.hero.imageUrl, '');
  assert.equal(theme.primaryColor, '#2563eb');
});
