// Motion style: one setting per site (Subtle, Lively or None) that drives the single animation script
// (public/sitegen-motion.js, built on the bundled Motion library). Templates only output data-animate /
// data-count attributes; this module decides which preset a site uses and which one to suggest.

const PRESETS = [
  { id: 'subtle', label: 'Subtle', hint: 'Soft fade-ups and quick counters. Calm and professional.' },
  { id: 'lively', label: 'Lively', hint: 'Bigger movement, word-by-word headline, a slow photo zoom. Fun and energetic.' },
  { id: 'none', label: 'None', hint: 'No animation at all.' }
];
const IDS = PRESETS.map(p => p.id);
const DEFAULT = 'subtle';

// industry template -> suggested preset (anything not listed is Subtle)
const BY_TEMPLATE = {
  restaurant: 'lively', bakery: 'lively', 'coffee-shop': 'lively', catering: 'lively', 'party-rental': 'lively', wedding: 'lively',
  florist: 'lively', fitness: 'lively', daycare: 'lively', 'pet-grooming': 'lively', 'mobile-grooming': 'lively', 'pet-care': 'lively',
  'dog-training': 'lively', tattoo: 'lively', barber: 'lively', photography: 'lively',
  'home-care': 'subtle', insurance: 'subtle', law: 'subtle', accounting: 'subtle', dentist: 'subtle', chiropractor: 'subtle',
  'real-estate': 'subtle', veterinary: 'subtle'
};
// visual style -> suggested preset, used when the industry has no opinion
const BY_STYLE = { playful: 'lively', poster: 'lively', agency: 'lively', blush: 'lively', classic: 'subtle', corporate: 'subtle', minimal: 'subtle', journal: 'subtle' };

const isValid = (v) => IDS.includes(v);

// The preset a site actually uses. Sites saved before this setting existed keep what they had:
// a scroll animation or the cinematic hero maps to Subtle/Lively, and everything else stays still.
function resolve(theme, hero) {
  theme = theme || {};
  if (isValid(theme.motionStyle)) return theme.motionStyle;
  if (hero && hero.motion === 'cinematic') return 'lively';
  if (['fade', 'rise', 'slide', 'zoom'].includes(theme.motion)) return theme.motion === 'zoom' ? 'lively' : 'subtle';
  return 'none';
}

// advice = industry-design result (its .motion === 'calm' caps the suggestion at Subtle)
function suggest({ templateId, style, advice } = {}) {
  let pick = BY_TEMPLATE[templateId] || BY_STYLE[style] || DEFAULT;
  if (advice && advice.motion === 'calm' && pick === 'lively') pick = 'subtle';
  return pick;
}

