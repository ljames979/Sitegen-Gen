// Smarter automatic generator (Leo, 2026-11-03: "with all new features we have added ... can they be incorporated into
// the automatic website generator to where the generator is smart to identify the industry and build the site based on
// the colors from the clients logo and matching it to a palette we have already").
//
// Three parts, all used by "Generate a site" and by building a site from a client questionnaire:
//   detect()        which of our industries the business is: every industry is scored against the business type, the
//                   name and what sets them apart (whole words only, so "spa" no longer matches "space" or "tax" "taxi"),
//                   with extra everyday words per industry. When nothing matches and AI is set up, the AI picks one
//                   from our list (aiDetect), never a new one.
//   logoColors() + matchPalette()
//                   the logo's main colors (the Brand kit's reader), matched to the closest of the palettes SiteGen
//                   already has (the 16 ready-made palettes in public/palette.js and the generator's 8). Colors are
//                   compared the way eyes see them (CIE Lab), and a palette made for the industry wins a near tie.
//   plan()          2 to 4 of the new content blocks that suit the industry (About us, Social media, photo and contact
//                   blocks), filled only with the site's real words, services and photos, in the matched colors, and a
//                   Blocks home page (Mix and match) that puts them between the industry blueprint's sections.
// Nothing is made up: blocks that need something the client did not give (reviews, an owner's name, facts, social links)
// are left out.
const Palette = require('./public/palette');
const mixPage = require('./mixpage');
const watermark = require('./watermark');
const aboutBlocks = require('./aboutblocks');
const photoTabs = require('./phototabs');
const framedPhoto = require('./framedphoto');
const shapeForm = require('./shapeform');
const roundPhoto = require('./roundphoto');
const photoPairs = require('./photopairs');
const offsetPhoto = require('./offsetphoto');
const { TEMPLATES, GENERIC_TEMPLATE } = require('./templates');

// ---- 1. industry ----

