const test = require('node:test');
const assert = require('node:assert/strict');
const { designOptions, applyOption, vibeScores } = require('../design-options');
const themes = require('../themes');
const contrast = require('../contrast');

test('vibe words map to styles', () => {
  const s = vibeScores('We want it elegant, calm and lots of photos');
  assert.ok(s.luxe > 0 && s.coastal > 0 && s.gallery > 0);
  assert.deepEqual(vibeScores(''), {});
});

test('gives 3 distinct valid options, the client\'s own look first', () => {
  const r = designOptions({ bizType: 'plumber', mood: 'bold', brandColor: '#dc2626' });
  assert.equal(r.options.length, 3);
  assert.equal(r.options[0].style, 'bold'); assert.equal(r.options[0].source, 'client');
  assert.equal(new Set(r.options.map(o => o.style)).size, 3);
  r.options.forEach(o => { assert.ok(themes.ALL_STYLES.includes(o.style)); assert.equal(o.primaryColor, '#dc2626', 'brand colour kept'); });
});

test('vibe words steer the options and industry advice stays in the mix', () => {
  const r = designOptions({ bizType: 'hair salon', inspoLike: 'elegant and calm' });
  assert.equal(r.options[0].style, 'luxe');
  assert.ok(r.options.some(o => o.source === 'industry'));
  assert.equal(r.industry, 'Salon');
});

test('styles the data says to avoid are not suggested unless the client chose them', () => {
  const salon = designOptions({ bizType: 'hair salon', notes: 'dark moody edgy' });
  assert.ok(!salon.options.some(o => o.style === 'noir' || o.style === 'midnight'));
  const chosen = designOptions({ bizType: 'hair salon', mood: 'noir' });
  assert.equal(chosen.options[0].style, 'noir');
  assert.match(chosen.options[0].cautions, /client chose/);
});

test('suggested colours are never near-black or near-white on light styles', () => {
  for (const type of ['hair salon', 'dentist', 'bakery', 'roofer', 'lawyer']) {
    for (const o of designOptions({ bizType: type }).options) {
      if (!o.primaryColor || o.style === 'noir' || o.style === 'midnight') continue;
      const L = contrast.luminance(o.primaryColor);
      assert.ok(L > 0.04 && L < 0.6, `${type} ${o.style} ${o.primaryColor}`);
    }
  }
});

test('works with no answers at all and applyOption only touches design fields', () => {
  const r = designOptions({});
  assert.equal(r.options.length, 3);
  const theme = { style: 'modern', primaryColor: '#111111', accentColor: '#222222', headingFont: '', bodyFont: '', logoUrl: 'keep' };
  applyOption(theme, { style: 'warm', primaryColor: '', accentColor: '', headingFont: 'Lora', bodyFont: '' });
  assert.equal(theme.style, 'warm'); assert.equal(theme.primaryColor, '#111111'); assert.equal(theme.headingFont, 'Lora'); assert.equal(theme.logoUrl, 'keep');
  assert.doesNotThrow(() => applyOption(theme, undefined));
});
