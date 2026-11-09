// Shorter help text (Leo, 2026-11-07: "make the interface more user friendly"). A long grey help note under a control
// (p.muted, or any element marked data-sg-help) shows only its first sentence; a "More" link opens the rest and
// "Less" folds it again. Short notes, notes with buttons or fields in them, and notes marked data-sg-help="full" are
// left alone. Pure helper (split) exported for the tests; the page part runs only in a browser.
(function (root) {
  'use strict';
  var LONG = 200;
  // [first sentence, the rest] of a text, or null when it is short enough to show whole
  function split(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= LONG) return null;
    var m = /^(.{40,260}?[.!?:])\s+(?=["“(A-Z0-9])/.exec(t);
    if (!m) return null;
    return [m[1], t.slice(m[0].length)];
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { split: split, LONG: LONG };
  if (typeof document === 'undefined') return;

  function fold(p) {
    if (p.dataset.sgFold || p.getAttribute('data-sg-help') === 'full') return;
    if (p.querySelector('input, select, textarea, button, details, img, svg')) return;
    var parts = split(p.textContent); p.dataset.sgFold = '1'; if (!parts) return;
    // keep the note's own markup (links, bold words) in the folded part: move the nodes after the first sentence
    // find where the first sentence ends in the note's own text nodes (counting characters the way split() sees them:
    // runs of spaces as one, none at the start)
    var want = parts[0].length, count = 0, ws = true, cut = null, off = 0, n;
    var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    while (!cut && (n = walker.nextNode())) {
      var tx = n.textContent;
      for (var i = 0; i < tx.length; i++) {
        var sp = /\s/.test(tx[i]);
        if (sp && ws) continue;
        ws = sp; count++;
        if (count === want) { cut = n; off = i + 1; break; }
      }
    }
    if (!cut) return;
    var rest = document.createElement('span'); rest.className = 'sg-help-rest'; rest.hidden = true;
    var tail = cut.splitText(Math.min(off, cut.textContent.length));
    // everything after the cut point, at any depth, moves into the folded part (its parent elements are kept)
    var range = document.createRange(); range.setStartBefore(tail); range.setEndAfter(p.lastChild);
    rest.appendChild(range.extractContents());
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sg-help-more'; btn.textContent = 'More'; btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var open = rest.hidden; rest.hidden = !open; btn.textContent = open ? 'Less' : 'More'; btn.setAttribute('aria-expanded', String(open)); });
    p.appendChild(document.createTextNode(' ')); p.appendChild(rest); p.appendChild(btn);
  }
  function scan(el) {
    if (!el.querySelectorAll) return;
    if (el.matches && el.matches('p.muted, [data-sg-help]')) fold(el);
    el.querySelectorAll('p.muted, [data-sg-help]').forEach(fold);
  }
  function start() {
    if (!document.getElementById('sg-help-css')) {
      var st = document.createElement('style'); st.id = 'sg-help-css';
      st.textContent = '.sg-help-more { all: unset; margin-left: 4px; color: var(--primary, #2563eb); font-weight: 600; cursor: pointer; white-space: nowrap; } .sg-help-more:hover, .sg-help-more:focus-visible { text-decoration: underline; } .sg-help-rest[hidden] { display: none !important; }';
      document.head.appendChild(st);
    }
    scan(document);
    // rows added later (a new block, a copied section) and templates once used
    new MutationObserver(function (list) { list.forEach(function (m) { m.addedNodes.forEach(function (x) { if (x.nodeType === 1 && !(x.classList && (x.classList.contains('sg-help-rest') || x.classList.contains('sg-help-more')))) scan(x); }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
