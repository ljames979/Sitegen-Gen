// Textured backgrounds (Leo, 2026-10-31, from his screenshots of tech sites): contour lines, pixel-dot bands, a wire
// globe, a dotted grid with connector lines, particle streams, a prism light beam, a glowing dot sphere, a triangle
// mesh over a glowing horizon and a particle burst. Each is our own drawing: an SVG made here (seeded, so it is the
// same every time) laid over a gradient, with no files and no code from anywhere else. Most also come "in your
// colors": the lines and dots take the site's brand color and the dark base leans toward it.
// gradients.js lists them with the gradients, so every background picker offers them.
const contrast = require('./contrast');
const pets = require('./petpatterns');

const HEX = /^#[0-9a-f]{6}$/i;
const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };
// a repeatable random sequence
const rnd = (seed) => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const W = 1600, H = 900;
const r1 = (n) => Math.round(n * 10) / 10;
// dots drawn as one path of tiny round-capped strokes (much smaller than separate circles)
const dots = (pts, color, size, op) => pts.length ? `<path d="${pts.map(([x, y]) => `M${Math.round(x)} ${Math.round(y)}h.1`).join('')}" stroke="${color}" stroke-width="${size}" stroke-linecap="round" opacity="${op}"/>` : '';
// the outer svg has no size or shape of its own, so as a background it fills the whole section (no tiling, no bars);
// the inner one keeps the drawing's shape and is cropped to fit (like a cover photo)
const svg = (body, defs) => `<svg xmlns="http://www.w3.org/2000/svg"><svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" fill="none">${defs || ''}${body}</svg></svg>`;
const url = (s) => `url('data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;

const DRAW = {
  // big soft orbits and a few small plus marks
  contour(c) {
    const R = rnd(11); let b = '';
    for (let i = 0; i < 8; i++) b += `<ellipse cx="${r1(300 + R() * 1100)}" cy="${r1(250 + R() * 500)}" rx="${r1(380 + i * 120)}" ry="${r1(170 + i * 70)}" transform="rotate(${r1(-25 + R() * 50)} 800 450)" stroke="${c}" stroke-opacity=".16" stroke-width="1.3"/>`;
    let p = '';
    for (let i = 0; i < 16; i++) { const x = Math.round(R() * W), y = Math.round(R() * H); p += `M${x - 5} ${y}h10M${x} ${y - 5}v10`; }
    return b + `<path d="${p}" stroke="${c}" stroke-opacity=".4" stroke-width="1.4"/>`;
  },
  // two bands of small square dots that thin out at their edges
  pixels(c) {
    const R = rnd(7); let d = '';
    [[600, 70], [790, 45]].forEach(([y0, h]) => {
      for (let x = 6; x < W; x += 13) for (let y = y0 - h; y <= y0 + h; y += 13) {
        const edge = 1 - Math.abs(y - y0) / h;
        if (R() < 0.12 + edge * 0.5) d += `M${x} ${y}h6v6h-6z`;
      }
    });
    return `<path d="${d}" fill="${c}" opacity=".32"/>`;
  },
  // a wire globe cut off at the right, with a few glowing points on it
  globe(c) {
    const cx = 1180, cy = 360, r = 560; let b = `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
    for (let i = 1; i < 6; i++) b += `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * Math.cos(i * Math.PI / 12))}" ry="${r}"/>`;
    for (let i = -4; i <= 4; i++) { const y = cy + r * Math.sin(i * Math.PI / 10), w = r * Math.cos(i * Math.PI / 10); b += `<ellipse cx="${cx}" cy="${r1(y)}" rx="${r1(w)}" ry="${r1(w * 0.18)}"/>`; }
    const nodes = [[cx - 420, cy - 120], [cx + 30, cy + 260], [cx - 140, cy - 380], [cx + 300, cy - 40]];
    return `<g stroke="${c}" stroke-opacity=".32" stroke-width="1.3">${b}</g>` + nodes.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="16" fill="${c}" opacity=".18"/><circle cx="${r1(x)}" cy="${r1(y)}" r="5" fill="${c}"/>`).join('');
  },
  // an even field of dots with a frame and lines meeting in the middle
  grid(c) {
    // the dots as a repeating pattern (a few hundred bytes instead of 1,800 dots)
    // the dots as a repeating pattern (a few hundred bytes instead of 1,800 dots), used as a mask so a color sweep
    // runs across the whole field instead of repeating in every tile
    const field = `<defs><pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse" x="6" y="6"><circle cx="14" cy="14" r="1.5" fill="#fff"/></pattern><mask id="dm"><rect width="${W}" height="${H}" fill="url(#d)"/></mask></defs><rect width="${W}" height="${H}" fill="${c}" opacity=".26" mask="url(#dm)"/>`;
    const box = 'M160 140H1440V780H160Z', lines = 'M160 140L800 460L1440 780M1440 140L800 460L160 780M800 140V780M160 460H1440';
    return field + `<path d="${box}${lines}" stroke="${c}" stroke-opacity=".22" stroke-width="1.2"/><circle cx="800" cy="460" r="14" stroke="${c}" stroke-opacity=".5"/>`;
  },
  // streams of dots curving in to one bright point, with fine lines fanning out of it
  stream(c, c2) {
    const R = rnd(5), a = [], b = [];
    for (let s = 0; s < 9; s++) {
      const amp = 60 + s * 26, ph = R() * 6, side = s % 2 ? 1 : -1;
      for (let t = 0; t <= 1; t += 0.012) {
        const x = 900 + side * (1 - t) * (700 + s * 30), y = 330 + Math.sin(t * 5 + ph) * amp * (1 - t) + (s - 4) * 22 * (1 - t);
        (side > 0 ? a : b).push([x + (R() - 0.5) * 6, y + (R() - 0.5) * 6]);
      }
    }
    let fan = ''; for (let i = 0; i < 26; i++) { const ang = 0.6 + i * 0.07; fan += `M900 330L${r1(900 + Math.cos(ang) * 520)} ${r1(330 + Math.sin(ang) * 420)}`; }
    return dots(a, c, 3, 0.7) + dots(b, c2, 3, 0.7) + `<path d="${fan}" stroke="${c}" stroke-opacity=".22" stroke-width="1"/><circle cx="900" cy="330" r="40" fill="${c}" opacity=".12"/><circle cx="900" cy="330" r="7" fill="#fff"/>`;
  },
  // a ball of dots: the near side bright, the far side faint
  sphere(c) {
    const n = 640, near = [], far = [], cx = 800, cy = 430, r = 300, g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = g * i, x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const ty = y * Math.cos(0.4) - z * Math.sin(0.4), tz = y * Math.sin(0.4) + z * Math.cos(0.4);
      (tz > 0 ? near : far).push([cx + x * r, cy + ty * r]);
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r * 1.25}" fill="${c}" opacity=".07"/>` + dots(far, c, 3, 0.3) + dots(near, c, 4, 0.85);
  },
  // a triangle mesh over a glowing horizon
  mesh(c) {
    const R = rnd(3), rows = [];
    for (let j = 0; j < 9; j++) {
      const y = 380 + Math.pow(j / 8, 1.6) * 560, row = [];
      for (let i = -2; i < 16; i++) row.push([i * 120 + (R() - 0.5) * 70 + (j % 2) * 60, y + (R() - 0.5) * 40 * (j / 8)]);
      rows.push(row);
    }
    let d = '';
    rows.forEach((row, j) => row.forEach((p, i) => {
      if (row[i + 1]) d += `M${Math.round(p[0])} ${Math.round(p[1])}L${Math.round(row[i + 1][0])} ${Math.round(row[i + 1][1])}`;
      const nx = rows[j + 1]; if (nx) { d += `M${Math.round(p[0])} ${Math.round(p[1])}L${Math.round(nx[i][0])} ${Math.round(nx[i][1])}`; if (nx[i + 1]) d += `M${Math.round(p[0])} ${Math.round(p[1])}L${Math.round(nx[i + 1][0])} ${Math.round(nx[i + 1][1])}`; }
    }));
    return `<path d="${d}" stroke="${c}" stroke-opacity=".28" stroke-width="1.1"/>` + dots(rows.flat(), c, 4, 0.6);
  },
  // scattered dots, thicker in a loose ring
  burst(c) {
    const R = rnd(9), a = [], b = [];
    for (let i = 0; i < 1100; i++) {
      const ang = R() * Math.PI * 2, ring = R() < 0.55, rr = ring ? 220 + (R() - 0.5) * 160 : R() * 760;
      const p = [1000 + Math.cos(ang) * rr * 1.25, 420 + Math.sin(ang) * rr * 0.8];
      (R() < 0.12 ? b : a).push(p);
    }
    return dots(a, c, 3.4, 0.6) + dots(b, '#ffffff', 3.6, 0.7);
  }
};

