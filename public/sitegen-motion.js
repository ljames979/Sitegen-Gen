/* sitegen-motion.js: the one animation script every SiteGen site uses (built on the bundled Motion library).
   Pages only carry attributes: data-animate="fade-up | stagger | hero | scene" and data-count (+ data-prefix,
   data-suffix, data-decimals, data-comma). The preset comes from <body data-motion="subtle|lively|none">.
   Content is fully visible without this script, and nothing animates when the visitor prefers reduced motion. */
(function () {
  'use strict';
  var M = window.Motion;
  var doc = document, root = doc.documentElement;
  if (!M || !M.animate || !M.inView) { root.classList.remove('sg-anim'); return; }   // library missing: show the page as is
  var animate = M.animate, inView = M.inView, stagger = M.stagger;
  var reduceQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var PRESETS = {
    subtle: { y: 16, scale: 1,    duration: 0.5,  gap: 0.06, ease: [0.25, 0.1, 0.25, 1], heroWords: false, zoom: false, count: 1.2 },
    premium: { y: 30, scale: 0.97, duration: 0.7, gap: 0.1, ease: [0.22, 1, 0.36, 1], heroWords: false, zoom: false, count: 1.5, seq: 2.4 },
    lively: { y: 44, scale: 0.94, duration: 0.75, gap: 0.12, ease: [0.22, 1.2, 0.36, 1], heroWords: true,  zoom: true,  count: 1.8 }
  };

  var hero = doc.querySelector('[data-animate="hero"]');
  var heroHTML = hero ? hero.innerHTML : '';
  var stops = [], running = [], pending = [], batchTimer = 0;

  function allTargets() {
    return doc.querySelectorAll('[data-animate="fade-up"], [data-animate="hero"], [data-animate="stagger"] > *, [data-animate="scene"]');
  }
  // Motion's inView hands the callback the IntersectionObserverEntry, not the element
  function elOf(x) { return x && x.target ? x.target : x; }
  function clear(el) { el.style.opacity = ''; el.style.transform = ''; el.style.willChange = ''; }
  function fmt(v, el) {
    var d = +(el.dataset.decimals || 0);
    var s = (+v).toFixed(d);
    if (el.dataset.comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
    return (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
  }
  function finalText(el) { el.textContent = fmt(el.dataset.count, el); }

  function teardown() {
    clearTimeout(batchTimer); pending = [];
    stops.forEach(function (s) { try { s(); } catch (e) {} }); stops = [];
    running.forEach(function (a) { try { a.stop(); } catch (e) {} }); running = [];
    allTargets().forEach(clear);
    if (hero) hero.innerHTML = heroHTML;
    doc.querySelectorAll('[data-count]').forEach(finalText);
    root.classList.remove('sg-anim');
  }

  function splitWords(el) {            // wrap each word (keeping any <em> or <span> inside) so words can rise one by one
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(doc.createTextNode(part));
            else { var s = doc.createElement('span'); s.className = 'sg-word'; s.style.display = 'inline-block'; s.textContent = part; frag.appendChild(s); }
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    };
    walk(el);
    return Array.prototype.slice.call(el.querySelectorAll('.sg-word'));
  }

  function init(level) {
    teardown();
    if (level === 'none' || level === 'off' || reduceQ.matches || !PRESETS[level]) return;
    // Premium + Subtle runs the choreographed preset (headline, then subtext, then buttons); Lively keeps its own look
    var pro = /^(premium|showcase)$/.test(doc.body.getAttribute('data-motion-level') || '');
    var p = PRESETS[level === 'subtle' && pro ? 'premium' : level];
    // motion personality (motionfx.js): duration multiplier k, curve and travel, from <body data-mtune>
    var T = null; try { T = JSON.parse(doc.body.getAttribute('data-mtune') || 'null'); } catch (e) {}
    if (T) { var q = {}; for (var key in p) q[key] = p[key]; q.duration = p.duration * (T.k || 1); q.gap = p.gap * (T.k || 1); q.y = Math.round(p.y * (T.dist || 1)); if (T.ease) q.ease = T.ease; p = q; }
    var from = { opacity: [0, 1], y: [p.y, 0] };
    if (p.scale !== 1) from.scale = [p.scale, 1];
    var opts = function (extra) { var o = { duration: p.duration, ease: p.ease }; for (var k in extra) o[k] = extra[k]; return o; };
    // when an animation ends, drop its inline styles (after Motion has committed its last frame) so the
    // page's own CSS, like card hover effects, is back in charge
    var track = function (a, els) {
      running.push(a);
      var done = function () { setTimeout(function () { (els || []).forEach(clear); }, 30); };
      var fin = a && a.finished ? a.finished : a;
      if (fin && fin.then) fin.then(done, function () {});
      return a;
    };

    // headline: the whole line for Subtle, word by word for Lively
    if (hero) {
      var targets = p.heroWords ? splitWords(hero) : [hero];
      targets.forEach(function (t) { t.style.opacity = '0'; });
      track(animate(targets, { opacity: [0, 1], y: [p.y, 0] }, opts({ delay: stagger(p.heroWords ? 0.07 : 0) })), targets);
    }

    // hero photo / illustration: Lively adds a slow zoom, Subtle leaves it alone
    doc.querySelectorAll('[data-animate="scene"]').forEach(function (scene) {
      if (p.zoom) running.push(animate(scene, { scale: [1, 1.12] }, { duration: 22, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }));
    });

    // hide what is about to animate in; elements already on screen start straight away
    var fades = Array.prototype.slice.call(doc.querySelectorAll('[data-animate="fade-up"]'));
    var groups = Array.prototype.slice.call(doc.querySelectorAll('[data-animate="stagger"]'));
    fades.forEach(function (el) { el.style.opacity = '0'; });
    groups.forEach(function (g) { Array.prototype.forEach.call(g.children, function (c) { c.style.opacity = '0'; }); });
    // counters start at zero and count up when they scroll into view
    var counters = Array.prototype.slice.call(doc.querySelectorAll('[data-count]'));
    counters.forEach(function (el) { el.textContent = fmt(0, el); });
    root.classList.remove('sg-anim');          // from here the inline styles above keep things hidden

    // items that appear together are staggered in document order
    var flush = function () {
      var list = pending; pending = [];
      list.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
      list.forEach(function (el, i) {
        track(animate(el, from, opts({ delay: i * p.gap + (+el.getAttribute('data-delay') || 0) * (p.seq || 1) })), [el]);
      });
    };
    if (fades.length) stops.push(inView(fades, function (entry) {
      pending.push(elOf(entry)); clearTimeout(batchTimer); batchTimer = setTimeout(flush, 16);
    }, { amount: 0.15 }));
    if (groups.length) stops.push(inView(groups, function (entry) {
      var g = elOf(entry), kids = Array.prototype.slice.call(g.children);
      track(animate(kids, from, opts({ delay: stagger(p.gap) })), kids);
    }, { amount: 0.2 }));
    if (counters.length) stops.push(inView(counters, function (entry) {
      var el = elOf(entry), end = +el.dataset.count;
      running.push(animate(0, end, { duration: p.count, ease: 'easeOut', onUpdate: function (v) { el.textContent = fmt(v, el); }, onComplete: function () { finalText(el); } }));
    }, { amount: 0.6 }));
    // safety net: anything that never scrolled into view (hidden tab, tiny screen) is shown after a while
    setTimeout(function () { if (current === level) { counters.forEach(function (el) { if (el.textContent === fmt(0, el) && +el.dataset.count !== 0) finalText(el); }); } }, 8000);
  }

  var current = '';
  function start(level) {
    current = level;
    try { init(level); } catch (e) { try { teardown(); } catch (e2) {} }   // any failure leaves a complete, static page
  }
  function reveal() { try { teardown(); } catch (e) {} }

  window.addEventListener('beforeprint', reveal);
  if (reduceQ.addEventListener) reduceQ.addEventListener('change', function () { start(reduceQ.matches ? 'none' : (doc.body.dataset.motion || 'subtle')); });
  window.SiteGenMotion = { init: start, reveal: reveal, tier: 'premium' };
  start(doc.body.getAttribute('data-motion') || 'none');
})();
