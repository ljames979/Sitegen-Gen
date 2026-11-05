// Peeking pets (Leo, 2026-11-02): our own drawing of a row of cats or dogs peeking up from the bottom edge, flat
// soft colors, for the "+ Add picture" boxes (picboxes.js). Drawn here as plain SVG shapes (no outside artwork), so it
// is free to use, sharp at any size and has no background. Kinds: cats, dogs, mix (cat, dog, cat ...).
const W = 110, H = 130;

const CATS = [
  { fur: '#8a5a3c', ear: '#8a5a3c', marks: 'stripes', mark: '#e7a64a', h: 112 },
  { fur: '#c98d4b', ear: '#c98d4b', marks: 'tabby', mark: '#7a4a24', h: 106 },
  { fur: '#e4c1c3', ear: '#e4c1c3', marks: '', mark: '', h: 110 },
  { fur: '#f3d09a', ear: '#e9a23b', marks: 'fluff', mark: '#c97f2c', h: 104 },
  { fur: '#fbfbf8', ear: '#2f2a28', marks: 'sweater', mark: '#2f2a28', h: 114, earL: '#fbfbf8' },
  { fur: '#8c9596', ear: '#8c9596', marks: 'tabby', mark: '#2f3437', h: 108 },
  { fur: '#efaa3e', ear: '#efaa3e', marks: 'stripes', mark: '#f8d9a0', h: 110 },
  { fur: '#fbf8f3', ear: '#ef9a3a', marks: 'sweater', mark: '#efd8b8', h: 104, earL: '#fbf8f3' },
  { fur: '#b97a4f', ear: '#b97a4f', marks: '', mark: '', h: 112 }
];
const DOGS = [
  { fur: '#d9a066', ear: '#8a5a3c', muzzle: '#f6e2c6', h: 110, marks: 'collar', mark: '#e05d5d' },
  { fur: '#fbfbf8', ear: '#2f2a28', muzzle: '#fbfbf8', h: 106, marks: 'patch', mark: '#2f2a28' },
  { fur: '#a9724a', ear: '#6e4329', muzzle: '#e8c49c', h: 114, marks: 'tongue', mark: '#ee8b95' },
  { fur: '#e9d3b1', ear: '#c99a62', muzzle: '#fbf3e6', h: 104, marks: 'collar', mark: '#4f8fd6' },
  { fur: '#3b3532', ear: '#3b3532', muzzle: '#c98d4b', h: 112, marks: 'brows', mark: '#c98d4b' },
  { fur: '#f2c27b', ear: '#f2c27b', muzzle: '#fbe6c4', h: 108, marks: 'tongue', mark: '#ee8b95', perky: true },
  { fur: '#9aa3a6', ear: '#5f676a', muzzle: '#e3e6e6', h: 110, marks: 'collar', mark: '#f0b429' },
  { fur: '#fbf8f3', ear: '#b97a4f', muzzle: '#fbf8f3', h: 104, marks: 'spots', mark: '#b97a4f' },
  { fur: '#c47f45', ear: '#8a4f28', muzzle: '#f0d2ad', h: 112, marks: 'tongue', mark: '#ee8b95' }
];

// very light fur gets a faint outline so it still shows on a white page
const edge = (hex) => { const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.9 ? ' stroke="#ddd5c9" stroke-width="1.6"' : ''; };
const r1 = (n) => Math.round(n * 10) / 10;
// eyes, a little shine in each
const eyes = (cx, y, gap) => [-1, 1].map(s => `<circle cx="${r1(cx + s * gap)}" cy="${y}" r="4.2" fill="#2b2523"/><circle cx="${r1(cx + s * gap + 1.3)}" cy="${y - 1.4}" r="1.3" fill="#fff"/>`).join('');

