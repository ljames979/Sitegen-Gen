// ✂ Cut out on every picture box, and cut-out photos placed anywhere (Leo, 2026-11-03)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const pb = require('../picboxes');
const photoBlend = require('../photoblend');

const ed = ['editor', '_page-tools', '_page-tools-bar', '_page-tools-pick'].map(n => fs.readFileSync(path.join(__dirname, '../views/' + n + '.ejs'), 'utf8')).join('\n');   // the page tools live in shared partials

test('cut out: every picture box in the panel gets the button, except the tab icon and the old-site screenshot', () => {
  assert.match(ed, /async function cutPhoto\(url\)[\s\S]*fetch\('\/sites\/' \+ siteId \+ '\/cutout'/);
  assert.match(ed, /CUT_SKIP = \/\^\(theme_faviconUrl\|pitch_oldShot\)\$\//);
  // rows on the page, rows in the templates (+ Add service ...) and rows added later
  assert.match(ed, /document\.querySelectorAll\('\.upload-row'\)\.forEach\(cutBtnFor\)/);
  assert.match(ed, /t\.content\.querySelectorAll\('\.upload-row'\)\.forEach\(cutBtnFor\)/);
  assert.match(ed, /new MutationObserver\(/);
  // the Photo that blends in block keeps its own "Cut out the pets"
  assert.match(ed, /url\.classList\.contains\('pb-url'\)\) return;/);
  // undo puts the original back; the photo bar on the page has it too
  assert.match(ed, /'↩ Undo cut' : '✂ Cut out'/);
  assert.match(ed, /data-ph="cut"[\s\S]*data-ph="uncut"|data-ph="uncut"[\s\S]*data-ph="cut"/);
});

test('cut-out photos: placed anywhere, sized and turned with a handle', () => {
  assert.match(ed, /id="addCutBtn"[^>]*>✂ Cut-out photo</);
  assert.match(ed, /if \(clipping\) \{[\s\S]*const place = async \(src\)[\s\S]*cutPhoto\(src\)[\s\S]*startBox\(dd, el\)[\s\S]*place\(up\.url\)/);
  assert.match(ed, /turn\.className = 'sg-pic-turn'/);
  assert.match(ed, /data-a="cut"[^>]*>✂ Cut out<\/button><button type="button" data-a="uncut"/);
  assert.match(ed, /aria-label="Turn the picture"/);
  // the photo comes from an upload or the free photo search (Pexels), here and in the picture bar
  assert.match(ed, /data-c="upload">Upload a photo<\/button><button type="button" data-c="find">Find a free photo \(Pexels\)/);
  assert.match(ed, /function pickPhotoFor\(cb, words\)/); assert.match(ed, /if \(pickerCb\) \{ const cb = pickerCb;/);
  assert.match(ed, /data-a="find"[^>]*>Free photo</);
  // a turned cut-out keeps its turn on the page
  const [p] = pb.clean([{ id: 'pabc1234', page: 'home', at: 'b:bbigw001', x: 10, y: 10, w: 30, h: 40, art: '', photos: ['/uploads/cut-mvyx9lh8fa6v8a.webp'], fit: 'fit', turn: -35 }]);
  assert.deepEqual(p.photos, ['/uploads/cut-mvyx9lh8fa6v8a.webp']); assert.equal(p.turn, -35);
  assert.match(pb.html(p), /style="--x:10%;--y:10%;--w:30%;--h:40%;--r:-35deg"><div class="sg-pic-in sg-tb-pic"><img src="\/uploads\/cut-mvyx9lh8fa6v8a\.webp"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/sg-site.css'), 'utf8'), /\.sg-pic \{[^}]*rotate: var\(--r, 0deg\)/);
});

test('cut-outs are ordinary photos to the blocks that show them', () => {
  // e.g. the Photo that blends in block's photo list keeps a cut-out like any upload
  assert.deepEqual(photoBlend.parse('photos: /uploads/cut-abc123.webp').photos, ['/uploads/cut-abc123.webp']);
});
