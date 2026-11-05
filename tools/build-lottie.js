// Draws SiteGen's own animated icons as Lottie JSON (no third-party animation files) and writes public/lottie/icons.js.
// Colours are placeholders (P = brand colour, A = accent) that sg-premium.js swaps for the site's theme colours at run time.
// Run: node tools/build-lottie.js
const fs = require('fs');
const path = require('path');

const P = [0.011, 0.022, 0.033, 1];   // placeholder for --primary
const A = [0.044, 0.055, 0.066, 1];   // placeholder for --accent
const W = [1, 1, 1, 1];
const FR = 30, OP = 60;

const stat = (k) => ({ a: 0, k });
const ease = (n) => ({ i: { x: Array(n).fill(0.5), y: Array(n).fill(1) }, o: { x: Array(n).fill(0.5), y: Array(n).fill(0) } });
// frames: [[t, value], ...]; value is a number or array
const anim = (frames) => {
  const n = Array.isArray(frames[0][1]) ? frames[0][1].length : 1;
  return { a: 1, k: frames.map((f, idx) => {
    const s = Array.isArray(f[1]) ? f[1] : [f[1]];
    return idx === frames.length - 1 ? { t: f[0], s } : { t: f[0], s, ...ease(n) };
  }) };
};
const rc = (cx, cy, w, h, r = 0) => ({ ty: 'rc', d: 1, s: stat([w, h]), p: stat([cx, cy]), r: stat(r) });
const el = (cx, cy, w, h) => ({ ty: 'el', d: 1, s: stat([w, h]), p: stat([cx, cy]) });
const poly = (pts, closed = true) => ({ ty: 'sh', ks: stat({ i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), v: pts, c: closed }) });
const fill = (c) => ({ ty: 'fl', c: stat(c), o: stat(100), r: 1 });
const stroke = (c, w) => ({ ty: 'st', c: stat(c), o: stat(100), w: stat(w), lc: 2, lj: 2 });
const grp = (items, nm = 'g') => ({ ty: 'gr', nm, it: [...items, { ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100), sk: stat(0), sa: stat(0) }] });
// a layer pivoting around (px, py); props: r (rotation frames), s (scale frames), p (position frames), o (opacity frames)
let ind = 0;
const layer = (shapes, { pivot = [50, 50], r, s, p, o } = {}) => ({
  ddd: 0, ind: ++ind, ty: 4, nm: 'l' + ind, sr: 1, ip: 0, op: OP, st: 0, bm: 0,
  ks: {
    o: o ? anim(o) : stat(100), r: r ? anim(r) : stat(0),
    p: p ? anim(p) : stat([pivot[0], pivot[1], 0]), a: stat([pivot[0], pivot[1], 0]),
    s: s ? anim(s) : stat([100, 100, 100])
  },
  shapes: [grp(shapes)]
});
// loop helpers over 60 frames
const swing = (a, b) => [[0, a], [30, b], [60, a]];
const pulse = (a = 100, b = 110) => [[0, [a, a, 100]], [15, [b, b, 100]], [30, [a, a, 100]], [45, [b, b, 100]], [60, [a, a, 100]]];
const bob = (x, y, d) => [[0, [x, y, 0]], [30, [x, y - d, 0]], [60, [x, y, 0]]];
const star = (cx, cy, R, r) => {
  const pts = [];
  for (let i = 0; i < 8; i++) { const ang = -Math.PI / 2 + i * Math.PI / 4, rad = i % 2 ? r : R; pts.push([+(cx + Math.cos(ang) * rad).toFixed(2), +(cy + Math.sin(ang) * rad).toFixed(2)]); }
  return poly(pts);
};

