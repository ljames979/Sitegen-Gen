// Client questionnaire: a public form the owner sends to a new client. Everything the client types is
// cleaned here, shown to the owner for review, and (on "Build the website") turned into a real site
// using ONLY what the client provided. Nothing is invented: a claim appears on the site only because
// the client wrote it, and the review screen reminds the owner to check them.
const { str, isValidEmail, isSafeUrl, isValidHexColor } = require('./validate');
const grounding = require('./grounding');

const MOODS = [
  ['modern', 'Clean and modern', 'Fresh, friendly, easy to read. Works for almost anything.', '#2563eb'],
  ['classic', 'Classic and trustworthy', 'Traditional serif headings. Long-established, professional.', '#1e3a5f'],
  ['bold', 'Bold and confident', 'Big, high-contrast, strong. Trades, fitness, contractors.', '#dc2626'],
  ['warm', 'Warm and welcoming', 'Cozy and rounded. Food, care, family businesses.', '#d97706'],
  ['luxe', 'Elegant and upscale', 'Cream tones, thin lines, refined. Salons, spas, boutiques.', '#a1887f'],
  ['coastal', 'Calm and airy', 'Soft blues, gentle corners. Health, cleaning, wellness.', '#0891b2'],
  ['playful', 'Playful and bright', 'Rounded, colorful, fun. Kids, pets, events.', '#db2777'],
  ['corporate', 'Professional and corporate', 'Square, structured, full home page. Insurance, finance, consulting.', '#334155'],
  ['earthy', 'Natural and earthy', 'Natural tones and story-style rows. Gardens, farms, handmade.', '#65a30d'],
  ['noir', 'Dark and luxurious', 'Black with a warm glow and elegant lettering. Grooming, barbers, detailing, jewelers, restaurants.', '#c9a24b'],
  ['gallery', 'Photo-first', 'Big image tiles that let your work speak. Photographers, builders, salons.', '#111827'],
  ['', 'Not sure: choose for me', 'We will pick a look that suits your type of business.', '#9ca3af']
];
const MOOD_IDS = MOODS.map(m => m[0]);

const GOALS = [['calls', 'Get more phone calls'], ['quotes', 'Get quote or contact requests'], ['bookings', 'Get appointments booked'], ['showcase', 'Show off our work or menu'], ['trust', 'Look credible and professional'], ['info', 'Share hours, location and information']];
const FEATURES = [
  ['booking', 'Online booking (customers pick a date and time)'],
  ['estimate', 'A price estimate calculator'],
  ['chat', 'A chat assistant that answers common questions'],
  ['blog', 'A news or tips blog'],
  ['reviews', 'Customer reviews on the site'],
  ['gallery', 'A photo gallery'],
  ['spanish', 'A Spanish version of the site'],
  ['store', 'Selling products online']
];
const FEATURE_IDS = FEATURES.map(f => f[0]);
const GOAL_IDS = GOALS.map(g => g[0]);

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const urls = (v, n) => arr(v).map(x => str(x, 500)).filter(x => /^\/uploads\/[A-Za-z0-9._-]+$/.test(x)).slice(0, n);

function clean(b) {
  b = b || {};
  const names = arr(b.svc_name), descs = arr(b.svc_desc), prices = arr(b.svc_price);
  const services = [];
  for (let i = 0; i < Math.min(8, names.length); i++) {
    const name = str(names[i], 60), desc = str(descs[i], 300), price = str(prices[i], 40);
    if (name) services.push({ name, desc, price });
  }
  // what sets the business apart: one short line each (older submissions have one free-text box)
  const diffs = arr(b.diff_item).map(x => str(x, 160)).filter(Boolean).slice(0, 5);
  if (!diffs.length && str(b.diff, 600)) diffs.push(str(b.diff, 600));
  const qs = arr(b.faq_q), as = arr(b.faq_a), faq = [];
  for (let i = 0; i < Math.min(6, qs.length); i++) {
    const q = str(qs[i], 160), a = str(as[i], 500);
    if (q && a) faq.push({ q, a });
  }
  const link = (v) => (isSafeUrl(v) ? str(v, 300) : '');
  return {
    bizName: str(b.biz_name, 80), bizType: str(b.biz_type, 100), city: str(b.city, 80), years: str(b.years, 4).replace(/\D/g, ''),
    tagline: str(b.tagline, 160),
    services, diffs, diff: diffs.join(' '), areas: str(b.areas, 400), tone: grounding.TONE_IDS.includes(b.tone) ? b.tone : '',
    about: str(b.about, 1500), badges: str(b.badges, 400),
    phone: str(b.phone, 40), email: isValidEmail(b.email || '') ? str(b.email, 254) : '', address: str(b.address, 200),
    hrsWeekday: str(b.hrs_weekday, 40), hrsSat: str(b.hrs_sat, 40), hrsSun: str(b.hrs_sun, 40),
    facebook: link(b.facebook), instagram: link(b.instagram), otherLink: link(b.other_link),
    mood: MOOD_IDS.includes(b.mood) ? b.mood : '', brandColor: isValidHexColor(b.brand_color) && b.no_color !== '1' ? b.brand_color.trim() : '',
    logo: urls(b.logo, 1)[0] || '', photos: urls(b.photos, 8), stockOk: b.stock_ok === '1' || b.stock_ok === 'on',
    inspo: str(b.inspo, 600), inspoLike: str(b.inspo_like, 400),
    goal: GOAL_IDS.includes(b.goal) ? b.goal : '', features: arr(b.features).filter(f => FEATURE_IDS.includes(f)),
    faq, notes: str(b.notes, 1500), pkg: str(b.pkg, 40), // pkg is checked against the owner's packages by the route
    contactName: str(b.contact_name, 100), contactEmail: isValidEmail(b.contact_email || '') ? str(b.contact_email, 254) : '', contactPhone: str(b.contact_phone, 40),
    agree: b.agree === '1' || b.agree === 'on'
  };
}

