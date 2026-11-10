// Scene decor (Leo, 2026-11-10): a drawn scene along the bottom of any block on a Blocks home page, like a picket
// fence, a garden hedge, grass or rolling hills, so pets cut out of photos can stand in front of it or leap over it.
// All drawn here as SVG (no images) in the colors of a preset (Glass Blue, White, Blush, ...) or the owner's own
// three colors (fill, shade, highlight), at a height that is smaller on phones. Pictures added with + Add picture sit
// in front of it. Chosen per block on the Blocks page (Effects > Scene decor), saved on the block's mix item as
//   scene: "<kind>:<preset>:<size>"     e.g. "fence:glassblue:l"
//   or     "<kind>:own-<fill>-<shade>-<hi>:<size>"   (three hex colors without the #)
// public-site.ejs draws it inside the block's .sg-mix box (html(), CSS below), and the block keeps room for it.
const KINDS = [['fence', 'Picket fence'], ['hedge', 'Garden hedge'], ['grass', 'Grass'], ['hills', 'Rolling hills']];
// [id, name, fill, shade, highlight]
const PRESETS = [
  ['glassblue', 'Glass Blue', '#d6ebf8', '#a9d0ea', '#ffffff'],
  ['white', 'White', '#ffffff', '#dfe6ee', '#ffffff'],
  ['blush', 'Blush', '#fbd9e7', '#f2a9c6', '#ffffff'],
  ['lavender', 'Lavender', '#e7defa', '#c4b2ec', '#ffffff'],
  ['mint', 'Mint', '#d7f2e6', '#9fd9bf', '#ffffff'],
  ['garden', 'Garden green', '#8ccf7e', '#5aa65a', '#c9efb9'],
  ['wood', 'Honey wood', '#e2b98a', '#b98a5a', '#f6dcb8']
];
// [id, name, desktop px, phone px]
const SIZES = [['s', 'Small', 110, 80], ['m', 'Medium', 150, 105], ['l', 'Large', 190, 130], ['xl', 'Extra large', 240, 160]];
const HEX6 = /^[0-9a-f]{6}$/;

function parse(v) {
  const m = /^([a-z]+):([a-z0-9-]+):([a-z]+)$/.exec(String(v || '').trim().toLowerCase());
  if (!m || !KINDS.some(k => k[0] === m[1]) || !SIZES.some(s => s[0] === m[3])) return null;
  let colors = null;
  const pre = PRESETS.find(p => p[0] === m[2]);
  if (pre) colors = { fill: pre[2], shade: pre[3], hi: pre[4] };
  else {
    const o = /^own-([0-9a-f]{6})-([0-9a-f]{6})-([0-9a-f]{6})$/.exec(m[2]);
    if (!o) return null;
    colors = { fill: '#' + o[1], shade: '#' + o[2], hi: '#' + o[3] };
  }
  const sz = SIZES.find(s => s[0] === m[3]);
  return { kind: m[1], preset: pre ? pre[0] : 'own', colors, size: sz[0], h: sz[2], hm: sz[3] };
}
const clean = (v) => { const p = parse(v); return p ? String(v).trim().toLowerCase() : ''; };
const own = (fill, shade, hi) => [fill, shade, hi].every(c => HEX6.test(String(c || '').replace('#', '').toLowerCase()))
  ? 'own-' + [fill, shade, hi].map(c => String(c).replace('#', '').toLowerCase()).join('-') : '';

