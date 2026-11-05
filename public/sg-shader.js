/* sg-shader.js: the Showcase tier's animated hero background (a small WebGL gradient shader, no libraries).
   Preset comes from <body data-shader="aurora|mesh|silk">. Colours are the site's theme colours, shifted dark or
   light to suit the hero text, so every style works. It starts after the page has loaded, fades in (opacity only),
   pauses when the hero is off screen or the tab is hidden, and draws a single still frame for reduced motion.
   If WebGL is unavailable or the context is lost, a plain gradient in the same colours is shown instead. */
(function () {
  'use strict';
  var doc = document;
  var reduceQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var el = null, gl = null, raf = 0, visible = true, running = false, t0 = 0, last = 0, prog = null, loc = {}, hero = null, ro = null;

  var COMMON = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 r;uniform float t;uniform vec3 b,c1,c2;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}' +
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}' +
    'void main(){vec2 uv=gl_FragCoord.xy/r;uv.x*=r.x/r.y;float T=t*.12;vec3 col=b;';
  var END = 'col+=(h(gl_FragCoord.xy+t)-.5)/200.;gl_FragColor=vec4(col,1.);}';
  var FRAG = {
    aurora: COMMON +
      'float w=fbm(vec2(uv.x*1.4,T*2.));' +
      'float y1=.58+.16*sin(uv.x*2.1+T*5.+w*3.);float y2=.40+.14*sin(uv.x*1.6-T*4.+w*4.+2.);' +
      'float a=smoothstep(.0,.55,1.-abs(uv.y-y1)*2.4);float c=smoothstep(.0,.5,1.-abs(uv.y-y2)*2.8);' +
      'col=mix(col,c1,a*.9);col=mix(col,c2,c*.75);col=mix(col,mix(c1,c2,.5),a*c*.5);' + END,
    mesh: COMMON +
      'vec2 p1=vec2(.35+.25*sin(T*3.),.55+.2*cos(T*2.4));vec2 p2=vec2(1.05+.3*cos(T*2.1),.4+.25*sin(T*2.7));vec2 p3=vec2(.7+.3*sin(T*1.7+2.),.8+.15*cos(T*3.1));' +
      'float w1=exp(-pow(length(uv-p1),2.)*3.2);float w2=exp(-pow(length(uv-p2),2.)*2.6);float w3=exp(-pow(length(uv-p3),2.)*3.6);' +
      'col=mix(col,c1,clamp(w1*1.1,0.,1.));col=mix(col,c2,clamp(w2*1.0,0.,1.));col=mix(col,mix(c1,c2,.5),clamp(w3*.9,0.,1.));' + END,
    silk: COMMON +
      'float v=sin(uv.x*3.2+sin(uv.y*2.6+T*6.)*1.6+T*5.)*.5+.5;float u=sin(uv.x*5.4-uv.y*2.+T*4.+v*2.)*.5+.5;' +
      'col=mix(b,c1,smoothstep(.15,.85,v)*.85);col=mix(col,c2,smoothstep(.55,1.,u)*.55);col+=vec3(.05)*pow(u*v,3.);' + END
  };
  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  function rgb(css, fb) {
    try { var c = doc.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = css || fb; var h = c.fillStyle; return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
    catch (e) { return [37, 99, 235]; }
  }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function palette() {
    var cs = getComputedStyle(doc.documentElement);
    var P = rgb(cs.getPropertyValue('--primary').trim(), '#2563eb'), A = rgb(cs.getPropertyValue('--accent').trim(), '#0ea5e9');
    var h1 = hero && hero.querySelector('h1');
    var text = h1 ? rgb(getComputedStyle(h1).color, '#ffffff') : [255, 255, 255];
    var light = lum(text) > 0.5;                    // light text means a dark background behind it
    var K = [0, 0, 0], W = [255, 255, 255];
    return light
      ? { b: mix(P, K, 0.72), c1: mix(P, K, 0.3), c2: mix(A, K, 0.42) }
      : { b: mix(P, W, 0.93), c1: mix(P, W, 0.74), c2: mix(A, W, 0.68) };
  }
  var css = function (c) { return 'rgb(' + c.map(function (v) { return Math.round(v); }).join(',') + ')'; };
  var vec = function (c) { return [c[0] / 255, c[1] / 255, c[2] / 255]; };

  function fallback(pal) {
    el = doc.createElement('div'); el.className = 'sg-shader';
    el.style.backgroundImage = 'linear-gradient(135deg,' + css(pal.c1) + ' 0%,' + css(pal.b) + ' 50%,' + css(pal.c2) + ' 100%)';
  }
  function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader'); return s; }

  function size() {
    var w = Math.max(2, Math.min(960, Math.round(hero.clientWidth * 0.5))), hgt = Math.max(2, Math.round(hero.clientHeight * (w / Math.max(1, hero.clientWidth))));
    if (el.width !== w || el.height !== hgt) { el.width = w; el.height = hgt; }
    gl.viewport(0, 0, el.width, el.height);
  }
  function draw(now) {
    if (!gl) return;
    gl.uniform2f(loc.r, el.width, el.height);
    gl.uniform1f(loc.t, reduceQ.matches ? 14 : (now - t0) / 1000 + 14);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    raf = 0;
    if (!running || !visible || doc.hidden) return;
    if (now - last >= 33) { last = now; draw(now); }    // about 30 frames a second is plenty for a slow gradient
    raf = requestAnimationFrame(frame);
  }
  function play() { if (running || reduceQ.matches || !gl) return; running = true; if (!raf) raf = requestAnimationFrame(frame); }
  function pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function build() {
    hero = doc.getElementById('hero'); if (!hero) return;
    var pal = palette(), name = doc.body.getAttribute('data-shader');
    if (!FRAG[name]) name = 'aurora';
    var canvas = doc.createElement('canvas');
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('nogl');
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG[name]));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var a = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      ['r', 't', 'b', 'c1', 'c2'].forEach(function (k) { loc[k] = gl.getUniformLocation(prog, k); });
      gl.uniform3fv(loc.b, vec(pal.b)); gl.uniform3fv(loc.c1, vec(pal.c1)); gl.uniform3fv(loc.c2, vec(pal.c2));
      canvas.className = 'sg-shader'; canvas.setAttribute('aria-hidden', 'true'); el = canvas;
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); teardown(); fallback(pal); place(); }, false);
    } catch (e) { gl = null; fallback(pal); }
    place();
    if (gl) {
      size(); t0 = performance.now(); draw(t0);
      ro = window.ResizeObserver ? new ResizeObserver(function () { if (gl) { size(); draw(performance.now()); } }) : null;
      if (ro) ro.observe(hero);
      if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); else pause(); }, { threshold: 0 }).observe(hero);
      play();
    }
    requestAnimationFrame(function () { el.classList.add('on'); });
  }
  function place() {
    var before = hero.querySelector('.hero-fx, .hero-inner');
    hero.insertBefore(el, before || null); hero.classList.add('sg-shader-on');
  }
  function teardown() {
    pause(); if (ro) { ro.disconnect(); ro = null; }
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (hero) hero.classList.remove('sg-shader-on');
    gl = null; el = null;
  }
  function sync() {
    var off = (doc.body.getAttribute('data-motion') || 'none') === 'none';
    if (off && el) teardown(); else if (!off && !el) build();
  }

  function start() {
    var go = function () { try { sync(); } catch (e) { try { teardown(); } catch (e2) {} } };
    // after the page itself has loaded, so it never delays what visitors see first
    var later = function () { if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 200); };
    if (doc.readyState === 'complete') later(); else window.addEventListener('load', later);
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) pause(); else if (visible) play(); });
    try { new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ['data-motion'] }); } catch (e) {}
  }
  start();
})();
