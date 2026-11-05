// Atelier: 22 Signature home pages, each built around one live artwork drawn in code (canvas, SVG, CSS).
// Adapted from Leo's sitegen-atelier.html. The artwork, its stylesheet and its section headings and buttons are the
// piece's own; every word, number and photo comes from the client's site. The reference file's sample businesses,
// prices, schedules, trip boards and calculators are not used. Pieces keep their own colors: they are art-directed.
//
// Files per piece in atelier/pieces/: <id>.css (scoped under .p-<id>), <id>.js (the artwork, function(root, SG)),
// <id>.html (the hero, with {{PLACEHOLDERS}} filled below).
const fs = require('fs');
const path = require('path');
const contrast = require('./contrast');
const content = require('./library/content');
const slPage = require('./stylelib-page');

const PREFIX = 'at-';
const DIR = path.join(__dirname, 'atelier', 'pieces');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const telOf = (p) => String(p || '').replace(/[^0-9+]/g, '');

// p: class prefix. btn: [primary, secondary]. c: colors used by the sections under the hero and by the other pages.
// fonts: [display, body] CSS families; gf: Google Fonts families. kick: tag for the eyebrow. r: card radius.
const PIECES = [
  { id: 'undertow', name: 'Undertow', kind: 'Surf school', p: 'u', mode: 'Dark', btn: ['u-btn u-btn-lg', 'u-btn'], r: 20,
    c: { bg: '#0E3B4A', surface: '#12485A', text: '#F7EBDD', muted: '#C9C3BA', line: '#2E5664', accent: '#FF7A59' },
    fonts: ["'Instrument Serif', Georgia, serif", "'Outfit', system-ui, sans-serif"], words: /surf|paddle ?board|\bsup\b|kayak|watersport|water sport|scuba|snorkel|dive (shop|school|center)/i,
    look: 'A dawn sea drawn live: rolling swell and sun glitter, and moving the pointer builds the swell.' },
  { id: 'bloom', name: 'Bloom', kind: 'Florist', p: 'b', mode: 'Light', btn: ['b-btn b-btn-rose', 'b-btn b-btn-line'], r: 16,
    c: { bg: '#F4EDE1', surface: '#FBF8F2', text: '#2E2A24', muted: '#6E665C', line: '#DDD3C3', accent: '#B4566A' },
    fonts: ["'Fraunces', Georgia, serif", "'Figtree', system-ui, sans-serif"], words: /florist|flower|floral|bouquet/i,
    look: 'A garden that grows as the page loads; visitors tap the hero to plant another flower.' },
  { id: 'thermal', name: 'Thermal', kind: 'Coffee roaster', p: 'r', mode: 'Dark', btn: ['r-btn', 'r-btn r-btn-line'], r: 2,
    c: { bg: '#0D0A08', surface: '#15100C', text: '#F3E6D3', muted: '#A8988A', line: '#2E241D', accent: '#FF6A1A' },
    fonts: ["'Big Shoulders Stencil Display', Impact, sans-serif", "'IBM Plex Mono', ui-monospace, monospace"], words: /coffee|roaster|roastery|espresso|\bcaf[eé]\b/i,
    look: 'Stencil type over a live heat haze, with a log-style card of the client\'s prices or contact details.' },
  { id: 'pressure', name: 'Pressure', kind: 'Boxing gym', p: 'k', mode: 'Dark', btn: ['k-btn', 'k-btn k-btn-line'], r: 0,
    c: { bg: '#0A0A0A', surface: '#141414', text: '#F2EFE9', muted: '#9A9792', line: '#262626', accent: '#FF2B2B' },
    fonts: ["'Anton', Impact, sans-serif", "'Inter Tight', system-ui, sans-serif"], words: /boxing|kickbox|\bmma\b|martial art|muay thai|jiu.?jitsu|karate|taekwondo|\bgym\b|crossfit/i,
    look: 'A sliced headline that shakes with the pointer, and every click lands a punch.' },
  { id: 'firefly', name: 'Firefly', kind: 'Wedding venue', p: 'f', mode: 'Dark', btn: ['f-btn', 'f-btn f-btn-line'], r: 18,
    c: { bg: '#0E211B', surface: '#142C24', text: '#F4EAD2', muted: '#B5BDB0', line: '#2A3B34', accent: '#E9C46A' },
    fonts: ["'Cormorant Garamond', Georgia, serif", "'Cormorant Garamond', Georgia, serif"], words: /wedding|venue|banquet|ballroom|event (hall|space|center)|reception hall/i,
    look: 'Twilight fireflies drift through the hero and gather around the pointer.' },
  { id: 'papercut', name: 'Paper Cut', kind: 'Kids dentist', p: 'c', mode: 'Light', btn: ['c-btn', 'c-btn c-btn-paper'], r: 26, kick: 'span',
    c: { bg: '#FFFDF8', surface: '#EAF6F2', text: '#24405A', muted: '#56708A', line: '#D6E6E8', accent: '#F07C6C' },
    fonts: ["'Baloo 2', system-ui, sans-serif", "'Nunito', system-ui, sans-serif"], words: /pediatric|kids'? dent|children'?s dent|dentist|dental|orthodont/i,
    look: 'Layered paper hills, drifting clouds and a friendly tooth, cut like a picture book.' },
  { id: 'prism', name: 'Prism', kind: 'Optometrist', p: 'o', mode: 'Dark', btn: ['o-btn', 'o-btn o-btn-line'], r: 18,
    c: { bg: '#0B0C10', surface: '#15161C', text: '#F5F4EF', muted: '#A9ABB6', line: '#24252C', accent: '#3FC4FF' },
    fonts: ["'Syne', system-ui, sans-serif", "'Hanken Grotesk', system-ui, sans-serif"], words: /optometr|optical|optician|eye ?care|eye doctor|eyewear|eyeglass|vision center/i,
    look: 'White light splits into a spectrum through a glass prism that turns with the pointer.' },
  { id: 'ink', name: 'Ink', kind: 'Tattoo studio', p: 'n', mode: 'Light', btn: ['n-btn n-btn-red', 'n-btn n-btn-line'], r: 0,
    c: { bg: '#EEE8DF', surface: '#F7F2EA', text: '#121014', muted: '#6A625A', line: '#D3C9BC', accent: '#B3261E' },
    fonts: ["'UnifrakturMaguntia', serif", "'Archivo', system-ui, sans-serif"], words: /tattoo|piercing/i,
    look: 'The business name set in blackletter, and ink blooms wherever the visitor clicks or drags.' },
  { id: 'vinyl', name: 'Vinyl', kind: 'Record shop', p: 'v', mode: 'Light', btn: ['v-btn', 'v-btn v-btn-line'], r: 22, kick: 'span',
    c: { bg: '#FFF4DE', surface: '#FFFAEE', text: '#1B1712', muted: '#6B5D49', line: '#E8D6B4', accent: '#D9462B' },
    fonts: ["'Bagel Fat One', system-ui, sans-serif", "'DM Sans', system-ui, sans-serif"], words: /record (store|shop)|vinyl|music (store|shop)|\brecords\b/i,
    look: 'A spinning record with the business name on the label; drag to scratch it.' },
  { id: 'radar', name: 'Radar', kind: 'Hurricane shutters', p: 'w', mode: 'Dark', btn: ['w-btn', 'w-btn w-btn-line'], r: 4,
    c: { bg: '#050B08', surface: '#0A1510', text: '#E6F5EC', muted: '#93B39F', line: '#163020', accent: '#5CFF9D' },
    fonts: ["'Oxanium', system-ui, sans-serif", "'IBM Plex Sans Condensed', system-ui, sans-serif"], words: /shutter|impact (window|door)|hurricane|storm (protection|panel)/i,
    look: 'A radar sweep over the client\'s own service areas, with a live hurricane-season countdown.' },
  { id: 'dough', name: 'Dough', kind: 'Sourdough bakery', p: 'd', mode: 'Light', btn: ['d-btn', 'd-btn d-btn-line'], r: 14,
    c: { bg: '#F6EEE0', surface: '#FFFAF0', text: '#2B1D12', muted: '#7A6450', line: '#E6D7BF', accent: '#B8732E' },
    fonts: ["'Caprasimo', Georgia, serif", "'Work Sans', system-ui, sans-serif"], words: /bak(e|ery|ehouse)|bread|pastr|patisserie|donut|doughnut|cake shop/i,
    look: 'Soft dough that rises and dimples as the pointer pushes through it.' },
  { id: 'foil', name: 'Foil', kind: 'Jeweler', p: 'j', mode: 'Light', btn: ['j-btn', 'j-btn j-btn-line'], r: 18,
    c: { bg: '#F7F3EC', surface: '#FFFFFF', text: '#1A1714', muted: '#6F675E', line: '#E4DCCF', accent: '#9C7A45' },
    fonts: ["'Gilda Display', Georgia, serif", "'Manrope', system-ui, sans-serif"], words: /jewel|goldsmith|diamond|engagement ring/i,
    look: 'An arched window of opal foil whose light shifts as the visitor moves.' },
  { id: 'bubbles', name: 'Bubbles', kind: 'Car wash', p: 'q', mode: 'Light', btn: ['q-btn q-btn-pink', 'q-btn q-btn-white'], r: 22,
    c: { bg: '#F4FAFF', surface: '#FFFFFF', text: '#0A1F44', muted: '#4A5F85', line: '#CFE3F5', accent: '#FF4FA3' },
    fonts: ["'Fredoka', system-ui, sans-serif", "'Lexend', system-ui, sans-serif"], words: /car ?wash|auto (detail|spa)|detailing/i,
    look: 'Foam bubbles float over a sudsy car; visitors pop them with a click.' },
  { id: 'stars', name: 'Constellation', kind: 'Glamping', p: 'y', mode: 'Dark', btn: ['y-btn', 'y-btn y-btn-line'], r: 18,
    c: { bg: '#070A1A', surface: '#141A3D', text: '#F2EBDD', muted: '#A9AEC8', line: '#20264A', accent: '#F4B860' },
    fonts: ["'Young Serif', Georgia, serif", "'Karla', system-ui, sans-serif"], words: /glamping|campground|camping|\brv (park|resort)|cabin rental|retreat|observatory/i,
    look: 'A night sky over the tree line; hovering traces the constellations, with the odd shooting star.' },
  { id: 'press', name: 'Letterpress', kind: 'Stationery & print', p: 'l', mode: 'Light', btn: ['l-btn l-btn-red', 'l-btn l-btn-line'], r: 2,
    c: { bg: '#F4EFE6', surface: '#FBF8F2', text: '#1E2A4A', muted: '#6B6458', line: '#DDD4C4', accent: '#D9472B' },
    fonts: ["'Abril Fatface', Georgia, serif", "'Libre Caslon Text', Georgia, serif"], words: /letterpress|stationer|invitation|print shop|printing|calligraph/i,
    look: 'Wooden type set backwards in a press bed; visitors pull a print with the business name.' },
  { id: 'lagoon', name: 'Ripple', kind: 'Pool builder', p: 'g', mode: 'Light', btn: ['g-btn', 'g-btn g-btn-line'], r: 22,
    c: { bg: '#F5EEE2', surface: '#FFFFFF', text: '#06243D', muted: '#5B6F80', line: '#DCE3E6', accent: '#05467A' },
    fonts: ["'Sora', system-ui, sans-serif", "'Sora', system-ui, sans-serif"], words: /\bpools?\b|hot tub|spa (builder|install)/i,
    look: 'Caustic light on pool water; dragging makes ripples and a click drops a stone.' },
  { id: 'survey', name: 'Terrain', kind: 'Land surveyor', p: 'z', mode: 'Dark', btn: ['z-btn', 'z-btn z-btn-line'], r: 0,
    c: { bg: '#0D1A1F', surface: '#12242B', text: '#EDF2EE', muted: '#93ADAB', line: '#1F3740', accent: '#FF7A1A' },
    fonts: ["'Barlow Condensed', system-ui, sans-serif", "'Barlow Condensed', system-ui, sans-serif"], words: /survey|surveyor|geodetic|elevation certificate|civil engineer/i,
    look: 'A contour-mapped landscape that tilts with the pointer, with a live elevation and bearing readout.' },
  { id: 'gears', name: 'Gears', kind: 'Watch repair', p: 'e', mode: 'Dark', btn: ['e-btn', 'e-btn e-btn-line'], r: 18,
    c: { bg: '#111110', surface: '#1A1917', text: '#F1EADB', muted: '#ADA595', line: '#2C2A26', accent: '#C9A35A' },
    fonts: ["'Libre Bodoni', Georgia, serif", "'Jost', system-ui, sans-serif"], words: /watch|clock|horolog/i,
    look: 'A ticking movement drawn live, a real-time clock and a crown the visitor can wind.' },
  { id: 'paint', name: 'Paint', kind: 'House painter', p: 'h', mode: 'Light', btn: ['h-btn', 'h-btn h-btn-line'], r: 12,
    c: { bg: '#F3EFE8', surface: '#FFFFFF', text: '#1F2421', muted: '#6A6F68', line: '#E0DAD0', accent: '#2F6F5E' },
    fonts: ["'Gabarito', system-ui, sans-serif", "'Instrument Sans', system-ui, sans-serif"], words: /paint(er|ers|ing)\b|drywall|wallpaper|cabinet refinish/i,
    look: 'A wall the visitor paints by dragging, with a row of color chips to choose from.' },
  { id: 'kaleido', name: 'Kaleidoscope', kind: 'Kids art studio', p: 'x', mode: 'Light', btn: ['x-btn', 'x-btn x-btn-line'], r: 24,
    c: { bg: '#FFF8EC', surface: '#FFFFFF', text: '#1B1640', muted: '#5E5880', line: '#EBDFCB', accent: '#D6337E' },
    fonts: ["'Grandstander', system-ui, sans-serif", "'Mulish', system-ui, sans-serif"], words: /art (studio|class|school|lesson|camp)|kids'? art|paint (party|parties)|pottery|craft studio/i,
    look: 'A kaleidoscope visitors draw in with mirrored strokes, with 6, 8 or 12 mirrors.' },
  { id: 'sand', name: 'Sand', kind: 'Landscape supply', p: 'm', mode: 'Light', btn: ['m-btn m-btn-accent', 'm-btn m-btn-line'], r: 6,
    c: { bg: '#F6F1E7', surface: '#FFFFFF', text: '#2A2620', muted: '#6E665A', line: '#E2D9C8', accent: '#B4561E' },
    fonts: ["'Chivo', system-ui, sans-serif", "'Chivo', system-ui, sans-serif"], words: /landscape supply|mulch|gravel|\bsod\b|stone yard|aggregate|topsoil|rock yard/i,
    look: 'Falling sand, gravel and mulch pile up in the hero as the visitor pours them.' },
  { id: 'flap', name: 'Split-Flap', kind: 'Travel agency', p: 'sf', mode: 'Light', btn: ['sf-btn', 'sf-btn sf-btn-line'], r: 18,
    c: { bg: '#F6F1E7', surface: '#FFFFFF', text: '#1A1916', muted: '#6E6A61', line: '#E2DCCF', accent: '#8A6A00' },
    fonts: ["'Playfair Display', Georgia, serif", "'Red Hat Text', system-ui, sans-serif"], words: /travel|cruise|tour operator|vacation plann|honeymoon/i,
    look: 'A departures board whose flaps clatter through the client\'s own services and prices.' }
];

