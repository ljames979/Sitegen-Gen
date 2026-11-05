const test = require('node:test');
const assert = require('node:assert/strict');
const id = require('../industry-design');
const contrast = require('../contrast');
const dd = require('../designdata');
const themes = require('../themes');
const fonts = require('../fonts');
const { TEMPLATES } = require('../templates');

test('contrast helpers follow WCAG', () => {
  assert.equal(Math.round(contrast.ratio('#000000', '#ffffff')), 21);
  assert.ok(contrast.ratio('#777777', '#ffffff') < 4.5);
  const fixed = contrast.ensureContrast('#f97316', '#ffffff', 4.5);
  assert.ok(contrast.ratio(fixed, '#ffffff') >= 4.5);
  assert.equal(contrast.ensureContrast('#1e40af', '#ffffff'), '#1e40af', 'already fine: unchanged');
  assert.ok(contrast.ratio(contrast.ensureContrast('#334155', '#0a0806', 4.5), '#0a0806') >= 4.5, 'lightens on dark backgrounds');
  assert.equal(contrast.textOn('#f97316'), '#111111'); assert.equal(contrast.textOn('#1e3a8a'), '#ffffff');
  assert.equal(contrast.ratio('nope', '#fff'), null);
});

test('every industry template is mapped, and every mapping points at a real template and real data', () => {
  const ids = TEMPLATES.map(t => t.id);
  for (const t of ids) assert.ok(id.MAP[t], `industry "${t}" needs an entry in industry-design.js`);
  for (const k of Object.keys(id.MAP)) assert.ok(ids.includes(k), `mapping "${k}" has no template`);
  for (const [k, m] of Object.entries(id.MAP)) {
    assert.ok(dd.getProductType(m.type), `${k}: unknown type ${m.type}`);
    for (const a of m.also || []) assert.ok(dd.getProductType(a), `${k}: unknown also-type ${a}`);
    assert.ok(['direct', 'close', 'approximate'].includes(m.fit), k);
    for (const s of [...(m.prefer || []), ...(m.avoid || [])]) assert.ok(themes.ALL_STYLES.includes(s), `${k}: ${s} is not a SiteGen style`);
  }
  for (const [name, targets] of Object.entries(id.STYLE_MAP)) for (const s of targets) assert.ok(themes.ALL_STYLES.includes(s), `${name} -> ${s}`);
});

test('each industry gets usable styles, accessible palettes, real fonts and a landing pattern', () => {
  const all = id.allIndustryDesigns();
  assert.equal(all.length, TEMPLATES.length);
  for (const d of all) {
    assert.ok(d.recommendedStyles.length >= 2, d.templateId + ' has styles');
    for (const s of d.recommendedStyles) assert.ok(themes.ALL_STYLES.includes(s), s);
    const avoided = new Set(d.avoidStyles.map(a => a.id));
    for (const s of d.recommendedStyles) assert.ok(!avoided.has(s), `${d.templateId}: ${s} is both recommended and avoided`);
    assert.ok(d.palettes.length >= 2, d.templateId + ' has palette options');
    for (const p of d.palettes) { assert.match(p.primaryColor, /^#[0-9a-f]{6}$/); assert.match(p.accentColor, /^#[0-9a-f]{6}$/); assert.ok(contrast.ratio(p.primaryColor, '#ffffff') >= 4.5, `${d.templateId} ${p.from} primary contrast`); }
    assert.ok(d.fonts.length >= 1, d.templateId + ' has fonts');
    for (const f of d.fonts) { assert.ok(fonts.cleanFontName(f.heading) && fonts.cleanFontName(f.body)); assert.doesNotMatch(f.heading + f.body, /Noto Sans (KR|JP|SC|TC)|Arabic|Thai|Hebrew|Press Start/); }
    assert.ok(d.landing && d.landing.name, d.templateId + ' has a landing pattern');
    assert.ok(d.avoid.length, d.templateId + ' has an avoid list');
  }
});

test('specific industries get sensible advice', () => {
  const salon = id.industryDesign('salon');
  assert.equal(salon.recommendedStyles[0], 'japandi'); // the approved style from the style index leads
  assert.equal(salon.recommendedStyles[1], 'luxe');
  assert.ok(['midnight', 'noir'].every(s => salon.avoidStyles.some(a => a.id === s)), 'no dark looks for a salon');
  assert.equal(salon.motion, 'calm'); assert.ok(salon.avoidOptions.includes('heroFloat') && salon.avoidOptions.includes('heroCinematic'));
  const kids = id.industryDesign('daycare');
  assert.ok(kids.avoidStyles.some(a => a.id === 'noir'));
  assert.ok(id.industryDesign('tattoo').recommendedStyles.includes('noir'));
  assert.ok(id.industryDesign('car-detailing').recommendedStyles.includes('midnight'));
  assert.ok(!id.industryDesign('law').recommendedStyles.includes('poster'));
  assert.equal(id.industryDesign('nonexistent'), null);
});

test('avoid phrases turn into options and tips', () => {
  const r = id.analyseAvoid(['Dark mode', 'Harsh animations', 'Small text', 'No map']);
  assert.ok(r.avoidStyles.midnight && r.avoidStyles.noir); assert.equal(r.motion, 'calm');
  assert.ok(r.tips.some(t => /larger text/i.test(t))); assert.ok(r.tips.includes('No map'));
  assert.equal(id.analyseAvoid(['Poor imagery']).motion, 'normal');
});
