// Language switch (sitekit.js): swaps the page's words into the site's second language and back, in the visitor's
// browser. The owner's word pairs come in #sg-lang-data ({ code, first, second, words: { English: translation } }).
// Every piece of text, button, placeholder, picture description and the page title whose words match a pair is
// swapped; anything without a pair stays as it is. The choice is remembered (localStorage sg-lang) and ?lang=es in the
// address picks it too. Words added to the page later (moved text boxes, opened menus) are swapped as they arrive.
(function () {
  var el = document.getElementById('sg-lang-data');
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent || '{}'); } catch (e) { return; }
  if (!data || !data.code || !data.words) return;
  var norm = function (s) { return String(s).replace(/\s+/g, ' ').trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"'); };
  var dict = {};
  Object.keys(data.words).forEach(function (k) { dict[norm(k)] = data.words[k]; dict[norm(k).toLowerCase()] = dict[norm(k).toLowerCase()] || data.words[k]; });
  var look = function (s) { var n = norm(s); return n ? (dict[n] || dict[n.toLowerCase()] || null) : null; };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, svg: 1, SVG: 1, TEMPLATE: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  var texts = [], attrs = [];   // what was swapped, to put back
  var on = false, title0 = document.title, lang0 = document.documentElement.getAttribute('lang') || 'en';
  var meta = document.querySelector('meta[name="description"]'), meta0 = meta ? meta.getAttribute('content') : '';

  function swapText(node) {
    if (node.__sgLang) return;
    var v = node.nodeValue, t = look(v);
    if (!t) return;
    var lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
    node.__sgLang = v;
    node.nodeValue = lead + t + tail;
    texts.push(node);
  }
  function swapAttrs(elx) {
    ATTRS.forEach(function (a) {
      if (!elx.hasAttribute(a)) return;
      var key = '__sgLang_' + a;
      if (elx[key] !== undefined) return;
      var t = look(elx.getAttribute(a));
      if (!t) return;
      elx[key] = elx.getAttribute(a);
      elx.setAttribute(a, t);
      attrs.push([elx, a]);
    });
    if (elx.tagName === 'INPUT' && /^(submit|button)$/i.test(elx.type) && elx.__sgLang_value === undefined) {
      var t = look(elx.value);
      if (t) { elx.__sgLang_value = elx.value; elx.value = t; attrs.push([elx, 'value']); }
    }
  }
  function walk(root) {
    if (!root || (root.nodeType === 1 && (SKIP[root.tagName] || root.closest('[data-sg-lang-skip]')))) return;
    if (root.nodeType === 3) { if (root.parentNode && !SKIP[root.parentNode.tagName]) swapText(root); return; }
    if (root.nodeType !== 1) return;
    swapAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return SKIP[n.tagName] || n.hasAttribute('data-sg-lang-skip') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) swapText(n); else swapAttrs(n); }
  }
  function undo() {
    texts.forEach(function (n) { if (n.__sgLang !== undefined) { n.nodeValue = n.__sgLang; delete n.__sgLang; } });
    attrs.forEach(function (p) { var k = '__sgLang_' + p[1]; if (p[0][k] !== undefined) { if (p[1] === 'value') p[0].value = p[0][k]; else p[0].setAttribute(p[1], p[0][k]); delete p[0][k]; } });
    texts = []; attrs = [];
  }
  var mo = window.MutationObserver ? new MutationObserver(function (list) {
    if (!on) return;
    list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, walk); });
  }) : null;

  function set(second, keep) {
    on = !!second;
    if (on) {
      walk(document.body);
      var tt = look(title0); document.title = tt || title0;
      if (meta) meta.setAttribute('content', look(meta0) || meta0);
      document.documentElement.setAttribute('lang', data.code);
      if (mo) mo.observe(document.body, { childList: true, subtree: true });
    } else {
      if (mo) mo.disconnect();
      undo();
      document.title = title0;
      if (meta) meta.setAttribute('content', meta0);
      document.documentElement.setAttribute('lang', lang0);
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-sg-lang]'), function (b) {
      var mine = b.getAttribute('data-sg-lang') === (on ? data.code : 'en');
      b.setAttribute('aria-pressed', mine ? 'true' : 'false');
    });
    if (keep) { try { localStorage.setItem('sg-lang', on ? data.code : 'en'); } catch (e) { /* private mode */ } }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sg-lang]');
    if (!b) return;
    e.preventDefault();
    set(b.getAttribute('data-sg-lang') !== 'en', true);
  });
  var want = '';
  try { want = (new URLSearchParams(location.search)).get('lang') || localStorage.getItem('sg-lang') || ''; } catch (e) { want = ''; }
  // the editor's own preview always opens in the first language, so typing on the page edits the English words
  var start = function () { if (want === data.code && !(document.body.hasAttribute('data-sg-pv') && !/[?&]lang=/.test(location.search))) set(true, false); else set(false, false); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.sgLang = { set: function (second) { set(second, true); }, look: look };
})();
