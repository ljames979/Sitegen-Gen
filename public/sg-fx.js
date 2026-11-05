/* sg-fx.js: small extras that need a script (motionfx.js decides which are on through <body> classes and data).
   Rotating headline word, highlighter and circle marks, letter-by-letter headings, magnetic buttons, photo tilt,
   a second photo on hover, the hero spotlight, the pinned services story, the scrim hero's stars, the Scroll-through photos hero, the Floating 3D shapes hero, ink-in section headings, the scroll-linked
   library layouts (Card fan, Grid zoom, Fanned prices) and booking confetti.
   With "reduce motion" (or the motion style set to None) the page is shown complete and still. */
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none';
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var has = function (c) { return body.classList.contains(c); };
  var k = parseFloat(getComputedStyle(body).getPropertyValue('--mp-k')) || 1;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  // one shared scroll listener for every effect on the page (set up in the page's head; sgOnScroll(fn) runs fn once a frame while it scrolls or resizes)
  var onScroll = (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); });
  var seen = function (els, fn, opts) {
    if (!els.length) return;
    if (still || !window.IntersectionObserver) { each(els, fn); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }); }, opts || { threshold: 0.4 });
    each(els, function (el) { io.observe(el); });
  };
  var heroH1 = doc.querySelector('#hero h1, [data-sg-fam="hero"] h1');
  var data = function (name) { try { return JSON.parse(body.getAttribute(name) || 'null'); } catch (e) { return null; } };

  // highlighter: the phrase the owner chose, if it is in the headline
  var hl = data('data-sg-hl');
  if (hl && heroH1) {
    var walker = doc.createTreeWalker(heroH1, 4), node, low = String(hl).toLowerCase();
    while ((node = walker.nextNode())) {
      var i = node.nodeValue.toLowerCase().indexOf(low);
      if (i < 0) continue;
      var mid = node.splitText(i); mid.splitText(hl.length);
      var mark = doc.createElement('mark'); mark.className = 'sg-hl'; mid.parentNode.replaceChild(mark, mid); mark.appendChild(mid);
      if (still) mark.classList.add('on'); else setTimeout(function () { mark.classList.add('on'); }, 120);
      break;
    }
  }

  // rotating word under the headline: only the client's own service names
  var rot = data('data-sg-rotate');
  if (rot && rot.words && rot.words.length && heroH1) {
    var p = doc.createElement('p'); p.className = 'sg-rotate';
    var label = (rot.prefix ? rot.prefix + ' ' : '') + rot.words.join(', ');
    p.setAttribute('aria-label', label);
    if (still || rot.words.length < 2) {
      p.textContent = label;
    } else {
      if (rot.prefix) p.appendChild(doc.createTextNode(rot.prefix + ' '));
      var box = doc.createElement('span'); box.className = 'sg-rot'; box.setAttribute('aria-hidden', 'true');
      rot.words.forEach(function (w, n) { var s = doc.createElement('span'); s.textContent = w; if (!n) s.className = 'on'; box.appendChild(s); });
      p.appendChild(box);
      var at = 0, spans = box.children;
      setInterval(function () {
        if (doc.hidden) return;
        spans[at].className = 'out';
        var prev = spans[at]; setTimeout(function () { if (prev.className === 'out') prev.className = ''; }, 700);
        at = (at + 1) % spans.length; spans[at].className = 'on';
      }, Math.round(2400 * k));
    }
    heroH1.parentNode.insertBefore(p, heroH1.nextSibling);
  }

  // hand-drawn circle around the numbers as they scroll in
  if (has('fx-circle')) {
    var nums = [];
    each(doc.querySelectorAll('main [data-count]'), function (el) {
      var w = doc.createElement('span'); w.className = 'sg-circ';
      el.parentNode.insertBefore(w, el); w.appendChild(el);
      w.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M58 9C30 6 6 22 6 48c0 27 26 44 52 42 25-2 38-20 37-43C94 22 72 7 44 11"/></svg>');
      nums.push(w);
    });
    seen(nums, function (w) { w.classList.add('on'); }, { threshold: 0.6 });
  }

  // headings whose letters settle into place
  if (has('kx-settle') && !still) {
    var heads = [];
    each(doc.querySelectorAll('main h2, #hero h1:not([data-animate="hero"]), [data-sg-fam="hero"] h1'), function (h) {
      if (h.children.length || !h.textContent.trim() || h.textContent.length > 90) return;
      var text = h.textContent, n = 0;
      h.setAttribute('aria-label', text.trim()); h.textContent = '';
      var wrap = doc.createElement('span'); wrap.setAttribute('aria-hidden', 'true');
      text.split(/(\s+)/).forEach(function (part) {
        if (/^\s+$/.test(part)) { wrap.appendChild(doc.createTextNode(' ')); return; }
        if (!part) return;
        var w = doc.createElement('span'); w.className = 'kx-word';
        part.split('').forEach(function (ch) { var l = doc.createElement('span'); l.className = 'kx-l'; l.style.setProperty('--i', n++); l.textContent = ch; w.appendChild(l); });
        wrap.appendChild(w);
      });
      h.appendChild(wrap); heads.push(h);
    });
    seen(heads, function (h) { h.classList.add('kx-in'); }, { threshold: 0.2 });
  }

  // magnetic buttons lean toward the mouse
  if (has('bfx-magnetic') && fine && !still) {
    each(doc.querySelectorAll('.btn, a.tw\\:bg-primary'), function (b) {
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px'; });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  // 3D tilt on photo cards
  if (has('pfx-tilt') && fine && !still) {
    var cards = doc.querySelectorAll('main a:has(> img.tw\\:object-cover), main figure:has(> img.tw\\:object-cover), main .svc-tile, main .g-card');
    each(cards, function (c) {
      c.setAttribute('data-sg-tilt', '');
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.transform = 'perspective(900px) rotateY(' + (x * 8).toFixed(2) + 'deg) rotateX(' + (-y * 8).toFixed(2) + 'deg)'; });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }

  // a second photo shown on hover (the owner's "hover photo" for a service)
  if (fine) {
    each(doc.querySelectorAll('img[data-sg-hover]'), function (img) {
      var par = img.parentNode, made = null;
      par.addEventListener('pointerenter', function () {
        if (!made) {
          made = doc.createElement('img'); made.alt = ''; made.className = img.className + ' sg-hover2'; made.decoding = 'async'; made.src = img.getAttribute('data-sg-hover');
          if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
          made.style.position = 'absolute'; made.style.objectFit = 'cover';
          par.insertBefore(made, img.nextSibling);
        }
        made.style.top = img.offsetTop + 'px'; made.style.left = img.offsetLeft + 'px'; made.style.width = img.offsetWidth + 'px'; made.style.height = img.offsetHeight + 'px'; made.style.inset = '';
      });
    });
  }

  // hero spotlight
  if (has('fx-spot') && fine && !still) {
    var hero = doc.querySelector('#hero, [data-sg-fam="hero"]');
    if (hero) {
      if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
      var layer = doc.createElement('div'); layer.className = 'fx-spot-layer'; layer.setAttribute('aria-hidden', 'true'); hero.appendChild(layer);
      hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); hero.style.setProperty('--sx', (e.clientX - r.left) + 'px'); hero.style.setProperty('--sy', (e.clientY - r.top) + 'px'); hero.classList.add('fx-spot-on'); });
      hero.addEventListener('pointerleave', function () { hero.classList.remove('fx-spot-on'); });
    }
  }

  // pinned services story: the photo on the pinned side follows the service being read
  each(doc.querySelectorAll('[data-sg-story]'), function (st) {
    var steps = st.querySelectorAll('[data-sg-step]'), pics = st.querySelectorAll('[data-sg-pic]');
    if (!steps.length || !pics.length || !window.IntersectionObserver) return;
    st.classList.add('sg-live');
    var show = function (n) { if (st.querySelector('[data-sg-pic="' + n + '"]')) each(pics, function (p) { p.classList.toggle('on', p.getAttribute('data-sg-pic') === n); }); each(steps, function (s) { s.classList.toggle('on', s.getAttribute('data-sg-step') === n); }); };
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) show(e.target.getAttribute('data-sg-step')); }); }, { rootMargin: '-45% 0px -45% 0px' });
    each(steps, function (s) { io.observe(s); });
  });

  // twinkling stars behind the Image + Scrim hero (Showcase motion level only); paused off screen and in background tabs
  each(doc.querySelectorAll('canvas[data-sg-stars]'), function (cv) {
    if (still || !cv.getContext) return;
    var cx = cv.getContext('2d'), stars = [], on = true, running = false, dpr = Math.min(2, window.devicePixelRatio || 1), W = 0, H = 0;
    function size() {
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(260, Math.round(W * H / 5200)); stars = [];
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.8 });
    }
    size(); addEventListener('resize', size);
    var go = function () { if (!running && on && !doc.hidden) { running = true; requestAnimationFrame(draw); } };
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { on = en[0].isIntersecting; go(); }).observe(cv);
    function draw(t) {
      if (!on || doc.hidden) { running = false; return; }
      cx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i], a = 0.35 + 0.65 * Math.abs(Math.sin(st.p + (t || 0) / 1000 * st.s / k));
        cx.globalAlpha = a; cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(st.x, st.y, st.r, 0, 6.2832); cx.fill();
      }
      requestAnimationFrame(draw);
    }
    doc.addEventListener('visibilitychange', go);
    go();
  });

  // a short confetti burst on a confirmed booking (only when the owner switched it on)
  var cf = doc.querySelector('[data-sg-confetti]');
  if (cf && !still && doc.createElement('canvas').getContext) {
    var cs = getComputedStyle(body), cols = [cs.getPropertyValue('--primary'), cs.getPropertyValue('--accent'), '#ffffff', '#ffd166'].map(function (c) { return c.trim() || '#f5b400'; });
    var cv = doc.createElement('canvas'), W = cv.width = innerWidth, H = cv.height = innerHeight, ctx = cv.getContext('2d');
    cv.setAttribute('aria-hidden', 'true'); cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000';
    body.appendChild(cv);
    var bits = [], t0 = 0;
    for (var n = 0; n < 140; n++) bits.push({ x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[n % cols.length] });
    var frame = function (t) {
      if (!t0) t0 = t;
      var age = t - t0; ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) { b.vy += 0.42; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.globalAlpha = Math.max(0, 1 - age / 2200); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
      if (age < 2200) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }

  // Scroll-through photos hero (hero/scroll): the owner's hero photos step forward as the page scrolls down and back as
  // it scrolls up, while the words stay pinned. With motion off it stays one photo and the dots switch it.
  each(doc.querySelectorAll('[data-sg-scrub]'), function (wrap) {
    var phs = wrap.querySelectorAll('[data-sg-scrub-ph]'), dots = wrap.querySelectorAll('[data-sg-scrub-dot]'), n = phs.length, cur = -1;
    if (n < 2) return;
    var load = function (j) { var el = phs[j]; if (el && !el.getAttribute('data-loaded')) { el.style.setProperty('--hero-photo', "url('" + el.getAttribute('data-photo') + "')"); el.setAttribute('data-loaded', '1'); } };
    var show = function (j) {
      if (j === cur) return; cur = j;
      each(phs, function (el, m) { el.classList.toggle('on', m === j); });
      each(dots, function (d, m) { d.setAttribute('aria-current', m === j ? 'true' : 'false'); });
      load(j); load(j + 1); load(j - 1);
      wrap.classList.toggle('moved', j > 0);
    };
    var span = function () { return wrap.getBoundingClientRect().height - innerHeight; };
    var at = function () {
      var s = span(), p = s > 0 ? Math.min(1, Math.max(0, -wrap.getBoundingClientRect().top / s)) : 0;
      show(Math.min(n - 1, Math.floor(p * n)));
    };
    wrap.classList.add('ready');
    if (still) { show(0); each(dots, function (d, m) { d.addEventListener('click', function () { show(m); }); }); return; }
    wrap.classList.add('on');
    onScroll(at);
    each(dots, function (d, m) {
      d.addEventListener('click', function () { scrollTo({ top: scrollY + wrap.getBoundingClientRect().top + span() * (m + 0.5) / n, behavior: 'smooth' }); });
    });
    at();
  });
  // Ink-in headings (fx-ink): the words of each section heading go from pale to full color as the heading moves up
  // the screen. Only the words are wrapped, so links and highlights inside a heading keep working.
  if (has('fx-ink') && !still) {
    var inks = [];
    each(doc.querySelectorAll('h2'), function (h) {
      if (h.closest('#hero, [data-sg-fam="hero"], footer, nav, header, .sg-tk, [data-sg-scrub]')) return;
      var tw = doc.createTreeWalker(h, 4), texts = [], t;
      while ((t = tw.nextNode())) texts.push(t);
      var words = [];
      texts.forEach(function (tn) {
        var parts = tn.nodeValue.split(/(\s+)/), frag = doc.createDocumentFragment();
        parts.forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(w)); return; }
          var sp = doc.createElement('span'); sp.className = 'ink-w'; sp.textContent = w; frag.appendChild(sp); words.push(sp);
        });
        tn.parentNode.replaceChild(frag, tn);
      });
      if (words.length) { h.classList.add('ink-on'); inks.push({ h: h, w: words, lit: -1 }); }
    });
    var inkAt = function () {
      var vh = innerHeight;
      inks.forEach(function (o) {
        var r = o.h.getBoundingClientRect();
        // starts as the heading comes up past 92% of the screen, finished by 55%
        var p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.37)));
        var lit = Math.round(p * o.w.length);
        if (lit === o.lit) return; o.lit = lit;
        each(o.w, function (w, i) { w.classList.toggle('lit', i < lit); });
      });
    };
    if (inks.length) { onScroll(inkAt); inkAt(); }
  }

  // Scroll-linked library layouts: each [data-sg-progress] gets --p from 0 to 1. "enter" runs while the block comes
  // up into view; "pin" runs while the visitor scrolls through a tall block whose inside stays pinned. With motion off
  // (or no script) --p is never set and the CSS shows the finished, still layout.
  if (!still) {
    var prog = doc.querySelectorAll('[data-sg-progress]');
    var pAt = function () {
      var vh = innerHeight;
      each(prog, function (el) {
        var r = el.getBoundingClientRect(), p;
        if (el.getAttribute('data-sg-progress') === 'pin') { var span = r.height - vh; p = span > 0 ? -r.top / span : 1; }
        else p = (vh * 0.95 - r.top) / (Math.min(r.height, vh) * 0.75);
        p = Math.min(1, Math.max(0, p));
        p = p * p * (3 - 2 * p);
        el.style.setProperty('--p', p.toFixed(3));
      });
    };
    if (prog.length) {
      each(prog, function (el) { el.classList.add('sg-pon'); });
      onScroll(pAt);
      pAt();
    }
  }
  // Brand wall and card cascade blocks: the pause button stops and restarts the motion (works with motion off too)
  each(doc.querySelectorAll('[data-sg-wall-pause]'), function (btn) {
    btn.addEventListener('click', function () {
      var w = btn.closest('[data-sg-wall]'), on = !w.classList.contains('paused');
      w.classList.toggle('paused', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var what = btn.getAttribute('data-what') || 'moving wall';
      btn.setAttribute('aria-label', (on ? 'Play the ' : 'Pause the ') + what);
    });
  });
  // Floating 3D shapes hero (hero/shapes): the round button plays the owner's video in a dialog (always), and with
  // motion allowed the shapes drift (.on), lean toward the mouse (--mx/--my) and spread apart on scroll (--sy).
  each(doc.querySelectorAll('[data-sg-shapes]'), function (hero) {
    var dlg = hero.querySelector('[data-sg-vid]'), op = hero.querySelector('[data-sg-vid-open]');
    if (dlg && op) {
      var vid = dlg.querySelector('video');
      op.addEventListener('click', function () {
        if (!dlg.showModal) { location.href = vid.getAttribute('src'); return; }
        dlg.showModal(); if (vid && vid.play) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
      });
      dlg.addEventListener('close', function () { if (vid) vid.pause(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      each(dlg.querySelectorAll('[data-sg-vid-close]'), function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    }
    if (still) return;
    hero.classList.add('on');
    if (fine) hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    onScroll(function () { var r = hero.getBoundingClientRect(); hero.style.setProperty('--sy', Math.min(1, Math.max(0, -r.top / r.height)).toFixed(3)); });
  });
})();

// Photo trail, Photo wave and Big words content blocks (motionblocks.js). Motion off: each stays a finished still layout.
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none';
  if (still) return;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var k = parseFloat(getComputedStyle(body).getPropertyValue('--mp-k')) || 1;
  var onScroll = (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); });
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var watch = function (el, fn) { if (!window.IntersectionObserver) { fn(true); return; } new IntersectionObserver(function (en) { fn(en[0].isIntersecting); }, { threshold: 0.25 }).observe(el); };

  // photo trail: a photo every so many pixels of mouse travel, each fading after a moment
  each(doc.querySelectorAll('[data-sg-trail]'), function (box) {
    var photos = []; try { photos = JSON.parse(box.getAttribute('data-photos') || '[]'); } catch (e) {}
    if (photos.length < 3) return;
    box.classList.add('sg-live');
    var n = 0, lx = null, ly = 0, z = 2, gap = Math.max(70, Math.min(140, box.clientWidth / 9));
    var drop = function (x, y) {
      var im = doc.createElement('img'); im.className = 'sg-trail-pic'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.src = photos[n++ % photos.length];
      box.appendChild(im);
      var w = im.offsetWidth || 180; im.style.transform = 'translate(' + (x - w / 2).toFixed(0) + 'px,' + (y - w * 0.375).toFixed(0) + 'px)'; im.style.zIndex = ++z;
      setTimeout(function () { im.classList.add('out'); setTimeout(function () { im.remove(); }, 600); }, 700 * k);
    };
    var move = function (x, y) { if (lx === null || Math.hypot(x - lx, y - ly) >= gap) { lx = x; ly = y; drop(x, y); } };
    if (fine) {
      box.addEventListener('pointermove', function (e) { var r = box.getBoundingClientRect(); move(e.clientX - r.left, e.clientY - r.top); });
      box.addEventListener('pointerleave', function () { lx = null; });
      return;
    }
    // touch screens: a trail runs across by itself while the block is on screen
    var on = false, t0 = 0, run = function (now) {
      if (!on) return; if (!t0) t0 = now;
      var p = ((now - t0) / (5200 * k)) % 1, W = box.clientWidth, H = box.clientHeight;
      if (p < 0.02) lx = null;
      move(W * (0.08 + p * 0.84), H * (0.62 + Math.sin(p * Math.PI * 2.2) * 0.16));
      requestAnimationFrame(run);
    };
    watch(box, function (v) { if (v && !on) { on = true; t0 = 0; requestAnimationFrame(run); } else if (!v) on = false; });
  });

  // photo wave: a wave between the two words, then a scattered cloud, then settled around the words, as the page scrolls
  each(doc.querySelectorAll('[data-sg-wave]'), function (box) {
    var pics = box.querySelectorAll('.sg-wave-pic'), N = pics.length;
    if (N < 4) return;
    box.classList.add('sg-live');
    var pin = box.firstElementChild, rnd = function (i, s) { var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
    var A = [], B = [], C = [], word = (box.getAttribute('data-sg-shape') || '').toUpperCase();
    // the owner's word: draw it on a hidden canvas, then put one card on each filled spot of a grid over the letters
    var spell = function (W, H) {
      var cv = doc.createElement('canvas'), w = Math.round(Math.min(W * 0.86, 1100)), h = Math.round(Math.min(H * 0.42, 340)), g = cv.getContext('2d');
      if (!g || w < 40 || h < 20) return null;
      cv.width = w; cv.height = h;
      var fs = h; g.font = '900 ' + fs + 'px system-ui, sans-serif';
      var tw = g.measureText(word).width; if (tw > w) { fs = Math.floor(fs * w / tw); g.font = '900 ' + fs + 'px system-ui, sans-serif'; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, w / 2, h / 2);
      var px = g.getImageData(0, 0, w, h).data, on = function (x, y) { return px[(Math.round(y) * w + Math.round(x)) * 4 + 3] > 128; };
      var pts = [], step = fs / 3;
      for (var k = 0; k < 12; k++) {   // a finer grid until there are enough spots for the cards
        pts = [];
        for (var y = step / 2; y < h; y += step) for (var x = step / 2; x < w; x += step) if (on(x, y)) pts.push([x - w / 2, y - h / 2]);
        if (pts.length >= N) break;
        step *= 0.82;
      }
      if (!pts.length) return null;
      var out = [];
      for (var i = 0; i < N; i++) out.push(i < pts.length ? pts[Math.floor(i * pts.length / Math.min(N, pts.length)) % pts.length] : null);
      return { pts: out, size: step };
    };
    var layout = function () {
      var W = pin.clientWidth, H = pin.clientHeight, span = Math.min(W * 0.5, 620), amp = Math.min(H * 0.12, 90);
      var sp = word ? spell(W, H) : null, cw = pics[0].offsetWidth || 60, ws = sp ? Math.max(0.3, Math.min(1.4, sp.size * 1.15 / cw)) : 1;
      A = []; B = []; C = [];
      for (var i = 0; i < N; i++) {
        var t = i / (N - 1);
        if (sp) A.push(sp.pts[i] ? [sp.pts[i][0], sp.pts[i][1], ws, 1] : [0, 0, ws, 0]);
        else A.push([(t - 0.5) * span, Math.sin(t * Math.PI * 2) * amp, 1, 1]);
        B.push([(rnd(i, 1) - 0.5) * Math.min(W * 0.42, 520), (rnd(i, 2) - 0.5) * H * 0.5, 1.15 + rnd(i, 3) * 0.5, 1]);
        var ang = (i / N) * Math.PI * 2 + rnd(i, 4) * 0.4, rx = W * (0.34 + rnd(i, 5) * 0.08), ry = H * (0.27 + rnd(i, 6) * 0.08);
        C.push([Math.cos(ang) * rx, Math.sin(ang) * ry, 0.9 + rnd(i, 7) * 0.9, i % 3 === 0 ? 1 : 0.28]);
      }
    };
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var mix = function (a, b, t) { return a + (b - a) * t; };
    var draw = function () {
      var r = box.getBoundingClientRect(), span = r.height - innerHeight; if (span <= 0) return;
      var p = Math.max(0, Math.min(1, -r.top / span)), ab = ease((p - 0.12) / 0.33), bc = ease((p - 0.55) / 0.3);
      for (var i = 0; i < N; i++) {
        var x = mix(mix(A[i][0], B[i][0], ab), C[i][0], bc), y = mix(mix(A[i][1], B[i][1], ab), C[i][1], bc);
        var s = mix(mix(A[i][2], B[i][2], ab), C[i][2], bc), o = mix(mix(A[i][3], 1, ab), C[i][3], bc);
        var ry = word ? 0 : mix(-28 + (i / N) * 56, 0, ab);
        pics[i].style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) perspective(600px) rotateY(' + ry.toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
        pics[i].style.opacity = o.toFixed(2); pics[i].style.zIndex = Math.round(mix(i, 1, bc));
      }
      pin.style.setProperty('--wo', (1 - ease((p - 0.18) / 0.22)).toFixed(3));
      pin.style.setProperty('--to', ease((p - 0.68) / 0.18).toFixed(3));
    };
    layout(); draw();
    var lw = innerWidth; addEventListener('resize', function () { if (innerWidth !== lw) { lw = innerWidth; layout(); draw(); } });
    onScroll(draw);
  });

  // big words: they stretch into place one after another when the block comes into view
  each(doc.querySelectorAll('[data-sg-bigw]'), function (box) {
    box.classList.add('sg-live');
    if (!window.IntersectionObserver) { box.classList.add('sg-in'); return; }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); requestAnimationFrame(function () { box.classList.add('sg-in'); }); } }, { threshold: 0.3 });
    io.observe(box);
  });
})();

