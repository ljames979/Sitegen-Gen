// Gradients (Leo, 2026-10-28): a gallery of named presets, gradients worked out from the client's own colors,
// four drawing styles (straight, circle glow, cone, soft mesh), slow movement and grain for any section background,
// plus site-wide extras: a page-wide wash (optionally shifting as visitors scroll), gradient headings and gradient
// borders and glows on cards and buttons. The color picks are our own; no code is copied from gradient sites.
const contrast = require('./contrast');
const textures = require('./textures');
const gradLib = require('./gradientlib');   // the big gradient library (coolors.co/gradients colors), picked from a swatch grid   // textured backgrounds (drawn lines and dots over a gradient), offered with the gradients

const HEX = /^#[0-9a-f]{6}$/i;
const on = v => v === '1' || v === 'on' || v === true;

// [id, name, stops, group]
const PRESETS = [
  ['sunset', 'Sunset', ['#ff7e5f', '#feb47b'], 'warm'],
  ['peach', 'Peach', ['#ffd3a5', '#fd6585'], 'warm'],
  ['coral', 'Coral reef', ['#ff9a8b', '#ff6a88', '#ff99ac'], 'warm'],
  ['citrus', 'Citrus', ['#f7971e', '#ffd200'], 'warm'],
  ['ember', 'Ember', ['#c31432', '#f0742b'], 'warm'],
  ['honey', 'Honey', ['#fceabb', '#f8b500'], 'warm'],
  ['blush', 'Blush', ['#fbe3e8', '#f6c1d0', '#e8d5f5'], 'soft'],
  ['cream', 'Cream', ['#fdfbf3', '#f3e7d3'], 'soft'],
  ['cloud', 'Cloud', ['#f5f7fa', '#dfe7f1'], 'soft'],
  ['lilac', 'Lilac mist', ['#e0c3fc', '#cfe0fc'], 'soft'],
  ['mintcream', 'Mint cream', ['#e6fff4', '#c8f2e3'], 'soft'],
  ['sand', 'Sand', ['#f8efe2', '#e9d6b9'], 'soft'],
  ['ocean', 'Ocean', ['#2e9cca', '#1b4f72'], 'cool'],
  ['lagoon', 'Lagoon', ['#43e1c4', '#2d8fd5'], 'cool'],
  ['sky', 'Clear sky', ['#a1e3ff', '#5aa9f7'], 'cool'],
  ['mint', 'Mint', ['#5ee7b0', '#2bb3a3'], 'cool'],
  ['forest', 'Forest', ['#2f7d4f', '#123b2a'], 'cool'],
  ['glacier', 'Glacier', ['#d7f2ff', '#8fc9ee', '#5b8fd6'], 'cool'],
  ['grape', 'Grape', ['#8e54e9', '#4776e6'], 'vivid'],
  ['neon', 'Neon', ['#f72585', '#7209b7', '#3a0ca3'], 'vivid'],
  ['aurora', 'Aurora', ['#00c9a7', '#845ec2', '#ff6f91'], 'vivid'],
  ['candy', 'Candy', ['#ff8fd8', '#9d8cff', '#6fd6ff'], 'vivid'],
  ['tropic', 'Tropic', ['#00d2a8', '#f9d423', '#ff4e50'], 'vivid'],
  ['electric', 'Electric', ['#00f5d4', '#00bbf9', '#9b5de5'], 'vivid'],
  ['night', 'Night', ['#141e30', '#243b55'], 'dark'],
  ['midnight', 'Midnight blue', ['#0f2027', '#203a43', '#2c5364'], 'dark'],
  ['plum', 'Deep plum', ['#2b1035', '#5b1a4a'], 'dark'],
  ['charcoal', 'Charcoal', ['#232526', '#414345'], 'dark'],
  ['cosmos', 'Cosmos', ['#0b0b2b', '#3a1c71', '#7b2ff7'], 'dark'],
  ['espresso', 'Espresso', ['#3c2a21', '#1a120b'], 'dark'],
];
const GROUPS = { brand: 'From your colors', soft: 'Soft and light', warm: 'Warm', cool: 'Cool', vivid: 'Bright', dark: 'Dark' };
const BRAND = [['brand-soft', 'Your colors, soft and light'], ['brand-bold', 'Your colors, bold'], ['brand-dark', 'Your colors, dark'], ['brand-glow', 'Your colors, glow']];
const LIB = gradLib.LIST, LIB_IDS = LIB.map(p => p[0]);
const BY_ID = Object.fromEntries(PRESETS.concat(LIB).map(p => [p[0], p]));
const GRAD_IDS = BRAND.map(b => b[0]).concat(PRESETS.map(p => p[0]), LIB_IDS);
const isLib = id => LIB_IDS.includes(id);
const IDS = GRAD_IDS.concat(textures.IDS);
const STYLES = { line: 'Straight', circle: 'Circle glow', cone: 'Cone (sweeps around)', mesh: 'Soft mesh (blended blobs)' };

