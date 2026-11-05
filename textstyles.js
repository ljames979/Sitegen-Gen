// Style any text (Leo, 2026-10-31: "full control to edit or move any lettering"): in the editor's "Style text" mode the
// owner clicks any words on the page (a heading, a line, a label, a button, the footer ...) and sets their size, font,
// color, bold and italic, moves them, or types new words; or picks a few words inside and styles just those.
// Nothing here depends on which box in the panel the words came from, so it works on every design.
//
// How a piece of text is found again: as the page loads (before any effect touches it), SCRIPT gives every text
// element a name, data-sg-te="<part>|<tag><n>": the part of the page it is in (named as text boxes name it, see
// public/sg-fx.js sgText) and its place among the text elements of that part. The editor reads that name off the
// clicked element, so the editor and the page always agree. If the design or content changes so much that the name
// now points at other words, a change of words (which remembers the words it replaced) simply stops applying.
//
// Saved with the editor (hidden box tstyles_json) as sections.texts.styles:
//   { id, page, el, phrase, n, text, orig, size, font, color, bold, italic, dx, dy, w, h }
//   phrase + n: just those words (their n-th time in the element); text + orig: new words for the whole element;
//   size in px (shrinks on phones: narrower than 760px), dx/dy: moved by that many px (shrinks with the size), bold/italic: true,
//   false or null (as the design has it)
//   w / h: the box the words sit in, stretched by its handles (Leo, 2026-11-05: "stretch out the box the words are in" so
//   long words fit): width and least height in px at full size, shrinking on phones like the size; whole elements only
const fonts = require('./fonts');

const MAX = 300;
const ID = /^s[a-z0-9]{7}$/;
const PAGE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;
const EL = /^[^<>"'`\\]{1,160}\|[a-z][a-z0-9]{0,9}\d{1,4}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const NAMED = ['brand', 'accent', 'white', 'dark'];
const COLORS = { brand: 'var(--primary)', accent: 'var(--accent)', white: '#ffffff', dark: '#111827' };
const words = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[<>]/g, '').slice(0, n);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
const fontOk = (n) => typeof n === 'string' && (fonts.FONTS.some(f => f.name === n) || (/^[A-Z][A-Za-z0-9]*( [A-Z0-9][A-Za-z0-9]*)*$/.test(n) && !!fonts.cleanFontName(n)));
const tri = (v) => (v === true || v === false ? v : null);

function cleanOne(t) {
  if (!t || typeof t !== 'object' || !ID.test(String(t.id || '')) || !PAGE.test(String(t.page || '')) || !EL.test(String(t.el || ''))) return null;
  const color = String(t.color || '');
  const o = { id: t.id, page: String(t.page), el: String(t.el) };
  const phrase = words(t.phrase, 300);
  if (phrase.trim()) { o.phrase = phrase; o.n = int(t.n, 0, 50); }
  else if (t.text != null && String(t.orig || '').trim()) { o.text = words(t.text, 2000); o.orig = words(t.orig, 2000); }
  o.size = t.size ? int(t.size, 8, 200) : 0;
  o.font = fontOk(t.font) ? fonts.cleanFontName(t.font) : '';
  o.color = HEX.test(color) ? color.toLowerCase() : NAMED.includes(color) ? color : '';
  o.bold = tri(t.bold); o.italic = tri(t.italic);
  o.dx = o.phrase ? 0 : int(t.dx, -2000, 2000); o.dy = o.phrase ? 0 : int(t.dy, -2000, 2000);
  o.w = o.phrase || !t.w ? 0 : int(t.w, 40, 2400); o.h = o.phrase || !t.h ? 0 : int(t.h, 16, 1600);
  // nothing left to do: not kept
  if (!o.size && !o.font && !o.color && o.bold === null && o.italic === null && !o.dx && !o.dy && !o.w && !o.h && o.text === undefined) return null;
  return o;
}

