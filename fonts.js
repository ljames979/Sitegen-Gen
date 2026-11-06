// Curated Google Fonts for heading/body overrides, plus support for any other
// Google Font typed in by name. "single" fonts have only a regular weight, so
// headings in them are shown at normal weight instead of fake bold.
const FONTS = [
  // eccentric / display: good for tattoo shops, bars, barbers, bands, events
  { name: 'Pirata One', group: 'Eccentric', single: true, hint: 'tattoo-flash blackletter' },
  { name: 'UnifrakturCook', group: 'Eccentric', weights: '700', hint: 'old-English gothic' },
  { name: 'Metal Mania', group: 'Eccentric', single: true, hint: 'heavy metal' },
  { name: 'Sancreek', group: 'Eccentric', single: true, hint: 'wild west' },
  { name: 'Rye', group: 'Eccentric', single: true, hint: 'western saloon' },
  { name: 'Permanent Marker', group: 'Eccentric', single: true, hint: 'hand-drawn marker' },
  { name: 'Rock Salt', group: 'Eccentric', single: true, hint: 'scratchy handwriting' },
  { name: 'Special Elite', group: 'Eccentric', single: true, hint: 'typewriter' },
  { name: 'Black Ops One', group: 'Eccentric', single: true, hint: 'stencil' },
  { name: 'Creepster', group: 'Eccentric', single: true, hint: 'horror' },
  { name: 'Bangers', group: 'Eccentric', single: true, hint: 'comic book' },
  { name: 'Cinzel Decorative', group: 'Eccentric', weights: '700', hint: 'ornate roman' },
  // special fonts (Leo, 2026-11-06): free Google look-alikes of hand-lettering styles (retro swirly script, brush
  // script, hand-drawn capitals, tall cartoon capitals, worn wide capitals); shown as cards under Fonts > Special Fonts
  { name: 'Leckerli One', group: 'Special fonts', single: true, hint: 'retro swirly script', look: 'Retro swirly script' },
  { name: 'Sonsie One', group: 'Special fonts', single: true, hint: 'swashy groovy script', look: 'Swashy groovy script' },
  { name: 'Shrikhand', group: 'Special fonts', single: true, hint: 'chunky retro italic', look: 'Chunky retro italic' },
  { name: 'Yellowtail', group: 'Special fonts', single: true, hint: 'brush script', look: 'Brush script' },
  { name: 'Kaushan Script', group: 'Special fonts', single: true, hint: 'bold brush script', look: 'Bold brush script' },
  { name: 'Gloria Hallelujah', group: 'Special fonts', single: true, hint: 'hand-drawn capitals', look: 'Hand-drawn capitals', caps: true },
  { name: 'Gochi Hand', group: 'Special fonts', single: true, hint: 'marker hand lettering', look: 'Marker hand lettering', caps: true },
  { name: 'Luckiest Guy', group: 'Special fonts', single: true, hint: 'tall cartoon capitals', look: 'Tall cartoon capitals', caps: true },
  { name: 'Chicle', group: 'Special fonts', single: true, hint: 'bouncy condensed capitals', look: 'Bouncy condensed capitals', caps: true },
  { name: 'Rubik Dirt', group: 'Special fonts', single: true, hint: 'worn wide capitals', look: 'Worn wide capitals', caps: true },
  // bold headlines
  { name: 'Bebas Neue', group: 'Bold headlines', single: true },
  { name: 'Anton', group: 'Bold headlines', single: true },
  { name: 'Oswald', group: 'Bold headlines', weights: '500;700' },
  { name: 'Staatliches', group: 'Bold headlines', single: true },
  { name: 'Abril Fatface', group: 'Bold headlines', single: true },
  { name: 'Archivo Black', group: 'Bold headlines', single: true },
  // elegant serif
  { name: 'Playfair Display', group: 'Elegant', weights: '500;600;700' },
  { name: 'Cormorant Garamond', group: 'Elegant', weights: '500;600;700' },
  { name: 'Lora', group: 'Elegant', weights: '400;500;600;700' },
  { name: 'Merriweather', group: 'Elegant', weights: '400;700' },
  { name: 'DM Serif Display', group: 'Elegant', single: true },
  // clean sans
  { name: 'Inter', group: 'Clean', weights: '400;500;600;700;800' },
  { name: 'Poppins', group: 'Clean', weights: '400;500;600;700' },
  { name: 'DM Sans', group: 'Clean', weights: '400;500;600;700' },
  { name: 'Montserrat', group: 'Clean', weights: '400;500;600;700;800' },
  { name: 'Work Sans', group: 'Clean', weights: '400;500;600;700' },
  { name: 'Open Sans', group: 'Clean', weights: '400;500;600;700' },
  { name: 'Nunito', group: 'Clean', weights: '400;600;700;800' },
  // script / handwriting
  { name: 'Lobster', group: 'Script', single: true },
  { name: 'Pacifico', group: 'Script', single: true },
  { name: 'Caveat', group: 'Script', weights: '500;700' },
  { name: 'Dancing Script', group: 'Script', weights: '500;700' },
  // variable: smooth weight (and some width) ranges, so "Headline movement" can grow them as they appear
  { name: 'Roboto Flex', group: 'Variable (for moving headlines)', axes: 'opsz,wdth,wght@8..144,25..151,100..1000' },
  { name: 'Bricolage Grotesque', group: 'Variable (for moving headlines)', axes: 'opsz,wdth,wght@12..96,75..100,200..800' },
  { name: 'Anybody', group: 'Variable (for moving headlines)', axes: 'wdth,wght@50..150,100..900' },
  { name: 'Fraunces', group: 'Variable (for moving headlines)', axes: 'opsz,wght@9..144,100..900' },
  { name: 'Unbounded', group: 'Variable (for moving headlines)', axes: 'wght@200..900' },
  { name: 'Big Shoulders Display', group: 'Variable (for moving headlines)', axes: 'wght@100..900' },
  { name: 'Inter Tight', group: 'Variable (for moving headlines)', axes: 'wght@100..900' },
  // mono
  { name: 'Space Mono', group: 'Mono', weights: '400;700' },
  { name: 'Courier Prime', group: 'Mono', weights: '400;700' }
];

const byName = new Map(FONTS.map(f => [f.name.toLowerCase(), f]));
const CUSTOM_RE = /^[A-Za-z][A-Za-z0-9 ]{1,39}$/; // what Google Font names look like

// Accepts a curated name or a custom Google Font name; returns the clean name or ''.
function cleanFontName(value) {
  const v = String(value || '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const known = byName.get(v.toLowerCase());
  if (known) return known.name;
  return CUSTOM_RE.test(v) ? v : '';
}

function isSingleWeight(name) {
  const f = byName.get(String(name || '').toLowerCase());
  return f ? !!f.single : true; // unknown custom fonts: assume regular only, so no fake bold
}

// One family entry for the Google Fonts CSS2 URL.
function familyParam(name) {
  const f = byName.get(String(name).toLowerCase());
  const enc = encodeURIComponent(name).replace(/%20/g, '+');
  if (f && f.axes) return `family=${enc}:${f.axes}`;
  if (f && f.weights) return `family=${enc}:wght@${f.weights}`;
  return `family=${enc}`;
}

function cssFamily(name, fallback) {
  return `'${name}', ${fallback}`;
}

const isVariable = (name) => { const f = byName.get(String(name || '').toLowerCase()); return !!(f && f.axes); };

const SPECIAL = FONTS.filter(f => f.group === 'Special fonts');

module.exports = { SPECIAL, isVariable, FONTS, cleanFontName, isSingleWeight, familyParam, cssFamily };
