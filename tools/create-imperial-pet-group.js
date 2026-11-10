// One-off (Leo, 2026-11-10): build the new "Imperial Pet Group" site (dog and cat grooming) as a normal, fully editable
// SiteGen site: a Blocks (mix) home page made only of standard content blocks, so every section can be edited, moved,
// duplicated or deleted in the editor and on the Blocks page. Colors, fonts, buttons and cards come from the site's
// theme tokens (themetokens.js), the paws, seal, sparkles, bubbles and peeking pets are + Add picture / + Shape / + Stamp
// pieces and watermarks you can move, resize, recolor or delete. Every [BRACKET] is a placeholder for you to fill in,
// and every photo is a labeled stand-in picture until you upload your own.
//
// Run it once:  node tools/create-imperial-pet-group.js
// It makes a NEW site (your old "Imperial Pet Grooming" site is not touched) and prints its editor address.
// Running it again makes nothing new while a site with the address imperial-pet-group exists.
// Still to come (Leo asked for them last): the Invitation Reveal envelope (the welcome card is a Decorative card until
// then) and the Scene Decor picket fence (the banner shows a labeled placeholder where it goes).
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { defaultSections, defaultTheme } = require('../defaults');
const themeTokens = require('../themetokens');
const decoCard = require('../decocard');
const mixPage = require('../mixpage');
const watermark = require('../watermark');
const picBoxes = require('../picboxes');
const textBoxes = require('../textboxes');

const SLUG = 'imperial-pet-group', NAME = 'Imperial Pet Group';
if (db.prepare('SELECT id FROM sites WHERE slug = ?').get(SLUG)) { console.log(`A site with the address "${SLUG}" already exists. Nothing changed.`); process.exit(0); }
const owner = db.prepare("SELECT user_id FROM sites WHERE slug = 'imperial-dog-grooming'").get() || db.prepare('SELECT id AS user_id FROM users ORDER BY id LIMIT 1').get();
if (!owner) { console.error('No SiteGen account found. Sign up in SiteGen first, then run this again.'); process.exit(1); }

