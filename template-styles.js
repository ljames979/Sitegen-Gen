// Styles taken from free, commercially licensed website templates: only the look (colors, fonts, corners, how
// headings and buttons are drawn), never the template's own files, words or photos. The matching section layouts
// are in the section library (library/index.js, source "Start Bootstrap ... (MIT)" or "Meraki UI (MIT) ..."), so a site can pair the style
// with its blocks on the Blocks screen. Same shape as the entries in themes.js, plus:
//   body     the template's body font
//   palette  the template's own primary/accent, offered in the editor; a client's brand colors replace only these two
//   source   where the look came from and its license
// Start Bootstrap templates: MIT, Copyright (c) 2013-2023 Start Bootstrap LLC (see THIRD-PARTY-LICENSES.md).
// Meraki UI components: MIT, Copyright (c) 2021 Khatab Wedaa (see THIRD-PARTY-LICENSES.md).
const font = (name, weights, fallback) => ({ name, param: name.replace(/ /g, '+') + (weights ? ':wght@' + weights : ''), css: `'${name}', ${fallback}` });
// a light brand color (Agency's yellow, Creative's orange) is too pale for small words on white: library sections
// that use it as text color get the readable version instead, except on a brand-color or photo background
const READABLE_PRIMARY = '.sg-sec:not([data-sg-bg]) [class~="tw:text-primary"] { color: var(--primary-ink); }';

