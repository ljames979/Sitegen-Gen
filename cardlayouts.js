// Card arrangements and footer designs.
// Card arrangements re-lay the cards of a section (services, reasons, reviews, gallery photos) on top of whatever
// design draws them: two/three/four across, one per row, a big first card, staggered, zigzag, a side-scrolling row or
// scattered. They work on the classic home and pages and on every section-library design that shows its items as a
// grid of cards (those mark the grid with data-sg-cards). Style Library and Signature pieces keep their own layout.
// Footer designs change the whole footer's look; every one uses only the site's own name, links and contact details.

const ARRANGEMENTS = [
  { id: '', label: 'As designed', hint: "the section design's own arrangement" },
  { id: 'cols2', label: 'Two across', hint: 'two big cards per row' },
  { id: 'cols3', label: 'Three across', hint: 'three cards per row' },
  { id: 'cols4', label: 'Four across', hint: 'four compact cards per row' },
  { id: 'list', label: 'One per row', hint: 'a single tidy column' },
  { id: 'feature', label: 'Big first card', hint: 'the first card twice the size, the rest around it' },
  { id: 'stagger', label: 'Staggered', hint: 'every other card sits lower' },
  { id: 'zigzag', label: 'Zigzag', hint: 'cards step left and right down the page' },
  { id: 'scroll', label: 'Side-scrolling row', hint: 'one row to swipe or scroll sideways' },
  { id: 'tilt', label: 'Scattered', hint: 'cards slightly tilted, they straighten on hover' },
];
// editor section key -> section family; which arrangements suit it
const FAMILIES = { services: 'services', whyChoose: 'why', testimonials: 'testimonials', gallery: 'gallery' };
const NOT_FOR = { gallery: ['list', 'zigzag'] };
const allowed = (fam) => ARRANGEMENTS.map(a => a.id).filter(id => !(NOT_FOR[fam] || []).includes(id));

const FOOTERS = [
  { id: '', label: 'Classic columns', hint: 'dark band with the name, links and contact in columns' },
  { id: 'centered', label: 'Centered', hint: 'everything centered, links in one line' },
  { id: 'light', label: 'Light', hint: 'a light footer with a brand-color top edge' },
  { id: 'brand', label: 'Brand color with button', hint: 'the brand color, a big name and the main button on top' },
  { id: 'split', label: 'Split panel', hint: 'a brand panel with the name and phone beside the links' },
  { id: 'wordmark', label: 'Giant name', hint: 'the business name huge across the bottom' },
];
const FOOTER_IDS = FOOTERS.map(f => f.id);

function parse(b) {
  const cards = {};
  for (const fam of Object.values(FAMILIES)) {
    const v = b['theme_cards_' + fam];
    if (v && allowed(fam).includes(v)) cards[fam] = v;
  }
  return { cards, footerStyle: FOOTER_IDS.includes(b.theme_footerStyle) ? b.theme_footerStyle : '' };
}

function cleanCards(c) {
  const out = {};
  for (const fam of Object.values(FAMILIES)) if (c && c[fam] && allowed(fam).includes(c[fam])) out[fam] = c[fam];
  return out;
}

// The card grids of one family: a classic grid tagged with its family, or a library section's tagged grid
const box = (fam) => `:is([data-sg-cards="${fam}"], [data-sg-section^="${fam}/"] [data-sg-cards])`;