// Google Fonts per piece, from the reference file
const GF = {
  undertow: 'Instrument+Serif:ital@0;1&family=Outfit:wght@400;500;600;700',
  bloom: 'Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
  thermal: 'Big+Shoulders+Stencil+Display:wght@600;800;900&family=IBM+Plex+Mono:wght@400;500;600',
  pressure: 'Anton&family=Inter+Tight:wght@400;500;600;700;800',
  firefly: 'Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500',
  papercut: 'Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800',
  prism: 'Syne:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700',
  ink: 'UnifrakturMaguntia&family=Archivo:wght@400;500;600;700;800',
  vinyl: 'Bagel+Fat+One&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500',
  radar: 'Oxanium:wght@400;500;600;700;800&family=IBM+Plex+Sans+Condensed:wght@400;500;600;700',
  dough: 'Caprasimo&family=Work+Sans:wght@400;500;600;700',
  foil: 'Gilda+Display&family=Manrope:wght@400;500;600;700',
  bubbles: 'Fredoka:wght@500;600;700&family=Lexend:wght@400;500;600;700',
  stars: 'Young+Serif&family=Karla:wght@400;500;600;700',
  press: 'Abril+Fatface&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400',
  lagoon: 'Sora:wght@400;600;700;800',
  survey: 'Barlow+Condensed:wght@500;600;700;800&family=Martian+Mono:wght@400;500;600',
  gears: 'Libre+Bodoni:ital,wght@0,400;0,600;1,400;1,600&family=Jost:wght@400;500;600',
  paint: 'Gabarito:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700',
  kaleido: 'Grandstander:wght@500;700;800&family=Mulish:wght@400;600;700;800',
  sand: 'Chivo:wght@400;700;900&family=Chivo+Mono:wght@400;500',
  flap: 'Playfair+Display:ital,wght@0,700;1,500;1,700&family=Red+Hat+Mono:wght@500;600&family=Red+Hat+Text:wght@400;500;600;700'
};

