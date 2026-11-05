const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ejs = require('ejs');
const contrast = require('../contrast');
const scrim = require('../scrimhero');

const mix = (a, b, t) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * t)); };

test('scrim hero: white text stays readable over a white photo for every style color and strength', () => {
  for (const [p, a] of [['#0f766e', '#12354e'], ['#facc15', '#fde68a'], ['#ffffff', '#ffffff'], ['#7c3aed', '#0f172a'], ['#ef4444', '#fca5a5']]) {
    let last = 0;
    for (const st of ['light', 'medium', 'heavy']) {
      const c = scrim.colors({ primaryColor: p, accentColor: a }, st);
      const worst = mix('#ffffff', c.scrim, c.alpha);
      assert.ok(contrast.ratio('#ffffff', worst) >= 4.5, `${p}/${a} ${st}: ${contrast.ratio('#ffffff', worst)}`);
      assert.ok(contrast.ratio(c.grad1, worst) >= 4.5, 'headline gradient start reads');
      assert.ok(contrast.ratio(c.grad2, worst) >= 3, 'headline gradient end reads as large text');
      assert.ok(contrast.ratio('#ffffff', mix('#ffffff', c.scrim, c.floor)) >= 4.5, 'glass cards sit on at least the readable scrim');
      assert.ok(contrast.ratio(c.cta, c.ctaText) >= contrast.ratio(c.cta, c.ctaText === '#ffffff' ? '#111111' : '#ffffff'), 'button label is the better of light and dark');
      assert.ok(c.alpha >= last, 'stronger settings are never lighter'); last = c.alpha;
      assert.ok(contrast.luminance(c.scrim) <= 0.012, 'the scrim is a deep night color');
    }
  }
});

test('scrim hero: which hero shows, and the industries it suits by default', () => {
  assert.equal(scrim.resolve({ design: '' }, 'web design studio', 'generic'), 'classic', 'older sites keep their hero');
  assert.equal(scrim.resolve({ design: 'scrim' }, 'plumber', 'plumbing'), 'scrim');
  for (const [bt, id] of [['software company', 'generic'], ['music lessons', 'generic'], ['tutor', 'tutoring'], ['wedding photographer', 'photography'], ['event planner', 'generic'], ['computer repair', 'it-repair']]) assert.equal(scrim.resolve({ design: 'auto' }, bt, id), 'scrim', bt);
  for (const [bt, id] of [['plumber', 'plumbing'], ['dentist', 'dentist'], ['bakery', 'bakery']]) assert.equal(scrim.resolve({ design: 'auto' }, bt, id), 'classic', bt);
  assert.equal(scrim.resolve({ design: 'auto', videoUrl: '/v.mp4' }, 'software', 'generic'), 'classic', 'a video keeps the classic hero');
  assert.deepEqual(scrim.clean({ design: 'x', scrim: 'max', scrimLayout: 'tiny' }), { design: '', scrim: 'medium', scrimLayout: 'full' });
});

