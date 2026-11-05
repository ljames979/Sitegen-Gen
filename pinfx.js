// Pin elements: a section or block can stay put while the page scrolls, each with its own setting.
//   hold:<n>  it stops under the header and stays for n% of a screen of scrolling, then moves on with the page
//             (a section taller than the screen scrolls to its bottom first, then holds)
//   cover     it stays put and the sections after it slide up over it, like cards being stacked
//   stack     its cards (the repeated boxes inside it: services, features, prices, team) line up one under the other and
//             each one stops a little below the one before, so the next card slides up over it and the earlier ones
//             peek out at the top like a pile
//   deck      its cards lie in a pile, slightly fanned; the visitor swipes or drags the top card away (or presses the
//             arrows) and it goes to the bottom of the pile, so the next one shows (galleries, products, portfolios)
//   fan       its cards overlap in a fanned row; pointing at one (or tapping it) lifts it forward. On a narrow
//             screen the fan becomes a pile, as above
//   side      in a two-sided section (a photo beside a list), the shorter side stays put while the longer side scrolls
//             past it; on a phone, where the sides sit one above the other, it scrolls as normal
// Pinning is plain CSS (position: sticky); a small script only works out where each one stops (under a header that
// stays at the top, or higher for a tall one). Without the script it stops at the very top.
const OPTIONS = [
  ['', 'Not pinned'],
  ['hold:50', 'Pinned for half a screen of scrolling'],
  ['hold:100', 'Pinned for one screen of scrolling'],
  ['hold:200', 'Pinned for two screens of scrolling'],
  ['hold:300', 'Pinned for three screens of scrolling'],
  ['cover', 'Stays put while the next sections slide over it'],
  ['stack', 'Its cards stack over each other as you scroll'],
  ['side', 'One side (the photo) stays put while the other side scrolls'],
  ['deck', 'Its cards make a pile: swipe, drag or press the arrows for the next card'],
  ['fan', 'Its cards fan out: point at a card (or tap it) to bring it forward'],
];
const IDS = OPTIONS.map(o => o[0]);

function clean(v) {
  return IDS.includes(v) ? v : '';
}
// the classes and style for the pinned element's wrapper
function attrs(v) {
  const p = clean(v);
  if (!p) return { cls: '', style: '' };
  if (p === 'cover') return { cls: ' sg-pin sg-pin-cover', style: '' };
  if (p === 'stack' || p === 'side' || p === 'deck' || p === 'fan') return { cls: ` sg-pin sg-pin-${p}`, style: '' };
  return { cls: ' sg-pin sg-pin-hold', style: `--pin-len: ${p.split(':')[1]}vh;` };
}

const CSS = [
  '.sg-pin{position:relative}',
  '.sg-pin:not(:has(> :not(script,style))){display:none}',
  // the room it holds for (a sticky element stays inside its parent's content box, so the room is a box, not padding)
  ".sg-pin-hold::after{content:'';display:block;height:var(--pin-len,100vh)}",
  '.sg-pin-hold > :not(script,style){position:sticky;top:var(--pin-top,0px)}',
  '.sg-pin-cover{position:sticky;top:var(--pin-top,0px);z-index:0}',
  // what comes after a "cover" pin slides over it; zero specificity, so a section's own background still wins
  ':where(main > .sg-pin-cover ~ *){position:relative;z-index:1;background-color:var(--page-bg,#fff)}',
  // stacked cards: one column, each stops a little lower than the one before (the script finds the cards)
  // (the layout itself is set on the boxes by the script, so it wins over a section's own layout rules)
  '.sg-stack > .sg-stack-card{box-shadow:0 -10px 34px rgba(15,23,42,.13)}',
  // a pile's or fan's cards: where each lies (set by the script as --dk-t, --dk-z, --dk-o; a reveal animation that
  // clears a card's own transform can't undo them)
  '.sg-deck-card{transform:var(--dk-t,none) !important;z-index:var(--dk-z,auto) !important;opacity:var(--dk-o,1) !important}',
  // the pile's arrows and count
  '.sg-deck-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin:4px auto 0;font-size:14px;color:inherit;opacity:.85}',
  '.sg-deck-nav button{width:44px;height:44px;border-radius:50%;border:1px solid currentColor;background:transparent;color:inherit;font-size:18px;cursor:pointer;line-height:1}',
  '.sg-deck-nav button:hover,.sg-deck-nav button:focus-visible{background:var(--primary,#2563eb);border-color:var(--primary,#2563eb);color:#fff}',
  '.sg-deck:focus-visible{outline:2px solid var(--primary,#2563eb);outline-offset:6px}',
].join('\n');

