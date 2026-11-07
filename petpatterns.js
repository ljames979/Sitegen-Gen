// Pet pattern backgrounds (Leo, 2026-11-07, from a screenshot of a dog-and-cat wallpaper): repeating rows of dog faces,
// cat faces, paw prints, bones, fish and hearts. All our own drawings, made here as plain SVG shapes (no outside
// artwork). Each motif is one flat color with its eyes, nose and mouth cut out, so the color under the pattern shows
// through them and any one color works: all black, all white, a matching palette or the brand color.
// The pattern has no background of its own: it is laid over whatever color the section or block already has.
// textures.js lists them with the textures (ids txp-<key>), so every background picker offers them.

// Each motif is drawn in a 100 x 100 box. A masked rect in currentColor: white in the mask = drawn, black = cut out.
// back: bits drawn again inside the cut-outs (the pupils)
const masked = (id, keep, cut, back) => `<g id="${id}"><mask id="m${id}" maskUnits="userSpaceOnUse" x="-8" y="-8" width="116" height="116"><g fill="#fff" stroke="#fff">${keep}</g><g fill="#000" stroke="#000">${cut}</g>${back ? `<g fill="#fff">${back}</g>` : ''}</mask><rect x="-8" y="-8" width="116" height="116" fill="currentColor" mask="url(#m${id})"/></g>`;

const MOTIFS = {
  // a puppy face with floppy ears
  dog: masked('dog',
    '<ellipse cx="21" cy="47" rx="11" ry="23" transform="rotate(24 21 47)" stroke="none"/><ellipse cx="79" cy="47" rx="11" ry="23" transform="rotate(-24 79 47)" stroke="none"/>' +
    '<ellipse cx="50" cy="55" rx="29" ry="28" stroke-width="0"/>',
    // a thin gap where the ears meet the head, the eyes (a pupil left in each), the muzzle, the nose and the smile
    '<ellipse cx="50" cy="55" rx="29" ry="28" fill="none" stroke-width="3.2"/>' +
    '<circle cx="39" cy="50" r="5.4" stroke="none"/><circle cx="61" cy="50" r="5.4" stroke="none"/>' +
    '<ellipse cx="50" cy="69" rx="13" ry="10" fill="none" stroke-width="2.4"/>' +
    '<path d="M44 62.5Q50 59.5 56 62.5Q54 67 50 68Q46 67 44 62.5Z" stroke="none"/>' +
    '<path d="M50 68V72M43.5 72.5Q50 78 56.5 72.5" fill="none" stroke-width="2.4" stroke-linecap="round"/>',
    // the pupils, looking up a little
    '<circle cx="40" cy="49.5" r="2.7"/><circle cx="62" cy="49.5" r="2.7"/>'),
  // a cat face with pointed ears and whiskers
  cat: masked('cat',
    '<path d="M22 50L24 15L45 33ZM78 50L76 15L55 33Z" stroke-width="5" stroke-linejoin="round"/>' +
    '<ellipse cx="50" cy="57" rx="30" ry="25" stroke="none"/>' +
    '<path d="M26 62L5 57M26 67L5 70M74 62L95 57M74 67L95 70" fill="none" stroke-width="2" stroke-linecap="round"/>',
    '<path d="M28 40L29.5 25L39 33Z" stroke-width="2" stroke-linejoin="round"/><path d="M72 40L70.5 25L61 33Z" stroke-width="2" stroke-linejoin="round"/>' +
    '<ellipse cx="39" cy="53" rx="6.8" ry="5.2" stroke="none"/><ellipse cx="61" cy="53" rx="6.8" ry="5.2" stroke="none"/>' +
    '<path d="M46 62H54L50 66.5Z" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M50 66.5Q47 72 42 70M50 66.5Q53 72 58 70" fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M30 63H40M30 67.5H39M70 63H60M70 67.5H61" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
    // slit pupils
    '<ellipse cx="39" cy="53" rx="1.7" ry="4.4"/><ellipse cx="61" cy="53" rx="1.7" ry="4.4"/>'),
  // a paw print: four toes and a pad
  paw: '<g id="paw"><ellipse cx="25" cy="40" rx="9" ry="12" transform="rotate(-22 25 40)"/><ellipse cx="42" cy="24" rx="9.5" ry="13" transform="rotate(-6 42 24)"/><ellipse cx="58" cy="24" rx="9.5" ry="13" transform="rotate(6 58 24)"/><ellipse cx="75" cy="40" rx="9" ry="12" transform="rotate(22 75 40)"/><path d="M50 47C63 47 77 61 77 73C77 83 67 86 59 83C55 81.5 45 81.5 41 83C33 86 23 83 23 73C23 61 37 47 50 47Z"/></g>',
  // a dog bone
  bone: '<path id="bone" d="M24 41H76A11 11 0 1 1 87 50A11 11 0 1 1 76 59H24A11 11 0 1 1 13 50A11 11 0 1 1 24 41Z"/>',
  // a heart
  heart: '<path id="heart" d="M50 84C22 65 12 49 20 35C27 23 43 23 50 37C57 23 73 23 80 35C88 49 78 65 50 84Z"/>',
  // a fish with a forked tail (the eye cut out)
  fish: masked('fish',
    '<path d="M8 50C22 30 52 28 70 50C52 72 22 70 8 50Z" stroke="none"/><path d="M66 50L92 32Q86 50 92 68Z" stroke-width="3" stroke-linejoin="round"/>',
    '<circle cx="24" cy="47" r="3.6" stroke="none"/><path d="M44 36Q50 50 44 64" fill="none" stroke-width="2.4" stroke-linecap="round"/>')
};

