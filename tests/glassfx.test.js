const { test } = require('node:test');
const assert = require('node:assert/strict');
const glass = require('../glassfx');
const mixpage = require('../mixpage');
const fs = require('fs');
const path = require('path');

test('glass panel: four kinds, off by default; unknown values are dropped', () => {
  assert.deepEqual(glass.IDS, ['', 'frost', 'clear', 'smoke', 'liquid']);
  assert.equal(glass.clean('liquid'), 'liquid'); assert.equal(glass.clean('lava'), '');
  assert.equal(glass.attrs('frost').cls, ' sg-glass sg-glass-frost'); assert.equal(glass.attrs('').cls, '');
  const src = fs.readFileSync(path.join(__dirname, '../mixpage.js'), 'utf8');
  assert.match(src, /if \(glassFx\.clean\(b\.glass\)\) c\.glass = b\.glass;/); assert.match(src, /if \(b\.glass\) items\[n\]\.glass = b\.glass;/);
  assert.equal(typeof mixpage.clean, 'function');
});

test('glass panel: stays readable with no blur or for visitors who ask for less see-through; liquid bends only where it can', () => {
  assert.match(glass.CSS, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
  assert.match(glass.CSS, /prefers-reduced-transparency: reduce[^\n]*backdrop-filter: none !important; background: rgba\(255,255,255,\.92\)/);
  assert.match(glass.CSS, /\.sg-lq-ok \.sg-glass-liquid :is\([^)]*\) \{ -webkit-backdrop-filter: url\(#sg-lq\)/);
  assert.doesNotThrow(() => new Function(glass.SCRIPT)); assert.match(glass.SCRIPT, /userAgentData/);
  const ejs = fs.readFileSync(path.join(__dirname, '../views/blocks.ejs'), 'utf8');
  assert.match(ejs, /data-a="glass"/); assert.match(ejs, /FX_KEYS = \['pin', 'film', 'imgfx', 'height', 'glass', 'xfx'\]/);
});

test('glass panel: only the Chromium rule uses the bending filter (other browsers keep a plain blur)', () => {
  const lines = glass.CSS.split('\n').filter(l => /backdrop-filter: url/.test(l));
  assert.equal(lines.length, 1); assert.match(lines[0], /^\.sg-lq-ok /);
});
