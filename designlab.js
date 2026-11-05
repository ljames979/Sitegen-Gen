// Design lab: roll a new mix of style, fonts, colors, button shape and section layouts, with locks.
// Pure functions; the lab page shows each roll as a preview (?lab=) and nothing is saved until "Keep this design".
const themes = require('./themes');
const fonts = require('./fonts');
const Palette = require('./public/palette');
const lib = require('./library');
const blueprints = require('./library/blueprints');

const DIMS = ['style', 'fonts', 'colors', 'shape', 'layouts'];

// Heading + body pairs, every font from the curated list in fonts.js. '' = the style's own fonts.
const PAIRS = [
  { heading: '', body: '', label: "The style's own fonts" },
  { heading: 'Playfair Display', body: 'Inter', label: 'Elegant serif + clean sans' },
  { heading: 'DM Serif Display', body: 'DM Sans', label: 'Modern serif' },
  { heading: 'Cormorant Garamond', body: 'Work Sans', label: 'Refined and airy' },
  { heading: 'Lora', body: 'Open Sans', label: 'Classic and friendly' },
  { heading: 'Merriweather', body: 'Nunito', label: 'Trusted and warm' },
  { heading: 'Montserrat', body: 'Open Sans', label: 'Clean corporate' },
  { heading: 'Poppins', body: 'Inter', label: 'Modern friendly' },
  { heading: 'Oswald', body: 'Open Sans', label: 'Strong trades' },
  { heading: 'Bebas Neue', body: 'Inter', label: 'Tall and bold' },
  { heading: 'Anton', body: 'Work Sans', label: 'Loud poster' },
  { heading: 'Archivo Black', body: 'DM Sans', label: 'Punchy' },
  { heading: 'Abril Fatface', body: 'Lora', label: 'Editorial magazine' },
  { heading: 'Bricolage Grotesque', body: 'Inter', label: 'Trendy grotesque' },
  { heading: 'Fraunces', body: 'Inter Tight', label: 'Soft modern serif' },
  { heading: 'Unbounded', body: 'DM Sans', label: 'Wide and techy' },
  { heading: 'Big Shoulders Display', body: 'Work Sans', label: 'Industrial' },
  { heading: 'Caveat', body: 'Nunito', label: 'Handmade' }
];

// One "feel" sets the button shape and the card corners together
const SHAPES = [
  { id: '', buttonShape: '', corners: '', label: "The style's own shapes" },
  { id: 'sharp', buttonShape: 'square', corners: 'sharp', label: 'Sharp: square buttons and corners' },
  { id: 'soft', buttonShape: 'rounded', corners: 'soft', label: 'Soft: gently rounded' },
  { id: 'round', buttonShape: 'pill', corners: 'round', label: 'Round: pill buttons, round cards' }
];

const HEX = /^#[0-9a-f]{6}$/i;
const styleLabel = (id) => { const t = themes.byId[id]; return t ? (t.no ? t.no + '. ' : '') + t.label.split(' (')[0] : id.charAt(0).toUpperCase() + id.slice(1); };
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
// a different item from the list when there is one
const pickNew = (list, same, rnd) => { const other = list.filter(x => !same(x)); return pick(other.length ? other : list, rnd); };