test('scrim hero template: photo or sky fallback, glass cards, stars only at Showcase, no script', async () => {
  const file = path.join(__dirname, '../views/library/hero-scrim.ejs');
  const vars = scrim.styleVars(scrim.colors({ primaryColor: '#0f766e', accentColor: '#12354e' }, 'medium'));
  const base = { headline: 'Learn to code <b>', headlineHtml: require('../library/content').hlHtml('Learn to code <b>'), sub: 'Small classes', ctaText: 'Book a class', ctaHref: '/contact', phone: '555', phoneHref: '555', trust: [], scrimVars: vars, scrimLayout: 'boxed', align: 'center', focal: '30% 40%' };
  let h = await ejs.renderFile(file, { d: { ...base, image: '/uploads/a.jpg', cards: [{ title: 'Small groups', text: 'Six per class' }, { title: 'Weekends' }, { title: 'Online too' }], tier: 'premium' } });
  assert.match(h, /data-sc-layout="boxed" data-sc-align="center" data-sc-tier="premium"/);
  assert.match(h, /--sc-rgb: \d+, \d+, \d+; --sc-a: 0\.\d+/);
  assert.match(h, /<img class="sg-scrim-bg[^"]*" src="\/uploads\/a\.jpg" alt="" fetchpriority="high" style="object-position: 30% 40%">/);
  assert.equal((h.match(/class="sg-glass/g) || []).length, 3); assert.match(h, /tw:lg:grid-cols-3/);
  assert.match(h, /Learn to code &lt;b&gt;/); assert.doesNotMatch(h, /data-sg-stars|<script/);
  h = await ejs.renderFile(file, { d: { ...base, image: '', cards: [], tier: 'showcase' } });
  assert.match(h, /sg-scrim-sky/); assert.match(h, /<canvas[^>]*data-sg-stars/); assert.doesNotMatch(h, /sg-glass/);
  const css = require('fs').readFileSync(path.join(__dirname, '../public/sg-library.css'), 'utf8');
  for (const need of ['.sg-scrim-shade', 'mask-image', 'background-clip', 'backdrop-filter', 'sg-sc-zoom', 'data-sc-tier']) assert.ok(css.includes(need), need);
  assert.match(css, /prefers-reduced-motion: ?no-preference\)\{[^@]*sg-sc-zoom/, 'the zoom only runs when motion is welcome');
});

test('showcase hero: gliding photos and proof bar come only from the site, and empty parts are left out', async () => {
  const { BINDERS } = require('../library/content');
  const site = (sections) => ({ site: { name: 'Acme Roofing', theme: { primaryColor: '#b91c1c', accentColor: '#1e293b' }, sections: { hero: { headline: 'Roofs' }, contact: {}, ...sections } }, services: [], basePath: '', navPages: [] });
  let d = BINDERS.hero(site({ hero: { headline: 'Roofs', imageUrl: '/a.jpg' }, about: { imageUrl: '/a.jpg' }, gallery: { images: ['/b.jpg'] } }));
  assert.deepEqual(d.glide, [], 'fewer than 3 different photos: no strip');
  assert.equal(d.proof, null, 'no numbers, badges or reviews: no proof bar');
  const ctx = site({ hero: { headline: 'Roofs', imageUrl: '/a.jpg' }, about: { imageUrl: '/c.jpg' }, gallery: { images: ['/a.jpg', '/d.jpg'] },
    trust: { badges: ['Licensed', ' ', 'Insured'] }, testimonials: { items: [{ quote: 'Great', author: 'Ann', rating: 5 }, { quote: 'Good', author: 'Bo', rating: 4 }, { quote: 'Fine', author: 'Cy', rating: 4 }, { author: 'No quote' }] } });
  ctx.services = [{ title: 'Roof repair', imageUrl: '/s.jpg' }];
  d = BINDERS.hero(ctx);
  assert.deepEqual(d.glide.map(g => [g.src, g.label]), [['/a.jpg', ''], ['/s.jpg', 'Roof repair'], ['/c.jpg', ''], ['/d.jpg', '']], 'each photo once, services keep their name');
  assert.deepEqual(d.proof.stat, { value: '4.3★', label: 'from 3 reviews', countAttrs: '' }, 'no trust number: the real average rating');
  assert.deepEqual(d.proof.marks.map(m => m.label), ['Licensed', 'Insured']);
  assert.deepEqual(d.proof.reviews.map(r => r.name), ['Ann', 'Bo', 'Cy']);
  ctx.site.sections.trust.stats = [{ value: '25', label: 'Years in business' }];
  ctx.site.sections.testimonials.items = ctx.site.sections.testimonials.items.slice(0, 1);
  assert.equal(BINDERS.hero(ctx).proof.stat.value, '25', 'a trust number wins');
  const html = await ejs.renderFile(path.join(__dirname, '../views/library/hero-showcase.ejs'), { d: { ...BINDERS.hero(ctx), scrimVars: '' } });
  assert.match(html, /data-sg-glide/); assert.match(html, /data-sg-glide-pause/); assert.match(html, /aria-pressed="false"/);
  assert.equal((html.match(/class="sg-sh-card/g) || []).length, 8, 'the photos twice, for a seamless loop');
  assert.equal((html.match(/<li class="sg-sh-card[^>]*aria-hidden="true"/g) || []).length, 4, 'the second copy is hidden from screen readers');
  assert.match(html, /Years in business/); assert.match(html, /Licensed/); assert.match(html, /Great/);
  assert.doesNotMatch(html, /555|lorem/i);
  assert.ok(scrim.DESIGNS.includes('showcase')); assert.equal(scrim.resolve({ design: 'showcase' }, 'plumber', 'plumbing'), 'showcase');
});

test('scroll-through hero: only the owner hero photos, each once, with dots; one photo makes a still hero', async () => {
  const { BINDERS } = require('../library/content');
  const site = (hero) => ({ site: { name: 'Acme Roofing', theme: { primaryColor: '#b91c1c', accentColor: '#1e293b' }, sections: { hero, contact: {}, gallery: { images: ['/g.jpg'] } } }, services: [], basePath: '', navPages: [] });
  const file = path.join(__dirname, '../views/library/hero-scroll.ejs');
  let d = BINDERS.hero(site({ headline: 'Roofs', imageUrl: '/a.jpg', slides: ['/b.jpg', '/a.jpg', '', '/c.jpg'] }));
  assert.deepEqual(d.scrub.map(p => p.src), ['/a.jpg', '/b.jpg', '/c.jpg'], 'hero photo first, each once, gallery left out');
  let html = await ejs.renderFile(file, { d: { ...d, scrimVars: '' } });
  assert.match(html, /data-sg-scrub[ >]/); assert.match(html, /--scrub-n: 3/);
  assert.equal((html.match(/data-sg-scrub-ph/g) || []).length, 3);
  assert.equal((html.match(/data-sg-scrub-dot/g) || []).length, 3); assert.match(html, /aria-label="Photo 1 of 3" aria-current="true"/);
  assert.equal((html.match(/--hero-photo: url/g) || []).length, 1, 'only the first photo loads up front');
  d = BINDERS.hero(site({ headline: 'Roofs', imageUrl: '/a.jpg' }));
  html = await ejs.renderFile(file, { d: { ...d, scrimVars: '' } });
  assert.doesNotMatch(html, /data-sg-scrub[ >]/); assert.doesNotMatch(html, /data-sg-scrub-dot/); assert.match(html, /\/a\.jpg/);
  html = await ejs.renderFile(file, { d: { ...BINDERS.hero(site({ headline: 'Roofs' })), scrimVars: '' } });
  assert.match(html, /sg-scrub-sky/, 'no photo: the night-sky gradient');
  assert.doesNotMatch(html, /555|lorem/i);
  assert.ok(scrim.DESIGNS.includes('scroll')); assert.equal(scrim.resolve({ design: 'scroll' }, 'plumber', 'plumbing'), 'scroll');
  assert.ok(scrim.DESIGNS.includes('blend')); assert.equal(scrim.resolve({ design: 'blend' }, 'plumber', 'plumbing'), 'blend');
});

test('word carousel collage hero: the service names and the site\'s own photos only; too few makes a plain hero', async () => {
  const { BINDERS } = require('../library/content');
  const svc = (n, photo) => Array.from({ length: n }, (_, i) => ({ title: 'Service ' + (i + 1), slug: 's' + i, imageUrl: photo && i !== 1 ? '/s' + i + '.jpg' : '' }));
  const ctx = (services, gallery) => ({ site: { name: 'Acme', theme: {}, sections: { hero: { headline: 'Roofs that [last]', imageUrl: '/h.jpg' }, contact: { phone: '407-555-0100' }, gallery: { images: gallery } } }, services, basePath: '/site/acme', navPages: [{ key: 'services', href: '/site/acme/services' }] });
  const file = path.join(__dirname, '../views/library/hero-collage.ejs');
  const d = BINDERS.hero(ctx(svc(4, true), ['/g1.jpg', '/g2.jpg']));
  assert.deepEqual(d.collage.words.map(w => w.t), ['Service 1', 'Service 2', 'Service 3', 'Service 4']);
  assert.equal(d.collage.words[0].src, '/s0.jpg'); assert.ok(d.collage.photos.includes(d.collage.words[1].src), 'a service with no photo borrows one of the site\'s');
  assert.equal(d.collage.words[2].href, '/site/acme/services/s2'); assert.equal(d.collage.tiles.length, 6);
  const html = await ejs.renderFile(file, { d });
  assert.match(html, /data-sg-collage/); assert.equal((html.match(/data-sg-cl-word/g) || []).length, 4);
  assert.match(html, /<em class="sg-hl">last<\/em>/); assert.match(html, /href="\/site\/acme\/services"/);
  assert.doesNotMatch(html, /<script/); assert.doesNotMatch(html, /class="[^"]*(?<![\w-])on(?![\w-])/, 'state classes are sg-on, so the build never prefixes them');
  const few = BINDERS.hero(ctx(svc(2, true), []));
  assert.equal(few.collage, null);
  const plain = await ejs.renderFile(file, { d: few });
  assert.doesNotMatch(plain, /data-sg-collage|data-sg-cl-word/); assert.match(plain, /Roofs that/);
  assert.ok(require('../library').SECTIONS.some(s => s.id === 'hero/collage'));
});

test('word carousel collage block: the owner\'s own lines and photos, else the service names; too few shows nothing', () => {
  const cb = require('../collageblock');
  assert.equal(cb.cleanBody('Roofs | /uploads/a.jpg\n\n  Gutters | javascript:alert(1)\nSiding | http://x.test/a.jpg\n' + 'x'.repeat(80)), 'Roofs | /uploads/a.jpg\nGutters\nSiding\n' + 'x'.repeat(60));
  const site = { name: 'Acme', sections: { hero: { imageUrl: '/uploads/h.jpg' }, about: { imageUrl: '/uploads/ab.jpg' }, gallery: { images: ['/uploads/g1.jpg', 'javascript:x'] }, services: { items: [] } } };
  const v = cb.view(site, { heading: 'Our [best] work', body: 'Roofs | /uploads/a.jpg\nGutters\nSiding', buttonText: 'Call', buttonUrl: '/contact' }, [], '/site/acme');
  assert.deepEqual(v.words.map(w => w.t), ['Roofs', 'Gutters', 'Siding']); assert.equal(v.words[0].src, '/uploads/a.jpg');
  assert.ok(v.words.every(w => v.photos.includes(w.src))); assert.ok(!v.photos.includes('javascript:x'));
  assert.match(v.headingHtml, /<em class="sg-hl">best<\/em>/); assert.deepEqual(v.button, { text: 'Call', url: '/contact' }); assert.equal(v.tiles.length, 6);
  const svc = [{ title: 'Repair', slug: 'repair', imageUrl: '/uploads/r.jpg' }, { title: 'Install', slug: 'install' }, { title: 'Inspect', slug: 'inspect' }];
  const w = cb.view(site, { heading: '' }, svc, '/site/acme').words;
  assert.deepEqual(w.map(x => x.href), ['/site/acme/services/repair', '/site/acme/services/install', '/site/acme/services/inspect']);
  assert.equal(cb.view(site, { body: 'One\nTwo' }, [], ''), null);
  assert.equal(cb.view({ sections: {} }, { body: 'One\nTwo\nThree' }, [], ''), null, 'no photos');
});

test('section height: Extra small is in the list and drops all space around the section', () => {
  const ht = require('../heightfx');
  assert.equal(ht.OPTIONS[1][0], 'xs'); assert.equal(ht.clean('xs'), 'xs');
  assert.deepEqual(ht.attrs('xs'), { cls: ' sg-ht sg-ht-xs', style: '--sg-ht: 0px;' });
  assert.match(ht.CSS, /\.sg-ht-xs :is\(/);
});
