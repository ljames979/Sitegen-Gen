// Glass panel (Leo, 2026-10-28): a section's words and cards sit on a pane of glass over the section's own background
// (best over a photo or gradient). Frosted, clear and smoked blur what is behind; liquid also bends it at the edges
// like Apple's liquid glass, in browsers that can (Chrome and Edge), and is frosted glass everywhere else.
// Visitors who ask for less see-through (or browsers with no blur) get a near-solid pane, so text always reads.
const OPTIONS = [
  ['', 'No glass'],
  ['frost', 'Frosted glass (soft blur, light tint)'],
  ['clear', 'Clear glass (strong blur, barely tinted)'],
  ['smoke', 'Smoked glass (dark tint, light text)'],
  ['liquid', 'Liquid glass (bends what is behind it)'],
];
const IDS = OPTIONS.map(o => o[0]);
const clean = (v) => (IDS.includes(v) ? v : '');
const attrs = (v) => (clean(v) ? { cls: ` sg-glass sg-glass-${clean(v)}` } : { cls: '' });

// the box that holds a section's content, in each kind of section the Blocks page shows
const INNER = ':is(.sg-lib > div > div:first-child, section.blk > div:first-child, .sl-sec > section > div:first-child, .sg-mix-at > div > section > div:first-child)';
const PANE = '.sg-glass ' + INNER;
const CSS = [
  `${PANE} { position: relative; border-radius: clamp(18px, 2.4vw, 32px); border: 1px solid rgba(255,255,255,.38); margin-top: clamp(12px, 2vw, 24px); margin-bottom: clamp(12px, 2vw, 24px);`,
  '  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(255,255,255,.12), 0 18px 50px rgba(0,0,0,.16); -webkit-backdrop-filter: blur(16px) saturate(170%); backdrop-filter: blur(16px) saturate(170%); }',
  `.sg-glass-frost ${INNER} { background: linear-gradient(135deg, rgba(255,255,255,.42), rgba(255,255,255,.2)); }`,
  `.sg-glass-clear ${INNER} { background: rgba(255,255,255,.08); -webkit-backdrop-filter: blur(26px) saturate(190%); backdrop-filter: blur(26px) saturate(190%); }`,
  `.sg-glass-smoke ${INNER} { background: linear-gradient(135deg, rgba(16,20,28,.58), rgba(16,20,28,.4)); border-color: rgba(255,255,255,.18); color: #fff; --ink: #fff; --muted: rgba(255,255,255,.82); }`,
  `.sg-glass-smoke ${INNER} :is(h1, h2, h3, h4, p, li, strong, span) { color: inherit; }`,
  // liquid: a shine across the pane and bright rims; the bending is added where the browser can draw it
  `.sg-glass-liquid ${INNER} { background: linear-gradient(120deg, rgba(255,255,255,.34), rgba(255,255,255,.08) 38%, rgba(255,255,255,.16) 70%, rgba(255,255,255,.3)); border-color: rgba(255,255,255,.5);`,
  '  box-shadow: inset 2px 2px 1px rgba(255,255,255,.65), inset -2px -2px 1px rgba(255,255,255,.22), inset 0 0 24px rgba(255,255,255,.18), 0 22px 60px rgba(0,0,0,.18); }',
  `.sg-lq-ok .sg-glass-liquid ${INNER} { -webkit-backdrop-filter: url(#sg-lq) blur(6px) saturate(180%); backdrop-filter: url(#sg-lq) blur(6px) saturate(180%); }`,
  // no blur available, or the visitor asked for less see-through: a near-solid pane
  `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { ${PANE} { background: rgba(255,255,255,.88); } .sg-glass-smoke ${INNER} { background: rgba(16,20,28,.9); } }`,
  `@media (prefers-reduced-transparency: reduce) { ${PANE} { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; background: rgba(255,255,255,.92) !important; } .sg-glass-smoke ${INNER} { background: rgba(16,20,28,.92) !important; } }`,
].join('\n');

// The bending: an SVG filter of soft noise that pushes the backdrop around (Chromium draws SVG filters in backdrop-filter)
const SCRIPT = "(function(){if(!document.querySelector('.sg-glass-liquid')||!(navigator.userAgentData&&navigator.userAgentData.brands&&navigator.userAgentData.brands.some(function(b){return /Chrom/.test(b.brand)})))return;" +
  "var d=document.createElement('div');d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';" +
  "d.innerHTML='<svg width=\"0\" height=\"0\"><filter id=\"sg-lq\" x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" color-interpolation-filters=\"sRGB\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.006 0.009\" numOctaves=\"2\" seed=\"5\" result=\"n\"/><feGaussianBlur in=\"n\" stdDeviation=\"3\" result=\"s\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"s\" scale=\"42\" xChannelSelector=\"R\" yChannelSelector=\"G\"/></filter></svg>';" +
  "document.body.appendChild(d);document.documentElement.classList.add('sg-lq-ok')})();";

module.exports = { OPTIONS, IDS, clean, attrs, PANE, CSS, SCRIPT };
