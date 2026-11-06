const { test } = require('node:test');
const assert = require('node:assert/strict');
const tb = require('../textboxes');
const ws = require('../wordstyle');
const fs = require('fs');
const path = require('path');

const good = { id: 'tabc1234', page: 'home', at: 'b:bbigw001', x: 45.66, y: 120, w: 2, text: 'Grand <b>opening</b>\nthis May', size: 999, font: 'Pacifico', color: '#E11D48', bold: 1, italic: 0, align: 'center' };

test('your own text boxes: cleaned to safe numbers, a known font, a real color, and only well-formed boxes', () => {
  const [t] = tb.clean([good]);
  assert.deepEqual(t, { id: 'tabc1234', page: 'home', at: 'b:bbigw001', x: 45.7, y: 98, w: 4, text: 'Grand bopening/b\nthis May', size: 200, font: 'Pacifico', color: '#e11d48', bold: true, italic: false, align: 'center' });
  assert.equal(tb.clean([{ ...good, font: 'x;}body{' }])[0].font, '');
  assert.equal(tb.clean([{ ...good, color: 'red;background:url(x)' }])[0].color, '');
  assert.equal(tb.clean([{ ...good, align: 'justify' }])[0].align, 'left');
  for (const bad of [{ ...good, id: 'x' }, { ...good, text: '  ' }, { ...good, page: '../x"' }, { ...good, at: '"><script>' }, null, 'x']) assert.deepEqual(tb.clean([bad]), []);
  assert.equal(tb.clean([good, good]).length, 1);
  assert.equal(tb.clean(Array.from({ length: 50 }, (_, i) => ({ ...good, id: 't' + String(i).padStart(7, '0') }))).length, tb.MAX);
  assert.deepEqual(tb.fromBody('not json'), []); assert.equal(tb.fromBody(JSON.stringify([good])).length, 1);
});

test('your own text boxes: each page by its own name, the style the page writes, and one font link', () => {
  assert.equal(tb.pageId('home'), 'home'); assert.equal(tb.pageId('about'), 'about');
  assert.equal(tb.pageId('service', { service: { slug: 'roof-repair' } }), 'services/roof-repair'); assert.equal(tb.pageId('extra', { extra: { slug: 'story' } }), 'p/story');
  const [t] = tb.clean([good]);
  assert.equal(tb.style(t), "--x:45.7%;--y:98%;--w:4%;--fs:200;font-family:'Pacifico',var(--heading-font,inherit);color:#e11d48;font-weight:700;font-style:normal;text-align:center");
  assert.match(tb.style({ ...t, color: 'brand', font: '' }), /color:var\(--primary\)/);
  const site = { sections: { texts: { items: [good, { ...good, id: 'tother00', page: 'about', font: '' }] } } };
  assert.equal(tb.forPage(site, 'home').length, 1); assert.equal(tb.forPage(site, 'about')[0].id, 'tother00');
  assert.match(tb.fontLink(tb.forPage(site, 'home')), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Pacifico/); assert.equal(tb.fontLink(tb.forPage(site, 'about')), '');
});

test('word styling takes an exact size from 8px to 200px', () => {
  assert.equal(ws.read('|72px|bold').css, 'font-size:72px;font-weight:700');
  assert.equal(ws.read('|7px').css, ''); assert.equal(ws.read('|201px').css, '');
  assert.match(ws.apply('<p>Our {{approach|72px|#e11d48}}</p>'), /<span class="sg-w" style="font-size:72px;color:#e11d48">approach<\/span>/);
});

test('your own text boxes: the page script pins each box to its part, and the editor has the tool', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8');
  assert.match(js, /window\.sgText = \{ parts: parts, key: textKey, find: find, place: place \}/);
  const ed = ['editor', '_page-tools', '_page-tools-bar', '_page-tools-pick'].map(n => fs.readFileSync(path.join(__dirname, '../views/' + n + '.ejs'), 'utf8')).join('\n');   // the page tools live in shared partials
  assert.match(ed, /id="addTextBtn"/); assert.match(ed, /name="texts_json" id="textsJson"/); assert.match(ed, /data-ie="style"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8'), /\.sg-tx \{ position: absolute; left: var\(--x\); top: var\(--y\); width: var\(--w\)/);
});