const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };
const hexOr = (v, d) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : d);

// ---- Intensity (Leo, 2026-11-05: "also add an option to turn the intensity up and down") ----
// 10 to 150 (percent, in steps of 5). Under 100 the colors fade into the page color behind them; over 100 they get
// richer (more saturated, pastels deepen). 100 (or blank) is the gradient as designed, so it is stored as ''.
const STRENGTH_MIN = 10, STRENGTH_MAX = 150;
const cleanStrength = v => { const n = Math.round(parseInt(v, 10) / 5) * 5; return Number.isFinite(n) && n !== 100 ? Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, n)) : ''; };
function toHsl(hex) {
  const [r, g, b] = contrast.parseHex(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return contrast.toHex([r, g, b].map(v => Math.round((v + m) * 255)));
}
// one color at a strength: k 0.1-1.5; base = the color it fades into
function strong(c, k, base) {
  if (!(k > 0) || k === 1) return c;
  if (k < 1) return mix(base || '#ffffff', c, k);
  const t = Math.min(0.5, k - 1) * 2, [h, s, l] = toHsl(c);   // t 0..1
  return fromHsl(h, s ? Math.min(1, s + (1 - s) * 0.75 * t) : 0, l + (0.46 - l) * 0.55 * t);
}
const strongStops = (stops, strength, base) => (strength ? stops.map(c => strong(c, strength / 100, base)) : stops);

// The colors of a preset; the "your colors" ones are worked out from the site's brand and accent colors
function stopsOf(id, theme, ink) {
  if (textures.isTexture(id)) return textures.stopsOf(id, theme, ink);
  const t = theme || {}, p = hexOr(t.primaryColor, '#2563eb'), a = hexOr(t.accentColor, '#f59e0b');
  if (id === 'brand-bold') return [p, a];
  if (id === 'brand-soft') return [mix('#ffffff', p, 0.16), mix('#ffffff', a, 0.22)];
  if (id === 'brand-dark') return [mix('#0b0e14', p, 0.38), mix('#0b0e14', a, 0.22)];
  if (id === 'brand-glow') return [p, a, mix(p, '#ffffff', 0.55)];
  return BY_ID[id] ? BY_ID[id][2].slice() : null;
}
const defaultStyle = id => (id === 'brand-glow' || id === 'aurora' || id === 'candy' ? 'mesh' : 'line');

const cleanId = v => (IDS.includes(v) ? v : '');
// site-wide picks (page wash, heading and card colors) are plain gradients only
const cleanGradId = v => (GRAD_IDS.includes(v) ? v : '');
const cleanStyle = v => (Object.prototype.hasOwnProperty.call(STYLES, v) ? v : '');
const cleanAngle = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? ((n % 360) + 360) % 360 : ''; };