// [key, name, base colors (top to bottom), the dots' and lines' own color, extra color, gradient laid under, brand version]
const LIST = [
  ['contour', 'Contour lines', ['#26282a', '#1b1c1e'], '#ffffff', '', null, true],
  ['pixels', 'Pixel dot bands', ['#232527', '#1a1c1d'], '#7dd3a8', '', null, true],
  ['globe', 'Wire globe', ['#0d0e12', '#14161c'], '#3b6cff', '', null, true],
  ['grid', 'Dot grid with lines', ['#242628', '#1d1f21'], '#ffffff', '', null, true],
  ['stream', 'Particle stream', ['#050608', '#0b0d10'], '#a78bfa', '#34d399', null, true],
  ['prism', 'Prism light beam', ['#dcdde0', '#f1f1f2'], '', '', 'linear-gradient(174deg, transparent 36%, rgba(255,128,96,.42) 45%, rgba(255,210,110,.5) 47.5%, rgba(140,230,200,.45) 50%, rgba(80,150,255,.55) 52.5%, rgba(170,120,255,.35) 55%, transparent 63%), radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.75), transparent 60%), linear-gradient(180deg, #d9dadd, #f2f2f3 50%, #d6d7da)', false],
  ['sphere', 'Glowing dot sphere', ['#07080f', '#2f3488'], '#f472b6', '', 'radial-gradient(ellipse at 50% 45%, rgba(80,70,170,.45), transparent 55%), linear-gradient(180deg, #07080f 0%, #0d1030 55%, #3a3f9a 100%)', true],
  ['mesh', 'Triangle mesh horizon', ['#0a0c1e', '#2b2f86'], '#8b93ff', '', 'radial-gradient(ellipse 60% 22% at 50% 100%, rgba(150,160,255,.55), transparent 70%), linear-gradient(180deg, #0a0c1e 0%, #121640 60%, #2b2f86 100%)', true],
  ['burst', 'Particle burst', ['#0d1430', '#151c45'], '#5b7cff', '', null, true]
];
const BY = Object.fromEntries(LIST.map(t => [t[0], t]));
// Pet patterns (petpatterns.js): txp-<key>. They are drawn over the color already there (petLayer), or over a soft
// base of their own when one replaces a block's or section's color.
const PET_IDS = pets.LIST.map(p => 'txp-' + p[0]);
const isPet = (id) => PET_IDS.includes(id);
const IDS = LIST.map(t => 'tx-' + t[0]).concat(LIST.filter(t => t[6]).map(t => 'txb-' + t[0]), PET_IDS);
const isTexture = (id) => IDS.includes(id);

