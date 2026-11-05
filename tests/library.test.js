const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const ejs = require('ejs');
const lib = require('../library'); const bp = require('../library/blueprints'); const content = require('../library/content');
const { lint, prefix } = require('../tools/build-library'); const { TEMPLATES } = require('../templates');
const SRC = path.join(__dirname, '../library/src'), OUT = path.join(__dirname, '../views/library');
// a template that only includes another one (your own sections reuse the About arrangements) is checked through it
const srcOf = (file) => { const t = fs.readFileSync(path.join(SRC, file + '.ejs'), 'utf8'); const m = /include\('([a-z-]+)'/.exec(t); return m ? fs.readFileSync(path.join(SRC, m[1] + '.ejs'), 'utf8') : t; };

test('library: every registered section has a source template, a built view, and a license header', () => {
  for (const s of lib.SECTIONS) {
    const src = fs.readFileSync(path.join(SRC, s.file + '.ejs'), 'utf8');
    assert.ok(fs.existsSync(path.join(OUT, s.file + '.ejs')), s.file + ' is built');
    assert.match(src.slice(0, 300), /Adapted from (HyperUI|Start Bootstrap (Agency|Creative|Grayscale)|Meraki UI) \(MIT\)|Original/, s.file);
    if (/^Meraki UI/.test(s.source)) assert.ok(src.slice(0, 300).includes('Adapted from Meraki UI (MIT) ' + s.source.replace('Meraki UI (MIT) ', '')), s.file + ' names its Meraki folder');
    if (/^Start Bootstrap/.test(s.source)) assert.ok(src.includes('Adapted from ' + s.source), s.file + ' names its template');
    assert.deepEqual(lint(s.file, src), [], s.file);
  }
  assert.equal(fs.readdirSync(SRC).filter(f => f.endsWith('.ejs')).length, lib.SECTIONS.length, 'no unregistered template');
  assert.ok(lib.SECTIONS.length >= 25);
});
test('library: no paid blocks, no stock palette colors, no scripts, every class prefixed', () => {
  for (const f of fs.readdirSync(OUT)) {
    const html = fs.readFileSync(path.join(OUT, f), 'utf8');
    assert.doesNotMatch(html, /flowbite|preline|tailwind ?plus|tailwindui/i, f);
    assert.doesNotMatch(html, /<script/i, f);
    for (const m of html.matchAll(/\bclass="([^"]*)"/g)) {
      const toks = m[1].replace(/<%[\s\S]*?%>/g, ' ').split(/\s+/).filter(Boolean);
      assert.ok(toks.every(t => t.startsWith('tw:') || t === 'sg-lib' || t.startsWith('sg-')), f + ': unprefixed class in ' + m[1]);
    }
  }
  assert.ok(lint('x.ejs', '<%# Original %><div class="bg-blue-600 dark:bg-gray-900"></div>').length >= 2, 'the linter catches stock colors and dark: variants');
  assert.equal(prefix('<div class="a hover:b <%= x ? \'c d\' : \'\' %>"></div>'), '<div class="tw:a tw:hover:b <%= x ? \'tw:c tw:d\' : \'\' %>"></div>');
});
test('library: the compiled stylesheet maps colors and fonts to the site theme variables', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  for (const v of ['var(--primary)', 'var(--page-bg)', 'var(--surface)', 'var(--ink)', 'var(--heading-font)', 'var(--on-primary)']) assert.ok(css.includes(v), v);
  assert.doesNotMatch(css, /#3b82f6|oklch\(0\.62/i, 'no stock Tailwind blue');
});
test('blueprints: every industry template maps to a blueprint made only of registered sections', () => {
  for (const t of TEMPLATES) assert.ok(bp.BLUEPRINTS[bp.forTemplate(t.id)], t.id);
  assert.equal(bp.forTemplate('nonsense'), 'generic');
  for (const [id, b] of Object.entries(bp.BLUEPRINTS)) for (const s of b.sections) assert.ok(lib.isVariant(s.family, s.variant), id + ' ' + s.family + '/' + s.variant);
  assert.equal(new Set(Object.values(bp.BY_TEMPLATE)).size, bp.IDS.length - 2, 'every blueprint except generic and bento (a style anyone can pick) is used');
});
const site = (o = {}) => ({ name: 'Test Co', theme: {}, layout: { hidden: [] }, sections: Object.assign({ hero: { headline: 'Hello there', subheadline: '', ctaText: 'Go', imageUrl: '' }, about: { heading: 'About', body: '', imageUrl: '' }, services: { heading: 'Svc', items: [] }, whyChoose: { items: [] }, testimonials: { items: [] }, faq: { items: [] }, gallery: { images: [] }, contact: { phone: '', email: '' }, trust: { stats: [], serviceAreas: [] }, booking: { services: [] } }, o) });
const ctxOf = (s, extra = {}) => ({ site: s, basePath: '', services: (s.sections.services.items || []).map((x, i) => ({ ...x, slug: 's' + i })), areas: [], navPages: [], templateId: 'plumbing', visible: k => !s.layout.hidden.includes(k), ...extra });
test('blueprints: sections with no real content are skipped, never invented', () => {
  const p = bp.plan(ctxOf(site()));
  assert.deepEqual(p.items.map(i => i.family), ['hero']);
  assert.ok(p.skipped.length >= 5 && p.skipped.every(x => x.reason));
  const s = site(); s.sections.services.items = [{ title: 'Drain cleaning', description: 'Clearing drains.' }]; s.sections.faq.items = [{ question: 'Q?', answer: 'A.' }];
  s.sections.trust.stats = [{ value: '12', label: 'Years' }]; // one stat is not enough for a band
  const q = bp.plan(ctxOf(s));
  assert.deepEqual(q.items.map(i => i.family), ['hero', 'services', 'faq']);
});
test('blueprints: owner choices (other blueprint, variant, leave out, hidden section, native hero) are respected', () => {
  const s = site(); s.sections.services.items = [{ title: 'A', description: '' }]; s.sections.faq.items = [{ question: 'Q?', answer: 'A.' }];
  s.theme = { blueprint: 'food', bpVariants: { services: 'list', bogus: 'x' }, bpSkip: ['faq'] };
  let p = bp.plan(ctxOf(s));
  assert.equal(p.blueprint, 'food'); assert.equal(p.items.find(i => i.family === 'services').variant, 'list');
  assert.equal(p.items.find(i => i.family === 'hero').variant, 'mosaic');
  s.theme = { bpVariants: { services: 'nope' }, bpSkip: ['faq'] }; s.layout.hidden = ['services'];
  p = bp.plan(ctxOf(s)); assert.equal(p.blueprint, 'trades');
  assert.ok(!p.items.some(i => ['services', 'faq'].includes(i.family)));
  p = bp.plan(ctxOf(s, { nativeHero: true })); assert.ok(!p.items.some(i => i.family === 'hero'));
});
test('content: prices come from the service or the matching booking service; pricing needs two', () => {
  const s = site(); s.sections.services.items = [{ title: 'Haircut' }, { title: 'Color' }, { title: 'Blowout' }];
  s.sections.booking = { services: [{ name: 'haircut', price: '45' }, { name: 'Color', price: '$120' }] };
  const d = content.bind('pricing', ctxOf(s)); assert.deepEqual(d.items.map(i => i.price), ['$45', '$120']);
  s.sections.booking = { services: [{ name: 'Color', price: '$120' }] }; assert.equal(content.bind('pricing', ctxOf(s)), null);
  assert.equal(content.bind('gallery', ctxOf(Object.assign(site(), { sections: { ...site().sections, gallery: { images: ['a', 'b'] } } }))), null, 'two photos is not a gallery');
});
test('templates render with real data, escape HTML, and never print undefined', async () => {
  const s = site(); s.sections.hero.headline = '<img src=x onerror=alert(1)>';
  const d = content.bind('hero', ctxOf(s));
  const html = await ejs.renderFile(path.join(OUT, 'hero-centered.ejs'), { d });
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img src=x/);
  const { toGrapesBlocks } = require('../library/grapes');
  const blocks = await toGrapesBlocks(ejs, path.join(__dirname, '../views'));
  assert.equal(blocks.length, lib.SECTIONS.length);
  for (const b of blocks) { assert.match(b.content, /data-sg-section=/); assert.doesNotMatch(b.content, /undefined|\[object/, b.id); assert.ok(b.category && b.label); }
});