// Scroll story, Path travel, Zoom through the word and Shape morph content blocks (motionblocks.js). Motion off (or no
// script): each stays its finished still layout.
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  if ((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none') return;
  var onScroll = (window.sgOnScroll || function (f) { addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); });
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var clamp = function (v, a, z) { return Math.max(a, Math.min(z, v)); };
  // how far through a pinned block the page has scrolled, 0 to 1
  var through = function (box) { var r = box.getBoundingClientRect(), span = r.height - innerHeight; return span > 0 ? clamp(-r.top / span, 0, 1) : 0; };

  // scroll story: one step at a time, its photo wiping in; the bar fills as the story goes
  each(doc.querySelectorAll('[data-sg-scrollstory]'), function (box) {
    var steps = box.querySelectorAll('.sg-story-step'), pics = box.querySelectorAll('.sg-story-pic'), bar = box.querySelector('.sg-story-bar'), n = steps.length;
    if (n < 2) return;
    box.classList.add('sg-live');
    var at = -1;
    var draw = function () {
      var p = through(box), i = Math.min(n - 1, Math.floor(p * n * 0.999));
      if (bar) bar.style.setProperty('--p', p.toFixed(3));
      if (i === at) return; at = i;
      each(steps, function (s, j) { s.classList.toggle('on', j === i); s.classList.toggle('past', j < i); });
      each(pics, function (s, j) { s.classList.toggle('on', j === i); s.classList.toggle('past', j < i); });
    };
    draw(); onScroll(draw);
  });

  // path travel: the photos and lines ride a curve across the block as the page scrolls
  each(doc.querySelectorAll('[data-sg-path]'), function (box) {
    var stage = box.querySelector('.sg-path-stage'), svg = box.querySelector('.sg-path-line'), line = svg && svg.querySelector('path');
    var pics = Array.prototype.slice.call(box.querySelectorAll('.sg-path-pic')), words = Array.prototype.slice.call(box.querySelectorAll('.sg-path-word'));
    if (!stage || !line || pics.length < 3 || !('offsetPath' in body.style)) return;
    // photos with the lines spread between them
    var items = [], every = words.length ? Math.max(1, Math.round(pics.length / words.length)) : 0;
    pics.forEach(function (p, i) { items.push(p); if (every && i % every === every - 1 && words.length) items.push(words.shift()); });
    items = items.concat(words);
    box.classList.add('sg-live');
    var L = 0, gap = 0;
    var layout = function () {
      var W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
      var d = 'M ' + (-0.12 * W) + ' ' + (0.78 * H) + ' C ' + (0.22 * W) + ' ' + (-0.15 * H) + ', ' + (0.42 * W) + ' ' + (1.15 * H) + ', ' + (0.62 * W) + ' ' + (0.45 * H) + ' S ' + (0.92 * W) + ' ' + (0.02 * H) + ', ' + (1.12 * W) + ' ' + (0.32 * H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); line.setAttribute('d', d);
      L = line.getTotalLength(); gap = L / Math.max(4, items.length * 0.85);
      items.forEach(function (it) { it.style.offsetPath = 'path("' + d + '")'; });
      draw();
    };
    var draw = function () {
      if (!L) return;
      var p = through(box), run = p * (items.length * gap + L * 0.5);
      items.forEach(function (it, j) {
        var dist = run - j * gap + L * 0.25;
        it.style.offsetDistance = clamp(dist, 0, L).toFixed(1) + 'px';
        it.style.opacity = dist < 0 || dist > L ? '0' : '1';
      });
    };
    layout(); onScroll(draw);
    var lw = innerWidth; addEventListener('resize', function () { if (innerWidth !== lw) { lw = innerWidth; layout(); } });
  });

  // zoom through the word: the photo-filled word grows until its letters open onto the photo, then the words come up
  each(doc.querySelectorAll('[data-sg-zoomword]'), function (box) {
    box.classList.add('sg-live');
    var pin = box.firstElementChild;
    var draw = function () {
      var p = through(box);
      pin.style.setProperty('--s', (1 + Math.pow(clamp(p / 0.8, 0, 1), 2.4) * 28).toFixed(3));
      pin.style.setProperty('--o', clamp((p - 0.42) / 0.3, 0, 1).toFixed(3));
      pin.style.setProperty('--t', clamp((p - 0.72) / 0.18, 0, 1).toFixed(3));
    };
    draw(); onScroll(draw);
  });

  // shape morph: the photo's shape moves from one soft shape to the next as the block passes up the screen
  var SHAPES = [
    [42, 58, 61, 39, 45, 41, 59, 55],   // pebble
    [50, 50, 50, 50, 50, 50, 50, 50],   // circle
    [50, 50, 6, 6, 42, 42, 6, 6],       // arch
    [8, 72, 8, 72, 8, 72, 8, 72],       // leaf
    [30, 70, 70, 30, 30, 30, 70, 70]    // blob
  ];
  each(doc.querySelectorAll('[data-sg-morph]'), function (box) {
    var img = box.querySelector('.sg-morph-img'); if (!img) return;
    var ease = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var draw = function () {
      var r = box.getBoundingClientRect(); if (r.bottom < -50 || r.top > innerHeight + 50) return;
      var p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1) * (SHAPES.length - 1), i = Math.min(SHAPES.length - 2, Math.floor(p)), t = ease(p - i), a = SHAPES[i], b2 = SHAPES[i + 1];
      var v = a.map(function (x, j) { return (x + (b2[j] - x) * t).toFixed(1) + '%'; });
      img.style.borderRadius = v.slice(0, 4).join(' ') + ' / ' + v.slice(4).join(' ');
      img.style.transform = 'rotate(' + ((p / (SHAPES.length - 1) - 0.5) * 16).toFixed(2) + 'deg)';
    };
    draw(); onScroll(draw);
  });

})();

