// "Gradient pattern" block (Leo, 2026-11-02, after looking at four pattern galleries: checkered, new retro,
// backgammon and confetti, and how they move when pointed at; our own version, our own code). The whole block is a
// pattern made only of CSS gradients (no pictures), with optional words on top: the heading, a few lines and a button.
// Four kinds of pattern, each drawn here from the block's colors (the site's brand colors by default, or the owner's
// one to three colors, or a rainbow), and each has 12 versions (angles, band widths and cut points change):
//   checks    stepped color bands crossing over a second set: a soft plaid of squares
//   retro     two sets of bold bands with a gap in each, over white: a seventies print
//   facets    two sets of angled steps crossing at a wide angle: diamonds and triangles
//   confetti  crossing stripes in white (or near black) with thin gaps, so a color sweep shows through as shards
// and three more from photos Leo sent (2026-11-02), drawn the same way (no photos):
//   arrows    many thin stripes filling both sides, ending in an arrow point toward the plain middle
//   boards    painted wood planks: boards of slightly different shades, thin seams, a worn sheen and dark corners
//   panes     wide see-through paper panes at a slant, each fading softly, overlapping over a warm color
// The motion, like those galleries: pointed at, the pattern slowly zooms in a little and the words card lifts; or the
// pattern also drifts slowly all the time; or it holds still. Nothing moves for visitors who turn motion off.
// side: "<pattern>:<look>:<motion>:<version>", e.g. checks:card:zoom:1. Colors: the block's bgink (textures.cleanInk).
// The body is the words under the heading (a blank line starts a new paragraph). Markup in views/_blocks.ejs, CSS in
// public/sg-site.css.
const content = require('./library/content');
const contrast = require('./contrast');
const textures = require('./textures');

const PATTERNS = [
  ['checks', 'Checks: color bands that cross like a soft plaid'],
  ['retro', 'Retro: bold bands with a gap, like a seventies print'],
  ['facets', 'Facets: angled steps that cross into diamonds'],
  ['confetti', 'Confetti: crossing stripes with color showing through as shards'],
  ['arrows', 'Arrows: stripes that point in from both sides, plain in the middle'],
  ['boards', 'Boards: painted wood planks with thin seams'],
  ['panes', 'Panes: see-through paper panes that overlap over a warm color']
];
const LOOKS = [
  ['card', 'Words on a white card'],
  ['glass', 'Words on frosted glass'],
  ['dark', 'Words on a dark see-through band'],
  ['plain', 'Words straight on the pattern']
];
const MOTIONS = [
  ['zoom', 'Zooms in a little when pointed at'],
  ['drift', 'Drifts slowly, and zooms when pointed at'],
  ['still', 'Holds still']
];
const VERSIONS = 12;
const HEX = /^#[0-9a-f]{6}$/i;
const has = (list, v) => list.some(x => x[0] === v);