// Card art for the Signature browser, from the reference file
const GRAD = {
  undertow: "linear-gradient(180deg,#141A3A 0%,#4B3A6B 34%,#F6B07F 56%,#5A5A86 58%,#0E3B4A 100%)",
  bloom: "radial-gradient(circle at 70% 70%,#E8A0A0 0 10%,transparent 11%),radial-gradient(circle at 85% 40%,#EDB95A 0 8%,transparent 9%),radial-gradient(circle at 55% 30%,#B6A5DD 0 7%,transparent 8%),linear-gradient(#F4EDE1,#EFE5D4)",
  thermal: "radial-gradient(60% 80% at 50% 110%,#FF6A1A,#C2410C 30%,transparent 65%),linear-gradient(#0D0A08,#1A110B)",
  pressure: "linear-gradient(180deg,#0A0A0A 0 30%,#FF2B2B 30% 36%,#0A0A0A 36% 58%,#FF2B2B 58% 62%,#0A0A0A 62%)",
  firefly: "radial-gradient(circle at 30% 60%,#FFE9A0 0 2%,transparent 6%),radial-gradient(circle at 70% 45%,#FFE9A0 0 2%,transparent 6%),radial-gradient(circle at 55% 75%,#FFE9A0 0 1.5%,transparent 5%),linear-gradient(#081422,#12304A 55%,#0E211B 56%,#07150E)",
  papercut: "radial-gradient(circle at 78% 30%,#FFD166 0 12%,transparent 13%),radial-gradient(120% 60% at 30% 110%,#6CC49B 0 50%,transparent 51%),radial-gradient(120% 60% at 80% 100%,#F7D9A6 0 55%,transparent 56%),radial-gradient(140% 70% at 40% 95%,#A8DCC8 0 60%,transparent 61%),linear-gradient(#CDEAF4,#EAF6F2)",
  prism: "conic-gradient(from 100deg at 30% 60%,transparent 0 20deg,#FF4D5A 22deg,#FFD84A 30deg,#5EE38C 38deg,#3FC4FF 46deg,#9A5CFF 54deg,transparent 58deg),linear-gradient(#0B0C10,#15161C)",
  ink: "radial-gradient(40% 50% at 65% 40%,rgba(18,16,20,.75),transparent 70%),radial-gradient(25% 30% at 35% 70%,rgba(179,38,30,.6),transparent 70%),radial-gradient(30% 35% at 80% 80%,rgba(18,16,20,.5),transparent 70%),#EEE8DF",
  vinyl: "radial-gradient(circle at 62% 55%,#D9462B 0 7%,#111 7.5% 34%,transparent 34.5%),repeating-conic-gradient(from 0deg at 62% 55%,rgba(255,255,255,.12) 0 6deg,transparent 6deg 12deg),#E9B44C",
  radar: "conic-gradient(from 20deg at 60% 55%,rgba(92,255,157,.55),rgba(92,255,157,0) 60deg,transparent 360deg),radial-gradient(circle at 60% 55%,transparent 0 22%,rgba(92,255,157,.3) 22.5% 23%,transparent 23.5% 44%,rgba(92,255,157,.3) 44.5% 45%,transparent 45.5%),#050B08",
  dough: "radial-gradient(circle at 70% 60%,#F3DDB5 0 18%,#C98A4B 19% 21%,transparent 23%),radial-gradient(circle at 48% 78%,#F3DDB5 0 12%,#C98A4B 13% 15%,transparent 17%),radial-gradient(circle at 86% 30%,#F3DDB5 0 10%,#C98A4B 11% 13%,transparent 15%),#F6EEE0",
  foil: "conic-gradient(from 200deg at 60% 45%,#FBD3E9,#C9E7F7,#E2F7D4,#FFF1C2,#F2D3FB,#FBD3E9)",
  bubbles: "radial-gradient(circle at 30% 40%,rgba(255,255,255,.9) 0 3%,transparent 3.5%),radial-gradient(circle at 34% 46%,transparent 0 14%,rgba(255,79,163,.6) 14.5% 16%,transparent 16.5%),radial-gradient(circle at 72% 30%,transparent 0 9%,rgba(80,220,255,.7) 9.5% 11%,transparent 11.5%),radial-gradient(circle at 62% 72%,transparent 0 12%,rgba(160,120,255,.6) 12.5% 14%,transparent 14.5%),linear-gradient(#E8F6FF,#7CC7F5)",
  stars: "linear-gradient(115deg,transparent 30%,rgba(242,235,221,.12) 45%,transparent 60%),radial-gradient(circle at 25% 30%,#F2EBDD 0 1%,transparent 1.5%),radial-gradient(circle at 45% 22%,#F2EBDD 0 1%,transparent 1.5%),radial-gradient(circle at 60% 40%,#F4B860 0 1.4%,transparent 2%),radial-gradient(circle at 78% 26%,#F2EBDD 0 1%,transparent 1.5%),linear-gradient(#070A1A,#141A3D)",
  press: "repeating-linear-gradient(90deg,rgba(0,0,0,.06) 0 2px,transparent 2px 7px),linear-gradient(160deg,#DDB57E 0 45%,#2B2B2B 45% 50%,#F4EFE6 50%)",
  lagoon: "radial-gradient(circle at 40% 45%,transparent 0 10%,rgba(255,255,255,.5) 10.5% 11.5%,transparent 12% 20%,rgba(255,255,255,.35) 20.5% 21.5%,transparent 22%),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px) 0 0/12px 12px,linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px) 0 0/12px 12px,linear-gradient(#2CC6E0,#0A6FA8)",
  survey: "repeating-linear-gradient(170deg,transparent 0 9px,rgba(159,211,199,.45) 9px 10px),repeating-linear-gradient(80deg,transparent 0 13px,rgba(159,211,199,.3) 13px 14px),radial-gradient(circle at 62% 42%,rgba(255,122,26,.9) 0 3%,transparent 3.5%),#0D1A1F",
  gears: "radial-gradient(circle at 62% 50%,#B0103A 0 3%,#C9A35A 3.5% 9%,transparent 9.5% 24%,#C9A35A 24.5% 30%,transparent 30.5%),radial-gradient(circle at 30% 70%,#C9A35A 0 12%,transparent 12.5%),#111110",
  paint: "linear-gradient(172deg,transparent 0 22%,rgba(47,111,94,.85) 22.5% 38%,transparent 38.5%),linear-gradient(176deg,transparent 0 46%,rgba(224,122,95,.85) 46.5% 60%,transparent 60.5%),linear-gradient(170deg,transparent 0 66%,rgba(61,90,128,.85) 66.5% 80%,transparent 80.5%),#F3EFE8",
  kaleido: "conic-gradient(from 0deg at 60% 50%,#FF5DA2 0 30deg,#1B1640 30deg 60deg,#FFC83D 60deg 90deg,#1B1640 90deg 120deg,#3DDBD9 120deg 150deg,#1B1640 150deg 180deg,#FF5DA2 180deg 210deg,#1B1640 210deg 240deg,#FFC83D 240deg 270deg,#1B1640 270deg 300deg,#3DDBD9 300deg 330deg,#1B1640 330deg)",
  sand: "radial-gradient(60% 45% at 30% 105%,#E3C98E 0 60%,transparent 61%),radial-gradient(45% 40% at 62% 108%,#96948C 0 60%,transparent 61%),radial-gradient(45% 38% at 90% 108%,#6B3F22 0 60%,transparent 61%),linear-gradient(#F6F1E7,#EFE6D4)",
  flap: "linear-gradient(90deg,#222 0 10%,#121212 10% 12%,#222 12% 22%,#121212 22% 24%,#222 24% 34%,#121212 34% 36%,#222 36% 46%,#121212 46% 48%,#222 48% 58%,#121212 58%) 0 30%/100% 22% no-repeat,linear-gradient(90deg,#222 0 10%,#121212 10% 12%,#222 12% 22%,#121212 22% 24%,#FFD447 24% 34%,#121212 34%) 0 62%/100% 22% no-repeat,#121212"
};