// "1,500+" -> { value: 1500, prefix: '', suffix: '+', decimals: 0 }; null when there is no number to count to
function parseCount(text) {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(String(text == null ? '' : text).trim());
  if (!m) return null;
  const value = parseFloat(m[2].replace(/,/g, ''));
  if (!Number.isFinite(value) || value > 1e12) return null;
  return { value, prefix: m[1], suffix: m[3], decimals: (m[2].split('.')[1] || '').length, comma: m[2].includes(',') };
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// the attribute string for a stat element, e.g. ` data-count="1500" data-suffix="+"` (empty when not a number)
function countAttrs(text) {
  const c = parseCount(text);
  if (!c || c.prefix.length > 4 || c.suffix.length > 12) return '';
  if (/^[\/:\-–]/.test(c.suffix) || /[\d]/.test(c.suffix)) return '';          // 24/7, 9-5, 10:30: not a quantity
  if (c.value >= 1900 && c.value <= 2100 && c.decimals === 0) return '';   // a year, not a quantity
  let a = ` data-count="${c.value}"`;
  if (c.prefix) a += ` data-prefix="${esc(c.prefix)}"`;
  if (c.suffix) a += ` data-suffix="${esc(c.suffix)}"`;
  if (c.decimals) a += ` data-decimals="${c.decimals}"`;
  if (c.comma) a += ' data-comma="1"';
  return a;
}


// ---- Motion level (tier): which features are on. Motion style (above) stays the intensity. ----
//   standard: no libraries, scroll reveals + hover lift (public/sg-motion-lite.js)
//   premium : Motion library choreography, scroll-linked effects, lazy Lottie icons
//   showcase: premium + a lazy WebGL shader hero background
const LEVELS = [
  { id: 'standard', label: 'Standard', hint: 'Lightweight reveals and a subtle hover lift. No libraries. Fastest.' },
  { id: 'premium', label: 'Premium', hint: 'Staggered hero, parallax, progress bar and animated icons. Loads the Motion library.' },
  { id: 'showcase', label: 'Showcase', hint: 'Premium plus an animated gradient hero background (WebGL). The heaviest option.' }
];
const LEVEL_IDS = LEVELS.map(l => l.id);
const LEVEL_DEFAULT = 'standard';
const isLevel = (v) => LEVEL_IDS.includes(v);

const SHADERS = [
  { id: 'aurora', label: 'Aurora', hint: 'Slow flowing bands of colour.' },
  { id: 'mesh', label: 'Mesh', hint: 'Soft colour blobs drifting.' },
  { id: 'silk', label: 'Silk', hint: 'Gentle rippling waves.' }
];
const SHADER_IDS = SHADERS.map(s => s.id);
const isShader = (v) => SHADER_IDS.includes(v);

// recommended level per industry, with the one-line reason shown in the editor
const LEVEL_BY_TEMPLATE = {
  restaurant: 'showcase', bakery: 'premium', 'coffee-shop': 'premium', catering: 'premium', wedding: 'showcase', florist: 'premium',
  salon: 'showcase', spa: 'showcase', barber: 'premium', tattoo: 'premium', fitness: 'showcase', photography: 'premium',
  'party-rental': 'premium', 'real-estate': 'premium', 'home-care': 'premium', daycare: 'premium', 'pet-grooming': 'premium', 'mobile-grooming': 'premium',
  'pet-care': 'premium', 'dog-training': 'premium', 'car-detailing': 'premium',
  plumbing: 'standard', electrician: 'standard', hvac: 'standard', roofing: 'standard', contractor: 'premium', landscaping: 'premium',
  law: 'standard', accounting: 'standard', insurance: 'standard', dentist: 'standard', chiropractor: 'standard', veterinary: 'standard'
};
const LEVEL_WHY = {
  standard: 'Visitors here want answers fast, so a light, quick page builds more trust than effects.',
  premium: 'Polished motion and animated icons make this kind of business feel professional without slowing the page much.',
  showcase: 'A visual, experience-led business: the animated hero background helps it stand out. It is the heaviest option, so check the quality report.'
};
function suggestLevel({ templateId } = {}) {
  const level = LEVEL_BY_TEMPLATE[templateId] || LEVEL_DEFAULT;
  return { level, why: LEVEL_WHY[level] };
}

// The level a site actually uses. Sites saved before levels existed keep their look: Lively becomes Premium.
function resolveLevel(theme, hero) {
  theme = theme || {};
  if (isLevel(theme.motionLevel)) return theme.motionLevel;
  return resolve(theme, hero) === 'lively' ? 'premium' : LEVEL_DEFAULT;
}

// Lottie icons picked by industry (file names in public/lottie/icons.js). First = hero badge, second = services heading.
const ICONS_BY_TEMPLATE = {
  restaurant: ['bowl', 'cutlery'], bakery: ['bowl', 'sparkle'], 'coffee-shop': ['bowl', 'sparkle'], catering: ['cutlery', 'bowl'],
  'home-care': ['heart', 'home'], 'real-estate': ['home', 'key'], contractor: ['hammer', 'wrench'], plumbing: ['wrench', 'home'],
  electrician: ['wrench', 'sparkle'], hvac: ['wrench', 'home'], roofing: ['hammer', 'home'], painting: ['hammer', 'home'],
  landscaping: ['sparkle', 'home'], cleaning: ['sparkle', 'home'], salon: ['scissors', 'sparkle'], barber: ['scissors', 'sparkle'],
  spa: ['sparkle', 'heart'], law: ['scales', 'sparkle'], accounting: ['scales', 'key'], insurance: ['home', 'scales'],
  dentist: ['sparkle', 'heart'], chiropractor: ['heart', 'sparkle'], veterinary: ['heart', 'home'], daycare: ['heart', 'sparkle']
};
const ICON_NAMES = ['bowl', 'cutlery', 'heart', 'home', 'key', 'hammer', 'wrench', 'scissors', 'sparkle', 'scales'];
function iconsFor(templateId) { return ICONS_BY_TEMPLATE[templateId] || ['sparkle', 'heart']; }

module.exports = {
  LEVELS, LEVEL_IDS, LEVEL_DEFAULT, isLevel, SHADERS, SHADER_IDS, isShader, suggestLevel, resolveLevel, iconsFor, ICON_NAMES, LEVEL_BY_TEMPLATE, PRESETS, IDS, DEFAULT, BY_TEMPLATE, BY_STYLE, isValid, resolve, suggest, parseCount, countAttrs };