// ---- drawings. A tile repeats across the block (its width follows the height); hills stretch across instead ----
function tile(kind, c) {
  if (kind === 'fence') {
    // one picket (pointed top, shaded right side, highlight on the left edge) and its piece of the two rails
    return { w: 60, h: 190, svg: '<path d="M0 66 H60 V84 H0 Z M0 136 H60 V154 H0 Z" fill="' + c.shade + '"/>'
      + '<path d="M0 66 H60 V71 H0 Z M0 136 H60 V141 H0 Z" fill="' + c.hi + '" fill-opacity=".55"/>'
      + '<path d="M13 30 L30 8 L47 30 V190 H13 Z" fill="' + c.fill + '"/>'
      + '<path d="M40 21 L47 30 V190 H40 Z" fill="' + c.shade + '" fill-opacity=".75"/>'
      + '<path d="M13 30 L30 8 L31.5 10 L16.5 31 V190 H13 Z" fill="' + c.hi + '" fill-opacity=".9"/>'
      + '<path d="M13 30 L30 8 L47 30 V190 H13 Z" fill="none" stroke="' + c.shade + '" stroke-width="1.2"/>' };
  }
  if (kind === 'hedge') {
    return { w: 120, h: 190, svg: '<path d="M0 190 V70 C10 40 40 36 52 58 C60 26 98 24 106 56 C112 44 118 44 120 46 V190 Z" fill="' + c.shade + '"/>'
      + '<path d="M0 190 V96 C14 70 40 70 50 88 C60 62 96 60 106 86 C112 78 118 78 120 80 V190 Z" fill="' + c.fill + '"/>'
      + '<circle cx="24" cy="92" r="5" fill="' + c.hi + '" fill-opacity=".7"/><circle cx="80" cy="74" r="4" fill="' + c.hi + '" fill-opacity=".7"/><circle cx="62" cy="120" r="3.5" fill="' + c.hi + '" fill-opacity=".6"/>' };
  }
  if (kind === 'grass') {
    let blades = '';
    [[4, 120, -6], [12, 96, 4], [20, 132, -2], [28, 104, 7], [36, 124, -5], [44, 92, 3], [52, 118, -4]].forEach(([x, top, lean]) => {
      blades += '<path d="M' + (x - 4) + ' 190 Q' + (x + lean / 2) + ' ' + (top + 40) + ' ' + (x + lean) + ' ' + top + ' Q' + (x + 2 + lean / 3) + ' ' + (top + 40) + ' ' + (x + 5) + ' 190 Z" fill="' + c.fill + '"/>';
    });
    return { w: 56, h: 190, svg: '<rect y="160" width="56" height="30" fill="' + c.shade + '"/>' + blades + '<path d="M18 190 Q20 150 22 132 Q23 150 25 190 Z" fill="' + c.hi + '" fill-opacity=".6"/>' };
  }
  return null;
}
function hills(c) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 190" preserveAspectRatio="none">'
    + '<path d="M0 190 V96 C180 30 360 40 520 92 C700 150 860 40 1040 52 C1110 56 1160 72 1200 84 V190 Z" fill="' + c.shade + '"/>'
    + '<path d="M0 190 V138 C220 80 420 96 600 128 C800 164 980 92 1200 118 V190 Z" fill="' + c.fill + '"/>'
    + '<path d="M0 138 C220 80 420 96 600 128" fill="none" stroke="' + c.hi + '" stroke-width="4" stroke-opacity=".7"/></svg>';
}
const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the decor's markup, or '' when there is none
function html(v) {
  const p = parse(v); if (!p) return '';
  let bg;
  if (p.kind === 'hills') bg = `background-image: ${url(hills(p.colors))}; background-size: 100% 100%; background-repeat: no-repeat;`;
  else { const t = tile(p.kind, p.colors); bg = `background-image: ${url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.w} ${t.h}" width="${t.w}" height="${t.h}">${t.svg}</svg>`)}; background-size: auto 100%; background-repeat: repeat-x;`; }
  return `<span class="sg-scene sg-scene-${p.kind}" aria-hidden="true" style="--sc-h: ${p.h}px; --sc-hm: ${p.hm}px; ${esc(bg)}"></span>`;
}
// the class for the block's .sg-mix box
function attrs(v) { const p = parse(v); return p ? { cls: ' sg-has-scene', style: `--sc-room: ${p.h}px; --sc-roomm: ${p.hm}px;` } : { cls: '', style: '' }; }

const CSS = [
  '.sg-has-scene{position:relative}',
  // the block keeps room at its bottom for the scene, so its words never sit behind it
  // (the block is the first section or div in the box: a watermark's svg can come before it, Leo 2026-11-10)
  '.sg-has-scene > :is(section, div):first-child, .sg-has-scene > :nth-child(1 of section, div){padding-bottom:calc(var(--sc-room, 190px) + 28px) !important}',
  '@media (max-width:700px){.sg-has-scene > :is(section, div):first-child, .sg-has-scene > :nth-child(1 of section, div){padding-bottom:calc(var(--sc-roomm, 130px) + 20px) !important}}',
  '.sg-scene{position:absolute;left:0;right:0;bottom:0;height:var(--sc-h);z-index:5;pointer-events:none;background-position:left bottom}',
  '@media (max-width:700px){.sg-scene{height:var(--sc-hm)}}'
].join('\n');

// the Blocks page's menu: one option per kind and preset
function menu() {
  const out = [['', 'No scene decor']];
  KINDS.forEach(k => PRESETS.forEach(p => out.push([`${k[0]}:${p[0]}`, `${k[1]}, ${p[1]}`])));
  return out;
}

module.exports = { KINDS, PRESETS, SIZES, parse, clean, own, html, attrs, CSS, menu, tile, hills };