// ---- labeled stand-in pictures (section 16): replace each one with ✂ / Change photo in the editor ----
const UP = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UP, { recursive: true });
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function slot(file, label, hint, w = 900, h = 900, bg = '#eaf5fc', ink = '#2e5b7a') {
  const f = path.join(UP, `ipg-slot-${file}.svg`);
  const lines = [label].concat(hint ? [hint] : []);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>`
    + `<rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="${ink}" stroke-width="4" stroke-dasharray="18 14" rx="24"/>`
    + `<g fill="${ink}" font-family="Arial, sans-serif" text-anchor="middle">`
    + `<path transform="translate(${w / 2 - 48} ${h / 2 - 120}) scale(4)" d="M3 18h18v2H3zM3 16l2-9 5 4 2-6 2 6 5-4 2 9z"/>`
    + lines.map((l, i) => `<text x="${w / 2}" y="${h / 2 + 30 + i * 46}" font-size="${i ? 26 : 36}" font-weight="${i ? 400 : 700}">${esc(l)}</text>`).join('')
    + '</g></svg>';
  fs.writeFileSync(f, svg);
  return `/uploads/ipg-slot-${file}.svg`;
}
const IMG = {
  hero: slot('hero-dog', '[HERO IMAGE]', 'Golden retriever, pink towel, cut-out', 900, 900),
  puppies: slot('puppies', '[PUPPIES IMAGE]', 'Puppies peeking, cut-out', 700, 420, '#fdeef4', '#8e2350'),
  cats3: slot('cats-trio', '[CATS IMAGE]', 'Cats trio peeking, cut-out', 700, 420, '#fdeef4', '#8e2350'),
  dogsWall: slot('dogs-wall', '[DOGS PEEKING OVER WALL PHOTO]', '', 1000, 800),
  catsPhoto: slot('cats-photo', '[CATS PHOTO]', 'On white', 1000, 800, '#ffffff'),
  reviewDog: slot('review-dog', '[REVIEW DOG PHOTO]', 'Nearly square', 900, 860, '#fdeef4', '#8e2350'),
  av1: slot('avatar-1', '[PET 1]', '', 300, 300), av2: slot('avatar-2', '[PET 2]', '', 300, 300), av3: slot('avatar-3', '[PET 3]', '', 300, 300),
  g1: slot('groomer-1', '[GROOMER 1]', '', 440, 440), g2: slot('groomer-2', '[GROOMER 2]', '', 440, 440), g3: slot('groomer-3', '[GROOMER 3]', '', 440, 440),
  dogCat: slot('dog-orange-cat', '[DOG + ORANGE CAT]', 'Cut-out', 700, 600, '#fdeef4', '#8e2350'),
  leapCat: slot('leaping-cat', '[LEAPING CAT]', 'Cut-out', 700, 500, '#fdeef4', '#8e2350'),
  dogMenu: slot('menu-dogs', '[DOG GROOMING PHOTO]', '', 900, 400), catMenu: slot('menu-cats', '[CAT GROOMING PHOTO]', '', 900, 400)
};

// ---- theme: Leo's tokens drive the colors, fonts, buttons and cards ----
const tokens = themeTokens.clean(themeTokens.IMPERIAL);
const theme = {
  ...defaultTheme(), style: 'modern', homeLayout: 'mix', tokens,
  emoji: '👑 🐾', header: '', glassNav: true, softShadows: true, hoverLift: true, motionStyle: 'lively', corners: 'round'
};
Object.assign(theme, themeTokens.linked(theme));

// ---- blocks ----
const used = new Set();
const bid = () => { let id; do { id = 'b' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'); } while (used.has(id) || !/^b[a-z0-9]{7}$/.test(id)); used.add(id); return id; };
const block = (type, o) => ({ id: bid(), type, heading: '', body: '', imageUrl: '', buttonText: '', buttonUrl: '', side: 'auto', bg: 'none', bgmix: '', bgink: '', gx: '', cardbg: '', cardgx: '', edge: 'none', place: 'bottom', page: 'home', pin: '', film: '', imgfx: '', height: '', ...o });
const BOOK = '#book';

// 3. hero: words left, the cut-out dog right on blush
const hero = block('photoblend', {
  heading: 'Grooming Fit for Royalty.',
  body: ['top: DOG & CAT GROOMING', 'badge: NOW BOOKING · Dogs & cats welcome', 'note: Expert dog and cat grooming with the patience, care, and attention to detail your pet deserves.', `photos: ${IMG.hero}`, 'color: #fdeef4'].join('\n'),
  buttonText: 'Book an Appointment', buttonUrl: BOOK, side: 'right:cut'
});
// 4. welcome: the Royal invitation card (becomes the Invitation Reveal envelope once that block is built)
const welcome = block('decocard', {
  heading: 'Welcome to Imperial Pet Group',
  body: decoCard.cleanBody([
    'style: royal', 'icon: crown', 'eyebrow: By Royal Appointment', 'tagline: Purveyors of Fine Dog & Cat Grooming',
    'text: At Imperial Pet Group, every dog and cat who walks through our doors gets the royal treatment. Our experienced groomers combine gentle handling with professional skill, so your pet leaves looking great and feeling even better.',
    "quote: Because to you, they're not just a pet. They're family.",
    'detail: [ADDRESS]', 'detail: [PHONE]', 'detail: [HOURS]',
    'border: #d9578f', 'card: #ffffff', 'headc: #3d1f45', 'bodyc: #4a3f50', 'accc: #a8285e', 'btnc: #b8326a',
    'sec: glow', 'sec1: #ffffff', 'sec2: #c9e4f5'
  ].join('\n')),
  buttonText: 'Book Your Visit', buttonUrl: BOOK
});
// 5. why choose us: six glass-blue cards
const why = block('features', {
  heading: 'Why Pet Parents Choose Imperial',
  body: [
    'Dogs and cats, both welcome | Trained for the unique needs of each, including cat grooming many salons skip.',
    'Gentle, patient handling | We never rush. Breaks, treats, and calm voices are part of every visit.',
    'Clean, safe salon | Sanitized tools and stations between every pet. Safety comes first.',
    'Breed-specific styling | From doodle teddy-bear cuts to classic breed trims, we know the look.',
    'Premium products | Gentle, pet-safe shampoos suited to every coat and skin type.',
    'Easy booking | Online scheduling, reminders, and a friendly team ready to help.'
  ].join('\n')
});
// 6 and 7. dog and cat: photo on a dotted shape overlapping a white square card
const dogs = block('overlapcard', {
  heading: 'Tails Wagging, Coats Gleaming',
  body: ['Your dog already rules the house, so their coat should look the part. Every pup gets a calm bath, a cut made for their breed and plenty of praise along the way.',
    '✓ Bath, blow-dry and brush-out', '✓ Breed-specific cuts and styling', '✓ Nail trims and ear cleaning'].join('\n'),
  imageUrl: IMG.dogsWall, buttonText: 'See Dog Services', buttonUrl: '#services',
  side: 'dots:#f2a9c6:left:white:flat:#d6ebf8:#b8326a:#fbd9e7:flat'
});
const cats = block('overlapcard', {
  heading: 'Purr-fectly Pampered',
  body: ["Cats don't ask for much: a sunny window, a soft throne and a groomer who respects their schedule. We work calmly, quietly and at your cat's pace.",
    '✓ Calm, cat-only handling at their pace', '✓ Lion cuts and mat removal', '✓ Gentle nail trims and ear cleaning'].join('\n'),
  imageUrl: IMG.catsPhoto, buttonText: 'See Cat Services', buttonUrl: '#services',
  side: 'dots:#d6ebf8:right:white:flat:#fdeef4:#7fb3d8:#eaf5fc:flat'
});
// 8. the Royal Menu: every price lives in this one block (one line per card), extras as chips under it
const menu = block('pricing', {
  heading: 'The Royal Menu', bg: 'tint',
  body: [
    'Dog Grooming | From $[XX] | The Royal Spa (full groom: bath; cut; nails; ears; finishing spritz) · From $[XX], The Noble Bath (bath; blow-dry; brush-out; nails; light tidy) · From $[XX], Puppy\'s First Coronation (gentle sessions for puppies under 6 months) · From $[XX], De-Shedding Treatment (deep brush-out for double coats) · From $[XX]',
    'Cat Grooming | From $[XX] | The Royal Feline Groom (bath; blow-dry; brush-out; nails; ears; at your cat\'s pace) · From $[XX], Lion Cut (full-body shave with mane; boots and tail tuft) · From $[XX], Mat Removal (careful comb-out to restore comfort) · From $[XX], Nail Trim (quick; gentle; low-stress) · From $[XX]'
  ].join('\n'),
  buttonText: 'Book an Appointment', buttonUrl: BOOK
});
const extras = block('chips', {
  heading: 'Royal Extras', bg: 'tint',
  body: ['Blueberry facial · $[XX]', 'Teeth brushing · $[XX]', 'Paw balm · $[XX]', 'Flea & tick bath · $[XX]', 'Nail polish · $[XX]', 'Bows & bandanas · $[XX]', 'De-shedding · $[XX]'].join('\n'),
  buttonText: 'Book an Appointment', buttonUrl: BOOK
});
// 9. reviews: placeholders only (never made-up reviews); replace each with a real one
const reviews = block('reviewcard', {
  heading: 'Happy Tails',
  body: ['bg: #f2a9c6', 'card: #ffffff',
    `review: ${IMG.av1} | [Client review here, in your pet's voice] | [Pet name] · as told to [Owner name]`,
    `review: ${IMG.av2} | [Client review here, in your pet's voice] | [Pet name] · as told to [Owner name]`,
    `review: ${IMG.av3} | [Client review here, in your pet's voice] | [Pet name] · as told to [Owner name]`].join('\n'),
  imageUrl: IMG.reviewDog, buttonText: 'Read more reviews on Google →', buttonUrl: '#', side: 'left'
});
// 10. the team
const team = block('team', {
  heading: 'Meet the Royal Court',
  body: [
    `[Groomer name] | Owner & Head Groomer | [Years] years of experience. Specialty: doodles, show cuts and nervous first-timers. | ${IMG.g1}`,
    `[Groomer name] | Feline Specialist | Calm hands for cats of every temperament. Loves a good lion cut. | ${IMG.g2}`,
    `[Groomer name] | Groomer & Bather | Bubble-bath expert and treat dispenser. Senior pets are her favorite. | ${IMG.g3}`
  ].join('\n')
});
// 11. FAQ (also sent to search engines as an FAQ)
const faq = block('accordion', {
  heading: 'Questions From the Court', bg: 'tint',
  body: [
    'How often should my pet be groomed? | Most dogs do best every 4–8 weeks, depending on coat type. Long-haired cats benefit from grooming every 6–8 weeks. We can recommend a schedule for your pet.',
    "How long does an appointment take? | Most grooms take 2–4 hours, depending on size, coat and services. We'll text you when your pet is ready for pickup.",
    "Do I need proof of vaccinations? | Yes. For everyone's safety we require a current rabies vaccination, and dogs also need Bordetella and DHPP. [Confirm requirements]",
    "My pet is anxious or older. Can you help? | Absolutely. Let us know ahead of time and we'll schedule extra time, take breaks and keep the visit as calm as possible.",
    'What if my pet is matted? | Some mats can be brushed out. Severe matting usually means a shave-down, which is more comfortable for your pet. We always talk with you first.',
    "What is your cancellation policy? | Please give us at least 24 hours' notice to cancel or reschedule. [Adjust to your policy]"
  ].join('\n'),
  buttonText: 'Call [PHONE]', buttonUrl: '#book'
});
// 12. royalty banner (pink band); the seal, sparkles and pets are pieces on top of it
const banner = block('cta', {
  heading: 'Every Pet Is Royalty Here', body: 'Pampered like royalty. Loved like family.', bg: 'brand'
});
// 13. call to action, anchored as #book: every Book button lands here
const cta = block('cta', {
  heading: 'Ready for the Royal Treatment?', body: "Book your pet's appointment today. Dogs and cats welcome.",
  bg: 'g-brand-bold', buttonText: 'Book Now', buttonUrl: '#book'
});