// The CSS background-image for a list of colors in a style (angle in degrees for straight and cone)
function image(stops, style, angle) {
  const s = (stops || []).filter(c => HEX.test(c)); if (s.length < 2) return '';
  const deg = angle === '' || angle == null ? 135 : +angle;
  if (style === 'circle') return `radial-gradient(circle at 50% 0%, ${s.join(', ')})`;
  if (style === 'cone') return `conic-gradient(from ${deg}deg at 50% 50%, ${s.join(', ')}, ${s[0]})`;
  if (style === 'mesh') {
    const spots = [['12% 18%', 0], ['88% 14%', 1], ['78% 86%', 2], ['18% 88%', 1], ['50% 50%', 0]];
    return spots.map(([at, i]) => `radial-gradient(at ${at}, ${s[i % s.length]} 0, transparent 58%)`).join(', ') + `, linear-gradient(${deg}deg, ${mix(s[0], s[s.length - 1], 0.35)}, ${mix(s[s.length - 1], s[0], 0.35)})`;
  }
  return `linear-gradient(${deg}deg, ${s.join(', ')})`;
}

// Light or dark text, whichever reads better on the worst of the colors
function textOn(stops) {
  const worst = fg => Math.min(...stops.map(c => contrast.ratio(fg, c)));
  return worst('#ffffff') >= worst('#111111') ? '#ffffff' : '#111111';
}

// A faint grain laid over a gradient (an SVG noise tile, no extra files)
const GRAIN = "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27180%27 height=%27180%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.85%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix values=%270 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%27.5%27/%3E%3C/svg%3E')";

// What one section or block background needs: { img, brand, onbrand }. ink: a texture's colors (textures.cleanInk)
// strength: the intensity (cleanStrength, '' = as designed); base: the page color a weaker gradient fades into
function background(id, theme, style, angle, ink, strength, base) {
  const raw = stopsOf(id, theme, ink); if (!raw) return null;
  const k = cleanStrength(strength), b = hexOr(base, '#ffffff'), stops = strongStops(raw, k, b);
  // a texture is drawn as it is (style and angle do not apply); a weaker one gets a veil of the page color over it
  let img = textures.isTexture(id) ? textures.image(id, theme, ink) : image(stops, style || defaultStyle(id), angle);
  if (textures.isTexture(id) && k && k < 100) { const a = Math.round((1 - k / 100) * 255).toString(16).padStart(2, '0'); img = `linear-gradient(${b}${a}, ${b}${a}), ${img}`; }
  return { img, brand: stops[0], onbrand: textOn(stops) };
}

// "Blend into the color already there" (Leo, 2026-10-31): instead of replacing a section's or block's color, the
// gradient's colors glow in from the corners and fade into it, and a texture's drawing is laid over it in the brand
// color. Nothing is painted under them, so the color the block already had stays, and so does its text color.
// base: what it sits on, 'light', 'dark' or 'brand' (the drawing's color is picked to show on it).
const BLEND_BASES = ['light', 'dark', 'brand'];
function blendImage(id, theme, base, inkPick, strength) {
  const k = cleanStrength(strength), stops = strongStops(stopsOf(id, theme) || [], k > 100 ? k : '', '#ffffff'); if (!stops.length) return '';
  // weaker: the glows are fainter (alpha 0x99 at 100), stronger: richer colors that glow further in
  const al = Math.round(0x99 * Math.min(1.5, (k || 100) / 100)).toString(16).padStart(2, '0'), reach = k > 100 ? 70 + Math.round((k - 100) / 2.5) : 70;
  // a pet pattern: just the pattern, in colors that show on what it sits on (no glow under it)
  if (textures.isPet(id)) return textures.petLayer(id, theme, base, inkPick);
  if (textures.isTexture(id)) {
    inkPick = textures.inkBase(textures.cleanInk(inkPick));
    const p = hexOr((theme || {}).primaryColor, '#2563eb'), lum = contrast.luminance(p);
    const ink = base === 'brand' ? mix(p, '#ffffff', 0.72) : base === 'dark' ? textures.brandOn(theme) : lum > 0.45 ? mix(p, '#000000', 0.45) : p;
    // chosen texture colors (one, a few, or a rainbow) are drawn as picked; 'brand' uses the shade worked out above
    const own = textures.cleanInk(inkPick) && textures.cleanInk(inkPick) !== 'brand' ? textures.inkColors(inkPick, theme, base !== 'dark') : null;
    // (the drawing's lines stay as drawn; the soft glow under them follows the intensity)
    return `${textures.drawing(id, ink, inkPick)}, radial-gradient(ellipse 70% 60% at 50% 50%, ${own ? own[0] : ink}${k && k < 100 ? Math.round(0x1f * k / 100).toString(16).padStart(2, '0') : '1f'}, transparent 70%)`;
  }
  const spots = [['0% 0%', 0], ['100% 0%', 1], ['100% 100%', 2], ['0% 100%', 1]];
  return spots.map(([at, i]) => `radial-gradient(70% 80% at ${at}, ${stops[i % stops.length]}${al} 0, transparent ${reach}%)`).join(', ');
}

