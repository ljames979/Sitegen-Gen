const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../modernize');

// A small old bakery site: the home page links to About, Services and Contact pages.
const HOME = `<!doctype html><html><head><title>Rosa's Bakery | Fresh bread in Tampa</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato&display=swap">
<link rel="stylesheet" href="/css/site.css">
<style>body{background:#fffaf2;font-family:'Lato',sans-serif} h1,h2{font-family:"Playfair Display",serif;color:#8a4b2a} .btn{background:#c2632f;color:#fff} .wp-block-button{background:#0073aa}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"Rosa's Bakery","telephone":"(813) 555-0142","address":{"@type":"PostalAddress","streetAddress":"12 Main St","addressLocality":"Tampa","addressRegion":"FL","postalCode":"33602"},"openingHoursSpecification":[{"dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"07:00","closes":"18:00"},{"dayOfWeek":"Saturday","opens":"08:00","closes":"14:00"}],"sameAs":["https://facebook.com/rosasbakery"]}</script>
</head><body><header><img src="/img/logo.png" class="logo" alt="Rosa logo"><nav><ul><li><a href="/">Home</a></li><li><a href="/about-us">About</a></li>
<li><a href="/services">Our Services</a><ul class="sub-menu"><li><a href="/cakes">Custom Cakes</a></li><li><a href="/bread">Sourdough Bread</a></li><li><a href="/catering">Catering</a></li></ul></li>
<li><a href="/contact">Contact</a></li></ul></nav></header>
<section class="hero"><h1>Bread worth waking up for</h1><p>Family owned since 1998, baking from scratch every morning in Tampa.</p></section>
<h2>Welcome</h2><p>Short.</p>
<img src="/img/cakes-1200x800.jpg" width="1200" height="800" alt="Wedding cake">
<img src="/img/cakes.jpg" width="1200">
<img src="/img/icon-star.png"><img src="/wp-content/uploads/2020/01/bbb-badge.jpg" width="200"><img src="/img/tiny.jpg" width="40">
<div class="testimonial"><p>"The best sourdough I've had outside of San Francisco, we come every Saturday."</p><span class="author">- Maria G.</span></div>
<footer>Mon-Fri 7am-6pm</footer></body></html>`;
const PAGES = {
  'https://rosas.example/': HOME,
  'https://rosas.example/about-us': '<html><body><main><p>Rosa started baking in her grandmother\'s kitchen in Ybor City and opened the shop in 1998 with one oven and a lot of flour.</p><p>Today her daughter runs the counter and everything is still made from scratch each morning, using our own sourdough starter.</p></main></body></html>',
  'https://rosas.example/services': '<html><body><h2>Custom Cakes</h2><p>Wedding and birthday cakes made to order.</p><h2>Contact us</h2></body></html>',
  'https://rosas.example/contact': '<html><body><p>Call (813) 555-0142</p><a href="mailto:hello@rosas.example">Email</a></body></html>'
};
const CSS = '.site-header{background-color:#c2632f} .hero{background-image:url("/img/hero-bread.jpg")} .btn-primary{background:#c2632f}';
const crawlIt = () => m.crawl('https://rosas.example/', {
  fetchPage: async (u) => { if (!PAGES[u]) throw new Error('404'); return { html: PAGES[u], finalUrl: u }; },
  fetchStyles: async (u) => (u === 'https://rosas.example/css/site.css' ? CSS : '')
});

