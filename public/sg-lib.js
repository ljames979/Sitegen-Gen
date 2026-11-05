/* Behavior for the section library: tabs and carousel arrows. No framework. Without this file the tab panels
   all show and the carousel still swipes, so the page never depends on it. */
(function () {
  document.querySelectorAll('[data-sg-tabs]').forEach(function (root) {
    var tabs = [].slice.call(root.querySelectorAll('[data-sg-tab]'));
    var panels = [].slice.call(root.querySelectorAll('[data-sg-panel]'));
    if (!tabs.length || tabs.length !== panels.length) return;
    function show(i) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.style.borderColor = on ? 'var(--primary)' : '';
        t.style.background = on ? 'var(--primary)' : '';
        t.style.color = on ? 'var(--on-primary)' : '';
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p, n) { p.hidden = n !== i; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, to = k === 'ArrowRight' ? (i + 1) % tabs.length : k === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
        if (to >= 0) { e.preventDefault(); show(to); tabs[to].focus(); }
      });
    });
    show(0);
  });
  document.querySelectorAll('[data-sg-carousel]').forEach(function (root) {
    var track = root.querySelector('[data-sg-track]'), arrows = root.querySelector('[data-sg-arrows]');
    if (!track || !arrows) return;
    arrows.hidden = false;
    var step = function () { var c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 16 : 300; };
    root.querySelector('[data-sg-prev]').addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    root.querySelector('[data-sg-next]').addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
  });
  document.querySelectorAll('[data-sg-quotes]').forEach(function (root) {
    var quotes = [].slice.call(root.querySelectorAll('[data-sg-quote]')), btns = [].slice.call(root.querySelectorAll('[data-sg-quote-btn]'));
    var nav = root.querySelector('[data-sg-quote-nav]');
    if (quotes.length < 2 || !nav) return;
    nav.hidden = false;
    function show(i) {
      quotes.forEach(function (q, n) { q.hidden = n !== i; });
      btns.forEach(function (b, n) {
        var on = n === i; b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.style.background = on ? 'var(--primary)' : ''; b.style.color = on ? 'var(--on-primary)' : ''; b.style.borderColor = on ? 'var(--primary)' : '';
      });
    }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
    show(0);
  });
  // Gallery carousel: thumbnails under the big photo jump to it. Without this the photos are a swipeable row.
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-sg-slides]').forEach(function (root) {
    var track = root.querySelector('[data-sg-track]'), thumbs = root.querySelector('[data-sg-thumbs]');
    if (!track || !thumbs) return;
    thumbs.hidden = false;
    var btns = [].slice.call(thumbs.querySelectorAll('[data-sg-thumb]'));
    function mark(i) { btns.forEach(function (b, n) { var on = n === i; b.style.opacity = on ? '1' : ''; b.style.borderColor = on ? 'var(--primary)' : ''; b.setAttribute('aria-current', on ? 'true' : 'false'); }); }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { track.scrollTo({ left: track.clientWidth * i, behavior: still ? 'auto' : 'smooth' }); mark(i); }); });
    track.addEventListener('scroll', function () { mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))); }, { passive: true });
    mark(0);
  });
  // Parallax hero scenes: layers drift down at different speeds as the page scrolls. Off with reduced motion.
  var scenes = [].slice.call(document.querySelectorAll('[data-sg-parallax]'));
  if (scenes.length && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var ticking = false;
    var update = function () {
      ticking = false;
      scenes.forEach(function (sc) {
        var r = sc.getBoundingClientRect(), vh = window.innerHeight || 800;
        if (r.bottom < 0 || r.top > vh) return;
        var rel = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        [].slice.call(sc.querySelectorAll('[data-speed]')).forEach(function (l) {
          l.style.transform = 'translate3d(0,' + (rel * parseFloat(l.getAttribute('data-speed')) * 140).toFixed(1) + 'px,0)';
        });
      });
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  // Showcase strip hero: the pause button for the gliding photos
  document.querySelectorAll('[data-sg-glide]').forEach(function (stage) {
    var b = stage.querySelector('[data-sg-glide-pause]');
    if (!b) return;
    var what = b.getAttribute('data-what') || 'photos';
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', (on ? 'Play the moving ' : 'Pause the moving ') + what);
      if (on) stage.setAttribute('data-paused', ''); else stage.removeAttribute('data-paused');
    });
  });
  // Showcase strip hero: badges and reviews shown one after another. Without this file (or with motion off) the
  // first one stays; hovering or focusing holds the current one.
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.getAttribute('data-motion') === 'none';
  if (!still) document.querySelectorAll('[data-sg-cycle]').forEach(function (root) {
    var items = [].slice.call(root.children), i = 0, hold = false;
    if (items.length < 2) return;
    root.addEventListener('mouseenter', function () { hold = true; });
    root.addEventListener('mouseleave', function () { hold = false; });
    root.addEventListener('focusin', function () { hold = true; });
    root.addEventListener('focusout', function () { hold = false; });
    setInterval(function () {
      if (hold || document.hidden) return;
      items[i].setAttribute('data-on', '0'); items[i].setAttribute('aria-hidden', 'true');
      i = (i + 1) % items.length;
      items[i].setAttribute('data-on', '1'); items[i].removeAttribute('aria-hidden');
    }, Math.max(2000, parseInt(root.getAttribute('data-sg-cycle'), 10) || 4000));
  });

  // Word carousel collage hero: the headline's words rise in one by one; the service names slide through the photo
  // card every few seconds (the card wipes to that service's photo, two scattered photos swap). Pointing at or tabbing
  // to a name shows it and holds the row; it waits while off screen. Motion off: no rising and no sliding, but pointing
  // at a name still changes the card.
  document.querySelectorAll('[data-sg-collage]').forEach(function (root) {
    var stillC = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.getAttribute('data-motion') === 'none';
    var h1 = root.querySelector('[data-sg-cl-h1]'), stage = root.querySelector('[data-sg-cl-stage]');
    if (h1 && !stillC) {
      var n = 0, walk = document.createTreeWalker(h1, 4), texts = [], t;
      while ((t = walk.nextNode())) texts.push(t);
      h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
      texts.forEach(function (node) {
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          var s = document.createElement('span'); s.className = 'sg-cl-w'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', n++); s.textContent = w; frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      });
    }
    if (!stage) return;
    // banner look: the lines run across nonstop, so copies follow the originals for a seamless loop (hidden from readers)
    var banner = root.hasAttribute('data-sg-cl-banner') && !stillC, row0 = stage.querySelector('[data-sg-cl-row]');
    if (banner && row0) {
      var orig = [].slice.call(row0.children), copies = Math.max(2, Math.ceil(stage.clientWidth / Math.max(1, row0.scrollWidth)) + 1);
      for (var c = 0; c < copies; c++) orig.forEach(function (li) {
        var cp = li.cloneNode(true); cp.setAttribute('aria-hidden', 'true');
        [].forEach.call(cp.querySelectorAll('[data-sg-cl-word]'), function (w) { w.classList.remove('sg-on'); w.setAttribute('tabindex', '-1'); });
        row0.appendChild(cp);
      });
    }
    var row = row0, words = [].slice.call(stage.querySelectorAll('[data-sg-cl-word]'));
    var imgs = stage.querySelectorAll('[data-sg-cl-img]'), tiles = [].slice.call(stage.querySelectorAll('[data-sg-cl-tile]'));
    var photos = []; try { photos = JSON.parse(stage.getAttribute('data-photos') || '[]'); } catch (e) {}
    if (words.length < 2 || imgs.length < 2) return;
    var cur = 0, step = 0, front = imgs[0], back = imgs[1], held = false, seen = true, timer = 0, swap = 0;
    // the photo that wiped in becomes the one on show, the other waits hidden for the next wipe
    var settle = function () { clearTimeout(swap); back.classList.remove('sg-on', 'in'); front.classList.add('sg-on'); front.classList.remove('in'); };
    var swapTile = function (img, src) { if (!img || !src) return; img.parentNode.classList.add('sg-cl-swap'); setTimeout(function () { img.setAttribute('src', src); img.parentNode.classList.remove('sg-cl-swap'); }, 350); };
    root.classList.add('sg-live');
    var place = function () { if (banner) return; var w = words[cur], x = stage.clientWidth / 2 - (w.offsetLeft + w.offsetWidth / 2); row.style.transform = 'translateX(' + x.toFixed(1) + 'px)'; };
    // stay: pointing at a name lights it where it is (sliding the row would move another name under the mouse)
    var show = function (i, stay) {
      if (i === cur) return;
      words[cur].classList.remove('sg-on'); cur = i; words[cur].classList.add('sg-on'); if (!stay) place();
      var src = words[cur].getAttribute('data-photo');
      if (src && front.getAttribute('src') !== src) {
        settle();
        back.setAttribute('src', src); void back.offsetWidth; back.classList.add('in');
        var b = back; back = front; front = b;
        swap = setTimeout(settle, stillC ? 0 : 900);
      }
      // two of the scattered photos swap for ones not on show (any photo when the site has only a few)
      if (!stillC && photos.length) for (var k = 0; k < 2; k++) {
        var tile = tiles[(step * 2 + k) % tiles.length], shown = tiles.map(function (x) { return x.getAttribute('src'); });
        var fresh = photos.filter(function (p) { return shown.indexOf(p) < 0; }), pool = fresh.length ? fresh : photos;
        swapTile(tile, pool[(step + k) % pool.length]);
      }
      step++;
    };
    words.forEach(function (w, i) {
      w.addEventListener('mouseenter', function () { held = true; show(i, true); });
      w.addEventListener('mouseleave', function () { held = false; });
      w.addEventListener('focus', function () { held = true; show(i); });
      w.addEventListener('blur', function () { held = false; });
    });
    row.addEventListener('mouseleave', function () { place(); });
    place();
    addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    if (stillC) return;
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(stage);
    var k = parseFloat(getComputedStyle(document.body).getPropertyValue('--mp-k')) || 1;
    if (banner) {
      // the row glides left at a steady speed; whichever line is over the card lights up and brings its photo
      var n = row.children.length / (copies + 1), unit = 0, mids = [], x = 0, last = 0;
      var measure = function () {
        unit = words[n] ? words[n].offsetLeft - words[0].offsetLeft : row.scrollWidth;
        mids = words.map(function (w) { return w.offsetLeft + w.offsetWidth / 2; });
      };
      measure(); x = stage.clientWidth / 2 - mids[0];
      addEventListener('resize', measure); if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      var run = function (t) {
        var dt = last ? Math.min(64, t - last) : 0; last = t;
        if (!held && seen && !document.hidden && unit > 0) {
          x -= dt * 0.07 / Math.max(0.7, k);
          while (x > 0) x -= unit; while (x <= -unit) x += unit;
          row.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
          var mid = stage.clientWidth / 2 - x, best = 0, bd = Infinity;
          mids.forEach(function (m, i) { var dd = Math.abs(m - mid); if (dd < bd) { bd = dd; best = i; } });
          if (best !== cur) show(best, true);
        }
        requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      return;
    }
    timer = setInterval(function () { if (!held && seen && !document.hidden) show((cur + 1) % words.length); }, 2600 * k);
  });
})();
