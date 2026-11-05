/* sg-premium.js: extras for the Premium and Showcase motion tiers (loaded after the Motion library).
   - a thin scroll progress bar (scaleX only)
   - gentle scroll-linked parallax on the hero (transform only)
   - Lottie icons (spans with data-lottie), loaded lazily the first time one is near the screen,
     recoloured from the site's theme colours, and paused while off screen
   Nothing here hides content. Reduced motion: no bar, no parallax, icons shown as a still frame.
   Everything switches off when <body data-motion="none"> or when printing. */
(function () {
  'use strict';
  var doc = document, M = window.Motion;
  var base = (function () { var s = doc.currentScript; return s && s.src ? s.src.replace(/[^\/]*$/, '') : '/'; })();
  var reduceQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var stops = [], bar = null, loading = null, icons = [], iconIO = null;

  function on() { return (doc.body.getAttribute('data-motion') || 'none') !== 'none'; }

  // ---------- progress bar + parallax ----------
  function startScroll() {
    if (!M || !M.scroll || !M.animate || reduceQ.matches) return;
    try {
      if (!bar) {
        bar = doc.createElement('div'); bar.className = 'sg-progress'; bar.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(bar);
      }
      bar.style.display = '';
      stops.push(M.scroll(M.animate(bar, { transform: ['scaleX(0)', 'scaleX(1)'] }, { ease: 'linear' })));
      var hero = doc.getElementById('hero') || doc.querySelector('[data-sg-hero]');
      var bg = hero && hero.querySelector('.hero-bg:not(.pattern):not(.hero-slide)');
      // the Lively preset slowly zooms the photo with the same transform, so only drift it when that is not running
      if (bg && !(doc.body.getAttribute('data-motion') === 'lively')) {
        bg.style.willChange = 'transform';
        stops.push(M.scroll(M.animate(bg, { transform: ['translate3d(0,0,0) scale(1.18)', 'translate3d(0,70px,0) scale(1.18)'] }, { ease: 'linear' }),
          { target: hero, offset: ['start start', 'end start'] }));
      }
      var inner = hero && hero.querySelector('.hero-inner');
      if (inner) stops.push(M.scroll(M.animate(inner, { transform: ['translate3d(0,0,0)', 'translate3d(0,-36px,0)'] }, { ease: 'linear' }),
        { target: hero, offset: ['start start', 'end start'] }));
    } catch (e) { stopScroll(); }
  }
  function stopScroll() {
    stops.forEach(function (s) { try { typeof s === 'function' ? s() : s && s.stop && s.stop(); } catch (e) {} }); stops = [];
    if (bar) bar.style.display = 'none';
    var hero = doc.getElementById('hero');
    if (hero) {
      var bg = hero.querySelector('.hero-bg'); if (bg) { bg.style.transform = ''; bg.style.willChange = ''; }
      var inner = hero.querySelector('.hero-inner'); if (inner) inner.style.transform = '';
    }
  }

  // ---------- Lottie icons ----------
  function themeRGB(name, fallback) {
    try {
      var v = getComputedStyle(doc.documentElement).getPropertyValue(name).trim() || fallback;
      var c = doc.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = v;
      var h = c.fillStyle; // always #rrggbb
      return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255, 1];
    } catch (e) { return [0.15, 0.4, 0.9, 1]; }
  }
  function lumOf(c) { var f = function (v) { v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return v; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function ratio(a, b) { var x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function near(a, b) { return Math.abs(a[0] - b[0]) < 0.003 && Math.abs(a[1] - b[1]) < 0.003 && Math.abs(a[2] - b[2]) < 0.003; }
  function recolor(node, P, A) {
    if (Array.isArray(node)) { node.forEach(function (n) { recolor(n, P, A); }); return; }
    if (!node || typeof node !== 'object') return;
    if (node.c && node.c.k && Array.isArray(node.c.k) && node.c.k.length === 4 && typeof node.c.k[0] === 'number') {
      if (near(node.c.k, [0.011, 0.022, 0.033])) node.c.k = P.slice();
      else if (near(node.c.k, [0.044, 0.055, 0.066])) node.c.k = A.slice();
    }
    for (var k in node) if (node[k] && typeof node[k] === 'object') recolor(node[k], P, A);
  }
  function load(src) {
    return new Promise(function (ok, fail) {
      var s = doc.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = fail; doc.head.appendChild(s);
    });
  }
  function ensureLottie() {
    if (loading) return loading;
    loading = Promise.all([load(base + 'vendor/lottie_light.min.js'), load(base + 'lottie/icons.js')]).then(function () {
      if (!window.lottie || !window.SG_LOTTIE) throw new Error('lottie');
    });
    return loading;
  }
  function mount(el) {
    if (el.__sgl) return;
    ensureLottie().then(function () {
      if (el.__sgl) return;
      var data = window.SG_LOTTIE[el.getAttribute('data-lottie')]; if (!data) return;
      data = JSON.parse(JSON.stringify(data));
      var bg = themeRGB('--surface', '#ffffff'), ink = themeRGB('--ink', '#111111');
      // an icon colour that nearly matches the chip behind it would vanish, so fall back to the text colour
      var legible = function (c) { return ratio(c, bg) >= 2 ? c : ink; };
      recolor(data, legible(themeRGB('--primary', '#2563eb')), legible(themeRGB('--accent', '#0ea5e9')));
      var still = reduceQ.matches || !on();
      var a = window.lottie.loadAnimation({ container: el, renderer: 'svg', loop: true, autoplay: false, animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      el.__sgl = a; icons.push(el);
      if (still) a.goToAndStop(20, true);
      else if (el.__vis !== false) a.play();
    }).catch(function () { /* icon stays an empty, decorative chip */ });
  }
  function watchIcons() {
    var els = doc.querySelectorAll('.sg-lottie[data-lottie]');
    if (!els.length || !window.IntersectionObserver) return;
    if (iconIO) iconIO.disconnect();
    iconIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target; el.__vis = en.isIntersecting;
        if (en.isIntersecting && !el.__sgl) mount(el);
        else if (el.__sgl) { if (en.isIntersecting && !reduceQ.matches && on()) el.__sgl.play(); else el.__sgl.pause(); }
      });
    }, { rootMargin: '200px' });
    els.forEach(function (el) { iconIO.observe(el); });
  }

  function apply() {
    stopScroll();
    if (on() && !reduceQ.matches) startScroll();
    icons.forEach(function (el) {
      if (!el.__sgl) return;
      if (on() && !reduceQ.matches && el.__vis !== false) el.__sgl.play(); else { el.__sgl.pause(); el.__sgl.goToAndStop(20, true); }
    });
  }

  function init() {
    watchIcons();
    apply();
    try { new MutationObserver(apply).observe(doc.body, { attributes: true, attributeFilter: ['data-motion'] }); } catch (e) {}
    if (reduceQ.addEventListener) reduceQ.addEventListener('change', apply);
    window.addEventListener('beforeprint', stopScroll);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
