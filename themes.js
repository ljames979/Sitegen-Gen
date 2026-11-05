// Extra visual themes ("styles"). Each one is a set of CSS variable overrides
// plus a few rules, applied under body.style-<id>. The older styles are built
// into public-site.ejs; these are data so new ones are easy to add.
// The 12 approved project styles live in project-styles.js and are appended at the end.
const { PROJECT_STYLES, PROJECT_STYLE_HINTS, creditComment } = require('./project-styles');
// The 44 Style Library styles (stylelib.js) come last; their ids start with "sl-"
const styleLib = require('./stylelib');
// The 22 Atelier (Signature) pieces (atelier.js); their ids start with "at-"
const atelier = require('./atelier');
// Styles taken from free MIT website templates (template-styles.js); their ids start with "sb-"
const { TEMPLATE_STYLES, TEMPLATE_STYLE_HINTS } = require('./template-styles');
const THEMES = [
  {
    id: 'luxe', label: 'Luxe (cream, thin lines, numbered service list)', home: 'list', hero: 'center',
    heading: { name: 'Cormorant Garamond', param: 'Cormorant+Garamond:wght@500;600;700', css: "'Cormorant Garamond', Georgia, serif" },
    vars: { '--ink': '#1c1917', '--muted': '#6b645a', '--page-bg': '#faf7f2', '--surface': '#f1ebdf', '--border': '#d9cdb4', '--radius': '0px', '--radius-sm': '0px', '--shadow-sm': 'none', '--shadow-md': '0 12px 30px rgba(60,45,20,0.10)' },
    css: `h1, h2, h3 { font-weight: 600; letter-spacing: 0.02em; }
      h2 { text-transform: uppercase; letter-spacing: 0.12em; font-size: clamp(1.4rem, 2.8vw, 2rem); }
      .section-head .rule { width: 48px; height: 1px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 0; text-transform: uppercase; letter-spacing: 0.14em; font-size: 13px; box-shadow: none; }
      .card, .contact-card, .testimonial-card, .feat-card, .step-card { border-color: var(--border); }`
  },
  {
    id: 'coastal', label: 'Coastal (airy blues, photo + text story rows)', home: 'story', hero: 'left',
    heading: { name: 'Lora', param: 'Lora:wght@500;600;700', css: "'Lora', Georgia, serif" },
    vars: { '--ink': '#0f3446', '--muted': '#516f7d', '--page-bg': '#f7fbfd', '--surface': '#e6f3f8', '--border': '#cfe6ee', '--radius': '22px', '--radius-sm': '14px', '--shadow-sm': '0 1px 3px rgba(15,52,70,0.08)', '--shadow-md': '0 14px 34px rgba(15,52,70,0.12)' },
    css: `.section-head .rule { width: 56px; height: 4px; border-radius: 999px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; }`
  },
  {
    id: 'playful', label: 'Playful (rounded, bright, photo tiles)', home: 'tiles', hero: 'center',
    heading: { name: 'Fredoka', param: 'Fredoka:wght@500;600;700', css: "'Fredoka', system-ui, sans-serif" },
    vars: { '--ink': '#2b2250', '--muted': '#6a6490', '--page-bg': '#fffaf0', '--surface': '#fff0cf', '--border': '#f3dfae', '--radius': '30px', '--radius-sm': '18px', '--shadow-sm': '0 3px 0 rgba(43,34,80,0.10)', '--shadow-md': '0 8px 0 rgba(43,34,80,0.10)' },
    css: `.section-head .rule { width: 60px; height: 8px; border-radius: 999px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; font-weight: 700; box-shadow: 0 4px 0 rgba(43,34,80,0.18); }
      .card:hover, .feat-card:hover { transform: translateY(-3px) rotate(-0.4deg); }`
  },
  {
    id: 'earthy', label: 'Earthy (natural tones, story rows, boxed hero)', home: 'story', hero: 'boxed',
    heading: { name: 'Libre Baskerville', param: 'Libre+Baskerville:wght@400;700', css: "'Libre Baskerville', Georgia, serif" },
    vars: { '--ink': '#2f3a2a', '--muted': '#5e6351', '--page-bg': '#f6f1e7', '--surface': '#ebe3d0', '--border': '#d8cfb8', '--radius': '10px', '--radius-sm': '6px', '--shadow-sm': '0 1px 2px rgba(47,58,42,0.08)', '--shadow-md': '0 10px 24px rgba(47,58,42,0.12)' },
    css: `h1, h2, h3 { font-weight: 700; }
      .section-head .rule { width: 40px; height: 3px; }`
  },
  {
    id: 'corporate', label: 'Corporate (clean, square, full home page)', home: 'full', hero: 'left',
    heading: { name: 'Montserrat', param: 'Montserrat:wght@600;700;800', css: "'Montserrat', system-ui, sans-serif" },
    vars: { '--ink': '#0f172a', '--muted': '#5b6678', '--page-bg': '#ffffff', '--surface': '#f1f5f9', '--border': '#dbe2ea', '--radius': '4px', '--radius-sm': '3px', '--shadow-sm': '0 1px 2px rgba(15,23,42,0.06)', '--shadow-md': '0 8px 20px rgba(15,23,42,0.10)' },
    css: `h1, h2, h3 { font-weight: 800; letter-spacing: -0.01em; }
      .section-head .rule { width: 44px; height: 4px; border-radius: 0; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 4px; }`
  },
  {
    id: 'blush', label: 'Blush (soft pink, photo tiles, boxed hero)', home: 'tiles', hero: 'boxed',
    heading: { name: 'Playfair Display', param: 'Playfair+Display:wght@500;600;700', css: "'Playfair Display', Georgia, serif" },
    vars: { '--ink': '#3d2a33', '--muted': '#80626b', '--page-bg': '#fff8f9', '--surface': '#ffeaee', '--border': '#f6d4db', '--radius': '20px', '--radius-sm': '12px', '--shadow-sm': '0 1px 3px rgba(120,60,80,0.08)', '--shadow-md': '0 12px 30px rgba(120,60,80,0.12)' },
    css: `.section-head .rule { width: 44px; height: 3px; border-radius: 999px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; }`
  },
  {
    id: 'studio', label: 'Studio (bold color bands, white cards, story rows)', home: 'story', hero: 'center',
    heading: { name: 'Poppins', param: 'Poppins:wght@600;700;800', css: "'Poppins', system-ui, sans-serif" },
    vars: { '--ink': '#1f2937', '--muted': '#5b6472', '--page-bg': '#ffffff', '--surface': '#f4f5f7', '--border': '#e3e6ea', '--radius': '16px', '--radius-sm': '10px', '--shadow-sm': '0 2px 6px rgba(17,24,39,0.08)', '--shadow-md': '0 12px 30px rgba(17,24,39,0.14)' },
    css: `h1, h2, h3 { font-weight: 700; }
      .section-head .rule { width: 44px; height: 5px; border-radius: 999px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 10px; font-weight: 700; }`
  },
  {
    id: 'gallery', label: 'Gallery (photo-first, dark bar, big image tiles)', home: 'tiles', hero: 'left',
    heading: { name: 'DM Serif Display', param: 'DM+Serif+Display', css: "'DM Serif Display', Georgia, serif" },
    vars: { '--ink': '#161616', '--muted': '#666666', '--page-bg': '#ffffff', '--surface': '#f3f3f1', '--border': '#e4e4e0', '--radius': '2px', '--radius-sm': '2px', '--shadow-sm': 'none', '--shadow-md': '0 14px 34px rgba(0,0,0,0.16)' },
    css: `h1, h2, h3 { font-weight: 400 !important; letter-spacing: 0; }
      nav.site-nav { background: #161616; }
      nav.site-nav .brand, nav.site-nav .links a:not(.nav-cta) { color: #fff; }
      .section-head .rule { display: none; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 0; text-transform: uppercase; letter-spacing: 0.1em; font-size: 13px; }`
  },
  {
    id: 'noir', dark: true, label: 'Luxury dark (black with a glowing accent, serif, outlined buttons)', home: 'story', hero: 'center',
    heading: { name: 'Cinzel', param: 'Cinzel:wght@500;600;700', css: "'Cinzel', Georgia, serif" },
    vars: { '--ink': '#f5efe4', '--muted': '#b8ad98', '--page-bg': '#0a0806', '--surface': 'color-mix(in srgb, var(--page-bg) 90%, white)', '--border': 'color-mix(in srgb, var(--primary) 32%, var(--page-bg))', '--radius': '14px', '--radius-sm': '10px', '--shadow-sm': '0 1px 2px rgba(0,0,0,0.5)', '--shadow-md': '0 14px 40px rgba(0,0,0,0.55)' },
    css: `h1, h2, h3 { font-weight: 600; letter-spacing: 0.04em; }
      h2 { text-transform: uppercase; letter-spacing: 0.08em; font-size: clamp(1.5rem, 3vw, 2.2rem); }
      nav.site-nav { background: color-mix(in srgb, var(--page-bg) 92%, transparent); border-bottom: 1px solid var(--border); }
      nav.site-nav .brand, nav.site-nav .links a.active { color: var(--primary); }
      nav.site-nav .links a:not(.nav-cta) { color: var(--ink); }
      nav.site-nav .links a:not(.nav-cta):hover { color: var(--primary); }
      .btn, nav.site-nav .links a.nav-cta { background: transparent; color: var(--primary); border: 1.5px solid var(--primary); border-radius: 999px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 13px; box-shadow: none; }
      .btn:hover, nav.site-nav .links a.nav-cta:hover { background: var(--primary); color: var(--on-primary); }
      .card, details.faq-item, .contact-card, .service-links a, .testimonial-card, .review-card, .feat-card, .step-card, .hero-card, .price-card { background: var(--surface); border: 1px solid var(--border); color: var(--ink); }
      .contact-form input, .contact-form textarea, .contact-form select, .quote-form input, .quote-form textarea, .quote-form select { background: var(--page-bg); color: var(--ink); border-color: var(--border); }
      .cookie-bar, .mobile-bar, .skip-link { background: var(--surface); color: var(--ink); }
      .hours-row.today { background: color-mix(in srgb, var(--primary) 18%, var(--page-bg)); }
      .top-bar { background: color-mix(in srgb, var(--page-bg) 70%, black); }
      footer.site-footer { background: color-mix(in srgb, var(--page-bg) 78%, black); border-top: 1px solid var(--border); }
      .footer-grid h4 { display: inline-block; border: 1px solid var(--primary); color: var(--primary); border-radius: 999px; padding: 5px 16px; font-size: 12px; letter-spacing: 0.12em; }
      .hero-bg.pattern { background: radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--primary) 38%, var(--page-bg)), var(--page-bg) 72%); }
      .hero-bg.pattern::after { display: none; }
      .cta-band { background: radial-gradient(ellipse at 50% 110%, color-mix(in srgb, var(--primary) 34%, var(--page-bg)), var(--page-bg) 75%); border-top: 1px solid var(--border); }
      .section-head .rule { width: 72px; height: 2px; background: linear-gradient(90deg, transparent, var(--primary), transparent); }
      .home-intro, .home-services, .home-reviews, .home-location, main section.block:nth-of-type(even) { background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 72%); }`
  },
  {
    id: 'journal', label: 'Journal (left-aligned, quiet, numbered list)', home: 'list', hero: 'left',
    heading: { name: 'Source Serif 4', param: 'Source+Serif+4:wght@500;600;700', css: "'Source Serif 4', Georgia, serif" },
    vars: { '--ink': '#222222', '--muted': '#6d6d6d', '--page-bg': '#fdfdfb', '--surface': '#f5f4ef', '--border': '#e6e3d9', '--radius': '6px', '--radius-sm': '4px', '--shadow-sm': 'none', '--shadow-md': '0 8px 22px rgba(0,0,0,0.08)' },
    css: `.section-head { text-align: left !important; }
      .section-head .rule { margin-left: 0 !important; width: 32px; height: 2px; }`
  },
  ...PROJECT_STYLES,
  ...TEMPLATE_STYLES,
  ...styleLib.THEME_ENTRIES,
  ...atelier.THEME_ENTRIES
];