function settings(v) {
  const [p, l, m, n] = String(v || '').split(':');
  const ver = parseInt(n, 10);
  return {
    pattern: has(PATTERNS, p) ? p : 'checks',
    look: has(LOOKS, l) ? l : 'card',
    motion: has(MOTIONS, m) ? m : 'zoom',
    version: ver >= 1 && ver <= VERSIONS ? ver : 1
  };
}
const cleanSide = (v) => { const s = settings(v); return [s.pattern, s.look, s.motion, s.version].join(':'); };
const cleanBody = (v) => String(v || '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);

// ---- colors ----
const mixHex = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };
const rgba = (hex, a) => { const [r, g, b] = contrast.parseHex(hex); return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`; };
// the colors a pattern is drawn from
function palette(ink, theme) {
  const t = theme || {};
  const p = HEX.test(String(t.primaryColor || '')) ? t.primaryColor.toLowerCase() : '#2563eb';
  const v = textures.cleanInk(ink);
  if (v === 'rainbow') return textures.RAINBOW.slice();
  const spread = (c) => [mixHex(c, '#000000', 0.38), c, mixHex(c, '#ffffff', 0.5)];
  if (v === 'brand') return spread(p);
  if (v) { const list = v.split(','); return list.length === 1 ? spread(list[0]) : list; }
  // as set up: the brand color and the accent color (or a lighter brand color when there is no accent)
  const a = HEX.test(String(t.accentColor || '')) && t.accentColor.toLowerCase() !== p ? t.accentColor.toLowerCase() : mixHex(p, '#ffffff', 0.55);
  return [mixHex(p, '#000000', 0.25), p, a];
}
// n colors evenly along the palette
function ramp(cols, n) {
  if (n <= 1) return [cols[0]];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(t));
    return cols.length === 1 ? cols[0] : mixHex(cols[k], cols[k + 1], t - k);
  });
}
// a steady random series for one pattern and version (same page, same pattern, every time)
function series(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r1 = (n) => Math.round(n * 10) / 10;
// hard-edged bands: [[color or 'transparent', from %, to %], ...]
const bands = (angle, list, alpha) => `linear-gradient(${r1(angle)}deg, ${list.map(([c, a, b]) => { const s = c === 'transparent' ? 'transparent' : rgba(c, alpha); return `${s} ${r1(a)}%, ${s} ${r1(b)}%`; }).join(', ')})`;
const even = (cols) => cols.map((c, i) => [c, i / cols.length * 100, (i + 1) / cols.length * 100]);
// cut points: n bands with widths that vary a little, in order, from 0 to 100
function cuts(rnd, n, wobble) {
  const w = Array.from({ length: n }, () => 1 + (rnd() * 2 - 1) * wobble), sum = w.reduce((a, b) => a + b, 0);
  let at = 0; return w.map(x => { const a = at; at += x / sum * 100; return [a, at]; });
}

// ---- the four patterns: { css, under } (under: the color the words mostly sit on, for plain words) ----
function checks(cols, rnd) {
  const pairs = [[0, 90], [45, 135], [90, 0], [135, 45], [0, 90], [30, 120], [60, 150]];
  const [a1, a2] = pairs[Math.floor(rnd() * pairs.length)];
  const n = 4 + Math.floor(rnd() * 3);
  const top = ramp(cols.slice().reverse(), n), bottom = ramp(cols.map(c => mixHex(c, '#000000', 0.12)), n);
  const tc = cuts(rnd, n, 0.35), bc = cuts(rnd, n, 0.35);
  return {
    css: [bands(a1, top.map((c, i) => [c, tc[i][0], tc[i][1]]), 0.5), bands(a2, bottom.map((c, i) => [c, bc[i][0], bc[i][1]]), 1)].join(', '),
    under: average(top.map((c, i) => mixHex(c, bottom[i], 0.5)))
  };
}
function retro(cols, rnd) {
  const c = ramp(cols, 4);
  const pick = (k) => c[Math.floor(rnd() * c.length + k) % c.length];
  // band one: color, gap, color, color; band two: color, color, gap, color (cut points from the version)
  const p = [8 + rnd() * 30, 0, 0]; p[1] = p[0] + 6 + rnd() * 18; p[2] = p[1] + 12 + rnd() * 40; if (p[2] > 92) p[2] = 92;
  const q = [20 + rnd() * 45, 0, 0]; q[1] = q[0] + 4 + rnd() * 10; q[2] = q[1] + 5 + rnd() * 14; if (q[2] > 96) q[2] = 96;
  const a1 = [0, 0, 90, 180][Math.floor(rnd() * 4)], a2 = [90, 135, 45, 90][Math.floor(rnd() * 4)];
  const top = [[pick(0), 0, p[0]], ['transparent', p[0], p[1]], [pick(1), p[1], p[2]], [pick(2), p[2], 100]];
  const bottom = [[pick(3), 0, q[0]], [pick(1), q[0], q[1]], ['transparent', q[1], q[2]], [pick(2), q[2], 100]];
  return { css: [bands(a1, top, 0.5), bands(a2, bottom, 1), 'linear-gradient(90deg, #ffffff, #ffffff)'].join(', '), under: average(c) };
}
function facets(cols, rnd) {
  const a1 = Math.floor(rnd() * 360), a2 = (a1 + 90 + Math.floor(rnd() * 110)) % 360;
  const n = 6 + Math.floor(rnd() * 2);
  const top = ramp(cols, n), bottom = ramp(cols.slice().reverse().map(c => mixHex(c, '#ffffff', 0.15)), n);
  return { css: [bands(a1, even(top), 0.46), bands(a2, even(bottom), 1)].join(', '), under: average(top.concat(bottom)) };
}
function confetti(cols, rnd, version) {
  const dark = version % 4 === 0;
  const cover = dark ? '#0b0d14' : '#ffffff';
  const sweep = cols.length >= 4 ? cols : ramp(cols, 5);
  // two sets of stripes in the cover color with gaps between them; the color sweep under them shows only where the
  // gaps cross, as small slanted pieces scattered over the block (wider gaps: bigger pieces)
  const w = 12 + Math.floor(rnd() * 14), g = 5 + Math.floor(rnd() * 5);
  const a1 = Math.floor(rnd() * 180), a2 = a1 + 35 + Math.floor(rnd() * 110);
  const stripes = [a1, a2].map(a => `repeating-linear-gradient(${a}deg, ${cover} 0px, ${cover} ${w}px, transparent ${w}px, transparent ${w + g}px)`);
  return { css: stripes.concat(`linear-gradient(${rnd() < 0.5 ? 90 : 135}deg, ${sweep.join(', ')})`).join(', '), under: cover };
}
// arrows: four corner tiles; each fills the half of its tile on the outer side of its diagonal with stripes running
// along that diagonal, so the stripes bend into a point at the middle of each side (the middle stays plain)
function arrows(cols, rnd) {
  const plain = mixHex(cols[cols.length - 1], '#ffffff', 0.8);
  const inks = ramp(cols, 3).concat(['#ffffff', mixHex(cols[0], '#ffffff', 0.55)]);
  const n = 34 + Math.floor(rnd() * 22);
  const seq = Array.from({ length: n }, () => inks[Math.floor(rnd() * inks.length)]);
  // stripes from the outer corner (0%) to the diagonal (50%), widths that vary; the last one is thin, at the edge
  const w = Array.from({ length: n }, () => 0.4 + rnd() * 1.8), sum = w.reduce((a, b) => a + b, 0);
  let at = 0;
  const stops = seq.map((c, i) => { const a = at; at += w[i] / sum * 49; return `${c} ${r1(a)}%, ${c} ${r1(at)}%`; }).join(', ') + `, ${mixHex(cols[0], '#ffffff', 0.2)} 49%, ${mixHex(cols[0], '#ffffff', 0.2)} 50%, transparent 50%`;
  const wl = 30 + Math.floor(rnd() * 16), wr = 30 + Math.floor(rnd() * 16), ty = 40 + Math.floor(rnd() * 22);
  return {
    css: [`linear-gradient(to top right, ${stops})`, `linear-gradient(to bottom right, ${stops})`, `linear-gradient(to top left, ${stops})`, `linear-gradient(to bottom left, ${stops})`, `linear-gradient(${plain}, ${plain})`].join(', '),
    size: `${wl}% 50.4%, ${wl}% 50%, ${wr}% ${ty + 0.4}%, ${wr}% ${100 - ty}%, 100% 100%`,   // a hair of overlap: no seam
    pos: '0% 0%, 0% 100%, 100% 0%, 100% 100%, 0% 0%',
    under: plain
  };
}
// boards: planks side by side (or lying down), each its own shade, with a dark seam and a thin light edge
function boards(cols, rnd) {
  const main = cols.slice().sort((x, y) => sat(y) - sat(x))[0];
  const n = 9 + Math.floor(rnd() * 8), across = rnd() < 0.8;
  const c = cuts(rnd, n, 0.12);
  const planks = c.map(([a, b]) => {
    const t = rnd(), shade = t < 0.5 ? `rgba(0, 0, 0, ${r1(t * 0.16 * 100) / 100})` : `rgba(255, 255, 255, ${r1((t - 0.5) * 0.18 * 100) / 100})`;
    return `rgba(0, 0, 0, .34) ${r1(a)}%, rgba(0, 0, 0, .34) ${r1(a + 0.25)}%, rgba(255, 255, 255, .12) ${r1(a + 0.25)}%, rgba(255, 255, 255, .12) ${r1(a + 0.45)}%, ${shade} ${r1(a + 0.45)}%, ${shade} ${r1(b)}%`;
  }).join(', ');
  const dir = across ? 90 : 180, along = across ? 180 : 90;
  return {
    css: [
      'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, .3) 100%)',
      `linear-gradient(${along}deg, rgba(255, 255, 255, .1), transparent 35%, rgba(255, 255, 255, .06) 70%, rgba(255, 255, 255, .16))`,
      `linear-gradient(${dir}deg, ${planks})`,
      `linear-gradient(${main}, ${main})`
    ].join(', '),
    under: main
  };
}
// panes: wide bands at two slants (a quarter turn apart), each a pale color fading to white or clear across it
function panes(cols, rnd, version, ink) {
  // the warm color behind: the owner's third color, else a golden yellow touched by the first color
  const own = /^#/.test(textures.cleanInk(ink)) && cols.length === 3;
  const warm = own ? cols[2] : mixHex(cols[0], '#f8b91c', 0.85);
  const paneCols = own ? cols.slice(0, 2) : cols;
  const tones = ramp(paneCols, 3).map(c => mixHex(c, '#ffffff', 0.35));
  const a = 35 + Math.floor(rnd() * 20);
  const pane = (angle) => {
    const k = 1 + Math.floor(rnd() * 2); let at = 6 + rnd() * 20; const parts = [];
    for (let i = 0; i < k && at < 92; i++) {
      const w = 16 + rnd() * 20, b = Math.min(98, at + w), c = tones[Math.floor(rnd() * tones.length)], soft = rnd() < 0.5 ? '#ffffff' : c;
      parts.push(`transparent ${r1(at)}%, ${rgba(c, 0.82)} ${r1(at)}%, ${rgba(soft, 0.55)} ${r1(b)}%, transparent ${r1(b)}%`);
      at = b + 8 + rnd() * 16;
    }
    return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
  };
  return { css: [pane(a), pane(a + 90), pane(a + 180), `linear-gradient(${warm}, ${warm})`].join(', '), under: mixHex(tones[0], warm, 0.4) };
}
const sat = (h) => { const c = contrast.parseHex(h); return Math.max(...c) - Math.min(...c); };
function average(list) {
  const t = list.map(contrast.parseHex).reduce((a, x) => a.map((v, i) => v + x[i]), [0, 0, 0]);
  return contrast.toHex(t.map(v => v / list.length));
}
const DRAW = { checks, retro, facets, confetti, arrows, boards, panes };
// the pattern as a CSS background-image value
function css(pattern, version, ink, theme) {
  const s = settings([pattern, '', '', version].join(':'));
  const rnd = series(VERSIONS * 7919 * (PATTERNS.findIndex(x => x[0] === s.pattern) + 1) + s.version * 104729);
  return DRAW[s.pattern](palette(ink, theme), rnd, s.version, ink);
}

function view(site, blk) {
  const b = blk || {}, s = settings(b.side);
  const drawn = css(s.pattern, s.version, b.bgink, (site || {}).theme);
  const ink = contrast.textOn(drawn.under);
  const paras = cleanBody(b.body).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const words = !!(b.heading || paras.length || (b.buttonText && b.buttonUrl));
  return {
    ...s, words, paras,
    headingHtml: content.hlHtml(b.heading || ''),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null,
    bg: drawn.css,
    // some patterns place their layers (sizes and spots for each gradient)
    bgPlace: drawn.size ? `; background-size: ${drawn.size}; background-position: ${drawn.pos}; background-repeat: no-repeat` : '',
    // plain words take the color that reads on the pattern, with a soft shadow the other way
    style: s.look === 'plain' ? `--gp-ink: ${ink}; --gp-shade: ${ink === '#ffffff' ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.35)'}` : ''
  };
}

module.exports = { PATTERNS, LOOKS, MOTIONS, VERSIONS, settings, cleanSide, cleanBody, palette, css, view };
