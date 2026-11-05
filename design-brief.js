// Turns an industry's design guidance (industry-design.js) into short text blocks for the AI prompts, so the
// copy and the chat-to-edit suggestions follow the same advice the editor shows. The guidance only shapes tone,
// structure and design choices; it never adds facts, and the owner's request always wins.
const { findTemplate } = require('./templates');
const industry = require('./industry-design');
const themes = require('./themes');
const contrast = require('./contrast');
const OPTION_WORDS = { heroCinematic: 'the Lively motion style', heroFloat: 'floating shapes over the hero', hoverLift: 'cards that lift on hover', doodles: 'doodles', emojiHeads: 'emoji in headings' };

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function adviceFor(businessType) {
  const tpl = findTemplate(businessType || '');
  return tpl && tpl.id !== 'generic' ? industry.industryDesign(tpl.id) : null;
}

// Text for the copywriting prompt: tone, page flow and cautions.
function copyBrief(businessType, style) {
  const a = adviceFor(businessType);
  if (!a) return '';
  const look = themes.STYLE_HINTS[style] || '';
  const lines = [
    `Design direction for ${a.label.toLowerCase()} sites (tone and structure only; it never adds facts):`,
    look && `- The site's look: ${clip(look, 120)}`,
    a.landing && `- Page flow that works: ${clip(a.landing.sections, 220)}${a.landing.cta ? `; main call to action: ${clip(a.landing.cta, 80)}` : ''}`,
    a.avoid.length && `- Avoid in the wording and feel: ${a.avoid.slice(0, 5).map(x => clip(x, 60)).join('; ')}`,
    a.motion === 'calm' && '- Keep the tone calm and reassuring, not flashy.'
  ].filter(Boolean);
  return lines.join('\n');
}

// Text for the chat-to-edit prompt: styles and colours to prefer, what to steer away from.
function editBrief(site) {
  const a = adviceFor(site.sections && site.sections.meta && site.sections.meta.businessType);
  if (!a) return '';
  const usable = a.palettes.filter(p => { const L = contrast.luminance(p.primaryColor); return L > 0.04 && L < 0.6; });
  const pal = usable.slice(0, 2).map(p => `${p.primaryColor} with ${p.accentColor}`).join('; ');
  const lines = [
    `Design guidance for ${a.label.toLowerCase()} sites (prefer it when choosing styles or colours; if the owner asks for something different, do what they ask and mention the concern in your reply):`,
    a.recommendedStyles.length && `- Styles that suit this business: ${a.recommendedStyles.join(', ')}`,
    a.avoidStyles.length && `- Styles usually not recommended: ${a.avoidStyles.map(x => x.id).join(', ')}`,
    pal && `- Suitable color pairs: ${pal}`,
    a.avoidOptions.length && `- Options usually not recommended: ${a.avoidOptions.map(o => OPTION_WORDS[o] || o).join(', ')}`,
    a.avoid.length && `- Avoid: ${a.avoid.slice(0, 4).map(x => clip(x, 60)).join('; ')}`
  ].filter(Boolean);
  return lines.join('\n');
}

// After the AI proposes changes: notes for any that go against the guidance (the change is still allowed).
function warnings(site, ops) {
  const a = adviceFor(site.sections && site.sections.meta && site.sections.meta.businessType);
  if (!a) return [];
  const out = [];
  const avoidStyle = new Map(a.avoidStyles.map(x => [x.id, x.why]));
  const flag = { doodles: 'doodles', emojiHeads: 'emojiHeads' };
  for (const op of ops || []) {
    if (!op || op.op !== 'set' || typeof op.path !== 'string') continue;
    if (op.path === 'theme.style' && avoidStyle.has(op.value)) {
      out.push(`The "${op.value}" style is usually not recommended for ${a.label.toLowerCase()} sites (${String(avoidStyle.get(op.value)).replace(/^"[^"]*":\s*/, '')}).`);
    }
    const k = op.path.startsWith('theme.') ? op.path.slice(6) : '';
    if (flag[k] && (op.value === true || op.value === 'true') && a.avoidOptions.includes(flag[k])) {
      out.push(`${k === 'doodles' ? 'Doodles' : 'Emoji headings'} are usually not recommended for ${a.label.toLowerCase()} sites.`);
    }
  }
  return [...new Set(out)];
}

module.exports = { copyBrief, editBrief, warnings, adviceFor };