// Extra everyday words per industry, on top of each template's own keywords. Stems match whole words with common
// endings (groom -> groomer, grooming), see wordRe.
const EXTRA = {
  'pet-grooming': ['groomer', 'grooming', 'pet salon', 'dog wash', 'cat groom', 'pet spa', 'dog spa'],
  veterinary: ['animal clinic', 'pet clinic', 'pet hospital', 'animal doctor'],
  'dog-training': ['k9', 'canine train', 'dog school', 'puppy class'],
  'pet-care': ['pet sitter', 'dog walker', 'pet hotel', 'cattery', 'pet nanny', 'dog hotel'],
  salon: ['hairdress', 'hair stylist', 'nail', 'lash', 'brow', 'beauty', 'blowout', 'haircut', 'braid', 'makeup artist', 'wax'],
  barber: ['barbershop', 'barber shop', 'mens haircut'],
  spa: ['med spa', 'medspa', 'facial', 'esthetic', 'aesthetic', 'day spa', 'sauna', 'skin care', 'skincare'],
  fitness: ['pilates', 'martial art', 'karate', 'boxing', 'bootcamp', 'boot camp', 'jiu jitsu', 'personal trainer', 'cycling studio'],
  chiropractor: ['physical therap', 'physiotherap', 'acupunct', 'sports injur'],
  'home-care': ['assisted living', 'elder care', 'eldercare', 'nursing', 'companion care', 'respite'],
  daycare: ['nursery', 'after school', 'afterschool', 'montessori', 'kindergarten'],
  tutoring: ['math tutor', 'music lesson', 'piano lesson', 'guitar lesson', 'coding class', 'coding school', 'coding for kid', 'programming class', 'stem class', 'reading class', 'speed reading', 'lesson'],
  contractor: ['handyman', 'general contractor', 'carpent', 'kitchen remodel', 'bathroom remodel', 'deck', 'flooring', 'drywall', 'concrete', 'mason', 'masonry', 'fence', 'cabinet'],
  electrician: ['electrician', 'wiring', 'generator install', 'ev charger'],
  hvac: ['furnace', 'heat pump', 'duct', 'air conditioning', 'ac service', 'cooling'],
  plumbing: ['drain', 'water heater', 'sewer', 'leak', 'pipe'],
  landscaping: ['lawn mow', 'mowing', 'gardener', 'gardening', 'irrigation', 'sod', 'hardscap', 'yard'],
  cleaning: ['maid', 'janitor', 'housekeep', 'carpet clean', 'window clean', 'office clean', 'commercial clean', 'move out clean'],
  roofing: ['roofer', 'gutter', 'shingle'],
  'auto-repair': ['auto', 'auto body', 'collision', 'brake', 'tire', 'transmission', 'oil change', 'body shop'],
  'car-detailing': ['ceramic coat', 'window tint', 'mobile detail', 'paint correction'],
  restaurant: ['pizzeria', 'pizza', 'grill', 'taqueria', 'taco', 'sushi', 'bbq', 'barbecue', 'burger', 'bar', 'pub', 'brewery', 'winery', 'vegan', 'steakhouse', 'kitchen and bar', 'food'],
  bakery: ['baker', 'cake', 'cupcake', 'donut', 'doughnut', 'dessert', 'pastr', 'cookie'],
  'coffee-shop': ['coffeehouse', 'coffee house', 'tea house', 'tea shop', 'juice bar', 'roaster', 'smoothie'],
  catering: ['meal prep', 'private chef', 'personal chef'],
  law: ['law office', 'law group', 'paralegal', 'personal injury', 'divorce', 'immigration', 'estate planning'],
  accounting: ['tax prep', 'payroll', 'bookkeeper', 'financial advis', 'tax service'],
  insurance: ['insurance agent', 'insurance broker'],
  'real-estate': ['property manag', 'home buyer', 'mortgage', 'real estate agent', 'broker'],
  dentist: ['tooth', 'teeth', 'dental clinic', 'oral surgeon'],
  photography: ['videograph', 'photographer', 'headshot'],
  'it-repair': ['managed it', 'cyber', 'network', 'phone repair', 'cell phone repair', 'computer', 'laptop repair'],
  moving: ['mover', 'moving', 'packing service'],
  'pest-control': ['termite', 'bed bug', 'mosquito', 'rodent', 'wildlife removal'],
  painting: ['painter', 'house paint', 'cabinet paint'],
  'pool-service': ['pool', 'hot tub', 'spa clean'],
  'tree-service': ['stump', 'tree trimm'],
  'pressure-washing': ['pressure clean'],
  'junk-removal': ['dumpster', 'cleanout', 'clean out'],
  locksmith: ['lockout', 'rekey', 'key cutting'],
  florist: ['bouquet', 'floral', 'flower'],
  tattoo: ['tattoo artist'],
  wedding: ['banquet', 'quinceanera', 'dj', 'party planner', 'event center', 'event space', 'event hall'],
  'party-rental': ['bounce', 'inflatable', 'water slide', 'photo booth', 'tent', 'party supply'],
  'mobile-grooming': ['groom van', 'grooming truck', 'mobile pet groom', 'mobile dog groom', 'mobile cat groom', 'mobile pet spa']
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SUFFIX = '(?:s|es|e|er|ers|ing|ings|ed|ian|ians|al|y|ie|ies|ic|ics|ist|ists|or|ors|ion|ions|ery|eries|ry)?';
const reCache = new Map();
// a keyword as whole words: its last letter may double (sit -> sitting) and it may take a common ending
function wordRe(kw) {
  const k = norm(kw);
  if (!k) return null;
  if (!reCache.has(k)) reCache.set(k, new RegExp('(?:^| )' + esc(k) + '(?:' + esc(k.slice(-1)) + ')?' + SUFFIX + '(?= |$)'));
  return reCache.get(k);
}
// words that only say "a business" or a broad trade: they count a little, so "roofing contractor" is Roofing
const WEAK = new Set(['contractor', 'construction', 'builder', 'remodel', 'renovation', 'food', 'lesson', 'bar', 'auto', 'computer', 'yard', 'pool', 'moving', 'beauty']);
const keywordsOf = (tpl) => [...new Set([...(tpl.keywords || []), ...(EXTRA[tpl.id] || [])])];

// parts: { type, name, more } (more = specialties, services ...). The business type counts most.
function detect(parts) {
  const p = typeof parts === 'string' ? { type: parts } : (parts || {});
  const fields = [[norm(p.type), 3], [norm(p.name), 2], [norm(p.more), 1]];
  let best = null;
  TEMPLATES.forEach((tpl, i) => {
    let score = 0, typeScore = 0; const hits = [];
    for (const kw of keywordsOf(tpl)) {
      const re = wordRe(kw); if (!re) continue;
      for (const [text, w] of fields) if (text && re.test(text)) {
        const s = w * (WEAK.has(norm(kw)) ? 3 : norm(kw).length + 2);
        score += s; if (w === 3) typeScore += s;
        if (!hits.includes(kw)) hits.push(kw);
        break;   // a keyword counts once, from the field that weighs most
      }
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && typeScore > best.typeScore))) best = { tpl, score, typeScore, hits, i };
  });
  if (!best) return { tpl: GENERIC_TEMPLATE, id: 'generic', label: GENERIC_TEMPLATE.label, sure: false, hits: [], how: 'none' };
  return { tpl: best.tpl, id: best.tpl.id, label: best.tpl.label, sure: best.typeScore > 0, hits: best.hits.slice(0, 4), how: 'words' };
}