const byId = Object.fromEntries(PIECES.map(p => [p.id, p]));
const get = (id) => byId[String(id || '').replace(/^at-/, '')] || null;
const isAtelier = (styleId) => String(styleId || '').startsWith(PREFIX) && !!get(styleId);

// Piece files are read once and kept
const FILES = {};
function files(p) {
  if (!FILES[p.id]) FILES[p.id] = ['css', 'js', 'html'].reduce((o, ext) => (o[ext] = fs.readFileSync(path.join(DIR, `${p.id}.${ext}`), 'utf8'), o), {});
  return FILES[p.id];
}

// Readable versions of the accent for small text and for the closing band
function colors(p) {
  const c = p.c;
  const muted = contrast.ensureContrast(contrast.ensureContrast(c.muted, c.bg, contrast.AA_TEXT), c.surface, contrast.AA_TEXT);
  return { ...c, muted, accentInk: contrast.ensureContrast(c.accent, c.bg, contrast.AA_TEXT), on: contrast.textOn(c.accent) };
}

// Headline emphasis with <em>, which every piece styles: [brackets] or the last short phrase
const emphasize = (t) => slPage.emphasize(t).replace(/<span class="t-em">/g, '<em>').replace(/<\/span>/g, '</em>');

function actions(p, m) {
  const [b1, b2] = p.btn;
  return `<div class="${p.p}-actions"><a class="${b1}" href="${esc(m.cta1.href)}">${esc(m.cta1.text)}</a>${m.cta2 ? `<a class="${b2}" href="${esc(m.cta2.href)}">${esc(m.cta2.text)}</a>` : ''}</div>`;
}

