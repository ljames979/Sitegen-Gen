// The 12 approved styles from the SiteGen style index (00-style-index.md), as SiteGen themes.
// Same shape as the entries in themes.js, plus:
//   body     the body font (the style's "Fixes" note often asks for a different body font than the heading)
//   palette  the style's own primary/accent, offered in the editor; a client's brand colors replace only these two
//   credit   the style's name in the designmd.app credit comment (styles 1-11, CC BY 4.0); null for Devault (12)
// Each style's "Fixes" note from the index is applied in its tokens and css. A few tokens are derived from
// the style file (a darker shade of one of its colors) only where the file's own color fails 4.5:1 contrast.
// Style 12 (Pop Studio Modern) is used under Devault's design-reference license: tokens only, never the
// style file itself, and never bundled into anything sold as a theme pack.

const SYSTEM_UI = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const font = (name, weights, fallback) => ({
  name,
  param: name.replace(/ /g, '+') + (weights ? ':wght@' + weights : ''),
  css: `'${name}', ${fallback}`
});
const systemFont = { name: 'System UI', param: '', css: SYSTEM_UI };

const PROJECT_STYLES = [
  {
    id: 'cafe', no: 1, label: 'Café (cozy, hand-drawn headings, cream and coffee)', home: 'story', hero: 'center',
    credit: 'Café Artesanal Aconchegante',
    heading: font('Caveat', '500;700', 'cursive'),
    body: font('Nunito', '400;600;700', 'system-ui, sans-serif'),
    palette: { primary: '#6F4E37', accent: '#4A3325' },
    vars: { '--ink': '#6F4E37', '--muted': '#5B4A3E', '--page-bg': '#FFFDD0', '--surface': '#FFDAB9', '--border': 'color-mix(in srgb, #6F4E37 18%, #FFFDD0)', '--sg-rule': 'color-mix(in srgb, #98FB98 45%, #FFFDD0)', '--radius': '18px', '--radius-sm': '12px', '--shadow-sm': '0 1px 3px rgba(111,78,55,0.10)', '--shadow-md': '0 12px 28px rgba(111,78,55,0.14)' },
    css: `h1, h2, h3 { font-weight: 700; letter-spacing: 0; }
      h2 { font-size: clamp(2rem, 4.4vw, 2.8rem); }
      h3 { font-family: var(--body-font); font-weight: 700; }
      .section-head .rule { width: 56px; height: 8px; border-radius: 999px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; }`
  },
  {
    id: 'terracota', no: 2, label: 'Terracota (warm Mediterranean, serif headings, arched photos)', home: 'story', hero: 'left',
    credit: 'Terracota Mediterrâneo',
    heading: font('DM Serif Display', '', 'Georgia, serif'),
    body: font('DM Sans', '400;500;700', 'system-ui, sans-serif'),
    palette: { primary: '#C2452D', accent: '#4A1942' },
    vars: { '--ink': '#4A1942', '--muted': '#51612D', '--page-bg': '#FFF8F0', '--surface': '#E8D5B7', '--border': 'color-mix(in srgb, #D4956B 45%, #FFF8F0)', '--sg-rule': '#D4956B', '--radius': '14px', '--radius-sm': '8px', '--shadow-sm': '0 1px 3px rgba(74,25,66,0.08)', '--shadow-md': '0 12px 30px rgba(74,25,66,0.12)' },
    css: `h1, h2, h3 { font-weight: 400 !important; letter-spacing: 0; }
      h3 { font-family: var(--body-font); font-weight: 700 !important; }
      .section-head .rule { width: 48px; height: 3px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; color: var(--on-primary); }
      .about-split-photo, .about-split-photo img, .gallery-grid .frame, .gallery-grid .frame img, .feat-card img { border-radius: 999px 999px var(--radius-sm) var(--radius-sm); }`
  },
  {
    id: 'barbershop', no: 3, label: 'Barbershop (classic, tall condensed headings, cream and burgundy)', home: 'list', hero: 'center',
    credit: 'Retro Barbershop Clássica',
    heading: font('Bebas Neue', '', "'Arial Narrow', Arial, sans-serif"),
    body: font('Inter', '400;500;600;700;800', 'system-ui, sans-serif'),
    palette: { primary: '#800020', accent: '#4A2C2A' },
    vars: { '--ink': '#4A2C2A', '--muted': '#36454F', '--page-bg': '#F5F5DC', '--surface': '#FFFFFF', '--border': 'color-mix(in srgb, #B8860B 40%, #F5F5DC)', '--sg-rule': '#B8860B', '--radius': '4px', '--radius-sm': '2px', '--shadow-sm': '0 1px 2px rgba(74,44,42,0.10)', '--shadow-md': '0 10px 24px rgba(74,44,42,0.16)' },
    css: `h1, h2, h3 { font-weight: 400 !important; letter-spacing: 0.04em; }
      h2 { font-size: clamp(2.2rem, 5vw, 3.2rem); }
      h3 { font-family: var(--body-font); font-weight: 700 !important; letter-spacing: 0; }
      .section-head .rule { width: 64px; height: 3px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 2px; text-transform: uppercase; letter-spacing: 0.1em; font-size: 14px; }`
  },
  {
    id: 'wellness', no: 4, label: 'Wellness (calm, airy, soft pastels with dark text)', home: 'story', hero: 'center',
    credit: 'Minimalismo Sereno de Bem-Estar',
    heading: font('Nunito', '400;600;700;800', 'system-ui, sans-serif'),
    body: font('Nunito', '400;600;700;800', 'system-ui, sans-serif'),
    palette: { primary: '#2F4858', accent: '#1F3440' },
    vars: { '--ink': '#24323B', '--muted': '#4A5A63', '--page-bg': '#FFFFFF', '--surface': '#FDF6E3', '--border': '#E6E6FA', '--sg-rule': '#A8DADC', '--radius': '16px', '--radius-sm': '8px', '--shadow-sm': '0 1px 3px rgba(36,50,59,0.06)', '--shadow-md': '0 12px 30px rgba(36,50,59,0.08)' },
    css: `h1, h2, h3 { font-weight: 700; }
      .section-head .rule { width: 48px; height: 4px; border-radius: 999px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; color: var(--on-primary); box-shadow: none; }`
  },
  {
    id: 'luxury', no: 5, label: 'Luxury (refined serif, navy, pearl and dusty rose)', home: 'list', hero: 'center',
    credit: 'Luxury & Elegant',
    heading: font('Playfair Display', '500;600;700', 'Georgia, serif'),
    body: font('Inter', '400;500;600;700;800', 'system-ui, sans-serif'),
    palette: { primary: '#192A56', accent: '#0F1A36' },
    vars: { '--ink': '#192A56', '--muted': '#4F5874', '--page-bg': '#FCFBFB', '--surface': '#F8EEEC', '--border': 'color-mix(in srgb, #EDA6A3 45%, #FCFBFB)', '--sg-rule': '#F7D794', '--radius': '2px', '--radius-sm': '0px', '--shadow-sm': 'none', '--shadow-md': '0 14px 34px rgba(25,42,86,0.10)' },
    css: `h1, h2, h3 { font-weight: 600; letter-spacing: 0.01em; }
      .section-head .rule { width: 56px; height: 1px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 0; text-transform: uppercase; letter-spacing: 0.14em; font-size: 13px; box-shadow: none; }`
  },
  {
    id: 'japandi', no: 6, label: 'Japandi (warm minimal, sand and charcoal, natural)', home: 'story', hero: 'left',
    credit: 'Japandi',
    heading: font('Inter', '400;500;600;700;800', 'system-ui, sans-serif'),
    body: font('Inter', '400;500;600;700;800', 'system-ui, sans-serif'),
    palette: { primary: '#2C3E50', accent: '#3A3A3A' },
    vars: { '--ink': '#3A3A3A', '--muted': '#5E5B53', '--page-bg': '#F5F2ED', '--surface': '#EAE2D3', '--border': '#D4C5A9', '--sg-rule': '#8B9E7E', '--radius': '16px', '--radius-sm': '8px', '--shadow-sm': 'none', '--shadow-md': '0 10px 26px rgba(58,58,58,0.08)' },
    css: `h1, h2, h3 { font-weight: 500; letter-spacing: -0.01em; }
      .section-head .rule { width: 40px; height: 2px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; color: var(--on-primary); box-shadow: none; }`
  },
  {
    id: 'workbench', no: 7, label: 'Workbench (rugged industrial, steel gray and safety yellow)', home: 'full', hero: 'left',
    credit: 'Industrial Workbench Schematic',
    brandFillOnly: true, // yellow is for buttons and highlights only; --brand-text sets brand-colored text back to the ink color
    heading: font('Roboto Condensed', '400;600;700', "'Arial Narrow', Arial, sans-serif"),
    body: font('Roboto Condensed', '400;600;700', "'Arial Narrow', Arial, sans-serif"),
    palette: { primary: '#ffc107', accent: '#2B2B2B' },
    vars: { '--ink': '#1f1f1f', '--muted': '#43494D', '--page-bg': '#cfd3d6', '--surface': '#E2E5E7', '--border': '#71797E', '--sg-rule': '#8B4513', '--brand-text': 'var(--ink)', '--radius': '4px', '--radius-sm': '2px', '--shadow-sm': '0 1px 2px rgba(31,31,31,0.12)', '--shadow-md': '0 10px 22px rgba(31,31,31,0.18)' },
    css: `h1, h2, h3 { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
      .section-head .rule { width: 56px; height: 4px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 4px; color: var(--on-primary); text-transform: uppercase; letter-spacing: 0.06em; }
      .cta-band .btn, .blk-cta-band .btn, .blk-bg-brand .btn { color: var(--ink); }
      nav.site-nav .links a.active, nav.site-nav .links a:hover, .testimonial-card .stars { color: var(--ink); }
      :where(main a:not(.btn):not(.nav-cta)) { text-decoration: underline; text-decoration-color: var(--primary); text-decoration-thickness: 2px; text-underline-offset: 3px; }
      .hero-bg.pattern { background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 82%, var(--primary)) 100%); }`
  },
  {
    id: 'flatcorp', no: 8, label: 'Flat corporate (clean, trustworthy, light gray and blue)', home: 'full', hero: 'left',
    credit: 'Flat Design Corporativo',
    heading: font('Lato', '400;700;900', 'system-ui, sans-serif'),
    body: font('Lato', '400;700;900', 'system-ui, sans-serif'),
    palette: { primary: '#0071EB', accent: '#343A40' }, // the file's #007BFF, darkened just enough for white button text
    vars: { '--ink': '#343A40', '--muted': '#5A6169', '--page-bg': '#FFFFFF', '--surface': '#F8F9FA', '--border': '#DEE2E6', '--radius': '4px', '--radius-sm': '4px', '--shadow-sm': 'none', '--shadow-md': '0 6px 16px rgba(52,58,64,0.08)' },
    css: `h1, h2, h3 { font-weight: 700; }
      .section-head .rule { width: 44px; height: 4px; border-radius: 0; }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 4px; color: var(--on-primary); box-shadow: none; }
      .card, .feat-card, .step-card { box-shadow: none; }`
  },
  {
    id: 'inclusive', no: 9, label: 'Inclusive (high contrast, large text, accessibility first)', home: 'full', hero: 'left',
    credit: 'Inclusive Design',
    heading: systemFont,
    body: systemFont,
    palette: { primary: '#0066FF', accent: '#1A1A1A' },
    vars: { '--ink': '#1A1A1A', '--muted': '#4A4A4A', '--page-bg': '#FFFFFF', '--surface': '#FFFFFF', '--border': '#4A4A4A', '--radius': '8px', '--radius-sm': '6px', '--shadow-sm': 'none', '--shadow-md': 'none' },
    css: `p, li, label, input, textarea, select { font-size: max(1em, 18px); }
      h1, h2, h3 { font-weight: 700; }
      :where(main a:not(.btn):not(.nav-cta)) { text-decoration: underline; text-underline-offset: 3px; }
      a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
      .card, .contact-card, .testimonial-card, .feat-card, .step-card, details.faq-item { border: 1.5px solid var(--border); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; color: var(--on-primary); box-shadow: none; min-height: 48px; }`
  },
  {
    id: 'organic', no: 10, label: 'Organic (earthy, warm beige and forest green)', home: 'story', hero: 'boxed',
    credit: 'Earthy & Organic',
    heading: font('DM Sans', '400;500;700', 'system-ui, sans-serif'),
    body: font('DM Sans', '400;500;700', 'system-ui, sans-serif'),
    palette: { primary: '#2D4F1E', accent: '#4A4A4A' },
    vars: { '--ink': '#4A4A4A', '--muted': '#5A5A5A', '--page-bg': '#F5E6CC', '--surface': '#FBF3E4', '--border': 'color-mix(in srgb, #2D4F1E 18%, #F5E6CC)', '--sg-heading': '#2D4F1E', '--sg-rule': '#E27D60', '--radius': '12px', '--radius-sm': '8px', '--shadow-sm': '0 1px 2px rgba(45,79,30,0.08)', '--shadow-md': '0 10px 24px rgba(45,79,30,0.12)' },
    css: `h1, h2, h3 { font-weight: 700; color: var(--sg-heading); }
      .section-head .rule { width: 44px; height: 4px; border-radius: 999px; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 999px; color: var(--on-primary); }`
  },
  {
    id: 'energetic', no: 11, label: 'Energetic (loud, poster-like, purple, mint and coral)', home: 'tiles', hero: 'center',
    credit: 'Bold & Energetic',
    heading: systemFont,
    body: systemFont,
    palette: { primary: '#6C5CE7', accent: '#2F3640' },
    vars: { '--ink': '#2F3640', '--muted': '#4B5563', '--page-bg': '#FFFFFF', '--surface': '#E6FAF4', '--border': '#2F3640', '--sg-rule': '#FF7675', '--radius': '10px', '--radius-sm': '6px', '--shadow-sm': '3px 3px 0 #2F3640', '--shadow-md': '6px 6px 0 #2F3640' },
    css: `h1, h2, h3 { font-weight: 800; letter-spacing: -0.02em; }
      h2 { font-size: clamp(2rem, 4.6vw, 3rem); }
      .section-head .rule { width: 64px; height: 8px; border-radius: 0; background: var(--sg-rule); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 6px; color: var(--on-primary); font-weight: 800; box-shadow: var(--shadow-sm); }
      .card, .feat-card, .step-card, .testimonial-card { border: 2px solid var(--border); }`
  },
  {
    id: 'popstudio', no: 12, label: 'Pop studio (playful, bright, cobalt with a pastel gradient)', home: 'tiles', hero: 'left',
    credit: null, // Devault: no credit line, and the style file never goes to a client
    heading: font('Plus Jakarta Sans', '400;600;700;800', 'system-ui, sans-serif'),
    body: font('Plus Jakarta Sans', '400;600;700;800', 'system-ui, sans-serif'),
    palette: { primary: '#135ceb', accent: '#0b1726' },
    vars: { '--ink': '#0d1527', '--muted': '#525b6a', '--page-bg': '#ffffff', '--surface': '#f8fafc', '--border': '#e2e8f0', '--sg-bar': '#0b1726', '--sg-gradient': 'linear-gradient(135deg, #dcf0ef 0%, #f7fcb5 100%)', '--radius': '20px', '--radius-sm': '8px', '--shadow-sm': 'none', '--shadow-md': '0 8px 20px rgba(13,21,39,0.06)' },
    css: `h1, h2, h3 { font-weight: 800; letter-spacing: -0.03em; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; color: var(--primary); }
      .section-head .rule { width: 32px; height: 4px; border-radius: 999px; }
      .top-bar, footer.site-footer { background: var(--sg-bar); }
      .btn, nav.site-nav .links a.nav-cta { border-radius: 8px; color: var(--on-primary); box-shadow: none; }
      .hero .btn { border-radius: 999px; }
      .hero-bg.pattern { background: var(--sg-gradient); }
      .hero-bg.pattern::after { display: none; }
      .hero-bg.pattern ~ .hero-inner, .hero-bg.pattern ~ .hero-inner h1, .hero-bg.pattern ~ .hero-inner p { color: var(--ink); text-shadow: none; }`
  }
];