// ---- round 2: original variants (designed from scratch, inspired by component-marketplace patterns) ----
const NEW = ['hero/spotlight', 'hero/mosaic', 'hero/stat', 'services/bento', 'services/reveal', 'services/rows', 'testimonials/wall', 'testimonials/marquee', 'testimonials/quote', 'pricing/rates', 'pricing/featured', 'faq/side', 'faq/numbered', 'cta/split', 'contact/cards'];
test('new variants: every one is registered as an original, has 2-3 siblings per section type, and carries no third-party credit it should not', () => {
  for (const id of NEW) {
    const s = lib.BY_ID[id]; assert.ok(s, id); assert.equal(s.source, 'Original'); assert.equal(s.license, 'Ours');
    const src = fs.readFileSync(path.join(SRC, s.file + '.ejs'), 'utf8');
    assert.match(src.slice(0, 40), /^<%# Original/); assert.doesNotMatch(src, /21st\.dev|shadcn|framer|react/i, 'no copied component code or imports');
  }
  for (const f of ['hero', 'services', 'testimonials', 'pricing', 'faq', 'cta']) assert.ok(lib.variantsOf(f).length >= 3, f + ' has at least three layouts');
  assert.ok(lib.variantsOf('contact').length >= 2);
  assert.ok(lib.SECTIONS.length >= 40);
});
test('new variants: render from real-shaped data and from bare data without printing undefined', async () => {
  const { SAMPLES } = require('../library/grapes');
  for (const id of NEW) {
    const s = lib.BY_ID[id];
    const full = await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: SAMPLES[s.family] });
    assert.doesNotMatch(full, /undefined|\[object|NaN/, id);
    const bare = JSON.parse(JSON.stringify(SAMPLES[s.family]));
    for (const k of ['sub', 'image', 'phone', 'text', 'moreHref', 'intro']) if (k in bare) bare[k] = '';
    for (const k of ['trust', 'stats', 'images']) if (k in bare) bare[k] = [];
    if (bare.items) bare.items = bare.items.slice(0, 1).map(it => ({ ...it, description: '', price: it.price || '', imageUrl: '', role: '', rating: 0 }));
    const out = await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: bare });
    assert.doesNotMatch(out, /undefined|\[object|NaN/, id + ' (sparse data)');
  }
});
test('new variants: motion is CSS/vanilla, honors reduced motion, and keeps the page usable without scripts', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  assert.match(css, /@keyframes sg-marquee/); assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /hover: ?hover/, 'hover reveal only on devices that can hover');
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-lib.js'), 'utf8');
  assert.match(js, /data-sg-quotes/); assert.doesNotMatch(js, /import |require\(|react/i);
  const marquee = fs.readFileSync(path.join(OUT, 'testimonials-marquee.ejs'), 'utf8');
  assert.match(marquee, /aria-hidden="true"/, 'the repeated copy is hidden from screen readers');
  const quote = fs.readFileSync(path.join(OUT, 'testimonials-quote.ejs'), 'utf8');
  assert.match(quote, /data-sg-quote-nav hidden/, 'avatar buttons appear only when JS can run');
});
test('new variants: bento shows whole rows only, stat hero falls back to a photo, mosaic copes with one photo', async () => {
  const items = n => Array.from({ length: n }, (_, i) => ({ title: 'S' + i, description: 'd', price: '', imageUrl: '', href: '#' }));
  const count = async n => ((await ejs.renderFile(path.join(OUT, 'services-bento.ejs'), { d: { heading: 'H', items: items(n), moreHref: '' } })).match(/<a /g) || []).length;
  assert.equal(await count(6), 6); assert.equal(await count(5), 3); assert.equal(await count(3), 3); assert.equal(await count(2), 2);
  const base = { headline: 'H', sub: '', ctaText: 'Go', ctaHref: '#', phone: '', phoneHref: '', trust: [], stats: [], image: '/a.jpg', images: ['/a.jpg'] };
  assert.match(await ejs.renderFile(path.join(OUT, 'hero-stat.ejs'), { d: base }), /\/a\.jpg/);
  assert.doesNotMatch(await ejs.renderFile(path.join(OUT, 'hero-stat.ejs'), { d: { ...base, image: '', stats: [{ value: '1', label: 'x' }, { value: '2', label: 'y' }] } }), /<img/);
  assert.equal((await ejs.renderFile(path.join(OUT, 'hero-mosaic.ejs'), { d: base })).match(/<img/g).length, 1);
});
test('blueprints: each industry gets sensible defaults from the new variants', () => {
  const used = new Set(Object.values(bp.BLUEPRINTS).flatMap(b => b.sections.map(s => `${s.family}/${s.variant}`)));
  for (const id of ['hero/stat', 'hero/spotlight', 'hero/mosaic', 'services/bento', 'services/reveal', 'services/rows', 'testimonials/wall', 'testimonials/marquee', 'testimonials/quote', 'faq/side', 'faq/numbered', 'contact/cards']) assert.ok(used.has(id), id + ' is a default somewhere');
  const trades = bp.BLUEPRINTS.trades.sections.map(s => `${s.family}/${s.variant}`);
  assert.ok(trades.includes('hero/stat') && trades.includes('services/bento') && trades.includes('faq/side'));
  assert.ok(bp.BLUEPRINTS.food.sections.some(s => s.variant === 'reveal') && bp.BLUEPRINTS.professional.sections.some(s => s.variant === 'rows'));
});
test('content: hero carries trust items, at least two real numbers and extra photos; contact gains text and map links', () => {
  const s = site(); s.sections.hero = { headline: 'H', subheadline: '', ctaText: 'Go', imageUrl: '/h.jpg', trustText: 'Licensed • Insured • Local' };
  s.sections.about.imageUrl = '/a.jpg'; s.sections.gallery.images = ['/h.jpg', '/g1.jpg']; s.sections.trust.stats = [{ value: '12', label: 'Years' }];
  let d = content.bind('hero', ctxOf(s));
  assert.deepEqual(d.trust, ['Licensed', 'Insured', 'Local']); assert.deepEqual(d.stats, []); assert.deepEqual(d.images, ['/h.jpg', '/a.jpg', '/g1.jpg']);
  s.sections.trust.stats.push({ value: '4.9', label: 'Rating' }); assert.equal(content.bind('hero', ctxOf(s)).stats.length, 2);
  s.sections.contact = { phone: '407-555-0100', email: 'a@b.co', address: '1 Main St' };
  const c = content.bind('contact', ctxOf(s)); assert.deepEqual(c.items.map(i => i.kind), ['call', 'text', 'email', 'visit']);
  assert.equal(c.items[1].href, 'sms:4075550100'); assert.match(c.items[3].href, /^https:\/\/maps\.google\.com\/\?q=1%20Main%20St/);
});