// When the words found nothing: the AI chooses one of our industries (or none). aiComplete({ system, prompt, maxTokens }).
async function aiDetect(aiComplete, parts) {
  if (typeof aiComplete !== 'function') return null;
  const list = TEMPLATES.map(t => `${t.id}: ${t.label}`).join('\n');
  const p = typeof parts === 'string' ? { type: parts } : (parts || {});
  let text = '';
  try {
    text = await aiComplete({
      system: 'You sort small local businesses into industries. Answer with one industry id from the list and nothing else, or "none" if no industry on the list is close.',
      prompt: `Industries:\n${list}\n\nBusiness type: ${String(p.type || '').slice(0, 100)}\nBusiness name: ${String(p.name || '').slice(0, 80)}\nMore about it: ${String(p.more || '').slice(0, 300)}\n\nIndustry id:`,
      maxTokens: 20
    });
  } catch { return null; }
  const id = String(text || '').trim().toLowerCase().replace(/[^a-z-]/g, '');
  const tpl = TEMPLATES.find(t => t.id === id);
  return tpl ? { tpl, id: tpl.id, label: tpl.label, sure: true, hits: [], how: 'ai' } : null;
}

// ---- 2. logo colors -> one of our palettes ----

const GENERATOR_PALETTES = [
  { id: 'gen-blue', name: 'Clear blue', primary: '#2563eb', accent: '#1e293b' },
  { id: 'gen-teal', name: 'Deep teal', primary: '#0f766e', accent: '#134e4a' },
  { id: 'gen-amber', name: 'Amber', primary: '#b45309', accent: '#78350f' },
  { id: 'gen-rose', name: 'Rose', primary: '#be123c', accent: '#881337' },
  { id: 'gen-olive', name: 'Olive', primary: '#4d7c0f', accent: '#365314' },
  { id: 'gen-violet', name: 'Violet', primary: '#7c3aed', accent: '#4c1d95' },
  { id: 'gen-sky', name: 'Sky', primary: '#0369a1', accent: '#0c4a6e' },
  { id: 'gen-orange', name: 'Burnt orange', primary: '#c2410c', accent: '#7c2d12' }
];
const PALETTES = Palette.INDUSTRY.map(p => ({ id: p.id, name: p.name, primary: p.primary, accent: p.accent, for: p.for }))
  .concat(GENERATOR_PALETTES.filter(g => !Palette.INDUSTRY.some(p => p.primary === g.primary && p.accent === g.accent)));