// ---- site-wide extras (Look and feel) ----
const EDGES = ['', 'border', 'glow', 'both'];
// Gradients and textures for the home page's own sections in any home layout (Leo 2026-11-04: "most of the new
// gradients we added are only available if i use the industry blueprint sections option"): [key, name, selector]
const HOME_SECS = [['intro', 'About (intro)', '.home-intro'], ['services', 'Services', '.home-services'], ['reviews', 'Reviews', '.home-reviews'],
  ['why', 'Why choose us', '.lp-why'], ['faq', 'Questions (FAQ)', '.lp-faq'], ['areas', 'Areas we serve', '.lp-areas'], ['quote', 'Free quote form', '.lp-quote'],
  ['trust', 'Trust strip', '.trust-strip'], ['featured', 'Featured photos', '.featured-row'], ['location', 'Where we work', '.home-location'], ['cta', 'Closing call-to-action band', '.cta-band']];
const cleanHomeBg = (v) => Object.fromEntries(HOME_SECS.map(([k]) => [k, cleanId((v || {})[k])]).filter(x => x[1]));
function parse(b) {
  return {
    pageGrad: cleanGradId(b.theme_pageGrad),
    pageGradScroll: on(b.theme_pageGradScroll),
    gradPick: cleanGradId(b.theme_gradPick),
    gradText: on(b.theme_gradText),
    gradEdge: EDGES.includes(b.theme_gradEdge) ? b.theme_gradEdge : '',
    homeBg: cleanHomeBg(Object.fromEntries(HOME_SECS.map(([k]) => [k, b['theme_hbg_' + k]]))),
  };
}
function bodyClasses(theme) {
  const t = theme || {};
  return (t.pageGrad ? ' sg-pwash' + (t.pageGradScroll ? ' sg-pwash-scroll' : '') : '') + (t.gradText ? ' sg-gtext' : '') + (t.gradEdge === 'border' || t.gradEdge === 'both' ? ' sg-gedge' : '') + (t.gradEdge === 'glow' || t.gradEdge === 'both' ? ' sg-gglow' : '');
}

