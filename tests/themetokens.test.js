const test = require('node:test');
const assert = require('node:assert');
const tk = require('../themetokens');
const brandKit = require('../brandkit');

test('the Imperial preset cleans to 16 named colors, three fonts and three buttons', () => {
  const t = tk.clean(tk.IMPERIAL);
  assert.strictEqual(t.colors.length, 16);
  assert.deepStrictEqual(t.colors[0], { key: 'blush', hex: '#fdeef4' });
  assert.strictEqual(t.fonts.display.family, 'Sansita Swashed');
  assert.strictEqual(t.fonts.accent.italic, true);
  assert.strictEqual(t.buttons.primary.bg, '#b8326a');
  assert.strictEqual(t.buttons.secondary.border, '#e8a9c3');
  assert.strictEqual(t.cards.glass.radius, 22);
});

test('bad input is dropped, not trusted', () => {
  assert.strictEqual(tk.clean(null), null);
  assert.strictEqual(tk.clean({ colors: [{ key: '<script>', hex: 'red' }] }), null);
  const t = tk.clean({ colors: [{ key: 'Blush Pink', hex: '#FDEEF4' }, { key: 'x', hex: 'nope' }], fonts: { body: { family: 'Nunito Sans;}', weights: 'bold' } }, cards: { glass: { fill: 'url(evil)', shadow: '} body{' } } });
  assert.deepStrictEqual(t.colors, [{ key: 'blush-pink', hex: '#fdeef4' }]);
  assert.strictEqual(t.fonts.body, null);
  assert.strictEqual(t.cards.glass.fill, '#ffffff');
  assert.strictEqual(t.cards.glass.shadow, 'none');
});

test('the page CSS carries the variables and keeps text readable on white', () => {
  const t = tk.clean({ ...tk.IMPERIAL, text: { ...tk.IMPERIAL.text, eyebrow: '#F2A9C6' } });
  const css = tk.css({ tokens: t });
  assert.match(css, /--tk-blush:#fdeef4/);
  assert.match(css, /--tk-font-display:'Sansita Swashed'/);
  assert.doesNotMatch(css, /--tk-eyebrow:#f2a9c6/);   // light pink was darkened for text
  assert.ok(tk.warnings(t).some(w => /Eyebrow labels/.test(w)));
  assert.strictEqual(tk.css({ tokens: { ...t, on: false } }), '');
  assert.ok(!/<\//.test(css));
});

test('Google Fonts params load the italic accent', () => {
  const p = tk.fontParams({ tokens: tk.clean(tk.IMPERIAL) });
  assert.ok(p.includes('family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700'));
});

test('linked brand fields and editor saves', () => {
  const theme = { tokens: tk.clean(tk.IMPERIAL) };
  assert.deepStrictEqual(tk.linked(theme), { primaryColor: '#b8326a', accentColor: '#4a2350', headingFont: 'Sansita Swashed', bodyFont: 'Nunito Sans', buttonShape: 'pill' });
  assert.deepStrictEqual(tk.parse({}, theme).tokens, theme.tokens);   // a save without the box keeps them
  assert.strictEqual(tk.parse({ theme_tokens_json: '' }, theme).tokens, null);
});

test('a brand kit carries the tokens to another site', () => {
  const kit = brandKit.cleanKit(brandKit.fromTheme({ primaryColor: '#b8326a', accentColor: '#4a2350', tokens: tk.clean(tk.IMPERIAL) }), () => true);
  assert.strictEqual(kit.tokens.colors.length, 16);
  const t = brandKit.applyKit({ primaryColor: '#000000' }, kit);
  assert.strictEqual(t.primaryColor, '#b8326a');
  assert.strictEqual(t.tokens.fonts.body.family, 'Nunito Sans');
});
