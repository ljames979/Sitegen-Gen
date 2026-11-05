// Look and feel extras: page transitions, the texture pack (grain, glass header, soft shadows, card-stack
// sections), visitor dark mode and hero stickers. Everything here is opt-in from the editor's Design tab and
// turns itself off for people who ask for less motion.
const contrast = require('./contrast');

const TRANSITIONS = ['', 'fade', 'slide', 'morph'];
const TEXTURES = ['grain', 'glassNav', 'softShadows', 'cardStack'];
const DARK = ['', 'toggle', 'auto'];

const on = v => v === '1' || v === 'on' || v === true;
function parse(b) {
  return {
    pageTransition: TRANSITIONS.includes(b.theme_pageTransition) ? b.theme_pageTransition : '',
    grain: on(b.theme_grain),
    glassNav: on(b.theme_glassNav),
    hideMenu: on(b.theme_hideMenu),
    softShadows: on(b.theme_softShadows),
    cardStack: on(b.theme_cardStack),
    darkMode: DARK.includes(b.theme_darkMode) ? b.theme_darkMode : '',
  };
}

// Body classes for the texture pack and the transition style
function bodyClasses(theme) {
  const t = theme || {};
  return [t.grain && 'lf-grain', t.glassNav && 'lf-glass', t.softShadows && 'lf-soft', t.cardStack && 'lf-stack', t.pageTransition && 'pt-' + t.pageTransition]
    .filter(Boolean).map(c => ' ' + c).join('');
}

// Mix two hex colors (w = share of b)
const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };

// A dark palette built from the brand: near-black page tinted with the brand, slightly lighter surfaces, light text,
// and a brand color lifted until it reads on the dark page (4.5:1 for links and headings in the brand color).
function darkPalette(primary, accent) {
  const p = contrast.parseHex(primary) ? primary : '#2563eb';
  const page = mix('#0b0e14', p, 0.08), surface = mix('#151a23', p, 0.10), border = mix('#2a3140', p, 0.12);
  const ink = '#e9edf3', muted = '#a9b2c1';
  const brandText = contrast.ensureContrast(p, surface, 4.5);
  const v = { '--lf-deep': mix('#05070a', p, 0.05), '--page-bg': page, '--surface': surface, '--border': border, '--ink': ink, '--muted': muted, '--brand-text': brandText,
    '--primary-ink': brandText, '--sg-heading': ink, '--shadow-sm': '0 1px 2px rgba(0,0,0,.5)', '--shadow-md': '0 12px 30px rgba(0,0,0,.55)' };
  // checks the editor and tests rely on
  v._ok = contrast.ratio(ink, page) >= 7 && contrast.ratio(muted, surface) >= 4.5 && contrast.ratio(brandText, surface) >= 4.5;
  return v;
}

// Styles that are already dark do not get a second dark mode
function isDarkStyle(style, extraTheme) {
  if (style === 'midnight' || (extraTheme && extraTheme.dark)) return true;
  const bg = extraTheme && extraTheme.vars && extraTheme.vars['--page-bg'];
  return !!(bg && contrast.luminance(bg) != null && contrast.luminance(bg) < 0.2);
}

// Up to three short phrases the owner typed for the hero ("Family owned", "Since 1998"); never filled in for them
function cleanStickers(list) {
  return [].concat(list || []).map(s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 28)).filter(Boolean).slice(0, 3);
}

module.exports = { textOn: contrast.textOn, TRANSITIONS, TEXTURES, DARK, parse, bodyClasses, darkPalette, isDarkStyle, cleanStickers };
