// Site kit panel in the editor (sitekit.js has the rules; views/_site-kit.ejs the fields). Keeps the hidden box kit_json
// in step with the panel and asks the editor to save (its autosave listens for input on the form). "Find words on my
// pages" reads the site's own preview pages and adds every piece of text that has no pair yet.
(function () {
  'use strict';
  var box = document.getElementById('skJson'), panel = document.getElementById('siteKitBlock');
  if (!box || !panel) return;
  var state;
  try { state = JSON.parse(box.value || '{}'); } catch (e) { state = {}; }
  state.langs = state.langs || { on: false, code: 'es', first: 'EN', second: 'ES', words: [] };
  state.langs.words = state.langs.words || [];
  state.button = state.button || { text: '', url: '', newTab: false };
  state.apps = state.apps || { on: false, ios: '', android: '' };
  state.blockPages = state.blockPages || [];
  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return String(s).replace(/\s+/g, ' ').trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"'); };
  var SHOW = 200;

  function save() {
    box.value = JSON.stringify(state);
    box.dispatchEvent(new Event('change', { bubbles: true }));
    var form = document.getElementById('editorForm'); if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
  }
  var bind = function (id, set, ev) { var e = $(id); if (e) e.addEventListener(ev || 'input', function () { set(e); save(); }); };
  bind('skBtnText', function (e) { state.button.text = e.value; });
  bind('skBtnUrl', function (e) { state.button.url = e.value.trim(); });
  bind('skBtnNew', function (e) { state.button.newTab = e.checked; }, 'change');
  bind('skPhoneMenu', function (e) { state.phoneMenu = e.checked; }, 'change');
  bind('skApps', function (e) { state.apps.on = e.checked; }, 'change');
  bind('skIos', function (e) { state.apps.ios = e.value.trim(); });
  bind('skAndroid', function (e) { state.apps.android = e.value.trim(); });
  bind('skTiktok', function (e) { state.tiktok = e.value.trim(); });
  bind('skLangOn', function (e) { state.langs.on = e.checked; }, 'change');
  bind('skLangCode', function (e) { state.langs.code = e.value; }, 'change');
  bind('skLangFirst', function (e) { state.langs.first = e.value; });
  bind('skLangSecond', function (e) { state.langs.second = e.value; });
  Array.prototype.forEach.call(panel.querySelectorAll('.sk-page'), function (c) {
    c.addEventListener('change', function () {
      state.blockPages = Array.prototype.filter.call(panel.querySelectorAll('.sk-page'), function (x) { return x.checked; }).map(function (x) { return x.value; });
      save();
    });
  });

  // ---- word pairs ----
  var list = $('skWords'), filter = $('skFilter'), missing = $('skMissing'), count = $('skCount');
  function draw() {
    var q = norm(filter.value || '').toLowerCase(), onlyMiss = missing.checked, shown = 0, miss = 0;
    list.textContent = '';
    state.langs.words.forEach(function (p, i) {
      if (!p[1]) miss++;
      if (onlyMiss && p[1]) return;
      if (q && (p[0] + ' ' + p[1]).toLowerCase().indexOf(q) < 0) return;
      if (shown++ >= SHOW) return;
      var row = document.createElement('div');
      row.className = 'sk-pair' + (p[1] ? '' : ' sk-miss');
      var a = document.createElement('textarea'), b = document.createElement('textarea'), x = document.createElement('button');
      a.value = p[0]; a.setAttribute('aria-label', 'English words'); a.maxLength = 1500;
      b.value = p[1]; b.setAttribute('aria-label', 'Translation'); b.placeholder = 'Translation'; b.maxLength = 1500;
      x.type = 'button'; x.className = 'btn-secondary'; x.textContent = '✕'; x.title = 'Remove this pair';
      a.addEventListener('input', function () { p[0] = a.value; save(); });
      b.addEventListener('input', function () { p[1] = b.value; row.classList.toggle('sk-miss', !b.value); save(); });
      x.addEventListener('click', function () { state.langs.words.splice(i, 1); save(); draw(); });
      row.appendChild(a); row.appendChild(b); row.appendChild(x);
      list.appendChild(row);
    });
    count.textContent = state.langs.words.length + ' pairs, ' + miss + ' without a translation' + (shown > SHOW ? '. Showing the first ' + SHOW + ': search to find the others.' : '.');
  }
  filter.addEventListener('input', draw);
  missing.addEventListener('change', draw);
  $('skAdd').addEventListener('click', function () { state.langs.words.unshift(['', '']); filter.value = ''; missing.checked = false; save(); draw(); var t = list.querySelector('textarea'); if (t) t.focus(); });

  // words on a page as the visitor's browser compares them
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, TEMPLATE: 1, svg: 1, SVG: 1 };
  var keep = function (t) { return t && /\p{L}/u.test(t) && t.length <= 1500 && !/^(https?:|mailto:|tel:|\/)\S*$/.test(t) && !/^Preview mode/.test(t); };
  function collect(doc, out) {
    var add = function (t) { t = norm(t); if (keep(t)) out.push(t); };
    add(doc.title);
    var m = doc.querySelector('meta[name="description"]'); if (m) add(m.getAttribute('content'));
    var walk = function (n) {
      if (n.nodeType === 3) { add(n.nodeValue); return; }
      if (n.nodeType !== 1 || SKIP[n.tagName] || n.hasAttribute('data-sg-lang-skip')) return;
      ['placeholder', 'aria-label', 'alt', 'title'].forEach(function (a) { if (n.hasAttribute(a)) add(n.getAttribute(a)); });
      if (n.tagName === 'INPUT' && /^(submit|button)$/i.test(n.type || '')) add(n.value);
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
    };
    if (doc.body) walk(doc.body);
  }
  $('skFind').addEventListener('click', function () {
    var btn = this, site = panel.getAttribute('data-site');
    var pages = [''].concat(['about', 'services', 'testimonials', 'whyChoose', 'gallery', 'faq', 'blog', 'hours', 'contact', 'privacy', 'terms', 'thank-you'].map(function (k) { return '/' + k; }));
    btn.disabled = true; btn.textContent = 'Reading your pages…';
    var found = [];
    Promise.all(pages.map(function (p) {
      return fetch('/sites/' + site + '/preview' + p + '?bar=0', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
        if (html) collect(new DOMParser().parseFromString(html, 'text/html'), found);
      }).catch(function () {});
    })).then(function () {
      var have = {}; state.langs.words.forEach(function (p) { have[norm(p[0]).toLowerCase()] = 1; });
      var added = 0;
      found.forEach(function (t) { var k = t.toLowerCase(); if (!have[k]) { have[k] = 1; state.langs.words.push([t, '']); added++; } });
      btn.disabled = false; btn.textContent = 'Find words on my pages';
      missing.checked = added > 0; filter.value = '';
      save(); draw();
      count.textContent = (added ? added + ' new pieces of text added (they need a translation). ' : 'Every piece of text already has a pair. ') + count.textContent;
    });
  });
  draw();
})();