// ctx: { theme, advice (industryDesign or null), businessType, templateId }
function stylePool(ctx, wide) {
  const avoid = new Set(((ctx.advice && ctx.advice.avoidStyles) || []).map(a => a.id));
  const rec = (ctx.advice && ctx.advice.recommendedStyles) || [];
  const approved = themes.THEMES.filter(t => t.no).map(t => t.id);
  const ids = wide ? themes.ALL_STYLES : [...new Set([...rec, ...approved])];
  return ids.filter(id => themes.ALL_STYLES.includes(id) && !avoid.has(id));
}
function fontPool(ctx) {
  const fromData = ((ctx.advice && ctx.advice.fonts) || []).filter(p => fonts.cleanFontName(p.heading) && fonts.cleanFontName(p.body))
    .map(p => ({ heading: p.heading, body: p.body, label: (p.name || 'Industry pairing') + ' (suggested for this business)' }));
  return [...fromData, ...PAIRS];
}
// 'brand' keeps the client's own color family; 'any' also tries industry and style palettes
function colorPool(ctx, mode) {
  const th = ctx.theme || {};
  const base = HEX.test(th.primaryColor || '') ? th.primaryColor : '#2563eb';
  const out = Palette.suggestions(base).map(p => ({ primary: p.primary, accent: p.accent, label: p.name + ' (brand color)' }));
  if (mode === 'any') {
    Palette.industryFor(ctx.businessType).slice(0, 10).forEach(p => out.push({ primary: p.primary, accent: p.accent, label: p.name }));
    themes.THEMES.filter(t => t.palette).forEach(t => out.push({ primary: t.palette.primary, accent: t.palette.accent, label: styleLabel(t.id) + ' colors' }));
  }
  const seen = new Set();
  return out.filter(p => HEX.test(p.primary) && HEX.test(p.accent) && !Palette.check(p.primary, p.accent).some(i => i.level === 'bad'))
    .filter(p => { const k = (p.primary + p.accent).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function layoutFamilies(ctx) {
  return blueprints.sectionList(ctx.theme, ctx.templateId).sections.map(s => s.family).filter(f => lib.variantsOf(f).length > 1);
}

// The design as it is saved now, in the lab's terms
function current(theme) {
  const th = theme || {};
  const shape = SHAPES.find(s => s.buttonShape === (th.buttonShape || '') && s.corners === (th.corners || ''));
  return {
    style: th.style || 'modern', headingFont: th.headingFont || '', bodyFont: th.bodyFont || '',
    primaryColor: HEX.test(th.primaryColor || '') ? th.primaryColor : '#2563eb', accentColor: HEX.test(th.accentColor || '') ? th.accentColor : '#1e293b',
    shape: shape ? shape.id : '', buttonShape: th.buttonShape || '', corners: th.corners || '',
    bpVariants: th.homeLayout === 'blueprint' ? { ...(th.bpVariants || {}) } : null
  };
}

// opts: { locks: { style, fonts, colors, shape, layouts }, colors: 'brand'|'any', styles: 'rec'|'all' }
function roll(ctx, from, opts = {}, rnd = Math.random) {
  const locks = opts.locks || {};
  const cur = from ? clean(from) || current(ctx.theme) : current(ctx.theme);
  const out = { ...cur, bpVariants: cur.bpVariants ? { ...cur.bpVariants } : null };
  if (!locks.style) out.style = pickNew(stylePool(ctx, opts.styles === 'all'), id => id === cur.style, rnd);
  if (!locks.fonts) { const p = pickNew(fontPool(ctx), x => x.heading === cur.headingFont && x.body === cur.bodyFont, rnd); out.headingFont = p.heading; out.bodyFont = p.body; }
  if (!locks.colors) { const pool = colorPool(ctx, opts.colors === 'any' ? 'any' : 'brand'); if (pool.length) { const p = pickNew(pool, x => x.primary === cur.primaryColor && x.accent === cur.accentColor, rnd); out.primaryColor = p.primary; out.accentColor = p.accent; } }
  if (!locks.shape) { const s = pickNew(SHAPES, x => x.id === cur.shape, rnd); out.shape = s.id; out.buttonShape = s.buttonShape; out.corners = s.corners; }
  if (!locks.layouts) {
    const v = {};
    for (const f of layoutFamilies(ctx)) {
      // parallax scenes are a deliberate choice, so the lab leaves them out (same rule as Shuffle in the editor)
      const opts2 = lib.variantsOf(f).filter(x => !/^scene-/.test(x.variant));
      const now = (cur.bpVariants || {})[f];
      v[f] = pickNew(opts2, x => x.variant === now, rnd).variant;
    }
    out.bpVariants = v;
  }
  return out;
}

// Never trust a combo from the browser: every value is checked against the lists
function clean(c) {
  if (!c || typeof c !== 'object') return null;
  const shape = SHAPES.find(s => s.id === c.shape) || SHAPES[0];
  const font = (n) => (n ? fonts.cleanFontName(n) || '' : '');
  const out = {
    style: themes.ALL_STYLES.includes(c.style) ? c.style : 'modern',
    headingFont: font(c.headingFont), bodyFont: font(c.bodyFont),
    primaryColor: HEX.test(c.primaryColor || '') ? c.primaryColor.toLowerCase() : '#2563eb',
    accentColor: HEX.test(c.accentColor || '') ? c.accentColor.toLowerCase() : '#1e293b',
    shape: shape.id, buttonShape: shape.buttonShape, corners: shape.corners, bpVariants: null
  };
  if (c.bpVariants && typeof c.bpVariants === 'object') {
    const v = {};
    for (const [f, x] of Object.entries(c.bpVariants)) if (Object.prototype.hasOwnProperty.call(lib.FAMILIES, f) && lib.isVariant(f, x)) v[f] = x;
    out.bpVariants = v;
  }
  return out;
}
function parse(json) { try { return clean(JSON.parse(String(json || '').slice(0, 4000))); } catch { return null; } }

// The theme with the combo applied (a copy)
function apply(theme, combo) {
  const c = clean(combo); if (!c) return { ...theme };
  const t = { ...theme };
  if (c.style !== t.style) { t.bgColor = ''; t.pageStyles = {}; }
  Object.assign(t, { style: c.style, headingFont: c.headingFont, bodyFont: c.bodyFont, primaryColor: c.primaryColor, accentColor: c.accentColor, buttonShape: c.buttonShape, corners: c.corners });
  if (c.bpVariants) { t.homeLayout = 'blueprint'; t.homeFull = false; t.bpVariants = { ...(t.bpVariants || {}), ...c.bpVariants }; }
  return t;
}

// Words for the lab's cards
function describe(c, ctx) {
  const pair = fontPool(ctx || {}).find(p => p.heading === c.headingFont && p.body === c.bodyFont);
  const shape = SHAPES.find(s => s.id === c.shape) || SHAPES[0];
  return {
    style: styleLabel(c.style),
    fonts: c.headingFont || c.bodyFont ? `${c.headingFont || 'style font'} + ${c.bodyFont || 'style font'}${pair ? ' (' + pair.label + ')' : ''}` : PAIRS[0].label,
    colors: `${c.primaryColor} and ${c.accentColor}`,
    shape: shape.label,
    layouts: c.bpVariants ? Object.entries(c.bpVariants).map(([f, v]) => `${lib.FAMILIES[f]}: ${(lib.BY_ID[f + '/' + v] || {}).label || v}`).join(', ') : 'The home layout as saved'
  };
}

module.exports = { DIMS, PAIRS, SHAPES, roll, clean, parse, apply, current, describe, stylePool, fontPool, colorPool, styleLabel };
