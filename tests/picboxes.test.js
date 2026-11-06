const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const pb = require('../picboxes');
const pets = require('../petart');

const good = { id: 'pabc1234', page: 'home', at: 'b:bbigw001', x: 5.55, y: 140, w: 0, h: 33.33, art: 'turns', photos: [], fit: 'fit' };

test('your own pictures: cleaned to safe numbers, a known drawing or real picture links, and only well-formed boxes', () => {
  assert.deepEqual(pb.clean([good])[0], { id: 'pabc1234', page: 'home', at: 'b:bbigw001', x: 5.6, y: 98, w: 3, h: 33.3, art: 'turns', photos: [], fit: 'fit', color: 'brand', turn: 0 });
  // own pictures: up to 4 safe links; nothing usable falls back to the pets
  const own = pb.clean([{ ...good, art: '', photos: ['/uploads/a.png', 'javascript:x', 'https://ex.com/b.jpg', '/uploads/c.png', '/uploads/d.png', '/uploads/e.png'] }])[0];
  assert.deepEqual(own.photos, ['/uploads/a.png', 'https://ex.com/b.jpg', '/uploads/c.png', '/uploads/d.png']); assert.equal(own.art, '');
  assert.equal(pb.clean([{ ...good, art: '', photos: ['javascript:x'] }])[0].art, 'turns');
  assert.equal(pb.clean([{ ...good, art: 'lions' }])[0].art, 'turns');
  assert.equal(pb.clean([{ ...good, fit: 'x;}' }])[0].fit, 'fit');
  for (const bad of [{ ...good, id: 'x' }, { ...good, page: '../x"' }, { ...good, at: '"><script>' }, null]) assert.deepEqual(pb.clean([bad]), []);
  assert.equal(pb.clean([good, good]).length, 1);
  assert.deepEqual(pb.fromBody('nope'), []);
});

