// After the client questionnaire: turn the business type, the look the client picked and their own
// "vibe" words into 2-3 concrete design options the owner can choose between before building.
// Everything is computed here from the saved answers; the browser only sends back which option number.
const { findTemplate } = require('./templates');
const industry = require('./industry-design');
const themes = require('./themes');
const contrast = require('./contrast');

const VALID = new Set(themes.ALL_STYLES);

// words a client might use -> the SiteGen styles that fit them
const VIBES = [
  [/luxur|elegan|upscale|refined|classy|high.?end|premium|sophisticat/, ['luxe', 'noir', 'editorial']],
  [/bold|strong|powerful|confident|tough|rugged|loud|big/, ['bold', 'poster', 'agency']],
  [/friendly|warm|cozy|welcom|family|homey|inviting|caring/, ['warm', 'modern']],
  [/playful|fun|colou?rful|bright|kids?|cheerful|quirky|cute/, ['playful', 'blush']],
  [/modern|clean|simple|minimal|crisp|fresh|sleek/, ['modern', 'minimal', 'studio']],
  [/trust|professional|corporate|serious|credible|established|reliab/, ['corporate', 'classic']],
  [/natural|organic|earth|green|garden|farm|handmade|rustic/, ['earthy', 'warm']],
  [/calm|relax|peace|airy|soothing|serene|spa|clean air|ocean|beach/, ['coastal', 'minimal']],
  [/dark|moody|night|black|edgy|dramatic/, ['noir', 'midnight']],
  [/photo|portfolio|visual|gallery|images?|showcase|our work/, ['gallery', 'studio']],
  [/magazine|story|journal|editorial|blog/, ['editorial', 'journal']],
  [/traditional|classic|timeless|old.?school|heritage/, ['classic', 'journal']]
].map(([re, styles]) => [re, styles]);

const WHY = {
  modern: 'clean and easy to read', classic: 'traditional and trustworthy', bold: 'big, strong and confident',
  editorial: 'magazine-style and upscale', minimal: 'quiet, simple and spacious', warm: 'warm and welcoming',
  midnight: 'dark and high-energy', split: 'balanced with a strong first screen', poster: 'loud and eye-catching',
  agency: 'sharp and confident', luxe: 'elegant and refined', coastal: 'calm and airy', playful: 'bright and fun',
  earthy: 'natural and down-to-earth', corporate: 'structured and professional', blush: 'soft and friendly',
  studio: 'tidy and photo-friendly', gallery: 'photo-first so your work does the talking',
  noir: 'dark and luxurious', journal: 'story-led and personal'
};

function vibeScores(text) {
  const t = String(text || '').toLowerCase();
  const score = {};
  for (const [re, styles] of VIBES) if (re.test(t)) styles.forEach((s, i) => { score[s] = (score[s] || 0) + (3 - i); });
  return score;
}

function darken(hex, amount = 0.45) {
  const p = contrast.parseHex(hex); if (!p) return hex;
  return '#' + p.map(v => Math.round(v * (1 - amount)).toString(16).padStart(2, '0')).join('');
}

// a palette is usable if its main colour is a real colour (not near-black / near-white) and not already
// used by another option; dark styles are the exception because they set their own background
function pickPalette(palettes, style, used) {
  const dark = style === 'noir' || style === 'midnight';
  const ok = (p) => {
    const L = contrast.luminance(p.primaryColor);
    return !used.has(p.primaryColor) && (dark || (L > 0.04 && L < 0.6));
  };
  return palettes.find(ok) || null;
}

// d = cleaned questionnaire answers (see intake.clean)
function designOptions(d, max = 3) {
  d = d || {};
  const tpl = findTemplate(d.bizType || '');
  const adv = tpl && tpl.id !== 'generic' ? industry.industryDesign(tpl.id) : null;
  const avoid = new Set(adv ? adv.avoidStyles.map(a => a.id) : []);
  const vibeText = [d.diff, d.inspoLike, d.notes, d.tagline].filter(Boolean).join(' ');
  const vibes = vibeScores(vibeText);
  const vibeStyles = Object.keys(vibes).sort((a, b) => vibes[b] - vibes[a]).filter(s => VALID.has(s));

  const picks = [];
  const add = (style, source) => { if (VALID.has(style) && !picks.some(p => p.style === style)) picks.push({ style, source }); };
  if (d.mood) add(d.mood, 'client');                                   // what the client asked for always leads
  vibeStyles.filter(s => !avoid.has(s)).forEach(s => add(s, 'vibe'));
  if (adv) adv.recommendedStyles.forEach(s => add(s, 'industry'));
  ['modern', 'warm', 'classic'].filter(s => !avoid.has(s)).forEach(s => add(s, 'fallback'));
  // make sure an industry pick shows up even when the client's words filled the list
  if (adv && picks.length > max && !picks.slice(0, max).some(p => p.source === 'industry')) {
    const ind = picks.find(p => p.source === 'industry');
    if (ind) { picks.splice(picks.indexOf(ind), 1); picks.splice(max - 1, 0, ind); }
  }

  const brand = d.brandColor && contrast.parseHex(d.brandColor) ? d.brandColor : '';
  const used = new Set();
  const options = picks.slice(0, Math.min(max, 3)).map((p, i) => {
    const pal = !brand && adv ? pickPalette(adv.palettes, p.style, used) : null;
    if (pal) used.add(pal.primaryColor);
    const font = adv && adv.fonts.length ? adv.fonts[i % adv.fonts.length] : null;
    const primary = brand || (pal && pal.primaryColor) || '';
    const reasons = [];
    if (p.source === 'client') reasons.push('the look the client picked');
    if (p.source === 'vibe') reasons.push('matches the words the client used');
    if (p.source === 'industry') reasons.push(`suits ${adv.label.toLowerCase()} businesses`);
    if (p.source === 'fallback') reasons.push('a safe all-round choice');
    if (brand) reasons.push('uses the client\'s brand color');
    return {
      index: i, style: p.style, source: p.source, title: `Option ${i + 1}`,
      description: WHY[p.style] || '',
      primaryColor: primary, accentColor: primary ? (pal && pal.accentColor) || darken(primary) : '',
      headingFont: font ? font.heading : '', bodyFont: font ? font.body : '',
      why: reasons.join('; '),
      flow: adv && adv.landing ? adv.landing.sections : '',
      cautions: p.source === 'client' && avoid.has(p.style) ? 'This is usually not recommended for this kind of business, but it is what the client chose.' : ''
    };
  });
  return { options, industry: adv ? adv.label : '', fit: adv ? adv.fit : '', matchedWords: vibeStyles.length > 0 };
}

// copy one option onto a theme object (server-side only)
function applyOption(theme, option) {
  if (!option) return theme;
  theme.style = option.style;
  if (option.primaryColor) { theme.primaryColor = option.primaryColor; theme.accentColor = option.accentColor; }
  if (option.headingFont) theme.headingFont = option.headingFont;
  if (option.bodyFont) theme.bodyFont = option.bodyFont;
  return theme;
}

module.exports = { designOptions, applyOption, vibeScores };
