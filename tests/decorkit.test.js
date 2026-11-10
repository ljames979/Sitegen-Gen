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
