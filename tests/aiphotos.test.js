const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const aiPhotos = require('../aiphotos');

// A stand-in for fal (and for Claude when asked): records each request and answers with a tiny JPEG inline.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
function fakeServer(handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const j = body ? JSON.parse(body) : {}; seen.push({ url: req.url, headers: req.headers, body: j });
      const out = handler(req, j, seen.length);
      res.writeHead(out.status || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out.json));
    });
  });
  return new Promise(r => server.listen(0, () => r({ server, seen, url: `http://localhost:${server.address().port}` })));
}
const okImage = () => ({ json: { images: [{ url: 'data:image/jpeg;base64,' + JPEG.toString('base64') }], seed: 1 } });

function withEnv(vars, fn) {
  const old = {}; for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  return Promise.resolve().then(fn).finally(() => { for (const k of Object.keys(old)) { if (old[k] == null) delete process.env[k]; else process.env[k] = old[k]; } });
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aiphotos-'));

test('AI photos: off without FAL_KEY, or when PHOTO_SOURCE=stock', () => withEnv({ FAL_KEY: null, PHOTO_SOURCE: null }, () => {
  assert.equal(aiPhotos.hasAiPhotos(), false);
  process.env.FAL_KEY = 'k'; assert.equal(aiPhotos.hasAiPhotos(), true);
  process.env.PHOTO_SOURCE = 'stock'; assert.equal(aiPhotos.hasAiPhotos(), false);
}));

test('AI photos: shot specs give a hero, an about photo and gallery photos at web sizes, with no text asked for', () => {
  const specs = aiPhotos.shotSpecs({ businessType: 'coffee roaster', queries: ['coffee roasting', 'latte art'], colors: { primary: '#2B2522', accent: '#C8642B' }, gallery: 3 });
  assert.deepEqual(specs.map(s => s.role), ['hero', 'about', 'gallery', 'gallery', 'gallery']);
  assert.deepEqual([specs[0].width, specs[0].height], [1920, 1080]);
  assert.match(specs[0].prompt, /left half calm/);
  assert.match(specs[2].prompt, /coffee roasting, for coffee roaster/);
  assert.match(specs[3].prompt, /latte art/);
  specs.forEach(s => { assert.match(s.prompt, /No text/); assert.match(s.prompt, /#C8642B/); });
});

test('AI photos: a photo set is made through fal, saved into uploads, and shaped like the stock photo set', async () => {
  const fal = await fakeServer(okImage);
  const dir = tmp();
  try {
    await withEnv({ FAL_KEY: 'test-key', FAL_API_URL: fal.url, PHOTO_SOURCE: null, AI_PHOTO_GALLERY: '3', ANTHROPIC_API_KEY: null }, async () => {
      const set = await aiPhotos.makePhotoSet({ businessType: 'bakery', name: 'Crumb', queries: ['bread'], galleryCount: 6, uploadsDir: dir });
      assert.ok(set.hero && /^\/uploads\/ai-[A-Za-z0-9]+\.(webp|jpg)$/.test(set.hero.url));
      assert.equal(set.gallery.length, 3, 'about + 2 gallery photos (AI_PHOTO_GALLERY caps the count)');
      assert.equal(fal.seen.length, 4, 'one version each without Claude to judge');
      const b = fal.seen[0];
      assert.equal(b.url, '/' + aiPhotos.MODEL);
      assert.equal(b.headers.authorization, 'Key test-key');
      assert.equal(b.body.sync_mode, true, 'images come back inline');
      for (const p of [set.hero, ...set.gallery]) assert.ok(fs.existsSync(path.join(dir, path.basename(p.url))));
    });
  } finally { fal.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AI photos: with Claude, 2 versions per photo and Claude\'s pick and alt text are kept', async () => {
  const fal = await fakeServer(okImage);
  const claude = await fakeServer((req, j) => {
    const content = j.messages[0].content;
    if (typeof content === 'string') return { json: { content: [{ type: 'text', text: 'not json' }] } };   // briefs: keep the built-in ones
    return { json: { content: [{ type: 'text', text: '{"pick": 2, "alt": "Fresh loaves on a wooden shelf"}' }] } };
  });
  const dir = tmp();
  try {
    await withEnv({ FAL_KEY: 'k', FAL_API_URL: fal.url, ANTHROPIC_API_KEY: 'a', ANTHROPIC_API_URL: claude.url, AI_PHOTO_GALLERY: '1', PHOTO_SOURCE: null }, async () => {
      const set = await aiPhotos.makePhotoSet({ businessType: 'bakery', queries: ['bread'], uploadsDir: dir });
      assert.equal(fal.seen.length, 4, 'hero and about, 2 versions each');
      assert.notEqual(fal.seen[0].body.seed, fal.seen[1].body.seed);
      assert.equal(set.hero.alt, 'Fresh loaves on a wooden shelf');
      assert.equal(set.gallery.length, 1);
      const pickCall = claude.seen.find(c => Array.isArray(c.body.messages[0].content));
      assert.equal(claude.seen.filter(c => Array.isArray(c.body.messages[0].content)).length, 2, 'one pick per photo');
      assert.equal(pickCall.body.messages[0].content.filter(c => c.type === 'image').length, 2);
    });
  } finally { fal.server.close(); claude.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AI photos: when fal fails, nothing is saved and the caller gets null (stock photos take over)', async () => {
  const fal = await fakeServer(() => ({ status: 403, json: { detail: 'Exhausted balance' } }));
  const dir = tmp();
  const err = console.error; console.error = () => {};
  try {
    await withEnv({ FAL_KEY: 'k', FAL_API_URL: fal.url, ANTHROPIC_API_KEY: null, AI_PHOTO_GALLERY: '2', PHOTO_SOURCE: null }, async () => {
      assert.equal(await aiPhotos.makePhotoSet({ businessType: 'bakery', queries: ['bread'], uploadsDir: dir }), null);
      assert.deepEqual(fs.readdirSync(dir), []);
    });
  } finally { console.error = err; fal.server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
