const test = require('node:test');
const assert = require('node:assert');
const kit = require('../sitekit');
const ab = require('../aboutblocks');
const catalog = require('../blockcatalog');

test('site kit: cleans everything it keeps', () => {
  const k = kit.clean({ langs: { on: 1, code: 'zz', words: [['  Order   now ', 'Ordenar ahora'], ['order now', 'dup'], ['', 'x'], 'bad'] }, button: { text: 'Order now', url: 'javascript:alert(1)' }, blockPages: ['services', 'home', 'faq', 'faq'], apps: { on: true, ios: 'http://x.com' }, tiktok: 'https://www.tiktok.com/@a', phoneMenu: 1 });
  assert.deepStrictEqual(k.langs.words, [['Order now', 'Ordenar ahora']]);
  assert.strictEqual(k.langs.code, 'es');
  assert.strictEqual(k.button.url, '');
  assert.deepStrictEqual(k.blockPages, ['services', 'faq']);
  assert.strictEqual(k.apps.ios, '');
  assert.strictEqual(k.tiktok, 'https://www.tiktok.com/@a');
  assert.strictEqual(k.phoneMenu, true);
  assert.strictEqual(kit.clean(null).langs.on, false);
});

test('site kit: a save without the box keeps what was there', () => {
  const cur = { kit: { button: { text: 'Go', url: '~/services' } } };
  assert.strictEqual(kit.parse({}, cur).button.url, '~/services');
  assert.strictEqual(kit.parse({ kit_json: '{"button":{"text":"A","url":"/x"}}' }, cur).button.text, 'A');
  assert.strictEqual(kit.parse({ kit_json: 'not json' }, cur).button.text, 'Go');
});

test('site kit: language data only when on, safe inside a script tag', () => {
  const site = { sections: { kit: { langs: { on: true, words: [['Hi', '</script>Hola'], ['Empty', '']] } } } };
  assert.deepStrictEqual(kit.langData(site).words, { Hi: '</script>Hola' });
  assert.ok(!kit.langJson(site).includes('</'));
  assert.strictEqual(kit.langData({ sections: {} }), null);
});

test('site kit: ~/ links follow the site address', () => {
  assert.strictEqual(kit.pageLinks('<a href="~/faq#a">', '/site/x'), '<a href="/site/x/faq#a">');
  assert.strictEqual(kit.pageLinks('<a href="~">', ''), '<a href="/">');
  assert.strictEqual(kit.pageLinks('<a href="~">', '/site/x'), '<a href="/site/x">');
});

test('app blocks: on the shared engine and in the picker', () => {
  ['apphero', 'spotcards', 'compare'].forEach(t => { assert.ok(ab.SPECS[t]); assert.ok(catalog.PICS[t]); assert.ok(catalog.LIST.some(l => l[0] === t)); });
  const p = ab.parse('apphero', 'second: List | ~/services\npic: off\ncolor: #d0402a');
  assert.deepStrictEqual(p.second[0], { words: 'List', link: '~/services' });
  assert.strictEqual(p.pic, false);
  const c = ab.parse('compare', 'cols: What | Them | Us\nrow: Fee | 15-30% | None');
  assert.deepStrictEqual(c.row[0], { what: 'Fee', them: '15-30%', us: 'None' });
});
