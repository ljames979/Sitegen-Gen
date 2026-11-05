// Video mask: a video block's video (a direct .mp4 / .webm file) plays inside a shape instead of a plain box:
//   text    the video shows through the block's heading, in huge letters, on a solid band
//   circle | arch | blob | diamond   the video plays inside that shape
//   grow    layered: it starts as a small rounded window and opens to the full width as the visitor scrolls past
// It plays muted, on a loop, without controls (a mask is a picture, not a player); a visitor whose device asks for
// less motion sees it paused on its first frame. YouTube and Vimeo videos can't be masked (their player is a frame
// from another site), so they stay as a plain player.
const LOOKS = [
  ['auto', 'Plain video player'],
  ['text', 'Video plays through the heading\'s letters'],
  ['circle', 'Video in a circle'],
  ['arch', 'Video in an arch'],
  ['blob', 'Video in a soft blob'],
  ['diamond', 'Video in a diamond'],
  ['grow', 'Video opens from a small window to full width as you scroll'],
];
const IDS = LOOKS.map(l => l[0]);
const clean = (v) => (IDS.includes(v) ? v : 'auto');
const masked = (v) => clean(v) !== 'auto';

const SHAPES = {
  circle: 'circle(50% at 50% 50%)',
  arch: 'inset(0 round 50% 50% 0 0 / 38% 38% 0 0)',
  blob: 'url(#sgBlob)',
  diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
};

const CSS = [
  '.vm{position:relative;margin:0 auto}',
  // the heading stays for screen readers when the letters show it
  '.vm-sr{position:absolute !important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
  '.vm video{display:block;width:100%;height:100%;object-fit:cover}',
  '.vm-shape{width:min(100%,560px);aspect-ratio:1}',
  '.vm-arch{aspect-ratio:4/5;width:min(100%,460px)}',
  // text: the video under a band of the page color, with the letters cut out of the band (mix-blend screen does the cut)
  '.vm-text{width:100%;overflow:hidden;border-radius:var(--radius,16px)}',
  '.vm-text video{position:absolute;inset:0}',
  '.vm-text .vm-words{position:relative;margin:0;padding:.08em .2em;background:#fff;color:#000;mix-blend-mode:screen;font-family:var(--heading-font,inherit);font-weight:900;font-size:clamp(56px,13vw,200px);line-height:.95;text-align:center;text-transform:uppercase;letter-spacing:-.02em;overflow-wrap:anywhere}',
  // grow: the window's size follows the scroll (the script sets --vm-k from 0 to 1)
  '.vm-grow{width:100%;height:min(80vh,720px);display:flex;align-items:center;justify-content:center}',
  '.vm-grow video{width:calc(42% + 58% * var(--vm-k,0));height:calc(50% + 50% * var(--vm-k,0));border-radius:calc(28px * (1 - var(--vm-k,0)) + 4px);transition:none}',
].join('\n');

// the scroll script for "grow" and the paused frame for reduced motion; '' when nothing needs it
const SCRIPT = `(function () {
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.vm video').forEach(function (v) { if (calm) { v.removeAttribute('autoplay'); v.pause(); } else { var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
  var grows = document.querySelectorAll('.vm-grow'); if (!grows.length) return;
  function frame() {
    grows.forEach(function (g) {
      var r = g.getBoundingClientRect(), k = calm ? 1 : Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.9)));
      g.style.setProperty('--vm-k', k.toFixed(3));
    });
  }
  (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); })(frame); frame();
})();`;

// the soft blob, as a clip path the "blob" shape points at
const BLOB_SVG = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><clipPath id="sgBlob" clipPathUnits="objectBoundingBox"><path d="M.79.12C.92.21 1 .38.98.55.96.73.84.9.67.97.49 1.04.27.99.13.86 0 .73-.03.52.05.35.13.17.31.06.48.03.59.01.69.05.79.12Z"/></clipPath></svg>';

module.exports = { LOOKS, IDS, clean, masked, SHAPES, CSS, SCRIPT, BLOB_SVG };
