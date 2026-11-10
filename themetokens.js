// Theme tokens (Leo, 2026-11-10): a site's own named palette, three fonts (display, accent serif, body), text color
// rules (headings, body, eyebrow labels) and three button styles (primary, secondary, on dark or brand backgrounds),
// saved on the site as theme.tokens. The public page gets them as CSS variables (--tk-<name>, --tk-font-display ...)
// and they drive the style's own variables too (--primary, --ink, --heading-font ...), so every block follows them.
// The brand fields older code reads (primaryColor, accentColor, headingFont, bodyFont, buttonShape) are kept in step
// by linked(). Text colors are moved just far enough to stay readable (4.5:1) on white, so a pale pink, pale blue or
// gold never ends up as text on a white page. A saved Brand kit carries the tokens, so they are reusable on any site.
const contrast = require('./contrast');
const fonts = require('./fonts');

const HEX = /^#[0-9a-fA-F]{6}$/;
const KEY = /^[a-z][a-z0-9-]{0,23}$/;
const MAX_COLORS = 32;
const hex = (v, d = '') => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : d);
const num = (v, lo, hi, d) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : d; };
const WEIGHTS = /^[1-9]00(;[1-9]00){0,8}$/;
const SHAPES = ['pill', 'rounded', 'square'];
const BUTTONS = [
  { key: 'primary', label: 'Primary button' },
  { key: 'secondary', label: 'Secondary button' },
  { key: 'onDark', label: 'Button on dark or pink backgrounds' }
];
const FONT_ROLES = [
  { key: 'display', label: 'Display font', note: 'logo, hero headline and section headings only' },
  { key: 'accent', label: 'Accent serif', note: 'quotes and taglines (italic)' },
  { key: 'body', label: 'Body / UI font', note: 'menu, paragraphs, buttons, labels' }
];
const TEXT_ROLES = [
  { key: 'heading', label: 'Headings' },
  { key: 'body', label: 'Body text' },
  { key: 'eyebrow', label: 'Eyebrow labels' },
  { key: 'eyebrowOnBlue', label: 'Eyebrow labels on blue (tinted) sections' }
];