// what must be present before a submission is accepted
function problems(d) {
  const p = [];
  if (!d.bizName) p.push('Your business name is needed.');
  if (!d.bizType) p.push('Please tell us what kind of business it is.');
  if (!d.contactName) p.push('Please add your name.');
  if (!d.contactEmail) p.push('Please add a valid email address so we can reach you.');
  if (!d.agree) p.push('Please tick the box to confirm your information is accurate.');
  return p;
}

// the same field names the dashboard "generate" form uses, so applyIntake does the contact / hours / badge work
function toGenerateBody(d) {
  return {
    phone: d.phone, email: d.email, address: d.address, city: d.city, facebook: d.facebook, instagram: d.instagram,
    weekday_hours: d.hrsWeekday, saturday_hours: d.hrsSat, sunday_hours: d.hrsSun,
    years_in_business: d.years, badges: d.badges, service_areas: d.areas,
    use_brand_color: d.brandColor ? '1' : '', brand_color: d.brandColor
  };
}

// requested extras that need the owner's own setup (prices, hours, products) and so are not switched on blindly
function todoList(d) {
  const t = [];
  if (d.features.includes('booking') || d.goal === 'bookings') t.push('Online booking: turn it on in the editor and check the services, times and hours.');
  if (d.features.includes('estimate')) t.push('Estimate calculator: add your questions and prices (Settings → Quote / estimate calculator).');
  if (d.features.includes('blog')) t.push('Blog: write the first posts (News & Tips section).');
  if (d.features.includes('reviews')) t.push('Reviews: add real customer reviews or connect Google reviews.');
  if (d.features.includes('spanish')) t.push('Spanish version: not built in yet. Offer it as a separate site or page.');
  if (d.features.includes('store')) t.push('Selling products online: not built in. Discuss options with the client.');
  if (d.inspo) t.push('The client likes these sites: ' + d.inspo.replace(/\s+/g, ' ').slice(0, 300));
  if (d.notes) t.push('Client notes: ' + d.notes.replace(/\s+/g, ' ').slice(0, 300));
  if (!d.services.length) t.push('The client listed no services: the template\'s generic services were kept. Replace them with the real ones.');
  if (!d.about) t.push('The client wrote no "about" text: the about section only says what we know (name, type, city). Ask for a few sentences.');
  if (!d.faq.length) t.push('No customer questions were given, so the FAQ section is left out until you add real ones.');
  if (!d.logo) t.push('No logo uploaded: the site uses the business name as text.');
  if (!d.photos.length) t.push(d.stockOk ? 'No photos uploaded: stock photos were used. Ask for real ones.' : 'No photos uploaded and none wanted from stock: add photos before launch.');
  return t;
}

// the claims the client typed that appear on the site as facts: the owner should verify them
function claimsToCheck(d) {
  const c = [];
  if (d.badges) c.push('Credentials shown on the site: ' + d.badges.replace(/\s+/g, ' '));
  if (d.years) c.push(`Years in business: ${d.years}`);
  (d.diffs || []).forEach(x => c.push('"What makes us different": ' + x.replace(/\s+/g, ' ').slice(0, 200)));
  d.services.filter(x => x.price).forEach(x => c.push(`Price shown for ${x.name}: ${x.price}`));
  return c;
}

module.exports = { TONES: grounding.TONES, MOODS, MOOD_IDS, GOALS, FEATURES, clean, problems, toGenerateBody, todoList, claimsToCheck };
