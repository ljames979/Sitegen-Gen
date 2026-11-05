const test = require('node:test'); const assert = require('node:assert/strict');
const lf = require('../lookfeel'); const contrast = require('../contrast'); const themes = require('../themes');
const bp = require('../library/blueprints'); const content = require('../library/content');

test('lookfeel: parse only keeps known values', () => {
  assert.deepEqual(lf.parse({ theme_pageTransition: 'spin', theme_grain: '1', theme_darkMode: 'night' }), { pageTransition: '', grain: true, glassNav: false, hideMenu: false, softShadows: false, cardStack: false, darkMode: '' });
  assert.equal(lf.parse({ theme_pageTransition: 'morph' }).pageTransition, 'morph');
  assert.equal(lf.bodyClasses({ grain: true, cardStack: true, pageTransition: 'fade' }), ' lf-grain lf-stack pt-fade');
  assert.equal(lf.bodyClasses({}), '');
});
test('lookfeel: the dark palette keeps text readable for any brand color', () => {
  for (const c of ['#f5b400', '#2563eb', '#111111', '#ffffff', '#16a34a', '#e11d48', '#7c3aed', 'nonsense']) {
    const v = lf.darkPalette(c, '#1e293b');
    assert.ok(v._ok, c);
    assert.ok(contrast.ratio(v['--ink'], v['--page-bg']) >= 7, c);
    assert.ok(contrast.ratio(v['--brand-text'], v['--page-bg']) >= 4.5, c + ' brand text on the page');
    assert.ok(contrast.luminance(v['--page-bg']) < 0.03, c + ' page is dark');
  }
});
test('lookfeel: styles that are already dark are skipped; stickers are trimmed, never invented', () => {
  assert.ok(lf.isDarkStyle('noir', themes.byId.noir)); assert.ok(lf.isDarkStyle('midnight', null));
  assert.ok(!lf.isDarkStyle('modern', null)); assert.ok(!lf.isDarkStyle('cafe', themes.byId.cafe));
  assert.deepEqual(lf.cleanStickers(['  Family   owned ', '', 'a'.repeat(40), 'Three', 'Four']), ['Family owned', 'a'.repeat(28), 'Three']);
  assert.deepEqual(lf.cleanStickers(undefined), []);
});
const site = () => ({ name: 'Test Co', theme: { blueprint: 'bento' }, layout: { hidden: [] }, sections: { hero: { headline: 'Hi', imageUrl: '/h.jpg' }, about: { body: '' }, services: { items: [] }, whyChoose: { items: [] }, testimonials: { items: [] }, faq: { items: [] }, gallery: { images: [] }, contact: {}, trust: { stats: [] }, booking: { services: [] }, meta: { city: 'Orlando, FL' } } });
const ctxOf = (s) => ({ site: s, basePath: '', services: (s.sections.services.items || []).map((x, i) => ({ ...x, slug: 's' + i })), areas: [], navPages: [], templateId: 'plumbing', visible: () => true });
test('bento: built only from real content, and skipped when there is too little', () => {
  const s = site();
  assert.equal(content.bind('bento', ctxOf(s)), null, 'a photo alone is not enough');
  s.sections.contact.phone = '407-555-0100';
  assert.equal(content.bind('bento', ctxOf(s)), null, 'a photo and a phone is not enough');
  s.sections.trust.stats = [{ value: '20', label: 'Years' }];
  const d = content.bind('bento', ctxOf(s));
  assert.equal(d.photos.length, 1); assert.equal(d.stats[0].value, '20'); assert.equal(d.review, null); assert.deepEqual(d.services, []); assert.equal(d.place, 'Orlando, FL');
  s.sections.hero.imageUrl = ''; assert.equal(content.bind('bento', ctxOf(s)), null, 'needs a photo');
  s.sections.hero.imageUrl = '/h.jpg';
  const p = bp.plan(ctxOf(s)); assert.equal(p.blueprint, 'bento'); assert.ok(p.items.some(i => i.id === 'bento/tiles'));
});

test('hide menu links: the option is read from the editor box', () => {
  assert.equal(lf.parse({ theme_hideMenu: '1' }).hideMenu, true);
  assert.equal(lf.parse({}).hideMenu, false);
});