// Leo's Imperial Pet Group theme (2026-11-10)
const IMPERIAL = {
  on: true,
  name: 'Imperial Pet Group',
  colors: [
    ['blush', '#FDEEF4'], ['pink-medium', '#F2A9C6'], ['pink-frame', '#D9578F'], ['pink-primary', '#B8326A'], ['pink-hover', '#A8285E'], ['pink-dark-label', '#8E2350'],
    ['glass-blue', '#D6EBF8'], ['glass-blue-light', '#EAF5FC'], ['glass-blue-deep', '#A9D0EA'], ['blue-text', '#2E5B7A'],
    ['plum', '#4A2350'], ['heading', '#3D1F45'], ['body', '#4A3F50'], ['footer-bg', '#2A1B30'], ['gold', '#B8923A'], ['white', '#FFFFFF']
  ].map(([key, h]) => ({ key, hex: h })),
  fonts: {
    display: { family: 'Sansita Swashed', weights: '800', italic: false },
    accent: { family: 'Playfair Display', weights: '600;700', italic: true },
    body: { family: 'Nunito Sans', weights: '400;600;700', italic: false }
  },
  text: { heading: '#3D1F45', body: '#4A3F50', eyebrow: '#A8285E', eyebrowOnBlue: '#8E2350', eyebrowSize: 14, eyebrowSpacing: 0.16, surface: '#D6EBF8', brandColor: 'plum' },
  buttons: {
    primary: { bg: '#B8326A', text: '#FFFFFF', border: '', borderW: 0, hover: '#A8285E', padY: 15, padX: 28, lift: 2, weight: 700, shape: 'pill' },
    secondary: { bg: '#FFFFFF', text: '#A8285E', border: '#E8A9C3', borderW: 1.5, hover: '', padY: 15, padX: 28, lift: 2, weight: 700, shape: 'pill' },
    onDark: { bg: '#FFFFFF', text: '#A8285E', border: '', borderW: 0, hover: '', padY: 15, padX: 28, lift: 2, weight: 700, shape: 'pill' }
  },
  cards: {
    glass: { fill: 'rgba(214,235,248,0.45)', border: 'rgba(160,205,235,0.7)', radius: 22, shadow: 'none' },
    square: { fill: '#FFFFFF', border: '', radius: 0, shadow: '0 24px 56px rgba(74,35,80,0.18)' },
    rounded: { fill: '#FFFFFF', border: '', radius: 26, shadow: '0 14px 36px rgba(74,35,80,0.10)' }
  },
  layout: { maxWidth: 1260, sidePad: 24, sectionPad: 104 }
};
// the three card looks and the cards that use each one on the page
const CARDS = [
  { key: 'glass', label: 'Glass Blue Card', sel: '.feat-card,.step-card,.sg-rc-item,.tk-card-glass' },
  { key: 'square', label: 'White Card Square', sel: '.sg-oc-card,.sg-rc-card,.tk-card-square' },
  { key: 'rounded', label: 'White Card Rounded', sel: '.price-card,.team-card,.acc-item,.tk-card-rounded' }
];
const CSSCOLOR = /^(#[0-9a-fA-F]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d{1,3}))?\s*\))$/;
const SHADOW = /^(none|(-?\d{1,3}(px)?\s+){2,3}-?\d{1,3}(px)?\s+rgba?\([\d\s.,]+\))$/;
function cleanCard(c) {
  const o = c && typeof c === 'object' ? c : {};
  const col = (v) => (CSSCOLOR.test(String(v || '').trim()) ? String(v).trim() : '');
  return { fill: col(o.fill) || '#ffffff', border: col(o.border), radius: num(o.radius, 0, 60, 16), shadow: SHADOW.test(String(o.shadow || '').trim()) ? String(o.shadow).trim() : 'none' };
}
const PRESETS = [{ key: 'imperial', name: 'Imperial Pet Group (blush, pink and glass blue)', tokens: IMPERIAL }];

function cleanFont(f) {
  const o = f && typeof f === 'object' ? f : {};
  const family = fonts.cleanFontName(o.family);
  if (!family) return null;
  const w = String(o.weights || '').replace(/\s+/g, '');
  return { family, weights: WEIGHTS.test(w) ? w : '400;700', italic: !!o.italic };
}
function cleanButton(b, d) {
  const o = b && typeof b === 'object' ? b : {};
  return {
    bg: hex(o.bg, d.bg), text: hex(o.text, d.text), border: hex(o.border), borderW: num(o.borderW, 0, 6, 0), hover: hex(o.hover),
    padY: num(o.padY, 4, 40, 15), padX: num(o.padX, 8, 80, 28), lift: num(o.lift, 0, 10, 2), weight: [400, 500, 600, 700, 800].includes(+o.weight) ? +o.weight : 700,
    shape: SHAPES.includes(o.shape) ? o.shape : 'pill'
  };
}

// anything -> a safe tokens object, or null when there is nothing usable
function clean(t) {
  if (!t || typeof t !== 'object') return null;
  const seen = new Set();
  const colors = (Array.isArray(t.colors) ? t.colors : []).map(c => ({ key: String((c && c.key) || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24), hex: hex(c && c.hex) }))
    .filter(c => KEY.test(c.key) && c.hex && !seen.has(c.key) && seen.add(c.key)).slice(0, MAX_COLORS);
  const f = t.fonts && typeof t.fonts === 'object' ? t.fonts : {};
  const x = t.text && typeof t.text === 'object' ? t.text : {};
  const b = t.buttons && typeof t.buttons === 'object' ? t.buttons : {};
  const out = {
    on: t.on !== false,
    name: String(t.name || '').replace(/[<>]/g, '').trim().slice(0, 60),
    colors,
    fonts: { display: cleanFont(f.display), accent: cleanFont(f.accent), body: cleanFont(f.body) },
    text: {
      heading: hex(x.heading), body: hex(x.body), eyebrow: hex(x.eyebrow), eyebrowOnBlue: hex(x.eyebrowOnBlue),
      eyebrowSize: num(x.eyebrowSize, 10, 22, 14), eyebrowSpacing: num(x.eyebrowSpacing, 0, 0.4, 0.16), surface: hex(x.surface),
      brandColor: colors.some(c => c.key === x.brandColor) ? x.brandColor : ''
    },
    buttons: {
      primary: cleanButton(b.primary, { bg: '#2563eb', text: '#ffffff' }),
      secondary: cleanButton(b.secondary, { bg: '#ffffff', text: '#2563eb' }),
      onDark: cleanButton(b.onDark, { bg: '#ffffff', text: '#2563eb' })
    }
  };
  const cd = t.cards && typeof t.cards === 'object' ? t.cards : null;
  out.cards = cd ? Object.fromEntries(CARDS.map(k => [k.key, cleanCard(cd[k.key])])) : null;
  const ly = t.layout && typeof t.layout === 'object' ? t.layout : null;
  out.layout = ly ? { maxWidth: num(ly.maxWidth, 900, 1600, 1260), sidePad: num(ly.sidePad, 12, 64, 24), sectionPad: num(ly.sectionPad, 40, 200, 104) } : null;
  if (!out.colors.length && !out.fonts.display && !out.fonts.body && !out.text.heading) return null;
  return out;
}
const fromBody = (s) => { try { return clean(JSON.parse(String(s || ''))); } catch { return null; } };
const active = (theme) => { const t = theme && theme.tokens; return t && t.on !== false ? t : null; };

// the text colors as they are drawn: readable on white (4.5:1), whatever was typed
function readable(t) {
  const fit = (c, d) => (c ? contrast.ensureContrast(c, '#ffffff', contrast.AA_TEXT).toLowerCase() : d);
  return { heading: fit(t.text.heading, ''), body: fit(t.text.body, ''), eyebrow: fit(t.text.eyebrow, ''), eyebrowOnBlue: t.text.eyebrowOnBlue && t.text.surface ? contrast.ensureContrast(t.text.eyebrowOnBlue, t.text.surface, contrast.AA_TEXT).toLowerCase() : fit(t.text.eyebrowOnBlue, '') };
}
// warnings for the editor: text colors that had to be darkened, buttons whose text is hard to read
function warnings(tok) {
  const t = clean(tok); if (!t) return [];
  const out = [];
  TEXT_ROLES.forEach(r => { const c = t.text[r.key]; const on = r.key === 'eyebrowOnBlue' && t.text.surface ? t.text.surface : '#ffffff'; if (c && contrast.ratio(c, on) < contrast.AA_TEXT) out.push(`${r.label}: ${c.toUpperCase()} is too light to read on ${on === '#ffffff' ? 'white' : on.toUpperCase()}; the page darkens it just enough.`); });
  BUTTONS.forEach(bt => { const b = t.buttons[bt.key]; if (contrast.ratio(b.text, b.bg) < contrast.AA_TEXT) out.push(`${bt.label}: the text ${b.text.toUpperCase()} on ${b.bg.toUpperCase()} is hard to read.`); });
  return out;
}

// Google Fonts entries for the three fonts (family=... parts for the CSS2 url)
function fontParams(theme) {
  const t = active(theme); if (!t) return [];
  const out = [];
  FONT_ROLES.forEach(r => {
    const f = t.fonts[r.key]; if (!f) return;
    const enc = encodeURIComponent(f.family).replace(/%20/g, '+');
    const ws = f.weights.split(';');
    const p = f.italic ? `family=${enc}:ital,wght@${ws.map(w => '0,' + w).concat(ws.map(w => '1,' + w)).join(';')}` : `family=${enc}:wght@${ws.join(';')}`;
    if (!out.includes(p)) out.push(p);
  });
  return out;
}
const fam = (f, fallback) => (f ? `'${f.family}', ${fallback}` : '');
const radius = (s) => (s === 'square' ? '0' : s === 'rounded' ? '10px' : '999px');

function btnCss(sel, b, hoverSel) {
  const border = b.border && b.borderW ? `${b.borderW}px solid ${b.border}` : '0';
  return `${sel}{background:${b.bg};color:${b.text};border:${border};padding:${b.padY}px ${b.padX}px;border-radius:${radius(b.shape)};font-family:var(--tk-font-body,inherit);font-weight:${b.weight};transition:transform .18s ease,box-shadow .18s ease,background .18s ease}`
    + `${hoverSel}{${b.hover ? `background:${b.hover};` : ''}transform:translateY(-${b.lift}px)}`;
}

// The page's <style> for the tokens ('' when the site has none)
function css(theme) {
  const t = active(theme); if (!t) return '';
  const r = readable(t), f = t.fonts, p = t.buttons.primary;
  const v = [];
  t.colors.forEach(c => v.push(`--tk-${c.key}:${c.hex}`));
  if (f.display) v.push(`--tk-font-display:${fam(f.display, 'Georgia, serif')}`, `--heading-font:${fam(f.display, 'Georgia, serif')}`);
  if (f.accent) v.push(`--tk-font-accent:${fam(f.accent, 'Georgia, serif')}`);
  if (f.body) v.push(`--tk-font-body:${fam(f.body, 'system-ui, sans-serif')}`, `--body-font:${fam(f.body, 'system-ui, sans-serif')}`);
  if (r.heading) v.push(`--tk-heading:${r.heading}`, `--ink:${r.heading}`);
  if (r.body) v.push(`--tk-body:${r.body}`, `--muted:${r.body}`);
  if (r.eyebrow) v.push(`--tk-eyebrow:${r.eyebrow}`, `--brand-text:${r.eyebrow}`);
  if (r.eyebrowOnBlue) v.push(`--tk-eyebrow-blue:${r.eyebrowOnBlue}`);
  if (t.text.surface) v.push(`--surface:${t.text.surface}`);
  v.push(`--primary:${p.bg}`, `--on-primary:${p.text}`, `--primary-ink:${contrast.ratio(p.bg, '#ffffff') >= 4.5 ? p.bg : (r.eyebrow || '#111111')}`, `--btn-r:${radius(p.shape)}`);
  let s = `html:root body{${v.join(';')}}`;
  if (f.body) s += `html:root body{font-family:var(--tk-font-body)}`;
  if (f.display) {
    const dw = f.display.weights.split(';').pop();
    s += `html:root body :is(h1,h2,nav.site-nav .brand,.footer-grid .brand,.hero h1){font-family:var(--tk-font-display);font-weight:${dw}}`;
    s += `html:root body :is(h3,h4,h5,h6){font-family:var(--tk-font-body,inherit)}`;
  }
  if (f.accent) s += `html:root body :is(blockquote,q,.tk-accent,.tagline,.hero-tagline){font-family:var(--tk-font-accent);font-style:${f.accent.italic ? 'italic' : 'normal'}}`;
  s += `html:root body :is(.eyebrow,.tk-eyebrow){font-family:var(--tk-font-body,inherit);font-size:${t.text.eyebrowSize}px;font-weight:700;letter-spacing:${t.text.eyebrowSpacing}em;text-transform:uppercase${r.eyebrow ? ';color:' + r.eyebrow : ''}}`;
  if (r.eyebrowOnBlue) s += `html:root body :is(.tint,.blk-bg-tint,.tk-on-blue) :is(.eyebrow,.tk-eyebrow){color:${r.eyebrowOnBlue}}`;
  s += btnCss('html:root body :is(.btn,.tk-btn-primary)', p, 'html:root body :is(.btn,.tk-btn-primary):hover');
  s += btnCss('html:root body :is(.btn-outline,.tk-btn-secondary)', t.buttons.secondary, 'html:root body :is(.btn-outline,.tk-btn-secondary):hover');
  s += btnCss('html:root body :is(.blk-bg-brand,.blk-bg-dark,.cta-band,.tk-on-dark) .btn,html:root body .tk-btn-light', t.buttons.onDark, 'html:root body :is(.blk-bg-brand,.blk-bg-dark,.cta-band,.tk-on-dark) .btn:hover,html:root body .tk-btn-light:hover');
  // never light pink, light blue or gold words on the white page: the few spots that print the brand color as text
  s += `html:root body .blk-bg-brand{background:${p.bg};color:${p.text}}`;
  if (t.text.surface) s += `html:root body .blk-bg-tint{background:${t.text.surface}}`;
  s += `html:root body .section-head .rule{background:${p.bg}}`;
  if (t.cards) CARDS.forEach(k => {
    const c = t.cards[k.key];
    s += `html:root body :is(${k.sel}){background:${c.fill};border:${c.border ? '1px solid ' + c.border : '0'};border-radius:${c.radius}px;box-shadow:${c.shadow}}`;
  });
  if (t.layout) {
    const L = t.layout;
    s += `html:root body{--tk-maxw:${L.maxWidth}px;--tk-side:${L.sidePad}px;--tk-pad:${L.sectionPad}px}`;
    s += `html:root body section.blk>.blk-inner{max-width:${L.maxWidth}px;margin-left:auto;margin-right:auto}`;
    s += `html:root body section.blk:has(>.blk-inner){padding:${L.sectionPad}px ${L.sidePad}px}`;
    s += `@media (max-width:700px){html:root body section.blk:has(>.blk-inner){padding:${Math.round(L.sectionPad * 0.62)}px ${Math.min(L.sidePad, 20)}px}}`;
  }
  s += blockCss(t, r);
  s += `html:root body{overflow-x:clip}`;
  return s;
}

// The blocks that draw their own words and buttons follow the tokens too (only where the owner kept the block's own
// default colors: a card or block color the owner picked still wins, through the block's own variables)
function blockCss(t, r) {
  const p = t.buttons.primary, B = 'html:root body ';
  const pill = `padding:${p.padY}px ${p.padX}px;border-radius:${p.shape === 'square' ? '0' : p.shape === 'rounded' ? '10px' : '999px'};font-family:var(--tk-font-body,inherit);font-weight:${p.weight};font-size:15px;letter-spacing:.01em;text-transform:none`;
  let s = '';
  // Photo that blends in (hero): words on the left, left-aligned; eyebrow, big display headline, plain sentence, primary button
  s += `${B}.sg-pb-words{text-align:left;align-items:flex-start;justify-self:start;max-width:36rem}`;
  if (r.eyebrow) s += `${B}.sg-pb-top{color:${r.eyebrow};opacity:1;font-family:var(--tk-font-body,inherit);font-weight:700;font-size:${t.text.eyebrowSize}px;letter-spacing:${t.text.eyebrowSpacing}em}`;
  s += `${B}.sg-pb-h{text-transform:none;line-height:.98;font-size:clamp(3rem,6.4vw,5.6rem)${r.heading ? ';color:' + r.heading : ''}}`;
  s += `${B}.sg-pb-note{order:3;text-transform:none;font-weight:400;font-size:19px;line-height:1.6;max-width:520px${r.body ? ';color:' + r.body : ''}}`;
  s += `${B}.sg-pb-badge{order:5;margin-top:22px;background:rgba(214,235,248,.55);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid #fff;border-radius:20px;box-shadow:0 12px 30px rgba(74,35,80,.12);color:${t.colors.find(c => c.key === 'blue-text') ? t.colors.find(c => c.key === 'blue-text').hex : (r.heading || '#1f2937')};font-family:var(--tk-font-body,inherit);font-size:13px;font-weight:700;letter-spacing:.12em;padding:12px 18px}`;
  s += `${B}.sg-pb-cta{order:4}${B}.sg-pb-h{order:2}${B}.sg-pb-top{order:1}`;
  s += `@media (max-width:760px){${B}.sg-pb-words{order:-1}}`;   // phones: the words first, then the photo
  s += `${B}.sg-pb-btn{background:${p.bg};color:${p.text};${pill}}${B}.sg-pb-btn:hover{${p.hover ? 'background:' + p.hover + ';' : ''}opacity:1;transform:translateY(-${p.lift}px)}`;
  const gl = t.colors.find(c => c.key === 'glass-blue-light'), gb = t.colors.find(c => c.key === 'glass-blue');
  if (gl && gb) s += `${B}.sg-pb-cut .sg-pb-photo{background:radial-gradient(circle at 50% 46%,${gl.hex} 0,${gb.hex} 38%,transparent 39%)}`;
  // Photo over a card: heading and button in the theme's colors on a white card (an own card color keeps its own)
  if (r.heading) s += `${B}.sg-oc-h{color:var(--oc-text,${r.heading})}`;
  s += `${B}.sg-oc-btn{background:var(--oc-btn,${p.bg});color:var(--oc-btn-ink,${p.text});${pill}}${B}.sg-oc-btn:hover{background:var(--oc-btn,${p.hover || p.bg})}`;
  // Reviews card and Decorative card buttons
  s += `${B}.sg-rc-btn{${pill}}`;
  if (r.heading) s += `${B}.sg-rc-h{color:var(--rc-ink,${r.heading})}`;
  // the footer in the theme's footer color, with soft light text
  const ft = t.colors.find(c => c.key === 'footer-bg');
  if (ft) s += `${B}.site-footer{background:${ft.hex};color:#f3e6ee}${B}.site-footer :is(a,p,li,span,h3,h4,div){color:#f3e6ee}${B}.site-footer .brand{color:#fff}`;
  // six cards read best three to a row on wide screens
  s += `@media (min-width:900px){${B}.feat-grid:has(>.feat-card:nth-child(5)){grid-template-columns:repeat(3,minmax(0,1fr))}}`;
  return s;
}

// The brand fields other parts of SiteGen read, kept in step with the tokens
function linked(theme) {
  const t = active(theme); if (!t) return {};
  const o = {};
  o.primaryColor = t.buttons.primary.bg;
  const brand = t.colors.find(c => c.key === t.text.brandColor);
  o.accentColor = brand ? brand.hex : (t.text.heading || theme.accentColor || '#1e293b');
  if (t.fonts.display) o.headingFont = t.fonts.display.family;
  if (t.fonts.body) o.bodyFont = t.fonts.body.family;
  o.buttonShape = t.buttons.primary.shape;
  return o;
}

// the theme fields from an editor save; tokens left out of the save are kept as they were
function parse(b, current) {
  if (b.theme_tokens_json === undefined) return { tokens: clean(current && current.tokens) };
  return { tokens: fromBody(b.theme_tokens_json) };
}

module.exports = { IMPERIAL, PRESETS, CARDS, BUTTONS, FONT_ROLES, TEXT_ROLES, MAX_COLORS, clean, fromBody, active, css, fontParams, linked, parse, warnings, readable };