const ICONS = {
  home: () => [
    layer([rc(50, 68, 56, 36, 3), fill(P)], { pivot: [50, 68] , s: pulse(100, 104) }),
    layer([poly([[12, 52], [50, 20], [88, 52]]), fill(A), poly([[12, 52], [50, 20], [88, 52]], false), stroke(A, 4)], { pivot: [50, 34], p: bob(50, 34, 3) }),
    layer([rc(50, 77, 14, 20, 2), fill(W)], { pivot: [50, 77] })
  ],
  heart: () => [
    layer([el(35, 40, 32, 32), fill(A), el(65, 40, 32, 32), fill(A), poly([[20, 46], [80, 46], [50, 84]]), fill(A)], { pivot: [50, 55], s: pulse(100, 114) })
  ],
  bowl: () => [
    layer([poly([[16, 52], [84, 52], [72, 80], [28, 80]]), fill(P), poly([[16, 52], [84, 52], [72, 80], [28, 80]]), stroke(P, 6)], { pivot: [50, 66] }),
    layer([rc(50, 52, 78, 6, 3), fill(A)], { pivot: [50, 52] }),
    layer([rc(50, 87, 30, 6, 3), fill(A)], { pivot: [50, 87] }),
    ...[38, 50, 62].map((x, k) => layer([el(x, 0, 7, 12), fill(A)], {
      pivot: [x, 0], p: [[(k * 12) % 60, [x, 44, 0]], [((k * 12) % 60) + 1, [x, 44, 0]], [60, [x, 20, 0]]].filter((f, i, a) => !(i === 1 && f[0] >= 60)),
      o: [[0, 0], [10, 70], [45, 40], [60, 0]]
    }))
  ],
  cutlery: () => [
    layer([rc(24, 30, 4, 22, 2), fill(P), rc(32, 30, 4, 22, 2), fill(P), rc(40, 30, 4, 22, 2), fill(P), rc(32, 44, 20, 8, 3), fill(P), rc(32, 70, 7, 40, 3), fill(P)], { pivot: [32, 62], r: swing(-6, 6) }),
    layer([rc(68, 38, 11, 42, 5), fill(A), rc(68, 76, 8, 34, 3), fill(A)], { pivot: [68, 62], r: swing(6, -6) })
  ],
  key: () => [
    layer([el(30, 50, 30, 30), stroke(P, 8), rc(66, 50, 42, 8, 3), fill(P), rc(74, 59, 6, 12, 2), fill(P), rc(85, 59, 6, 12, 2), fill(P)], { pivot: [50, 50], r: [[0, -48], [30, -36], [60, -48]] })
  ],
  hammer: () => [
    layer([rc(50, 62, 9, 50, 3), fill(A), rc(50, 28, 44, 18, 4), fill(P)], { pivot: [50, 86], r: [[0, 0], [20, -28], [30, 6], [40, 0], [60, 0]] })
  ],
  wrench: () => [
    layer([rc(38, 24, 10, 28, 3), fill(P), rc(62, 24, 10, 28, 3), fill(P), rc(50, 38, 34, 10, 3), fill(P), rc(50, 68, 12, 44, 6), fill(A)], { pivot: [50, 60], r: swing(-14, 14) })
  ],
  scissors: () => [
    layer([rc(50, 32, 8, 50, 4), fill(P), poly([[50, 58], [33, 78]], false), stroke(P, 5), el(33, 85, 17, 17), stroke(A, 5)], { pivot: [50, 58], r: swing(-20, -5) }),
    layer([rc(50, 32, 8, 50, 4), fill(P), poly([[50, 58], [67, 78]], false), stroke(P, 5), el(67, 85, 17, 17), stroke(A, 5)], { pivot: [50, 58], r: swing(20, 5) })
  ],
  sparkle: () => [
    layer([star(50, 48, 36, 8), fill(P)], { pivot: [50, 48], r: [[0, 0], [60, 90]], s: pulse(100, 112) }),
    layer([star(80, 20, 11, 3), fill(A)], { pivot: [80, 20], s: [[0, [60, 60, 100]], [20, [115, 115, 100]], [40, [60, 60, 100]], [60, [60, 60, 100]]] }),
    layer([star(22, 78, 9, 2.5), fill(A)], { pivot: [22, 78], s: [[0, [100, 100, 100]], [30, [55, 55, 100]], [60, [100, 100, 100]]] })
  ],
  scales: () => [
    layer([rc(50, 88, 38, 7, 3), fill(P), rc(50, 56, 6, 64, 3), fill(P)], { pivot: [50, 56] }),
    layer([rc(50, 22, 70, 6, 3), fill(P),
      poly([[16, 24], [8, 54]], false), stroke(A, 2.5), poly([[16, 24], [28, 54]], false), stroke(A, 2.5), poly([[6, 54], [30, 54], [24, 65], [12, 65]]), fill(A),
      poly([[84, 24], [72, 54]], false), stroke(A, 2.5), poly([[84, 24], [92, 54]], false), stroke(A, 2.5), poly([[70, 54], [94, 54], [88, 65], [76, 65]]), fill(A)
    ], { pivot: [50, 22], r: swing(-5, 5) })
  ]
};

const out = {};
for (const [name, build] of Object.entries(ICONS)) {
  ind = 0;
  const layers = build().reverse();   // lottie draws the first layer on top
  out[name] = { v: '5.7.0', fr: FR, ip: 0, op: OP, w: 100, h: 100, nm: name, ddd: 0, assets: [], layers };
}
const dir = path.join(__dirname, '..', 'public', 'lottie');
fs.mkdirSync(dir, { recursive: true });
const body = '/* SiteGen original animated icons (Lottie JSON), drawn in tools/build-lottie.js. Colours are placeholders recoloured by sg-premium.js. */\nwindow.SG_LOTTIE=' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(dir, 'icons.js'), body);
console.log('icons:', Object.keys(out).length, 'bytes:', body.length);
