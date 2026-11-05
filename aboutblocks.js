// About Us content blocks (Leo, 2026-11-03: "lets do it by section so its organized" and the Nicepage About Us gallery:
// "lets focus on the distinct ones"). Seven of our own About Us layouts, drawn here from scratch: no code, photos or
// wording from any template. They share one way of storing and editing their parts, so each block only adds its
// markup (views/_blocks.ejs) and CSS (public/sg-site.css); the editor fields, the saving and the checks come from
// SPECS below. Every photo slot has the ✂ Cut out button; a cut-out photo stands on a soft square of the block's color.
// Nothing is made up: empty words stay empty and empty photos use the site's own photos.
//
// The editor writes the block's body as lines (the owner never types this), one per field, for example:
//   label: About us                  (a one-line field)
//   text: A sentence or two          (paragraphs: one line each)
//   item: /uploads/a.jpg | Title | Words   (rows: the parts split by |)
//   color: #a9c4e2                   (colors: empty = the field's own default)
//   shapes: off                      (switches: written only when turned off)
// The main photo is the block's own photo (block_image); side is the block's side setting.
const content = require('./library/content');
const contrast = require('./contrast');
const collageBlock = require('./collageblock');
const socialBlocks = require('./socialblocks');
const petListBlocks = require('./petlistblocks');