// The page CSS: section movement and grain (always, they are tiny), and the site-wide extras that are on.
// pageBg is the style's page color: the page-wide wash is mixed into it so text stays readable. used: the gradient ids
// the site's blocks picked (only those get a class).
// cards: [[gradient id, strength]] picked for the cards inside blocks (cardClass). used: [[id, ink, strength]],
// blends: [[id, plain, ink, strength]]
// a soft glow of the color under a pet pattern around headings (Leo, 2026-11-07: words stay readable over it)
const halo = (c) => [3, 8, 14, 22].map(r => `0 0 ${r}px ${c}`).join(', ');
function headCss(theme, pageBg, used, blends, cards) {
  const t = theme || {}, base = hexOr(pageBg, '#ffffff'), dark = contrast.luminance(base) < 0.2;
  const out = [];
  out.push('@keyframes sg-gmove { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }');
  out.push('@media (prefers-reduced-motion: no-preference) { .sg-sec[data-sg-gmove] { background-size: 220% 220%; animation: sg-gmove 18s ease-in-out infinite alternate; } }');
  // grain: a noise layer over the section's background, under its content
  out.push(`.sg-sec[data-sg-grain] { position: relative; } .sg-sec[data-sg-grain]::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: ${GRAIN}; opacity: .35; mix-blend-mode: overlay; } .sg-sec[data-sg-grain] > * { position: relative; }`);
  // block backgrounds from the gallery: one class per gradient a block picked
  // (a texture in its own colors adds an ink class: blk-gi-<colors>)
  const seenUse = new Set();
  (used || []).map(u => (Array.isArray(u) ? u : [u, ''])).forEach(([id, ink, gx]) => {
    if (!IDS.includes(id)) return;
    const k = textures.isTexture(id) ? textures.inkKey(ink) : '', x = cleanStrength(gx), sel = `.blk.blk-bg-g-${id}` + (k ? `.${inkClass(id, ink)}` : '') + (x ? '.' + strengthClass(x) : '');
    if (seenUse.has(sel)) return; seenUse.add(sel);
    const g = background(id, t, '', '', k ? ink : '', x, base); if (!g) return;
    out.push(`${sel} { background: ${g.img}; color: ${g.onbrand}; --ink: ${g.onbrand}; --muted: ${g.onbrand}; } ${sel} :is(h2, h3, p, strong, li) { color: ${g.onbrand}; }`);
    if (textures.isPet(id)) out.push(`${sel} :is(h2, h3) { text-shadow: ${halo(g.brand)}; }`);
  });
  // blended into the section's own color (wrap in library/blueprints.js writes --sg-gb), and blocks: one class per pick
  // it goes on the design's own full-size layer, over whatever color that layer paints (page, tint ...); a section
  // without one takes over its content's page color, the content steps aside, as with a plain gallery gradient
  out.push('.sg-sec[data-sg-gb] .sg-lib > div:first-child { background-image: var(--sg-gb); background-size: auto; }');
  out.push('.sg-sec[data-sg-gb][data-sg-gb]:not(:has(.sg-lib > div)) { background-color: var(--sg-page0, var(--page-bg)); background-image: var(--sg-gb); } .sg-sec[data-sg-gb]:not(:has(.sg-lib > div)) > .sg-sec-in, .sg-sec[data-sg-gb]:not(:has(.sg-lib > div)) > .sg-side-wrap > .sg-sec-in { --page-bg: transparent; }');
  // a pet pattern over a section's color, whatever its background (library/blueprints.js wrap writes --sg-pat): on
  // the design's own full-size layer, or over the section's own color and gradient when it has none
  out.push('.sg-sec[data-sg-pat] .sg-lib > div:first-child { background-image: var(--sg-pat); background-size: auto; }');
  out.push('.sg-sec[data-sg-pat]:not(:has(.sg-lib > div)) { background-image: var(--sg-pat), var(--sg-bgimg, none), var(--sg-gb, none); }');
  out.push(`.sg-sec[data-sg-pat] :is(h1, h2, h3) { text-shadow: ${halo('var(--sg-pat-halo)')}; }`);
  const seen = new Set();
  (blends || []).forEach(([id, plain, ink, gx]) => {
    const cls = blendClass(id, plain, ink, gx); if (!cls || seen.has(cls)) return; seen.add(cls);
    const base = plain === 'brand' ? 'brand' : plain === 'dark' || dark ? 'dark' : 'light';
    out.push(`.blk.${cls} { background-image: ${blendImage(id, t, base, ink, gx)}; }`);
    if (textures.isPet(id)) out.push(`.blk.${cls} :is(h2, h3) { text-shadow: ${halo(plain === 'brand' ? 'var(--primary)' : plain === 'dark' ? '#0f172a' : base === 'dark' ? 'var(--page-bg)' : 'var(--page-bg, #ffffff)')}; }`);
  });
  // the cards inside a block (Leo 2026-11-05): each card gets the gradient and the words the color that reads on it.
  // Only the outermost card is painted (a card inside a card keeps the outer one's look).
  const seenCard = new Set();
  (cards || []).forEach(([id, gx]) => {
    const cls = cardClass(id, gx); if (!cls || seenCard.has(cls)) return; seenCard.add(cls);
    const g = background(id, t, '', '', '', gx, base); if (!g) return;
    const sel = `.blk.${cls}.${cls} :is(${CARD_SEL}):not(:is(${CARD_SEL}) *)`;
    out.push(`${sel} { background: ${g.img}; background-color: ${g.brand}; color: ${g.onbrand}; --ink: ${g.onbrand}; --muted: ${g.onbrand}; border-color: transparent; } ${sel} :is(h2, h3, h4, p, strong, li, small, blockquote, cite, a:not(.btn)) { color: ${g.onbrand}; }`);
  });
  // the home sections' own gradients: the section takes the gradient, its heading and intro words the color that reads
  // on it (cards keep their own colors)
  Object.entries(cleanHomeBg(t.homeBg)).forEach(([k, id]) => {
    const sel = HOME_SECS.find(x => x[0] === k)[2], g = background(id, t, '', '', ''); if (!g) return;
    const ink = sel === '.cta-band' ? [`body ${sel}${sel} :is(h2, p)`] : [`body ${sel}${sel} > .section-head :is(h2, p, span)`, `body ${sel}${sel} > .intro-text > p`, `body ${sel}${sel} > .intro-text .section-head :is(h2, p, span)`, `body ${sel}${sel} > .intro-text a`];
    out.push(`body ${sel}${sel}${sel} { background: ${g.img}; background-size: cover; } ${ink.join(', ')} { color: ${g.onbrand}; }`);
  });
  if (t.pageGrad) {
    // light picks keep most of their color, strong ones are toned down into the page color
    const stops = stopsOf(t.pageGrad, t).map(c => mix(base, c, dark ? 0.3 : contrast.luminance(c) > 0.6 ? 0.8 : 0.26));
    const img = t.pageGradScroll ? `linear-gradient(180deg, ${stops.concat(stops.slice(0, -1).reverse()).join(', ')})` : image(stops, defaultStyle(t.pageGrad), 160);
    out.push(`html { background: ${stops[0]}; } body.sg-pwash { --page-bg: transparent; background: transparent; }`);
    out.push(`body.sg-pwash::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background-image: ${img}; background-size: 100% ${t.pageGradScroll ? '400%' : '100%'}; background-position: 0 calc(var(--sg-sp, 0) * 100%); }`);
  }
  const pick = t.gradPick || 'brand-bold';
  const ps = stopsOf(pick, t);
  if (t.gradText && ps) {
    // heading colors lifted until they read on the page (3:1, large text)
    const ts = ps.map(c => contrast.ensureContrast(c, base, 3));
    out.push(`body.sg-gtext main h2:not(:is([data-sg-bg], .blk-bg-brand, .blk-bg-dark, [class*="blk-bg-g-"], [data-sg-fam="hero"], .hero, .sg-zw, .sg-wave) h2) { background-image: linear-gradient(90deg, ${ts.join(', ')}); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }`);
  }
  if (ps && t.gradEdge) {
    const CARDS = '.btn, .card, .svc-tile, .feat-card, .step-card, .price-card, .team-card, .t-card, .review-card, .faq-item, [data-sg-cards] > *';
    if (t.gradEdge !== 'glow') out.push(`:where(body.sg-gedge) :where(${CARDS}) { position: relative; }`);
    if (t.gradEdge !== 'glow') out.push(`body.sg-gedge :is(${CARDS})::after { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 2px; background: linear-gradient(135deg, ${ps.join(', ')}); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); pointer-events: none; }`);
    if (t.gradEdge !== 'border') out.push(`body.sg-gglow :is(${CARDS}) { box-shadow: -10px 10px 30px -12px ${ps[0]}b3, 10px 10px 30px -12px ${ps[ps.length - 1]}b3; }`);
  }
  return out.join('\n');
}

