const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const d = require('../designdata');
const { parseCsv, build } = require('../tools/import-design-data');

test('CSV parser handles quotes, doubled quotes, newlines in fields, BOM and blank lines', () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","he said ""hi"""\n2,"line1\nline2",z\n\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { a: '1', b: 'x, y', c: 'he said "hi"' });
  assert.equal(rows[1].b, 'line1\nline2');
});

test('the MIT licence and credit travel with the data', () => {
  const lic = fs.readFileSync(path.join(__dirname, '..', 'design-data', 'LICENSE-ui-ux-pro-max.txt'), 'utf8');
  assert.match(lic, /MIT License/); assert.match(lic, /Next Level Builder/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'design-data', 'README.md'), 'utf8'), /ui-ux-pro-max-skill/);
});

test('data contracts: counts, palettes and cross-references are intact', () => {
  const c = d.counts();
  assert.ok(c.productTypes >= 150 && c.styles >= 60 && c.typography >= 50 && c.landing >= 25 && c.guidelines >= 80, JSON.stringify(c));
  const ids = new Set();
  for (const p of d.DATA.productTypes) {
    assert.ok(!ids.has(p.id), 'unique id ' + p.id); ids.add(p.id);
    for (const k of ['primary', 'background', 'foreground', 'accent']) assert.match(p.palette[k], /^#[0-9a-f]{6}$/, `${p.name} ${k}`);
    assert.ok(p.antiPatterns.length, p.name + ' has an avoid list');
    const x = d.designFor(p);
    assert.ok(x.styles.length, p.name + ' resolves to real styles'); assert.ok(x.landing, p.name + ' resolves to a landing pattern');
  }
  for (const t of d.DATA.typography) { assert.ok(t.heading && t.body); if (t.googleUrl) assert.match(t.googleUrl, /^https:\/\/fonts\.googleapis\.com\//); }
  for (const g of d.DATA.guidelines) assert.match(g.platform, /^(All|Web)$/i);
});

test('search finds the right kind of business', () => {
  const top = (q) => d.searchProductTypes(q, 1)[0].name;
  assert.equal(top('law firm attorney'), 'Legal Services');
  assert.equal(top('salon spa'), 'Beauty/Spa/Wellness Service');
  assert.equal(top('bakery cafe'), 'Bakery/Cafe');
  assert.equal(top('plumber electrician'), 'Home Services (Plumber/Electrician)');
  assert.equal(top('dental clinic'), 'Dental Practice');
  assert.match(d.searchProductTypes('pet grooming', 2).map(x => x.name).join(), /Pet|Veterinary/);
  assert.deepEqual(d.searchProductTypes('zzzzqqq', 3), []);
  assert.deepEqual(d.searchProductTypes('', 3), []);
});

test('plural and singular match; style and font and guideline search work', () => {
  assert.equal(d.searchProductTypes('salons', 1)[0].name, d.searchProductTypes('salon', 1)[0].name);
  assert.ok(d.searchStyles('dark luxury elegant', 3).some(s => /dark/i.test(s.name)));
  assert.ok(d.searchTypography('elegant luxury serif', 3).length);
  assert.ok(d.searchGuidelines('contrast', 5).some(g => /contrast/i.test(g.issue)));
  assert.ok(d.searchGuidelines('contrast', 5, { severity: 'High' }).every(g => g.severity === 'High'));
});

test('designFor gives a palette, styles, fonts, landing pattern and an avoid list', () => {
  const x = d.designFor('Beauty/Spa/Wellness Service');
  assert.match(x.palette.primary, /^#[0-9a-f]{6}$/);
  assert.ok(x.styles.length >= 2); assert.ok(x.fonts.length >= 1); assert.ok(x.landing.name);
  assert.ok(x.antiPatterns.some(a => /neon|harsh/i.test(a)));
  assert.equal(d.designFor('not a real type'), null);
  assert.ok(d.getStyle('Minimal'), 'aliases resolve');
  const r = d.recommend('senior home care', 2); assert.equal(r[0].productType.name, 'Senior Care/Elderly');
});

test('importer rebuilds equivalent data from a small CSV set', () => {
  const os = require('os'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-'));
  const w = (f, t) => fs.writeFileSync(path.join(dir, f), t);
  w('products.csv', 'No,Product Type,Keywords,Primary Style Recommendation,Secondary Styles,Landing Page Pattern,Dashboard Style (if applicable),Color Palette Focus,Key Considerations\n1,Test Shop,"shop, retail",Flat Design,"Glassmorphism , Minimalism & Swiss Style",Hero + Features + CTA,,blue,keep simple\n');
  w('ui-reasoning.csv', 'No,UI_Category,Recommended_Pattern,Style_Priority,Color_Mood,Typography_Mood,Key_Effects,Decision_Rules,Anti_Patterns,Severity,Reasoning,Confidence\n1,Test Shop,Hero,Flat Design + Glassmorphism,blue,Clean,"Hover + Fade","{""must_have"":[""x""]}",Neon + Parallax,HIGH,,\n');
  w('colors.csv', 'No,Product Type,Primary,On Primary,Secondary,On Secondary,Accent,On Accent,Background,Foreground,Card,Card Foreground,Muted,Muted Foreground,Border,Destructive,On Destructive,Ring,Notes\n1,Test Shop,#2563EB,#FFFFFF,#3B82F6,#000000,#EA580C,#000000,#F8FAFC,#1E293B,#FFFFFF,#1E293B,#E9EFF8,#475569,#E2E8F0,#DC2626,#FFFFFF,#2563EB,note\n');
  for (const f of ['styles', 'typography', 'landing', 'ux-guidelines']) w(f + '.csv', 'a,b\n');
  const out = build(dir).productTypes[0];
  assert.equal(out.id, 'test-shop'); assert.deepEqual(out.secondaryStyles, ['Glassmorphism', 'Minimalism & Swiss Style']);
  assert.deepEqual(out.antiPatterns, ['Neon', 'Parallax']); assert.deepEqual(out.rules, { must_have: ['x'] }); assert.equal(out.palette.primary, '#2563eb');
});
