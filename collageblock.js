// "Word carousel collage" content block (Leo's video, 2026-10-28): the same moving layout as the library hero
// hero/collage (library/content.js collageOf; behavior in public/sg-lib.js, CSS in library/tailwind.css), with the
// owner's own words. Each line of the block is "Words | photo link": the words slide through the center card and the
// card wipes to that line's photo. Lines without a photo, and the scattered photos around the card, use the block's
// photos first and then the site's own (hero, services, About, gallery). With no lines it shows the service names.
const content = require('./library/content');

const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const MAX = 10;

// The block's body, cleaned: up to 10 lines of "words" or "words | photo link"
function cleanBody(v) {
  return String(v || '').split('\n').map(l => {
    const [w, u] = l.split('|').map(x => (x || '').trim());
    if (!w) return '';
    return PHOTO.test(u || '') ? `${w.slice(0, 60)} | ${u.slice(0, 500)}` : w.slice(0, 60);
  }).filter(Boolean).slice(0, MAX).join('\n');
}

// The site's own photos, each once, the hero photo first
function sitePhotos(site, services) {
  const s = (site && site.sections) || {}, out = [];
  const add = u => { if (u && PHOTO.test(u) && !out.includes(u)) out.push(u); };
  add((s.hero || {}).imageUrl);
  (services || []).forEach(x => add(x && x.imageUrl));
  add((s.about || {}).imageUrl);
  ((s.gallery || {}).images || []).forEach(add);
  return out.slice(0, 12);
}

// What the block shows; null without 3 words and 3 photos (the editor preview then shows a note)
function view(site, blk, services, basePath) {
  const b = blk || {}, svc = (services || []).filter(x => x && x.title);
  let words = cleanBody(b.body).split('\n').filter(Boolean).map(l => { const [t, u] = l.split(' | '); return { t, src: u || '', href: '' }; });
  if (!words.length) words = svc.slice(0, 8).map(x => ({ t: x.title, src: PHOTO.test(x.imageUrl || '') ? x.imageUrl : '', href: x.slug ? `${basePath || ''}/services/${x.slug}` : '' }));
  const photos = words.map(w => w.src).filter(Boolean).concat(sitePhotos(site, svc)).filter((u, i, a) => a.indexOf(u) === i);
  if (words.length < 3 || photos.length < 3) return null;
  words.forEach((w, i) => { if (!w.src) w.src = photos[i % photos.length]; });
  const tiles = []; for (let i = 0; i < 6; i++) tiles.push(photos[(i + 1) % photos.length]);
  const button = b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null;
  return { headingHtml: content.hlHtml(b.heading || ''), words, photos, tiles, button };
}

module.exports = { cleanBody, view, sitePhotos, MAX };