function hexRgb(hex) { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lab(hex) {
  const lin = hexRgb(hex).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047, y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722, z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
// how different two colors look (CIE76 delta E: under about 10 = close, over 40 = clearly another color)
function deltaE(a, b) { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
// for matching: lightness counts half, since our palettes darken colors to keep buttons readable
function hueDist(a, b) { const p = lab(a), q = lab(b); return Math.hypot((p[0] - q[0]) * 0.5, p[1] - q[1], p[2] - q[2]); }
const satOf = (hex) => Palette.hexToHsl(hex).s;
const isGrey = (hex) => { const h = Palette.hexToHsl(hex); return h.s < 0.15 || h.l < 0.1; };

// colors: the logo's colors, best first. Returns { palette, distance, main, second, why } or null.
function matchPalette(colors, industryId) {
  const list = (colors || []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).map(c => c.toLowerCase());
  if (!list.length) return null;
  const colorful = list.filter(c => !isGrey(c));
  const main = colorful[0] || list[0];
  const second = list.find(c => c !== main) || '';
  const fits = (p) => industryFits(p, industryId);
  let best = null; const all = [];
  for (const p of PALETTES) {
    let d;
    if (!colorful.length) d = p.id === 'mono' ? 0 : 20 + deltaE(main, p.primary);   // black, white or grey logo
    else {
      // a dark logo color may be closest to a palette's dark accent (navy logo -> Trusted navy)
      d = Math.min(hueDist(main, p.primary), hueDist(main, p.accent) + 6);
      if (second && !isGrey(second)) d += 0.2 * Math.min(hueDist(second, p.primary), hueDist(second, p.accent));
    }
    const score = d - (fits(p) ? 6 : 0);
    all.push({ p, d, score });
    if (!best || score < best.score) best = { p, d, score };
  }
  const others = all.filter(x => x.p !== best.p).sort((x, y) => x.score - y.score).slice(0, 3).map(x => ({ id: x.p.id, name: x.p.name, primary: x.p.primary, accent: x.p.accent }));
  const own = Palette.fromLogo(colorful.length ? [main].concat(list.filter(c => c !== main)) : list);
  const close = best.d < 15 ? 'very close to' : best.d < 30 ? 'close to' : 'the nearest we have to';
  return {
    palette: { id: best.p.id, name: best.p.name, primary: best.p.primary, accent: best.p.accent },
    distance: Math.round(best.d), main, second, colors: list.slice(0, 5), others,
    exact: own ? { id: 'logo', name: "The logo's own colors", primary: own.primary, accent: own.accent } : null,
    why: colorful.length ? `The logo's main color ${main} is ${close} the "${best.p.name}" palette.` : `The logo is black, white or grey, so the "${best.p.name}" palette keeps it classic.`
  };
}
const industryFits = (p, id) => { const words = industryWords(id); return (p.for || []).some(w => words.some(x => x.includes(w) || w.includes(x))); };
function industryWords(id) {
  const tpl = TEMPLATES.find(t => t.id === id);
  return tpl ? [tpl.label.toLowerCase(), ...tpl.keywords.map(k => k.toLowerCase())] : [];
}

// The logo's main colors (needs sharp). buf: the logo file.
async function logoColors(buf, sharp) {
  if (!buf || !sharp) return [];
  try {
    const { data } = await sharp(buf, { density: 144 }).ensureAlpha().resize(120, 120, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    return Palette.extract(data, 5);
  } catch { return []; }
}

// ---- 3. new blocks for the industry ----

// industry -> group of block picks
const GROUP_OF = {
  pets: ['mobile-grooming', 'dog-training', 'pet-care', 'pet-grooming', 'veterinary'],
  trades: ['plumbing', 'electrician', 'hvac', 'roofing', 'contractor', 'painting', 'pest-control', 'pool-service', 'tree-service', 'pressure-washing', 'junk-removal', 'locksmith', 'moving', 'landscaping', 'cleaning', 'auto-repair', 'car-detailing', 'it-repair'],
  beauty: ['salon', 'barber', 'spa', 'tattoo', 'fitness', 'chiropractor'],
  food: ['restaurant', 'bakery', 'coffee-shop', 'catering', 'florist'],
  pro: ['law', 'accounting', 'insurance', 'real-estate', 'dentist'],
  care: ['home-care', 'daycare', 'tutoring'],
  events: ['wedding', 'party-rental', 'photography']
};
const groupOf = (id) => Object.keys(GROUP_OF).find(g => GROUP_OF[g].includes(id)) || 'generic';
// [block for the About spot, block next to Services, closing block]; social blocks are added when there are links
const PICKS = {
  pets: ['aboutstory', 'phototabs', 'shapeform'],
  trades: ['aboutfacts', 'framedphoto', 'shapeform'],
  beauty: ['aboutme', 'roundphoto', 'shapeform'],
  food: ['aboutcollage', 'framedphoto', 'shapeform'],
  pro: ['offsetphoto', 'photopairs', 'shapeform'],
  care: ['aboutstory', 'photopairs', 'shapeform'],
  events: ['aboutcollage', 'phototabs', 'shapeform'],
  generic: ['aboutstory', 'photopairs', 'shapeform']
};
const SOCIAL_PICK = { pets: 'socialfeed', beauty: 'socialfeed', food: 'socialfeed', events: 'socialfeed' };   // others: socialphoto
const GROUP_NAMES = { pets: 'Pets', trades: 'Home services and trades', beauty: 'Beauty, wellness and fitness', food: 'Food and flowers', pro: 'Offices and clinics', care: 'Care and learning', events: 'Events and photos', generic: 'General' };

// a lighter or darker shade of a color (amount > 0 mixes in white, < 0 black)
function mix(hex, amount) {
  const c = hexRgb(hex), t = amount > 0 ? 255 : 0, a = Math.abs(amount);
  return '#' + c.map(v => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join('');
}
const flat = (s, n) => String(s || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function sentences(text, max) {
  const paras = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const out = paras.length > 1 ? paras : String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  return out.slice(0, max).map(s => flat(s, 400));
}
function servicesLine(items) {
  const t = (items || []).map(x => flat(x && x.title, 60)).filter(Boolean).slice(0, 4);
  if (!t.length) return '';
  return 'We offer ' + (t.length === 1 ? t[0] : t.slice(0, -1).join(', ') + ' and ' + t[t.length - 1]) + '.';
}
function newId(taken) {
  let id;
  do id = 'b' + Array.from({ length: 7 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  while (taken.has(id));
  taken.add(id);
  return id;
}
const CLEAN = { phototabs: photoTabs, framedphoto: framedPhoto, shapeform: shapeForm, roundphoto: roundPhoto, photopairs: photoPairs, offsetphoto: offsetPhoto };
function cleanBlock(b) {
  const m = CLEAN[b.type];
  if (m) return { ...b, body: m.cleanBody(b.body), side: m.cleanSide(b.side) };
  if (aboutBlocks.SPECS[b.type]) return { ...b, body: aboutBlocks.cleanBody(b.type, b.body), side: aboutBlocks.cleanSide(b.type, b.side) };
  return b;
}

// One block, filled from the site. Returns null when the site lacks what the block needs.
function makeBlock(type, ctx) {
  const { name, sections: s, colors, photo, cta } = ctx;
  const P = colors.primary, A = colors.accent;
  const about = (s.about && s.about.body) || '';
  const services = ((s.services && s.services.items) || []).filter(x => x && x.title);
  const trust = s.trust || {};
  const base = { type, page: 'home', place: 'bottom', bg: 'none', side: '', imageUrl: '', buttonText: '', buttonUrl: '', heading: '', body: '' };
  const lines = (arr) => arr.filter(Boolean).join('\n');
  switch (type) {
    case 'aboutstory':
      if (!about) return null;
      return { ...base, heading: `About ${name}`, imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'right',
        body: lines([`label: ${ctx.label}`, ...sentences(about, 3).map(t => `text: ${t}`), `color: ${P}`, `bg: ${mix(P, 0.93)}`]) };
    case 'aboutfacts': { // only facts the client gave: years in business, credentials, towns served
      const facts = [];
      const yrs = (trust.stats || []).find(x => x && /year/i.test(x.label || ''));
      if (yrs && yrs.value) facts.push(`${yrs.value} ${yrs.label}`.toLowerCase().replace(/^./, c => c.toUpperCase()));
      (trust.badges || []).slice(0, 3).forEach(b => facts.push(b));
      if ((trust.serviceAreas || []).length) facts.push('Serving ' + trust.serviceAreas.slice(0, 4).join(', '));
      if (!facts.length) return makeBlock('aboutstory', ctx);
      if (!about) return null;
      return { ...base, heading: `About ${name}`, imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'left',
        body: lines([`label: ${ctx.label}`, ...sentences(about, 1).map(t => `text: ${t}`), ...facts.map(f => `fact: ${flat(f, 140)}`), `color: ${P}`]) };
    }
    case 'aboutme':
      if (!services.length) return null;
      return { ...base, heading: `Get to know ${name}`, imageUrl: photo(), side: 'left',
        body: lines([`label: ${ctx.label}`, sentences(about, 1)[0] ? `caption: ${flat(sentences(about, 1)[0], 200)}` : '', ...services.slice(0, 4).map(x => `item: ${flat(x.title, 60)} | ${flat(x.description, 240)}`), `color: ${P}`, `accent: ${mix(P, 0.55)}`]) };
    case 'aboutcollage': {
      if (!about) return null;
      const round = [photo(), photo()].filter(Boolean);
      return { ...base, heading: `About ${name}`, imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'left',
        body: lines([`label: ${ctx.label}`, ...sentences(about, 2).map(t => `text: ${t}`), ...round.map(u => `round: ${u}`), `color: ${P}`]) };
    }
    case 'offsetphoto':
      if (!about) return null;
      return { ...base, heading: `About ${name}`, imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'left',
        body: lines([`label: ${ctx.label}`, ...sentences(about, 3).map(t => `text: ${t}`), `color: ${mix(P, 0.7)}`, `accent: ${mix(A, 0.75)}`, `button: ${P}`]) };
    case 'phototabs':
      if (services.length < 2) return null;
      return { ...base, heading: 'What we offer', side: 'left', buttonText: cta, buttonUrl: '#contact',
        body: lines(services.slice(0, 4).map((x, i) => `card: ${photo()} | ${[P, A, mix(P, -0.25), mix(A, 0.25)][i]} | ${flat(x.title, 60)} | ${flat(x.description, 300)}`)) };
    case 'photopairs':
      if (services.length < 2) return null;
      return { ...base, heading: 'What we offer',
        body: lines([`label: ${ctx.label}`, ...services.slice(0, 4).map(x => `pair: ${photo()} | ${flat(x.title, 60)} | ${flat(x.description, 240)}`), `color: ${P}`]) };
    case 'framedphoto': {
      const line = servicesLine(services);
      if (!line) return null;
      return { ...base, heading: ctx.city ? `${ctx.label} in ${ctx.city}` : ctx.label, imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'right',
        body: lines([`text: ${line}`, `color: ${P}`, `bg: ${mix(A, -0.35)}`]) };
    }
    case 'roundphoto': {
      const line = servicesLine(services);
      if (!line) return null;
      return { ...base, heading: 'What we do', imageUrl: photo(), buttonText: cta, buttonUrl: '#contact', side: 'right', body: lines([`text: ${line}`, `color: ${P}`]) };
    }
    case 'shapeform': {
      const c = s.contact || {};
      return { ...base, heading: 'Get in touch', imageUrl: photo(), side: 'left',
        body: lines([c.phone ? `text: Call ${flat(c.phone, 40)} or send us a message.` : 'text: Send us a message and we will get back to you.', `color: ${P}`, `accent: ${mix(A, 0.35)}`, `panel: ${mix(P, 0.75)}`, `bg: ${mix(P, 0.94)}`]) };
    }
    case 'socialfeed': {
      const ig = ((s.contact || {}).social || {}).instagram || '';
      const handle = (ig.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1];
      const pics = (ctx.gallery || []).slice(0, 8);
      if (!ig || pics.length < 3) return makeBlock('socialphoto', ctx);
      return { ...base, heading: `Follow ${name}`, body: lines([handle ? `handle: @${handle}` : '', ...pics.map(u => `photo: ${u}`), `color: ${P}`]) };
    }
    case 'socialphoto':
      return { ...base, heading: `Follow ${name}`, imageUrl: photo(), side: 'left', body: lines(['label: Stay in touch', `color: ${P}`]) };
    default: return null;
  }
}

// site: { name, theme, sections } built by the generator. opts: { industryId, label, gallery: [urls], colors: {primary, accent} }
// Adds the blocks to sections.blocks and returns { blocks: [{ id, type, name }], mix } (mix = the Blocks home page list,
// or null when the home page should stay as it is: Signature and Style Library looks have their own home pages).
function plan(site, opts) {
  const o = opts || {};
  const s = site.sections, theme = site.theme || {};
  const group = groupOf(o.industryId);
  const gallery = (o.gallery || []).filter(Boolean);
  let gi = 0;
  const photo = () => (gallery.length ? gallery[(gi++) % gallery.length] : '');
  const social = (s.contact && s.contact.social) || {};
  const ctx = { name: site.name, sections: s, colors: o.colors || { primary: theme.primaryColor, accent: theme.accentColor }, photo, gallery,
    cta: flat((s.hero && s.hero.ctaText) || 'Contact Us', 40), label: flat(o.label || 'About us', 60), city: flat((s.meta && s.meta.city) || '', 60) };
  const [aboutType, serviceType, closeType] = PICKS[group];
  const items = (s.blocks && Array.isArray(s.blocks.items)) ? s.blocks.items : [];
  const taken = new Set(items.map(b => b.id).filter(Boolean));
  items.forEach(b => { if (!/^b[a-z0-9]{7}$/.test(b.id || '')) b.id = newId(taken); if (!b.page) b.page = 'home'; });
  const add = (type) => { const b = makeBlock(type, ctx); if (!b) return null; const c = cleanBlock({ ...b, id: newId(taken) }); items.push(c); return c; };
  const aboutBlk = add(aboutType), serviceBlk = add(serviceType);
  const socialBlk = (social.instagram || social.facebook) ? add(social.instagram && SOCIAL_PICK[group] ? 'socialfeed' : 'socialphoto') : null;
  const closeBlk = add(closeType);
  s.blocks = { ...(s.blocks || {}), items };
  const added = [aboutBlk, serviceBlk, socialBlk, closeBlk].filter(Boolean);

  let mix = null;
  const lay = theme.homeLayout;
  if (added.length && lay !== 'atelier' && lay !== 'stylelib') {
    const seed = mixPage.seed({ theme }, o.industryId || 'generic', 'full');
    const own = items.filter(b => !added.includes(b) && (b.page || 'home') === 'home').map(b => ({ k: 'blk', v: b.id }));
    const blk = (b) => (b ? [{ k: 'blk', v: b.id }] : []);
    const out = [];
    let aboutPlaced = false, servicesSeen = false;
    for (const it of seed) {
      if (it.f === 'about' && aboutBlk) { out.push(...blk(aboutBlk)); aboutPlaced = true; continue; }   // the new About block takes the About spot
      if (it.f === 'contact' && closeBlk) continue;   // the contact block with the form closes the page instead
      if ((it.f === 'faq') && socialBlk) { out.push(...blk(socialBlk)); }
      out.push(it);
      if (it.f === 'hero' && aboutBlk && !seed.some(x => x.f === 'about')) { out.push(...blk(aboutBlk)); aboutPlaced = true; }
      if (it.f === 'services') { servicesSeen = true; out.push(...blk(serviceBlk), ...own); }
    }
    if (!servicesSeen) out.splice(Math.min(out.length, aboutPlaced ? 2 : 1), 0, ...blk(serviceBlk), ...own);
    if (socialBlk && !out.some(m => m.k === 'blk' && m.v === socialBlk.id)) out.push(...blk(socialBlk));
    out.push(...blk(closeBlk));
    mix = mixPage.clean(out);
  }
  const decor = (mix && o.decor !== false) ? addDecor(group, s, mix, ctx.colors, { about: aboutBlk, service: serviceBlk, close: closeBlk }) : [];
  if (decor.length) mix = mixPage.clean(mix);
  return { group, groupName: GROUP_NAMES[group], blocks: added.map(b => ({ id: b.id, type: b.type, name: mixPage.BLOCK_KINDS[b.type] || b.type })), mix, decor };
}

// Decorations for the new home page (Leo, 2026-11-10: "let the generator use them"): for pet businesses a patch of
// grass under the About block for cut-out pets to stand on, a faint paw watermark behind the services, and a paw-print
// pattern over the reviews or FAQ section. Only looks, never words. Returns what it added, in the owner's words.
const DECOR = {
  pets: { scene: 'grass:garden:m', mark: 'dog-section', pattern: { g: 'txp-paws', c: 'brand_o20', b: 1 }, patternOn: ['testimonials', 'faq', 'why'] },
};
function addDecor(group, s, mix, colors, blocks) {
  const d = DECOR[group];
  if (!d) return [];
  const done = [];
  const itemOf = (b) => (b ? mix.find(m => m.k === 'blk' && m.v === b.id) : null);
  const about = itemOf(blocks.about), close = itemOf(blocks.close), grassOn = about || close;
  if (grassOn && d.scene && !grassOn.scene) { grassOn.scene = d.scene; done.push('Grass along the bottom of the ' + (about ? 'About' : 'contact') + ' block'); }
  if (blocks.service && d.mark) {
    const w = watermark.fromPreset(d.mark, { id: 'w' + nanoId(), page: 'home', part: 'b:' + blocks.service.id, el: '', color: HEX.test(String(colors && colors.primary)) ? colors.primary.toLowerCase() : watermark.DEFAULT_COLOR });
    if (w) { s.texts = { ...(s.texts || {}) }; s.texts.wmarks = watermark.clean([...(s.texts.wmarks || []), w]); done.push('A faint paw watermark behind the services'); }
  }
  // only on a section that will show (one with nothing in it is left off the page)
  const has = { testimonials: ((s.testimonials || {}).items || []).length, faq: ((s.faq || {}).items || []).length, why: ((s.whyChoose || {}).items || []).length };
  const pat = d.pattern && d.patternOn.filter(f => has[f]).map(f => mix.find(m => m.k === 'lib' && m.f === f && !m.bg)).find(Boolean);
  if (pat) { pat.bg = d.pattern; done.push('A paw-print pattern on the ' + (mixPage.TYPES[pat.f] || pat.f) + ' section'); }
  return done;
}
const HEX = /^#[0-9a-f]{6}$/i;
const nanoId = () => { let x = ''; while (x.length < 7) x += Math.random().toString(36).slice(2); return x.slice(0, 7); };
// After the preview swaps palettes: decorations drawn in the old brand color take the new one
function recolorDecor(sections, from, to) {
  const w = ((sections && sections.texts) || {}).wmarks;
  if (!Array.isArray(w) || !from || !to || !HEX.test(String(to.primary))) return;
  w.forEach(t => { if (t && String(t.color).toLowerCase() === String(from.primary).toLowerCase()) t.color = to.primary.toLowerCase(); });
}

// every shade plan() derives from the two colors (kept in step with makeBlock)
const shades = (P, A) => [[P, 0], [P, 0.93], [P, 0.55], [P, 0.7], [P, -0.25], [P, 0.75], [P, 0.94], [A, 0], [A, 0.75], [A, 0.25], [A, -0.35], [A, 0.35]]
  .map(([c, a]) => (a ? mix(c, a) : c.toLowerCase()));
// Change the colors of the blocks plan() added (ids) from one pair to another, shade for shade.
function recolor(items, ids, from, to) {
  const a = shades(from.primary, from.accent), b = shades(to.primary, to.accent), want = new Set(ids || []);
  for (const blk of items || []) {
    if (!want.has(blk.id)) continue;
    blk.body = String(blk.body || '').split('\n').map(line => line.replace(/#[0-9a-f]{6}\b/gi, (h) => { const i = a.indexOf(h.toLowerCase()); return i >= 0 ? b[i] : h; })).join('\n');
  }
}

module.exports = { DECOR, recolorDecor, EXTRA, detect, aiDetect, wordRe, PALETTES, matchPalette, deltaE, logoColors, GROUP_OF, PICKS, groupOf, plan, makeBlock, mix, recolor, industryFits };