// Scroll-shifting wash: the page's scroll progress as --sg-sp (0 at the top, 1 at the bottom); still for motion-off visitors
const SCROLL_JS = "(function(){var b=document.body;if(!b.classList.contains('sg-pwash-scroll')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;var q=0,f=function(){q=0;var h=document.documentElement.scrollHeight-innerHeight;b.style.setProperty('--sg-sp',h>0?Math.min(1,Math.max(0,scrollY/h)).toFixed(4):0)};addEventListener('scroll',function(){if(!q)q=requestAnimationFrame(f)},{passive:true});f()})();";

// Options for the editor's pickers: [[group label, [[id, name, css preview]]]]. withTextures: false for the site-wide
// picks. A texture's preview is only its base colors (the drawing is too big to repeat in every picker).
// withLib: also the gradient library (284 more, in color families); pickers repeated on every block leave it out and
// open the library's swatch grid instead (libMenu), keeping only the library pick already made (keep: its id).
function menu(theme, withTextures, withLib, keep) {
  const groups = [[GROUPS.brand, BRAND.map(([id, name]) => [id, name, image(stopsOf(id, theme), defaultStyle(id), 135)])]];
  Object.keys(GROUPS).filter(g => g !== 'brand').forEach(g => groups.push([GROUPS[g], PRESETS.filter(p => p[3] === g).map(p => [p[0], p[1], image(p[2], defaultStyle(p[0]), 135)])]));
  if (withLib) groups.push(...libMenu());
  else if (isLib(keep)) groups.push(['Gradient library', [[keep, BY_ID[keep][1], image(BY_ID[keep][2], 'line', 135)]]]);
  if (withTextures !== false) textures.MENU.forEach(([label, list]) => groups.push([label, list.map(([id, name]) => [id, name, `linear-gradient(180deg, ${textures.stopsOf(id, theme).join(', ')})`])]));
  return groups;
}
// The library in its color families: [[family label, [[id, name, css preview]]]]
const libMenu = () => Object.entries(gradLib.FAMILIES).map(([f, label]) => ['Library: ' + label.toLowerCase(), LIB.filter(p => p[3] === f).map(p => [p[0], p[1], image(p[2], 'line', 135)])]);