function ruleFor(fam, id) {
  const X = box(fam), C = `${X} > *`;
  const grid = `${X} { display: grid !important; gap: 24px; }`;
  switch (id) {
    case 'cols2': return `${grid} @media (min-width: 640px) { ${X} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`;
    case 'cols3': return `${grid} @media (min-width: 640px) { ${X} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (min-width: 960px) { ${X} { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }`;
    case 'cols4': return `${grid} ${X} { gap: 16px; } @media (min-width: 640px) { ${X} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (min-width: 1024px) { ${X} { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }`;
    case 'list': return `${grid} ${X} { grid-template-columns: minmax(0, 1fr) !important; max-width: 820px; margin-left: auto !important; margin-right: auto !important; } ${C} img { max-height: 280px; width: 100%; object-fit: cover; }`;
    case 'feature': return `${grid} @media (min-width: 768px) { ${X} { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; grid-auto-flow: dense; } ${C}:first-child { grid-column: span 2; grid-row: span 2; } ${C}:first-child img { height: 100%; min-height: 260px; } }`;
    case 'stagger': return `${grid} @media (min-width: 640px) { ${X} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; padding-bottom: 56px; } ${C}:nth-child(even) { translate: 0 56px; } } @media (min-width: 960px) { ${X} { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } ${C}:nth-child(even) { translate: none; } ${C}:nth-child(3n+2) { translate: 0 56px; } }`;
    case 'zigzag': return `${grid} ${X} { grid-template-columns: minmax(0, 1fr) !important; max-width: 980px; margin-left: auto !important; margin-right: auto !important; } @media (min-width: 768px) { ${C} { width: 62%; } ${C}:nth-child(odd) { justify-self: start; } ${C}:nth-child(even) { justify-self: end; } } ${C} img { max-height: 300px; width: 100%; object-fit: cover; }`;
    case 'scroll': return `${X} { display: flex !important; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px 4px 16px; -webkit-overflow-scrolling: touch; } ${C} { flex: 0 0 min(340px, 82%); scroll-snap-align: start; margin: 0 !important; }`;
    case 'tilt': return `${grid} @media (min-width: 768px) { ${X} { gap: 30px; padding: 10px 0; } ${C} { transition: rotate .35s ease, scale .35s ease; } ${C}:nth-child(3n+1) { rotate: -2deg; } ${C}:nth-child(3n+2) { rotate: 1.5deg; } ${C}:nth-child(3n) { rotate: -1deg; } ${C}:hover, ${C}:focus-within { rotate: 0deg; scale: 1.02; } }`;
    default: return '';
  }
}

