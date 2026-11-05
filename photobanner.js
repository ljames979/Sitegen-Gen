// "Photo banner" block: a rounded photo card set into the page, with the heading, a few words and a pill button on a
// soft brand-tinted fade from one side (the same fade as the blended photo hero, so white words stay readable on any
// photo). [Bracketed] words in the heading turn to an italic serif. Without a photo of its own it uses the hero photo.
// The owner picks the side the words sit on, the height and the button color; the block can go on any page.
const scrimHero = require('./scrimhero');
const content = require('./library/content');
const contrast = require('./contrast');

const SIDES = ['left', 'right'];
const SIZES = { short: 420, medium: 560, tall: 700 };   // px, the least height of the card on a computer
const BUTTONS = ['brand', 'accent', 'lime'];
const DEFAULT = 'left:medium:brand';
const SIDE = new RegExp(`^(${SIDES.join('|')}):(${Object.keys(SIZES).join('|')}):(${BUTTONS.join('|')})$`);

// The block's "side" field holds the three choices as side:size:button
function cleanSide(v) {
  return SIDE.test(String(v || '')) ? String(v) : DEFAULT;
}
function settings(side) {
  const [text, size, button] = cleanSide(side).split(':');
  return { text, size, button, height: SIZES[size] };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
// The fade's brand-tinted dark color (scrimhero.js) and the button's colors, as CSS custom properties
function styleVars(theme, button) {
  const t = theme || {};
  const c = button === 'accent' ? t.accentColor : button === 'lime' ? '#d4f57a' : t.primaryColor;
  const bg = HEX.test(c || '') ? c : '#2563eb';
  return `${scrimHero.styleVars(scrimHero.colors(t))}; --pb-btn: ${bg}; --pb-btn-ink: ${contrast.textOn(bg)}`;
}

// What the card shows; null when there is nothing to show
function view(site, blk) {
  const b = blk || {};
  if (!String(b.heading || '').trim()) return null;
  const s = settings(b.side);
  const hero = ((site && site.sections) || {}).hero || {};
  return {
    ...s,
    headingHtml: content.hlHtml(b.heading),
    paras: String(b.body || '').split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean).slice(0, 3),
    image: b.imageUrl || hero.imageUrl || '',
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null,
    vars: styleVars(site && site.theme, s.button),
  };
}

module.exports = { SIDES, SIZES, BUTTONS, DEFAULT, cleanSide, settings, styleVars, view };
