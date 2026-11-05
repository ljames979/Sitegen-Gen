// Three content blocks from Leo's second effect video (2026-10-28), each with the owner's own words and photos (the
// block's own photo links first, then the site's photos: hero, services, About, gallery). Behavior in public/sg-fx.js,
// CSS in public/sg-site.css; with motion off each shows a finished, still layout.
//   trail     "Photo trail": photos pop out along the mouse's path across the section and fade (on touch screens a
//             trail runs across by itself); the heading and lines sit underneath.
//   wave      "Photo wave": photos stacked into a wave between two words ("Tracing ~ Art"), or spelling the owner's
//             own word (side); scrolling scatters them, then they settle around the block's words.
//   bigwords  "Big words with a photo": a huge headline, one row per line, whose words stretch into place, with a
//             photo set into the line where it says [photo].
// Four more from the GSAP-style menu (2026-10-28), also the owner's own words and photos:
//   story     "Scroll story": the block holds still while its steps play one after another as visitors scroll
//             (lines "Title | words"), each with its photo; a bar fills as the story goes.
//   path      "Path travel": the block's photos and short lines travel along a curve as visitors scroll.
//   zoomword  "Zoom through the word": a huge word (the heading) filled with a photo; scrolling zooms through its
//             letters into the photo, then the block's words come up.
//   morph     "Shape morph": a photo in a soft shape that changes from one shape to the next as visitors scroll, beside
//             the heading and words.
const brandWall = require('./brandwall');
const collageBlock = require('./collageblock');
const content = require('./library/content');

const TYPES = ['trail', 'wave', 'bigwords', 'story', 'path', 'zoomword', 'morph'];
const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()]+$/;
const uniq = (u, i, a) => a.indexOf(u) === i;

function photosOf(site, blk, services) {
  return brandWall.ownContent((blk || {}).body).photos.filter(u => PHOTO.test(u))
    .concat(collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title))).filter(uniq).slice(0, 16);
}
const linesOf = (blk) => brandWall.ownContent((blk || {}).body).lines;

function trail(site, blk, services) {
  const photos = photosOf(site, blk, services);
  if (photos.length < 3) return null;
  return { headingHtml: content.hlHtml((blk || {}).heading || ''), lines: linesOf(blk).slice(0, 3), photos };
}