// [motif, x, y, size (px), turn (deg), color role]  role: 0 main (dogs), 1 second (cats), 2 small things (paws, bones ...)
// Every tile is laid out so nothing crosses its edge, and the second row is offset like a brick wall.
const PATTERNS = {
  // dog, two paws, cat, two paws; the next row starts with the cat
  dogcat: { w: 320, h: 230, items: [
    ['dog', 16, 14, 76, 0, 0], ['paw', 104, 22, 24, -20, 1], ['paw', 128, 54, 24, 15, 2], ['cat', 176, 12, 80, 0, 1], ['paw', 266, 22, 24, 18, 0], ['paw', 286, 56, 24, -14, 1],
    ['paw', 18, 128, 24, -16, 2], ['paw', 42, 160, 24, 18, 1], ['cat', 88, 126, 80, 0, 1], ['paw', 178, 134, 24, 18, 0], ['paw', 198, 168, 24, -14, 1], ['dog', 234, 128, 76, 0, 0]] },
  // paw prints only, scattered at different turns
  paws: { w: 220, h: 220, items: [
    ['paw', 14, 16, 38, -18, 0], ['paw', 116, 8, 30, 22, 1], ['paw', 168, 64, 34, -8, 2], ['paw', 64, 76, 30, 34, 1],
    ['paw', 10, 128, 30, 12, 2], ['paw', 116, 128, 40, -28, 0], ['paw', 70, 176, 26, 4, 1], ['paw', 180, 172, 28, 26, 2]] },
  // trails of paw prints walking up the page
  trail: { w: 240, h: 240, items: [
    ['paw', 20, 196, 28, 30, 0], ['paw', 52, 168, 28, 30, 0], ['paw', 58, 124, 28, 30, 0], ['paw', 90, 96, 28, 30, 0], ['paw', 96, 52, 28, 30, 0], ['paw', 128, 24, 28, 30, 0],
    ['paw', 150, 200, 24, -20, 1], ['paw', 176, 178, 24, -20, 1], ['paw', 196, 140, 24, -20, 1], ['paw', 202, 104, 24, -20, 2]] },
  // bones and paws, criss-crossed
  bones: { w: 240, h: 200, items: [
    ['bone', 14, 16, 64, -28, 0], ['paw', 104, 22, 30, 16, 1], ['bone', 150, 30, 64, 24, 2], ['paw', 30, 108, 30, -14, 1],
    ['bone', 76, 104, 64, 30, 0], ['paw', 176, 120, 30, 20, 2], ['paw', 140, 160, 22, -24, 1]] },
  // puppies, bones and a few paws
  dogs: { w: 280, h: 230, items: [
    ['dog', 14, 12, 78, 0, 0], ['bone', 110, 30, 50, -24, 2], ['paw', 168, 18, 26, 18, 1], ['dog', 196, 12, 78, 0, 1],
    ['paw', 26, 132, 26, -16, 1], ['bone', 62, 150, 50, 26, 2], ['dog', 112, 126, 78, 0, 1], ['paw', 210, 134, 26, 14, 2], ['bone', 214, 180, 50, -12, 0]] },
  // cats, fish and paws
  cats: { w: 300, h: 230, items: [
    ['cat', 12, 10, 80, 0, 0], ['fish', 104, 30, 54, -14, 2], ['paw', 168, 18, 24, 16, 1], ['cat', 200, 12, 80, 0, 1],
    ['paw', 28, 132, 24, -18, 2], ['fish', 58, 146, 54, 12, 1], ['cat', 124, 124, 80, 0, 1], ['paw', 216, 136, 24, 18, 0], ['fish', 230, 176, 54, -8, 2]] },
  // paws and little hearts
  hearts: { w: 200, h: 200, items: [
    ['paw', 16, 14, 34, -16, 0], ['heart', 88, 22, 24, -10, 2], ['paw', 140, 46, 30, 20, 1], ['heart', 34, 92, 22, 12, 1],
    ['paw', 82, 108, 34, 10, 0], ['heart', 156, 128, 26, -8, 2], ['paw', 22, 156, 28, 26, 1], ['heart', 124, 176, 18, 16, 0]] }
};
// [key, name] in menu order
const LIST = [['dogcat', 'Dogs, cats and paws'], ['paws', 'Paw prints'], ['trail', 'Paw trails'], ['bones', 'Bones and paws'], ['dogs', 'Puppies and bones'], ['cats', 'Cats and fish'], ['hearts', 'Paws and hearts']];