// A gradient background picked for one section on the Blocks page: { g: gradient id, s: style, a: angle, m: drifting, n: grain, b: blend into the color already there, c: a texture's colors }
function cleanMixBg(v) {
  if (!v || typeof v !== 'object' || !cleanId(v.g)) return null;
  const o = { g: v.g };
  if (cleanStyle(v.s)) o.s = v.s;
  if (cleanAngle(v.a) !== '') o.a = cleanAngle(v.a);
  if (v.m === 1 || v.m === true || v.m === '1') o.m = 1;
  if (v.n === 1 || v.n === true || v.n === '1') o.n = 1;
  if (v.b === 1 || v.b === true || v.b === '1') o.b = 1;
  if (textures.isTexture(o.g) && textures.cleanInk(v.c)) o.c = textures.cleanInk(v.c);
  return o;
}
// ...as the section options the wrapper reads (library/blueprints.js wrap)
const mixOpts = (v) => { const o = cleanMixBg(v); return o ? { bg: 'preset', grad: o.g, gradStyle: o.s || '', gradAngle: o.a != null ? o.a : '', gradMove: !!o.m, grain: !!o.n, gradBlend: !!o.b, ...(o.c ? { gradInk: o.c } : {}) } : {}; };

// A block's blend choice: '' (the gradient replaces the block's color) or the plain color it blends into
const cleanBlockMix = v => (BLOCK_BGS.includes(v) ? v : '');
// the color a block's blend really sits on: "plain" means the block's own default (the call-to-action band is brand
// colored, the logo wall dark)
const blockMix = (b) => { const m = cleanBlockMix((b || {}).bgmix); return (m === 'none' || m === 'tint') && b.type === 'cta' ? 'brand' : m === 'none' && b.type === 'wall' ? 'dark' : m; };
const blendClass = (id, plain, ink, gx) => (IDS.includes(id) && BLOCK_BGS.includes(plain) ? `blk-gb-${plain}-${id}` + (textures.isTexture(id) && textures.inkKey(ink) ? '-' + textures.inkKey(ink) : '') + (cleanStrength(gx) ? '-x' + cleanStrength(gx) : '') : '');
// a block's own gradient at another intensity: blk-gx-<n> ('' at 100)
const strengthClass = gx => (cleanStrength(gx) ? 'blk-gx-' + cleanStrength(gx) : '');
// the cards inside a block: blk-cg-<id>[-x<n>] (plain gradients only: a texture is too busy behind a card's words)
const cleanCardBg = v => (GRAD_IDS.includes(v) ? v : '');
const cardClass = (id, gx) => (cleanCardBg(id) ? 'blk-cg-' + id + (cleanStrength(gx) ? '-x' + cleanStrength(gx) : '') : '');
// what counts as a card inside a block (the built-in blocks' card boxes, and any grid marked data-sg-cards)
const CARD_SEL = ['.card', '.step-card', '.feat-card', '.team-card', '.t-card', '.wall-card', '.svc-tile', '.price-card', '.review-card', '.acc-item', '.sg-ab-card', '.sg-ab-tile', '.sg-so-card', '.sg-at-card', '.sg-cb-card', '.sg-cl-card', '.sg-fp-card', '.sg-mh-tile', '.sg-nc-card', '.sg-oc-card', '.sg-pt-card', '.sg-rc-card', '.sg-rp-card', '.sg-sf-card', '.sg-tc-card', '.sg-story-step', '.sg-ad-panel', '[data-sg-cards] > *'].join(', ');
// the extra class a block gets when its texture is drawn in chosen colors ('' when it isn't)
const inkClass = (id, ink) => (textures.isTexture(id) && textures.inkKey(ink) ? 'blk-gi-' + textures.inkKey(ink) : '');
// A block's background value: the four plain ones, or g-<gradient id>
const BLOCK_BGS = ['none', 'tint', 'brand', 'dark'];
// 'white' (clear white, whatever the page color) is a plain choice of its own; gradients don't blend into it
const cleanBlockBg = v => (BLOCK_BGS.includes(v) || v === 'white' ? v : /^g-/.test(String(v || '')) && IDS.includes(String(v).slice(2)) ? v : 'none');

module.exports = { LIB, LIB_IDS, isLib, libMenu, cleanStrength, strongStops, strengthClass, cleanCardBg, cardClass, CARD_SEL, STRENGTH_MIN, STRENGTH_MAX, HOME_SECS, cleanHomeBg, inkClass, BLEND_BASES, blendImage, cleanBlockMix, blockMix, blendClass, GRAD_IDS, cleanGradId, textures, cleanMixBg, mixOpts, BLOCK_BGS, cleanBlockBg, PRESETS, BRAND, IDS, STYLES, EDGES, GRAIN, stopsOf, image, textOn, background, cleanId, cleanStyle, cleanAngle, parse, bodyClasses, headCss, SCROLL_JS, menu };
