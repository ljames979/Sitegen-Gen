// Company name colors: the business name in the header (and the footer) can take one color of the owner's choice,
// a shine of the brand colors that sweeps across it, or a slow change from one brand color to the next. Every color
// is first moved just far enough toward black or white to stay readable (4.5:1) on the background it sits on, so a
// pale brand color never makes the name hard to read. Visitors who ask for less motion see the first color, still.
const contrast = require('./contrast');

const MODES = [
  { id: '', label: 'As the style shows it' },
  { id: 'color', label: 'One color of your choice' },
  { id: 'shimmer', label: 'A shine of your brand colors sweeps across it' },
  { id: 'cycle', label: 'Slowly changes from one brand color to the next' },
];
const MODE_IDS = MODES.map(m => m.id);
const HEX = /^#[0-9a-fA-F]{6}$/;

function parse(b) {
  const c = String(b.theme_nameColor || '').trim();
  return {
    nameFx: MODE_IDS.includes(b.theme_nameFx) ? b.theme_nameFx : '',
    nameColor: HEX.test(c) ? c.toLowerCase() : '',
  };
}

const mix = (a, b, t) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return contrast.toHex(x.map((v, i) => v + (y[i] - v) * t)); };

// The colors the name uses on one background, each readable there. 'color' gives one; the moving modes give two or
// three different ones (a second shade of the brand color is added when the brand only has one).
function palette(theme, bg) {
  const t = theme || {};
  const back = HEX.test(bg || '') ? bg : '#ffffff';
  const own = HEX.test(t.nameColor || '') ? t.nameColor : '';
  const primary = HEX.test(t.primaryColor || '') ? t.primaryColor : '#2563eb';
  const accent = HEX.test(t.accentColor || '') ? t.accentColor : '';
  const fit = c => contrast.ensureContrast(c, back, contrast.AA_TEXT).toLowerCase();
  if (t.nameFx === 'color') return [fit(own || primary)];
  const out = [];
  // colors too close to tell apart (two similar reds, say) count as one, so the name visibly changes
  const near = (a, b) => { const x = contrast.parseHex(a), y = contrast.parseHex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70; };
  [own, primary, accent].filter(Boolean).map(fit).forEach(c => { if (!out.some(o => near(o, c))) out.push(c); });
  if (out.length < 2) {
    // one brand color only: pair it with a deeper (light backgrounds) or lighter (dark backgrounds) shade of itself
    const shade = fit(mix(out[0], contrast.luminance(back) > 0.5 ? '#000000' : '#ffffff', 0.45));
    out.push(shade === out[0] ? fit(mix(out[0], accent || '#7c3aed', 0.5)) : shade);
  }
  return out.slice(0, 3);
}

// The backgrounds behind the name for this style: the header (the page background, or the style's own header color),
// the footer (the dark ink band, the accent band for Agency, or the style's own footer color) and the visitor dark
// mode page. `base` holds the built-in style's page and ink colors, the dark mode page ('' when there is none) and
// the owner's own header color (nav, '' when the header keeps the style's look).
function backgrounds(theme, extraTheme, base) {
  const t = theme || {}, x = extraTheme || null, b = base || {};
  const hex = v => (HEX.test(String(v || '').trim()) ? String(v).trim() : '');
  const vars = (x && x.vars) || {};
  const page = (x && x.dark && hex(t.bgColor)) || hex(vars['--page-bg']) || hex(b.pageBg) || '#ffffff';
  const own = sel => { const m = String((x && x.css) || '').match(new RegExp(sel + '\\s*\\{[^}]*background:\\s*([^;}]+)')); return m ? m[1].trim() : ''; };
  const resolve = v => { const m = /^var\((--[\w-]+)\)$/.exec(v); return m ? hex(vars[m[1]]) : hex(v); };
  const navOwn = own('nav\\.site-nav');
  const nav = hex(b.nav) || (navOwn && resolve(navOwn)) || page;   // b.nav: the owner's own header color
  let footer;
  const footOwn = own('footer\\.site-footer');
  if (footOwn) footer = /color-mix\(in srgb, var\(--page-bg\) 78%, black\)/.test(footOwn) ? mix(page, '#000000', 0.22) : resolve(footOwn);
  else footer = b.agency ? hex(t.accentColor) : (hex(vars['--ink']) || hex(b.ink));
  return { nav, footer: footer || '', dark: hex(b.dark) };
}

// The CSS for the name, as one string for the page's <style>. `ctx` names the backgrounds:
// nav (header background), footer (footer background, '' to leave the footer as it is) and dark (the visitor dark
// mode page, '' when the site has none).
function css(theme, ctx) {
  const t = theme || {};
  if (!t.nameFx) return '';
  const c = ctx || {};
  const rules = [];
  const block = (sel, cols) => {
    const v = cols.map((x, i) => `--nm${i + 1}: ${x}`).join('; ');
    const ring = cols.concat(cols[0]);
    const stops = ring.map((x, i) => `${x} ${Math.round(i * 100 / (ring.length - 1))}%`).join(', ');
    // blended in OKLCH where the browser can, so the colors in between stay bright instead of turning grey
    rules.push(`${sel} { ${v}; --nm-grad: linear-gradient(100deg, ${stops}); --nm-grad-ok: linear-gradient(in oklch 100deg, ${stops}); }`);
  };
  block('nav.site-nav .brand', palette(t, c.nav));
  if (c.footer) block('.footer-grid .brand', palette(t, c.footer));
  if (c.dark) block('html[data-theme="dark"] body :is(nav.site-nav, .footer-grid) .brand', palette(t, c.dark));
  // over a hero photo (see-through header at the top of the page) the name uses light tints of the colors, read
  // against a dark photo the way the header's white links are, with a soft shadow under the letters
  block('body.hdr-transparent nav.site-nav:not(.scrolled) .brand', palette(t, '#2a2a2a'));
  rules.push('body.hdr-transparent nav.site-nav:not(.scrolled) .brand .sg-name { text-shadow: none; filter: drop-shadow(0 1px 6px rgba(0,0,0,.5)); }');
  const where = `:is(nav.site-nav${c.footer ? ', .footer-grid' : ''}) .brand .sg-name`;
  rules.push(`:is(${where}) { color: var(--nm1); }`);
  if (t.nameFx === 'shimmer') {
    rules.push(`@supports ((-webkit-background-clip: text) or (background-clip: text)) { :is(${where}) { background: var(--nm-grad); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; } }`);
    rules.push(`@supports (background-image: linear-gradient(in oklch, red, blue)) { :is(${where}) { background-image: var(--nm-grad-ok); } }`);
    rules.push(`@media (prefers-reduced-motion: no-preference) { :is(${where}) { animation: sg-nm-shine 6s linear infinite; } }`);
    rules.push('@keyframes sg-nm-shine { from { background-position: 0% 50%; } to { background-position: 150% 50%; } }');
  } else if (t.nameFx === 'cycle') {
    rules.push(`@media (prefers-reduced-motion: no-preference) { :is(${where}) { animation: sg-nm-cycle 9s ease-in-out infinite; } }`);
    rules.push('@keyframes sg-nm-cycle { 0%, 100% { color: var(--nm1); } 33% { color: var(--nm2); } 66% { color: var(--nm3, var(--nm1)); } }');
  }
  rules.push(`${where} { display: inline-block; }`);
  return rules.join('\n');
}

module.exports = { MODES, MODE_IDS, parse, palette, backgrounds, css };