const order = [hero, welcome, why, dogs, cats, menu, extras, reviews, team, faq, banner, cta];
const sections = defaultSections();
sections.blocks.items = order;
const mix = mixPage.clean(order.map((b) => ({ k: 'blk', f: 'own', v: b.id, ...(b === cta ? { a: 'book' } : b === menu ? { a: 'services' } : b === faq ? { a: 'faq' } : b === welcome ? { a: 'about' } : {}) })));
theme.mix = mix;

// header, footer, contact, hours, SEO (section 2, 14, 15)
Object.assign(sections.hero, { headline: 'Grooming Fit for Royalty.', subheadline: 'Expert dog and cat grooming with the patience, care, and attention to detail your pet deserves.', ctaText: 'Book Now', ctaLink: BOOK, eyebrow: 'DOG & CAT GROOMING', float: 'bubbles' });
Object.assign(sections.contact, { phone: '[PHONE]', email: '[EMAIL]', address: '[ADDRESS], [CITY], FL [ZIP]', footerHours: true, acceptSubmissions: true, social: { facebook: '', instagram: '', twitter: '' } });
sections.hours.items = [{ day: 'Mon–Fri', time: '[HOURS]' }, { day: 'Saturday', time: '[HOURS]' }, { day: 'Sunday', time: '[HOURS]' }];
sections.services.items = [
  { title: 'Dog Grooming', description: 'Baths, breed-specific cuts, nails and ears.' },
  { title: 'Cat Grooming', description: "Calm, cat-only grooming at your cat's pace." },
  { title: 'Royal Extras', description: 'Facials, teeth brushing, paw balm and more.' }
];
sections.services.heading = 'Services'; sections.about.heading = 'About'; sections.faq.heading = 'FAQ'; sections.contact.heading = 'Contact';
sections.about.body = "At Imperial Pet Group, every dog and cat who walks through our doors gets the royal treatment. Because to you, they're not just a pet. They're family.";
sections.faq.items = faq.body.split('\n').map(l => { const i = l.indexOf('|'); return { question: l.slice(0, i).trim(), answer: l.slice(i + 1).trim() }; });
sections.meta = { ...sections.meta, businessType: 'pet grooming', city: '[CITY]' };
const seoTitle = 'Imperial Pet Group | Dog & Cat Grooming in [CITY], FL';
const seoDesc = 'Royal-treatment dog and cat grooming in [CITY]. Gentle, patient groomers, breed-specific cuts and cat-friendly care. Book online today.';
sections.seo.title = seoTitle; sections.seo.description = seoDesc;

