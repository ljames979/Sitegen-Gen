const test = require('node:test');
const assert = require('node:assert');
const decorKit = require('../decorkit');

const from = {
  theme: { mix: [
    { k: 'lib', f: 'hero', v: 'split' },
    { k: 'blk', f: 'own', v: 'baaaaaaa', scene: 'fence:glassblue:l' },
    { k: 'blk', f: 'own', v: 'bbbbbbbb' },
  ] },
  sections: {
    blocks: { items: [
      { id: 'baaaaaaa', type: 'photoBanner', heading: 'Royalty' },
      { id: 'bbbbbbbb', type: 'decocard', heading: 'Invite', body: 'style: deco\nicon: paw\neyebrow: Old words\nborder: #b8923a\nreveal: envelope\nlen: s' },
    ] },
    texts: { wmarks: [{ id: 'wabcdefg', page: 'home', part: 'b:baaaaaaa', el: '', kind: 'block', icon: 'dog', color: '#123456', op: 8, size: 400, pos: 'mr' }] },
  },
};
const to = {
  theme: { mix: [
    { k: 'lib', f: 'hero', v: 'split' },
    { k: 'blk', f: 'own', v: 'bccccccc' },
    { k: 'blk', f: 'own', v: 'bdddddd1' },
  ] },
  sections: { blocks: { items: [
    { id: 'bccccccc', type: 'photoBanner', heading: 'Welcome' },
    { id: 'bdddddd1', type: 'decocard', heading: 'Hello', body: 'style: royal\nicon: crown\neyebrow: Keep these words\ntext: And these' },
  ] } },
};

test('captures only looks and puts them on the matching sections of another site', () => {
  const kit = decorKit.capture(from);
  assert.ok(kit);
  assert.strictEqual(kit.scenes[0].at, 'blk:photoBanner#1');
  assert.strictEqual(kit.wmarks[0].at, 'blk:photoBanner#1');
  assert.ok(!/Old words/.test(kit.cards[0].look), 'no words in the kit');
  assert.match(decorKit.summary(kit), /1 scene decor, 1 watermark, 1 card look/);

  const r = decorKit.apply(to, kit);
  assert.strictEqual(r.report.added, 3);
  assert.strictEqual(r.report.skipped, 0);
  assert.strictEqual(r.theme.mix[1].scene, 'fence:glassblue:l');
  assert.strictEqual(r.sections.texts.wmarks[0].part, 'b:bccccccc');
  assert.strictEqual(r.sections.texts.wmarks[0].color, '#123456');
  const body = r.sections.blocks.items[1].body;
  assert.match(body, /style: deco/);
  assert.match(body, /reveal: envelope/);
  assert.match(body, /Keep these words/);
  assert.match(body, /And these/);
});

test('a site without the section skips that decoration', () => {
  const kit = decorKit.capture(from);
  const r = decorKit.apply({ theme: { mix: [{ k: 'lib', f: 'hero', v: 'split' }] }, sections: {} }, kit);
  assert.strictEqual(r.report.added, 0);
  assert.strictEqual(r.report.skipped, 3);
});

test('nothing to copy gives no kit, and junk is cleaned away', () => {
  assert.strictEqual(decorKit.capture({ theme: {}, sections: {} }), null);
  assert.strictEqual(decorKit.clean({ scenes: [{ at: '<script>', scene: 'fence:glassblue:l' }] }), null);
});

test('the generator decorates a pet business home page, and leaves others alone', () => {
  const autosite = require('../autosite');
  const mk = () => ({ name: 'Paws Spa', theme: { primaryColor: '#7a3e9d', accentColor: '#f2b705' }, sections: {
    hero: { headline: 'Grooming', ctaText: 'Book' }, about: { heading: 'About', text: 'We groom dogs and cats.' },
    services: { items: [{ title: 'Bath', description: 'A full bath' }, { title: 'Trim', description: 'A tidy trim' }] },
    testimonials: { items: [] }, faq: { items: [{ question: 'Do you take cats?', answer: 'Yes.' }] }, contact: { phone: '555' }, meta: { city: 'Austin' } } });
  const site = mk();
  const p = autosite.plan(site, { industryId: 'pet-grooming', label: 'Pet grooming', gallery: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', '/uploads/d.jpg'], colors: { primary: '#7a3e9d', accent: '#f2b705' } });
  assert.ok(p.mix && p.mix.length);
  assert.ok(p.decor.length >= 2, p.decor.join('; '));
  assert.ok(p.mix.some(m => m.scene === 'grass:garden:m'));
  assert.strictEqual(site.sections.texts.wmarks[0].color, '#7a3e9d');
  autosite.recolorDecor(site.sections, { primary: '#7a3e9d' }, { primary: '#112233' });
  assert.strictEqual(site.sections.texts.wmarks[0].color, '#112233');
  const other = mk();
  const q = autosite.plan(other, { industryId: 'plumbing', label: 'Plumbing', gallery: [], colors: { primary: '#7a3e9d', accent: '#f2b705' } });
  assert.deepStrictEqual(q.decor, []);
});

test('Quality flags hard-to-read card words and strong watermarks, and one click fixes them', async () => {
  const quality = require('../quality');
  const contrast = require('../contrast');
  const site = { theme: {}, sections: { blocks: { items: [{ id: 'bdeco001', type: 'decocard', heading: 'Invite', body: 'style: royal\nicon: crown\ntext: Hello\nheadc: #f4f4f4\ncard: #ffffff\nreveal: envelope\nlen: l' }] },
    texts: { wmarks: [{ id: 'wabcdefg', page: 'home', part: 'b:bdeco001', el: '', icon: 'dog', color: '#123456', op: 25 }] } } };
  const items = [], passed = [];
  quality.decorChecks(site, (i) => items.push(i), (t) => passed.push(t));
  const ids = items.map(i => i.id);
  assert.ok(ids.includes('deco-headc-bdeco001'), ids.join());
  assert.ok(ids.includes('deco-len-bdeco001'));
  assert.ok(ids.includes('wm-strong'));
  const sec = JSON.parse(JSON.stringify(site.sections));
  assert.ok(quality.applyDecorFix(sec) >= 3);
  const p = require('../decocard').parse(sec.blocks.items[0].body);
  assert.ok(contrast.ratio(p.headc, '#ffffff') >= 4.5);
  assert.strictEqual(p.len, 'm');
  assert.strictEqual(sec.texts.wmarks[0].op, 8);
  const after = [];
  quality.decorChecks({ theme: {}, sections: sec }, (i) => after.push(i), () => {});
  assert.deepStrictEqual(after.map(i => i.id), []);
});