// ---- round 3: effects and per-section options ----
test('effects: library headings are marked so emoji headings and hand-drawn underlines can reach them', () => {
  for (const s of lib.SECTIONS.filter(x => !['hero', 'stats', 'logos', 'banner'].includes(x.family))) {
    assert.match(srcOf(s.file), /data-sg-head/, s.file + ' has a marked heading');
  }
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  for (const needle of ['body.emoji-heads', 'body.doodles', 'body.hover-lift', 'data-sg-bg=brand', 'data-sg-emoji', 'var(--emoji-q)']) assert.ok(css.includes(needle), needle);
});
test('effects: per-section options are cleaned (real emoji only, known values only, no markup in titles)', () => {
  const { cleanEmoji } = require('../accents');
  const o = bp.cleanSectionOpts({ services: { emoji: 'x🚿y🔧', doodle: 'on', bg: 'brand', title: '<b>Our work</b>' }, faq: { emoji: 'abc', doodle: 'bogus', bg: 'neon', title: '' }, bogus: { emoji: '🔧' } }, cleanEmoji);
  assert.deepEqual(o, { services: { emoji: '🚿', doodle: 'on', bg: 'brand', title: 'bOur work/b' } });
  assert.deepEqual(bp.cleanSectionOpts(undefined, cleanEmoji), {});
});
test('effects: the plan carries the options and applies a heading override; hero override changes the headline', () => {
  const s = site(); s.sections.services.items = [{ title: 'A', description: '' }];
  s.theme = { bpSec: { services: { emoji: '🚿', doodle: 'off', bg: 'alt', title: 'Our jobs' }, hero: { title: 'New headline' } } };
  const p = bp.plan(ctxOf(s));
  const sv = p.items.find(i => i.family === 'services'); assert.equal(sv.d.heading, 'Our jobs'); assert.deepEqual({ emoji: sv.opts.emoji, doodle: sv.opts.doodle, bg: sv.opts.bg }, { emoji: '🚿', doodle: 'off', bg: 'alt' });
  assert.equal(p.items.find(i => i.family === 'hero').d.headline, 'New headline');
});
test('effects: the section wrapper writes only safe attributes', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '../views/_lib-section.ejs'), { libWrap: bp.wrap, item: { file: 'faq-accordion', d: { heading: 'H', items: [{ question: 'Q', answer: 'A' }] }, opts: { emoji: '🔧', doodle: 'on', bg: 'brand' } } });
  assert.match(html, /class="sg-sec" data-sg-bg="brand" data-sg-doodle="on" data-sg-emoji="1" style="--sg-emoji: '🔧'"/); assert.match(html, /data-sg-section="faq\/accordion"/);
  assert.doesNotMatch(await ejs.renderFile(path.join(__dirname, '../views/_lib-section.ejs'), { libWrap: bp.wrap, item: { file: 'faq-accordion', d: { heading: 'H', items: [{ question: 'Q', answer: 'A' }] }, opts: {} } }), /data-sg-(bg|emoji|doodle)/);
});

