#!/usr/bin/env node
// Section library build: library/src/*.ejs (written with plain Tailwind classes, in the style of HyperUI)
// -> views/library/*.ejs (every class prefixed tw:, so it can never clash with the site's own CSS), then the
// compiled stylesheet public/sg-library.css. Run: npm run build:library
// The linter refuses stock palette colors: every color must be a theme token (primary, accent, ink, muted,
// page, surface, line, on-primary) so a section always looks like the site it is on.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SRC = path.join(root, 'library/src'), OUT = path.join(root, 'views/library');

const STOCK = /(?:^|[\s:\[])(?:[a-z-]+:)*(?:bg|text|border|border-[xytblrse]|ring|ring-offset|divide|from|via|to|fill|stroke|decoration|outline|accent|caret|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?(?=$|\s)/;

function prefix(html) {
  // prefix every class token inside class="..." that is plain markup (not inside <% %>)
  return html.replace(/\bclass="([^"]*)"/g, (m, list) => {
    const out = [];
    let rest = list;
    // keep EJS fragments untouched; prefix everything else
    const parts = rest.split(/(<%[\s\S]*?%>)/);
    const pre = tok => (tok.startsWith('tw:') || tok === 'sg-lib' || tok.startsWith('sg-') ? tok : 'tw:' + tok);
    // class names inside quoted strings of an EJS fragment (a ternary) are prefixed too, so Tailwind still finds them
    const done = parts.map(p => p.startsWith('<%') ? p.replace(/'([^']*)'/g, (mm, str) => "'" + str.replace(/\S+/g, pre) + "'") : p.replace(/\S+/g, pre));
    return 'class="' + done.join('') + '"';
  });
}

function lint(name, html) {
  const problems = [];
  const re = /\bclass="([^"]*)"/g; let m;
  while ((m = re.exec(html))) {
    for (const tok of m[1].replace(/<%[\s\S]*?%>/g, ' ').split(/\s+/).filter(Boolean)) {
      if (STOCK.test(' ' + tok)) problems.push(`${name}: stock color class "${tok}" (use primary, accent, ink, muted, page, surface, line or on-primary)`);
      if (/^(?:dark|ltr|rtl):/.test(tok)) problems.push(`${name}: "${tok}" (dark/ltr/rtl variants are not used; the theme handles dark mode)`);
    }
  }
  if (/<script[\s>]/i.test(html)) problems.push(`${name}: sections must not contain <script> (behavior lives in public/sg-library.js)`);
  if (!/Adapted from|Original/.test(html.slice(0, 300))) problems.push(`${name}: add a "<%# Adapted from HyperUI (MIT) ... %>" or "<%# Original ... %>" header comment`);
  return problems;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const problems = [];
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.ejs')).sort()) {
    const html = fs.readFileSync(path.join(SRC, f), 'utf8');
    problems.push(...lint(f, html));
    fs.writeFileSync(path.join(OUT, f), prefix(html));
  }
  return problems;
}

if (require.main === module) {
  const problems = build();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  require('./build-library-css.js');
}
module.exports = { build, lint, prefix, STOCK };
