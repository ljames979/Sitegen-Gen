// Motion extras (batch 3 of the design tools): motion personality per style, button micro-interactions, kinetic
// headlines, scroll-driven reveals, highlighter marks, photo hovers, stacking cards, a rotating headline word,
// Ken Burns slideshow, success moments, area chips that pop in and a hero spotlight. Pages carry body classes and
// data attributes; the CSS is views/_motionfx-head.ejs and the small script is public/sg-fx.js. Visitors who ask
// for reduced motion always get a still, complete page.

// How each style moves when the owner leaves "Motion personality" on Automatic.
// glide: slow and smooth, bounce: springy overshoot, snap: quick and precise, '' = the motion style as it was.
const FEELS = [
  { id: 'glide', label: 'Glide', hint: 'Slow, smooth arrivals. Calm and premium.' },
  { id: 'bounce', label: 'Bounce', hint: 'Springy, playful overshoot.' },
  { id: 'snap', label: 'Snap', hint: 'Quick and precise, like machinery.' },
  { id: 'standard', label: 'Standard', hint: 'The plain motion style, no personality.' },
];
const FEEL_IDS = FEELS.map(f => f.id);
const BY_STYLE = {
  luxury: 'glide', japandi: 'glide', wellness: 'glide', luxe: 'glide', journal: 'glide', noir: 'glide', organic: 'glide', coastal: 'glide', blush: 'glide', editorial: 'glide',
  popstudio: 'bounce', energetic: 'bounce', playful: 'bounce', cafe: 'bounce', poster: 'bounce', terracota: 'bounce',
  workbench: 'snap', flatcorp: 'snap', corporate: 'snap', agency: 'snap', barbershop: 'snap', inclusive: 'snap', studio: 'snap',
};
// numbers the motion scripts read: k = duration multiplier, ease = cubic-bezier, dist = travel multiplier
const FEEL_TUNE = {
  glide: { k: 1.4, ease: [0.16, 1, 0.3, 1], dist: 1.25 },
  bounce: { k: 1.05, ease: [0.34, 1.56, 0.64, 1], dist: 1.1 },
  snap: { k: 0.6, ease: [0.8, 0, 0.2, 1], dist: 0.7 },
  standard: null,
};

const HEADLINE_FX = ['', 'weight', 'width', 'settle'];
const PHOTO_FX = ['', 'tilt', 'color', 'zoom'];
const BUTTON_FX = ['shine', 'nudge', 'press', 'magnetic'];

const on = v => v === '1' || v === 'on' || v === true;
const num = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

function parse(b) {
  return {
    motionFeel: FEEL_IDS.includes(b.theme_motionFeel) ? b.theme_motionFeel : '',
    motionSpeed: num(b.theme_motionSpeed, 50, 150, 100),
    motionBounce: b.theme_motionBounce === '' || b.theme_motionBounce == null ? '' : num(b.theme_motionBounce, 0, 100, 0),
    buttonFx: BUTTON_FX.filter(k => on(b['theme_btnFx_' + k])),
    headlineFx: HEADLINE_FX.includes(b.theme_headlineFx) ? b.theme_headlineFx : '',
    scrollFx: on(b.theme_scrollFx),
    highlightCircle: on(b.theme_highlightCircle),
    photoFx: PHOTO_FX.includes(b.theme_photoFx) ? b.theme_photoFx : '',
    kenBurns: on(b.theme_kenBurns),
    successFx: b.theme_successFx === '0' ? false : true,
    confetti: on(b.theme_confetti),
    areaPop: on(b.theme_areaPop),
    spotlight: on(b.theme_spotlight),
    inkFx: on(b.theme_inkFx),
    floatTags: on(b.theme_floatTags),
  };
}

// The personality a site actually uses
function feelOf(theme) {
  const t = theme || {};
  if (FEEL_IDS.includes(t.motionFeel)) return t.motionFeel === 'standard' ? '' : t.motionFeel;
  return BY_STYLE[t.style] || '';
}

// Numbers handed to the motion scripts (data-mtune on <body>): duration multiplier, easing and travel
function tune(theme) {
  const t = theme || {};
  const f = FEEL_TUNE[feelOf(t)] || { k: 1, ease: null, dist: 1 };
  const speed = Number.isFinite(+t.motionSpeed) && +t.motionSpeed ? Math.max(50, Math.min(150, +t.motionSpeed)) : 100;
  let ease = f.ease;
  // the bounciness slider overrides the overshoot of the curve (0 = none, 100 = very springy)
  if (t.motionBounce !== '' && t.motionBounce != null && Number.isFinite(+t.motionBounce)) {
    const b = Math.max(0, Math.min(100, +t.motionBounce)) / 100;
    ease = [0.34, +(1 + b * 0.9).toFixed(2), 0.64, 1];
  }
  return { k: +(f.k * 100 / speed).toFixed(3), ease, dist: f.dist };
}
const easeCss = e => (e ? `cubic-bezier(${e.join(',')})` : 'cubic-bezier(.25,.1,.25,1)');

function bodyClasses(theme) {
  const t = theme || {};
  const c = [];
  (t.buttonFx || []).forEach(k => { if (BUTTON_FX.includes(k)) c.push('bfx-' + k); });
  if (t.headlineFx) c.push('kx-' + t.headlineFx);
  if (t.scrollFx) c.push('fx-scroll');
  if (t.highlightCircle) c.push('fx-circle');
  if (t.photoFx) c.push('pfx-' + t.photoFx);
  if (t.kenBurns) c.push('fx-kenburns');
  if (t.successFx !== false) c.push('fx-success');
  if (t.areaPop) c.push('fx-areas');
  if (t.spotlight) c.push('fx-spot');
  if (t.inkFx) c.push('fx-ink');
  if (t.floatTags) c.push('fx-tags');
  const f = feelOf(t); if (f) c.push('mfeel-' + f);
  return c.map(x => ' ' + x).join('');
}

// Rotating headline word: the words come only from the client's own service names
function rotateWords(services) {
  return (services || []).map(s => String((s && s.title) || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
}

module.exports = { FEELS, FEEL_IDS, BY_STYLE, FEEL_TUNE, HEADLINE_FX, PHOTO_FX, BUTTON_FX, parse, feelOf, tune, easeCss, bodyClasses, rotateWords };
