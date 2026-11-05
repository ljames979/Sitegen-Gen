// Look packs and "Surprise me" for the Blocks screen. Both only set each block's effects (pin and cards, color
// film, photo words, height); the blocks, their designs and their words stay as they are, and Undo puts it back.
// A pack is a list of rules: the first rule whose families (f) include the block's family (or '*') gives its effects.
// Surprise me picks effects at random within a few taste rules (see surprise). Both functions are also sent to the
// Blocks screen as they are (toString), so they must not use anything outside themselves.
const PACKS = [
  {
    id: 'bold', name: 'Bold trades', hint: 'Full-screen hero, service cards that stack as you scroll, brand-color bands, photo words on the gallery',
    rules: [
      { f: ['hero'], set: { height: 'screen' } },
      { f: ['services'], set: { pin: 'stack' } },
      { f: ['gallery'], set: { imgfx: 'hover' } },
      { f: ['cta', 'banner'], set: { film: 'brand:30' } },
      { f: ['stats'], set: { height: 'roomy' } },
    ],
  },
  {
    id: 'calm', name: 'Calm wellness', hint: 'More room around everything, words that slide onto photos, reviews in a pile to swipe',
    rules: [
      { f: ['hero'], set: { height: 'roomy' } },
      { f: ['gallery', 'about'], set: { imgfx: 'scroll', height: 'roomy' } },
      { f: ['testimonials'], set: { pin: 'deck', height: 'roomy' } },
      { f: ['banner', 'logos'], set: {} },
      { f: ['*'], set: { height: 'roomy' } },
    ],
  },
  {
    id: 'showcase', name: 'Showcase portfolio', hint: 'Full-screen hero, a fanned-out gallery, the about photo held while its words scroll, photo words on services',
    rules: [
      { f: ['hero'], set: { height: 'screen' } },
      { f: ['gallery'], set: { pin: 'fan' } },
      { f: ['about'], set: { pin: 'side' } },
      { f: ['services'], set: { imgfx: 'hover' } },
      { f: ['cta'], set: { film: 'brand:40', height: 'tall' } },
    ],
  },
  {
    id: 'story', name: 'Story scroll', hint: 'A page that unfolds: sections held, cards stacking, reviews to swipe, a full-screen call to action',
    rules: [
      { f: ['hero'], set: { height: 'screen' } },
      { f: ['about'], set: { pin: 'side' } },
      { f: ['services'], set: { pin: 'stack' } },
      { f: ['why', 'stats'], set: { pin: 'hold:100' } },
      { f: ['testimonials'], set: { pin: 'deck' } },
      { f: ['cta'], set: { height: 'screen', film: 'brand:20' } },
    ],
  },
  {
    id: 'clean', name: 'Clean and quick', hint: 'No effects and a little tighter: fast, simple and calm',
    rules: [{ f: ['*'], set: { height: 'compact' } }],
  },
];

const KEYS = ['pin', 'film', 'imgfx', 'height'];

// a new list with the pack's effects (every block's effects are replaced, so packs don't pile on each other)
function applyPack(blocks, pack) {
  var keys = ['pin', 'film', 'imgfx', 'height'];
  return blocks.map(function (b) {
    var o = {}; Object.keys(b).forEach(function (k) { if (keys.indexOf(k) < 0) o[k] = b[k]; });
    var rule = null;
    for (var i = 0; i < pack.rules.length && !rule; i++) if (pack.rules[i].f.indexOf(b.f) >= 0) rule = pack.rules[i];
    for (var j = 0; j < pack.rules.length && !rule; j++) if (pack.rules[j].f.indexOf('*') >= 0) rule = pack.rules[j];
    if (rule) Object.keys(rule.set).forEach(function (k) { if (!(k === 'pin' && b.f === 'hero')) o[k] = rule.set[k]; });
    return o;
  });
}

// random effects, within taste: the hero is never pinned and gets a big or normal height; each card effect is used
// once at most; no two pinned blocks in a row; at most two color films; photo words only where there are photos with
// words; most blocks keep a plain height. rnd is Math.random (or a seeded one in the tests).
function surprise(blocks, rnd) {
  var keys = ['pin', 'film', 'imgfx', 'height'];
  var pick = function (list) { return list[Math.floor(rnd() * list.length)]; };
  var cardPins = { services: ['stack', 'deck'], testimonials: ['deck', 'fan'], gallery: ['fan', 'deck'], pricing: ['fan'], why: ['stack'] };
  var sidePins = ['about'], photoWords = ['gallery', 'services', 'about'], filmFams = ['cta', 'banner', 'stats', 'why'];
  var usedPins = {}, films = 0, lastPinned = false;
  var filmPick = pick(['brand:20', 'brand:30', 'brand:40']);
  return blocks.map(function (b) {
    var o = {}; Object.keys(b).forEach(function (k) { if (keys.indexOf(k) < 0) o[k] = b[k]; });
    if (b.f === 'hero') { var h = pick(['screen', 'screen', 'roomy', '']); if (h) o.height = h; lastPinned = false; return o; }
    var pin = '';
    if (!lastPinned && rnd() < 0.55) {
      var opts = (cardPins[b.f] || []).concat(sidePins.indexOf(b.f) >= 0 ? ['side'] : []).filter(function (p) { return !usedPins[p]; });
      if (opts.length) pin = pick(opts);
    }
    if (pin) { o.pin = pin; usedPins[pin] = true; }
    lastPinned = !!pin;
    if (!pin && photoWords.indexOf(b.f) >= 0 && rnd() < 0.5) o.imgfx = pick(['hover', 'scroll']);
    if (films < 2 && filmFams.indexOf(b.f) >= 0 && rnd() < 0.6) { o.film = filmPick; films++; }
    var r = rnd();
    if (r < 0.15) o.height = 'roomy'; else if (r < 0.22) o.height = 'compact'; else if (r < 0.26 && (b.f === 'cta' || b.f === 'banner')) o.height = 'tall';
    return o;
  });
}

module.exports = { PACKS, KEYS, applyPack, surprise };