// The list as saved: only well-formed changes, each id once, one whole-element change per element, 300 at most
function clean(list) {
  const seen = new Set(), whole = new Set();
  return ([]).concat(Array.isArray(list) ? list : []).map(cleanOne).filter(t => {
    if (!t || seen.has(t.id)) return false;
    seen.add(t.id);
    if (!t.phrase) { const k = t.page + ' ' + t.el; if (whole.has(k)) return false; whole.add(k); }
    return true;
  }).slice(0, MAX);
}
function fromBody(v) {
  try { return clean(JSON.parse(String(v || '[]'))); } catch (e) { return []; }
}
function forPage(site, page) {
  return clean((((site || {}).sections || {}).texts || {}).styles).filter(t => t.page === page);
}
// The CSS for one change (numbers and names come from clean, so they are safe to write into the page)
function css(t) {
  const out = [];
  if (t.size) out.push(`font-size:min(${t.size}px,max(${Math.min(t.size, 13)}px,${+(t.size / 7.6).toFixed(3)}vw))!important`, 'line-height:1.12');
  if (t.font) out.push(`font-family:'${t.font}',var(--heading-font,inherit)!important`);
  if (t.color) out.push(`color:${COLORS[t.color] || t.color}!important`, '-webkit-text-fill-color:currentColor', 'background-image:none');
  if (t.bold !== null) out.push(`font-weight:${t.bold ? 700 : 400}!important`);
  if (t.italic !== null) out.push(`font-style:${t.italic ? 'italic' : 'normal'}!important`);
  if (t.dx || t.dy) out.push(`translate:calc(${t.dx} * min(1px,.1316vw)) calc(${t.dy} * min(1px,.1316vw))`);
  // a stretched box: never wider than the screen, so a wide box on a phone still fits
  if (t.w) out.push(`width:min(${t.w}px,${+(t.w / 7.6).toFixed(3)}vw,calc(100vw - 24px))!important`, 'max-width:none!important', 'flex-shrink:0!important', 'box-sizing:border-box!important');
  if (t.h) out.push(`min-height:min(${t.h}px,${+(t.h / 7.6).toFixed(3)}vw)!important`, 'height:auto!important');
  return out.join(';');
}
function fontLink(list) {
  const used = [...new Set(list.map(t => t.font).filter(Boolean))];
  return used.length ? 'https://fonts.googleapis.com/css2?' + used.map(n => fonts.familyParam(n)).join('&') + '&display=swap' : '';
}
// What the page carries: each change with its CSS worked out
function data(list) {
  return JSON.stringify(list.map(t => Object.assign({}, t, { css: css(t) }))).replace(/</g, '\\u003c');
}