// A word (or two) the photo cards spell before they scatter: letters, numbers, spaces and & only, short enough to read
const cleanShape = (v) => (/^auto$/i.test(String(v || '').trim()) ? '' : String(v == null ? '' : v)).replace(/[^\p{L}\p{N} &]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
// "Left ~ Right": the two words either side of the wave; the block's lines (else the hero's sub-headline) are the words
// the photos settle around. 24 photos make the wave, about 14 a letter spell a word (the site's photos repeat when it has fewer).
function wave(site, blk, services) {
  const photos = photosOf(site, blk, services);
  if (photos.length < 4) return null;
  const [l, r] = String((blk || {}).heading || '').split('~').map(x => x.trim());
  const lines = linesOf(blk);
  const text = lines.length ? lines.join(' ') : String((((site || {}).sections || {}).hero || {}).subheadline || '').trim();
  const shape = cleanShape((blk || {}).side);
  const pics = []; for (let i = 0, n = shape ? Math.min(150, 30 + shape.replace(/ /g, '').length * 14) : 24; i < n; i++) pics.push(photos[i % photos.length]);
  return { left: l || '', right: r || '', text: text.slice(0, 400), pics, shape };
}

// Rows of big words; [photo] marks where the photo sits (else before the last word of the last row). Without lines
// the heading is split into rows of two or three words.
function bigwords(site, blk, services) {
  const b = blk || {};
  let rows = String(b.body || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l && !/^(https?:\/\/|\/)\S+$/i.test(l)).slice(0, 4);
  const fromHeading = !rows.length;
  if (fromHeading) {
    const w = String(b.heading || '').replace(/[[\]]/g, '').split(/\s+/).filter(Boolean);
    if (!w.length) return null;
    const per = w.length <= 4 ? 2 : 3;
    for (let i = 0; i < w.length && rows.length < 4; i += per) rows.push(w.slice(i, i + per).join(' '));
  }
  const hero = (((site || {}).sections || {}).hero || {}).imageUrl;
  const photo = [b.imageUrl, photosOf(site, b, services)[0], hero].find(u => u && PHOTO.test(u)) || '';
  if (photo && !rows.some(r => r.includes('[photo]'))) {
    const last = rows[rows.length - 1].split(' ');
    last.splice(Math.max(0, last.length - 1), 0, '[photo]');
    rows[rows.length - 1] = last.join(' ');
  }
  let n = 0;
  const out = rows.map(r => r.split(' ').filter(Boolean).map(t => t === '[photo]' ? (photo ? { photo, i: n++ } : null) : { t: t.slice(0, 30), i: n++ }).filter(Boolean));
  const label = rows.join(' ').replace(/\[photo\]/g, '').replace(/\s+/g, ' ').trim();
  return { rows: out, label, caption: fromHeading ? '' : String(b.heading || '').replace(/[[\]]/g, '').trim(), button: b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null };
}

const plainHeading = (h) => String(h || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const ownPhotos = (blk) => String((blk || {}).body || '').split('\n').map(l => l.trim()).filter(l => PHOTO.test(l));
const ownLines = (blk, n, max) => String((blk || {}).body || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim())
  .filter(l => l && !/^(https?:\/\/|\/)\S+$/i.test(l)).map(l => l.slice(0, max)).slice(0, n);
const buttonOf = (b) => (b && b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null);

// Steps from "Title | words" lines (2 to 6); each step gets the next photo (the block's own first, then the site's)
function story(site, blk, services) {
  const steps = ownLines(blk, 6, 240).map(l => { const [t, ...rest] = l.split('|'); return { t: t.trim().slice(0, 80), d: rest.join('|').trim() }; }).filter(x => x.t);
  if (steps.length < 2) return null;
  const photos = photosOf(site, blk, services);
  return { headingHtml: content.hlHtml((blk || {}).heading || ''), steps: steps.map((x, i) => ({ ...x, photo: photos.length ? photos[i % photos.length] : '' })), button: buttonOf(blk) };
}

// Photos (3 to 10) and up to 5 short lines that ride along the curve between them
function path(site, blk, services) {
  const photos = photosOf(site, blk, services).slice(0, 10);
  if (photos.length < 3) return null;
  return { headingHtml: content.hlHtml((blk || {}).heading || ''), lines: ownLines(blk, 5, 60), photos, button: buttonOf(blk) };
}

// The heading is the word (24 letters at most reads at this size); the photo is the block's own, else the hero's
function zoomword(site, blk, services) {
  const b = blk || {}, word = plainHeading(b.heading).slice(0, 24);
  const photo = [b.imageUrl, ownPhotos(b)[0], (((site || {}).sections || {}).hero || {}).imageUrl, photosOf(site, b, services)[0]].find(u => u && PHOTO.test(u));
  if (!word || !photo) return null;
  return { word, photo, text: ownLines(b, 3, 300).join(' '), button: buttonOf(b) };
}

// A photo in a changing shape beside the heading and words; the photo is the block's own, else About's, else the site's
function morph(site, blk, services) {
  const b = blk || {}, s = (site || {}).sections || {};
  const photo = [b.imageUrl, ownPhotos(b)[0], (s.about || {}).imageUrl, photosOf(site, b, services)[0]].find(u => u && PHOTO.test(u));
  if (!photo || !(b.heading || ownLines(b, 1, 10).length)) return null;
  return { headingHtml: content.hlHtml(b.heading || ''), paras: ownLines(b, 4, 600), photo, button: buttonOf(b) };
}

module.exports = { TYPES, trail, wave, bigwords, story, path, zoomword, morph, photosOf, cleanShape };