const PROJECT_STYLE_HINTS = {
  cafe: 'Style 1. Cozy and hand-drawn. For cafés, bakeries, dessert shops and ice cream.',
  terracota: 'Style 2. Warm and sun-baked. For restaurants, catering, wine bars, pavers and patio companies.',
  barbershop: 'Style 3. Classic and nostalgic. For barbershops, men\'s grooming and tattoo shops.',
  wellness: 'Style 4. Calm, airy and soft. For day spas, massage, yoga, wellness and dental offices.',
  luxury: 'Style 5. Refined and timeless. For med spas, upscale salons, realtors, wedding venues and jewelers.',
  japandi: 'Style 6. Warm minimal and natural. For hair salons, florists, interior designers and furniture stores.',
  workbench: 'Style 7. Rugged and hands-on. For auto repair, roofing, HVAC, plumbing, general contractors and welding.',
  flatcorp: 'Style 8. Clean and trustworthy. For insurance, accountants, law offices, staffing and consultants. Swap in the client\'s brand color.',
  inclusive: 'Style 9. Clear, high-contrast and accessible. For home care, senior services, medical practices and nonprofits.',
  organic: 'Style 10. Natural and calm. For landscaping, lawn care, cleaning, pet groomers and farmers markets.',
  energetic: 'Style 11. Loud and poster-like. For party and event rentals, gyms, food trucks, festivals and kids\' activities.',
  popstudio: 'Style 12. Playful and bright. For juice bars, smoothie shops, salons, boutiques and creative studios. Needs bright, saturated photos.'
};

// The CC BY 4.0 credit for designmd.app styles, exactly as the project instructions word it. '' for other styles.
function creditComment(theme) {
  if (!theme || !theme.credit) return '';
  return `<!-- Design system adapted from "${theme.credit}" by designmd.app, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->`;
}

module.exports = { PROJECT_STYLES, PROJECT_STYLE_HINTS, creditComment };
