// "Photo picks the words" content block (Leo's link to a dog-training template, 2026-11-03: "up to 4 photos, each
// photo brings up a different writing in the box at the front, option to change the color on each card"; our own
// drawing of the idea, no code, photos or wording from it). A big photo sits on a colored block that peeks out
// behind it; a bordered card in front of the photo's corner holds that photo's words and the button. Under the photo
// a row of small photos picks which one shows: the big photo, the card's words and the color (card border, button,
// the block behind the photo) all change together. With one card there is no row. Without script the first card
// shows. Nothing is made up: the words and photos are the owner's.
// Markup in views/_blocks.ejs, CSS in public/sg-site.css, the switching in public/sg-fx.js ([data-sg-pt]).
// The editor writes the block's body as lines (the owner never types this):
//   card: /uploads/a.jpg | #1d6fa5 | Puppy classes | A sentence or two     (up to 4; photo and color may be empty)
// side: the big photo's side: left | right
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_CARDS = 4;
const SIDES = [['left', 'Big photo on the left, card on the right'], ['right', 'Big photo on the right, card on the left']];
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

function parse(v) {
  const cards = [];
  String(v || '').split('\n').forEach(l => {
    const m = /^card:\s?(.*)$/.exec(l.trim());
    if (!m || cards.length >= MAX_CARDS) return;
    const p = m[1].split('|');
    const photo = (p[0] || '').trim(), color = (p[1] || '').trim();
    const c = { photo: PHOTO.test(photo) && photo.length <= 500 ? photo : '', color: HEX.test(color) ? color.toLowerCase() : '', title: flat(p[2], 80), text: flat(p.slice(3).join(' '), 600) };
    if (c.photo || c.title || c.text) cards.push(c);
  });
  return { cards };
}
function cleanBody(v) {
  return parse(v).cards.map(c => `card: ${c.photo} | ${c.color} | ${c.title} | ${c.text}`).join('\n');
}
const cleanSide = (v) => (SIDES.some(s => s[0] === v) ? v : 'left');
// readable text on a color: white or near-black, whichever reads better
const onColor = (hex) => contrast.textOn(hex);

function view(site, blk, services) {
  const b = blk || {}, t = (site && site.theme) || {};
  const brand = HEX.test(String(t.primaryColor || '')) ? t.primaryColor.toLowerCase() : '#1d6fa5';
  let cards = parse(b.body).cards;
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  if (!cards.length) cards = [{ photo: '', color: '', title: '', text: '' }];
  cards = cards.map((c, i) => {
    const color = c.color || brand;
    return { ...c, photo: c.photo || pics[i] || pics[0] || '', color, on: onColor(color), titleHtml: content.hlHtml(c.title || (i === 0 ? b.heading || '' : '')) };
  });
  return {
    headingHtml: content.hlHtml(b.heading || ''),
    cards, tabs: cards.length > 1,
    side: cleanSide(b.side),
    button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null
  };
}

module.exports = { parse, cleanBody, cleanSide, view, onColor, SIDES, MAX_CARDS };