// Connected photo cards content block (nodecards.js). With motion off the lines are still drawn and the first photos stay.
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none';
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  // connected photo cards: a line joins each card to each card in the next column (redrawn when the block changes
  // size), and the photo cards' pictures take turns, one card at a time, while the block is on screen and not paused
  each(doc.querySelectorAll('[data-sg-nodes]'), function (box) {
    var graph = box.querySelector('.sg-nc-graph'), svg = box.querySelector('.sg-nc-wires'); if (!graph || !svg) return;
    var NS = 'http://www.w3.org/2000/svg', cols = graph.querySelectorAll('.sg-nc-col');
    var add = function (tag, at) { var el = doc.createElementNS(NS, tag); for (var a in at) el.setAttribute(a, at[a]); svg.appendChild(el); };
    var wire = function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (innerWidth < 760) return;
      var g = graph.getBoundingClientRect(), dots = {};
      var pt = function (fr, right) { var r = fr.getBoundingClientRect(); return { x: Math.round((right ? r.right : r.left) - g.left), y: Math.round(r.top - g.top + Math.min(44, r.height * 0.16)) }; };
      for (var c = 0; c < cols.length - 1; c++) {
        each(cols[c].querySelectorAll('.sg-nc-frame'), function (fa) {
          each(cols[c + 1].querySelectorAll('.sg-nc-frame'), function (fb) {
            var s = pt(fa, true), e = pt(fb, false), dx = Math.max(28, (e.x - s.x) * 0.6);
            add('path', { d: 'M' + s.x + ' ' + s.y + 'C' + (s.x + dx) + ' ' + s.y + ' ' + (e.x - dx) + ' ' + e.y + ' ' + e.x + ' ' + e.y });
            dots[s.x + ',' + s.y] = s; dots[e.x + ',' + e.y] = e;
          });
        });
      }
      for (var k in dots) add('circle', { cx: dots[k].x, cy: dots[k].y, r: 5.5 });
    };
    wire();
    if (window.ResizeObserver) new ResizeObserver(wire).observe(graph); else addEventListener('resize', wire);
    // the block is one screen tall: room at its top for a menu bar that stays on screen, so the heading isn't under it
    var sec = box.closest('section') || box, nav = doc.querySelector('nav.site-nav');
    var top = function () { var p = nav ? getComputedStyle(nav).position : ''; sec.style.setProperty('--nc-top', (p === 'sticky' || p === 'fixed' || (nav && body.classList.contains('hdr-transparent')) ? nav.offsetHeight : 0) + 'px'); };
    top(); addEventListener('resize', top);
    var pause = box.querySelector('.sg-nc-pause');
    var cards = Array.prototype.filter.call(box.querySelectorAll('.sg-nc-pics'), function (f) { return f.children.length > 1; });
    var rolls = box.querySelector('[data-sg-roll] .sg-ps-rail > :nth-child(2)');
    if (still || box.getAttribute('data-change') === 'still' || !cards.length) { if (pause && (still || !rolls)) pause.remove(); return; }
    var on = !window.IntersectionObserver, turn = 0;
    if (!on) new IntersectionObserver(function (en) { on = en[0].isIntersecting; }, { threshold: 0.15 }).observe(graph);
    setInterval(function () {
      if (!on || doc.hidden || box.classList.contains('paused')) return;
      var imgs = cards[turn % cards.length].children, cur = 0; turn++;
      for (var i = 0; i < imgs.length; i++) if (imgs[i].classList.contains('sg-on')) cur = i;
      var nx = imgs[(cur + 1) % imgs.length];
      if (!nx.complete || !nx.naturalWidth) { nx.loading = 'eager'; return; }   // not loaded yet: it gets its turn next round
      each(imgs, function (im) { im.classList.remove('sg-was', 'sg-in'); });
      imgs[cur].classList.remove('sg-on'); imgs[cur].classList.add('sg-was');
      nx.classList.add('sg-on', 'sg-in');
    }, Math.max(1000, 4500 / cards.length));
  });
})();