// ---- decorations: editable pieces, not baked into pictures ----
let pn = 0, tn = 0;
const pid = () => 'p' + String(++pn).padStart(2, '0') + Math.random().toString(36).slice(2, 7).padEnd(5, '0');
const tid = () => 't' + String(++tn).padStart(2, '0') + Math.random().toString(36).slice(2, 7).padEnd(5, '0');
const at = (b) => 'b:' + b.id;
const pics = [
  // hero: six glass bubbles around the dog (+ Shape > Dot), light blue, at different sizes
  ...[[54, 12, 5], [88, 8, 3.5], [93, 46, 6], [58, 70, 3], [86, 80, 4.5], [50, 40, 2.5]].map(([x, y, w]) => ({ id: pid(), page: 'home', at: at(hero), x, y, w, h: w * 1.6, art: 'shape-dot', color: '#d6ebf8' })),
  // welcome: peeking pets over the bottom edge (your two cut-outs take turns until you add more)
  { id: pid(), page: 'home', at: at(welcome), x: 6, y: 80, w: 30, h: 20, art: 'peek', photos: [IMG.puppies], fit: 'fit' },
  { id: pid(), page: 'home', at: at(welcome), x: 64, y: 80, w: 30, h: 20, art: 'peek', photos: [IMG.cats3], fit: 'fit' },
  // dog section: a few faint paws on the right
  { id: pid(), page: 'home', at: at(dogs), x: 90, y: 8, w: 5, h: 8, art: 'pawline', color: '#ffffff', turn: 18 },
  { id: pid(), page: 'home', at: at(dogs), x: 94, y: 22, w: 4, h: 7, art: 'pawline', color: '#a9d0ea', turn: 30 },
  // royalty banner: the seal (round stamp), two sparkles, and the two cut-out pets
  { id: pid(), page: 'home', at: at(banner), x: 70, y: 4, w: 13, h: 58, art: 'stamp-round', color: '#ffffff', turn: -12, text: 'IMPERIAL PET GROUP · EST. [YEAR]', sub: '👑' },
  { id: pid(), page: 'home', at: at(banner), x: 14, y: 10, w: 3, h: 5, art: 'shape-sparkle', color: '#ffffff' },
  { id: pid(), page: 'home', at: at(banner), x: 84, y: 34, w: 2.5, h: 4, art: 'shape-sparkle', color: '#ffffff' },
  { id: pid(), page: 'home', at: at(banner), x: 2, y: 56, w: 20, h: 42, art: '', photos: [IMG.dogCat], fit: 'fit' },
  { id: pid(), page: 'home', at: at(banner), x: 78, y: 50, w: 18, h: 34, art: '', photos: [IMG.leapCat], fit: 'fit', turn: -8 }
];
sections.texts = sections.texts || {};
sections.texts.pics = picBoxes.clean(pics);
sections.texts.items = textBoxes.clean([
  { id: tid(), page: 'home', at: at(banner), x: 24, y: 90, w: 52, text: '[SCENE DECOR: Glass Blue picket fence goes here, 190px tall (coming next)]', size: 13, color: 'white', bold: true }
]);
// watermarks (section 5, 6, 7, 10)
sections.texts.wmarks = watermark.clean([
  watermark.fromPreset('dog-section', { id: 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'), page: 'home', part: at(why), el: at(why) + '|section-1' }),
  watermark.fromPreset('dog-card', { id: 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'), page: 'home', part: at(dogs), el: at(dogs) + '|div-3' }),
  watermark.fromPreset('cat-card', { id: 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'), page: 'home', part: at(cats), el: at(cats) + '|div-3' }),
  watermark.fromPreset('cat-section', { id: 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'), page: 'home', part: at(team), el: at(team) + '|section-1' })
]);

const layout = { order: ['hero', 'services', 'about', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'extraPages', 'hours', 'contact'], hidden: ['testimonials', 'whyChoose', 'gallery', 'blog', 'extraPages', 'hours'], items: [] };
layout.items = layout.order.concat(order.map(b => 'blk:' + b.id));

const info = db.prepare('INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .run(owner.user_id, SLUG, NAME, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), seoTitle, seoDesc);
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(info.lastInsertRowid, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'First build (Imperial Pet Group)');
console.log(`Made "${NAME}" (site ${info.lastInsertRowid}). Open http://localhost:3000/sites/${info.lastInsertRowid}/edit`);