const HEX = /^#[0-9a-f]{6}$/i;
const PHOTO = /^(https:\/\/|\/uploads\/)[^\s"'<>()|]+$/;
const CUT = /\/cut-[^/]*$/;
const flat = (v, n) => String(v || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (HEX.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');
const photoOk = (v) => { const p = String(v || '').trim(); return PHOTO.test(p) && p.length <= 500 ? p : ''; };
const URL_OK = (v) => { const u = String(v || '').trim(); return /^https:\/\/[^\s"'<>|]+$/.test(u) && u.length <= 300 ? u : ''; };
const LR = (a, b) => [['left', a], ['right', b]];

// field kinds: line (k, max, ph), url (k, ph: an https link), paras (k, max count, ph), rows (k, max, fill?, grow? = the owner adds and removes rows, cols
// [{k, photo | link | choice [[value, label]] | max, ph}]), color (k, def, label), toggle (k, label; on unless "off"),
// hint (text only, nothing stored). The Social media blocks (socialblocks.js) are merged in below.
const SPECS = {
  aboutstory: {
    name: 'Our story circle',
    desc: 'A big round photo with a white story card over its corner: small label, heading, your words and a button',
    pic: 'o 22 20 17; k 30 18 26 18; t 33 21 8; T 33 25 18; t 33 29 16; b 33 33 8 3; o 7 7 3',
    photoLabel: 'Photo (shown in a big circle; empty = your About photo)',
    sides: LR('Card at the lower right of the photo', 'Card at the lower left of the photo'),
    hint: 'The photo is cut into a big circle with a soft ring of your color around it, and the white card overlaps its lower corner. On phones the card goes under the photo.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Our story' },
      { k: 'text', kind: 'paras', max: 3, ph: 'How you started and what you care about.' },
      { k: 'note', kind: 'line', max: 140, ph: 'Small line under the words (optional), e.g. Since 2012' },
      { k: 'color', kind: 'color', def: '#e8a87c', label: 'Own color for the ring, the dots and the line on the card (unticked = warm peach)' },
      { k: 'bg', kind: 'color', def: '#fbf6f1', label: 'Own background color for the block (unticked = soft cream)' },
      { k: 'shapes', kind: 'toggle', label: 'Show the ring and the dots around the photo' }
    ]
  },
  aboutme: {
    name: 'Who am I',
    desc: 'A centered heading, a portrait on a color panel with a short line under it, and up to 4 small tiles about what you do',
    pic: 'T 20 3 20; n 4 9 20 28; p 8 12 12 14; W 7 30 14; K 28 10 13 12; K 44 10 13 12; K 28 25 13 12; K 44 25 13 12',
    photoLabel: 'Portrait (a person with the background cut out looks best; empty = your About photo)',
    sides: LR('Portrait on the left, tiles on the right', 'Portrait on the right, tiles on the left'),
    hint: 'Type the heading above (e.g. Who am I?). Each tile gets a number in your accent color. On phones the tiles go under the portrait.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Get to know me' },
      { k: 'caption', kind: 'line', max: 200, ph: 'Short line on the panel under the portrait, e.g. Helping pets feel at home for 10 years' },
      { k: 'item', kind: 'rows', max: 4, label: 'Tile', cols: [{ k: 'title', max: 60, ph: 'Tile title, e.g. Grooming' }, { k: 'words', max: 240, ph: 'A short line' }] },
      { k: 'color', kind: 'color', def: '#3d6fd8', label: 'Own color for the portrait panel (unticked = calm blue)' },
      { k: 'accent', kind: 'color', def: '#f2b84b', label: 'Own color for the tile numbers (unticked = sunny yellow)' },
      { k: 'bg', kind: 'color', def: '#ffffff', label: 'Own background color for the block (unticked = the page color)' }
    ]
  },
  aboutbig: {
    name: 'Big words over a photo',
    desc: 'Very big colored heading running over the edge of a tall photo, with your words and a button under it',
    pic: 'p 30 3 26 34; T 4 10 34; T 4 15 30; t 4 24 20; t 4 27 18; b 4 32 9 3',
    photoLabel: 'Photo (tall photos look best; empty = your About photo)',
    sides: LR('Photo on the right, the heading runs over its left edge', 'Photo on the left, the heading runs over its right edge'),
    hint: 'Type the heading above, short and big, e.g. About the [team]: the heading is in your color and words in [brackets] are dark. On phones the heading sits over the top of the photo.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Since 2015' },
      { k: 'text', kind: 'paras', max: 3, ph: 'A few words about you.' },
      { k: 'note', kind: 'line', max: 140, ph: 'Small line under the words (optional)' },
      { k: 'color', kind: 'color', def: '#e8772e', label: 'Own color for the big heading and the button (unticked = warm orange)' },
      { k: 'bg', kind: 'color', def: '#ffffff', label: 'Own background color for the block (unticked = the page color)' }
    ]
  },
  aboutfacts: {
    name: 'Facts in a soft shape',
    desc: 'A photo in a rounded soft shape on a blob of color, with your words and a short list of facts with check marks',
    pic: 'a 4 6 26 30; p 8 8 20 24; T 34 8 20; t 34 13 18; t 34 19 16; t 34 23 16; t 34 27 16; t 34 31 16',
    photoLabel: 'Photo (shown in a rounded soft shape; empty = your About photo)',
    sides: LR('Photo on the left, facts on the right', 'Photo on the right, facts on the left'),
    hint: 'Type the heading above (e.g. Facts about us). Each fact gets a check mark in your color. On phones the facts go under the photo.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional)' },
      { k: 'text', kind: 'paras', max: 2, ph: 'A sentence or two before the facts.' },
      { k: 'fact', kind: 'paras', max: 6, ph: 'One fact per line, e.g. Family owned since 2009', label: 'Facts (one per line, up to 6)' },
      { k: 'color', kind: 'color', def: '#5bb5a2', label: 'Own color for the soft shape and the check marks (unticked = sea green)' },
      { k: 'bg', kind: 'color', def: '#ffffff', label: 'Own background color for the block (unticked = the page color)' },
      { k: 'shapes', kind: 'toggle', label: 'Show the blob of color behind the photo' }
    ]
  },
  aboutcollage: {
    name: 'Photo collage',
    desc: 'Three photos (two round, one square) on a bar of color, with a label, heading, your words and a button beside them',
    pic: 'n 2 26 30 6; p 12 6 16 18; o 8 10 6; o 28 28 6; t 36 9 10; T 36 13 20; t 36 19 18; t 36 22 16; b 36 28 9 3',
    photoLabel: 'Main photo, the square one (empty = your About photo)',
    sides: LR('Photos on the left, words on the right', 'Photos on the right, words on the left'),
    hint: 'Type the heading above. The two round photos are below; empty ones use your site\'s photos. On phones the words go under the photos.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. About us' },
      { k: 'text', kind: 'paras', max: 3, ph: 'A few words about your business.' },
      { k: 'round', kind: 'rows', max: 2, label: 'Round photo', cols: [{ k: 'photo', photo: true, ph: 'Round photo: https://... or upload (empty = one of your site\'s photos)' }] },
      { k: 'color', kind: 'color', def: '#f2a516', label: 'Own color for the bar and the button (unticked = amber)' },
      { k: 'bg', kind: 'color', def: '#ffffff', label: 'Own background color for the block (unticked = the page color)' }
    ]
  },
  aboutnote: {
    name: "Owner's note",
    desc: 'A tall photo beside a short note from the owner: a big quote mark, your words, a small round portrait, name and role',
    pic: 'p 4 4 22 32; T 32 6 4; t 32 12 22; t 32 15 22; t 32 18 18; o 35 28 3; t 41 27 10; t 41 30 8',
    photoLabel: 'Tall photo (your place, your work or your team; empty = your About photo)',
    sides: LR('Photo on the left, note on the right', 'Photo on the right, note on the left'),
    hint: 'Type the heading above (optional, e.g. A note from the owner). On phones the note goes under the photo.',
    fields: [
      { k: 'text', kind: 'paras', max: 3, ph: 'Your note, in your own words.' },
      { k: 'portrait', kind: 'rows', max: 1, label: 'Small round portrait', cols: [{ k: 'photo', photo: true, ph: 'Portrait: https://... or upload (optional)' }] },
      { k: 'name', kind: 'line', max: 80, ph: 'Name, e.g. Maria Lopez' },
      { k: 'role', kind: 'line', max: 80, ph: 'Role, e.g. Owner and head groomer' },
      { k: 'color', kind: 'color', def: '#7a5cc4', label: 'Own color for the quote mark, the line and the frame (unticked = soft violet)' },
      { k: 'bg', kind: 'color', def: '#f6f4fb', label: 'Own background color for the block (unticked = pale lilac)' },
      { k: 'shapes', kind: 'toggle', label: 'Show the color frame offset behind the photo' }
    ]
  },
  aboutpanel: {
    name: 'Words on a full photo',
    desc: 'A wide photo across the block with a solid panel of your words on one side: label, heading, words and a button',
    pic: 'p 0 0 60 40; n 34 6 22 28; W 37 10 10; W 37 15 16; W 37 21 14; W 37 24 12; wb 37 29 8 3',
    photoLabel: 'Wide photo across the block (empty = your About photo)',
    sides: [['right', 'Panel on the right'], ['left', 'Panel on the left']],
    hint: 'Type the heading above. The panel\'s words turn white or dark to stay easy to read on your color. On phones the panel sits under the photo.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. About us' },
      { k: 'text', kind: 'paras', max: 3, ph: 'A few words about you.' },
      { k: 'note', kind: 'line', max: 140, ph: 'Small line under the words (optional)' },
      { k: 'color', kind: 'color', def: '#1f3b4d', label: 'Own color for the panel (unticked = deep teal blue)' }
    ]
  }
};
const ABOUT_TYPES = Object.keys(SPECS);
ABOUT_TYPES.forEach(t => { SPECS[t].group = 'about'; });
Object.assign(SPECS, socialBlocks.SPECS, petListBlocks.SPECS);
const TYPES = Object.keys(SPECS);
const GROUP_NAMES = { about: 'About us', social: 'Social media', words: 'Words and lists' };
const LINK_OK = (v) => { const u = String(v || '').trim(); return (/^https:\/\/[^\s"'<>|]+$/.test(u) || /^\/[^\s"'<>|]*$/.test(u) || /^#[\w-]*$/.test(u)) && u.length <= 300 ? u : ''; };

function parse(type, v) {
  const spec = SPECS[type], out = {};
  if (!spec) return out;
  spec.fields.forEach(f => { if (f.kind === 'hint') return; out[f.k] = f.kind === 'paras' || f.kind === 'rows' ? [] : f.kind === 'toggle' ? true : ''; });
  const byK = Object.fromEntries(spec.fields.filter(f => f.k).map(f => [f.k, f]));
  String(v || '').split('\n').forEach(l => {
    const m = /^([a-z]+):\s?(.*)$/.exec(l.trim());
    const f = m && byK[m[1]];
    if (!f) return;
    if (f.kind === 'line') out[f.k] = flat(m[2], f.max);
    else if (f.kind === 'url') out[f.k] = URL_OK(m[2]);
    else if (f.kind === 'color') out[f.k] = hex(m[2]);
    else if (f.kind === 'toggle') out[f.k] = m[2].trim() !== 'off';
    else if (f.kind === 'paras') { const t = flat(m[2], 700); if (t && out[f.k].length < f.max) out[f.k].push(t); }
    else if (out[f.k].length < f.max) {
      const parts = m[2].split('|'), r = {};
      f.cols.forEach((c, i) => { r[c.k] = c.photo ? photoOk(parts[i]) : c.link ? LINK_OK(parts[i]) : c.choice ? (c.choice.some(o => o[0] === String(parts[i] || '').trim()) ? String(parts[i]).trim() : '') : flat(i === f.cols.length - 1 ? parts.slice(i).join(' ') : parts[i], c.max); });
      if (f.cols.some(c => r[c.k])) out[f.k].push(r);
    }
  });
  return out;
}
function cleanBody(type, v) {
  const spec = SPECS[type];
  if (!spec) return '';
  const p = parse(type, v), l = [];
  spec.fields.forEach(f => {
    if (f.kind === 'hint') return;
    if (f.kind === 'line' || f.kind === 'url' || f.kind === 'color') { if (p[f.k]) l.push(`${f.k}: ${p[f.k]}`); }
    else if (f.kind === 'toggle') { if (!p[f.k]) l.push(`${f.k}: off`); }
    else if (f.kind === 'paras') p[f.k].forEach(t => l.push(`${f.k}: ${t}`));
    else p[f.k].forEach(r => l.push(`${f.k}: ${f.cols.map(c => r[c.k]).join(' | ')}`));
  });
  return l.join('\n');
}
function cleanSide(type, v) {
  const sides = (SPECS[type] || {}).sides || [['left']];
  return sides.some(s => s[0] === v) ? v : sides[0][0];
}

// everything the markup needs: the owner's parts, colors with their readable text colors, photos with site fallbacks
function view(type, site, blk, services) {
  const spec = SPECS[type] || { fields: [] }, b = blk || {}, own = parse(type, b.body), s = (site && site.sections) || {};
  const pics = collageBlock.sitePhotos(site, (services || []).filter(x => x && x.title));
  const about = (s.about || {}).imageUrl;
  const first = spec.photoLabel ? b.imageUrl || (about && pics.includes(about) ? about : pics[0] || '') : '';
  const spare = pics.filter(p => p !== first);
  let n = 0;
  const pic = (u) => { const photo = u || spare[n++] || first || ''; return { photo, cut: CUT.test(photo) }; };
  const out = { ...own, headingHtml: content.hlHtml(b.heading || ''), side: cleanSide(type, b.side), main: { photo: first, cut: CUT.test(first) } };
  const vars = [];
  spec.fields.forEach(f => {
    if (f.kind === 'color') {
      const c = own[f.k] || f.def;
      out[f.k] = c;
      if (f.k === 'bg') { if (own.bg) vars.push(`--ab-bg: ${c}`, `--edge: ${c}`); out.ownBg = !!own.bg; return; }
      vars.push(`--ab-${f.k}: ${c}`, `--ab-${f.k}-on: ${contrast.textOn(c)}`, `--ab-${f.k}-ink: ${contrast.ensureContrast(c, '#ffffff', 3)}`);
    }
    if (f.kind === 'rows' && f.cols.some(c => c.photo)) {
      const want = f.fill || (f.cols.length === 1 ? f.max : own[f.k].length);
      const rows = own[f.k].slice();
      if (f.k !== 'portrait') while (rows.length < want) rows.push({ photo: '' });
      out[f.k] = rows.map(r => ({ ...r, ...(f.k === 'portrait' ? { photo: r.photo, cut: CUT.test(r.photo) } : pic(r.photo)) })).filter(r => r.photo);
    }
  });
  if (spec.group === 'social') {
    out.links = socialBlocks.links(site, own);
    if (out.count) out.count = out.count.filter(r => r.net).map(r => { const l = out.links.find(x => x.k === r.net); return { ...r, name: socialBlocks.NET[r.net].name, icon: socialBlocks.ICON(r.net), url: l ? l.url : '' }; });
  }
  out.style = vars.join('; ') + (vars.length ? ';' : '');
  out.button = b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : null;
  return out;
}

module.exports = { SPECS, TYPES, ABOUT_TYPES, GROUP_NAMES, parse, cleanBody, cleanSide, view };