// Rolling words with photo shapes content block (shapeblock.js): the heading's last line rolls up to the next word, and
// each shape's photos take turns, while the block is on screen and not paused. With motion off the first word and
// the first photos stay.
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none';
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  each(doc.querySelectorAll('[data-sg-shapes-blk]'), function (box) {
    var pause = box.querySelector('.sg-ps-pause');
    if (still) { if (pause) pause.remove(); return; }
    var on = !window.IntersectionObserver;
    if (!on) new IntersectionObserver(function (en) { on = en[0].isIntersecting; }, { threshold: 0.1 }).observe(box);
    var live = function () { return on && !doc.hidden && !box.classList.contains('paused'); };
    var rail = box.querySelector('.sg-ps-rail');   // the rolling last line runs on its own (below)
    // the photos go round the shapes like a carousel: every shape moves on to its next photo, one just after another
    var shapes = Array.prototype.filter.call(box.querySelectorAll('.sg-ps-pics'), function (f) { return f.children.length > 1; });
    var next = function (f) {
      var imgs = f.children, cur = 0;
      for (var i = 0; i < imgs.length; i++) if (imgs[i].classList.contains('sg-on')) cur = i;
      var nx = imgs[(cur + 1) % imgs.length];
      each(imgs, function (im) { im.classList.remove('sg-was', 'sg-in'); });
      imgs[cur].classList.remove('sg-on'); imgs[cur].classList.add('sg-was');
      nx.classList.add('sg-on', 'sg-in');
    };
    if (shapes.length) setInterval(function () {
      if (!live()) return;
      // wait until every shape's next photo has loaded, so they all move together
      var ready = shapes.every(function (f) { var on = f.querySelector('.sg-on'), nx = (on && on.nextElementSibling) || f.firstElementChild; if (!nx.complete || !nx.naturalWidth) { nx.loading = 'eager'; return false; } return true; });
      if (!ready) return;
      shapes.forEach(function (f, i) { setTimeout(function () { next(f); }, i * 220); });
    }, 3400);
    if (pause && !(rail && rail.children.length > 1) && !shapes.length) pause.remove();
  });
})();

