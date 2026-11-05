const { defaultBooking } = require('./booking');

function defaultSections() {
  return {
    booking: defaultBooking(),
    hero: {
      headline: 'Your Business Name',
      subheadline: 'A short, compelling tagline goes here.',
      imageUrl: '',
      slides: [],            // extra hero photos; with 2 or more photos the hero becomes a slideshow
      ctaText: 'Get in touch',
      ctaLink: '#contact',
      trustText: '',
      edge: '',              // '', 'wave' or 'scallop': shaped bottom edge on the hero
      focalX: 50, focalY: 50, // which part of the photo stays in view when it is cropped (percent from the left / top)
      overlay: '',           // '' = the style decides; or 15-75: how dark the photo is made so text reads
      align: '',             // '' = the style decides; or left | center | right
      videoUrl: '',          // optional looping background video (direct .mp4/.webm link); phones and reduced-motion show the photo
      float: '',             // '' | emoji | sparkles | bubbles | confetti: gentle floating shapes over the hero
      quickLinks: false,     // a row of pill buttons under the hero that jump to Services, Reviews, Location, Contact...
      cards: [],             // up to 4 cards that overlap the bottom of the hero: [{ title, text }]
      design: 'auto',        // '' = classic hero, 'scrim' = Image + Scrim (cosmic), 'auto' = Image + Scrim for tech, education, creative and events
      scrim: 'medium',       // Image + Scrim darkness: light | medium | heavy (never lighter than readable)
      scrimLayout: 'full'    // Image + Scrim: full (fades into the next section) | boxed (rounded card)
    },
    about: {
      heading: 'About Us',
      eyebrow: '',
      body: 'Tell visitors who you are and what makes your business great.',
      imageUrl: '',
      imageAlt: ''
    },
    services: {
      heading: 'What We Offer',
      eyebrow: '',
      items: [
        { title: 'Service One', description: 'Describe this service.' },
        { title: 'Service Two', description: 'Describe this service.' },
        { title: 'Service Three', description: 'Describe this service.' }
      ]
    },
    testimonials: {
      display: 'grid', // 'grid' or 'carousel'
      heading: 'What Our Customers Say',
      eyebrow: '',
      items: []
    },
    whyChoose: {
      heading: 'Why Choose Us',
      eyebrow: '',
      items: []
    },
    gallery: {
      heading: 'Gallery',
      eyebrow: '',
      images: [],
      alts: [],        // photo descriptions, same order as images
      beforeAfter: [] // [{ before, after, caption }]
    },
    faq: {
      heading: 'Frequently Asked Questions',
      eyebrow: '',
      items: [
        { question: 'What areas do you serve?', answer: 'Update this with your service area.' }
      ]
    },
    hours: {
      heading: 'Hours',
      eyebrow: '',
      items: [
        { day: 'Monday', time: '9:00 AM – 5:00 PM' },
        { day: 'Tuesday', time: '9:00 AM – 5:00 PM' },
        { day: 'Wednesday', time: '9:00 AM – 5:00 PM' },
        { day: 'Thursday', time: '9:00 AM – 5:00 PM' },
        { day: 'Friday', time: '9:00 AM – 5:00 PM' },
        { day: 'Saturday', time: 'Closed' },
        { day: 'Sunday', time: 'Closed' }
      ]
    },
    contact: {
      heading: 'Contact Us',
      eyebrow: '',
      email: '',
      notifyEmail: '',
      autoReply: false,      // email the visitor a receipt when they submit the form
      autoReplyText: '',
      phone: '',
      address: '',
      locations: [],         // other offices: { name, address, phone }
      social: { facebook: '', instagram: '', twitter: '' },
      form: { mode: 'standard', title: '', intro: '', submitText: '', fields: [] }, // form builder (see forms.js)
      followUp: { enabled: false, steps: [] }, // automatic follow-up emails to new leads (see leads.js)
      remindersOff: false,   // true = no daily "follow up today" email
      homeMap: false,        // 'Where we work' map + service areas on the home page
      footerHours: false,    // show opening hours in the footer
      floatButton: '', // '', 'text' or 'whatsapp': round button in the corner that opens a text message to the phone number
      acceptSubmissions: true
    },
    // Credentials the OWNER enters — nothing here is ever filled in by default.
    trust: {
      badges: [],            // e.g. "Licensed & Insured"
      stats: [],             // [{ value: '15+', label: 'Years in business' }]
      serviceAreas: [],      // towns / neighborhoods served
      googleReviewsUrl: '',
      logosHeading: '',      // e.g. "Our certifications" (owner-entered)
      logos: [],             // [{ imageUrl, label }] badge / association logos
      legalNote: '',         // license number / legal notice shown in the footer
      areaText: {}           // { 'Kissimmee': 'text for that town\'s own page' }
    },
    blog: {
      heading: 'News & Tips',
      eyebrow: '',
      items: []              // [{ title, date, body }]
    },
    extraPages: {
      heading: 'Extra pages',
      items: []              // [{ title, body }] e.g. Financing, Service plans
    },
    payments: { enabled: false, currency: 'usd', depositMode: '', depositAmount: '', buyLabel: '' }, // card payments through the owner's own Stripe account (see payments.js)
    calculator: { enabled: false, heading: 'Get an estimate', intro: '', buttonText: 'Send me this estimate', showPrice: true, basePrice: 0, minimum: 0, spread: 0, note: '', fields: [] }, // quote calculator (see calc.js)
    members: { enabled: false, title: 'Members area', navLabel: 'Members', intro: '', signup: 'approval', pages: [] }, // visitor logins (see members.js)
    chat: { enabled: false, greeting: '', dailyCap: 200 }, // website chat assistant (see chat.js)
    legal: { enabled: false, ownerName: '', email: '', address: '', state: '', updated: '', banner: '', privacyExtra: '', termsExtra: '' }, // generated Privacy + Terms pages
    // Remembered so "Rewrite copy with AI" knows what kind of business this is.
    announcement: { enabled: false, text: '', linkText: '', linkUrl: '', dismissible: true }, // thin bar above the menu on every page
    custom: { items: [] }, // your own sections: [{ after, layout, heading, body, images[], buttonText, buttonUrl, bg, emoji }]
    blocks: { items: [] }, // content blocks: [{ type, heading, body, imageUrl, buttonText, buttonUrl, side, bg, place }]
    meta: { businessType: '', city: '', gaId: '', metaPixelId: '', reportEmail: '', trackingMode: 'ask' },
    seo: {
      title: '',
      description: '',
      shareImage: '', // picture shown when a link to the site is shared; empty = the home photo
      pages: {},      // per-page overrides: { about: { title, description, shareImage, noindex } }
      redirects: [],  // [{ from: '/old-page', to: '/about', code: 301 }]
      notFound: { heading: '', text: '' } // wording of the "page not found" page
    }
  };
}

