// The section library: the registry of every template in views/library, with where it came from.
// Sources: HyperUI (MIT, https://www.hyperui.dev) layouts, Start Bootstrap's free templates (MIT, see SB below), Meraki UI (MIT, see MK below), rewritten so every color, font and corner comes from
// the site's own theme variables; and a few originals built on the same spacing. Flowbite free (MIT) is the
// fallback source but none of its markup is used yet. Preline's free components are MIT with a "Fair Use"
// license that bars bundling its code, so interactive pieces (accordion, tabs, carousel) are plain
// <details>, CSS scroll-snap and public/sg-lib.js. No paid Pro blocks are used.
const FAMILIES = {
  hero: 'Hero', about: 'About', services: 'Services', why: 'Why choose us', stats: 'Numbers',
  testimonials: 'Reviews', pricing: 'Pricing', faq: 'FAQ', gallery: 'Gallery', areas: 'Areas served',
  cta: 'Call to action', contact: 'Contact', logos: 'Logos', banner: 'Scrolling banner', custom: 'Your own section', bento: 'Bento overview',
};
const HU = 'HyperUI (MIT)';
// Layouts marked 'Original' were drawn from scratch for SiteGen; design ideas only, no third-party component code.
// path = the HyperUI folder the layout was adapted from, or 'Original' for a layout we drew ourselves
const T = (family, variant, label, hint, path) => ({
  id: `${family}/${variant}`, family, variant, file: `${family}-${variant}`, label, hint,
  source: path === 'Original' ? 'Original' : `${HU} ${path}`, license: path === 'Original' ? 'Ours' : 'MIT',
});
// Layouts adapted from free Start Bootstrap templates (MIT, https://startbootstrap.com): the template's layout idea
// redrawn with the site's theme variables, so none of its colors, fonts or Bootstrap CSS come along.
const SB = (family, variant, label, hint, template) => ({ ...T(family, variant, label, hint, 'Original'), source: `Start Bootstrap ${template} (MIT)`, license: 'MIT' });
// Layouts adapted from Meraki UI's free Tailwind components (MIT, https://merakiui.com), redrawn the same way.
const MK = (family, variant, label, hint, path) => ({ ...T(family, variant, label, hint, 'Original'), source: `Meraki UI (MIT) ${path}`, license: 'MIT' });
const SECTIONS = [
  T('hero', 'centered', 'Centered headline', 'Big centered headline, buttons, wide photo under', 'banners/1'),
  T('hero', 'split', 'Split with photo', 'Text left, photo right', 'banners/2, sections/1'),
  T('hero', 'overlay', 'Full photo', 'Headline over a full-width photo', 'banners/1'),
  T('hero', 'card', 'Card over photo', 'Centered card floating over a photo', 'Original'),
  T('about', 'split', 'Text + photo', 'Intro text with a photo beside it', 'sections/1'),
  T('about', 'photo-left', 'Photo first', 'Large photo on the left', 'sections/3'),
  T('about', 'centered', 'Centered statement', 'Centered text, wide photo below', 'sections/4'),
  T('services', 'cards', 'Cards', 'A card per service with photo', 'feature-grids'),
  T('services', 'grid', 'Numbered grid', 'Numbered list in columns, no photos needed', 'feature-grids'),
  T('services', 'list', 'Price list', 'Rows with a price on the right', 'sections'),
  T('services', 'tabs', 'Tabs', 'Pick a service to read about it', 'application/tabs'),
  T('why', 'grid', 'Card grid', 'Check-mark cards', 'feature-grids'),
  T('why', 'split', 'Heading + list', 'Heading left, reasons right', 'sections/2'),
  T('stats', 'band', 'Brand band', 'Numbers on the brand color', 'stats'),
  T('stats', 'cards', 'Cards', 'Numbers in separate cards', 'stats'),
  T('testimonials', 'grid', 'Grid', 'Quote cards', 'testimonials'),
  T('testimonials', 'single', 'One big quote', 'A single featured review', 'testimonials'),
  T('testimonials', 'carousel', 'Carousel', 'Swipe through reviews', 'testimonials'),
  T('pricing', 'cards', 'Price cards', 'Up to 3 priced services', 'pricing'),
  T('faq', 'accordion', 'Accordion', 'Click a question to open it', 'faqs'),
  T('faq', 'columns', 'Two columns', 'All answers visible', 'faqs'),
  T('gallery', 'grid', 'Photo grid', 'The client\'s own photos', 'sections'),
  T('areas', 'chips', 'Town chips', 'Towns served', 'Original'),
  T('cta', 'banner', 'Brand banner', 'Full-width call to action', 'ctas/1'),
  T('cta', 'card', 'Floating card', 'Rounded call to action card', 'ctas/3'),
  T('contact', 'details', 'Contact details', 'Phone, email and address', 'sections'),
  T('logos', 'row', 'Logo row', 'Partner or certification logos', 'logo-clouds'),
  T('hero', 'spotlight', 'Spotlight', 'Centered headline over a soft brand-color glow, trust row under the buttons', 'Original'),
  T('hero', 'mosaic', 'Photo mosaic', 'Text left, up to three staggered photos right', 'Original'),
  T('hero', 'stat', 'Headline + numbers', 'Headline beside big numbers (falls back to a photo)', 'Original'),
  T('hero', 'showcase', 'Showcase strip', 'Headline beside the site\'s photos gliding past, proof bar of real numbers, badges and reviews', 'Original'),
  T('hero', 'collage', 'Word carousel collage', 'The headline\'s words rise in one by one; your service names slide through a center photo card while photos around it swap and grow when pointed at', 'Original'),
  T('hero', 'scroll', 'Scroll-through photos', 'Your hero photos fill the screen and step forward as visitors scroll down, back as they scroll up', 'Original'),
  T('hero', 'shapes', 'Floating 3D shapes', 'Glassy shapes in the brand colors drift behind a big headline, lean toward the mouse and spread as visitors scroll', 'Original'),
  T('hero', 'blend', 'Photo with the header blended in', 'The hero photo fills the top with the header sitting on it, a dark fade on the left, a spaced label, italic serif words in the headline and a pill button', 'Original'),
  T('hero', 'scrim', 'Image + Scrim (cosmic)', 'Full photo or night-sky gradient, dark scrim behind the words, gradient headline, glowing button, glass cards', 'Original'),
  T('services', 'bento', 'Bento', 'One large featured service plus tiles', 'Original'),
  T('services', 'reveal', 'Hover reveal', 'Photo cards that reveal the description on hover', 'Original'),
  T('services', 'rows', 'Numbered rows', 'Text-first rows with large numbers', 'Original'),
  T('testimonials', 'wall', 'Wall', 'Masonry cards', 'Original'),
  T('testimonials', 'marquee', 'Auto-scroll', 'Slow scrolling row, pauses on hover', 'Original'),
  T('testimonials', 'quote', 'Spotlight quote', 'One big quote with an avatar strip', 'Original'),
  T('pricing', 'rates', 'Rate card', 'Menu-style price list with dotted leaders', 'Original'),
  T('pricing', 'featured', 'Featured price', 'First price featured, the rest beside it', 'Original'),
  T('faq', 'side', 'Side panel', 'Accordion with a help panel beside it', 'Original'),
  T('faq', 'numbered', 'Numbered', 'Numbered accordion', 'Original'),
  T('cta', 'split', 'Split panel', 'Brand panel with phone beside a quote card', 'Original'),
  T('contact', 'cards', 'Contact cards', 'Call, text, email and visit cards', 'Original'),
  T('hero', 'scene-city', 'Parallax: city skyline', 'Layered skyline that drifts as you scroll, in the brand colors', 'Original'),
  T('hero', 'scene-hills', 'Parallax: rolling hills', 'Layered hills and trees that drift as you scroll', 'Original'),
  T('hero', 'scene-shore', 'Parallax: palm shore', 'Waves and palms that drift as you scroll', 'Original'),
  T('banner', 'ticker', 'Brand ticker', 'Scrolling uppercase phrases on the brand color', 'Original'),
  T('banner', 'quiet', 'Quiet ticker', 'Scrolling phrases between two hairlines', 'Original'),
  T('custom', 'text', 'Words only', 'A centered column of text', 'Original'),
  T('custom', 'photo-text', 'Photo left, words right', 'One photo beside text', 'Original'),
  T('custom', 'text-photo', 'Words left, photo right', 'Text beside one photo', 'Original'),
  T('custom', 'photo', 'One big photo', 'Full-width photo with optional words under it', 'Original'),
  T('custom', 'photos', 'Photo grid', 'Two to four photos with optional words above', 'Original'),
  T('about', 'overlap', 'Overlap', 'A text card overlapping the edge of a big photo', 'Original'),
  T('about', 'offset', 'Offset photos', 'Words beside two or three photos at staggered heights', 'Original'),
  T('about', 'collage', 'Photo collage', 'Words beside one big and two small photos', 'Original'),
  T('about', 'sticky', 'Sticky photo', 'The photo stays put while the story scrolls past', 'Original'),
  T('about', 'frosted', 'Frosted band', 'A photo across the page with a frosted-glass panel of words', 'Original'),
  T('about', 'editorial', 'Editorial', 'A big number (your first trust number) or heading beside the words', 'Original'),
  T('about', 'magazine', 'Magazine', 'Words in columns, a pull-quote from a review and a small photo', 'Original'),
  T('about', 'strip', 'Photo strip on top', 'A row of photos, then the words centered below', 'Original'),
  T('about', 'bleed', 'Full photo with panel', 'The photo fills the width, a panel of words docks to one side', 'Original'),
  T('why', 'zigzag', 'Zig-zag rows', 'One row per reason, photo and words swapping sides', 'Original'),
  T('why', 'editorial', 'Editorial numbers', 'Big heading beside numbered reasons', 'Original'),
  T('why', 'photocards', 'Photo cards', 'Cards with the photo on top (or a check mark)', 'Original'),
  T('why', 'bgcards', 'Photo-background cards', 'The photo fills each card behind the words', 'Original'),
  T('services', 'zigzag', 'Zig-zag rows', 'One row per service, photo and words swapping sides', 'Original'),
  T('services', 'bgcards', 'Photo-background cards', 'The service photo fills each card behind the words', 'Original'),
  T('services', 'icons', 'Icon cards', 'An icon on top of each card instead of a photo', 'Original'),
  T('gallery', 'masonry', 'Masonry', 'Photos keep their own shapes, stacked in columns', 'Original'),
  T('gallery', 'feature', 'Big plus small', 'One large photo beside smaller ones', 'Original'),
  T('gallery', 'filmstrip', 'Filmstrip', 'One row of photos that scrolls sideways', 'Original'),
  T('gallery', 'carousel', 'Carousel with thumbnails', 'One big photo with small ones to pick from', 'Original'),
  T('contact', 'map', 'Map and details', 'A map of the address beside how to reach you', 'Original'),
  T('contact', 'mapcard', 'Map with floating card', 'The map fills the section, details on a card over it', 'Original'),
  T('custom', 'overlap', 'Overlap', 'A text card overlapping the edge of the photo', 'Original'),
  T('custom', 'offset', 'Offset photos', 'Words beside two or three staggered photos', 'Original'),
  T('custom', 'collage', 'Photo collage', 'Words beside one big and two small photos (3 photos)', 'Original'),
  T('custom', 'sticky', 'Sticky photo', 'The photo stays put while the words scroll past', 'Original'),
  T('custom', 'frosted', 'Frosted band', 'The photo across the page with a frosted-glass panel', 'Original'),
  T('custom', 'editorial', 'Editorial', 'Big heading beside the words', 'Original'),
  T('custom', 'magazine', 'Magazine', 'Words in columns with a small inset photo', 'Original'),
  T('custom', 'strip', 'Photo strip on top', 'A row of photos, then the words centered below', 'Original'),
  T('services', 'story', 'Pinned story', 'The photo stays pinned while the services scroll past, changing to match each one', 'Original'),
  T('services', 'stack', 'Stacking cards', 'Service cards slide up and stack like a dealt deck as you scroll', 'Original'),
  T('gallery', 'reel', 'Film reel', 'The photo row glides sideways on its own like a film reel, with a pause button', 'Original'),
  T('gallery', 'fan', 'Card fan', 'The photos start as one stack and fan out into a row as visitors scroll to them', 'Original'),
  T('gallery', 'zoom', 'Grid zoom', 'A photo collage whose middle photo grows to fill the screen as visitors scroll', 'Original'),
  T('services', 'ticker', 'Word ticker', 'Your service names slide past in huge letters on the brand color, with small photos between', 'Original'),
  T('stats', 'objects', 'Moving objects', 'Big numbers in soft cards, each with a small moving object matched to it (a clock for years, a gear for jobs...)', 'Original'),
  T('pricing', 'fan', 'Fanned cards', 'Price cards held like a hand of cards, the middle one raised and the sides tilted', 'Original'),
  T('bento', 'tiles', 'Bento tiles', 'One grid of mixed tiles: a big photo, your numbers, top services, a review and how to call', 'Original'),
  T('custom', 'bleed', 'Full photo with panel', 'The photo fills the width, a panel docks to one side', 'Original'),
  SB('hero', 'masthead', 'Agency masthead', 'Photo behind an italic line, a huge uppercase headline and one big uppercase button', 'Agency'),
  SB('services', 'circles', 'Agency icon circles', 'Each service under its icon in a big brand-color circle, uppercase heading', 'Agency'),
  SB('gallery', 'portfolio', 'Agency portfolio', 'Photo cards that wash over in the brand color with a plus on hover, with your captions; click to enlarge', 'Agency'),
  SB('why', 'timeline', 'Agency timeline', 'Your reasons hang off a center line in big circles (their photos or numbers), the words swapping sides', 'Agency'),
  SB('hero', 'divider', 'Creative masthead', 'Tall photo under a warm dark wash, bold centered headline, a short brand-color rule and a round button', 'Creative'),
  SB('about', 'band', 'Creative brand band', 'Your story centered on the brand color under a short light rule', 'Creative'),
  SB('services', 'lineicons', 'Creative line icons', 'A big line icon in the brand color over each service, no cards', 'Creative'),
  SB('gallery', 'tiles', 'Creative edge-to-edge', 'Photos edge to edge with no gaps; each washes over in the brand color with its caption on hover', 'Creative'),
  SB('cta', 'dark', 'Creative dark band', 'A big light heading on the dark text color with a round button', 'Creative'),
  SB('hero', 'fade', 'Grayscale fade', 'Full-screen photo fading to black, a huge widely spaced headline that fades out downward', 'Grayscale'),
  SB('services', 'panels', 'Grayscale panels', 'First service large, then each photo joined to a black panel of words, sides swapping', 'Grayscale'),
  SB('contact', 'trio', 'Grayscale contact cards', 'Icon, small uppercase label, a short rule and the detail on cards with a brand-color edge', 'Grayscale'),
  MK('hero', 'checks', 'Photo with check list', 'Headline and words beside a photo running to the screen edge, your trust line and badges as a check list', 'marketing/heros'),
  MK('hero', 'half', 'Half-screen photo', 'Words on the left half, your photo filling the right half edge to edge, a dark and a light button', 'marketing/heros'),
  MK('services', 'outlined', 'Outlined cards', 'Heading with an underline in the brand color, cards outlined in the brand color with an icon and a round arrow link', 'marketing/features'),
  MK('services', 'softcards', 'Soft centered cards', 'Soft tinted cards, an icon in a pale brand-color circle, centered words and a Read more link', 'marketing/features'),
  T('why', 'panel', 'Reasons on a color panel over a photo', 'One big photo fills the section; a brand-color panel docks over it with your reasons, each under a round line icon', 'Original'),
  T('why', 'peek', 'Numbered cards under a photo', 'A wide photo stands on a soft brand-tint band (cut-out pets look best) and numbered cards with your reasons overlap its lower edge', 'Original'),
  MK('why', 'photoround', 'Reasons beside a photo', 'Your reasons in two columns under small brand-color squares, beside one large rounded photo', 'marketing/features'),
  MK('testimonials', 'highlight', 'Middle card in color', 'Review cards with the reviewer under each quote, the middle card filled with the brand color', 'marketing/testimonials'),
  MK('testimonials', 'panel', 'One review on a panel', 'One review on a wide brand-color panel, the reviewer photo standing over its edge', 'marketing/testimonials'),
  MK('cta', 'photocard', 'Photo card', 'A card with your photo on one side and the heading and a dark button on the other', 'marketing/cta'),
  MK('cta', 'circle', 'Round photo', 'A big round photo beside the heading and two buttons, one dark and one in the brand color', 'marketing/cta'),
  MK('faq', 'iconcards', 'Answers in a grid', 'Every question with its answer showing, under a small brand-color square with a question mark', 'marketing/faq'),
  MK('faq', 'lines', 'Plus and minus lines', 'Questions between thin lines with a plus that turns to a minus, the answer set off by a brand-color line', 'marketing/faq'),
];