// Rolling last line of a heading (the rolling words block and the connected photo cards block): the line rolls up to
// the next word every few seconds while it is on screen and its block is not paused. A copy of the first word at the
// end lets the roll go round without a jump back. With motion off the first word stays.
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  if ((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none') return;
  Array.prototype.forEach.call(doc.querySelectorAll('[data-sg-roll]'), function (roll) {
    var rail = roll.querySelector('.sg-ps-rail'); if (!rail || rail.children.length < 2) return;
    var box = roll.closest('[data-sg-wall]') || roll, on = !window.IntersectionObserver, n = rail.children.length, at = 0;
    if (!on) new IntersectionObserver(function (en) { on = en[0].isIntersecting; }, { threshold: 0.1 }).observe(roll);
    rail.appendChild(rail.firstElementChild.cloneNode(true));
    setInterval(function () {
      if (!on || doc.hidden || box.classList.contains('paused')) return;
      at++; rail.classList.add('sg-go'); rail.style.transform = 'translateY(' + (-at * 100 / (n + 1)) + '%)';
      if (at === n) setTimeout(function () { rail.classList.remove('sg-go'); rail.style.transform = ''; at = 0; }, 700);
    }, 2400);
  });
})();

// Stacked cards content block (stackcards.js): while the block scrolls by, the top card flies off to the back, one card
// per half screen of scrolling; the arrows scroll to the next or last card (or just turn them when motion is off).
(function () {
  'use strict';
  var doc = document, body = doc.body;
  if (!body || !doc.querySelector) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || body.getAttribute('data-motion') === 'none';
  Array.prototype.forEach.call(doc.querySelectorAll('[data-sg-stack]'), function (box) {
    var cards = Array.prototype.slice.call(box.querySelectorAll('.sg-sk-card')), n = cards.length, at = 0;
    var num = box.querySelector('.sg-sk-count b');
    if (n < 2) return;
    var show = function (i, fly) {
      i = ((i % n) + n) % n; if (i === at) return;
      var old = at; at = i;
      cards.forEach(function (c, j) { var k = (j - at + n) % n; c.setAttribute('data-k', k); c.toggleAttribute('aria-hidden', k !== 0); c.classList.remove('sg-sk-out'); });
      // going forward: the card that was on top flies off before it settles at the back
      if (fly && !still && (old + 1) % n === at) { var c = cards[old]; void c.offsetWidth; c.classList.add('sg-sk-out'); }
      if (num) num.textContent = at + 1;
    };
    if (still) {
      box.addEventListener('click', function (e) { var b = e.target.closest('[data-sk]'); if (b) show(at + (b.getAttribute('data-sk') === 'next' ? 1 : -1)); });
      return;
    }
    box.classList.add('sg-live');
    var sec = box.closest('section') || box, nav = doc.querySelector('nav.site-nav');
    var top = function () { var p = nav ? getComputedStyle(nav).position : ''; sec.style.setProperty('--nc-top', (p === 'sticky' || p === 'fixed' || (nav && body.classList.contains('hdr-transparent')) ? nav.offsetHeight : 0) + 'px'); };
    top(); addEventListener('resize', top);
    // how far through the block the page has scrolled, 0 to 1
    var through = function () { var r = box.getBoundingClientRect(), run = r.height - innerHeight; return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0; };
    var draw = function () { show(Math.min(n - 1, Math.floor(through() * n)), true); };
    if (window.sgOnScroll) window.sgOnScroll(draw); else addEventListener('scroll', draw, { passive: true });
    draw();
    // the arrows: scroll to where that card is on top (past the last card goes back to the first)
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sk]'); if (!b) return;
      var i = at + (b.getAttribute('data-sk') === 'next' ? 1 : -1); i = ((i % n) + n) % n;
      var r = box.getBoundingClientRect(), run = r.height - innerHeight;
      scrollTo({ top: scrollY + r.top + run * (i + 0.5) / n, behavior: 'smooth' });
    });
  });
})();