// Matching palettes: [key, name, [main, second, small things]]
const PALETTES = [
  ['p-classic', 'Tan and charcoal', ['#c4874a', '#2e2a2d', '#c4874a']],
  ['p-cocoa', 'Cocoa and caramel', ['#7a4b2a', '#d39a5c', '#a8693c']],
  ['p-pastel', 'Soft pastels', ['#f2a2b5', '#8cc4e3', '#a9cf86']],
  ['p-candy', 'Bright candy', ['#ff5d8f', '#22b5c9', '#ffb000']],
  ['p-ocean', 'Ocean blues', ['#1d4e89', '#0aa1bd', '#6cc9e6']],
  ['p-forest', 'Forest greens', ['#2f5d50', '#7a9e5e', '#c9a227']],
  ['p-sunset', 'Sunset', ['#e4572e', '#8a3d6b', '#f2a516']],
  ['p-berry', 'Berry and plum', ['#b8336a', '#5b2a6e', '#e57fa8']],
  ['p-gray', 'Soft grays', ['#55595e', '#8f949a', '#b9bdc2']],
  ['p-brand', 'Your brand and accent colors', null]
];

const r1 = (n) => Math.round(n * 10) / 10;
// The SVG for one pattern in the given colors (one color for all, or [main, second, small]; more than three: each
// motif takes the next color in turn, like a rainbow). No size of its own, so as a background it fills the whole
// section; the tile repeats inside it at a fixed size.
function svg(key, colors) {
  const p = PATTERNS[key]; if (!p) return '';
  const cs = colors && colors.length ? colors : ['#2e2a2d'];
  const color = (role, i) => (cs.length > 3 ? cs[i % cs.length] : cs[Math.min(role, cs.length - 1)] || cs[0]);
  const used = [...new Set(p.items.map(x => x[0]))];
  const uses = p.items.map(([m, x, y, s, turn, role], i) => {
    const k = r1(s / 100);
    return `<use href="#${m}" color="${color(role, i)}" fill="currentColor" transform="translate(${x} ${y}) scale(${k})${turn ? ` rotate(${turn} 50 50)` : ''}"/>`;
  }).join('');
  // paws, bones and hearts are plain shapes: they take the color from fill="currentColor" on the use
  const defs = used.map(m => MOTIFS[m]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg"><defs>${defs}<pattern id="pp" width="${p.w}" height="${p.h}" patternUnits="userSpaceOnUse">${uses}</pattern></defs><rect width="100%" height="100%" fill="url(#pp)"/></svg>`;
}

module.exports = { LIST, PATTERNS, PALETTES, MOTIFS, svg };