test('your own pictures: the page draws the pets (cats and dogs take turns) or the owner\'s pictures', () => {
  const [p] = pb.clean([good]);
  const h = pb.html(p);
  assert.match(h, /^<div class="sg-pic sg-pic-fit" data-sg-pic="pabc1234" data-at="b:bbigw001" style="--x:5\.6%;--y:98%;--w:3%;--h:33\.3%" data-sg-tb-turns><div class="sg-pic-in sg-tb-pic"><svg class="sg-pets on"/);
  assert.equal((h.match(/<svg class="sg-pets/g) || []).length, 2);
  assert.match(h, /aria-label="A row of cats peeking up"[\s\S]*aria-label="A row of dogs peeking up"/);
  const one = pb.html(pb.clean([{ ...good, art: 'dogs', fit: 'stretch' }])[0]);
  assert.doesNotMatch(one, /data-sg-tb-turns/); assert.match(one, /preserveAspectRatio="none"/);
  const own = pb.html(pb.clean([{ ...good, art: '', photos: ['/uploads/a.png', '/uploads/b.png'] }])[0]);
  assert.match(own, /data-sg-tb-turns><div class="sg-pic-in sg-tb-pic"><img src="\/uploads\/a\.png" alt="" class="on" loading="lazy"><img src="\/uploads\/b\.png" alt="" loading="lazy"><\/div>/);
  for (const k of pets.KINDS) assert.match(pets.svg(k), /^<svg class="sg-pets" viewBox="0 0 990 130"/);
  assert.match(pets.svg('mix'), /A row of cats and dogs/);
});

test('paw prints: our own drawing in the logo color by default, an own color, solid or outline, turned', () => {
  const [p] = pb.clean([{ ...good, art: 'paw', turn: 400 }]);
  assert.equal(p.color, 'brand'); assert.equal(p.turn, 180);
  assert.match(pb.html(p), /style="--x:5\.6%;--y:98%;--w:3%;--h:33\.3%;--r:180deg;color:var\(--primary\)"><div class="sg-pic-in sg-tb-pic"><svg class="on sg-pets sg-paw" viewBox="0 0 100 100"[^>]*><g fill="currentColor">/);
  const line = pb.clean([{ ...good, art: 'pawline', color: '#E11D48' }])[0];
  assert.equal(line.color, '#e11d48'); assert.match(pb.html(line), /color:#e11d48"[\s\S]*<g fill="none" stroke="currentColor"/);
  assert.equal(pb.clean([{ ...good, art: 'paw', color: 'red;}' }])[0].color, 'brand');
  assert.equal(pb.clean([{ ...good, art: 'paw', color: 'accent' }])[0].color, 'accent');
  // the pets and own pictures carry no color
  assert.doesNotMatch(pb.html(pb.clean([good])[0]), /color:/);
});

test('cat paw prints: our own cat paw drawing, solid or outline, in the same colors as the dog paw', () => {
  const [c] = pb.clean([{ ...good, art: 'catpaw', color: 'accent' }]);
  assert.equal(c.art, 'catpaw'); assert.ok(pb.isPaw(c));
  const h = pb.html(c);
  assert.match(h, /color:var\(--accent\)"><div class="sg-pic-in sg-tb-pic"><svg class="on sg-pets sg-paw sg-paw-cat" viewBox="0 0 100 100"[^>]*aria-label="A cat paw print"><g fill="currentColor">/);
  assert.doesNotMatch(h, /<ellipse cx="38" cy="24"/, 'not the dog toes');
  const line = pb.html(pb.clean([{ ...good, art: 'catpawline', color: '#E11D48' }])[0]);
  assert.match(line, /sg-paw-cat[\s\S]*<g fill="none" stroke="currentColor"/);
  assert.doesNotMatch(pb.html(pb.clean([{ ...good, art: 'paw' }])[0]), /sg-paw-cat/, 'the dog paw stays as it was');
  assert.deepEqual(pb.PAW_ARTS, ['paw', 'pawline', 'catpaw', 'catpawline', 'cattrail', 'cattrailline', 'pawtrail', 'pawtrailline']);
  // a whole trail in one picture: twelve prints stepping left and right, cat or dog, solid or outline
  const tr = pb.html(pb.clean([{ ...good, art: 'cattrail', color: 'accent' }])[0]);
  assert.match(tr, /<svg class="on sg-pets sg-paw sg-paw-trail sg-paw-cat" viewBox="0 0 200 600"[^>]*aria-label="A trail of cat paw prints"><g fill="currentColor">/);
  assert.equal((tr.match(/<g transform="translate\(/g) || []).length, 12);
  assert.match(pb.html(pb.clean([{ ...good, art: 'pawtrailline' }])[0]), /sg-paw-trail"[^>]*aria-label="A trail of paw prints"><g fill="none" stroke="currentColor"/);
});

test('peeking pets: up to 9 own photos (or our drawn pets), most rise and duck at their own pace, every third poses', () => {
  const ph = Array.from({ length: 12 }, (_, i) => `/uploads/pet${i}.jpg`);
  const p = pb.clean([{ ...good, art: 'peek', photos: ph, fit: 'fill' }])[0];
  assert.equal(p.photos.length, pb.MAX_PEEK);
  const h = pb.html(p);
  assert.match(h, /<div class="sg-pic sg-pic-fill"[^>]*><div class="sg-pic-in sg-tb-pic"><div class="sg-peek on"><span class="sg-peek-pet" style="--t:7s;--d:0s;--ph:84%"><img src="\/uploads\/pet0\.jpg" alt="" loading="lazy"><\/span><span class="sg-peek-pet sg-peek-pose"/);
  assert.doesNotMatch(h, /data-sg-tb-turns/);
  assert.equal((h.match(/sg-peek-pet/g) || []).length, 9);
  const drawn = pb.html(pb.clean([{ ...good, art: 'peek' }])[0]);
  assert.match(drawn, /class="sg-peek on sg-peek-drawn"/); assert.equal((drawn.match(/<svg viewBox="0 0 110 130"/g) || []).length, 7);
  const css = fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8');
  assert.match(css, /@keyframes sg-peek-bob/); assert.match(css, /prefers-reduced-motion: reduce\) \{ \.sg-peek-pet, \.sg-peek-pet\.sg-peek-pose \{ animation: none; transform: none; \}/);
});

test('your own pictures: the page script pins them, the editor has the tool, the CSS sizes them', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '../public/sg-fx.js'), 'utf8'), /querySelectorAll\('\[data-sg-tx\], \[data-sg-pic\]'\), place\)/);
  const ed = ['editor', '_page-tools', '_page-tools-bar', '_page-tools-pick'].map(n => fs.readFileSync(path.join(__dirname, '../views/' + n + '.ejs'), 'utf8')).join('\n');   // the page tools live in shared partials
  assert.match(ed, /id="addPicBtn"/); assert.match(ed, /id="addPawBtn"/); assert.match(ed, /id="addCatPawBtn"[^>]*>\+ Cat paw<\/button>/); assert.match(ed, /id="addTrailBtn"[^>]*>\+ Paw trail<\/button>/); assert.match(ed, /cattrail: petArt\.trail\(false, 'fit', 'cat'\)/); assert.match(ed, /catpawline: petArt\.paw\(true, 'fit', 'cat'\)/); assert.match(ed, /data-a="smaller"[\s\S]*data-k="w"[\s\S]*data-k="h"/); assert.match(ed, /name="pics_json" id="picsJson"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8'), /\.sg-pic \{ position: absolute; left: var\(--x\); top: var\(--y\); width: var\(--w\); height: var\(--h\)/);
});