// Your own text boxes (textboxes.js): each one moves from the page's hidden holder into the part of the page it is
// pinned to. A part is named by its content block's id, else its own id, its library family or its first class (with
// its place among parts of the same name); the editor names a part the same way when a box is added.
(function () {
  'use strict';
  var doc = document;
  if (!doc.querySelector) return;
  var parts = function () {
    var m = doc.querySelector('main'), out = m ? Array.prototype.slice.call(m.children) : [];
    var f = doc.querySelector('body > footer'); if (f) out.push(f);
    return out.filter(function (n) { return !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(n.tagName) && !n.classList.contains('sg-tx-src'); });
  };
  var base = function (el) {
    var b = el.matches('[data-sg-bid]') ? el : el.querySelector('[data-sg-bid]'); if (b) return 'b:' + b.getAttribute('data-sg-bid');
    if (el.id) return '#' + el.id;
    var f = el.matches('[data-sg-fam]') ? el : el.querySelector('[data-sg-fam]'); if (f) return 'f:' + f.getAttribute('data-sg-fam');
    var c = (el.getAttribute('class') || '').split(/\s+/)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  var textKey = function (el) {
    var k = base(el), n = 0;
    parts().some(function (p) { if (p === el) return true; if (base(p) === k) n++; return false; });
    return n ? k + '~' + n : k;
  };
  var find = function (key) { var hit = null; parts().some(function (p) { if (textKey(p) === key) { hit = p; return true; } return false; }); return hit; };
  var place = function (box) {
    var part = find(box.getAttribute('data-at')); if (!part) return false;
    if (getComputedStyle(part).position === 'static') part.style.position = 'relative';
    part.appendChild(box); return true;
  };
  window.sgText = { parts: parts, key: textKey, find: find, place: place };
  var src = doc.querySelector('.sg-tx-src');
  if (src) Array.prototype.forEach.call(src.querySelectorAll('[data-sg-tx], [data-sg-pic]'), place);   // text boxes and pictures (picboxes.js)
})();

// Hero card reel (herocard.js): a silent loop with a pause button; still for visitors who turn motion off, and
// resting while it is off screen
(function () {
  var cards = document.querySelectorAll('[data-sg-hc-reel]');
  if (!cards.length) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(cards, function (card) {
    var v = card.querySelector('video'), b = card.querySelector('.sg-hc-pause'), held = still, seen = true;
    if (!v) return;
    var sync = function () { if (held || !seen) v.pause(); else { var p = v.play(); if (p && p.catch) p.catch(function () {}); } if (b) { b.setAttribute('aria-pressed', held ? 'true' : 'false'); b.setAttribute('aria-label', held ? 'Play the moving picture' : 'Pause the moving picture'); } };
    if (still) v.removeAttribute('autoplay');
    if (b) b.addEventListener('click', function () { held = !held; sync(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; sync(); }).observe(card);
    sync();
  });
})();

// Photo, words and a big letter (thirdsblock.js): a spot with more than one photo shows them in turn; still for
// visitors who turn motion off, resting while off screen
(function () {
  var blocks = document.querySelectorAll('[data-sg-tb-turns]');
  if (!blocks.length || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  Array.prototype.forEach.call(blocks, function (blk) {
    var seen = false, spots = Array.prototype.filter.call(blk.querySelectorAll('.sg-tb-pic'), function (s) { return s.children.length > 1; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(blk); else seen = true;
    spots.forEach(function (s, k) {
      var i = 0;
      setTimeout(function () {
        setInterval(function () {
          if (!seen || document.hidden) return;
          s.children[i].classList.remove('on'); i = (i + 1) % s.children.length; s.children[i].classList.add('on');
        }, 5000);
      }, k * 2500);
    });
  });
})();

// Photo, words and a big letter: the big box's words grow as big as the box allows (one letter fills it, a few words
// share it). The CSS gives a first guess; this measures and settles the size, again whenever the box changes size.
(function () {
  var bigs = document.querySelectorAll('.sg-tb-big');
  if (!bigs.length) return;
  function fit(t) {
    var box = t.parentNode, cs = getComputedStyle(box);
    var w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = box.clientHeight * 0.88;
    if (w <= 0 || h <= 0) return;
    var lo = 8, hi = Math.max(16, Math.min(h * 1.3, 1600));
    for (var n = 0; n < 14; n++) {
      var mid = (lo + hi) / 2; t.style.fontSize = mid + 'px';
      if (t.scrollWidth <= w + 1 && t.offsetHeight <= h) lo = mid; else hi = mid;
    }
    t.style.fontSize = Math.floor(lo) + 'px';
  }
  function all() { Array.prototype.forEach.call(bigs, fit); }
  all();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { all(); }); Array.prototype.forEach.call(bigs, function (t) { ro.observe(t.parentNode); }); }
  else window.addEventListener('resize', all);
})();

// Photo mosaic hero (mosaichero.js): the menu bar's phone menu button, and spare photos taking turns in the tiles
// (one tile every 3.5s fades to the next spare photo; still for visitors who turn motion off, resting off screen)
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.sg-mh-bar'), function (bar) {
    var btn = bar.querySelector('.sg-mh-burger');
    if (btn) btn.addEventListener('click', function () { var open = bar.classList.toggle('sg-mh-open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  });
  // one screen tall, under the menu: on top of the page it takes the screen below the menu bar; lower down, the screen
  // below a menu bar that stays at the top
  // First on the page with its own menu (body.sg-mh-top, public-site.ejs): it takes the whole screen (under a top bar,
  // if the site has one) and the site's menu bar slides in at the top once this block's menu has scrolled away.
  var takeover = document.body.classList.contains('sg-mh-top');
  var first = takeover ? document.querySelector('[data-sg-mh-frame] .sg-mh-bar') : null;
  Array.prototype.forEach.call(document.querySelectorAll('[data-sg-mh-frame]'), function (sec) {
    var nav = document.getElementById('siteNav');
    var own = first && sec.contains(first);
    var set = function () {
      var top = 0, el = sec, p = nav ? getComputedStyle(nav).position : '';
      while (el) { top += el.offsetTop; el = el.offsetParent; }   // the page spot, untouched by a sliding-in reveal
      var stuck = nav && (p === 'sticky' || p === 'fixed') ? nav.offsetHeight : 0;
      sec.style.setProperty('--mh-top', (own ? Math.max(top, 0) : top < window.innerHeight * 0.6 ? Math.max(top, stuck) : stuck) + 'px');
    };
    set(); window.addEventListener('resize', set); window.addEventListener('load', set);
  });
  if (first) {
    var past = function (on) { document.body.classList.toggle('sg-mh-past', on); if (on) { var b = first.querySelector('.sg-mh-burger'); if (b) b.setAttribute('aria-expanded', 'false'); first.classList.remove('sg-mh-open'); } };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { past(!e.isIntersecting && e.boundingClientRect.top < 0); }); }).observe(first);
    else { var chk = function () { past(first.getBoundingClientRect().bottom < 0); }; window.addEventListener('scroll', chk, { passive: true }); chk(); }
  }
  var grids = document.querySelectorAll('[data-sg-mh-spare]');
  if (!grids.length || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  Array.prototype.forEach.call(grids, function (g) {
    var spare; try { spare = JSON.parse(g.getAttribute('data-sg-mh-spare')) || []; } catch (e) { spare = []; }
    var tiles = Array.prototype.slice.call(g.querySelectorAll('.sg-mh-tile'));
    if (!spare.length || !tiles.length) return;
    var seen = false, t = 0, order = [0, 4, 2, 1, 5, 3].filter(function (i) { return i < tiles.length; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(g); else seen = true;
    setInterval(function () {
      if (!seen || document.hidden) return;
      var tile = tiles[order[t % order.length]]; t++;
      var cur = tile.querySelector('img:last-child'), next = spare.shift();
      spare.push(cur.getAttribute('src'));
      var img = document.createElement('img'); img.alt = ''; img.decoding = 'async';
      img.onload = function () { tile.appendChild(img); requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('sg-mh-in'); }); }); setTimeout(function () { while (tile.children.length > 1) tile.removeChild(tile.firstChild); img.classList.remove('sg-mh-in'); }, 1100); };
      img.src = next;
    }, 3500);
  });
})();

