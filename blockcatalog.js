// Content block catalog (Leo, 2026-11-02: "tidy up the content blocks section and allow for them to be easier
// recognizable"). One place that says, for every block design: which group it sits in, its short name, a one-line
// description and a small drawn picture of its layout. The editor uses it for the "Add a content block" picker
// (grouped cards with a search box) and for each block's entry in the Page sections list (picture, colored group tag).
// The pictures are plain wireframes drawn here (no images, no outside icons).
const mixPage = require('./mixpage');
const aboutBlocks = require('./aboutblocks');
const decoCard = require('./decocard');

const GROUPS = [
  ['tops', 'Page tops and photo with words', '#2563eb', 'Page tops'],
  ['about', 'About us', '#db2777', 'About us'],
  ['social', 'Social media', '#0891b2', 'Social media'],
  ['words', 'Words, lists and prices', '#059669', 'Words and lists'],
  ['photos', 'Photo galleries and video', '#d97706', 'Photos and video'],
  ['moving', 'Moving and scroll effects', '#7c3aed', 'Moving effects']
];

// [type, group, one-line description]; the short name comes from mixpage's BLOCK_KINDS
const LIST = [
  ['herocard', 'tops', 'Big title, a picture or video reel, and a bar along the bottom'],
  ['mosaic', 'tops', 'Huge title over six stepped photos that can take turns, optional menu bar'],
  ['photoblend', 'tops', 'Words on one side, a photo that melts into the block on the other'],
  ['photoBanner', 'tops', 'A wide rounded photo with your words on a soft fade'],
  ['bigwords', 'tops', 'Very large words next to one photo'],
  ['photoText', 'tops', 'A photo on one side, heading, text and a button on the other'],
  ['thirds', 'tops', 'Three columns: a photo, your words, and a colored box with a big letter'],
  ['aboutphone', 'tops', 'A photo in soft shapes, a few words and your phone number'],
  ['overlapcard', 'tops', 'A photo on a patterned shape, overlapping a card (white, brand or your own color, flat or gradient) with your words and a button'],
  ['phototabs', 'tops', 'Up to 4 small photos: picking one swaps the big photo and the words in the card at the front, each card in its own color'],
  ['reviewcard', 'tops', 'A big photo on a colored panel over a wide card with up to 3 reviews, each with a small round photo; your own background and card colors'],
  ['twinphotos', 'tops', 'A big colored heading and words, two square photos side by side, and a short list of links on a tall pale panel'],
  ['ringcard', 'tops', 'A white words panel and a big photo side by side on a soft band, with a striped circle and a ring peeking out behind'],
  ['shapeform', 'tops', 'Your contact form on a rounded white card over a big photo on a colored panel, with a dot, a color block and stripes around them'],
  ['framedphoto', 'tops', 'A wide photo between two blocks of color on a dark band, with a white card of your words over its lower corner'],
  ['roundphoto', 'tops', 'A big round photo with rings and dots around it, and a card in your color over its lower corner'],
  ['photopairs', 'tops', 'A heading with a small label over a row of photos, each paired with a words tile, on a band with slanted corners in your color'],
  ['offsetphoto', 'about', 'A photo on two offset blocks of soft color, with a small label, a big heading, your words, a note and a button beside it'],
  ['aboutstory', 'about', aboutBlocks.SPECS.aboutstory.desc],
  ['aboutme', 'about', aboutBlocks.SPECS.aboutme.desc],
  ['aboutbig', 'about', aboutBlocks.SPECS.aboutbig.desc],
  ['aboutfacts', 'about', aboutBlocks.SPECS.aboutfacts.desc],
  ['aboutcollage', 'about', aboutBlocks.SPECS.aboutcollage.desc],
  ['aboutnote', 'about', aboutBlocks.SPECS.aboutnote.desc],
  ['aboutpanel', 'about', aboutBlocks.SPECS.aboutpanel.desc],
  ['socialshapes', 'social', aboutBlocks.SPECS.socialshapes.desc],
  ['socialphoto', 'social', aboutBlocks.SPECS.socialphoto.desc],
  ['socialcounts', 'social', aboutBlocks.SPECS.socialcounts.desc],
  ['socialonphoto', 'social', aboutBlocks.SPECS.socialonphoto.desc],
  ['socialfeed', 'social', aboutBlocks.SPECS.socialfeed.desc],
  ['socialprofile', 'social', aboutBlocks.SPECS.socialprofile.desc],
  ['socialstrip', 'social', aboutBlocks.SPECS.socialstrip.desc],
  ['numcards', 'words', aboutBlocks.SPECS.numcards.desc],
  ['tipcards', 'words', aboutBlocks.SPECS.tipcards.desc],
  ['decocard', 'words', 'Your words framed in a card like a business card or an invitation: royal, minimal, art deco, stamp, ribbon or frosted glass'],
  ['crossband', 'tops', 'A tall photo and a colored card with a checklist, over a color band'],
  ['advice', 'tops', 'A big photo, a heading, and points that each have a small round photo'],
  ['shapes', 'tops', 'Big rolling words on the left, photos in rounded shapes on the right'],
  ['split', 'words', 'A heading on the left, a paragraph on the right'],
  ['steps', 'words', 'How it works, as numbered steps'],
  ['features', 'words', 'A row of cards, each with a title and a line of text'],
  ['pricing', 'words', 'Packages or price cards side by side'],
  ['team', 'words', 'Your people, with round photos and their roles'],
  ['stats', 'words', 'Big numbers that count up as they come into view'],
  ['tabs', 'words', 'A few tabs; each one shows its own text'],
  ['accordion', 'words', 'Questions or topics that open and close'],
  ['chips', 'words', 'The towns or areas you cover, as small rounded tags'],
  ['cta', 'words', 'A colored band near the bottom with one clear button'],
  ['patterns', 'words', 'A band of gradient patterns (checks, retro, facets, confetti, arrows, wood boards, panes) with optional words; it zooms when pointed at'],
  ['strip', 'photos', 'A row of photos that scrolls sideways'],
  ['collage', 'photos', 'Words slide through a photo card'],
  ['nodes', 'photos', 'Photo cards joined by lines, the pictures change'],
  ['beforeAfter', 'photos', 'Drag a slider across your before and after Gallery pairs'],
  ['video', 'photos', 'A YouTube or Vimeo video with a heading'],
  ['wall', 'moving', 'Rows of cards that drift sideways'],
  ['cascade', 'moving', 'Cards deal one by one into a stack'],
  ['stack', 'moving', 'A heading on the left, a pile of cards that turn as you scroll'],
  ['story', 'moving', 'Steps that play one after another as you scroll'],
  ['path', 'moving', 'Photos ride along a curve as you scroll'],
  ['trail', 'moving', 'Photos follow the mouse across the block'],
  ['wave', 'moving', 'Photos wave between two words, then scatter'],
  ['zoomword', 'moving', 'The page zooms through one big word'],
  ['morph', 'moving', 'A photo inside a shape that keeps changing']
];