test('crawl reads the inner pages and keeps the business\'s own details', async () => {
  const r = await crawlIt();
  assert.deepEqual(r.pages.map(p => p.kind), ['home', 'about', 'services', 'contact']);
  assert.equal(r.name, "Rosa's Bakery");
  assert.equal(r.h1, 'Bread worth waking up for');
  assert.match(r.tagline, /Family owned since 1998/);
  assert.equal(r.phone, '(813) 555-0142');
  assert.equal(r.email, 'hello@rosas.example');
  assert.equal(r.address, '12 Main St, Tampa, FL 33602');
  assert.deepEqual(r.services.map(s => s.title), ['Custom Cakes', 'Sourdough Bread', 'Catering'], 'the menu dropdown, not "Welcome" or "Contact us"');
  assert.equal(r.services[0].description, 'Wedding and birthday cakes made to order.');
  assert.match(r.story, /grandmother's kitchen in Ybor City/, 'the About page story');
  assert.equal(r.reviews.length, 1);
  assert.equal(r.reviews[0].author, 'Maria G.');
  assert.equal(r.hours[0].time, '7:00 AM – 6:00 PM');
  assert.equal(r.hours[6].time, 'Closed');
  assert.equal(r.social.facebook, 'https://facebook.com/rosasbakery');
  assert.deepEqual(r.badges, ['Family owned', 'Since 1998']);
  assert.equal(r.logo, 'https://rosas.example/img/logo.png');
});

test('crawl picks real photos and their brand colors and fonts', async () => {
  const r = await crawlIt();
  const urls = r.photos.map(p => p.url);
  assert.ok(urls.includes('https://rosas.example/img/cakes.jpg'), 'the original, not the resized copy');
  assert.ok(!urls.some(u => /1200x800/.test(u)), 'size variants merge');
  assert.ok(urls.includes('https://rosas.example/img/hero-bread.jpg'), 'a CSS hero background counts');
  assert.ok(!urls.some(u => /icon|badge|logo|tiny/.test(u)), 'icons, badges, the logo and tiny images are left out');
  assert.equal(r.brand.colors[0].hex, '#c2632f');
  assert.ok(!r.brand.colors.some(c => c.hex === '#0073aa'), 'WordPress default blue is not a brand color');
  assert.equal(r.brand.fonts.heading, 'Playfair Display');
  assert.equal(r.brand.fonts.body, 'Lato');
  assert.equal(r.brand.fonts.headingGoogle, true);
});

test('personality picks the look closest to the old site, with reasons and alternatives', async () => {
  const r = await crawlIt();
  const p = m.personality({ brand: r.brand, photos: r.photos.length, text: r.allText, industryStyle: 'warm' });
  assert.equal(p.id, 'warm');
  assert.ok(p.why.some(w => /warm orange/.test(w)));
  assert.equal(p.alternatives.length, 3);
  const dark = m.personality({ brand: { dark: true, colors: [{ hex: '#c9a24b' }], fonts: { heading: 'Cinzel' } }, photos: 2, text: '' });
  assert.equal(dark.id, 'noir');
  const bold = m.personality({ brand: { dark: false, colors: [{ hex: '#d11a1a' }], fonts: { heading: 'Oswald' } }, photos: 2, text: 'heavy duty power' });
  assert.equal(bold.id, 'bold');
});

test('opening hours from text; one stray day name is not a timetable', () => {
  const h = m.hoursFromText('Hours: Monday - Friday: 8:00 am - 5:00 pm Saturday 9 - 1 Sunday Closed');
  assert.equal(h[0].time, '8:00 AM – 5:00 PM');
  assert.equal(h[5].time, '9:00 AM – 1:00 PM');
  assert.equal(h[6].time, 'Closed');
  assert.deepEqual(m.hoursFromText('Open Monday 9am-5pm. Sunshine guaranteed.'), []);
  assert.deepEqual(m.hoursFromSchema({ openingHours: ['Mo-Fr 08:00-17:00'] })[4], { day: 'Friday', time: '8:00 AM – 5:00 PM' });
});

test('report lists what was found and what is still a placeholder', async () => {
  const r = await crawlIt();
  const rep = m.report(r, { colors: ['#c2632f'], fontsUsed: { heading: 'Playfair Display', body: 'Lato' } });
  assert.equal(rep.found.services, 3);
  assert.equal(rep.found.hours, true);
  assert.ok(rep.missing.some(x => /FAQ/.test(x)));
  assert.ok(!rep.missing.some(x => /hours/i.test(x)));
  const empty = m.report({ ...r, hours: [], reviews: [], photos: [], phone: '', logo: '' }, {});
  assert.ok(empty.missing.some(x => /Opening hours were not found/.test(x)));
  assert.ok(empty.missing.some(x => /none were made up/.test(x)));
});

test('colors: hex and rgb are read; see-through and gray ones are not brand colors', () => {
  assert.equal(m.hexOf('#abc'), '#aabbcc');
  assert.equal(m.hexOf('rgb(194, 99, 47)'), '#c2632f');
  assert.equal(m.hexOf('rgba(0,0,0,.2)'), null);
  assert.equal(m.isNeutral('#777777'), true);
  assert.equal(m.isNeutral('#c2632f'), false);
  assert.equal(m.fullSize('https://static.wixstatic.com/media/abc_123~mv2.jpg/v1/fill/w_300,h_200/abc.jpg'), 'https://static.wixstatic.com/media/abc_123~mv2.jpg');
});