const IDS = THEMES.map(t => t.id);
const byId = Object.fromEntries(THEMES.map(t => [t.id, t]));

const CORE_STYLES = ['modern', 'classic', 'bold', 'editorial', 'minimal', 'warm', 'midnight', 'split', 'poster', 'agency'];
const ALL_STYLES = [...CORE_STYLES, ...IDS];
const PAGE_KEYS_FOR_STYLE = ['home', 'about', 'services', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'hours', 'contact'];

// A page can use a different style from the rest of the site. Returns the
// site with that page's style swapped in (or the same site when it has none).
function withPageStyle(site, page) {
  const ps = (site.theme && site.theme.pageStyles) || {};
  const key = ({ service: 'services', post: 'blog', area: 'home', extra: 'home' })[page] || page;
  const st = ps[key];
  if (!st || st === site.theme.style || !ALL_STYLES.includes(st)) return site;
  return { ...site, theme: { ...site.theme, style: st } };
}

// One line per style: what it feels like and which kinds of business it suits.
const STYLE_HINTS = {
  modern: 'Clean and friendly. A safe default for almost any local business.',
  classic: 'Traditional serif headings. Good for law, accounting, funeral and long-established firms.',
  bold: 'Big, confident and high-contrast. Good for trades, contractors, towing and fitness.',
  editorial: 'Magazine-style serif and generous spacing. Good for design, real estate and boutique services.',
  minimal: 'Quiet and flat with small uppercase headings. Good for clinics, studios and consultants.',
  warm: 'Cozy and rounded. Good for restaurants, bakeries, daycare and home care.',
  midnight: 'Dark mode. Good for tattoo, barber, nightlife, auto detailing and tech.',
  split: 'Text on one side, a big photo on the other. Good for a single strong hero photo.',
  poster: 'Loud and flat with hard shadows. Good for barbershops, events and youth brands.',
  agency: 'Full home page with service tiles, photo cards and reviews. Good for insurance and professional services.',
  luxe: 'Cream, thin lines and elegant serif. Good for salons, spas, jewelers and high-end services.',
  coastal: 'Airy blues and soft corners. Good for dentists, vets, cleaning, spas and anything that should feel calm.',
  playful: 'Bright, rounded and friendly. Good for pets, kids, bakeries and party businesses.',
  earthy: 'Natural tones and a classic serif. Good for landscaping, farms, wellness and organic food.',
  corporate: 'Clean, square and strong. Good for plumbing, HVAC, electrical, IT and accounting.',
  blush: 'Soft pink with a graceful serif. Good for florists, beauty, bridal and boutiques.',
  studio: 'Bold color bands and white cards with photo story rows. Good for home services and mobile businesses.',
  gallery: 'Photo-first with a dark bar and big image tiles. Good for photography, restaurants, real estate and fitness.',
  noir: 'Black with a warm glow, elegant serif and outlined buttons; the accent color is yours to change. Good for grooming, salons, barbers, detailing, jewelers and restaurants.',
  journal: 'Left-aligned, quiet and readable. Good for law, coaching, consulting and writers.',
  ...PROJECT_STYLE_HINTS,
  ...TEMPLATE_STYLE_HINTS,
  ...styleLib.HINTS,
  ...atelier.HINTS
};