// The hero's info card (Thermal): priced services first, then contact details
function panelRows(m) {
  const priced = m.services.filter(x => x.price).slice(0, 6);
  if (priced.length >= 2) return { title: m.featHead.h2 || 'Prices', rows: priced.map(x => [x.title, x.price]) };
  if (m.contactRows.length >= 2) return { title: m.name, rows: m.contactRows };
  return null;
}

// Split-flap board: services and prices, six rows a page, in the board's character set
const FLAP_CH = /[^ A-Z0-9$,.\-:]/g;
const flapText = (s, n) => {
  let t = String(s || '').toUpperCase().replace(/&/g, 'AND').replace(FLAP_CH, '').replace(/\s+/g, ' ').trim();
  if (t.length > n) t = t.slice(0, n + 1).replace(/\s+\S*$/, '').slice(0, n);
  return t;
};
// Board columns, in characters: service names, then prices (wide enough for "FROM $9,500")
const FLAP_COLS = [['SERVICE', 16], ['PRICE', 11]];

function flapBoard(m) {
  // without any prices the board is one wider service column, not a column of blank tiles
  const COLS = m.services.some(x => x.title && x.price) ? FLAP_COLS : [['SERVICE', 18]];
  const items = m.services.filter(x => x.title).map(x => COLS.map((c, i) => flapText(i ? x.price : x.title, c[1]))).filter(r => r[0]);
  if (items.length < 2) return null;
  const sets = []; for (let i = 0; i < items.length && sets.length < 3; i += 6) sets.push(items.slice(i, i + 6));
  const rows = Math.min(6, items.length);
  const cells = n => Array.from({ length: n }, () => '<span class="sf-c"><span class="t"><i> </i></span><span class="b"><i> </i></span><span class="f"><i> </i></span></span>').join('');
  const head = `<div class="sf-row sf-th" role="row">${COLS.map(c => `<span class="sf-col" role="columnheader" style="width:calc(var(--cw) * ${c[1]} + ${3 * (c[1] - 1)}px)">${c[0]}</span>`).join('')}</div>`;
  const body = Array.from({ length: rows }, (_, r) => `<div class="sf-row" role="row" aria-label="${esc(m.services[r] ? m.services[r].title + (m.services[r].price ? ', ' + m.services[r].price : '') : '')}">${COLS.map(c => `<span class="sf-col" role="cell" aria-hidden="true">${cells(c[1])}</span>`).join('')}</div>`).join('');
  return { html: `<div class="sf-boardwrap"><div class="sf-board" role="table" aria-label="${esc(m.featHead.h2 || 'Services')}">${head}${body}</div></div>`, sets, wid: COLS.map(c => c[1]) };
}

