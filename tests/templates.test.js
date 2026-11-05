const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findTemplate, fillTemplate, GENERIC_TEMPLATE } = require('../templates');
const { fetchPhotoSet, hasPhotoProvider } = require('../photos');

test('findTemplate matches common business types by keyword', () => {
  assert.equal(findTemplate('plumbing company').id, 'plumbing');
  assert.equal(findTemplate('Downtown Hair Salon').id, 'salon');
  assert.equal(findTemplate('24/7 Emergency Electrician').id, 'electrician');
  assert.equal(findTemplate('cozy neighborhood bakery').id, 'bakery');
});

test('findTemplate matches regardless of spacing/hyphenation ("lawncare" vs "lawn care")', () => {
  assert.equal(findTemplate('lawncare').id, 'landscaping');
  assert.equal(findTemplate('lawn-care').id, 'landscaping');
  assert.equal(findTemplate('lawn care').id, 'landscaping');
  assert.equal(findTemplate('autorepair').id, 'auto-repair');
  assert.equal(findTemplate('realestate').id, 'real-estate');
});

test('findTemplate falls back to the generic template when nothing matches', () => {
  const tpl = findTemplate('artisanal llama grooming');
  assert.equal(tpl, GENERIC_TEMPLATE);
});

test('fillTemplate substitutes the business name and type into copy', () => {
  const tpl = findTemplate('plumbing company');
  const filled = fillTemplate(tpl, 'Joe\'s Plumbing', 'plumbing company');
  assert.equal(filled.name, 'Joe\'s Plumbing');
  assert.doesNotMatch(filled.hero.headline, /Joe's Plumbing/, 'headline leads with the benefit, not the name');
  assert.match(filled.hero.subheadline, /Joe's Plumbing/, 'the name stays in the supporting line');
  assert.match(filled.about, /Joe's Plumbing/);
  assert.ok(filled.services.length > 0);
  assert.ok(filled.faq.length > 0);
});

test('fillTemplate derives a name from the business type when none is given', () => {
  const tpl = findTemplate('artisanal llama grooming');
  const filled = fillTemplate(tpl, '', 'artisanal llama grooming');
  assert.match(filled.name, /artisanal llama grooming/i);
  assert.match(filled.about, new RegExp(filled.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('hasPhotoProvider reflects whether PEXELS_API_KEY is set', () => {
  const original = process.env.PEXELS_API_KEY;
  try {
    delete process.env.PEXELS_API_KEY;
    assert.equal(hasPhotoProvider(), false);
    process.env.PEXELS_API_KEY = 'test-key';
    assert.equal(hasPhotoProvider(), true);
  } finally {
    if (original === undefined) delete process.env.PEXELS_API_KEY;
    else process.env.PEXELS_API_KEY = original;
  }
});

test('fetchPhotoSet returns no photos when no API key is configured', async () => {
  const original = process.env.PEXELS_API_KEY;
  delete process.env.PEXELS_API_KEY;
  try {
    const result = await fetchPhotoSet(['plumber'], { galleryCount: 4 });
    assert.equal(result.hero, null);
    assert.deepEqual(result.gallery, []);
  } finally {
    if (original !== undefined) process.env.PEXELS_API_KEY = original;
  }
});

test('fetchPhotoSet splits results into a hero and a deduplicated gallery', async () => {
  const original = process.env.PEXELS_API_KEY;
  const originalFetch = global.fetch;
  process.env.PEXELS_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      photos: Array.from({ length: 8 }, (_, i) => ({
        src: { large: `https://images.example.com/photo${i}.jpg` },
        width: 1200,
        height: 800,
        photographer: 'Test Photographer',
        photographer_url: 'https://pexels.com/@test',
        url: `https://pexels.com/photo/${i}`
      }))
    })
  });
  try {
    const result = await fetchPhotoSet(['a', 'b'], { galleryCount: 6 });
    assert.ok(result.hero);
    assert.equal(result.gallery.length, 6);
    // hero shouldn't also appear in the gallery
    assert.ok(!result.gallery.some(g => g.url === result.hero.url));
  } finally {
    global.fetch = originalFetch;
    if (original === undefined) delete process.env.PEXELS_API_KEY;
    else process.env.PEXELS_API_KEY = original;
  }
});

test('newer templates match their business types and win over older overlapping keywords', () => {
  const cases = { 'tattoo shop': 'tattoo', 'Ink Studio & Piercing': 'tattoo', 'barber shop': 'barber', 'insurance agency': 'insurance',
    'home care agency': 'home-care', 'senior caregivers': 'home-care', 'party rental': 'party-rental', 'florist': 'florist',
    'auto detailing': 'car-detailing', 'catering company': 'catering', 'chiropractor': 'chiropractor', 'math tutoring': 'tutoring',
    'wedding planner': 'wedding', 'pool service': 'pool-service', 'tree service': 'tree-service', 'pressure washing': 'pressure-washing',
    'junk removal': 'junk-removal', 'coffee shop': 'coffee-shop', 'locksmith': 'locksmith', 'child care center': 'daycare',
    'mobile pet grooming': 'mobile-grooming', 'Dog Training': 'dog-training', 'puppy training class': 'dog-training', 'pet sitting': 'pet-care', 'dog walker': 'pet-care', 'dog daycare': 'pet-care', 'dog boarding kennel': 'pet-care' };
  for (const [type, id] of Object.entries(cases)) assert.equal(findTemplate(type).id, id, type);
  // older matches still work
  assert.equal(findTemplate('pet grooming').id, 'pet-grooming');
  assert.equal(findTemplate('hair salon').id, 'salon');
  assert.equal(findTemplate('house cleaning').id, 'cleaning');
  assert.equal(findTemplate('residential plumbing').id, 'plumbing');
});

test('every template is complete, unique and free of unbacked claims', () => {
  const { TEMPLATES } = require('../templates');
  const { FONTS } = require('../fonts');
  const ids = new Set();
  for (const t of TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
    assert.ok(t.services.length >= 3 && t.faq.length >= 1 && t.photoQueries.length >= 1, t.id);
    if (t.look && t.look.headingFont) assert.ok(FONTS.some(f => f.name === t.look.headingFont), `${t.id}: unknown font`);
  }
  assert.ok(TEMPLATES.length >= 45);
  for (const t of TEMPLATES) for (const b of (t.blocks || [])) assert.ok(['photoText', 'steps', 'features', 'cta', 'chips'].includes(b.type), `${t.id}: bad block`);
  // the newer templates promise nothing about licenses, hours or results
  for (const t of require('../templates-more')) {
    const text = JSON.stringify([t.hero, t.about, t.services, t.faq, t.blocks || []]);
    assert.doesNotMatch(text, /licensed|insured|24\/7|same-day|free estimate|guarantee|lowest|best |#1|award/i, t.id);
  }
});

test('every template ends up with a style, and every style has a hint', () => {
  const { TEMPLATES } = require('../templates');
  const looks = require('../template-looks');
  const themes = require('../themes');
  for (const t of TEMPLATES) {
    const look = t.look || looks[t.id];
    if (t.id === 'generic') continue;
    assert.ok(look && themes.ALL_STYLES.includes(look.style), `${t.id} has no valid style`);
    if (look.homeLayout) assert.ok(themes.HOME_LAYOUTS.includes(look.homeLayout), t.id);
  }
  for (const id of Object.keys(looks)) assert.ok(TEMPLATES.some(t => t.id === id), `unknown template ${id}`);
  for (const id of themes.ALL_STYLES) assert.ok(themes.STYLE_HINTS[id], `no hint for ${id}`);
});