// the site's brand color, lifted until it shows on a dark base
function brandOn(theme) {
  const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2563eb';
  return lift(p);
}
const lift = (c) => (contrast.luminance(c) < 0.18 ? mix(c, '#ffffff', 0.45) : c);

// Texture colors (Leo, 2026-11-02): any texture can be drawn in the brand color, one color the owner picks, two or
// three colors that sweep across the drawing, or a rainbow. Saved as one short value:
//   ''         as drawn (the texture's own colors; the "your colors" ones use the brand color)
//   'brand'    the brand color
//   '#a1b2c3'  one color;  '#a1b2c3,#d4e5f6' or three of them: a sweep of colors
//   'rainbow'  a rainbow sweep
const RAINBOW = ['#ff5e5e', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'];
//   'black' / 'white'   all black or all white (Leo, 2026-11-07, for the pet patterns; any texture can use them)
//   'p-<name>'  a matching palette (PALETTES): the pet patterns color dogs, cats and the small things from it
const INK_MODES = [['', 'As drawn'], ['brand', 'Brand color'], ['black', 'All black'], ['white', 'All white'], ['one', 'One color'], ['two', 'Two colors'], ['three', 'Three colors'], ['rainbow', 'Rainbow']];
const PALETTES = pets.PALETTES;
const PAL = Object.fromEntries(PALETTES.map(p => [p[0], p[2]]));
const BLACK = '#1d1c1f';
function cleanInk(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'brand' || s === 'rainbow' || s === 'black' || s === 'white' || Object.prototype.hasOwnProperty.call(PAL, s)) return s;
  const list = s.split(',').map(x => x.trim()).filter(Boolean);
  return list.length && list.length <= 3 && list.every(x => HEX.test(x)) ? list.join(',') : '';
}
// the mode an ink value is in, and its colors (for the pickers)
const inkMode = (ink) => { const v = cleanInk(ink); return !v || v[0] !== '#' ? v : ['one', 'two', 'three'][v.split(',').length - 1]; };
// a class-safe name for an ink value
const inkKey = (ink) => cleanInk(ink).replace(/#/g, '').replace(/,/g, '-');
// The colors an ink value paints with: lifted to show on a dark base unless onLight
function inkColors(ink, theme, onLight) {
  const v = cleanInk(ink); if (!v) return null;
  if (v === 'rainbow') return RAINBOW.slice();
  if (v === 'black') return [BLACK];
  if (v === 'white') return ['#ffffff'];
  if (v === 'p-brand') { const t = theme || {}, p = HEX.test(String(t.primaryColor || '')) ? t.primaryColor.toLowerCase() : '#2563eb', a = HEX.test(String(t.accentColor || '')) ? t.accentColor.toLowerCase() : '#f59e0b'; return [p, a, mix(p, a, 0.5)]; }
  if (PAL[v]) return PAL[v].slice();
  if (v === 'brand') { const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2563eb'; return [onLight ? p : lift(p)]; }
  return v.split(',').map(c => (onLight ? c : lift(c)));
}
// One color: drawn in it. More: an SVG gradient (#ink) that the drawing's lines and dots take, sweeping across it.
function paint(colors) {
  if (colors.length === 1) return { c: colors[0], c2: mix(colors[0], '#ffffff', 0.35), defs: '' };
  const n = colors.length - 1, rain = colors.length > 3;
  const stops = colors.map((c, i) => `<stop offset="${r1(i / n * 100)}%" stop-color="${c}"/>`).join('');
  return { c: 'url(#ink)', c2: 'url(#ink)', defs: `<defs><linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="${rain ? 300 : 0}" x2="${W}" y2="${rain ? 600 : H}">${stops}</linearGradient></defs>` };
}
// the prism's light beam, in the chosen colors
function beam(colors) {
  const list = colors.length === 1 ? [mix(colors[0], '#ffffff', 0.4), colors[0], mix(colors[0], '#000000', 0.2)] : colors;
  const n = list.length, a = (c, al) => { const [r, g, b] = contrast.parseHex(c).map(Math.round); return `rgba(${r},${g},${b},${al})`; };
  return `linear-gradient(174deg, transparent 36%, ${list.map((c, i) => `${a(c, 0.5)} ${r1(44 + i * (12 / Math.max(1, n - 1)))}%`).join(', ')}, transparent 64%)`;
}

// The base colors (for the text color and the page wash)
function stopsOf(id, theme, ink) {
  if (!isTexture(id)) return null;
  if (isPet(id)) return petBase(theme, ink);
  const brand = id.startsWith('txb-'), t = BY[id.replace(/^txb?-/, '')], cs = inkColors(ink, theme);
  if (cs && t[0] !== 'prism') {
    // in chosen colors: a deep shade leaning toward the first one (a rainbow keeps a neutral dark base)
    if (cleanInk(ink) === 'rainbow') return t[0] === 'contour' || t[0] === 'pixels' || t[0] === 'grid' ? t[2].slice() : ['#07080d', '#10121a'];
    return [mix('#06080c', cs[0], 0.16), mix('#0a0d12', cs[0], t[0] === 'mesh' || t[0] === 'sphere' ? 0.42 : 0.26)];
  }
  if (!brand || t[0] === 'prism') return t[2].slice();
  // in your colors: a deep shade of the brand color, a little lighter toward the bottom
  const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2563eb';
  return [mix('#06080c', p, 0.16), mix('#0a0d12', p, t[0] === 'mesh' || t[0] === 'sphere' ? 0.42 : 0.26)];
}
// A pet pattern's own soft base (when it replaces the color): cream under the tan-and-charcoal look, a dark shade
// under white, a pale tint of the first color under anything else
function petBase(theme, ink) {
  const v = cleanInk(ink);
  if (!v || v === 'black') return ['#fbf7f1', '#f3eadd'];
  if (v === 'white') { const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2e2a2d'; return [mix('#1c1b20', p, 0.22), mix('#141318', p, 0.3)]; }
  if (v === 'rainbow') return ['#ffffff', '#f6f5fb'];
  const c = inkColors(v, theme, true)[0];
  return [mix('#ffffff', c, 0.07), mix('#ffffff', c, 0.14)];
}
// The colors a pet pattern is drawn in, on what it sits on: 'light', 'dark', 'brand' or a color (#hex).
// As drawn: tan and charcoal on light colors, white on dark ones.
function petColors(ink, theme, under) {
  const v = cleanInk(ink);
  const dark = under === 'dark' || under === 'brand' || (HEX.test(String(under || '')) && contrast.luminance(under) < 0.4);
  if (!v) return dark ? ['#ffffff'] : PAL['p-classic'].slice();
  if (v === 'brand') { const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2563eb'; return [under === 'brand' ? mix(p, '#ffffff', 0.75) : dark ? lift(p) : p]; }
  return inkColors(v, theme, true);
}
// Just the pet pattern, nothing under it, for laying over the color already there
function petLayer(id, theme, under, ink) {
  if (!isPet(id)) return '';
  const cs = petColors(ink, theme, under), key = 'p' + id + cs.join(',');
  if (cache.has(key)) return cache.get(key);
  const out = url(pets.svg(id.slice(4), cs));
  cache.set(key, out);
  return out;
}
const cache = new Map();
// The CSS background-image layers: the drawing over its gradient. ink: the texture colors ('' = as drawn)
function image(id, theme, ink) {
  if (!isTexture(id)) return '';
  if (isPet(id)) { const b = petBase(theme, ink); return `${petLayer(id, theme, b[0], ink)}, linear-gradient(180deg, ${b.join(', ')})`; }
  const t = BY[id.replace(/^txb?-/, '')], v = cleanInk(ink) || (id.startsWith('txb-') ? 'brand' : '');
  const cs = inkColors(v, theme);
  const key = id + '|' + (cs ? cs.join(',') : ''); if (cache.has(key)) return cache.get(key);
  const base = stopsOf(id, theme, v);
  let out;
  if (t[0] === 'prism') {
    out = cs ? `${beam(cs)}, radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.75), transparent 60%), linear-gradient(180deg, #d9dadd, #f2f2f3 50%, #d6d7da)` : t[5];
  } else {
    const under = t[5] && !cs ? t[5] : `linear-gradient(180deg, ${base.join(', ')})`;
    const glow = cs && (t[0] === 'mesh' || t[0] === 'sphere') ? `radial-gradient(ellipse 60% 30% at 50% ${t[0] === 'mesh' ? '100%' : '45%'}, ${cs[Math.floor(cs.length / 2)]}55, transparent 70%), ` : '';
    const pt = cs ? paint(cs) : { c: t[3], c2: t[4] || t[3], defs: '' };
    out = url(svg(DRAW[t[0]](pt.c, pt.c2), pt.defs)) + ', ' + glow + under;
  }
  cache.set(key, out);
  return out;
}
// Just the drawing (for "blend into the color already there": no base of its own, so the block's color shows
// through), in one color, or in the chosen texture colors when ink is set. The prism has no drawing: its light beam is
// used instead.
function drawing(id, color, ink) {
  if (!isTexture(id) || !HEX.test(String(color || ''))) return '';
  if (isPet(id)) return petLayer(id, null, color, ink);
  // the brand color is already worked out by the caller for what it sits on
  const t = BY[id.replace(/^txb?-/, '')], v = cleanInk(ink), cs = v && v !== 'brand' ? inkColors(v, null, true) : null;
  const list = cs || [color];
  const key = 'd' + t[0] + list.join(','); if (cache.has(key)) return cache.get(key);
  let out;
  if (DRAW[t[0]]) { const pt = paint(list); out = url(svg(DRAW[t[0]](pt.c, pt.c2), pt.defs)); }
  else out = list.length > 1 || cs ? beam(list) : t[5].split('), radial-gradient')[0] + ')';
  cache.set(key, out);
  return out;
}
// For the pickers: [[group, [[id, name]]]]
const MENU = [['Pet patterns', pets.LIST.map(p => ['txp-' + p[0], p[1]])], ['Textures', LIST.map(t => ['tx-' + t[0], t[1]])], ['Textures in your colors', LIST.filter(t => t[6]).map(t => ['txb-' + t[0], t[1] + ', your colors'])]];

module.exports = { PET_IDS, isPet, petLayer, petColors, PALETTES, IDS, isTexture, stopsOf, image, drawing, brandOn, MENU, LIST, cleanInk, inkMode, inkKey, inkColors, INK_MODES, RAINBOW };
