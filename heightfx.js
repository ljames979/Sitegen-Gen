// Section height: any block or section can be drawn shorter or taller than its design: the space above and below
// its content shrinks or grows, or it fills the whole screen with its content centered. Saved on a content block
// (block.height) and on each block of a Blocks page (mix item height). The padding sits on a different element in
// each kind of section, so the rule names the one that carries it (BOX below). On phones the
// extra space is a little smaller.
const OPTIONS = [
  ['', 'Normal height'],
  ['xs', 'Extra small'],
  ['tight', 'Shortest'],
  ['compact', 'Shorter'],
  ['roomy', 'Taller'],
  ['tall', 'Much taller'],
  ['screen', 'Full screen'],
];
const PAD = { xs: 0, tight: 8, compact: 32, roomy: 128, tall: 200 };
const HERO = { xs: '0px', tight: '0px', compact: 'min(62svh, 620px)', roomy: '115svh', tall: '135svh', screen: 'calc(100svh - var(--pin-top, 0px))' };
const IDS = OPTIONS.map(o => o[0]);
const clean = (v) => (IDS.includes(v) ? v : '');
function attrs(v) {
  const h = clean(v);
  if (!h) return { cls: '', style: '' };
  return { cls: ` sg-ht sg-ht-${h}`, style: PAD[h] != null ? `--sg-ht: ${PAD[h]}px;` : '' };
}

// the section box of each kind of block: a library section's container, a content block, a Style Library section,
// a Signature piece's section
const BOX = (w) => `${w} .sg-lib > div > div:first-child,${w} section.blk,${w} .sl-sec > section,${w} .sg-mix-at > div > section`;
const CSS = [
  `${BOX('.sg-ht:not(.sg-ht-screen)')}{padding-top:var(--sg-ht) !important;padding-bottom:var(--sg-ht) !important}`,
  `@media (max-width:760px){${BOX('.sg-ht-roomy')},${BOX('.sg-ht-tall')}{padding-top:calc(var(--sg-ht) * .65) !important;padding-bottom:calc(var(--sg-ht) * .65) !important}}`,
  // extra small: no space around the section, and the roomy padding inside its design trimmed too
  `.sg-ht-xs :is(.sg-lib > div > div:first-child, section.blk) :is([class*="tw:py-"], [class*="tw:pt-"], [class*="tw:pb-"], .blk-inner){padding-top:12px !important;padding-bottom:12px !important}`,
  `.sg-ht-xs .sg-lib [class*="tw:mt-"]:not(img){margin-top:.75rem !important}`,
  // full screen: at least the screen's height (less a header that stays on top), the content centered up and down
  `${BOX('.sg-ht-screen')}{min-height:calc(100svh - var(--pin-top, 0px));display:flex !important;flex-direction:column;justify-content:center;box-sizing:border-box}`,
  `:where(.sg-ht-screen .sg-lib > div > div:first-child, .sg-ht-screen section.blk, .sg-ht-screen .sl-sec > section, .sg-ht-screen .sg-mix-at > div > section) > *{width:100%}`,
  // a Blocks page's hero takes its height from the screen (a minimum height on its background), so that is what changes
  // (a Style Library or Signature hero: its section)
  ...Object.entries(HERO).map(([h, mh]) => `.sg-ht-${h}[data-mix-f="hero"] :is(.sg-lib > div, .sl-sec > section, .sg-mix-at > div > section){min-height:${mh} !important}`),
].join('\n');

module.exports = { OPTIONS, IDS, PAD, HERO, clean, attrs, CSS };