// ---- round 4: parallax scenes and scrolling banner ----
test('scenes: three original layered heroes with four depth layers, brand-driven colors and motion that respects reduced motion', () => {
  for (const v of ['scene-city', 'scene-hills', 'scene-shore']) {
    const s = lib.BY_ID['hero/' + v]; assert.ok(s && s.source === 'Original', v);
    const src = fs.readFileSync(path.join(SRC, s.file + '.ejs'), 'utf8');
    assert.equal((src.match(/data-speed="/g) || []).length, 4, v + ' has four layers'); assert.match(src, /data-sg-parallax/);
    assert.match(src, /aria-hidden="true"/); assert.doesNotMatch(src, /<image|href="http|url\(/i, 'artwork is inline vector, nothing fetched');
  }
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  assert.match(css, /\.sg-scene\{background:linear-gradient/); assert.match(css, /var\(--accent\)/); assert.match(css, /\.sg-scene \.sg-l4/);
  assert.match(css, /prefers-reduced-motion/);
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-lib.js'), 'utf8');
  assert.match(js, /data-sg-parallax/); assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /requestAnimationFrame/); assert.match(js, /passive: true/);
});
test('banner: built only from the client\'s own badges, services and towns; needs three phrases', () => {
  const s = site(); s.sections.trust = { badges: ['Family owned'], stats: [], serviceAreas: [] };
  assert.equal(content.bind('banner', ctxOf(s)), null);
  s.sections.services.items = [{ title: 'Drains' }, { title: 'Family owned' }];
  assert.equal(content.bind('banner', ctxOf(s)), null, 'two distinct phrases is not enough');
  s.sections.services.items.push({ title: 'Leaks' });
  assert.deepEqual(content.bind('banner', ctxOf(s)).items, ['Family owned', 'Drains', 'Leaks']);
});
test('add a section: owner-added families land after their anchor, never twice, never a second hero', () => {
  const l = bp.sectionList({ bpAdd: ['banner', 'faq', 'hero', 'bogus', 'pricing'] }, 'plumbing');
  const fam = l.sections.map(x => x.family);
  assert.equal(fam[1], 'banner'); assert.equal(fam.filter(f => f === 'faq').length, 1); assert.equal(fam.filter(f => f === 'hero').length, 1); assert.ok(!fam.includes('bogus'));
  assert.equal(fam[fam.indexOf('services') + 1], 'pricing'); assert.ok(l.sections.find(x => x.family === 'banner').added);
  const s = site(); s.sections.trust = { badges: ['A', 'B', 'C'], stats: [], serviceAreas: [] }; s.theme = { bpAdd: ['banner'], bpVariants: { banner: 'quiet', hero: 'scene-city' } };
  const p = bp.plan(ctxOf(s)); assert.deepEqual(p.items.map(i => i.id), ['hero/scene-city', 'banner/quiet']);
});

// ---- round 5: your own sections (words, photos, or both) ----
const cs = (o) => ({ after: 'end', layout: '', heading: '', body: '', images: [], buttonText: '', buttonUrl: '', ...o });
test('own sections: the layout is picked from what was filled in (words, photos, or both)', () => {
  const c = ctxOf(site());
  const lay = (o, i = 0) => (content.bindCustom(cs(o), c, i) || {}).layout;
  assert.equal(lay({ body: 'Words.' }), 'text'); assert.equal(lay({ heading: 'H' }), 'text');
  assert.equal(lay({ images: ['/a.jpg'] }), 'photo'); assert.equal(lay({ images: ['/a.jpg', '/b.jpg', '/c.jpg'] }), 'photos');
  assert.equal(lay({ body: 'W', images: ['/a.jpg'] }, 0), 'photo-text'); assert.equal(lay({ body: 'W', images: ['/a.jpg'] }, 1), 'text-photo');
  assert.equal(lay({ body: 'W', images: ['/a.jpg', '/b.jpg'] }), 'photos');
  assert.equal(content.bindCustom(cs({}), c), null, 'an empty section draws nothing');
});
test('own sections: a chosen layout is honored only when the content supports it', () => {
  const c = ctxOf(site());
  assert.equal(content.bindCustom(cs({ layout: 'photos', body: 'W', images: ['/a.jpg'] }), c).layout, 'photo-text', 'a photo grid needs two photos');
  assert.equal(content.bindCustom(cs({ layout: 'photo', body: 'W' }), c).layout, 'text', 'no photo, so words only');
  assert.equal(content.bindCustom(cs({ layout: 'text', body: 'W', images: ['/a.jpg'] }), c).d.images.length, 0, 'words-only drops the photos');
  assert.equal(content.bindCustom(cs({ images: ['/1', '/2', '/3', '/4', '/5'] }), c).d.images.length, 4);
  assert.equal(content.bindCustom(cs({ body: 'W', buttonText: 'Go' }), c).d.buttonText, '', 'a button needs a link');
});
test('own sections: placed after the section chosen, in order, and at the end when that section is not on the page', () => {
  const s = site(); s.sections.services.items = [{ title: 'A', description: '' }]; s.sections.faq.items = [{ question: 'Q?', answer: 'A.' }];
  s.sections.custom = { items: [cs({ after: 'services', heading: 'One' }), cs({ after: 'services', heading: 'Two' }), cs({ after: 'top', heading: 'Top' }), cs({ after: 'testimonials', heading: 'Gone' }), cs({ after: 'end', heading: 'End' })] };
  const p = bp.plan(ctxOf(s));
  assert.deepEqual(p.items.map(i => i.family === 'custom' ? i.d.heading : i.family), ['hero', 'Top', 'services', 'One', 'Two', 'faq', 'Gone', 'End']);
  s.theme = { bpHero: 'native' }; assert.equal(bp.plan(ctxOf(s)).items[0].d.heading, 'Top', 'with the site hero, top means first');
});
test('own sections: every layout renders with sparse data and escapes HTML', async () => {
  for (const v of ['text', 'photo-text', 'text-photo', 'photo', 'photos']) {
    const d = { heading: '', body: '', images: v === 'text' ? [] : [{ src: '/a.jpg', alt: '' }, { src: '/b.jpg', alt: '' }], buttonText: '', buttonHref: '' };
    const out = await ejs.renderFile(path.join(OUT, `custom-${v}.ejs`), { d });
    assert.doesNotMatch(out, /undefined|\[object/, v);
    const evil = await ejs.renderFile(path.join(OUT, `custom-${v}.ejs`), { d: { ...d, heading: '<script>x</script>', body: '<b>hi</b>', buttonText: 'Go', buttonHref: '/c' } });
    assert.doesNotMatch(evil, /<script>x|<b>hi/, v);
  }
});

// ---- round 6: per-section size and photos ----
const cleanEmoji = require('../accents').cleanEmoji;
const safe = (u) => /^(https?:\/\/|\/uploads\/)/.test(u);
test('size: presets and exact numbers are cleaned, clamped and limited to known values', () => {
  const o = bp.cleanSectionOpts({ about: { space: 'tall', width: 'full', text: 'large', padY: '9999', maxW: '10', fs: '40' }, faq: { space: 'huge', width: 'x', text: 'y', padY: '48', maxW: '900', fs: '125' } }, cleanEmoji, safe);
  assert.deepEqual([o.about.space, o.about.width, o.about.text, o.about.padY, o.about.maxW, o.about.fs], ['tall', 'full', 'large', 400, 320, 70]);
  assert.deepEqual([o.faq.space, o.faq.width, o.faq.text, o.faq.padY, o.faq.maxW, o.faq.fs], ['', '', '', 48, 900, 125]);
  assert.deepEqual(bp.cleanSectionOpts({ hero: { space: 'tall', padY: '50' }, banner: { fs: '120' } }, cleanEmoji, safe), {}, 'heroes and banners are not resized');
  assert.deepEqual(bp.cleanSectionOpts({ about: { padY: 'abc', maxW: '', fs: null } }, cleanEmoji, safe), {});
});
test('photo: only safe links, only known places, never on heroes or banners', () => {
  const ok = bp.cleanSectionOpts({ about: { photo: '/uploads/a.jpg', photoPos: 'left', photoSize: 'large' }, faq: { photo: 'javascript:alert(1)', photoPos: 'left' }, services: { photo: '/uploads/b.jpg', photoPos: 'sideways' }, hero: { photo: '/uploads/c.jpg', photoPos: 'bg' }, cta: { photo: '/uploads/d.jpg', photoPos: 'bg', photoOverlay: 'dark' } }, cleanEmoji, safe);
  assert.deepEqual([ok.about.photo, ok.about.photoPos, ok.about.photoSize], ['/uploads/a.jpg', 'left', 'large']);
  assert.ok(!ok.faq && !ok.services && !ok.hero, 'unsafe link, unknown place and hero are all dropped');
  assert.equal(ok.cta.photoOverlay, 'dark'); assert.equal(ok.cta.photoSize, 'medium');
  assert.deepEqual(bp.cleanSectionOpts({ about: { photo: '/uploads/a.jpg', photoPos: 'left' } }, cleanEmoji), {}, 'without a link checker no photo is kept');
});
test('size: the wrapper turns options into data attributes and CSS variables only', () => {
  const w = bp.wrap({ space: 'roomy', width: 'full', text: 'large', emoji: '🔧' });
  assert.match(w.attrs, /data-sg-pad="1"/); assert.match(w.attrs, /data-sg-max="1"/); assert.match(w.attrs, /data-sg-fs="1"/);
  assert.match(w.style, /--sg-pad: 112px/); assert.match(w.style, /--sg-max: none/); assert.match(w.style, /--sg-fs: 1\.20/);
  assert.match(bp.wrap({ padY: 0 }).style, /--sg-pad: 0px/, 'zero is a real choice');
  assert.match(bp.wrap({ space: 'tall', padY: 60 }).style, /--sg-pad: 60px/, 'exact number wins');
  assert.match(bp.wrap({ maxW: 800, width: 'wide' }).style, /--sg-max: 800px/);
  assert.equal(bp.wrap({}).attrs, ''); assert.equal(bp.wrap({ fs: 100 }).attrs, '');
  const bg = bp.wrap({ photo: "/uploads/a b').jpg", photoPos: 'bg', photoOverlay: 'dark' });
  assert.match(bg.attrs, /data-sg-bg="photo"/); assert.match(bg.style, /--sg-ov: 0\.7/); assert.doesNotMatch(bg.style, /a b'\)/, 'quotes, spaces and brackets cannot break out of url()');
  const side = bp.wrap({ photo: '/uploads/a.jpg', photoPos: 'right', photoSize: 'small' });
  assert.deepEqual(side.side, { pos: 'right', url: '/uploads/a.jpg', size: 'small' }); assert.match(side.attrs, /data-sg-side="right" data-sg-psize="small"/);
});
test('size: every resizable section has the container the CSS targets, and the CSS rules exist', () => {
  for (const s of lib.SECTIONS.filter(x => !['hero', 'banner'].includes(x.family))) {
    const src = srcOf(s.file);
    const m = /<section class="sg-lib"[^>]*>\s*<div class="[^"]*">\s*<div class="([^"]*)"/.exec(src);
    assert.ok(m && /max-w-/.test(m[1]) && /py-/.test(m[1]), s.file + ' container');
  }
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  for (const need of ['data-sg-pad', 'data-sg-max', 'data-sg-fs', '--sg-fs', 'data-sg-side', 'sg-side-photo', 'data-sg-bg=photo']) assert.ok(css.includes(need), need + ' missing from the library CSS');
  assert.ok(/--tw-text-2xl:\s*calc\(1\.5rem\s*\*\s*var\(--sg-fs\)\)/.test(css), 'text sizes scale with --sg-fs');
});
test('photo: the wrapper places a photo beside, above, below or behind a section', async () => {
  const render = (opts) => ejs.renderFile(path.join(__dirname, '../views/_lib-section.ejs'), { libWrap: bp.wrap, item: { file: 'faq-accordion', d: { heading: 'H', items: [{ question: 'Q', answer: 'A' }] }, opts } });
  let h = await render({ photo: '/uploads/a.jpg', photoPos: 'left', photoSize: 'large' });
  assert.match(h, /data-sg-side="left"/); assert.match(h, /<div class="sg-side-wrap"><figure class="sg-side-photo"><img src="\/uploads\/a\.jpg" alt=""/);
  assert.ok(h.indexOf('sg-side-photo') < h.indexOf('sg-sec-in'), 'left photo comes first');
  h = await render({ photo: '/uploads/a.jpg', photoPos: 'above' });
  assert.ok(h.indexOf('sg-band') < h.indexOf('sg-sec-in')); assert.doesNotMatch(h, /sg-side-wrap/);
  h = await render({ photo: '/uploads/a.jpg', photoPos: 'below' });
  assert.ok(h.indexOf('sg-band') > h.indexOf('data-sg-section'));
  h = await render({ photo: '/uploads/a.jpg', photoPos: 'bg' });
  assert.match(h, /data-sg-bg="photo"/); assert.doesNotMatch(h, /<img/);
  assert.doesNotMatch(await render({}), /sg-side|<img/);
  assert.match(await render({ photo: '/uploads/<x>.jpg', photoPos: 'left' }), /src="\/uploads\/&lt;x&gt;\.jpg"/, 'photo links are escaped');
});
test('card photos: reasons and reviews can carry a photo, and nothing changes without one', async () => {
  const r = (file, d) => ejs.renderFile(path.join(OUT, file + '.ejs'), { d });
  const why = { heading: 'W', items: [{ title: 'A', text: 'a', imageUrl: '/uploads/w.jpg' }, { title: 'B', text: 'b' }] };
  for (const f of ['why-grid', 'why-split']) {
    const h = await r(f, why); assert.equal((h.match(/src="\/uploads\/w\.jpg"/g) || []).length, 1, f); assert.equal((h.match(/<svg/g) || []).length, 1, f + ' keeps the check mark for the card without a photo');
  }
  const rev = { heading: 'R', items: [{ quote: 'Great', name: 'Ann', role: '', rating: 5, photo: '/uploads/ann.jpg' }, { quote: 'Fine', name: 'Bo', role: '', rating: 0 }] };
  for (const f of ['testimonials-grid', 'testimonials-wall', 'testimonials-carousel', 'testimonials-marquee', 'testimonials-quote', 'testimonials-single']) {
    const h = await r(f, rev); assert.ok(h.includes('src="/uploads/ann.jpg"'), f);
    assert.ok(!(await r(f, { ...rev, items: rev.items.map(i => ({ ...i, photo: '' })) })).includes('rounded-full object-cover'), f + ' shows no avatar without a photo');
  }
  const c = content.bind('why', { site: { sections: { whyChoose: { items: [{ title: 'A', text: 'x', imageUrl: '/uploads/w.jpg' }, { title: 'B', text: 'y' }] } } }, basePath: '' });
  assert.equal(c.items[0].imageUrl, '/uploads/w.jpg'); assert.equal(c.items[1].imageUrl, '');
});

// ---- round 7: section colors and gradients ----
test('color: your own color, your gradient and the brand gradient are cleaned and need their colors', () => {
  const o = bp.cleanSectionOpts({
    faq: { bg: 'gradient', bgColor: '#112233', bgColor2: '#FFEEAA', gradDir: 'right' }, cta: { bg: 'color' }, services: { bg: 'color', bgColor: '#ffffff', gradDir: 'sideways' },
    why: { bg: 'themegrad', bgColor: '#123456' }, pricing: { bg: 'gradient', bgColor: '#123456' }, areas: { bg: 'color', bgColor: 'red;}</style>' }, stats: { bg: 'alt', bgColor: '#123456' }
  }, cleanEmoji, safe);
  assert.deepEqual([o.faq.bg, o.faq.bgColor, o.faq.bgColor2, o.faq.gradDir], ['gradient', '#112233', '#ffeeaa', 'right']);
  assert.ok(!o.cta, 'a color background with no color is dropped'); assert.ok(!o.pricing, 'a gradient needs both colors'); assert.ok(!o.areas, 'junk colors are refused');
  assert.equal(o.services.bg, 'color'); assert.equal(o.services.gradDir, undefined, 'unknown direction dropped');
  assert.equal(o.why.bg, 'themegrad'); assert.equal(o.why.bgColor, undefined, 'colors kept only when used');
  assert.equal(o.stats.bg, 'alt'); assert.equal(o.stats.bgColor, undefined);
});
test('color: the wrapper writes a safe gradient and picks readable text', () => {
  const g = bp.wrap({ bg: 'gradient', bgColor: '#101820', bgColor2: '#203040', gradDir: 'down' });
  assert.match(g.attrs, /data-sg-bg="custom"/); assert.match(g.style, /--sg-bgimg: linear-gradient\(to bottom, #101820, #203040\)/); assert.match(g.style, /--sg-onbrand: #ffffff/, 'dark colors get light text');
  assert.match(bp.wrap({ bg: 'color', bgColor: '#fff4c2' }).style, /--sg-onbrand: #111111/, 'light colors get dark text');
  assert.match(bp.wrap({ bg: 'gradient', bgColor: '#101820', bgColor2: '#203040', gradDir: 'radial' }).style, /radial-gradient\(circle at 50% 0%, #101820, #203040\)/);
  assert.match(bp.wrap({ bg: 'themegrad' }).style, /linear-gradient\(135deg, var\(--primary\), var\(--accent\)\)/);
  assert.equal(bp.wrap({ bg: 'color' }).attrs, '', 'no color, no background change');
  assert.doesNotMatch(bp.wrap({ bg: 'color', bgColor: 'red;}</style>' }).style, /red/);
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  assert.ok(/data-sg-bg=custom\]\{background:var\(--sg-bgimg,\s*var\(--sg-brand\)\)\}/.test(css), 'custom background rule');
});

// ---- round 8: more layouts, Flip, photo shapes, auto-alternate ----
test('layouts: the new arrangements are registered, original, and every family that was thin now has several', () => {
  for (const id of ['about/overlap', 'about/offset', 'about/collage', 'about/sticky', 'about/frosted', 'about/editorial', 'about/magazine', 'about/strip', 'about/bleed',
    'why/zigzag', 'why/editorial', 'why/photocards', 'why/bgcards', 'services/zigzag', 'services/bgcards', 'services/icons',
    'gallery/masonry', 'gallery/feature', 'gallery/filmstrip', 'gallery/carousel', 'contact/map', 'contact/mapcard', 'custom/overlap', 'custom/collage', 'custom/bleed']) {
    assert.ok(lib.BY_ID[id], id); assert.equal(lib.BY_ID[id].source, 'Original', id);
  }
  assert.ok(lib.variantsOf('about').length >= 10 && lib.variantsOf('gallery').length >= 5 && lib.variantsOf('why').length >= 6 && lib.variantsOf('contact').length >= 4);
  assert.equal(lib.BY_ID['about/split'].side, 'right'); assert.equal(lib.BY_ID['about/photo-left'].side, 'left'); assert.ok(lib.BY_ID['about/overlap'].flippable);
});
test('layouts: every new arrangement renders with the sample content and with almost nothing', async () => {
  const { SAMPLES } = require('../library/grapes');
  for (const s of lib.SECTIONS.filter(x => ['about', 'why', 'services', 'gallery', 'contact', 'custom'].includes(x.family) && /overlap|offset|collage|sticky|frosted|editorial|magazine|strip|bleed|zigzag|photocards|bgcards|icons|masonry|feature|filmstrip|carousel|map/.test(x.variant))) {
    const full = await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: SAMPLES[s.family] });
    assert.match(full, new RegExp('data-sg-section="' + s.id + '"'), s.id); assert.doesNotMatch(full, /undefined|\[object/, s.id);
    const bare = s.family === 'gallery' ? { heading: 'G', images: [{ src: '/a.jpg', alt: '' }] } : s.family === 'contact' ? { heading: 'C', items: [] } : s.family === 'why' || s.family === 'services' ? { heading: 'H', items: [{ title: 'T' }] } : { heading: 'H', body: 'B' };
    assert.doesNotMatch(await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: bare }), /undefined|\[object/, s.id + ' bare');
  }
});
test('layouts: Flip and photo shape are cleaned and written by the wrapper', async () => {
  const { cleanEmoji } = require('../accents');
  const o = bp.cleanSectionOpts({ about: { flip: '1', shape: 'arch' }, why: { flip: 'yes', shape: 'star' } }, cleanEmoji);
  assert.equal(o.about.flip, true); assert.equal(o.about.shape, 'arch'); assert.ok(!o.why, 'unknown values are dropped');
  const w = bp.wrap({ flip: true, shape: 'blob' });
  assert.match(w.attrs, /data-sg-flip="1"/); assert.match(w.attrs, /data-sg-shape="blob"/);
  assert.doesNotMatch(bp.wrap({ flip: true, autoFlip: true }).attrs, /data-sg-flip/, 'a manual flip on top of an automatic one cancels out');
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  for (const need of ['data-sg-flip', 'sg-zz', 'data-sg-shape=arch', 'data-sg-shape=circle', 'data-sg-shape=blob', 'sg-glass', 'sg-ovl']) assert.ok(css.includes(need), need);
});
test('layouts: auto-alternate mirrors the second of two photo sections in a row, and can be turned off', () => {
  const s = site(); s.sections.about = { heading: 'About', body: 'We fix pipes.', imageUrl: '/a.jpg' };
  s.sections.custom = { items: [{ after: 'about', layout: 'text-photo', heading: 'Ours', body: 'Words', images: ['/b.jpg'] }, { after: 'about', layout: 'text', heading: 'Plain', body: 'x', images: [] }, { after: 'about', layout: 'text-photo', heading: 'Again', body: 'y', images: ['/c.jpg'] }] };
  s.theme = { blueprint: 'generic', bpVariants: { about: 'split' } };
  let p = bp.plan(ctxOf(s, { isSafeUrl: () => true }));
  const flips = p.items.filter(i => ['about', 'custom'].includes(i.family)).map(i => [i.id, !!bp.wrap(i.opts).attrs.includes('data-sg-flip')]);
  assert.deepEqual(flips, [['about/split', false], ['custom/text-photo', true], ['custom/text', false], ['custom/text-photo', false]], 'a section with no side photo breaks the run');
  s.theme.bpSec = { about: { flip: true } };
  p = bp.plan(ctxOf(s, { isSafeUrl: () => true }));
  assert.equal(p.items.find(i => i.id === 'custom/text-photo').opts.autoFlip, undefined, 'about now sits on the left, so the next one keeps its own side');
  s.theme = { blueprint: 'generic', bpVariants: { about: 'split' }, bpAlt: 'off' };
  p = bp.plan(ctxOf(s, { isSafeUrl: () => true }));
  assert.ok(p.items.every(i => !i.opts.autoFlip));
});
test('layouts: new binders use only real content (gallery photos, the first trust number, a real review, the real address)', () => {
  const s = site(); s.sections.about = { heading: 'About', body: 'We fix pipes.', imageUrl: '/a.jpg' };
  let a = content.bind('about', ctxOf(s));
  assert.deepEqual(a.images, ['/a.jpg']); assert.equal(a.stat, null); assert.equal(a.quote, null);
  s.sections.gallery.images = ['/g1.jpg', '/a.jpg', '/g2.jpg']; s.sections.trust.stats = [{ value: '25', label: 'Years' }]; s.sections.testimonials.items = [{ quote: 'Great job', author: 'Ann' }];
  a = content.bind('about', ctxOf(s));
  assert.deepEqual(a.images, ['/a.jpg', '/g1.jpg', '/g2.jpg']); assert.equal(a.stat.value, '25'); assert.deepEqual(a.quote, { text: 'Great job', name: 'Ann' });
  s.sections.contact = { phone: '407-555-0100' };
  assert.equal(content.bind('contact', ctxOf(s)).mapSrc, '', 'no address, no map');
  s.sections.contact.address = '1 Main St';
  assert.match(content.bind('contact', ctxOf(s)).mapSrc, /^https:\/\/maps\.google\.com\/maps\?q=1%20Main%20St&output=embed$/);
  const x = content.bindCustom({ layout: 'collage', heading: 'H', body: 'B', images: ['/1.jpg'] }, ctxOf(s));
  assert.notEqual(x.layout, 'collage', 'a collage needs three photos, so it falls back');
  assert.equal(content.bindCustom({ layout: 'collage', heading: 'H', images: ['/1.jpg', '/2.jpg', '/3.jpg'] }, ctxOf(s)).layout, 'collage');
});

test('stats/objects: each number gets a moving object picked from its own label, drawn in brand colors', async () => {
  const { statKind } = require('../library/content');
  assert.deepEqual(['Years in business', 'Roofs replaced', 'Average Google rating', 'Towns we serve', 'Happy homeowners', 'Storm response'].map(statKind), ['clock', 'gear', 'stars', 'pin', 'house', 'pulse']);
  const html = await ejs.renderFile(path.join(__dirname, '../views/library/stats-objects.ejs'), { d: { items: [{ value: '15', label: 'Years', kind: 'clock' }, { value: '900', label: 'Roofs replaced', kind: 'gear' }] } });
  assert.match(html, /data-sg-section="stats\/objects"/);
  assert.match(html, /<svg class="sg-ob sg-ob-clock" viewBox="0 0 120 120" aria-hidden="true"/); assert.match(html, /sg-ob-gear/);
  assert.doesNotMatch(html, /#[0-9a-f]{3,6}\b/i, 'no fixed colors: the object follows the site\'s brand colors');
});

// ---- 2026-11-03: two more Why choose us layouts (Leo's pet links, our own drawing) ----
test('why layouts: panel over a photo and numbered cards under a photo render with sample content, almost nothing, and the reasons\' icons', async () => {
  const { SAMPLES } = require('../library/grapes');
  for (const id of ['why/panel', 'why/peek']) {
    const s = lib.BY_ID[id]; assert.ok(s, id); assert.equal(s.source, 'Original', id);
    const full = await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: { ...SAMPLES.why, image: '/uploads/pets.jpg' } });
    assert.match(full, new RegExp('data-sg-section="' + id + '"')); assert.doesNotMatch(full, /undefined|\[object/, id);
    assert.match(full, /src="\/uploads\/pets\.jpg"/, id);
    const bare = await ejs.renderFile(path.join(OUT, s.file + '.ejs'), { d: { heading: 'H', items: [{ title: 'T' }] } });
    assert.doesNotMatch(bare, /undefined|\[object|<img/, id + ' bare');
  }
  assert.ok(lib.BY_ID['why/panel'].flippable);
  const peek = await ejs.renderFile(path.join(OUT, 'why-peek.ejs'), { d: { heading: 'H', items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] } });
  assert.match(peek, />01</); assert.match(peek, />03</); assert.match(peek, /tw:lg:grid-cols-3/);
  const c = content.bind('why', { site: { sections: { whyChoose: { items: [{ title: 'Pet care', text: 'x', icon: 'leaf' }, { title: 'B', text: 'y' }] } } }, basePath: '' });
  assert.match(c.items[0].icon, /^<path d="M11 20A7/, 'the icon the owner picked'); assert.match(c.items[1].icon, /^<polyline points="20 6 9 17 4 12"/, 'a check mark by default');
  const panel = await ejs.renderFile(path.join(OUT, 'why-panel.ejs'), { d: c });
  assert.ok(panel.includes(c.items[0].icon), 'the panel draws the reason\'s icon');
});