function defaultTheme() {
  return {
    primaryColor: '#2563eb',
    emoji: '',                 // the site's own emoji (e.g. '🐾 ✂️'), used in doodles, headings and floating shapes
    doodles: false,            // sparkle marks and a hand-drawn underline on headings
    emojiHeads: false,         // put the first emoji next to every section heading
    bgColor: '',               // optional page background for dark styles (empty = the style's own)
    accentColor: '#1e293b',
    font: 'Inter, system-ui, sans-serif',
    style: 'modern', // modern | classic | bold
    headingFont: '', bodyFont: '', headingCase: '', // '' = use the style's own fonts
    homeLayout: '', // '' = let the style decide; or basic | full | story | tiles | list
    homeFull: false, // older sites: same as homeLayout 'full'
    pageStyles: {}, // optional per-page style, e.g. { services: 'gallery' }
    buttonShape: '', // '' = the style decides; or square | rounded | pill
    corners: '',     // '' = the style decides; or sharp | soft | round
    spacing: '',     // '' = normal; or compact | airy (space between sections)
    header: '',      // '' = sticky bar; or static | shrink | transparent (over the home hero)
    headerLayout: '', // '' = logo left, links right; or centered
    motionStyle: 'subtle', // subtle | lively | none: the one animation preset (see motion-presets.js)
    headingScale: '', // '' = normal; or large | xl (bigger section headings and hero headline)
    bands: false,     // alternate light and dark sections on the home page
    hoverLift: false, // cards lift when hovered
    logoUrl: ''
  };
}

const SECTION_KEYS = ['hero', 'about', 'services', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'extraPages', 'hours', 'contact'];

function defaultLayout() {
  return {
    order: [...SECTION_KEYS],
    hidden: []
  };
}

module.exports = { defaultSections, defaultTheme, defaultLayout, SECTION_KEYS };
