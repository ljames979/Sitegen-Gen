// Design recommendations per industry template: which style, colours, fonts and page layout suit a kind of
// business, and what to avoid. Built from the UI UX Pro Max data (see design-data/README.md) through a
// hand-made mapping from each SiteGen industry to its closest business type in that data.

const dd = require('./designdata');
const contrast = require('./contrast');
const { TEMPLATES } = require('./templates');
const looks = require('./template-looks');
const themes = require('./themes');
const fonts = require('./fonts');

// industry id -> closest business type in the data ("fit": direct | close | approximate),
// two more types worth borrowing from, and optional hand-picked SiteGen styles to prefer / avoid.
const MAP = {
  plumbing:           { type: 'Home Services (Plumber/Electrician)', fit: 'direct', also: ['Hyperlocal Services'] },
  electrician:        { type: 'Home Services (Plumber/Electrician)', fit: 'direct', also: ['Hyperlocal Services'] },
  hvac:               { type: 'Home Services (Plumber/Electrician)', fit: 'direct', also: ['Construction/Architecture'] },
  landscaping:        { type: 'Agriculture/Farm Tech', fit: 'close', also: ['Florist/Plant Shop', 'Home Services (Plumber/Electrician)'], prefer: ['earthy'] },
  cleaning:           { type: 'Hyperlocal Services', fit: 'close', also: ['Home Services (Plumber/Electrician)', 'Beauty/Spa/Wellness Service'], prefer: ['coastal'] },
  roofing:            { type: 'Construction/Architecture', fit: 'close', also: ['Home Services (Plumber/Electrician)'] },
  contractor:         { type: 'Construction/Architecture', fit: 'direct', also: ['Home Services (Plumber/Electrician)', 'Architecture / Interior'] },
  'auto-repair':      { type: 'Automotive/Car Dealership', fit: 'close', also: ['Home Services (Plumber/Electrician)'], prefer: ['bold'] },
  salon:              { type: 'Beauty/Spa/Wellness Service', fit: 'direct', also: ['Luxury/Premium Brand'], prefer: ['luxe', 'blush'] },
  spa:                { type: 'Beauty/Spa/Wellness Service', fit: 'direct', also: ['Yoga & Stretching Guide', 'Luxury/Premium Brand'], prefer: ['coastal', 'luxe'] },
  restaurant:         { type: 'Restaurant/Food Service', fit: 'direct', also: ['Brewery/Winery', 'Bakery/Cafe'], prefer: ['gallery', 'warm'] },
  bakery:             { type: 'Bakery/Cafe', fit: 'direct', also: ['Restaurant/Food Service', 'Florist/Plant Shop'], prefer: ['playful', 'warm'] },
  law:                { type: 'Legal Services', fit: 'direct', also: ['Banking/Traditional Finance', 'B2B Service'], prefer: ['journal', 'classic'] },
  accounting:         { type: 'Banking/Traditional Finance', fit: 'close', also: ['B2B Service', 'Legal Services'], prefer: ['corporate'] },
  'real-estate':      { type: 'Real Estate/Property', fit: 'direct', also: ['Luxury/Premium Brand', 'Architecture / Interior'], prefer: ['gallery', 'editorial'] },
  dentist:            { type: 'Dental Practice', fit: 'direct', also: ['Medical Clinic'], prefer: ['coastal'] },
  veterinary:         { type: 'Veterinary Clinic', fit: 'direct', also: ['Pet Tech App', 'Medical Clinic'], prefer: ['playful', 'warm'] },
  fitness:            { type: 'Fitness/Gym App', fit: 'close', also: ['Yoga & Stretching Guide', 'Event Management'], prefer: ['bold', 'midnight'] },
  photography:        { type: 'Photography Studio', fit: 'direct', also: ['Portfolio/Personal', 'Architecture / Interior'], prefer: ['gallery', 'minimal'] },
  'pet-grooming':     { type: 'Pet Tech App', fit: 'close', also: ['Veterinary Clinic', 'Beauty/Spa/Wellness Service'], prefer: ['playful', 'studio'] },
  'mobile-grooming':  { type: 'Hyperlocal Services', fit: 'close', also: ['Pet Tech App', 'Veterinary Clinic'], prefer: ['studio', 'playful', 'noir'] },
  'dog-training':     { type: 'Pet Tech App', fit: 'approximate', also: ['Hyperlocal Services', 'Online Course/E-learning'], prefer: ['gallery', 'bold'] },
  'pet-care':         { type: 'Pet Tech App', fit: 'approximate', also: ['Hyperlocal Services', 'Childcare/Daycare'], prefer: ['playful', 'warm'] },
  'it-repair':        { type: 'B2B Service', fit: 'close', also: ['Home Services (Plumber/Electrician)'], prefer: ['corporate', 'minimal'] },
  moving:             { type: 'Logistics/Delivery', fit: 'close', also: ['Home Services (Plumber/Electrician)', 'Hyperlocal Services'], prefer: ['studio', 'bold'] },
  'pest-control':     { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Hyperlocal Services', 'Agriculture/Farm Tech'], prefer: ['corporate'] },
  painting:           { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Home Decoration & Interior Design', 'Architecture / Interior'], prefer: ['journal', 'editorial'] },
  tattoo:             { type: 'Creative Agency', fit: 'approximate', also: ['Portfolio/Personal', 'Photography Studio'], prefer: ['midnight', 'noir', 'poster'] },
  barber:             { type: 'Hyperlocal Services', fit: 'approximate', also: ['Beauty/Spa/Wellness Service', 'Automotive/Car Dealership'], prefer: ['poster', 'noir', 'bold'], avoid: ['blush'] },
  insurance:          { type: 'Insurance Platform', fit: 'direct', also: ['Banking/Traditional Finance', 'B2B Service'], prefer: ['agency', 'corporate'] },
  'home-care':        { type: 'Senior Care/Elderly', fit: 'direct', also: ['Medical Clinic', 'Childcare/Daycare'], prefer: ['warm', 'coastal'] },
  'party-rental':     { type: 'Event Management', fit: 'close', also: ['Wedding/Event Planning', 'Childcare/Daycare'], prefer: ['playful', 'studio'] },
  florist:            { type: 'Florist/Plant Shop', fit: 'direct', also: ['Wedding/Event Planning', 'Bakery/Cafe'], prefer: ['blush', 'warm', 'luxe'] },
  'car-detailing':    { type: 'Automotive/Car Dealership', fit: 'close', also: ['Hyperlocal Services', 'Luxury/Premium Brand'], prefer: ['midnight', 'noir', 'bold'] },
  catering:           { type: 'Restaurant/Food Service', fit: 'close', also: ['Event Management', 'Bakery/Cafe'], prefer: ['warm', 'gallery'] },
  chiropractor:       { type: 'Medical Clinic', fit: 'close', also: ['Yoga & Stretching Guide', 'Dental Practice'], prefer: ['minimal', 'coastal'] },
  tutoring:           { type: 'Online Course/E-learning', fit: 'close', also: ['Childcare/Daycare', 'Kids Learning (ABC & Math)'], prefer: ['warm', 'playful'] },
  wedding:            { type: 'Wedding/Event Planning', fit: 'direct', also: ['Luxury/Premium Brand', 'Florist/Plant Shop'], prefer: ['editorial', 'luxe', 'blush'] },
  'pool-service':     { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Hyperlocal Services', 'Beauty/Spa/Wellness Service'], prefer: ['coastal', 'modern'] },
  'tree-service':     { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Agriculture/Farm Tech', 'Hyperlocal Services'], prefer: ['bold', 'earthy'] },
  'pressure-washing': { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Hyperlocal Services'], prefer: ['bold', 'modern'] },
  'junk-removal':     { type: 'Logistics/Delivery', fit: 'close', also: ['Home Services (Plumber/Electrician)', 'Hyperlocal Services'], prefer: ['bold', 'studio'] },
  'coffee-shop':      { type: 'Bakery/Cafe', fit: 'direct', also: ['Restaurant/Food Service', 'Brewery/Winery'], prefer: ['warm', 'earthy'] },
  locksmith:          { type: 'Home Services (Plumber/Electrician)', fit: 'close', also: ['Hyperlocal Services'], prefer: ['bold', 'corporate'] },
  daycare:            { type: 'Childcare/Daycare', fit: 'direct', also: ['Kids Learning (ABC & Math)', 'Online Course/E-learning'], prefer: ['warm', 'playful'], avoid: ['midnight', 'noir', 'poster'] }
};

// industry id -> the approved style from the project's style index (00-style-index.md, "Best for").
// It leads the suggestions; industries the index does not name fall back to the data alone.
const APPROVED = {
  plumbing: 'workbench', electrician: 'workbench', hvac: 'workbench', roofing: 'workbench', contractor: 'workbench',
  'auto-repair': 'workbench', 'car-detailing': 'workbench',
  landscaping: 'organic', 'tree-service': 'organic', cleaning: 'organic', 'pressure-washing': 'organic',
  'pet-grooming': 'organic', 'mobile-grooming': 'organic',
  salon: 'japandi', florist: 'japandi', spa: 'wellness', dentist: 'wellness', chiropractor: 'wellness',
  'real-estate': 'luxury', wedding: 'luxury',
  restaurant: 'terracota', catering: 'terracota', bakery: 'cafe', 'coffee-shop': 'cafe',
  barber: 'barbershop', tattoo: 'barbershop',
  law: 'flatcorp', accounting: 'flatcorp', insurance: 'flatcorp',
  'home-care': 'inclusive', fitness: 'energetic', 'party-rental': 'energetic'
};

// Data style name -> SiteGen styles that express it (best first). Styles that suit apps, dashboards or
// games rather than local-business sites are left out on purpose.
const STYLE_MAP = {
  'Minimalism & Swiss Style': ['minimal', 'corporate', 'modern'], 'Swiss Modernism 2.0': ['corporate', 'minimal'],
  'Exaggerated Minimalism': ['minimal', 'editorial'], 'Flat Design': ['modern', 'studio'],
  'Vibrant & Block-based': ['studio', 'bold', 'playful'], 'Accessible & Ethical': ['modern', 'minimal', 'classic'],
  'Inclusive Design': ['modern', 'warm'], 'Motion-Driven': ['bold', 'studio'], 'Dark Mode (OLED)': ['midnight', 'noir'],
  'Glassmorphism': ['modern', 'midnight'], 'Liquid Glass': ['modern', 'luxe'], 'Aurora UI': ['modern', 'coastal'],
  'Gradient Mesh / Aurora Evolved': ['modern', 'coastal'], 'Soft UI Evolution': ['coastal', 'blush', 'luxe'],
  'Neumorphism': ['coastal', 'blush'], 'Claymorphism': ['playful', 'warm'],
  'Organic Biophilic': ['earthy', 'coastal', 'warm'], 'Biomimetic / Organic 2.0': ['earthy', 'warm'], 'Nature Distilled': ['earthy', 'warm'],
  'Editorial Grid / Magazine': ['editorial', 'journal'], 'Brutalism': ['poster', 'bold'], 'Neubrutalism': ['poster', 'bold'],
  'Anti-Polish / Raw Aesthetic': ['poster', 'bold'], 'Bento Box Grid': ['agency', 'studio'], '3D & Hyperrealism': ['gallery', 'modern'],
  '3D Product Preview': ['gallery', 'modern'], 'Vintage Analog / Retro Film': ['classic', 'warm'], 'Retro-Futurism': ['classic', 'poster'],
  'E-Ink / Paper': ['journal', 'minimal'], 'Parallax Storytelling': ['gallery', 'editorial'], 'Kinetic Typography': ['gallery', 'editorial'],
  'Gen Z Chaos / Maximalism': ['poster', 'playful'], 'Memphis Design': ['poster', 'playful'], 'Skeuomorphism': ['classic', 'warm']
};

// What an "avoid" phrase means for SiteGen's options. Anything not matched here is shown as a plain tip.
const AVOID_RULES = [
  { re: /dark mode|dark modes/i, styles: ['midnight', 'noir'], why: 'a dark look is not recommended for this kind of business' },
  { re: /animation|motion|parallax|3d effects/i, calm: true, why: 'keep movement gentle' },
  { re: /neon/i, styles: ['poster'], why: 'avoid harsh, neon-bright colours' },
  { re: /playful/i, styles: ['playful', 'poster'], why: 'a playful look can undermine trust here' },
  { re: /excessive decoration|ornate|clutter/i, options: ['doodles', 'emojiHeads'], why: 'keep decoration light' },
  { re: /small text/i, tip: 'Use larger text (set Heading size to Large).' },
  { re: /pure white backgrounds/i, tip: 'Use a lightly tinted page background rather than pure white.' },
  { re: /purple\/pink gradients/i, tip: 'Avoid purple-to-pink gradients; they read as generic AI design.' },
  { re: /contrast/i, tip: 'Check text contrast; keep body text at WCAG AA (4.5:1).' }
];

const SITEGEN_STYLES = new Set(themes.ALL_STYLES);
const dedupe = (a) => [...new Set(a)];

function analyseAvoid(list) {
  const avoidStyles = {}, options = new Set(), tips = []; let calm = false;
  for (const phrase of list) {
    let matched = false;
    for (const r of AVOID_RULES) {
      if (!r.re.test(phrase)) continue;
      matched = true;
      for (const s of r.styles || []) avoidStyles[s] = avoidStyles[s] || `"${phrase}": ${r.why}`;
      for (const o of r.options || []) options.add(o);
      if (r.calm) calm = true;
      if (r.tip) tips.push(r.tip);
    }
    if (!matched) tips.push(phrase); // content advice, e.g. "No map", "Hidden reviews"
  }
  if (calm) for (const o of ['heroFloat', 'heroCinematic', 'hoverLift']) options.add(o);
  return { avoidStyles, avoidOptions: [...options], motion: calm ? 'calm' : 'normal', tips: dedupe(tips) };
}

const FONT_OK = (n) => !!fonts.cleanFontName(n) && !/\b(KR|JP|SC|TC|HK)\b|Arabic|Naskh|Hebrew|Thai|Devanagari|Mono$|Press Start|VT323|Orbitron/.test(n);

function colorsFromPalette(pal) {
  const primary = contrast.ensureContrast(pal.primary, '#ffffff', 4.5);
  let accent = pal.foreground && contrast.luminance(pal.foreground) < 0.12 ? pal.foreground : '#1e293b';
  return { primaryColor: primary, accentColor: accent, background: pal.background };
}

function paletteOptions(types) {
  return types.map(t => ({ from: t.name, note: t.paletteNote, ...colorsFromPalette(t.palette), raw: t.palette }));
}

const cache = new Map();
function industryDesign(templateId) {
  if (cache.has(templateId)) return cache.get(templateId);
  const m = MAP[templateId]; const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!m || !tpl) return null;
  const main = dd.getProductType(m.type); if (!main) return null;
  const alsoTypes = (m.also || []).map(n => dd.getProductType(n)).filter(Boolean);
  const avoidInfo = analyseAvoid(main.antiPatterns);
  const own = (tpl.look && tpl.look.style) || (looks[templateId] && looks[templateId].style) || '';

  // styles: hand-picked first, then the template's own look, then what the data recommends
  const dataStyles = [main.primaryStyle, ...main.stylePriority, ...main.secondaryStyles].flatMap(x => String(x).split(/\s+\+\s+/)).flatMap(n => STYLE_MAP[n] || []);
  const avoidIds = new Set([...Object.keys(avoidInfo.avoidStyles), ...(m.avoid || [])]);
  const recommended = dedupe([APPROVED[templateId], ...(m.prefer || []), own, ...dataStyles].filter(Boolean)).filter(s => SITEGEN_STYLES.has(s) && !avoidIds.has(s));
  const avoidStyles = [...avoidIds].filter(s => SITEGEN_STYLES.has(s)).map(id => ({ id, why: avoidInfo.avoidStyles[id] || 'a poor fit for this kind of business' }));

  const pairings = dedupe(dd.searchTypography(`${main.typographyMood} ${main.keywords.slice(0, 4).join(' ')}`, 8).filter(p => FONT_OK(p.heading) && FONT_OK(p.body)).map(p => JSON.stringify({ name: p.name, heading: p.heading, body: p.body, mood: p.mood.slice(0, 4) }))).slice(0, 3).map(JSON.parse);
  const landing = dd.getLanding(main.landingPattern) || dd.getLanding(main.pattern) || dd.searchLanding(main.landingPattern, 1)[0] || null;

  const out = {
    templateId, label: tpl.label, productType: main.name, fit: m.fit, alsoSee: alsoTypes.map(t => t.name),
    currentStyle: own, recommendedStyles: recommended.slice(0, 5), avoidStyles,
    palettes: paletteOptions([main, ...alsoTypes]).slice(0, 3),
    fonts: pairings, landing: landing && { name: landing.name, sections: landing.sections, cta: landing.cta },
    motion: avoidInfo.motion, avoidOptions: avoidInfo.avoidOptions, avoid: main.antiPatterns, tips: avoidInfo.tips,
    effects: main.keyEffects, rules: main.rules, severity: main.severity
  };
  cache.set(templateId, out);
  return out;
}

const allIndustryDesigns = () => TEMPLATES.map(t => industryDesign(t.id)).filter(Boolean);

module.exports = { MAP, APPROVED, STYLE_MAP, AVOID_RULES, industryDesign, allIndustryDesigns, analyseAvoid, colorsFromPalette };
