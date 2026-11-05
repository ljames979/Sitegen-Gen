// "Image + Scrim" (cosmic) hero: a full photo (or a gradient night sky when there is none) with a dark scrim on the
// text side, a gradient headline, a glowing button and optional glass feature cards. Colors come from the site's
// theme and are checked with contrast.js, so the words stay readable on any photo, in every style.
const contrast = require('./contrast');

const STRENGTHS = { light: 0, medium: 0.12, heavy: 0.24 };   // added on top of the readable minimum
const LAYOUTS = ['full', 'boxed'];
const DESIGNS = ['', 'auto', 'scrim', 'showcase', 'scroll', 'shapes', 'blend'];  // '' = the classic hero, 'auto' = pick by industry, 'showcase' = the Showcase strip hero, 'scroll' = Scroll-through photos, 'shapes' = Floating 3D shapes, 'blend' = Photo with the header blended in
// Industries it suits by default: tech, education, creative and events
const FIT_TEMPLATES = ['it-repair', 'tutoring', 'photography', 'wedding', 'party-rental'];
const FIT_WORDS = /\b(tech|technology|software|saas|app|apps|web|website|digital|computer|it support|cyber|data|ai|startup|school|tutor|tutoring|education|academy|lessons?|courses?|training|coach|coaching|learning|design|designer|studio|creative|agency|art|artist|music|musician|band|photo|photography|photographer|film|video|media|event|events|wedding|weddings|party|parties|dj|festival|venue|concert|planner)\b/i;

const HEX = /^#[0-9a-f]{6}$/i;
const mix = (a, b, t) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * t)); };

function fits(businessType, templateId) {
  return FIT_TEMPLATES.includes(templateId) || FIT_WORDS.test(String(businessType || ''));
}

// Which hero the home page shows: 'scrim', 'showcase', 'scroll' or 'classic'
function resolve(hero, businessType, templateId) {
  const h = hero || {};
  if (h.design === 'scrim') return 'scrim';
  if (h.design === 'showcase') return 'showcase';
  if (h.design === 'scroll') return 'scroll';
  if (h.design === 'shapes') return 'shapes';
  if (h.design === 'blend') return 'blend';
  if (h.design === 'auto') {
    // a video or a photo slideshow is a deliberate choice, so "automatic" keeps the classic hero for those
    if (h.videoUrl || (h.slides || []).filter(Boolean).length) return 'classic';
    return fits(businessType, templateId) ? 'scrim' : 'classic';
  }
  return 'classic';
}

// The scrim, text and accent colors. The scrim is the theme's accent pushed very dark; its opacity on the text side
// starts at the least that keeps white body text at 4.5:1 even over a pure white photo, then the strength adds more.
function colors(theme, strength) {
  const t = theme || {};
  const primary = HEX.test(t.primaryColor || '') ? t.primaryColor : '#2563eb';
  const accent = HEX.test(t.accentColor || '') ? t.accentColor : '#1e293b';
  // a deep night color with a hint of the accent's hue, however light the accent is
  let scrim = mix(accent, '#04050c', 0.72);
  while (contrast.luminance(scrim) > 0.012) scrim = mix(scrim, '#04050c', 0.3);
  let floor = 0.3;
  while (floor < 0.95 && contrast.ratio('#ffffff', mix('#ffffff', scrim, floor)) < contrast.AA_TEXT) floor += 0.01;
  const alpha = Math.min(0.94, +(floor + (STRENGTHS[strength] ?? STRENGTHS.medium)).toFixed(2));
  const worst = mix('#ffffff', scrim, alpha);                  // the lightest the text side can ever be
  // gradient headline: two light tints of the brand colors, each readable on that worst case
  const g1 = contrast.ensureContrast(mix(primary, '#ffffff', 0.55), worst, contrast.AA_TEXT);
  const g2 = contrast.ensureContrast(mix(accent === primary ? '#ffffff' : primary, '#ffffff', 0.15), worst, contrast.AA_LARGE + 0.5);
  // the button: brand color with its own readable label, and a glow in the same color
  const ctaText = contrast.textOn(primary);
  return {
    scrim, alpha, floor: +floor.toFixed(2), worst, ratio: +contrast.ratio('#ffffff', worst).toFixed(2),
    grad1: g1, grad2: g2, cta: primary, ctaText, glow: primary,
    // fallback sky when there is no photo: deep accent into a hint of the brand color
    sky1: mix(scrim, '#000000', 0.3), sky2: mix(primary, '#04050c', 0.6)
  };
}

const rgb = (hex) => contrast.parseHex(hex).join(', ');

// Everything the template needs, as CSS custom properties (one style attribute)
function styleVars(c) {
  return [`--sc-rgb: ${rgb(c.scrim)}`, `--sc-a: ${c.alpha}`, `--sc-floor: ${c.floor}`, `--sc-g1: ${c.grad1}`, `--sc-g2: ${c.grad2}`,
    `--sc-cta: ${c.cta}`, `--sc-cta-ink: ${c.ctaText}`, `--sc-glow: ${rgb(c.glow)}`, `--sc-sky1: ${c.sky1}`, `--sc-sky2: ${c.sky2}`].join('; ');
}

function clean(hero) {
  const h = hero || {};
  return {
    design: DESIGNS.includes(h.design) ? h.design : '',
    scrim: Object.prototype.hasOwnProperty.call(STRENGTHS, h.scrim) ? h.scrim : 'medium',
    scrimLayout: LAYOUTS.includes(h.scrimLayout) ? h.scrimLayout : 'full'
  };
}

module.exports = { STRENGTHS, LAYOUTS, DESIGNS, FIT_TEMPLATES, fits, resolve, colors, styleVars, clean };
