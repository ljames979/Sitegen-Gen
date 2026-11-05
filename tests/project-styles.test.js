const test = require('node:test');
const assert = require('node:assert/strict');
const themes = require('../themes');
const contrast = require('../contrast');
const quality = require('../quality');
const industry = require('../industry-design');
const { PROJECT_STYLES } = require('../project-styles');

const CREDIT = (name) => `<!-- Design system adapted from "${name}" by designmd.app, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->`;

test('project styles: all 12 approved styles are registered, numbered 1 to 12, with hints', () => {
  assert.equal(PROJECT_STYLES.length, 12);
  assert.deepEqual(PROJECT_STYLES.map(t => t.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const t of PROJECT_STYLES) {
    assert.ok(themes.ALL_STYLES.includes(t.id), t.id);
    assert.ok(themes.STYLE_HINTS[t.id], t.id + ' has a hint');
    assert.ok(themes.HOME_LAYOUTS.includes(t.home), t.id + ' home layout');
    assert.ok(t.heading && t.heading.css && t.body && t.body.css, t.id + ' fonts');
  }
  assert.equal(new Set(themes.ALL_STYLES).size, themes.ALL_STYLES.length, 'no duplicate style ids');
});

test('project styles: designmd.app styles carry the exact credit; the Devault style carries none', () => {
  const names = ['Café Artesanal Aconchegante', 'Terracota Mediterrâneo', 'Retro Barbershop Clássica', 'Minimalismo Sereno de Bem-Estar',
    'Luxury & Elegant', 'Japandi', 'Industrial Workbench Schematic', 'Flat Design Corporativo', 'Inclusive Design', 'Earthy & Organic', 'Bold & Energetic'];
  PROJECT_STYLES.slice(0, 11).forEach((t, i) => assert.equal(themes.creditComment(t), CREDIT(names[i])));
  assert.equal(themes.creditComment(themes.byId.popstudio), '');
  assert.equal(themes.creditComment(themes.byId.luxe), '', 'older SiteGen styles need no credit');
  assert.equal(themes.creditComment(undefined), '');
});

test('project styles: own colors give readable buttons, and text passes AA on page and cards', () => {
  for (const t of PROJECT_STYLES) {
    const p = quality.stylePalette({ style: t.id });
    const on = quality.onPrimary(t.palette.primary);
    assert.ok(contrast.ratio(t.palette.primary, on) >= 4.5, `${t.id}: button label ${contrast.ratio(t.palette.primary, on).toFixed(2)}`);
    assert.ok(contrast.ratio(p.ink, p.bg) >= 4.5 && contrast.ratio(p.ink, p.surface) >= 4.5, t.id + ' ink');
    assert.ok(contrast.ratio(p.muted, p.bg) >= 4.5 && contrast.ratio(p.muted, p.surface) >= 4.5, t.id + ' muted');
    if (!t.brandFillOnly) assert.ok(contrast.ratio(t.palette.primary, p.bg) >= 3, t.id + ' brand color against the page');
  }
});

test('project styles: colors in the extra rules come from tokens, not stray hex codes', () => {
  for (const t of PROJECT_STYLES) assert.doesNotMatch(t.css, /#[0-9a-f]{3,6}\b/i, t.id);
});

test('project styles: the quality check does not flag the yellow workbench brand used only for fills', async () => {
  const site = (style, primaryColor) => ({ name: 'x', theme: { style, primaryColor, accentColor: '#2B2B2B', font: 'Inter, system-ui, sans-serif' }, sections: {}, layout: {} });
  const r = await quality.audit(site('workbench', '#ffc107'));
  assert.ok(!r.items.some(i => i.id === 'contrast-brand' || i.id === 'contrast-button'), JSON.stringify(r.items.map(i => i.id)));
  const modern = await quality.audit(site('modern', '#ffc107'));
  assert.ok(modern.items.some(i => i.id === 'contrast-brand'), 'other styles still get the warning');
});

test('project styles: per-industry suggestions lead with the approved style', () => {
  assert.equal(industry.industryDesign('roofing').recommendedStyles[0], 'workbench');
  assert.equal(industry.industryDesign('bakery').recommendedStyles[0], 'cafe');
  assert.equal(industry.industryDesign('home-care').recommendedStyles[0], 'inclusive');
  assert.equal(industry.industryDesign('law').recommendedStyles[0], 'flatcorp');
  for (const [k, s] of Object.entries(industry.APPROVED)) {
    assert.ok(industry.MAP[k], k + ' is a SiteGen industry');
    assert.ok(themes.PROJECT_IDS.includes(s), s);
  }
});
