// Three blocks for app and marketing sites (Leo, 2026-11-17, built for LocalBite; our own layouts, no template code).
// They run on the About Us field engine (aboutblocks.js merges these SPECS), so the editor fields, saving, the picker
// and the checks are shared; every word, link, photo and color is the owner's and editable, and nothing is made up:
//   apphero    a page top: small label, the big heading (the page's one h1), a sentence or two, the block's own button
//              plus a second button, an offer pill and a small line, beside a photo on a soft color shape
//   spotcards  a grid of photo cards (a photo, a name, a small tag, a short line and an optional link), as many as needed
//   compare    a real comparison table: column titles, rows of "what | them | us", your column highlighted, small print
// Markup in views/_blocks.ejs (the SPECS branch), CSS in public/sg-site.css (.sg-ap-*).
const MAX_ITEMS = 12;

const SPECS = {
  apphero: {
    group: 'tops', name: 'App hero with two buttons',
    desc: 'A small label, a big heading, your words, two buttons and an offer pill beside a photo on a soft color shape',
    pic: 't 4 9 14; H 4 13 26; T 4 21 22; t 4 26 20; b 4 31 10; K 16 30 11 6; a 36 4 22 32; p 39 7 17 26',
    photoLabel: 'Photo (food, people or your app on a phone; empty = one of your site\'s photos)',
    sides: [['right', 'Photo on the right'], ['left', 'Photo on the left']],
    hint: 'Type the big heading above; words in [square brackets] show in your button color. Put this block first on the page: its heading is the page\'s main title. The block\'s own button (below) is the main button; the second button is here. On phones the photo goes under the words.',
    fields: [
      { k: 'label', kind: 'line', max: 70, ph: 'Small line over the heading (optional), e.g. Kissimmee · Osceola County' },
      { k: 'text', kind: 'paras', max: 2, ph: 'A sentence or two under the heading' },
      { k: 'second', kind: 'rows', max: 1, label: 'Second button', cols: [{ k: 'words', max: 40, ph: 'Second button words, e.g. List your restaurant' }, { k: 'link', link: true, ph: 'Its link, e.g. /services or https://...' }] },
      { k: 'offer', kind: 'line', max: 90, ph: 'Offer pill under the buttons (optional), e.g. $5 off your first order' },
      { k: 'note', kind: 'line', max: 140, ph: 'Small line at the bottom (optional)' },
      { k: 'pic', kind: 'toggle', label: 'Show the photo (untick for a short page top with the words centered)' },
      { k: 'color', kind: 'color', def: '#e4572e', label: 'Own color for the main button and the [highlighted] words (unticked = tomato red)' },
      { k: 'accent', kind: 'color', def: '#2f9e5b', label: 'Own color for the shape behind the photo and the second button (unticked = fresh green)' },
      { k: 'bg', kind: 'color', def: '#fff8ec', label: 'Own background color for the block (unticked = warm cream)' }
    ]
  },
  spotcards: {
    group: 'words', name: 'Photo cards grid',
    desc: 'A grid of cards, each a photo, a name, a small tag, a short line and an optional link: places, products or people',
    pic: 'T 4 4 22; k 3 11 17 26; p 4 12 15 11; T 5 25 10; t 5 30 12; k 22 11 17 26; p 23 12 15 11; T 24 25 10; t 24 30 12; k 41 11 17 26; p 42 12 15 11; T 43 25 10; t 43 30 12',
    hint: 'Type a heading above (optional). Add as many cards as you need: three in a row on computers, two on tablets, one under another on phones. A card\'s link is optional; with a link the whole card can be tapped.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Featured local spots' },
      { k: 'text', kind: 'paras', max: 1, ph: 'A sentence under the heading (optional)' },
      { k: 'item', kind: 'rows', grow: true, max: MAX_ITEMS, label: 'Card', cols: [{ k: 'photo', photo: true, ph: 'Photo: https://... or upload' }, { k: 'title', max: 60, ph: 'Name, e.g. Taco truck' }, { k: 'tag', max: 40, ph: 'Small tag, e.g. Tacos · Food truck' }, { k: 'words', max: 240, ph: 'A short line' }, { k: 'link', link: true, ph: 'Link (optional), e.g. https://...' }] },
      { k: 'more', kind: 'line', max: 30, ph: 'Words on the card links (empty = Order)' },
      { k: 'color', kind: 'color', def: '#2f9e5b', label: 'Own color for the tags and links (unticked = fresh green)' },
      { k: 'card', kind: 'color', def: '#ffffff', label: 'Own color for the cards (unticked = white)' },
      { k: 'bg', kind: 'color', def: '#fff8ec', label: 'Own background color for the block (unticked = warm cream)' }
    ]
  },
  compare: {
    group: 'words', name: 'Comparison table',
    desc: 'A side-by-side table: column titles, rows of what you compare, your own column highlighted, small print under it',
    pic: 'T 4 4 24; k 4 10 52 26; t 7 13 10; t 24 13 10; n 40 11 15 24; W 42 13 10; t 7 19 12; t 24 19 10; W 42 19 10; t 7 25 12; t 24 25 10; W 42 25 10; t 7 31 12; t 24 31 10; W 42 31 10',
    hint: 'Type a heading above (optional). The last column is yours and gets your color. On phones the table keeps its three columns with smaller words. Only compare what you know to be true, and say where a number comes from in the small print.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. Compare' },
      { k: 'text', kind: 'paras', max: 1, ph: 'A sentence under the heading (optional)' },
      { k: 'cols', kind: 'rows', max: 1, label: 'Column titles', cols: [{ k: 'what', max: 40, ph: 'First column, e.g. What you pay' }, { k: 'them', max: 60, ph: 'Second column, e.g. Big delivery apps' }, { k: 'us', max: 60, ph: 'Your column, e.g. Us' }] },
      { k: 'row', kind: 'rows', grow: true, max: MAX_ITEMS, label: 'Row', cols: [{ k: 'what', max: 80, ph: 'What you compare, e.g. Fee per order' }, { k: 'them', max: 140, ph: 'Theirs' }, { k: 'us', max: 140, ph: 'Yours' }] },
      { k: 'note', kind: 'line', max: 240, ph: 'Small print under the table (optional)' },
      { k: 'color', kind: 'color', def: '#2f9e5b', label: 'Own color for your column (unticked = fresh green)' },
      { k: 'card', kind: 'color', def: '#ffffff', label: 'Own color for the table (unticked = white)' },
      { k: 'bg', kind: 'color', def: '#fff8ec', label: 'Own background color for the block (unticked = warm cream)' }
    ]
  }
};
Object.values(SPECS).forEach(s => { s.sides = s.sides || [['center', 'Centered']]; });

module.exports = { SPECS, MAX_ITEMS };