const TEMPLATE_STYLES = [
  {
    id: 'sb-agency', tpl: true, label: 'Agency (bold uppercase headings, slab-serif text, yellow buttons)', home: 'full', hero: 'center',
    source: 'Start Bootstrap Agency (MIT)',
    heading: font('Montserrat', '400;700', 'system-ui, sans-serif'),
    body: font('Roboto Slab', '400;700', 'Georgia, serif'),
    palette: { primary: '#ffc800', accent: '#212529' },
    vars: { '--ink': '#212529', '--muted': '#5c636a', '--page-bg': '#ffffff', '--surface': '#f8f9fa', '--border': '#e9ecef', '--radius': '6px', '--radius-sm': '4px', '--shadow-sm': '0 1px 3px rgba(33,37,41,0.08)', '--shadow-md': '0 12px 28px rgba(33,37,41,0.14)' },
    css: `h1, h2 { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
      h3 { font-weight: 700; }
      .section-head .rule { width: 48px; height: 3px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
      ${READABLE_PRIMARY}`
  },
  {
    id: 'sb-creative', tpl: true, label: 'Creative (friendly, serif text, warm orange, round buttons)', home: 'story', hero: 'center',
    source: 'Start Bootstrap Creative (MIT)',
    heading: font('Merriweather Sans', '400;700;800', 'system-ui, sans-serif'),
    body: font('Merriweather', '400;700', 'Georgia, serif'),
    palette: { primary: '#f4623a', accent: '#212529' },
    vars: { '--ink': '#212529', '--muted': '#5c636a', '--page-bg': '#ffffff', '--surface': '#f8f9fa', '--border': '#e9ecef', '--radius': '8px', '--radius-sm': '6px', '--shadow-sm': '0 1px 3px rgba(33,37,41,0.08)', '--shadow-md': '0 14px 32px rgba(33,37,41,0.14)' },
    css: `h1, h2 { font-weight: 800; }
      h3 { font-weight: 700; }
      .section-head .rule { width: 52px; height: 3px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; font-weight: 700; }
      ${READABLE_PRIMARY}`
  },
  {
    id: 'sb-grayscale', tpl: true, dark: true, label: 'Grayscale (dark, widely spaced uppercase headings, soft teal)', home: 'story', hero: 'center',
    source: 'Start Bootstrap Grayscale (MIT)',
    heading: font('Varela Round', '', 'system-ui, sans-serif'),
    body: font('Nunito', '400;600;700', 'system-ui, sans-serif'),
    palette: { primary: '#64a19d', accent: '#000000' },
    vars: { '--ink': '#f5f5f5', '--muted': '#a3a3a3', '--page-bg': '#000000', '--surface': '#111111', '--border': '#262626', '--radius': '4px', '--radius-sm': '2px', '--shadow-sm': '0 1px 2px rgba(0,0,0,0.5)', '--shadow-md': '0 14px 40px rgba(0,0,0,0.6)' },
    css: `h1, h2, h3 { font-weight: 400 !important; text-transform: uppercase; letter-spacing: 0.12em; }
      h3 { letter-spacing: 0.06em; }
      .section-head .rule { width: 64px; height: 4px; }
      nav.site-nav { background: color-mix(in srgb, var(--page-bg) 92%, transparent); border-bottom: 1px solid var(--border); }
      nav.site-nav .links a:not(.nav-cta) { color: var(--ink); }
      nav.site-nav .links a:not(.nav-cta):hover, nav.site-nav .links a.active { color: var(--primary); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 4px; text-transform: uppercase; letter-spacing: 0.15em; font-size: 13px; box-shadow: none; }
      .card, details.faq-item, .contact-card, .service-links a, .testimonial-card, .review-card, .feat-card, .step-card, .hero-card, .price-card { background: var(--surface); border: 1px solid var(--border); color: var(--ink); }
      .contact-form input, .contact-form textarea, .contact-form select, .quote-form input, .quote-form textarea, .quote-form select { background: var(--page-bg); color: var(--ink); border-color: var(--border); }
      .cookie-bar, .mobile-bar, .skip-link { background: var(--surface); color: var(--ink); }
      .top-bar, footer.site-footer { background: #0b0b0b; border-top: 1px solid var(--border); }`
  },
  {
    id: 'mk-clean', tpl: true, label: 'Meraki clean (crisp sans-serif, blue, soft gray cards, rounded corners)', home: 'full', hero: 'left',
    source: 'Meraki UI (MIT)',
    heading: font('Inter', '500;600;700', 'system-ui, sans-serif'),
    body: font('Inter', '400;500', 'system-ui, sans-serif'),
    palette: { primary: '#2563eb', accent: '#1f2937' },
    vars: { '--ink': '#1f2937', '--muted': '#4b5563', '--page-bg': '#ffffff', '--surface': '#f3f4f6', '--border': '#e5e7eb', '--radius': '8px', '--radius-sm': '6px', '--shadow-sm': '0 1px 2px rgba(17,24,39,0.06)', '--shadow-md': '0 10px 24px rgba(17,24,39,0.10)' },
    css: `h1, h2 { font-weight: 700; letter-spacing: -0.01em; }
      h3 { font-weight: 600; }
      .section-head .rule { width: 40px; height: 3px; border-radius: 2px; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; font-weight: 500; letter-spacing: 0.02em; }`
  },
  {
    id: 'mk-night', tpl: true, dark: true, label: 'Meraki night (dark slate, crisp sans-serif, bright blue)', home: 'full', hero: 'left',
    source: 'Meraki UI (MIT)',
    heading: font('Inter', '500;600;700', 'system-ui, sans-serif'),
    body: font('Inter', '400;500', 'system-ui, sans-serif'),
    palette: { primary: '#3b82f6', accent: '#111827' },
    vars: { '--ink': '#f3f4f6', '--muted': '#9ca3af', '--page-bg': '#111827', '--surface': '#1f2937', '--border': '#374151', '--radius': '8px', '--radius-sm': '6px', '--shadow-sm': '0 1px 2px rgba(0,0,0,0.4)', '--shadow-md': '0 12px 32px rgba(0,0,0,0.5)' },
    css: `h1, h2 { font-weight: 700; letter-spacing: -0.01em; }
      h3 { font-weight: 600; }
      .section-head .rule { width: 40px; height: 3px; border-radius: 2px; }
      nav.site-nav { background: color-mix(in srgb, var(--page-bg) 94%, transparent); border-bottom: 1px solid var(--border); }
      nav.site-nav .links a:not(.nav-cta) { color: var(--ink); }
      nav.site-nav .links a:not(.nav-cta):hover, nav.site-nav .links a.active { color: var(--primary); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; font-weight: 500; }
      .card, details.faq-item, .contact-card, .service-links a, .testimonial-card, .review-card, .feat-card, .step-card, .hero-card, .price-card { background: var(--surface); border: 1px solid var(--border); color: var(--ink); }
      .contact-form input, .contact-form textarea, .contact-form select, .quote-form input, .quote-form textarea, .quote-form select { background: var(--page-bg); color: var(--ink); border-color: var(--border); }
      .cookie-bar, .mobile-bar, .skip-link { background: var(--surface); color: var(--ink); }
      .top-bar, footer.site-footer { background: #0b1220; border-top: 1px solid var(--border); }`
  },
];

const TEMPLATE_STYLE_HINTS = {
  'sb-agency': 'From the free Start Bootstrap Agency template (MIT). Confident and classic: big uppercase headings and bright buttons. For contractors, agencies, studios and auto shops. Pairs with the Agency blocks.',
  'sb-creative': 'From the free Start Bootstrap Creative template (MIT). Warm and friendly with round buttons. For photographers, cafés, event planners and creative services. Pairs with the Creative blocks.',
  'sb-grayscale': 'From the free Start Bootstrap Grayscale template (MIT). Dark and moody with wide letter spacing. For barbers, tattoo studios, bars, detailers and photographers. Pairs with the Grayscale blocks.',
  'mk-clean': 'From the free Meraki UI Tailwind components (MIT). Clean and modern: crisp type, a trustworthy blue and soft gray cards. For cleaners, clinics, accountants, IT and home services. Pairs with the Meraki blocks.',
  'mk-night': 'The dark version of Meraki UI (MIT): dark slate with a bright blue. For tech repair, security, auto detailing and late-night businesses. Pairs with the Meraki blocks.',
};

module.exports = { TEMPLATE_STYLES, TEMPLATE_STYLE_HINTS };
