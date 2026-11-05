const test = require('node:test'); const assert = require('node:assert/strict');
const bw = require('../brandwall');

const site = {
  name: 'Peak Roofing',
  theme: { primaryColor: '#b91c1c', accentColor: '#1e293b', logoUrl: '' },
  sections: {
    hero: { headline: 'Roofs that [last]', subheadline: 'Repairs and replacements across Central Florida.', imageUrl: '/uploads/h.jpg' },
    services: { items: [{ title: 'Roof repair', imageUrl: '/uploads/a.jpg' }, { title: 'Gutters' }, { title: '' }] },
    gallery: { images: ['/uploads/g1.jpg', '/uploads/a.jpg'] },
    testimonials: { items: [{ quote: 'Fixed the leak the same week.', author: 'Maria G.' }, { quote: 'x'.repeat(200), author: 'Long' }] },
    trust: { stats: [{ value: '15', label: 'Years roofing' }], badges: ['Licensed', 'Insured'] },
  },
};

test('brandwall: size, tilt and speed are kept as size:tilt:speed, anything else falls back', () => {
  assert.equal(bw.cleanSide('tall:strong:slow'), 'tall:strong:slow:all');
  assert.equal(bw.cleanSide('huge:strong:slow'), bw.DEFAULT); assert.equal(bw.cleanSide('auto'), bw.DEFAULT);
  assert.deepEqual(bw.settings('screen:none:fast'), { size: 'screen', tilt: 'none', speed: 'fast', content: 'all', height: 0, deg: 0, secs: 36 }, 'walls saved before the content choice use everything');
  assert.equal(bw.cleanSide('short:none:slow:mine'), 'short:none:slow:mine'); assert.equal(bw.cleanSide('short:none:slow:theirs'), bw.DEFAULT);
});

test('brandwall: every card comes from the site\'s own content and the owner\'s lines', () => {
  const t = bw.tiles(site, { body: 'Built to last\n\nNo job too small' });
  const texts = t.map(x => x.text).filter(Boolean);
  assert.equal(t[0].kind, 'name'); assert.equal(t[0].text, 'Peak Roofing');
  assert.ok(texts.includes('Roofs that last'), 'highlight brackets are removed');
  ['Repairs and replacements across Central Florida.', 'Roof repair', 'Gutters', 'Fixed the leak the same week.', 'Years roofing', 'Licensed', 'Built to last', 'No job too small'].forEach(x => assert.ok(texts.includes(x), x));
  assert.ok(!texts.some(x => x.startsWith('xxx')), 'long reviews are left out');
  assert.deepEqual(t.filter(x => x.kind === 'photo').map(x => x.src), ['/uploads/g1.jpg', '/uploads/a.jpg', '/uploads/h.jpg'], 'photos are not repeated');
  assert.deepEqual(t.filter(x => x.kind === 'swatch').map(x => x.color), ['#b91c1c', '#1e293b']);
  assert.ok(t.some(x => x.kind === 'type'));
  assert.equal(new Set(t.map(x => x.kind)).size > 6, true);
  assert.notEqual(t[0].kind, t[1].kind, 'neighbouring cards differ');
});

test('brandwall: columns are long enough to loop and photos and swatches carry no tone', () => {
  const cols = bw.columns(bw.tiles(site, {}), 5);
  assert.equal(cols.length, 5); cols.forEach(c => assert.ok(c.length >= 10));
  cols.flat().forEach(x => assert.equal(Boolean(x.tone), x.kind !== 'photo' && x.kind !== 'swatch'));
  assert.deepEqual(bw.columns([], 5), [[], [], [], [], []]);
  assert.match(bw.styleVars({ accentColor: '#fde047' }), /--wall-accent: #fde047; --wall-on-accent: #111111/);
});

test('brandwall: the owner\'s own photos and lines come first, or alone with "only mine"', () => {
  const body = 'Built to last\n/uploads/own1.jpg\nhttps://example.com/own2.jpg\nNo job too small';
  assert.deepEqual(bw.ownContent(body), { photos: ['/uploads/own1.jpg', 'https://example.com/own2.jpg'], lines: ['Built to last', 'No job too small'] });
  const all = bw.tiles(site, { body, side: 'medium:gentle:normal:all' });
  assert.deepEqual(all.filter(x => x.kind === 'photo').map(x => x.src).slice(0, 2), ['/uploads/own1.jpg', 'https://example.com/own2.jpg']);
  assert.equal(all.find(x => x.kind === 'line').text, 'Built to last');
  assert.ok(all.some(x => x.text === 'Roof repair'));
  const mine = bw.tiles(site, { body, side: 'medium:gentle:normal:mine' });
  assert.deepEqual(mine.filter(x => x.kind === 'photo').map(x => x.src), ['/uploads/own1.jpg', 'https://example.com/own2.jpg']);
  assert.deepEqual(mine.filter(x => x.kind === 'line').map(x => x.text), ['Built to last', 'No job too small']);
  assert.ok(!mine.some(x => ['service', 'quote', 'stat', 'badge'].includes(x.kind)), 'no site content');
  assert.equal(mine[0].text, 'Peak Roofing', 'the name stays');
});
