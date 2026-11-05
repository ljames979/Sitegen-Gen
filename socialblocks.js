// Social media content blocks (Leo, 2026-11-03: the Nicepage social gallery, "lets pull a few of these for a social media
// block"). Seven of our own follow-us layouts, drawn here from scratch: no code, photos, icons or wording from any
// template. They run on the same field engine as the About Us blocks (aboutblocks.js merges these SPECS), so the editor
// fields, saving and checks are shared; each block adds only its markup (views/_blocks.ejs) and CSS (.sg-so-*).
// Links: each block can have its own link for every network below; an empty one falls back to the links saved in the
// Contact section (Facebook, Instagram, X/Twitter). A network with no link is simply not shown. Follower numbers are
// only what the owner types: nothing is made up.

// [key, name, example link, simple line icon of our own (24x24, drawn with currentColor)]
const NETWORKS = [
  ['facebook', 'Facebook', 'https://facebook.com/yourbusiness', '<path d="M15 3h-3a5 5 0 0 0-5 5v3H4v4h3v8h4v-8h3l1-4h-4V8a1 1 0 0 1 1-1h3z" fill="currentColor" stroke="none"/>'],
  ['instagram', 'Instagram', 'https://instagram.com/yourbusiness', '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none"/>'],
  ['x', 'X (Twitter)', 'https://x.com/yourbusiness', '<path d="M4 4l16 16M20 4L4 20"/>'],
  ['tiktok', 'TikTok', 'https://tiktok.com/@yourbusiness', '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>'],
  ['youtube', 'YouTube', 'https://youtube.com/@yourbusiness', '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/company/yourbusiness', '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.3v.2M12 17v-6.5M12 13.2c0-1.6 1-2.7 2.4-2.7S16.5 11.4 16.5 13v4"/>'],
  ['pinterest', 'Pinterest', 'https://pinterest.com/yourbusiness', '<circle cx="12" cy="12" r="9"/><path d="M11 8.5h2.2a2.6 2.6 0 0 1 0 5.2H11M11 8.5V20"/>'],
  ['whatsapp', 'WhatsApp', 'https://wa.me/14075550100', '<path d="M4.5 19.5l1.2-3.7A8 8 0 1 1 9 19z"/><path d="M9.3 8.8c.2 2.6 3 5.6 5.9 5.9l1-1.3-1.8-1-.9.8c-1-.5-1.8-1.3-2.3-2.3l.8-.9-1-1.8z" fill="currentColor" stroke="none"/>']
];
const NET = Object.fromEntries(NETWORKS.map(n => [n[0], { k: n[0], name: n[1], icon: n[3] }]));
const ICON = (k) => `<svg class="sg-so-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${(NET[k] || {}).icon || ''}</svg>`;

const LINKS = [{ kind: 'hint', text: 'Links (leave a box empty to use the link from your Contact section, or to leave that network out)' }]
  .concat(NETWORKS.map(n => ({ k: n[0], kind: 'url', ph: `${n[1]} link, e.g. ${n[2]}` })));
const BG = (def, what) => ({ k: 'bg', kind: 'color', def, label: `Own background color for the block (unticked = ${what})` });