function cat(x, c) {
  const cx = x + W / 2, top = H - c.h, l = x + 15, r = x + W - 15, bw = r - l;
  const body = `<path d="M${l} ${H} V${top + 26} Q${l} ${top + 6} ${l + 22} ${top + 5} H${r - 22} Q${r} ${top + 6} ${r} ${top + 26} V${H} Z" fill="${c.fur}"${edge(c.fur)}/>`;
  const earL = `<path d="M${l + 3} ${top + 16} L${l + 6} ${top - 10} L${l + 28} ${top + 6} Z" fill="${c.earL || c.ear}"${edge(c.earL || c.ear)}/><path d="M${l + 8} ${top + 9} L${l + 9} ${top - 2} L${l + 20} ${top + 6} Z" fill="#f2b8b5" opacity=".7"/>`;
  const earR = `<path d="M${r - 3} ${top + 16} L${r - 6} ${top - 10} L${r - 28} ${top + 6} Z" fill="${c.ear}"/><path d="M${r - 8} ${top + 9} L${r - 9} ${top - 2} L${r - 20} ${top + 6} Z" fill="#f2b8b5" opacity=".7"/>`;
  const fy = top + 34;
  const face = eyes(cx, fy, 12) + `<path d="M${cx - 3.5} ${fy + 7} H${cx + 3.5} L${cx} ${fy + 11} Z" fill="#e9868c"/>`
    + `<path d="M${cx - 6} ${fy + 13} Q${cx - 3} ${fy + 16} ${cx} ${fy + 12} Q${cx + 3} ${fy + 16} ${cx + 6} ${fy + 13}" stroke="#5a4a44" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
    + [-1, 1].map(s => `<path d="M${cx + s * 14} ${fy + 9} l${s * 14} -2 M${cx + s * 14} ${fy + 12} l${s * 14} 2" stroke="#5a4a44" stroke-width="1" opacity=".45" stroke-linecap="round"/>`).join('');
  let marks = '';
  if (c.marks === 'stripes') marks = [0, 1, 2].map(i => `<path d="M${l} ${H - 8 - i * 9} q${bw * 0.3} -4 ${bw * 0.55} 0" stroke="${c.mark}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M${r} ${H - 12 - i * 9} q${-bw * 0.2} -3 ${-bw * 0.38} 0" stroke="${c.mark}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('');
  if (c.marks === 'tabby') marks = `<path d="M${cx - 8} ${top + 8} l2 9 M${cx} ${top + 6} v10 M${cx + 8} ${top + 8} l-2 9" stroke="${c.mark}" stroke-width="2.6" stroke-linecap="round"/>`
    + [0, 1, 2].map(i => `<path d="M${l} ${H - 10 - i * 9} h${bw * 0.22} M${r} ${H - 10 - i * 9} h${-bw * 0.22}" stroke="${c.mark}" stroke-width="3.4" stroke-linecap="round"/>`).join('');
  if (c.marks === 'fluff') marks = `<path d="M${l + 4} ${H - 30} ${[...Array(9)].map((_, i) => `l${bw / 9 / 2} 6 l${bw / 9 / 2} -6`).join(' ')}" stroke="${c.mark}" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M${l + 4} ${H - 16} ${[...Array(9)].map(() => `l${bw / 9 / 2} 6 l${bw / 9 / 2} -6`).join(' ')}" stroke="${c.mark}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
  if (c.marks === 'sweater') marks = [0, 1, 2, 3, 4].map(i => `<path d="M${l} ${H - 4 - i * 6} H${r}" stroke="${c.mark}" stroke-width="2.4"/>`).join('');
  return `<g>${earL}${earR}${body}${marks}${face}</g>`;
}

function dog(x, c) {
  const cx = x + W / 2, top = H - c.h, l = x + 17, r = x + W - 17, bw = r - l;
  const body = `<path d="M${l} ${H} V${top + 30} Q${l} ${top + 2} ${cx} ${top + 2} Q${r} ${top + 2} ${r} ${top + 30} V${H} Z" fill="${c.fur}"${edge(c.fur)}/>`;
  // floppy ears hang down the sides; perky ears stand up, rounded
  const ears = c.perky
    ? [-1, 1].map(s => `<path d="M${cx + s * 10} ${top + 8} Q${cx + s * 30} ${top - 16} ${cx + s * 34} ${top + 16} Z" fill="${c.ear}"/>`).join('')
    : [-1, 1].map(s => `<path d="M${cx + s * 14} ${top + 5} Q${cx + s * 46} ${top + 2} ${cx + s * 40} ${top + 40} Q${cx + s * 34} ${top + 50} ${cx + s * 26} ${top + 36} Z" fill="${c.ear}"/>`).join('');
  const fy = top + 30;
  let marks = '';
  if (c.marks === 'patch') marks = `<ellipse cx="${cx + 12}" cy="${fy}" rx="10" ry="9" fill="${c.mark}"/>`;
  if (c.marks === 'spots') marks = `<circle cx="${l + 12}" cy="${H - 26}" r="6" fill="${c.mark}"/><circle cx="${r - 14}" cy="${H - 14}" r="7" fill="${c.mark}"/><circle cx="${cx + 4}" cy="${H - 6}" r="4" fill="${c.mark}"/>`;
  if (c.marks === 'brows') marks = [-1, 1].map(s => `<ellipse cx="${cx + s * 12}" cy="${fy - 8}" rx="4.5" ry="2.6" fill="${c.mark}"/>`).join('');
  const muzzle = `<ellipse cx="${cx}" cy="${fy + 13}" rx="17" ry="12" fill="${c.muzzle}"/>`;
  const nose = `<ellipse cx="${cx}" cy="${fy + 8}" rx="5.5" ry="4" fill="#2b2523"/><path d="M${cx} ${fy + 12} v4 M${cx - 6} ${fy + 17} Q${cx - 3} ${fy + 20} ${cx} ${fy + 16} Q${cx + 3} ${fy + 20} ${cx + 6} ${fy + 17}" stroke="#2b2523" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const tongue = c.marks === 'tongue' ? `<path d="M${cx - 4} ${fy + 18.5} h8 v5 a4 4 0 0 1 -8 0 Z" fill="${c.mark}"/>` : '';
  const collar = c.marks === 'collar' ? `<rect x="${l}" y="${H - 26}" width="${bw}" height="7" fill="${c.mark}"/><circle cx="${cx}" cy="${H - 15}" r="4.5" fill="#f0b429"/>` : '';
  return `<g>${body}${ears}${marks}${collar}${muzzle}${eyes(cx, fy, 12)}${nose}${tongue}</g>`;
}