// ---- the little pictures: a 60 x 40 wireframe drawn from a few shape kinds ----
// p photo (x y w h [turn]), k card outline, n color fill, a soft color fill, t text line (x y w), T heading line,
// H big heading line, W white line, o round photo (cx cy r), O number dot, b button (x y w), plus a few one-offs
const PICS = {
  herocard: 'k 2 2 56 36; p 5 5 50 22; H 9 10 30; n 5 29 50 6; W 8 31 14; W 40 31 12',
  mosaic: 'H 4 4 40; p 4 16 12 10; p 18 13 12 13; p 32 16 12 10; p 46 13 10 13; p 11 28 12 9; p 39 28 12 9',
  photoblend: 'a 0 0 60 40; T 4 10 22; t 4 17 18; n 4 22 18 6; W 6 24 12; b 4 31 12; fade 30 0 30 40',
  photoBanner: 'p 2 3 56 34; shade 2 3 56 34; W 7 22 26; W 7 28 18',
  bigwords: 'H 3 7 30; H 3 16 22; H 3 25 27; p 38 5 19 30',
  photoText: 'p 3 5 25 30; T 32 9 22; t 32 16 24; t 32 21 20; b 32 28 13',
  thirds: 'p 2 5 17 30; T 22 10 15; t 22 16 16; t 22 21 13; n 41 5 17 30; letter 49.5 27 A',
  aboutphone: 'blob 3 4; T 33 10 22; t 33 16 22; t 33 21 18; b 33 28 16',
  crossband: 'n 0 15 60 12; p 5 3 16 34; n 30 6 26 28; W 34 11 14; W 34 17 16; W 34 22 12; W 34 27 14',
  overlapcard: 'a 0 0 60 22; hatch 4 4 22 22; k 26 12 31 24; p 8 8 22 24; T 32 16 18; t 32 22 20; t 32 26 16; dk 32 30 10',
  phototabs: 'n 3 4 26 22; p 7 8 28 22; K 31 3 26 20; T 35 8 16; t 35 14 18; b 35 17 10; p 7 32 7 6; p 16 32 7 6; p 25 32 7 6',
  reviewcard: 'a 0 0 60 40; k 3 14 54 22; n 6 4 18 30; p 8 2 14 32; T 28 17 18; n 28 21 6 1; o 30 26 2.5; t 34 25 18; o 30 32 2.5; t 34 31 16',
  twinphotos: 'a 30 0 26 40; H 4 5 24; t 4 13 20; t 4 17 18; n 4 22 14 14; p 4 22 14 14; n 20 22 14 14; p 20 22 14 14; t 40 26 10; t 40 30 12; t 40 34 9',
  decocard: 'k 9 4 42 32; a 12 7 36 26; T 22 15 16; t 19 20 22; t 21 24 18; b 25 29 10',
  ringcard: 'a 0 0 60 40; o 7 9 6; o 52 32 5; k 6 8 24 24; T 9 13 16; T 9 17 12; t 9 23 18; t 9 26 16; b 9 30 9; n 30 8 24 24; p 30 8 24 24',
  shapeform: 'a 0 0 60 40; o 9 9 6; n 6 26 22 11; n 26 5 26 26; p 30 7 18 24; o 50 31 5; k 10 7 18 27; T 13 11 12; t 13 16 12; t 13 20 12; t 13 24 12; b 13 29 12',
  framedphoto: 'n 0 0 60 40; a 0 0 60 40; n 34 4 22 22; n 4 20 20 16; p 9 7 40 24; k 32 21 18 16; T 35 24 11; t 35 28 12; b 35 32 8',
  roundphoto: 'o 22 18 14; p 13 8 18 20; o 40 8 5; o 9 30 5; o 22 36 3; n 30 22 26 15; W 33 26 14; W 33 30 16; wb 33 33 9',
  photopairs: 'n 0 0 60 40; k 6 2 50 36; t 25 5 10; T 18 9 24; p 4 15 13 16; k 17 15 13 16; t 19 19 9; t 19 23 8; p 30 15 13 16; n 43 15 13 16; W 45 19 9; W 45 23 8',
  offsetphoto: 'a 3 10 10 16; a 14 20 18 16; p 6 6 20 24; t 34 9 10; T 34 13 20; T 34 17 16; t 34 23 20; t 34 26 18; b 34 31 10 4',
  aboutstory: aboutBlocks.SPECS.aboutstory.pic,
  aboutme: aboutBlocks.SPECS.aboutme.pic,
  aboutbig: aboutBlocks.SPECS.aboutbig.pic,
  aboutfacts: aboutBlocks.SPECS.aboutfacts.pic,
  aboutcollage: aboutBlocks.SPECS.aboutcollage.pic,
  aboutnote: aboutBlocks.SPECS.aboutnote.pic,
  aboutpanel: aboutBlocks.SPECS.aboutpanel.pic,
  socialshapes: aboutBlocks.SPECS.socialshapes.pic,
  socialphoto: aboutBlocks.SPECS.socialphoto.pic,
  socialcounts: aboutBlocks.SPECS.socialcounts.pic,
  socialonphoto: aboutBlocks.SPECS.socialonphoto.pic,
  socialfeed: aboutBlocks.SPECS.socialfeed.pic,
  socialprofile: aboutBlocks.SPECS.socialprofile.pic,
  socialstrip: aboutBlocks.SPECS.socialstrip.pic,
  numcards: aboutBlocks.SPECS.numcards.pic,
  tipcards: aboutBlocks.SPECS.tipcards.pic,
  advice: 'p 2 3 26 34; T 32 6 22; o 35 16 3; t 40 15 16; o 35 24 3; t 40 23 14; o 35 32 3; t 40 31 16',
  shapes: 'H 3 9 22; H 3 18 18; H 3 27 24; pill 32 4 10 32; o 50 12 7; o 50 29 7',
  split: 'T 4 10 22; T 4 17 15; t 32 10 24; t 32 15 22; t 32 20 24; t 32 25 17',
  steps: 'O 10 13 1; O 30 13 2; O 50 13 3; t 4 23 12; t 24 23 12; t 44 23 12; t 5 28 10; t 25 28 10; t 45 28 10',
  features: 'k 3 7 16 27; k 22 7 16 27; k 41 7 16 27; a 6 10 5 5; a 25 10 5 5; a 44 10 5 5; t 6 20 10; t 25 20 10; t 44 20 10; t 6 25 8; t 25 25 8; t 44 25 8',
  pricing: 'k 3 7 16 28; K 22 4 16 32; k 41 7 16 28; T 6 12 8; T 25 9 8; T 44 12 8; t 6 19 10; t 25 17 10; t 44 19 10; b 6 28 10; b 25 28 10; b 44 28 10',
  team: 'o 12 15 7; o 30 15 7; o 48 15 7; T 7 27 10; T 25 27 10; T 43 27 10; t 8 32 8; t 26 32 8; t 44 32 8',
  stats: 'num 10 22 9; num 30 22 4; num 50 22 1; t 4 29 12; t 24 29 12; t 44 29 12',
  tabs: 'n 4 6 15 7; k 20 6 15 7; k 36 6 15 7; k 4 13 52 22; t 8 19 36; t 8 24 40; t 8 29 28',
  accordion: 'k 4 4 52 8; plus 52 8; k 4 14 52 8; plus 52 18; k 4 24 52 12; t 8 27 30; t 8 32 36',
  chips: 'T 15 7 30; q 4 17 15; q 21 17 17; q 40 17 16; q 9 26 16; q 27 26 14; q 43 26 12',
  cta: 'n 2 7 56 26; W 13 14 34; W 19 20 22; wb 22 25 16',
  patterns: 'plaid 2 5 56 30; k 16 12 28 16; T 20 16 20; t 22 22 16',
  strip: 'p -6 9 18 22; p 15 9 18 22; p 36 9 18 22; p 57 9 18 22; arr 52 36',
  collage: 'H 2 17 56; p 18 5 24 30; T 20 18 20',
  nodes: 'line 13 12 30 28; line 30 28 47 12; p 4 4 18 14; p 21 22 18 14; p 38 4 18 14',
  beforeAfter: 'p 3 5 54 30; dim 3 5 27 30; wline 30 5 30; o 30 20 3.5',
  video: 'p 3 4 54 32; play 30 20',
  wall: 'p -4 5 12 9; p 10 5 12 9; p 24 5 12 9; p 38 5 12 9; p 52 5 12 9; p 3 17 12 9; p 17 17 12 9; p 31 17 12 9; p 45 17 12 9; p -4 29 12 9; p 10 29 12 9; p 24 29 12 9; p 38 29 12 9; p 52 29 12 9',
  cascade: 'k 12 9 24 20 -12; k 18 8 24 20 -4; p 24 8 24 20 6',
  stack: 'T 3 12 18; t 3 19 16; t 3 24 14; k 29 4 24 18; k 31 10 24 18; p 33 16 24 18',
  story: 'vline 8 3 34; O 8 8 1; O 8 20 2; O 8 32 3; T 15 7 18; t 15 12 22; p 42 4 15 32',
  path: 'curve; p 5 24 9 9 -10; p 23 14 9 9 0; p 42 6 9 9 10',
  trail: 'p 4 25 13 9 -12; p 15 17 13 9 6; p 27 10 13 9 -4; cur 44 7',
  wave: 'T 3 19 12; T 45 19 12; p 17 13 6 6; p 24 20 6 6; p 31 12 6 6; p 38 19 6 6',
  zoomword: 'zoom',
  morph: 'morph'
};

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function shape(kind, n, c) {
  const [x, y, w, h, turn] = n.map(Number);
  const rot = (cx, cy) => (turn ? ` transform="rotate(${turn} ${cx} ${cy})"` : '');
  switch (kind) {
    case 'p': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}" fill-opacity=".38"${rot(x + w / 2, y + h / 2)}/>`
      + (w >= 12 && h >= 9 && !turn ? `<path d="M${x + 2} ${y + h - 2} l${w * 0.3} ${-h * 0.4} l${w * 0.18} ${h * 0.22} l${w * 0.14} ${-h * 0.14} l${w * 0.28} ${h * 0.32} z" fill="${c}" fill-opacity=".5"/>` : '');
    case 'k': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#fff" stroke="#94a3b8" stroke-width="1"${rot(x + w / 2, y + h / 2)}/>`;
    case 'K': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#fff" stroke="${c}" stroke-width="1.6"/>`;
    case 'n': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}"/>`;
    case 'a': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}" fill-opacity=".14"/>`;
    case 't': return `<rect x="${x}" y="${y}" width="${w}" height="2.2" rx="1.1" fill="#94a3b8"/>`;
    case 'T': return `<rect x="${x}" y="${y}" width="${w}" height="3.6" rx="1.4" fill="#334155"/>`;
    case 'H': return `<rect x="${x}" y="${y}" width="${w}" height="6" rx="1.6" fill="#1e293b"/>`;
    case 'W': return `<rect x="${x}" y="${y}" width="${w}" height="2.6" rx="1.2" fill="#fff"/>`;
    case 'b': return `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" fill="${c}"/>`;
    case 'wb': return `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" fill="#fff"/>`;
    case 'o': return `<circle cx="${x}" cy="${y}" r="${w}" fill="${c}" fill-opacity=".45"/>`;
    case 'O': return `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/><text x="${x}" y="${y + 2}" font-size="5.5" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${w}</text>`;
    case 'q': return `<rect x="${x}" y="${y}" width="${w}" height="6" rx="3" fill="#fff" stroke="${c}" stroke-width="1"/>`;
    case 'num': return `<text x="${x}" y="${y}" font-size="13" font-family="Arial,sans-serif" font-weight="800" text-anchor="middle" fill="${c}">${w}</text>`;
    case 'letter': return `<text x="${x}" y="${y}" font-size="17" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#fff">${esc(n[2])}</text>`;
    case 'plus': return `<path d="M${x - 2} ${y} h4 M${x} ${y - 2} v4" stroke="#334155" stroke-width="1.2"/>`;
    case 'pill': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${c}" fill-opacity=".45"/>`;
    case 'line': return `<path d="M${x} ${y} L${w} ${h}" stroke="${c}" stroke-width="1.2" stroke-dasharray="2 1.5"/>`;
    case 'vline': return `<path d="M${x} ${y} v${w}" stroke="#cbd5e1" stroke-width="1.4"/>`;
    case 'wline': return `<path d="M${x} ${y} v${w}" stroke="#fff" stroke-width="1.6"/>`;
    case 'dim': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#334155" fill-opacity=".35"/>`;
    case 'shade': return `<rect x="${x}" y="${y + h * 0.45}" width="${w}" height="${h * 0.55}" rx="2" fill="#0f172a" fill-opacity=".45"/>`;
    case 'fade': return `<defs><linearGradient id="pbf" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".45" stop-color="${c}" stop-opacity=".45"/></linearGradient></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#pbf)"/>`;
    case 'play': return `<circle cx="${x}" cy="${y}" r="7" fill="#fff" fill-opacity=".9"/><path d="M${x - 2} ${y - 3.5} l6 3.5 l-6 3.5 z" fill="${c}"/>`;
    case 'arr': return `<path d="M${x} ${y} h6 m-2 -2 l2 2 l-2 2" stroke="#64748b" stroke-width="1.2" fill="none"/>`;
    case 'cur': return `<path d="M${x} ${y} l0 10 l3 -3 l2.5 5 l2 -1 l-2.5 -5 l4 0 z" fill="#1e293b"/>`;
    case 'blob': return `<path d="M${x + 6} ${y + 2} C${x + 18} ${y - 2} ${x + 28} ${y + 6} ${x + 26} ${y + 17} C${x + 25} ${y + 29} ${x + 12} ${y + 34} ${x + 4} ${y + 28} C${x - 3} ${y + 22} ${x - 2} ${y + 6} ${x + 6} ${y + 2} z" fill="${c}" fill-opacity=".42"/>`;
    case 'curve': return `<path d="M2 36 C18 34 22 14 34 14 C46 14 48 4 58 3" stroke="${c}" stroke-width="1.3" stroke-dasharray="2.5 2" fill="none"/>`;
    case 'zoom': return `<text x="30" y="29" font-size="18" font-family="Arial,sans-serif" font-weight="900" text-anchor="middle" fill="#1e293b">ZO<tspan fill="${c}">O</tspan>M</text><circle cx="40" cy="21" r="4" fill="${c}" fill-opacity=".45"/>`;
    case 'hatch': {   // thin diagonal stripes (Photo over a text card)
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#334155" stroke-width=".6"/>`;
      for (let i = 2; i < w + h; i += 2.4) s += `<path d="M${x + Math.min(i, w)} ${y + Math.max(0, i - w)} L${x + Math.max(0, i - h)} ${y + Math.min(i, h)}" stroke="#334155" stroke-width=".5"/>`;
      return s;
    }
    case 'dk': return `<rect x="${x}" y="${y}" width="${w}" height="4" rx="2" fill="#111827"/>`;
    case 'plaid': {   // a little checked pattern (the Gradient pattern block)
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}" fill-opacity=".2"/>`;
      for (let i = 0; i < 4; i++) s += `<rect x="${x + i * w / 4}" y="${y}" width="${w / 8}" height="${h}" fill="${c}" fill-opacity=".28"/><rect x="${x}" y="${y + i * h / 4}" width="${w}" height="${h / 8}" fill="${c}" fill-opacity=".22"/>`;
      return s;
    }
    case 'morph': return `<path d="M30 4 C42 4 54 12 52 22 C50 33 38 37 28 36 C16 35 7 28 8 18 C9 9 20 4 30 4 z" fill="${c}" fill-opacity=".42"/><path d="M14 31 l8 -9 l5 5 l4 -4 l9 8 z" fill="${c}" fill-opacity=".55"/><rect x="5" y="4" width="10" height="10" rx="3" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 1.5"/>`;
    default: return '';
  }
}
function pic(type, color) {
  const c = color || '#64748b';
  const body = String(PICS[type] || PICS.photoText).split(';').map(s => s.trim().split(/\s+/)).map(([k, ...n]) => shape(k, n, c)).join('');
  return `<svg class="blk-pic" viewBox="0 0 60 40" width="60" height="40" aria-hidden="true" focusable="false"><rect width="60" height="40" rx="4" fill="#f8fafc"/><svg x="0" y="0" width="60" height="40" overflow="hidden">${body}</svg></svg>`;
}