const SPECS = {
  socialshapes: {
    group: 'social', name: 'Follow card on shapes',
    desc: 'A white "Follow us" card with round icons, over a bright band of colored shapes',
    pic: 'n 0 0 60 40; o 8 8 9; o 52 34 10; k 14 9 32 22; T 22 13 16; t 20 18 20; O 22 25 f; O 30 25 i; O 38 25 x',
    hint: 'Type the heading above (e.g. Follow us). The card sits in the middle of the shapes; on phones the shapes get smaller.',
    fields: [
      { k: 'text', kind: 'paras', max: 2, ph: 'A line on why to follow, e.g. New looks and happy pets every week.' },
      { k: 'color', kind: 'color', def: '#6c3ce0', label: 'Own color for the band (unticked = violet)' },
      { k: 'accent', kind: 'color', def: '#ff4d8d', label: 'Own color for the shapes and the icons (unticked = pink)' },
      { k: 'shapes', kind: 'toggle', label: 'Show the colored shapes on the band' }
    ].concat(LINKS)
  },
  socialphoto: {
    group: 'social', name: 'Photo and follow',
    desc: 'A photo on one side, a heading, a few words and a row of round icons on the other',
    pic: 'p 4 5 24 30; t 34 9 10; T 34 13 20; t 34 19 18; t 34 22 16; O 36 30 f; O 44 30 i; O 52 30 y',
    photoLabel: 'Photo (empty = your About photo)',
    sides: [['left', 'Photo on the left, words on the right'], ['right', 'Photo on the right, words on the left']],
    hint: 'Type the heading above (e.g. Join us on social). On phones the words go under the photo.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Stay in touch' },
      { k: 'text', kind: 'paras', max: 2, ph: 'A few words about what you share.' },
      { k: 'color', kind: 'color', def: '#1c8c7c', label: 'Own color for the icons and the label (unticked = teal)' },
      BG('#ffffff', 'the page color')
    ].concat(LINKS)
  },
  socialcounts: {
    group: 'social', name: 'Follower counts',
    desc: 'Up to 4 networks, each a big round icon with the follower number you type and a short line',
    pic: 'T 18 4 24; O 12 20 f; O 26 20 i; O 40 20 y; O 52 20 t; t 7 28 10; t 21 28 10; t 35 28 10; t 47 28 10',
    hint: 'Type the heading above (e.g. Join our community). Each circle links to that network\'s link. Only the numbers you type are shown.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional)' },
      { k: 'text', kind: 'paras', max: 1, ph: 'A line under the heading (optional)' },
      { k: 'count', kind: 'rows', max: 4, label: 'Network', cols: [{ k: 'net', choice: NETWORKS.map(n => [n[0], n[1]]) }, { k: 'number', max: 20, ph: 'Number, e.g. 12k' }, { k: 'words', max: 40, ph: 'Short line, e.g. followers' }] },
      { k: 'color', kind: 'color', def: '#e63946', label: 'Own color for the circles (unticked = red)' },
      BG('#ffffff', 'the page color')
    ].concat(LINKS)
  },
  socialonphoto: {
    group: 'social', name: 'Follow card on a photo',
    desc: 'A wide photo across the block with a small dark card of follow icons on one side',
    pic: 'p 0 0 60 40; n 36 10 18 18; W 39 14 10; W 39 18 12; wb 39 22 10 3',
    photoLabel: 'Wide photo across the block (empty = your About photo)',
    sides: [['right', 'Card on the right'], ['left', 'Card on the left']],
    hint: 'Type the heading above (e.g. Follow us). The card\'s words turn white or dark to stay easy to read on your color.',
    fields: [
      { k: 'text', kind: 'paras', max: 1, ph: 'A short line (optional)' },
      { k: 'color', kind: 'color', def: '#1f2937', label: 'Own color for the card (unticked = charcoal)' }
    ].concat(LINKS)
  },
  socialfeed: {
    group: 'social', name: 'Photo feed grid',
    desc: 'Up to 8 square photos like a social feed, with your @name, a line and a follow button',
    pic: 'T 4 4 18; t 4 9 14; b 44 4 12 5; p 4 15 12 10; p 17 15 12 10; p 30 15 12 10; p 43 15 12 10; p 4 27 12 10; p 17 27 12 10; p 30 27 12 10; p 43 27 12 10',
    hint: 'Type the heading above (e.g. On our feed). Empty photo boxes use your site\'s photos. Without Button boxes, a Follow button goes to your Instagram link.',
    fields: [
      { k: 'handle', kind: 'line', max: 40, ph: 'Your name on the network, e.g. @pawsplace' },
      { k: 'text', kind: 'paras', max: 1, ph: 'A short line (optional)' },
      { k: 'photo', kind: 'rows', max: 8, fill: 8, label: 'Feed photo', cols: [{ k: 'photo', photo: true, ph: 'Photo: https://... or upload (empty = one of your site\'s photos)' }] },
      { k: 'color', kind: 'color', def: '#d6336c', label: 'Own color for the button and the @name (unticked = rose)' },
      BG('#ffffff', 'the page color')
    ].concat(LINKS)
  },
  socialprofile: {
    group: 'social', name: 'Profile card',
    desc: 'A centered card with a round photo, your name as the heading, a short line and the follow icons',
    pic: 'k 16 2 28 36; o 30 11 6; T 22 20 16; t 21 25 18; O 24 32 f; O 30 32 i; O 36 32 x',
    photoLabel: 'Round photo (a face or your logo; empty = your About photo)',
    hint: 'Type your name as the heading above. On phones the card fills the width.',
    fields: [
      { k: 'role', kind: 'line', max: 80, ph: 'Short line under the name, e.g. Owner and groomer' },
      { k: 'text', kind: 'paras', max: 2, ph: 'A sentence or two about you (optional)' },
      { k: 'color', kind: 'color', def: '#2563eb', label: 'Own color for the ring around the photo and the icons (unticked = blue)' },
      BG('#f1f5f9', 'pale grey')
    ].concat(LINKS)
  },
  socialstrip: {
    group: 'social', name: 'Follow strip',
    desc: 'A slim colored bar with a short "Follow us" line and the icons in one row',
    pic: 'n 0 13 60 14; W 5 19 18; O 36 20 f; O 44 20 i; O 52 20 t',
    hint: 'Type a few words as the heading above (e.g. Follow us for daily updates). On phones the icons go under the words.',
    fields: [
      { k: 'color', kind: 'color', def: '#111827', label: 'Own color for the bar (unticked = near black)' }
    ].concat(LINKS)
  }
};
Object.values(SPECS).forEach(s => { s.sides = s.sides || [['center', 'Centered']]; });

// the block's own links, then the Contact section's; networks with no link are left out
function links(site, own) {
  const c = ((site && site.sections && site.sections.contact) || {}).social || {};
  const from = { facebook: c.facebook, instagram: c.instagram, x: c.twitter };
  return NETWORKS.map(n => ({ k: n[0], name: n[1], url: own[n[0]] || from[n[0]] || '', icon: ICON(n[0]) })).filter(l => l.url);
}

module.exports = { SPECS, NETWORKS, NET, ICON, links };
