/* sg-motion-lite.js: the Standard motion tier. No libraries: the Web Animations API plus IntersectionObserver.
   Same attributes as the other tiers (data-animate="fade-up | stagger | hero | scene", data-count ...).
   Intensity comes from <body data-motion="subtle|lively|none">. Only transform and opacity are animated.
   Content is fully visible without this script; items are hidden (inline) only after it runs, and any
   failure, print, or reduced-motion preference shows the final state. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  if (!window.IntersectionObserver || !doc.documentElement.animate) { root.classList.remove('sg-anim'); return; }
  var reduceQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var PRESETS = {
    subtle: { y: 16, dur: 500, gap: 60, count: 1200 },
    lively: { y: 40, dur: 700, gap: 110, count: 1800 }
  };
  var EASE = 'cubic-bezier(.25,.1,.25,1)';
  // motion personality (motionfx.js): duration multiplier k, curve and travel, from <body data-mtune>
  var TUNE = null; try { TUNE = JSON.parse(doc.body.getAttribute('data-mtune') || 'null'); } catch (e) {}
  function tuned(base) {
    if (!TUNE) return base;
    if (TUNE.ease) EASE = 'cubic-bezier(' + TUNE.ease.join(',') + ')';
    return { y: Math.round(base.y * (TUNE.dist || 1)), dur: Math.round(base.dur * (TUNE.k || 1)), gap: Math.round(base.gap * (TUNE.k || 1)), count: base.count };
  }
  var observers = [], anims = [], timers = [], current = '';

  function targets() {
    return doc.querySelectorAll('[data-animate="fade-up"], [data-animate="hero"], [data-animate="stagger"] > *');
  }
  function clear(el) { el.style.opacity = ''; el.style.transform = ''; }
  function fmt(v, el) {
    var d = +(el.dataset.decimals || 0), s = (+v).toFixed(d);
    if (el.dataset.comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
    return (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
  }
  function finalText(el) { el.textContent = fmt(el.dataset.count, el); }

  function teardown() {
    observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} }); observers = [];
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = [];
    timers.forEach(clearTimeout); timers = [];
    targets().forEach(clear);
    doc.querySelectorAll('[data-count]').forEach(finalText);
    root.classList.remove('sg-anim');
  }

  function reveal(el, p, delay) {
    var a = el.animate(
      [{ opacity: 0, transform: 'translate3d(0,' + p.y + 'px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
      { duration: p.dur, delay: delay, easing: EASE, fill: 'backwards' }
    );
    anims.push(a);
    // the animation owns opacity while it runs; drop the inline hide right away (fill:backwards keeps the start state during the delay)
    el.style.opacity = '';
    var done = function () { clear(el); };
    if (a.finished && a.finished.then) a.finished.then(done, function () {}); else a.onfinish = done;
  }

  function init(level) {
    teardown();
    if (level === 'none' || level === 'off' || reduceQ.matches || !PRESETS[level]) return;
    var p = tuned(PRESETS[level]);
    var fades = Array.prototype.slice.call(doc.querySelectorAll('[data-animate="fade-up"], [data-animate="hero"]'));
    var groups = Array.prototype.slice.call(doc.querySelectorAll('[data-animate="stagger"]'));
    var counters = Array.prototype.slice.call(doc.querySelectorAll('[data-count]'));
    fades.forEach(function (el) { el.style.opacity = '0'; });
    groups.forEach(function (g) { Array.prototype.forEach.call(g.children, function (c) { c.style.opacity = '0'; }); });
    counters.forEach(function (el) { el.textContent = fmt(0, el); });
    root.classList.remove('sg-anim');

    var pending = [], batch = 0;
    function flush() {
      var list = pending; pending = [];
      list.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
      list.forEach(function (el, i) { reveal(el, p, i * p.gap + (+el.getAttribute('data-delay') || 0) * 1000); });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        pending.push(en.target); clearTimeout(batch); batch = setTimeout(flush, 16); timers.push(batch);
      });
    }, { threshold: 0.12 });
    observers.push(io);
    fades.forEach(function (el) { io.observe(el); });

    var gio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        gio.unobserve(en.target);
        Array.prototype.forEach.call(en.target.children, function (c, i) { reveal(c, p, i * p.gap); });
      });
    }, { threshold: 0.15 });
    observers.push(gio);
    groups.forEach(function (g) { gio.observe(g); });

    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, end = +el.dataset.count, t0 = null;
        (function step(t) {
          if (current !== level) return;
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / p.count), e = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(end * e, el);
          if (k < 1) requestAnimationFrame(step); else finalText(el);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    observers.push(cio);
    counters.forEach(function (el) { cio.observe(el); });

    // safety net: anything that never scrolled into view (hidden tab, tiny screen) is shown after a while
    timers.push(setTimeout(function () {
      if (current !== level) return;
      counters.forEach(function (el) { if (+el.dataset.count !== 0 && el.textContent === fmt(0, el)) finalText(el); });
    }, 8000));
  }

  function start(level) {
    current = level;
    try { init(level); } catch (e) { try { teardown(); } catch (e2) {} }
  }
  function revealAll() { try { teardown(); } catch (e) {} }
  window.addEventListener('beforeprint', revealAll);
  if (reduceQ.addEventListener) reduceQ.addEventListener('change', function () { start(reduceQ.matches ? 'none' : (doc.body.dataset.motion || 'subtle')); });
  window.SiteGenMotion = { init: start, reveal: revealAll, tier: 'standard' };
  start(doc.body.getAttribute('data-motion') || 'none');
})();