// Runs as the page loads, right after the footer (so before any effect splits or copies the words): names the text
// elements, then applies the changes. window.sgTs lets the editor name a clicked element and redraw the changes live.
const SCRIPT = `(function () {
  var d = document, TAGS = /^(H[1-6]|P|LI|A|BUTTON|BLOCKQUOTE|FIGCAPTION|LABEL|DT|DD|TD|TH|SMALL|STRONG|EM|B|I|SPAN|DIV|Q|CITE|TIME|ADDRESS|LEGEND|SUMMARY)$/;
  var parts = function () {
    var m = d.querySelector('main'), out = m ? Array.prototype.slice.call(m.children) : [];
    var f = d.querySelector('body > footer'); if (f) out.push(f);
    return out.filter(function (n) { return !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(n.tagName) && !n.classList.contains('sg-tx-src'); });
  };
  var base = function (el) {
    var b = el.matches('[data-sg-bid]') ? el : el.querySelector('[data-sg-bid]'); if (b) return 'b:' + b.getAttribute('data-sg-bid');
    if (el.id) return '#' + el.id;
    var f = el.matches('[data-sg-fam]') ? el : el.querySelector('[data-sg-fam]'); if (f) return 'f:' + f.getAttribute('data-sg-fam');
    var c = (el.getAttribute('class') || '').split(/\\s+/)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  // a text element: one of the tags above with words of its own (not only inside other elements)
  var own = function (el) { for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\\S/.test(c.nodeValue)) return true; return false; };
  var name = function () {
    var seen = {};
    parts().forEach(function (p) {
      var k = base(p), n = seen[k] = (seen[k] || 0) + 1, key = n > 1 ? k + '~' + (n - 1) : k, count = {};
      Array.prototype.forEach.call(p.querySelectorAll('*'), function (el) {
        if (!TAGS.test(el.tagName) || el.hasAttribute('data-sg-te') || el.closest('[aria-hidden="true"], .sg-tx, script, style, svg') || !own(el)) return;
        var t = el.tagName.toLowerCase(); count[t] = (count[t] || 0) + 1;
        el.setAttribute('data-sg-te', key + '|' + t + count[t]);
      });
    });
  };
  var esc = function (s) { return s.replace(/["\\\\]/g, '\\\\$&'); };
  // the n-th time the words come up in the element: wrapped in a span that carries their style
  var wrap = function (el, t) {
    var walker = d.createTreeWalker(el, 4), nodes = [], text = '', x;
    while ((x = walker.nextNode())) { if (x.parentNode.closest('[aria-hidden="true"]')) continue; nodes.push([x, text.length]); text += x.nodeValue; }
    var at = -1; for (var i = 0; i <= t.n; i++) { at = text.indexOf(t.phrase, at + 1); if (at < 0) return; }
    var end = at + t.phrase.length;
    nodes.forEach(function (p) {
      var node = p[0], s = Math.max(at, p[1]), e = Math.min(end, p[1] + node.nodeValue.length);
      if (s >= e) return;
      var r = d.createRange(); r.setStart(node, s - p[1]); r.setEnd(node, e - p[1]);
      var sp = d.createElement('span'); sp.className = 'sg-ts'; sp.setAttribute('data-sg-ts', t.id); sp.style.cssText = t.css;
      try { r.surroundContents(sp); } catch (er) {}
    });
  };
  var apply = function (list) {
    // (only the spans: the script tag that holds this code carries data-sg-ts too, and unwrapping it left this code as
    // visible text at the bottom of the page)
    // undo what was drawn before: words put back, spans taken out
    Array.prototype.forEach.call(d.querySelectorAll('span[data-sg-ts]'), function (s) { var p = s.parentNode; while (s.firstChild) p.insertBefore(s.firstChild, s); p.removeChild(s); p.normalize(); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-sg-te-orig]'), function (el) { el.textContent = el.getAttribute('data-sg-te-orig'); el.removeAttribute('data-sg-te-orig'); });
    var rules = [], sel = function (t) { return '[data-sg-te="' + esc(t.el) + '"]'; };
    list = list || [];
    // new words first, then the styles (so words picked inside new words find them)
    list.forEach(function (t) {
      if (t.text == null) return;
      Array.prototype.forEach.call(d.querySelectorAll(sel(t)), function (el) {
        if (el.textContent.replace(/\\s+/g, ' ').trim() !== t.orig.replace(/\\s+/g, ' ').trim()) return;
        el.setAttribute('data-sg-te-orig', el.textContent); el.textContent = t.text;
      });
    });
    list.forEach(function (t) {
      var els = d.querySelectorAll(sel(t));
      if (!els.length) return;
      if (t.phrase) { Array.prototype.forEach.call(els, function (el) { wrap(el, t); }); return; }
      if (t.css) rules.push(sel(t) + '{' + t.css + '}');
      // words that sit in a line (a link, a few words) can only be moved or stretched as a block of their own
      if ((t.dx || t.dy || t.w || t.h) && /^(A|SPAN|STRONG|EM|B|I|SMALL|Q|CITE|TIME|LABEL)$/.test(els[0].tagName)) rules.push(sel(t) + '{display:inline-block}');
    });
    var st = d.getElementById('sg-ts-css');
    if (!st) { st = d.createElement('style'); st.id = 'sg-ts-css'; d.head.appendChild(st); }
    st.textContent = rules.join('\\n');
  };
  name();
  var src = d.getElementById('sg-ts-data'), list = [];
  try { list = JSON.parse(src ? src.textContent : '[]'); } catch (e) {}
  apply(list);
  window.sgTs = { name: name, apply: apply, parts: parts };
})();`;

module.exports = { clean, fromBody, forPage, css, fontLink, data, SCRIPT, MAX };
