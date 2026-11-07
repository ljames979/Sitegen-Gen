// Faster editor (Leo, 2026-11-07): long menus repeated on every block (background, cards, page, pin) are written
// once in a <template id="sg-lazy-KEY">; each block's <select data-sg-lazy="KEY"> holds only its current choice
// until someone opens it, focuses it or a script needs it. Filling keeps the choice (a pick that is not in the list,
// like a gradient-library one, stays under "Gradient library"). Saving is unchanged: the menu always has its value.
(function () {
  'use strict';
  if (window.sgLazyFill) return;
  function fill(sel) {
    if (!sel || !sel.dataset || !sel.dataset.sgLazy || sel.dataset.sgLazyDone) return;
    var tpl = document.getElementById('sg-lazy-' + sel.dataset.sgLazy); if (!tpl) return;
    var src = tpl.content.querySelector('select'); if (!src) return;
    var cur = sel.value, curText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : cur;
    sel.dataset.sgLazyDone = '1';
    sel.innerHTML = src.innerHTML;
    if (!Array.prototype.some.call(sel.options, function (o) { return o.value === cur; })) {
      var g = document.createElement('optgroup'); g.label = 'Gradient library'; g.dataset.glib = '1';
      var o = document.createElement('option'); o.value = cur; o.textContent = curText; g.appendChild(o); sel.appendChild(g);
    }
    sel.value = cur;
  }
  window.sgLazyFill = fill;
  window.sgLazyFillIn = function (root) { (root.querySelectorAll ? root.querySelectorAll('select[data-sg-lazy]') : []).forEach(fill); };
  // fill just before the menu opens (mouse, touch or keyboard)
  ['mousedown', 'touchstart', 'focusin', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { var t = e.target; if (t && t.matches && t.matches('select[data-sg-lazy]')) fill(t); }, true);
  });
  // a script that sets a lazy menu's value (or reads its choices) fills it first
  var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (desc && desc.set) Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true, enumerable: desc.enumerable, get: desc.get,
    set: function (v) { if (this.dataset && this.dataset.sgLazy && !this.dataset.sgLazyDone && String(v) !== desc.get.call(this)) fill(this); desc.set.call(this, v); }
  });
})();
