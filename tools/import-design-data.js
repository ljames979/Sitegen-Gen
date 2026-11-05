#!/usr/bin/env node
// Converts the data tables of "UI UX Pro Max" (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill,
// MIT licence) into the JSON files in design-data/. Run it only when you want to refresh the data:
//   node tools/import-design-data.js path/to/ui-ux-pro-max-skill/src/ui-ux-pro-max/data
// The app itself never reads the CSV files or runs this script.

const fs = require('fs');
const path = require('path');

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, optional BOM.
function parseCsv(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(x => x.trim() !== '')).map(r => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}

const list = (s, sep = /[,;|]/) => String(s || '').split(sep).map(x => x.trim()).filter(Boolean);
// "A + B" and "A , B" both separate items; names such as "Minimalism & Swiss Style" stay whole
const plus = (s) => String(s || '').split(/\s*\+\s+|\s+\+\s*|\s*,\s*/).map(x => x.trim()).filter(Boolean);
const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');
const rules = (s) => { try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };

function build(dir) {
  const read = (f) => parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
  const products = read('products.csv'), reasoning = read('ui-reasoning.csv'), colors = read('colors.csv');
  const byName = (rows, key) => Object.fromEntries(rows.map(r => [r[key].toLowerCase(), r]));
  const rs = byName(reasoning, 'UI_Category'), cs = byName(colors, 'Product Type');

  const productTypes = products.map(p => {
    const r = rs[p['Product Type'].toLowerCase()] || {}, c = cs[p['Product Type'].toLowerCase()] || {};
    return {
      id: p['Product Type'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: p['Product Type'],
      keywords: list(p.Keywords),
      primaryStyle: p['Primary Style Recommendation'], secondaryStyles: plus(p['Secondary Styles']),
      landingPattern: p['Landing Page Pattern'], colorFocus: p['Color Palette Focus'], considerations: p['Key Considerations'],
      pattern: r.Recommended_Pattern || '', stylePriority: plus(r.Style_Priority), colorMood: r.Color_Mood || '', typographyMood: r.Typography_Mood || '',
      keyEffects: plus(r.Key_Effects), rules: rules(r.Decision_Rules), antiPatterns: plus(r.Anti_Patterns), severity: (r.Severity || '').toUpperCase(),
      palette: {
        primary: hex(c.Primary), onPrimary: hex(c['On Primary']), secondary: hex(c.Secondary), onSecondary: hex(c['On Secondary']),
        accent: hex(c.Accent), onAccent: hex(c['On Accent']), background: hex(c.Background), foreground: hex(c.Foreground),
        card: hex(c.Card), cardForeground: hex(c['Card Foreground']), muted: hex(c.Muted), mutedForeground: hex(c['Muted Foreground']),
        border: hex(c.Border), destructive: hex(c.Destructive), ring: hex(c.Ring)
      },
      paletteNote: c.Notes || ''
    };
  });

  const styles = read('styles.csv').map(s => ({
    id: s['Style ID'] || s['Style Category'].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: s['Style Category'], type: s.Type, keywords: list(s.Keywords), aliases: list(s.Aliases, /\|/),
    bestFor: s['Best For'], avoidFor: s['Do Not Use For'], effects: s['Effects & Animation'],
    light: s['Light Mode ✓'] || '', dark: s['Dark Mode ✓'] || '', // supported | conditional | not-recommended
    performance: s.Performance, accessibility: s.Accessibility, mobile: s['Mobile-Friendly'], conversion: s['Conversion-Focused'],
    aiKeywords: s['AI Prompt Keywords'], css: s['CSS/Technical Keywords'], status: s.Status || 'active', preferredMode: s['Preferred Mode'] || ''
  }));

  const typography = read('typography.csv').map(t => ({
    name: t['Font Pairing Name'], category: t.Category, heading: t['Heading Font'], body: t['Body Font'],
    mood: list(t['Mood/Style Keywords']), bestFor: t['Best For'], googleUrl: /^https:\/\/fonts\.googleapis\.com\//.test(t['Google Fonts URL']) ? t['Google Fonts URL'] : '', notes: t.Notes
  }));

  const landing = read('landing.csv').map(l => ({
    id: l['Pattern ID'] || l['Pattern Name'].toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: l['Pattern Name'], keywords: list(l.Keywords),
    sections: l['Section Order'], cta: l['Primary CTA Placement'], colorStrategy: l['Color Strategy'], effects: l['Recommended Effects'], conversion: l['Conversion Optimization']
  }));

  const guidelines = read('ux-guidelines.csv').filter(g => /^(All|Web)$/i.test(g.Platform)).map(g => ({
    category: g.Category, issue: g.Issue, platform: g.Platform, description: g.Description, do: g.Do, dont: g["Don't"], severity: g.Severity
  }));

  return { productTypes, styles, typography, landing, guidelines };
}

function main() {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(path.join(dir, 'products.csv'))) { console.error('Usage: node tools/import-design-data.js <path to ui-ux-pro-max/data>'); process.exit(1); }
  const out = path.join(__dirname, '..', 'design-data');
  fs.mkdirSync(out, { recursive: true });
  const d = build(dir);
  const files = { 'product-types.json': d.productTypes, 'styles.json': d.styles, 'typography.json': d.typography, 'landing.json': d.landing, 'guidelines.json': d.guidelines };
  for (const [f, v] of Object.entries(files)) { fs.writeFileSync(path.join(out, f), JSON.stringify(v)); console.log(f, v.length); }
}
if (require.main === module) main();
module.exports = { parseCsv, build };
