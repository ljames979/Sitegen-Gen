// "Hero card" content block (Leo's product-hero screenshot, 2026-10-31): one full-screen card on a soft one-color
// fade. A huge title across the top, the owner's picture or video reel in the middle (a cut-out product photo looks
// best), a few words and a price low on the left, a detail with two buttons low on the right, and a white bar along
// the bottom: a name, an option with a color dot, and a dark action button that can carry a price.
// Nothing is made up: words, price, detail, buttons and the bar only show when the owner types them.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css, the reel's pause button in public/sg-fx.js.
// The editor writes the block's body as lines (the owner never types this):
//   intro: A seasonal range inspired by ...
//   price: $139.00 | 4 payments of $34.75
//   detail: 100 cm | Sized to slip into a bag ...
//   link: Size guide | /site/x/faq           (up to 2)
//   bar: Metro | Matcha | $139.00            (name, option, price on the action button)
//   color: #8fae8b                           (the card's color; empty = worked out from the brand color)
// The block's heading is the title, its photo box the picture or reel, its button the bar's action.
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');
const { videoInfo } = require('./video');

const HEX = /^#[0-9a-f]{6}$/i;
const LINK = /^(https?:\/\/|\/|#|mailto:|tel:)[^\s"'<>]*$/i;
const MAX_LINKS = 2;
const LOOKS = [['center', 'Picture or reel in the middle (a cut-out photo looks best)'], ['fill', 'Picture or reel fills the whole card']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const mix = (a, b, w) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * w)); };

function parse(v) {
  const out = { intro: '', price: '', priceNote: '', detail: '', detailNote: '', links: [], bar: null, color: '' };
  String(v || '').split('\n').forEach(l => {
    const m = /^(intro|price|detail|link|bar|color):\s?(.*)$/.exec(l.trim());
    if (!m) return;
    const parts = m[2].split('|');
    if (m[1] === 'intro') out.intro = flat(m[2], 400);
    else if (m[1] === 'price') { out.price = flat(parts[0], 30); out.priceNote = flat(parts.slice(1).join(' '), 90); }
    else if (m[1] === 'detail') { out.detail = flat(parts[0], 40); out.detailNote = flat(parts.slice(1).join(' '), 240); }
    else if (m[1] === 'link') {
      const label = flat(parts[0], 30), url = String(parts[1] || '').trim();
      if (label && LINK.test(url) && url.length <= 500 && out.links.length < MAX_LINKS) out.links.push({ label, url });
    } else if (m[1] === 'bar') {
      const bar = { name: flat(parts[0], 40), option: flat(parts[1], 40), price: flat(parts[2], 30) };
      if (bar.name || bar.option || bar.price) out.bar = bar;
    } else if (m[1] === 'color' && HEX.test(m[2].trim())) out.color = m[2].trim().toLowerCase();
  });
  return out;
}
function cleanBody(v) {
  const p = parse(v);
  return [].concat(p.intro ? [`intro: ${p.intro}`] : [], p.price || p.priceNote ? [`price: ${p.price} | ${p.priceNote}`] : [],
    p.detail || p.detailNote ? [`detail: ${p.detail} | ${p.detailNote}`] : [], p.links.map(l => `link: ${l.label} | ${l.url}`),
    p.bar ? [`bar: ${p.bar.name} | ${p.bar.option} | ${p.bar.price}`] : [], p.color ? [`color: ${p.color}`] : []).join('\n');
}
const cleanSide = (v) => (LOOKS.some(l => l[0] === v) ? v : 'center');

// The picture or reel: an uploaded or linked video file plays as a silent loop; anything else is a picture
function media(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  const vi = videoInfo(u);
  if (vi && vi.kind === 'file') return { kind: 'video', src: vi.src };
  if (vi) return null;   // YouTube or Vimeo cannot play as a silent loop in the card
  return { kind: 'img', src: u };
}

// The card's colors: the owner's color, or a soft, slightly grey take on the brand color; the words go light or dark
function colors(own, theme) {
  const p = HEX.test(String((theme || {}).primaryColor || '')) ? theme.primaryColor.toLowerCase() : '#2563eb';
  const base = own || mix(mix(p, '#9aa39a', 0.45), '#ffffff', 0.25);
  const top = mix(base, '#ffffff', 0.16), bottom = mix(base, '#000000', 0.14);
  const worst = (fg) => Math.min(contrast.ratio(fg, top), contrast.ratio(fg, bottom));
  const ink = worst('#ffffff') >= 2.6 || worst('#ffffff') >= worst('#161616') ? '#ffffff' : '#161616';
  return { base, top, bottom, ink };
}

function view(site, blk, services) {
  const b = blk || {}, own = parse(b.body), look = cleanSide(b.side);
  let m = media(b.imageUrl);
  if (!m && !b.imageUrl) { const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title)); if (pics.length) m = { kind: 'img', src: pics[0] }; }
  const c = colors(own.color, (site || {}).theme);
  return {
    titleHtml: content.hlHtml(b.heading || ''),
    look: look === 'fill' && m ? 'fill' : 'center',
    media: m,
    intro: own.intro, price: own.price, priceNote: own.priceNote, detail: own.detail, detailNote: own.detailNote,
    links: own.links, bar: own.bar,
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null,
    style: `--hc-top: ${c.top}; --hc-bot: ${c.bottom}; --hc-ink: ${look === 'fill' && m ? '#ffffff' : c.ink}; --hc-dot: ${c.base}`
  };
}

module.exports = { parse, cleanBody, cleanSide, media, colors, view, LOOKS, MAX_LINKS };