// Photo that blends in (photoblend.js), worked out in the visitor's browser from the photo itself (Leo, 2026-11-02):
//  - the photo's own backdrop is carried out into the words side: each row takes the color the photo has at its edge
//    there, easing into the block's color (the owner's own, or the photo's overall backdrop color) further out, so
//    the seam lines up with the photo top to bottom
//  - with a fade, it finds the subject (what differs from the backdrop along that row) and fades only the backdrop
//    next to the words; the subject stays solid
//  - with photos taking turns, each photo has its own carried-out backdrop that changes with it
// Photos from the stock photo sites are read through the app (/sg-photo) because browsers won't let a page read
// another site's photo; one that still can't be read, or a phone (photo above the words), keeps the plain CSS look.
(function () {
  var boxes = document.querySelectorAll('.sg-pb');
  if (!boxes.length || !window.HTMLCanvasElement) return;
  var phone = window.matchMedia ? matchMedia('(max-width: 760px)') : { matches: false };
  var smooth = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  var dist = function (a, b) { var r = a[0] - b[0], g = a[1] - b[1], bl = a[2] - b[2]; return Math.sqrt(r * r * .3 + g * g * .59 + bl * bl * .11) * 1.7; };
  var hexRgb = function (h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var rgb = function (c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; };
  var cache = {};
  // load a photo the page may read: its own, else through the app, else straight with permission
  function load(src, done) {
    if (cache[src]) return cache[src].ok ? done(cache[src].im) : null;
    var same = !/^https?:/i.test(src) || src.indexOf(location.origin) === 0, tries = same ? [src] : [location.origin + '/sg-photo?u=' + encodeURIComponent(src), src];
    var step = function (k) {
      if (k >= tries.length) { cache[src] = { ok: false }; return; }
      var im = new Image(); if (!same) im.crossOrigin = 'anonymous';
      im.onload = function () {
        try { var c = document.createElement('canvas'); c.width = c.height = 2; c.getContext('2d').drawImage(im, 0, 0, 2, 2); c.getContext('2d').getImageData(0, 0, 1, 1); }
        catch (e) { return step(k + 1); }
        cache[src] = { ok: true, im: im }; done(im);
      };
      im.onerror = function () { step(k + 1); };
      im.src = tries[k];
    };
    step(0);
  }
  // read the photo as it is cropped on screen (object-fit: cover, object-position: center top): pixels, the backdrop
  // color along each row at the edge facing the words (rows where the subject reaches the edge borrow the nearest clean
  // row, then softened top to bottom), and the overall backdrop color
  function read(im, el, left) {
    var ew = el.clientWidth, eh = el.clientHeight; if (!ew || !eh) return null;
    var nw = im.naturalWidth, nh = im.naturalHeight, sc = Math.max(ew / nw, eh / nh), sw = ew / sc, sh = eh / sc, sx = (nw - sw) / 2;
    var W = 240, H = Math.max(40, Math.round(W * eh / ew)), c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'); x.drawImage(im, sx, 0, sw, sh, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data, rows = [], y, k;
    var px = function (cx, cy) { var i = (cy * W + cx) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    for (y = 0; y < H; y++) {
      var vs = []; for (k = 0; k < 5; k++) vs.push(px(left ? k : W - 1 - k, y));
      rows.push([0, 1, 2].map(function (ch) { var v = vs.map(function (p) { return p[ch]; }).sort(function (a, b) { return a - b; }); return v[2]; }));
    }
    var med = [0, 1, 2].map(function (ch) { var v = rows.map(function (r) { return r[ch]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; });
    var clean = rows.map(function (r) { return dist(r, med) < 55; });
    var bg = rows.map(function (r, y0) { if (clean[y0]) return r; for (var o = 1; o < H; o++) { if (clean[y0 - o]) return rows[y0 - o]; if (clean[y0 + o]) return rows[y0 + o]; } return med; });
    var R = Math.max(2, Math.round(H * .03)), soft = bg.map(function (r, y0) { var s = [0, 0, 0], n = 0; for (var o = -R; o <= R; o++) { var q = bg[y0 + o]; if (q) { s[0] += q[0]; s[1] += q[1]; s[2] += q[2]; n++; } } return [s[0] / n, s[1] / n, s[2] / n]; });
    var all = [0, 0, 0], n = 0; soft.forEach(function (r, y0) { if (y0 >= H * .08 && y0 <= H * .92) { all[0] += r[0]; all[1] += r[1]; all[2] += r[2]; n++; } });
    return { W: W, H: H, d: d, x: x, bg: bg, soft: soft, all: [all[0] / n, all[1] / n, all[2] / n] };
  }
  // the photo's mask: fades only the backdrop next to the words; the subject stays solid
  function mask(r, left, frac) {
    var W = r.W, H = r.H, d = r.d, fw = Math.max(4, Math.round(W * frac)), a = new Float32Array(W * H), y, i;
    for (y = 0; y < H; y++) for (var cx = 0; cx < W; cx++) {
      var dx = left ? cx : W - 1 - cx;
      if (dx >= fw) { a[y * W + cx] = 1; continue; }
      var j = (y * W + cx) * 4, sub = smooth((dist([d[j], d[j + 1], d[j + 2]], r.bg[y]) - 20) / 40);
      a[y * W + cx] = Math.max(smooth(dx / fw), sub * smooth(dx / (fw * .18)));
    }
    for (var pass = 0; pass < 2; pass++) { var b = new Float32Array(a); for (y = 1; y < H - 1; y++) for (i = 1; i < W - 1; i++) { var q = y * W + i; b[q] = Math.max(a[q], a[q - 1], a[q + 1], a[q - W], a[q + W]); } a = b; }
    var out = r.x.createImageData(W, H);
    for (i = 0; i < W * H; i++) { out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 255; out.data[i * 4 + 3] = Math.round(a[i] * 255); }
    var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
    var c2 = document.createElement('canvas'); c2.width = W; c2.height = H; var x2 = c2.getContext('2d');
    x2.filter = 'blur(2px)'; x2.drawImage(c, 0, 0); x2.filter = 'none'; x2.drawImage(c, 0, 0);
    return c2.toDataURL('image/png');
  }
  // the backdrop carried out across the whole block: the base color far out, the photo's edge color by the seam
  function backdrop(r, base, seam, wordsW, left) {
    var EW = 160, H = r.H, c = document.createElement('canvas'); c.width = EW; c.height = H;
    var x = c.getContext('2d'), img = x.createImageData(EW, H), reach = .35;   // how far into the words side the photo's colors reach
    for (var cx = 0; cx < EW; cx++) {
      var pos = (cx + .5) / EW, u = left ? (seam - pos) / wordsW : (pos - seam) / wordsW;   // 0 at the seam, 1 at the far side
      var w = u <= 0 ? 1 : 1 - smooth(u / reach);
      for (var y = 0; y < H; y++) {
        var e = r.soft[y], j = (y * EW + cx) * 4;
        img.data[j] = base[0] + (e[0] - base[0]) * w; img.data[j + 1] = base[1] + (e[1] - base[1]) * w; img.data[j + 2] = base[2] + (e[2] - base[2]) * w; img.data[j + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  Array.prototype.forEach.call(boxes, function (box) {
    var el = box.querySelector('.sg-pb-photo'), words = box.querySelector('.sg-pb-words'); if (!el || box.classList.contains('sg-pb-cut')) return;   // cut-outs need none of this
    var left = box.classList.contains('sg-pb-right'), fade = box.classList.contains('sg-pb-fade') || box.classList.contains('sg-pb-both');
    var match = box.classList.contains('sg-pb-match') || box.classList.contains('sg-pb-both');
    var own = box.hasAttribute('data-sg-pb-match') ? null : hexRgb(box.style.getPropertyValue('--pb-bg'));
    var imgs = Array.prototype.slice.call(el.querySelectorAll('img')), layers = [];
    var onIdx = function () { var i = imgs.findIndex(function (m) { return m.classList.contains('on'); }); return i < 0 ? 0 : i; };
    var ink = function (i) {
      if (own || !layers[i] || !layers[i].base) return;
      var b = layers[i].base, lum = (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]) / 255;
      box.style.setProperty('--pb-bg', rgb(b)); box.style.setProperty('--pb-ink', lum > 0.55 ? '#111111' : '#ffffff');
    };
    var show = function () { var i = onIdx(); layers.forEach(function (l, k) { if (l.el) l.el.classList.toggle('on', k === i); }); ink(i); };
    var run = function () {
      if (phone.matches) { box.classList.remove('sg-pb-smart', 'sg-pb-carried'); return; }
      var frac = parseFloat(getComputedStyle(box).getPropertyValue('--pb-fade')) / 100 || .2, done = 0;
      var br = box.getBoundingClientRect(), pr = el.getBoundingClientRect(); if (!br.width) return;
      var seam = ((left ? pr.left : pr.right) - br.left) / br.width, wordsW = Math.max(.2, left ? seam : 1 - seam);   // the words side, as a share of the block
      imgs.forEach(function (img, i) {
        load(img.getAttribute('src'), function (im) {
          var r = read(im, el, left); if (!r) return;
          if (fade) {
            var m = mask(r, left, frac);
            ['maskImage', 'webkitMaskImage'].forEach(function (p) { img.style[p] = 'url(' + m + ')'; });
            ['maskSize', 'webkitMaskSize'].forEach(function (p) { img.style[p] = '100% 100%'; });
          }
          var base = own || r.all;
          if (match || own) {
            var l = layers[i] || (layers[i] = {});
            if (!l.el) { l.el = document.createElement('div'); l.el.className = 'sg-pb-ext'; l.el.setAttribute('aria-hidden', 'true'); box.insertBefore(l.el, box.firstChild); }
            l.el.style.backgroundImage = 'url(' + backdrop(r, base, seam, wordsW, left) + ')'; l.base = base;
          }
          if (++done === imgs.length) { if (fade) box.classList.add('sg-pb-smart'); if (layers.length) box.classList.add('sg-pb-carried'); show(); }
        });
      });
    };
    run();
    if (imgs.length > 1 && window.MutationObserver) new MutationObserver(show).observe(el, { subtree: true, attributes: true, attributeFilter: ['class'] });
    var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(run, 250); });
  });
})();

// Photo picks the words (phototabs.js): the small photos are tabs; picking one shows its big photo and its card and
// takes on its color. Arrow keys move between them. Without this script the first card shows.
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-sg-pt]'), function (blk) {
    var tabs = blk.querySelectorAll('.sg-pt-tab'), cards = blk.querySelectorAll('.sg-pt-card'), pics = blk.querySelectorAll('.sg-pt-pic');
    function pick(n, focus) {
      Array.prototype.forEach.call(tabs, function (t, i) { t.setAttribute('aria-selected', i === n ? 'true' : 'false'); t.tabIndex = i === n ? 0 : -1; });
      Array.prototype.forEach.call(cards, function (c, i) { c.hidden = i !== n; });
      Array.prototype.forEach.call(pics, function (p, i) { p.classList.toggle('on', i === n); });
      if (cards[n]) { blk.style.setProperty('--pt-c', cards[n].getAttribute('data-c')); blk.style.setProperty('--pt-on', cards[n].getAttribute('data-on')); }
      if (focus && tabs[n]) tabs[n].focus();
    }
    Array.prototype.forEach.call(tabs, function (t, i) {
      t.addEventListener('click', function () { pick(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length;
        if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); pick((i + 1) % n, true); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); pick((i - 1 + n) % n, true); }
        else if (k === 'Home') { e.preventDefault(); pick(0, true); } else if (k === 'End') { e.preventDefault(); pick(n - 1, true); }
      });
    });
  });
})();