const FOOTER_CSS = {
  centered: `footer.site-footer[data-foot="centered"] .footer-grid { grid-template-columns: 1fr !important; justify-items: center; text-align: center; gap: 22px; max-width: 760px; }
footer.site-footer[data-foot="centered"] .footer-grid h4 { display: none; }
footer.site-footer[data-foot="centered"] .footer-grid > div { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 22px; }
footer.site-footer[data-foot="centered"] .footer-grid > div:first-child { flex-direction: column; align-items: center; gap: 0; }
footer.site-footer[data-foot="centered"] .footer-grid .brand { font-size: 26px; }
footer.site-footer[data-foot="centered"] .footer-grid a { display: inline-flex; margin: 0; }
footer.site-footer[data-foot="centered"] .footer-social { justify-content: center; }
footer.site-footer[data-foot="centered"] .foot-hours { justify-content: center; }`,
  light: `footer.site-footer[data-foot="light"] { background: color-mix(in srgb, var(--primary) 5%, #ffffff); color: #334155; border-top: 5px solid var(--primary); }
footer.site-footer[data-foot="light"] .footer-grid .brand, footer.site-footer[data-foot="light"] .footer-post strong, footer.site-footer[data-foot="light"] .footer-loc strong { color: #0f172a; }
footer.site-footer[data-foot="light"] .footer-grid h4 { color: var(--primary-ink, #1e3a8a); }
footer.site-footer[data-foot="light"] .footer-grid p, footer.site-footer[data-foot="light"] .footer-grid a, footer.site-footer[data-foot="light"] .foot-hours, footer.site-footer[data-foot="light"] .footer-post span { color: #475569; }
footer.site-footer[data-foot="light"] .footer-grid a:hover { color: #0f172a; }
footer.site-footer[data-foot="light"] .footer-bottom { color: #64748b; border-top-color: rgba(15,23,42,.12); }
footer.site-footer[data-foot="light"] .footer-legal { color: #64748b; }
footer.site-footer[data-foot="light"] .footer-social a { background: rgba(15,23,42,.08); color: #0f172a; }
footer.site-footer[data-foot="light"] .foot-accept span { color: #334155; border-color: rgba(15,23,42,.2); }`,
  brand: `footer.site-footer[data-foot="brand"] { background: var(--primary); color: var(--on-primary, #fff); }
footer.site-footer[data-foot="brand"] .footer-grid h4, footer.site-footer[data-foot="brand"] .footer-grid .brand, footer.site-footer[data-foot="brand"] .footer-grid p, footer.site-footer[data-foot="brand"] .footer-grid a, footer.site-footer[data-foot="brand"] .foot-hours, footer.site-footer[data-foot="brand"] .footer-post strong, footer.site-footer[data-foot="brand"] .footer-post span, footer.site-footer[data-foot="brand"] .footer-loc strong, footer.site-footer[data-foot="brand"] .footer-bottom, footer.site-footer[data-foot="brand"] .footer-legal { color: var(--on-primary, #fff); }
footer.site-footer[data-foot="brand"] .footer-grid p, footer.site-footer[data-foot="brand"] .footer-grid a, footer.site-footer[data-foot="brand"] .footer-bottom { opacity: .9; }
footer.site-footer[data-foot="brand"] .footer-bottom { border-top-color: color-mix(in srgb, var(--on-primary, #fff) 25%, transparent); }
footer.site-footer[data-foot="brand"] .footer-social a { background: color-mix(in srgb, var(--on-primary, #fff) 18%, transparent); color: var(--on-primary, #fff); }
.foot-cta { display: none; }
footer.site-footer[data-foot="brand"] .foot-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px 28px; max-width: 1120px; margin: 0 auto 44px; padding-bottom: 36px; border-bottom: 1px solid color-mix(in srgb, var(--on-primary, #fff) 25%, transparent); }
footer.site-footer[data-foot="brand"] .foot-cta strong { font-family: var(--heading-font); font-size: clamp(28px, 4.4vw, 48px); line-height: 1.05; color: var(--on-primary, #fff); }
footer.site-footer[data-foot="brand"] .foot-cta .btns { display: flex; flex-wrap: wrap; gap: 12px; }
footer.site-footer[data-foot="brand"] .foot-cta a { display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px; border-radius: 999px; font-weight: 700; background: var(--on-primary, #fff); color: var(--primary); }
footer.site-footer[data-foot="brand"] .foot-cta a.ghost { background: transparent; color: var(--on-primary, #fff); border: 2px solid currentColor; }`,
  split: `footer.site-footer[data-foot="split"] .footer-grid { align-items: start; }
footer.site-footer[data-foot="split"] .footer-grid > div:first-child { background: color-mix(in srgb, var(--primary) 30%, var(--ink)); border-radius: 18px; padding: 28px; }
footer.site-footer[data-foot="split"] .footer-grid > div:first-child .brand { font-size: 28px; line-height: 1.15; }
footer.site-footer[data-foot="split"] .footer-grid > div:first-child p { color: #e2e8f0; }
.foot-phone { display: none; }
footer.site-footer[data-foot="split"] .foot-phone { display: block; font-family: var(--heading-font); font-size: 24px; font-weight: 700; color: #fff !important; margin: 14px 0 0; }`,
  wordmark: `footer.site-footer[data-foot="wordmark"] { padding-bottom: 0; overflow: hidden; }
.foot-mark { display: none; }
footer.site-footer[data-foot="wordmark"] .foot-mark { display: block; max-width: 1240px; margin: 18px auto 0; font-family: var(--heading-font); font-weight: 800; font-size: clamp(28px, min(13vw, calc(min(100vw, 1240px) * 1.6 / var(--mark-len, 10))), 190px); overflow: hidden; line-height: .82; letter-spacing: -.03em; text-align: center; white-space: nowrap; color: transparent; -webkit-text-stroke: 1.5px color-mix(in srgb, var(--primary) 70%, #ffffff); background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 55%, transparent), transparent 85%); -webkit-background-clip: text; background-clip: text; translate: 0 12%; user-select: none; }
footer.site-footer[data-foot="wordmark"] .footer-bottom { border-top: none; padding-top: 6px; }`,
};

// Only the rules this site uses
function css(theme) {
  const t = theme || {};
  const out = [];
  const cards = cleanCards(t.cards);
  for (const fam of Object.keys(cards)) out.push(ruleFor(fam, cards[fam]));
  if (FOOTER_CSS[t.footerStyle]) out.push(FOOTER_CSS[t.footerStyle]);
  return out.join('\n');
}

module.exports = { ARRANGEMENTS, FAMILIES, FOOTERS, FOOTER_IDS, allowed, parse, cleanCards, css, ruleFor };
