// Header color: the top menu bar can keep the style's own look, or take white, dark, the brand or accent color, a
// color of the owner's choice, or be clear (no bar: the page shows through, and it turns the page's own color once
// the visitor scrolls so the menu stays readable over the content). The menu, the name and the button take a color
// that reads on the bar (4.5:1). Over a hero photo with a see-through header the bar stays clear at the top either way.
const contrast = require('./contrast');

const MODES = [
  { id: '', label: 'As the style shows it' },
  { id: 'white', label: 'White' },
  { id: 'dark', label: 'Dark' },
  { id: 'brand', label: 'Brand color (Primary)' },
  { id: 'accent', label: 'Accent color' },
  { id: 'custom', label: 'A color of your choice' },
  { id: 'clear', label: 'Clear (no bar, the page shows through)' },
];
const MODE_IDS = MODES.map(m => m.id);
const HEX = /^#[0-9a-fA-F]{6}$/;
const DARK = '#111827';

function parse(b) {
  const c = String(b.theme_headerColor || '').trim();
  return {
    headerBg: MODE_IDS.includes(b.theme_headerBg) ? b.theme_headerBg : '',
    headerColor: HEX.test(c) ? c.toLowerCase() : '',
  };
}

// The bar's own color for the solid choices ('' for the style's own look and for clear)
function barColor(theme) {
  const t = theme || {};
  const primary = HEX.test(t.primaryColor || '') ? t.primaryColor : '#2563eb';
  switch (t.headerBg) {
    case 'white': return '#ffffff';
    case 'dark': return DARK;
    case 'brand': return primary.toLowerCase();
    case 'accent': return (HEX.test(t.accentColor || '') ? t.accentColor : DARK).toLowerCase();
    case 'custom': return (HEX.test(t.headerColor || '') ? t.headerColor : primary).toLowerCase();
    default: return '';
  }
}

function bodyClasses(theme) {
  const t = theme || {};
  return t.headerBg ? ` hdrc hdrc-${t.headerBg}` : '';
}

// The CSS, as one string for the page's <style>. The nav's id keeps it ahead of each style's own header colors; the
// see-through header over a hero photo keeps its clear top (these rules only reach it once the visitor scrolls).
function css(theme) {
  const t = theme || {};
  if (!t.headerBg) return '';
  const nav = ['body.hdrc:not(.hdr-transparent) nav#siteNav', 'body.hdrc.hdr-transparent nav#siteNav.scrolled'];
  const sel = suffix => nav.map(s => s + suffix).join(', ');
  if (t.headerBg === 'clear') {
    return [
      `body.hdrc-clear:not(.hdr-transparent) nav#siteNav:not(.scrolled) { background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; border-bottom-color: transparent; }`,
      `body.hdrc-clear nav#siteNav.scrolled { background: var(--page-bg); -webkit-backdrop-filter: none; backdrop-filter: none; }`,
    ].join('\n');
  }
  const bg = barColor(t);
  const ink = contrast.textOn(bg);
  const primary = HEX.test(t.primaryColor || '') ? t.primaryColor : '#2563eb';
  const rules = [
    `${sel('')} { background: ${bg}; -webkit-backdrop-filter: none; backdrop-filter: none; border-bottom-color: transparent; }`,
    `${sel(' .links a:not(.nav-cta)')} { color: ${ink}; opacity: 1; text-shadow: none; }`,
    // the name keeps the brand color when it reads well on the bar (white, dark), otherwise it takes the bar's text color
    `${sel(' .brand')} { color: ${contrast.ratio(primary, bg) >= contrast.AA_TEXT ? primary : ink}; opacity: 1; text-shadow: none; }`,
    `${sel(' .links a:not(.nav-cta):hover')}, ${sel(' .links a.active:not(.nav-cta)')} { color: ${ink}; text-decoration: underline; text-underline-offset: 5px; }`,
  ];
  // a button the same color as the bar would vanish: it takes the bar's text color instead
  if (contrast.ratio(primary, bg) < 3) rules.push(`${sel(' .nav-cta')}, ${sel(' .links a.nav-cta')} { background: ${ink}; color: ${bg}; }`);
  return rules.join('\n');
}

module.exports = { MODES, MODE_IDS, parse, barColor, bodyClasses, css };