const HOME_LAYOUTS = ['basic', 'full', 'story', 'tiles', 'list', 'showcase', 'split', 'servicesfirst', 'trust', 'photos', 'localpro', 'blueprint', 'stylelib', 'atelier', 'mix'];

// Which home-page layout a site uses. An explicit choice wins; otherwise the
// style decides (Agency is always the full layout; the newer themes bring
// their own); the older tick-box means "full".
function homeLayoutOf(theme) {
  theme = theme || {};
  const lib = styleLib.isLib(theme.style);
  // the Style Library page needs a Style Library style; with any other style it falls back to that style's own layout
  if (theme.homeLayout === 'stylelib' && !lib) return (byId[theme.style] && byId[theme.style].home) || 'basic';
  // likewise the Signature page needs an Atelier piece
  if (theme.homeLayout === 'atelier' && !atelier.isAtelier(theme.style)) return (byId[theme.style] && byId[theme.style].home) || 'basic';
  // Mix and match needs at least one block; with none it shows the style's own layout
  if (theme.homeLayout === 'mix' && !(Array.isArray(theme.mix) && theme.mix.length)) return (byId[theme.style] && byId[theme.style].home) || 'basic';
  if (HOME_LAYOUTS.includes(theme.homeLayout)) return theme.homeLayout;
  if (theme.homeFull) return 'full';
  if (theme.style === 'agency') return 'full';
  return (byId[theme.style] && byId[theme.style].home) || 'basic';
}

const PROJECT_IDS = PROJECT_STYLES.map(t => t.id);
const LIB_IDS = styleLib.THEME_ENTRIES.map(t => t.id);
const ATELIER_IDS = atelier.THEME_ENTRIES.map(t => t.id);
const TEMPLATE_IDS = TEMPLATE_STYLES.map(t => t.id);

module.exports = { STYLE_HINTS, THEMES, IDS, byId, HOME_LAYOUTS, homeLayoutOf, CORE_STYLES, ALL_STYLES, PAGE_KEYS_FOR_STYLE, withPageStyle, PROJECT_IDS, LIB_IDS, ATELIER_IDS, TEMPLATE_IDS, creditComment };
