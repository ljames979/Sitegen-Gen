// Word styling: any words in any text the owner types can be made bigger or smaller, set in another font, colored,
// bold or italic. The editor wraps the chosen words as {{words|option|option}}, for example
// {{best pizza|bigger|Playfair Display|#e11d48|bold}}. Options, in any order:
//   size    smaller | big | bigger | huge, or an exact size from 8px to 200px
//   color   brand | accent | #rrggbb
//   style   bold | italic
//   font    a Google Font name (one the font list knows, or a name written like one: "Open Sans")
// The finished page is rewritten once, after it is drawn: in the page's text the words get a <span> with those
// styles; where only plain words make sense (the browser tab title, a photo's description, share and search
// details) the markers come off and the words stay.
const fonts = require('./fonts');

const SIZES = { smaller: '0.8em', big: '1.25em', bigger: '1.6em', huge: '2.2em' };
const SIZE_LABELS = [['', 'Same size'], ['smaller', 'Smaller'], ['big', 'Big'], ['bigger', 'Bigger'], ['huge', 'Huge'], ['px', 'Exact size']];
const COLORS = { brand: 'var(--primary)', accent: 'var(--accent)' };
const HEX = /^#[0-9a-f]{6}$/i;
// words, then one or more |options; no braces inside, and short enough that it can't run across a page
const MARK = /\{\{([^{}|<>]{1,300}?)((?:\|[^{}|<>]{0,40}){1,6})\}\}/g;

// a font on the list, or a typed name written like one (each word starting with a capital: "Open Sans")
const isFont = (n) => fonts.FONTS.some(f => f.name.toLowerCase() === n.toLowerCase()) || (/^[A-Z][A-Za-z0-9]*( [A-Z0-9][A-Za-z0-9]*)*$/.test(n) && !!fonts.cleanFontName(n));
// the options as a style list, and any font to load
function read(opts) {
  const css = [];
  let font = '';
  for (const raw of opts.split('|').map(o => o.trim()).filter(Boolean)) {
    const o = raw.toLowerCase();
    if (SIZES[o]) css.push(`font-size:${SIZES[o]}`);
    else if (/^\d{1,3}px$/.test(o) && +o.slice(0, -2) >= 8 && +o.slice(0, -2) <= 200) css.push(`font-size:${o}`);
    else if (COLORS[o]) css.push(`color:${COLORS[o]}`);
    else if (HEX.test(raw)) css.push(`color:${raw.toLowerCase()}`);
    else if (o === 'bold') css.push('font-weight:700');
    else if (o === 'italic') css.push('font-style:italic');
    else if (!font && isFont(raw)) { font = fonts.cleanFontName(raw); css.push(`font-family:'${font}',inherit`); }
  }
  return { css: css.join(';'), font };
}

// the words without their markers (for plain text: titles, descriptions, emails)
function plain(s) {
  return String(s == null ? '' : s).replace(MARK, '$1');
}

// the whole page: styled words in its text, plain words in attributes and raw-text tags, fonts loaded once
function apply(html) {
  if (typeof html !== 'string' || html.indexOf('{{') < 0) return html;
  const used = new Set();
  const out = html.replace(/<(script|style|title|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<[^>]*>|[^<]+/gi, (part, raw) => {
    if (raw) {
      const tag = raw.toLowerCase();
      // code is left alone, except the search details (JSON-LD), which carry the plain words
      if ((tag === 'script' && !/^<script[^>]*application\/ld\+json/i.test(part)) || tag === 'style') return part;
      return plain(part);
    }
    if (part.charAt(0) === '<') return plain(part);
    return part.replace(MARK, (m, words, opts) => {
      const r = read(opts);
      if (r.font) used.add(r.font);
      return r.css ? `<span class="sg-w" style="${r.css}">${words}</span>` : words;
    });
  });
  if (!used.size) return out;
  const href = 'https://fonts.googleapis.com/css2?' + [...used].map(n => fonts.familyParam(n)).join('&') + '&display=swap';
  const link = `<link rel="stylesheet" href="${href}" data-sg-wordfonts>`;
  return out.includes('</head>') ? out.replace('</head>', link + '</head>') : link + out;
}

module.exports = { SIZES, SIZE_LABELS, MARK, read, plain, apply };
