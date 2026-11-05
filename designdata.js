// Design intelligence for SiteGen: recommendations for style, colours, fonts and page layout by kind of
// business, plus UX rules. Data is from "UI UX Pro Max" (MIT licence, see design-data/README.md).
// Plain JSON files and a small BM25 text search; no Python and no network.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'design-data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const DATA = {
  productTypes: load('product-types.json'),
  styles: load('styles.json'),
  typography: load('typography.json'),
  landing: load('landing.json'),
  guidelines: load('guidelines.json')
};

// ---- text search (BM25) ----
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'our', 'you', 'your', 'from', 'have', 'has', 'not', 'but', 'all', 'any', 'can', 'use', 'its', 'into', 'out', 'who', 'what', 'how', 'why']);
function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  return w;
}
function tokenize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem);
}

class Index {
  // fields: [[getter, weight], ...]; a term in a heavier field counts that many times
  constructor(docs, fields) {
    this.docs = docs; this.k1 = 1.5; this.b = 0.75;
    this.tfs = docs.map(d => { const tf = new Map(); let len = 0; for (const [get, w] of fields) for (const t of tokenize(get(d))) { tf.set(t, (tf.get(t) || 0) + w); len += w; } tf.len = len; return tf; });
    this.avg = this.tfs.reduce((a, t) => a + t.len, 0) / (this.tfs.length || 1);
    this.df = new Map();
    for (const tf of this.tfs) for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }
  search(query, n = 5) {
    const q = [...new Set(tokenize(query))]; if (!q.length) return [];
    const N = this.docs.length, out = [];
    this.tfs.forEach((tf, i) => {
      let score = 0;
      for (const t of q) {
        const f = tf.get(t); if (!f) continue;
        const idf = Math.log(1 + (N - this.df.get(t) + 0.5) / (this.df.get(t) + 0.5));
        score += idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * tf.len / this.avg));
      }
      if (score > 0) out.push({ item: this.docs[i], score });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, n);
  }
}

const j = (a) => (Array.isArray(a) ? a.join(' ') : a);
const INDEX = {
  productTypes: new Index(DATA.productTypes, [[d => d.name, 4], [d => d.keywords, 3], [d => d.considerations, 1], [d => d.colorFocus, 1]]),
  styles: new Index(DATA.styles.filter(s => s.status !== 'deprecated'), [[d => d.name, 4], [d => d.keywords, 3], [d => d.aliases, 3], [d => d.bestFor, 2], [d => d.aiKeywords, 1]]),
  typography: new Index(DATA.typography, [[d => d.name, 3], [d => d.mood, 3], [d => d.bestFor, 2], [d => d.category, 1], [d => d.notes, 1]]),
  landing: new Index(DATA.landing, [[d => d.name, 4], [d => d.keywords, 3], [d => d.sections, 1], [d => d.conversion, 1]]),
  guidelines: new Index(DATA.guidelines, [[d => d.issue, 4], [d => d.category, 3], [d => d.description, 2], [d => d.do, 1]])
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const byName = (arr, key) => new Map(arr.map(x => [norm(x[key]), x]));
const STYLE_BY_NAME = new Map();
for (const s of DATA.styles) { STYLE_BY_NAME.set(norm(s.name), s); for (const a of s.aliases) if (!STYLE_BY_NAME.has(norm(a))) STYLE_BY_NAME.set(norm(a), s); }
const LANDING_BY_NAME = byName(DATA.landing, 'name');
const TYPE_BY_NAME = byName(DATA.productTypes, 'name');

const strip = (r) => r.map(x => x.item);
function searchProductTypes(q, n = 5) { return INDEX.productTypes.search(q, n).map(r => ({ ...r.item, score: +r.score.toFixed(3) })); }
function searchStyles(q, n = 5) { return strip(INDEX.styles.search(q, n)); }
function searchTypography(q, n = 5) { return strip(INDEX.typography.search(q, n)); }
function searchLanding(q, n = 5) { return strip(INDEX.landing.search(q, n)); }
function searchGuidelines(q, n = 5, { severity } = {}) {
  let r = strip(INDEX.guidelines.search(q, severity ? 200 : n));
  if (severity) r = r.filter(g => g.severity === severity).slice(0, n);
  return r;
}

function getProductType(nameOrId) {
  const k = norm(nameOrId);
  return TYPE_BY_NAME.get(k) || DATA.productTypes.find(p => p.id === String(nameOrId)) || null;
}
function getStyle(name) { return STYLE_BY_NAME.get(norm(name)) || null; }
function getLanding(name) { return LANDING_BY_NAME.get(norm(name)) || null; }

// Everything the app needs to design for a kind of business, resolved into real records.
function designFor(productType) {
  const p = typeof productType === 'string' ? getProductType(productType) : productType;
  if (!p) return null;
  const styleNames = [p.primaryStyle, ...p.stylePriority, ...p.secondaryStyles].flatMap(x => String(x).split(/\s+\+\s+/));
  const seen = new Set(), styles = [];
  for (const n of styleNames) { const s = getStyle(n); if (s && !seen.has(s.id)) { seen.add(s.id); styles.push(s); } }
  const fonts = searchTypography(`${p.typographyMood} ${p.keywords.slice(0, 4).join(' ')}`, 3);
  const landing = getLanding(p.landingPattern) || getLanding(p.pattern) || searchLanding(p.landingPattern, 1)[0] || null;
  return { productType: p, palette: p.palette, paletteNote: p.paletteNote, styles, fonts, landing, effects: p.keyEffects, antiPatterns: p.antiPatterns, rules: p.rules, severity: p.severity };
}

// Free text in, best-matching business type (and its design) out.
function recommend(query, n = 3) {
  return searchProductTypes(query, n).map(p => ({ score: p.score, ...designFor(p) }));
}

module.exports = {
  DATA, tokenize, searchProductTypes, searchStyles, searchTypography, searchLanding, searchGuidelines,
  getProductType, getStyle, getLanding, designFor, recommend,
  counts: () => Object.fromEntries(Object.entries(DATA).map(([k, v]) => [k, v.length]))
};
