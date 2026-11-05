// Two list blocks from Leo's dog links (2026-11-04: "lets create a block for both of these ... the option to add as many
// bulletins as needed ... change out background colors ... and cut photo"). Our own drawings of the two layouts: no
// code, photos or wording from the templates. They run on the About Us field engine (aboutblocks.js merges these SPECS),
// so the editor fields, saving and checks are shared. Their lists grow: the owner adds as many items as needed with
// "+ Add" (up to MAX_ITEMS) and removes any with "Remove". Every photo box has ✂ Cut out; a cut-out photo stands on its
// own backing color. Nothing is made up: items the owner leaves empty are not shown.
const MAX_ITEMS = 12;

const SPECS = {
  numcards: {
    group: 'words', name: 'Numbered cards beside a photo',
    desc: 'A light card of numbered items (big colored numbers, small titles, a few words) next to a photo panel, on a two-tone band',
    pic: 'a 0 0 22 40; n 22 0 38 40; k 6 6 30 28; T 9 9 5; t 9 14 10; T 22 9 5; t 22 14 10; T 9 21 5; t 9 26 10; T 22 21 5; t 22 26 10; p 37 6 18 28',
    photoLabel: 'Photo (a pet or person with the background cut out looks best; empty = your About photo)',
    sides: [['right', 'Photo on the right of the cards'], ['left', 'Photo on the left of the cards']],
    hint: 'Type a heading above if you want one over the cards (optional). Add as many items as you need; on wide screens they sit two by two, on phones one under another, and the photo goes under the cards.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. What we teach' },
      { k: 'item', kind: 'rows', grow: true, max: MAX_ITEMS, label: 'Item', cols: [{ k: 'title', max: 60, ph: 'Title, e.g. Puppy training' }, { k: 'words', max: 400, ph: 'A sentence or two' }] },
      { k: 'numbers', kind: 'toggle', label: 'Show big numbers (#01, #02 ...) over the items' },
      { k: 'color', kind: 'color', def: '#1a9e8f', label: 'Own color for the odd numbers (unticked = teal)' },
      { k: 'accent', kind: 'color', def: '#e5b80b', label: 'Own color for the even numbers (unticked = mustard)' },
      { k: 'card', kind: 'color', def: '#ffffff', label: 'Own color for the card behind the items (unticked = white)' },
      { k: 'photobg', kind: 'color', def: '#f1f1ef', label: 'Own color behind the photo (unticked = pale grey)' },
      { k: 'light', kind: 'color', def: '#d9d9d9', label: 'Own color for the light side of the band (unticked = light grey)' },
      { k: 'dark', kind: 'color', def: '#263033', label: 'Own color for the dark side of the band (unticked = charcoal)' }
    ]
  },
  tipcards: {
    group: 'words', name: 'Big photo with cards over its edge',
    desc: 'A wide photo with a row of cards over its lower edge: each a small title, a few words and an optional link',
    pic: 'a 0 0 60 40; p 4 3 52 20; k 6 18 11 16; k 18 18 11 16; k 30 18 11 16; k 42 18 11 16; t 8 21 6; t 20 21 6; t 32 21 6; t 44 21 6',
    photoLabel: 'Wide photo (a group of pets with the background cut out looks best; empty = your About photo)',
    hint: 'Type a heading above if you want one over the photo (optional). Add as many cards as you need; four fit in a row on wide screens, then they wrap. A card\'s link is optional.',
    fields: [
      { k: 'label', kind: 'line', max: 60, ph: 'Small line over the heading (optional), e.g. For dog owners' },
      { k: 'item', kind: 'rows', grow: true, max: MAX_ITEMS, label: 'Card', cols: [{ k: 'title', max: 60, ph: 'Title, e.g. Top tips' }, { k: 'words', max: 400, ph: 'A sentence or two' }, { k: 'link', link: true, ph: 'Link for "More" (optional), e.g. /tips or https://...' }] },
      { k: 'more', kind: 'line', max: 30, ph: 'Words on the card links (empty = More)' },
      { k: 'color', kind: 'color', def: '#1f2937', label: 'Own color for the card titles and links (unticked = near black)' },
      { k: 'card', kind: 'color', def: '#ffffff', label: 'Own color for the cards (unticked = white)' },
      { k: 'photobg', kind: 'color', def: '#e9e9ea', label: 'Own color behind the photo (unticked = soft grey)' },
      { k: 'bg', kind: 'color', def: '#ffffff', label: 'Own background color for the block (unticked = the page color)' }
    ]
  }
};
Object.values(SPECS).forEach(s => { s.sides = s.sides || [['center', 'Centered']]; });

module.exports = { SPECS, MAX_ITEMS };