const GROUP_OF = Object.fromEntries(LIST.map(([t, g]) => [t, g]));
const colorOf = (g) => (GROUPS.find(x => x[0] === g) || [, , '#64748b'])[2];
const nameOf = (type) => mixPage.BLOCK_KINDS[type] || 'Photo + text';
// every block, grouped, ready for the editor
function groups() {
  return GROUPS.map(([id, label, color, short]) => ({
    id, label, color, short,
    items: LIST.filter(x => x[1] === id).map(([type, , desc]) => ({ type, name: nameOf(type), desc, pic: pic(type, color),
      // the Decorative card shows one card per card style in the picker, each with its own little picture
      styles: type === 'decocard' ? decoCard.STYLES.map(([sid, sname, sdesc]) => ({ id: sid, name: sname, desc: sdesc, pic: decoCard.thumb(sid, color) })) : null }))
  }));
}
// what the page sections list needs for one block type: { name, group, groupLabel, color, pic }
function info(type) {
  const g = GROUP_OF[type] || 'tops';
  const grp = GROUPS.find(x => x[0] === g);
  return { name: nameOf(type), group: g, groupLabel: grp[1], color: grp[2], pic: pic(GROUP_OF[type] ? type : 'photoText', grp[2]) };
}
const infoAll = () => Object.fromEntries(Object.keys(mixPage.BLOCK_KINDS).map(t => [t, info(t)]));

// content blocks a site can have (hidden ones count too); was 20 in the save, which silently dropped new blocks
const MAX_BLOCKS = 60;

module.exports = { MAX_BLOCKS, GROUPS, LIST, PICS, groups, info, infoAll, pic, colorOf };