const SCRIPT = `(function () {
  var pins = document.querySelectorAll('.sg-pin'); if (!pins.length) return;
  var shown = function (c) { return !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && c.offsetHeight > 60 && c.offsetWidth > 120; };
  var there = function (c) { return !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && c.offsetWidth > 120; };
  var put = function (el, css) { for (var k in css) el.style.setProperty(k, css[k], 'important'); };
  var sig = function (c) { return c.tagName + '.' + String(c.getAttribute('class') || '').split(/\s+/)[0]; };
  // a sticky box stops working inside a box that hides its overflow; "clip" still hides it but lets sticky work
  function unclip(el, top) {
    for (; el && el !== top.parentElement; el = el.parentElement) { var o = getComputedStyle(el); if (o.overflow !== 'visible' || o.overflowY !== 'visible') el.style.overflow = 'clip'; }
  }
  var cards = [];
  // the cards: the box with the most look-alike children (2 or more), and the color behind them
  function findCards(p) {
    var best = null, bestN = 1;
    p.querySelectorAll('*').forEach(function (el) {
      var kids = Array.prototype.filter.call(el.children, shown); if (kids.length < 2) return;
      var s = sig(kids[0]); if (!kids.every(function (k) { return sig(k) === s; })) return;
      if (kids.length > bestN) { best = el; bestN = kids.length; }
    });
    if (!best) return null;
    var kids = Array.prototype.filter.call(best.children, shown);
    // a card that is see-through takes the color behind it, so the one under it doesn't show through
    var bg = 'transparent';
    for (var a = best; a && bg === 'transparent'; a = a.parentElement) { var c = getComputedStyle(a).backgroundColor; if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) bg = c; }
    if (bg === 'transparent') bg = getComputedStyle(document.body).backgroundColor || '#fff';
    kids.forEach(function (k) { var c = getComputedStyle(k).backgroundColor; if (!c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c)) k.style.backgroundColor = bg; });
    return { box: best, kids: kids };
  }
  // stack: each card sticks a little lower than the one before
  pins.forEach(function (p) {
    if (!p.classList.contains('sg-pin-stack')) return;
    var f = findCards(p); if (!f) return;
    var best = f.box, kids = f.kids;
    best.classList.add('sg-stack');
    put(best, { display: 'flex', 'flex-direction': 'column', gap: '28px' });
    kids.forEach(function (k, i) {
      k.classList.add('sg-stack-card');
      put(k, { position: 'sticky', top: 'calc(var(--pin-top, 0px) + ' + (20 + i * 26) + 'px)', width: 'auto', 'max-width': 'none', 'margin-left': '0', 'margin-right': '0', 'z-index': String(i + 1) });
    });
    unclip(best, p);
    cards = cards.concat(kids);
  });
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var still = function (k, yes) { if ('inert' in k) k.inert = yes; k.setAttribute('aria-hidden', yes ? 'true' : 'false'); };
  // deck: the cards in one pile; the top one is swiped, dragged or sent away with the arrows and goes to the back
  function deck(p, f) {
    var box = f.box, kids = f.kids, order = kids.slice(), n = kids.length, busy = false;
    box.classList.add('sg-deck'); kids.forEach(function (k) { k.classList.add('sg-deck-card'); });
    put(box, { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', gap: '0', 'max-width': '560px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-top': '56px', 'touch-action': 'pan-y', position: 'relative' });
    kids.forEach(function (k) {
      put(k, { 'grid-area': '1 / 1', width: 'auto', 'max-width': 'none', margin: '0', 'transform-origin': '50% 0', transition: calm ? 'none' : 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .35s ease', 'box-shadow': '0 10px 30px rgba(15,23,42,.16)', 'user-select': 'none' });
      k.querySelectorAll('img,video').forEach(function (m) { put(m, { 'max-height': '45vh', 'object-fit': 'cover' }); m.draggable = false; });
      // a card that is a link would start the browser's own drag instead of the swipe
      k.draggable = false; k.querySelectorAll('a').forEach(function (a) { a.draggable = false; });
      k.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
    // all the cards as tall as the tallest, so the ones underneath only show their edges
    function even() { kids.forEach(function (k) { k.style.removeProperty('min-height'); }); var h = 0; kids.forEach(function (k) { h = Math.max(h, k.offsetHeight); }); kids.forEach(function (k) { put(k, { 'min-height': h + 'px' }); }); }
    even(); addEventListener('load', even); addEventListener('resize', even);
    var nav = document.createElement('div'); nav.className = 'sg-deck-nav';
    nav.innerHTML = '<button type="button" aria-label="Previous card">&#8592;</button><span aria-live="polite"></span><button type="button" aria-label="Next card">&#8594;</button>';
    box.parentNode.insertBefore(nav, box.nextSibling);
    var count = nav.querySelector('span');
    function lay() {
      order.forEach(function (k, i) {
        var d = Math.min(i, 3), turn = i ? (i % 2 ? 1 : -1) * (1 + d * 0.8) : 0;
        k.style.setProperty('--dk-z', String(n - i));
        k.style.setProperty('--dk-t', i ? 'translateY(' + (-d * 16) + 'px) scale(' + (1 - d * 0.04) + ') rotate(' + turn + 'deg)' : 'none');
        k.style.setProperty('--dk-o', i > 3 ? '0' : '1');
        still(k, i > 0);
      });
      count.textContent = (kids.indexOf(order[0]) + 1) + ' / ' + n;
    }
    // the top card leaves to one side, then goes to the bottom of the pile
    function deal(dir) {
      if (busy) return; busy = true;
      var top = order[0];
      top.style.setProperty('--dk-t', 'translateX(' + (dir * 120) + '%) rotate(' + (dir * 14) + 'deg)');
      top.style.setProperty('--dk-o', '0');
      setTimeout(function () { order.push(order.shift()); lay(); busy = false; }, calm ? 0 : 320);
    }
    function back() { if (busy) return; order.unshift(order.pop()); lay(); }
    nav.firstChild.addEventListener('click', back);
    nav.lastChild.addEventListener('click', function () { deal(1); });
    box.tabIndex = 0; box.setAttribute('aria-roledescription', 'card pile');
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); deal(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); } });
    // drag or swipe the top card: far enough and it is dealt, otherwise it settles back
    var x0 = null, dx = 0, id = null, moved = false;
    box.addEventListener('pointerdown', function (e) {
      if (busy || !order[0].contains(e.target) || (e.pointerType === 'mouse' && e.button)) return;
      x0 = e.clientX; dx = 0; id = e.pointerId; moved = false;
    });
    box.addEventListener('pointermove', function (e) {
      if (x0 === null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 8) { moved = true; try { box.setPointerCapture(id); } catch (x) {} order[0].style.setProperty('transition', 'none', 'important'); }
      if (moved) order[0].style.setProperty('--dk-t', 'translateX(' + dx + 'px) rotate(' + (dx / 18) + 'deg)');
    });
    function up() {
      if (x0 === null) return;
      x0 = null; var top = order[0];
      top.style.setProperty('transition', calm ? 'none' : 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .35s ease', 'important');
      if (moved && Math.abs(dx) > 80) deal(dx > 0 ? 1 : -1); else if (moved) lay();
    }
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    // a drag is not a click on a link or button in the card
    box.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    unclip(box, p);
    lay();
  }
  // fan: the cards overlap in a row, turned a little like a hand of cards; the one pointed at (or tapped) comes forward
  function fan(p, f) {
    var box = f.box, kids = f.kids, n = kids.length, w = box.clientWidth;
    var cw = Math.min(300, Math.max(180, w * 0.3)), over = Math.max(40, (n * cw - w * 0.8) / (n - 1));
    box.classList.add('sg-fan'); kids.forEach(function (k) { k.classList.add('sg-deck-card'); });
    put(box, { display: 'flex', 'flex-wrap': 'nowrap', 'justify-content': 'center', 'align-items': 'flex-start', gap: '0', 'padding-top': '30px', 'padding-bottom': '20px' });
    var up = -1;
    function lay() {
      kids.forEach(function (k, i) {
        var mid = i - (n - 1) / 2, lift = i === up;
        var shift = up < 0 || lift ? 0 : (i < up ? -1 : 1) * Math.min(36, over * 0.4);
        k.style.setProperty('--dk-t', lift ? 'translateY(-26px) scale(1.06)' : 'translateX(' + shift + 'px) translateY(' + Math.abs(mid) * 10 + 'px) rotate(' + mid * 4 + 'deg)');
        k.style.setProperty('--dk-z', lift ? '99' : String(i + 1));
      });
    }
    kids.forEach(function (k, i) {
      put(k, { flex: '0 0 ' + cw + 'px', width: cw + 'px', 'max-width': 'none', 'margin-left': i ? -over + 'px' : '0', 'margin-right': '0', position: 'relative', 'transform-origin': '50% 100%', transition: calm ? 'none' : 'transform .35s cubic-bezier(.2,.8,.2,1)', 'box-shadow': '0 10px 30px rgba(15,23,42,.18)' });
      k.querySelectorAll('img,video').forEach(function (m) { put(m, { 'max-height': '40vh', 'object-fit': 'cover' }); });
      k.addEventListener('mouseenter', function () { up = i; lay(); });
      k.addEventListener('focusin', function () { up = i; lay(); });
      // on a touch screen the first tap brings a card forward; a tap on the card in front goes on to its link
      k.addEventListener('click', function (e) { if (up !== i) { e.preventDefault(); up = i; lay(); } });
    });
    box.addEventListener('mouseleave', function () { up = -1; lay(); });
    unclip(box, p);
    lay();
  }
  pins.forEach(function (p) {
    var isDeck = p.classList.contains('sg-pin-deck'), isFan = p.classList.contains('sg-pin-fan');
    if (!isDeck && !isFan) return;
    var f = findCards(p); if (!f) return;
    if (isFan && f.box.clientWidth >= 700) fan(p, f); else deck(p, f);
  });
  // a card with a photo and words: on a wide screen the photo sits beside the words (as in a pile of cards); the photo
  // is never taller than about half the screen, so the next card's top is always in sight
  function shape() {
    cards.forEach(function (k) {
      var kids = Array.prototype.filter.call(k.children, there), wide = k.offsetWidth >= 720;
      var pic = kids.length === 2 && kids.filter(function (x) { return /^(IMG|PICTURE|VIDEO|FIGURE)$/.test(x.tagName) || (x.querySelector('img,video') && !x.textContent.trim()); })[0];
      k.querySelectorAll('img,video').forEach(function (m) { put(m, { 'max-height': '55vh', 'object-fit': 'cover' }); });
      if (pic && wide) {
        put(k, { display: 'grid', 'grid-template-columns': '1fr 1fr', 'align-items': 'stretch' });
        put(pic, { height: '100%', 'min-height': '260px', 'aspect-ratio': 'auto', width: '100%', 'object-fit': 'cover' });
        var words = kids[0] === pic ? kids[1] : kids[0]; put(words, { 'align-self': 'center' });
      } else ['display', 'grid-template-columns', 'align-items'].forEach(function (x) { k.style.removeProperty(x); });
    });
  }
  shape();
  // side: the two-sided box (two children next to each other) whose sides differ most in height; the shorter one holds
  function sides() {
    pins.forEach(function (p) {
      if (!p.classList.contains('sg-pin-side')) return;
      p.querySelectorAll('.sg-side-hold').forEach(function (el) { el.classList.remove('sg-side-hold'); ['position', 'top', 'align-self'].forEach(function (k) { el.style.removeProperty(k); }); });
      var best = null, diff = 120;
      p.querySelectorAll('*').forEach(function (el) {
        var kids = Array.prototype.filter.call(el.children, there); if (kids.length !== 2) return;
        var a = kids[0].getBoundingClientRect(), b = kids[1].getBoundingClientRect();
        if (Math.abs(a.left - b.left) < 40 || a.right > b.left + 8 && b.right > a.left + 8) return;   // one above the other
        var d = Math.abs(a.height - b.height); if (d > diff) { diff = d; best = a.height < b.height ? kids[0] : kids[1]; }
      });
      if (best) { best.classList.add('sg-side-hold'); put(best, { position: 'sticky', top: 'calc(var(--pin-top, 0px) + 20px)', 'align-self': 'flex-start' }); unclip(best.parentElement, p); }
    });
  }
  sides();
  function gap() {
    var n = document.getElementById('siteNav'); if (!n) return 0;
    var cs = getComputedStyle(n), r = n.getBoundingClientRect();
    return (cs.position === 'fixed' || cs.position === 'sticky') && r.height < innerHeight / 3 ? r.height : 0;
  }
  function place() {
    var g = gap();
    pins.forEach(function (p) {
      if (!p.classList.contains('sg-pin-hold') && !p.classList.contains('sg-pin-cover')) { p.style.setProperty('--pin-top', g + 'px'); return; }
      var el = p.classList.contains('sg-pin-cover') ? p : p.firstElementChild; if (!el) return;
      var h = el.getBoundingClientRect().height;
      // a tall one stops with its bottom at the bottom of the screen, so all of it has been seen
      p.style.setProperty('--pin-top', Math.min(g, innerHeight - h) + 'px');
    });
  }
  var raf = 0, ask = function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); };
  // a header that only sticks once the page moves changes where pins stop, so this is checked on scroll too
  var sideT = 0; addEventListener('resize', function () { clearTimeout(sideT); sideT = setTimeout(function () { shape(); sides(); }, 150); });
  addEventListener('load', sides);
  // a photo that loads later (lazy) changes which side is shorter
  pins.forEach(function (p) { if (p.classList.contains('sg-pin-side')) p.addEventListener('load', function () { clearTimeout(sideT); sideT = setTimeout(sides, 150); }, true); });
  place(); addEventListener('load', ask); (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); })(place);
})();`;

module.exports = { OPTIONS, IDS, clean, attrs, CSS, SCRIPT };
