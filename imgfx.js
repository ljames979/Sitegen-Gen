// Image text animation: the words of a card (or a photo-and-words block) sit over its photo, on a dark fade so they
// stay readable, and move in:
//   hover   hidden until the visitor points at the photo (or tabs to it); the photo zooms a little as they rise.
//           On a touch screen, where nothing can be pointed at, the words show from the start
//   scroll  they rise into place as each photo scrolls into view, one card after another
// The script finds the cards (the box with the most look-alike children that have a photo and words) or, with no
// cards, the one photo and the words beside it. Visitors who turn motion off see the words in place, still.
const OPTIONS = [
  ['', 'Words beside the photos (as designed)'],
  ['hover', 'Words over the photos, shown when pointed at'],
  ['scroll', 'Words over the photos, sliding in as you scroll'],
];
const IDS = OPTIONS.map(o => o[0]);
const clean = (v) => (IDS.includes(v) ? v : '');
function attrs(v) {
  const p = clean(v);
  return p ? { cls: ` sg-ix sg-ix-${p}` } : { cls: '' };
}

const CSS = [
  // one photo filling the card, the words on it (a photo-beside-words layout becomes a single photo)
  '.sg-ix-card{position:relative !important;overflow:hidden !important;isolation:isolate;display:block !important;min-height:260px}',
  '.sg-ix-card > :not(.sg-ix-text){width:100% !important;max-width:none !important;margin-left:0 !important;margin-right:0 !important}',
  '.sg-ix-card > :not(.sg-ix-text) img,.sg-ix-card > img{width:100% !important;display:block}',
  '.sg-ix-card img{transition:transform .6s cubic-bezier(.2,.8,.2,1)}',
  '.sg-ix-text{position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;top:auto !important;width:auto !important;max-width:none !important;margin:0 !important;z-index:2;padding:22px 20px 18px !important;' +
    'background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.55) 60%,rgba(0,0,0,0)) !important;transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .4s ease}',
  // the words' own boxes (a card under the words) go see-through, so the fade behind them shows
  '.sg-ix-text,.sg-ix-text *{color:#fff !important}',
  '.sg-ix-text *{background:transparent !important;border-color:transparent !important;box-shadow:none !important}',
  // hover: below the photo's edge until pointed at
  '@media (hover:hover){.sg-ix-hover .sg-ix-text{transform:translateY(101%);opacity:0}' +
    '.sg-ix-hover .sg-ix-card:hover .sg-ix-text,.sg-ix-hover .sg-ix-card:focus-within .sg-ix-text{transform:none;opacity:1}' +
    '.sg-ix-hover .sg-ix-card:hover img,.sg-ix-hover .sg-ix-card:focus-within img{transform:scale(1.06)}}',
  // scroll: in once the card is in view (the script adds sg-ix-in)
  '.sg-ix-scroll .sg-ix-card:not(.sg-ix-in) .sg-ix-text{transform:translateY(40px);opacity:0}',
  '.sg-ix-scroll .sg-ix-card:not(.sg-ix-in) img{transform:scale(1.08)}',
  '@media (prefers-reduced-motion:reduce){.sg-ix .sg-ix-text,.sg-ix .sg-ix-card img{transition:none !important;transform:none !important;opacity:1 !important}}',
].join('\n');

const SCRIPT = `(function () {
  var boxes = document.querySelectorAll('.sg-ix'); if (!boxes.length) return;
  var pic = function (el) { return el.tagName === 'IMG' ? el : el.querySelector('img'); };
  var words = function (el) { return (el.textContent || '').replace(/\\s+/g, ' ').trim().length > 1; };
  var sig = function (c) { return c.tagName + '.' + String(c.getAttribute('class') || '').split(/\\s+/)[0]; };
  // a card's words: the part of it with words and no photo, next to the part with the photo
  function wordsOf(card) {
    var vis = function (el) { return Array.prototype.filter.call(el.children, function (k) { return !/^(SCRIPT|STYLE)$/.test(k.tagName) && k.getClientRects().length; }); };   // shown (a photo still loading has no height yet)
    var kids = vis(card);
    while (kids.length === 1 && kids[0].children.length) { card = kids[0]; kids = vis(card); }   // a card wrapped in one box
    var withPic = kids.filter(function (k) { return pic(k); }); if (withPic.length !== 1) return null;
    var w = kids.filter(function (k) { return !pic(k) && words(k); }); if (!w.length) return null;
    if (w.length === 1) return { card: card, text: w[0] };
    // several parts with words (a heading and a line): wrap them together
    var wrap = document.createElement('div'); card.insertBefore(wrap, w[0]); w.forEach(function (x) { wrap.appendChild(x); });
    return { card: card, text: wrap };
  }
  boxes.forEach(function (box) {
    var best = null, bestN = 1;
    box.querySelectorAll('*').forEach(function (el) {
      var kids = Array.prototype.filter.call(el.children, function (k) { return k.offsetHeight > 60 && pic(k) && words(k); }); if (kids.length < 2) return;
      var s = sig(kids[0]); if (!kids.every(function (k) { return sig(k) === s; })) return;
      if (kids.length > bestN) { best = el; bestN = kids.length; }
    });
    var found = [];
    if (best) Array.prototype.forEach.call(best.children, function (k) { if (pic(k) && words(k)) { var f = wordsOf(k); if (f) found.push(f); } });
    else {
      // no cards: the one photo and the words beside it, in the box that holds both
      var img = box.querySelector('img'); if (!img) return;
      for (var el = img.parentElement; el && el !== box.parentElement; el = el.parentElement) { var f = words(el) && wordsOf(el); if (f) { found.push(f); break; } }
    }
    found.forEach(function (f, i) {
      f.card.classList.add('sg-ix-card'); f.text.classList.add('sg-ix-text');
      f.text.style.transitionDelay = (i % 4) * 0.12 + 's';
      if (!f.card.matches('a,button,[tabindex]') && !f.card.querySelector('a,button')) f.card.tabIndex = 0;   // so the words can be shown from the keyboard
    });
    if (box.classList.contains('sg-ix-scroll')) {
      if (!window.IntersectionObserver) { found.forEach(function (f) { f.card.classList.add('sg-ix-in'); }); return; }
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sg-ix-in'); io.unobserve(e.target); } }); }, { threshold: 0.35 });
      found.forEach(function (f) { io.observe(f.card); });
    }
  });
})();`;

module.exports = { OPTIONS, IDS, clean, attrs, CSS, SCRIPT };