// one paw print (our own drawing): a big pad and four toes, in the box's own color (currentColor); solid or outline
const PAW = '<path d="M50 50C36 50 24 62 20 76C17 87 25 94 35 92C41 91 45 88 50 88C55 88 59 91 65 92C75 94 83 87 80 76C76 62 64 50 50 50Z"/>'
  + '<ellipse cx="38" cy="24" rx="9" ry="12.5" transform="rotate(-8 38 24)"/><ellipse cx="62" cy="24" rx="9" ry="12.5" transform="rotate(8 62 24)"/>'
  + '<ellipse cx="17.5" cy="45" rx="8.5" ry="11.5" transform="rotate(-28 17.5 45)"/><ellipse cx="82.5" cy="45" rx="8.5" ry="11.5" transform="rotate(28 82.5 45)"/>';
// a cat's paw print (Leo 2026-11-04, "same as we did the dog paw"; our own drawing): a wider pad with three soft
// lobes along its bottom and four small round toes set close together in an arch
const CAT_PAW = '<path d="M50 52C65 52 79 61 80 72C81 82 74 88 66 86.5C62 85.8 59.5 83.5 57.5 81.5C55 88.5 45 88.5 42.5 81.5C40.5 83.5 38 85.8 34 86.5C26 88 19 82 20 72C21 61 35 52 50 52Z"/>'
  + '<ellipse cx="39.5" cy="30" rx="8.2" ry="9.8" transform="rotate(-6 39.5 30)"/><ellipse cx="60.5" cy="30" rx="8.2" ry="9.8" transform="rotate(6 60.5 30)"/>'
  + '<ellipse cx="22" cy="46" rx="7.8" ry="9.2" transform="rotate(-28 22 46)"/><ellipse cx="78" cy="46" rx="7.8" ry="9.2" transform="rotate(28 78 46)"/>';