// Which side the photo sits on (on wide screens) before any flip. Used by auto-alternate, so two photo sections in a
// row zig-zag down the page. Layouts not listed have no single photo side.
const SIDES = {
  'about/split': 'right', 'about/photo-left': 'left', 'about/overlap': 'left', 'about/offset': 'right', 'about/collage': 'right', 'about/sticky': 'left',
  'custom/photo-text': 'left', 'custom/text-photo': 'right', 'custom/overlap': 'left', 'custom/offset': 'right', 'custom/collage': 'right', 'custom/sticky': 'left',
  'contact/map': 'left', 'services/story': 'right',
};
// Layouts the Flip switch can mirror (they mark their two sides with sg-flip, sg-zz, sg-dock, sg-dockr or sg-dockself)
const FLIPPABLE = new Set(Object.keys(SIDES).concat(['hero/split', 'hero/mosaic', 'why/split', 'why/editorial', 'why/panel', 'why/zigzag', 'services/zigzag', 'faq/side', 'cta/split',
  'about/frosted', 'about/editorial', 'about/magazine', 'about/bleed', 'custom/frosted', 'custom/editorial', 'custom/magazine', 'custom/bleed', 'gallery/feature', 'contact/mapcard']));
SECTIONS.forEach(s => { s.side = SIDES[s.id] || ''; s.flippable = FLIPPABLE.has(s.id); });

const BY_ID = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const variantsOf = family => SECTIONS.filter(s => s.family === family);
const isVariant = (family, variant) => !!BY_ID[`${family}/${variant}`];

module.exports = { FAMILIES, SECTIONS, BY_ID, variantsOf, isVariant, SIDES };