// Pressure: the headline as sliced words, the emphasized part in red
function kWords(m) {
  const slices = (w, n) => { let s = `<span class="k-size">${esc(w)}</span>`; for (let i = 0; i < n; i++) { const a = Math.max(0, i * 100 / n - .4).toFixed(2), b = Math.max(0, 100 - (i + 1) * 100 / n - .4).toFixed(2); s += `<span class="k-s" aria-hidden="true" style="clip-path:inset(${a}% 0 ${b}% 0)">${esc(w)}</span>`; } return s; };
  const html = emphasize(m.h1), mm = /^(.*?)<em>(.*?)<\/em>(.*)$/.exec(html);
  const un = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  const parts = mm ? [[un(mm[1]), ''], [un(mm[2] + mm[3]), ' k-red']] : [[un(html), '']];
  const lines = [];
  parts.filter(x => x[0]).forEach(([text, red]) => {
    let cur = '';
    text.split(/\s+/).forEach(w => { if (cur && (cur + ' ' + w).length > 12) { lines.push([cur, red]); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push([cur, red]);
  });
  // Anton is about half an em wide per letter: each line is as big as the width allows, up to the piece's 26cqw
  const cap = lines.length <= 2 ? 26 : lines.length === 3 ? 16 : 12;
  return lines.map(([w, red]) => `<span class="k-word${red}" style="font-size:min(${cap}cqw, ${(88 / (Math.max(3, w.length) * 0.5)).toFixed(2)}cqw)">${slices(w, 7)}</span>`).join('');
}

function hero(p, m, ctx) {
  const f = files(p), x = p.p, s = ctx.site, meta = s.sections.meta || {};
  const kt = p.kick || 'p';
  const stats = m.stats.filter(t => t.value && t.label);
  const fill = {
    KICK: m.place ? `<${kt} class="${x}-kick">${esc(m.place)}</${kt}>` : '',
    H1: emphasize(m.h1), H1PLAIN: esc(slPage.plain(m.h1)), NAME: esc(m.name),
    NAMEFIT: `font-size:min(12.2cqw, ${(92 / (Math.max(6, String(m.name).length) * 0.55)).toFixed(2)}cqw)`,
    LEAD: m.sub ? `<p class="${x}-lead">${esc(m.sub)}</p>` : '', LEADTEXT: m.sub ? `<p>${esc(m.sub)}</p>` : '',
    ACTIONS: actions(p, m), KWORDS: p.id === 'pressure' ? kWords(m) : '',
    CHIP: m.hours ? `<div class="u-chip"><i></i>${esc(m.hours)}</div>` : stats[0] ? `<div class="u-chip"><i></i>${esc(stats[0].value + ' ' + stats[0].label)}</div>` : '',
    BADGE: stats[0] ? `<span class="q-badge"><b>${esc(stats[0].value)}</b>${esc(stats[0].label)}</span>` : '',
    META: '', PANEL: '', BOARD: '', CAP: ''
  };
  if (p.id === 'pressure') {
    const spans = (m.hours ? [`<span><b>${esc(m.hours)}</b></span>`] : []).concat(stats.slice(0, m.hours ? 2 : 3).map(t => `<span><b>${esc(t.value)}</b> ${esc(t.label)}</span>`));
    fill.META = `<div class="k-meta">${spans.join('')}<span class="k-hint">Click anywhere to land a punch</span></div>`;
  }
  if (p.id === 'prism' && stats.length >= 2) fill.META = `<ul class="o-meta">${stats.slice(0, 3).map(t => `<li><b>${esc(t.value)}</b> ${esc(t.label)}</li>`).join('')}</ul>`;
  if (p.id === 'foil' && m.badges.length) fill.META = `<ul class="j-meta">${m.badges.slice(0, 3).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  if (p.id === 'thermal') {
    const pr = panelRows(m);
    if (pr) fill.PANEL = `<aside class="r-log" aria-label="${esc(pr.title)}"><div class="r-log-head"><span>${esc(pr.title)}</span>${m.city ? `<span class="r-live"><i></i>${esc(m.city)}</span>` : ''}</div>${pr.rows.map(([k, v]) => `<div class="r-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</aside>`;
  }
  const SG = {};
  if (p.id === 'flap') {
    const b = flapBoard(m);
    if (b) {
      fill.BOARD = b.html; SG.sets = b.sets; SG.wid = b.wid;
      fill.CAP = `<div class="sf-cap"><span>${esc(m.name)}${m.city ? ' · ' + esc(m.city) : ''}</span><span${b.sets.length > 1 ? '' : ' hidden'}>The board turns every 8 seconds · <b class="sf-page">1 / ${b.sets.length}</b></span></div>`;
    }
  }
  if (p.id === 'radar') SG.places = [String(meta.city || '').split(',')[0].trim()].concat((ctx.areas || []).map(a => a.name)).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 6);
  if (p.id === 'vinyl') {
    const nm = String(m.name || '').toUpperCase();
    SG.label = nm.length <= 12 ? nm : nm.split(/\s+/)[0].slice(0, 12);
    SG.ring = [nm, String(meta.city || '').toUpperCase(), '33⅓ RPM'].filter(Boolean).join(' · ').slice(0, 54);
    SG.sub = String(meta.businessType || '').toUpperCase().slice(0, 22);
  }
  if (p.id === 'press') {
    const nm = String(m.name || '').toUpperCase().replace(/[^A-Z0-9&' ]/g, '').trim();
    SG.phrases = (nm && nm.length <= 18 ? [nm] : []).concat(['HELLO THERE', 'THANK YOU', 'WITH LOVE']);
  }
  const html = f.html.replace(/\{\{([A-Z0-9]+)\}\}/g, (_, k) => fill[k] != null ? fill[k] : '');
  return { html, SG };
}

// ---- sections under the hero: the piece's own section shell, heading and buttons; content from the binders ----
function head(p, eyebrow, h2, lead) {
  const x = p.p, kt = p.kick || 'p';
  return `<div class="${x}-head sg-at-head">${eyebrow ? `<${kt} class="${x}-kick">${esc(eyebrow)}</${kt}>` : ''}<h2 class="${x}-h2">${h2}</h2>${lead ? `<p>${esc(lead)}</p>` : ''}</div>`;
}
const sec = (p, fam, inner) => `<section class="${p.p}-sec ${p.p}-pad sg-at-sec" data-at-sec="${fam}">${inner}</section>`;
const stars = (n) => n > 0 ? `<span class="sg-at-stars" aria-label="${n} out of 5 stars">${'★'.repeat(Math.min(5, Math.round(n)))}</span>` : '';

const SECTIONS = {
  services(p, m) {
    if (!m.services.length) return '';
    const cards = m.services.map(x => `<article class="sg-at-card">${x.imageUrl ? `<img class="sg-at-img" src="${esc(x.imageUrl)}" alt="${esc(x.title)}" loading="lazy" decoding="async">` : ''}<div class="sg-at-body"><h3>${esc(x.title)}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ''}${x.price ? `<span class="sg-at-price">${esc(x.price)}</span>` : ''}${x.href ? `<a class="sg-at-more" href="${esc(x.href)}">Learn more<span aria-hidden="true"> →</span></a>` : ''}</div></article>`).join('');
    return sec(p, 'services', head(p, m.featHead.eyebrow, emphasize(m.featHead.h2 || 'What we offer'), m.featHead.lead) + `<div class="sg-at-grid">${cards}</div>`);
  },
  about(p, m) {
    const a = m.about; if (!a) return '';
    return sec(p, 'about', `<div class="sg-at-split${a.image ? '' : ' solo'}"><div>${head(p, '', emphasize(a.heading), '')}<div class="sg-at-text">${a.body.split(/\n{2,}/).map(t => `<p>${esc(t)}</p>`).join('')}</div>${a.moreHref ? `<p><a class="${p.btn[1]}" href="${esc(a.moreHref)}">More about us</a></p>` : ''}</div>${a.image ? `<img class="sg-at-photo" src="${esc(a.image)}" alt="${esc(a.imageAlt)}" loading="lazy" decoding="async">` : ''}</div>`);
  },
  stats(p, m) {
    const items = m.stats.filter(t => t.value && t.label); if (items.length < 2) return '';
    return sec(p, 'stats', `<dl class="sg-at-stats">${items.map(t => `<div><dt>${esc(t.label)}</dt><dd${t.countAttrs || ''}>${esc(t.value)}</dd></div>`).join('')}</dl>`);
  },
  reviews(p, m) {
    const r = m.reviews; if (!r) return '';
    const items = r.items.slice(0, 3);
    return sec(p, 'reviews', head(p, m.rating ? `${m.rating.value} ${m.rating.label}` : '', emphasize(r.heading), '') + `<div class="sg-at-quotes">${items.map(q => `<figure class="sg-at-quote">${stars(q.rating)}<blockquote>“${esc(q.quote)}”</blockquote>${q.name ? `<figcaption>${esc(q.name)}${q.role ? ` · ${esc(q.role)}` : ''}</figcaption>` : ''}</figure>`).join('')}</div>${r.moreHref ? `<p class="sg-at-foot"><a class="${p.btn[1]}" href="${esc(r.moreHref)}">${esc(r.moreText)}</a></p>` : ''}`);
  },
  gallery(p, m) {
    const g = m.gallery; if (!g) return '';
    return sec(p, 'gallery', head(p, '', emphasize(g.heading), '') + `<div class="sg-at-gallery">${g.images.map(i => `<img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy" decoding="async">`).join('')}</div>${g.moreHref ? `<p class="sg-at-foot"><a class="${p.btn[1]}" href="${esc(g.moreHref)}">See the gallery</a></p>` : ''}`);
  },
  faq(p, m) {
    const f = m.faq; if (!f) return '';
    return sec(p, 'faq', head(p, '', emphasize(f.heading), '') + `<div class="sg-at-faq">${f.items.map(q => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join('')}</div>`);
  },
  areas(p, m) {
    const a = m.areas; if (!a) return '';
    return sec(p, 'areas', head(p, '', emphasize(a.heading), '') + `<ul class="sg-at-areas">${a.items.map(x => `<li>${x.href ? `<a href="${esc(x.href)}">${esc(x.name)}</a>` : esc(x.name)}</li>`).join('')}</ul>`);
  },
  cta(p, m, ctx) {
    const c = content.bind('cta', ctx); if (!c) return '';
    return sec(p, 'cta', `<div class="sg-at-cta">${head(p, m.place, emphasize(c.heading), '')}${m.contactRows.length ? `<dl class="sg-at-rows">${m.contactRows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === 'Phone' ? `<a href="tel:${telOf(v)}">${esc(v)}</a>` : k === 'Email' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : esc(v)}</dd></div>`).join('')}</dl>` : ''}${actions(p, m)}</div>`);
  }
};
const ORDER = ['services', 'about', 'stats', 'reviews', 'gallery', 'faq', 'areas', 'cta'];
const FAMILY = { services: 'services', about: 'about', stats: 'stats', reviews: 'testimonials', gallery: 'gallery', faq: 'faq', areas: 'areas', cta: 'cta' };

// The variables the shared section styles (public/sg-atelier.css) read
function vars(p) {
  const c = colors(p);
  return [['--at-bg', c.bg], ['--at-surface', c.surface], ['--at-text', c.text], ['--at-muted', c.muted], ['--at-line', c.line], ['--at-accent', c.accent], ['--at-accent-ink', c.accentInk], ['--at-on', c.on], ['--at-display', p.fonts[0]], ['--at-body', p.fonts[1]], ['--at-r', p.r + 'px']].map(([k, v]) => `${k}:${v}`).join(';');
}

// The script that starts the artwork. With motion turned off (or reduced-motion visitors), each piece draws one still frame.
// sel: where the artwork lives (a mixed page can hold more than one block of the same piece)
function boot(p, SG, still, sel) {
  const init = files(p).js.trim();
  return `<script>(function(){var root=document.querySelector('${(sel || '.sg-atelier .p-' + p.id).replace(/['\\]/g, '')}');if(!root)return;var SG=${JSON.stringify(SG).replace(/</g, '\\u003c')};var mm=window.matchMedia,still=${still ? 'true' : 'false'};`
    + `if(still)window.matchMedia=function(q){return /reduced-motion/.test(q)?{matches:true,media:q,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){}}:mm.call(window,q)};`
    + `try{(${init})(root,SG);}catch(e){if(window.console)console.error('Atelier piece',e);}finally{window.matchMedia=mm;}})();</script>`;
}

// The Signature home page: hero artwork, then sections with real content
function render(ctx) {
  const p = get(ctx.site.theme && ctx.site.theme.style);
  if (!p) return { html: '', sections: [] };
  const m = slPage.model(ctx);
  const h = hero(p, m, ctx);
  const secs = ORDER.map(k => [k, SECTIONS[k](p, m, ctx)]).filter(x => x[1]);
  const css = files(p).css.trim();
  const len = slPage.plain(m.h1).length, hlen = len <= 22 ? 's' : len <= 34 ? 'm' : len <= 52 ? 'l' : 'xl';
  // SiteGen's own h1-h3 rule (one element selector) would recolor the piece's headings; this puts back what each piece expects
  const reset = ':where(.sg-atelier) h1,:where(.sg-atelier) h2,:where(.sg-atelier) h3,:where(.sg-atelier) h4{color:inherit;font-family:inherit;line-height:inherit}';
  const html = `<div class="sg-atelier" data-piece="${p.id}" data-hlen="${hlen}"${ctx.still ? ' data-still' : ''} style="${vars(p)}"><style>${reset}\n${css}</style>`
    + `<div class="p-${p.id}">${h.html}${secs.map(x => x[1]).join('')}</div>${boot(p, h.SG, !!ctx.still)}</div>`;
  return { html, sections: ['hero'].concat(secs.map(x => x[0])), piece: p.id };
}

// Each piece as a SiteGen style, so the other pages, the menu and the footer match
function themeEntry(p) {
  const c = colors(p), dark = p.mode === 'Dark';
  const gf = GF[p.id].split('&family='), fam = (css) => css.split(',')[0].replace(/'/g, '');
  const lines = [
    `.btn, nav.site-nav .links a.nav-cta, nav.site-nav .nav-cta { border-radius: ${p.r >= 12 ? '999px' : p.r + 'px'}; }`,
    '.section-head .rule { background: var(--primary); }',
    '.cta-band { background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 72%, var(--primary))); }'
  ];
  if (dark) lines.push(
    'nav.site-nav { background: color-mix(in srgb, var(--page-bg) 92%, transparent); border-bottom: 1px solid var(--border); }',
    'nav.site-nav .links a:not(.nav-cta) { color: var(--ink); }',
    '.card, details.faq-item, .contact-card, .service-links a, .testimonial-card, .review-card, .feat-card, .step-card, .hero-card, .price-card { background: var(--surface); border: 1px solid var(--border); color: var(--ink); }',
    '.contact-form input, .contact-form textarea, .contact-form select, .quote-form input, .quote-form textarea, .quote-form select { background: var(--page-bg); color: var(--ink); border-color: var(--border); }',
    '.cookie-bar, .mobile-bar, .skip-link { background: var(--surface); color: var(--ink); }',
    '.top-bar { background: color-mix(in srgb, var(--page-bg) 70%, black); }',
    'footer.site-footer { background: color-mix(in srgb, var(--page-bg) 78%, black); border-top: 1px solid var(--border); }'
  );
  // the closing band carries white text, so its color is kept dark enough
  const band = contrast.ensureContrast(c.accent, '#ffffff', contrast.AA_TEXT);
  return {
    id: PREFIX + p.id, atelier: true, dark, label: `${p.name} (${p.kind.toLowerCase()})`, home: 'atelier', hero: 'left',
    heading: { name: fam(p.fonts[0]), param: gf[0], css: p.fonts[0] },
    body: { name: fam(p.fonts[1]), param: gf.slice(1).join('&family=') || gf[0], css: p.fonts[1] },
    palette: { primary: c.accent, accent: band },
    vars: {
      '--ink': c.text, '--muted': c.muted, '--page-bg': c.bg, '--surface': c.surface, '--border': c.line,
      '--radius': Math.min(p.r, 18) + 'px', '--radius-sm': Math.round(Math.min(p.r, 18) * 0.6) + 'px',
      '--shadow-sm': dark ? '0 1px 2px rgba(0,0,0,0.5)' : `0 1px 3px color-mix(in srgb, ${c.text} 10%, transparent)`,
      '--shadow-md': dark ? '0 14px 40px rgba(0,0,0,0.55)' : `0 14px 34px color-mix(in srgb, ${c.text} 14%, transparent)`
    },
    css: lines.join('\n')
  };
}
const THEME_ENTRIES = PIECES.map(themeEntry);
const HINTS = Object.fromEntries(PIECES.map(p => [PREFIX + p.id, `Signature (premium). ${p.look} Designed for a ${p.kind.toLowerCase()}. Keeps its own colors.`]));

// The Signature piece made for a business type, if there is one
function forBusiness(businessType) {
  const t = String(businessType || '');
  if (!t.trim()) return null;
  const p = PIECES.find(x => x.words.test(t));
  return p ? PREFIX + p.id : null;
}

module.exports = { PREFIX, PIECES, GF, GRAD, get, isAtelier, render, themeEntry, THEME_ENTRIES, HINTS, forBusiness, colors, flapText, ORDER, FAMILY, SECTIONS, hero, vars, files, boot };