// a trail of paw prints (Leo 2026-11-04: "it's only one paw stamp instead a trail like in the photo"): twelve prints in
// left / right steps winding up the box, each turned the way the trail goes. Our own layout; one picture the owner can
// move, size, turn and color like a single paw.
const TRAIL_STEPS = 12;
function trail(line, fit, kind) {
  const cat = kind === 'cat', shape = cat ? CAT_PAW : PAW, paint = line ? 'fill="none" stroke="currentColor" stroke-width="5"' : 'fill="currentColor"';
  const pts = [];
  for (let i = 0; i < TRAIL_STEPS; i++) {
    const t = i / (TRAIL_STEPS - 1), y = 560 - t * 510, x = 100 + 38 * Math.sin(t * Math.PI * 1.7);
    const dx = 38 * Math.PI * 1.7 * Math.cos(t * Math.PI * 1.7) / 510, ang = Math.atan2(dx, 1) * 180 / Math.PI;
    const side = i % 2 ? 1 : -1, off = 21, rad = ang * Math.PI / 180;
    const px = x + side * off * Math.cos(rad), py = y + side * off * Math.sin(rad);
    pts.push(`<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(.42) translate(-50 -55)">${shape}</g>`);
  }
  return `<svg class="sg-pets sg-paw sg-paw-trail${cat ? ' sg-paw-cat' : ''}" viewBox="0 0 200 600" preserveAspectRatio="${fit === 'stretch' ? 'none' : 'xMidYMid meet'}" role="img" aria-label="${cat ? 'A trail of cat paw prints' : 'A trail of paw prints'}"><g ${paint}>${pts.join('')}</g></svg>`;
}
function paw(line, fit, kind) {
  const paint = line ? 'fill="none" stroke="currentColor" stroke-width="3.2"' : 'fill="currentColor"';
  const cat = kind === 'cat';
  return `<svg class="sg-pets sg-paw${cat ? ' sg-paw-cat' : ''}" viewBox="0 0 100 100" preserveAspectRatio="${fit === 'stretch' ? 'none' : 'xMidYMid meet'}" role="img" aria-label="${cat ? 'A cat paw print' : 'A paw print'}"><g ${paint}>${cat ? CAT_PAW : PAW}</g></svg>`;
}

const KINDS = ['cats', 'dogs', 'mix'];
function svg(kind, fit) {
  const row = kind === 'dogs' ? DOGS.map((c, i) => dog(i * W, c)) : kind === 'mix' ? CATS.map((c, i) => (i % 2 ? dog(i * W, DOGS[i]) : cat(i * W, c))) : CATS.map((c, i) => cat(i * W, c));
  return `<svg class="sg-pets" viewBox="0 0 ${W * 9} ${H}" preserveAspectRatio="${fit === 'stretch' ? 'none' : 'xMidYMax meet'}" role="img" aria-label="${kind === 'dogs' ? 'A row of dogs' : kind === 'mix' ? 'A row of cats and dogs' : 'A row of cats'} peeking up">${row.join('')}</svg>`;
}

// one pet on its own (for the peeking row in motion): cats and dogs take turns along the row
function single(i) {
  const n = i % 9, g = i % 2 ? dog(0, DOGS[n]) : cat(0, CATS[n]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${g}</svg>`;
}

module.exports = { KINDS, svg, paw, trail, single };
