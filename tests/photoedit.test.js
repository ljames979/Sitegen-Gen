// Photo editor, part 1: Smart Select (Leo, 2026-11-09)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('photo editor: the server opens a photo once, then outlines clicks, the subject, and serves its working copy', () => {
  const s = read('server.js');
  assert.match(s, /require\('\.\/photoedit'\)/);
  for (const r of ['status', 'prepare', 'image/:key', 'mask', 'subject']) assert.match(s, new RegExp("app\\.(get|post)\\('/sites/:id/photo-edit/" + r.replace('/', '\\/') + "', requireAuth, loadOwnedSite"));
  const pe = require('../photoedit');
  // the models come from the same GitHub releases as the cut-out model; nothing is sent to another service
  assert.equal(pe.BASE, 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/');
  assert.deepEqual(Object.values(pe.MODELS).map(m => m.file), ['vit_b-encoder-quant.onnx', 'vit_b-decoder-quant.onnx']);
  assert.ok(pe.keyOk('0123456789abcdef01234567'));
  for (const bad of ['', '../../etc/passwd', '0123456789abcdef0123456Z', '0123456789abcdef012345678']) assert.ok(!pe.keyOk(bad));
  assert.equal(pe.imagePath('../../server'), '');
});

test('photo editor: a photo that was never opened gives a plain message', async () => {
  const pe = require('../photoedit');
  if (!pe.ready()) return;   // sharp / onnxruntime-node not installed: the editor says what to install instead
  await assert.rejects(pe.mask('aaaaaaaaaaaaaaaaaaaaaaaa', [{ x: 1, y: 1 }]), /Open the photo in the editor again/);
  await assert.rejects(pe.mask('nope', [{ x: 1, y: 1 }]), /not open in the editor/);
});

test('photo editor: every picture box and the photo bar on the page open it', () => {
  const ed = read('views/editor.ejs');
  assert.match(ed, /<script src="\/photoedit\.js"><\/script>/);
  assert.match(ed, /pe\.className = 'btn-secondary pe-btn';\s*pe\.textContent = '🎨 Edit photo'/);
  assert.match(ed, /closest\('\.pe-btn'\)[\s\S]*window\.SGPhotoEdit\.open\(\{ siteId, src: v, onSave \}\)/);
  assert.match(ed, /data-ph="edit"[^']*>🎨 Edit photo<\/button>/);
});

test('photo editor page script: tools, keys, undo and the off-page helper', () => {
  const js = read('public/photoedit.js');
  for (const t of ['select', 'brush', 'lasso']) assert.match(js, new RegExp('data-tool="' + t + '"'));
  for (const a of ['subject', 'background', 'invert', 'all', 'clear', 'undo', 'redo']) assert.match(js, new RegExp('data-a="' + a + '"'));
  assert.match(js, /class="sgpe-soft" min="0" max="40"/);                       // edge softness
  assert.match(js, /e\.shiftKey \? 'add' : \(e\.altKey \? 'sub'/);               // Shift adds, Alt/Option takes away
  assert.match(js, /mod && k === 'z'\) \{ e\.preventDefault\(\); return stepTo\(hist\.at \+ \(e\.shiftKey \? 1 : -1\)\)/);
  assert.match(js, /new Worker\('\/photoedit-worker\.js'\)/);
  assert.match(js, /\.sgpe \[hidden\]\{display:none!important\}/);
  // it parses
  new vm.Script(js); new vm.Script(read('public/photoedit-worker.js'));
});

// the worker's mask work, run here with a stand-in for the page
function workerBox() {
  const sent = [];
  const box = { self: { postMessage: (m) => sent.push(m) }, Uint8Array, Int32Array, Math, String };
  vm.createContext(box);
  vm.runInContext(read('public/photoedit-worker.js'), box);
  const run = (q) => new Promise((res) => { const n = sent.length; box.self.onmessage({ data: { id: 1, w: 10, h: 10, t: 1, soft: 0, ...q } }); const t = setInterval(() => { if (sent.length > n) { clearInterval(t); res(sent[n]); } }, 1); });
  return run;
}
const square = (x0, y0, x1, y1) => { const m = new Uint8Array(100); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * 10 + x] = 255; return m; };

test('selection helper: add, take away, invert, outline and soft edge', async () => {
  const run = workerBox();
  let r = await run({ cmd: 'paint', op: 'add', part: square(2, 2, 5, 5).buffer, sel: null });
  assert.ok(r.ok); assert.equal(r.area, 0.16); assert.deepEqual({ ...r.box }, { x0: 2, y0: 2, x1: 5, y1: 5 });
  assert.equal(r.edges.length, 12);                                  // the ring round a 4 x 4 square
  r = await run({ cmd: 'paint', op: 'sub', part: square(4, 2, 5, 5).buffer, sel: r.sel });
  assert.equal(r.area, 0.08);
  r = await run({ cmd: 'invert', sel: r.sel });
  assert.equal(r.area, 0.92);
  const big = new Uint8Array(1600); for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) big[y * 40 + x] = 255;
  r = await run({ cmd: 'restyle', sel: big.buffer, soft: 6, w: 40, h: 40 });
  const shown = new Uint8Array(r.shown), at = (x, y) => shown[y * 40 + x];
  assert.equal(at(0, 0), 0); assert.equal(at(20, 20), 255);          // far outside and deep inside stay as they were
  assert.ok(at(10, 20) > 60 && at(10, 20) < 200, 'edge ' + at(10, 20)); // the edge itself is half way
  assert.equal(new Uint8Array(r.sel)[10 * 40 + 10], 255);              // the selection itself keeps its hard edge
  r = await run({ cmd: 'restyle', sel: null });
  assert.equal(r.sel, null);
});

test('photo editor: a real click outlines one thing (only where the selection model is downloaded)', async (t) => {
  const pe = require('../photoedit');
  const dir = process.env.SG_MODEL_DIR || path.join(root, 'models');
  if (!pe.ready() || !Object.values(pe.MODELS).every(m => fs.existsSync(path.join(dir, m.file)))) return t.skip('selection model not downloaded');
  const sharp = require('sharp');
  // a red circle on a blue square: a click on the circle selects the circle, not the square
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#2b5fd9"/><circle cx="200" cy="150" r="70" fill="#e63b2e"/></svg>';
  const name = 'pe-test-' + process.pid + '.png', file = path.join(root, 'public', 'uploads', name);
  fs.writeFileSync(file, await sharp(Buffer.from(svg)).png().toBuffer());
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'sgpe-'));
  try {
    process.env.SG_PHOTOEDIT_DIR = cache;
    delete require.cache[require.resolve('../photoedit')];
    const fresh = require('../photoedit');
    const p = await fresh.prepare('/uploads/' + name);
    assert.equal(p.w, 400); assert.equal(p.h, 300);
    const m = await fresh.mask(p.key, [{ x: 200, y: 150 }]);
    const area = Math.PI * 70 * 70 / (400 * 300);
    assert.ok(Math.abs(m.area - area) < 0.03, 'circle area ' + m.area + ' vs ' + area);
    const again = await fresh.prepare('/uploads/' + name);
    assert.equal(again.key, p.key); assert.equal(again.cached, true);
  } finally {
    fs.rmSync(file, { force: true }); fs.rmSync(cache, { recursive: true, force: true }); delete process.env.SG_PHOTOEDIT_DIR;
    delete require.cache[require.resolve('../photoedit')];
  }
});

// ---- part 2: Change color, saved as changes on the original ----
test('photo editor saves: the original, the changes and their masks stay with the site; the editor reopens them', () => {
  const s = read('server.js');
  for (const r of ['save', 'keep-mask']) assert.match(s, new RegExp("app\\.post\\('/sites/:id/photo-edit/" + r + "', requireAuth, loadOwnedSite"));
  assert.match(s, /app\.get\('\/sites\/:id\/photo-edit\/full\/:key', requireAuth, loadOwnedSite/);
  assert.match(s, /express\.raw\(\{ type: 'image\/png', limit: '6mb' \}\)/);
  // an editor save keeps them; prepare opens a finished photo as its original with its changes
  assert.match(s, /if \(\(req\.site\.sections \|\| \{\}\)\.photoEdits\) sections\.photoEdits = photoedit\.cleanEdits\(req\.site\.sections\.photoEdits\);/);
  assert.match(s, /const edit = photoedit\.editFor\(photoedit\.cleanEdits\(\(req\.site\.sections \|\| \{\}\)\.photoEdits\), url\);\s*res\.json\(\{ ok: true, \.\.\.\(await photoedit\.prepare\(edit \? edit\.src : url\)\), edit \}\)/);
  const pe = require('../photoedit');
  const e = pe.cleanEdit({ src: 'https://images.pexels.com/photos/1/a.jpeg', out: '/uploads/abc.webp', w: 900, h: 626, at: '2026-11-09T06:00:00Z',
    masks: { mk01: '/uploads/pe-x1.png', bad: 'javascript:alert(1)', mk02: 'https://evil.example/x.png' },
    layers: [
      { id: 'ly01', type: 'recolor', mask: 'mk01', color: '#FDEEF4', strength: 2, shading: -1, name: 'Towel <b>' },
      { id: 'ly02', type: 'recolor', mask: 'mk02', color: '#000000' },            // its mask was not kept: dropped
      { id: 'ly03', type: 'script', mask: 'mk01' },                               // not a kind of change
    ] });
  assert.deepEqual(e.masks, { mk01: '/uploads/pe-x1.png' });
  assert.deepEqual(e.layers, [{ id: 'ly01', type: 'recolor', name: 'Towel b', mask: 'mk01', hidden: false, opacity: 1, locked: false, color: '#fdeef4', strength: 1, shading: 0 }]);
  assert.equal(pe.cleanEdit({ src: 'x', out: 'https://evil.example/a.webp' }), null);   // the finished photo is always an upload
  const all = pe.cleanEdits({ abcd1234: e, 'NOT OK': e });
  assert.deepEqual(Object.keys(all), ['abcd1234']);
  assert.equal(pe.editFor(all, '/uploads/abc.webp').id, 'abcd1234');
  assert.equal(pe.editFor(all, '/uploads/other.webp'), null);
});

test('photo editor page: Change color with the shared color picker, eyedropper, site colors, compare and save', () => {
  const js = read('public/photoedit.js');
  assert.match(js, /data-a="recolor"[^>]*>🎨 Change color</);
  assert.match(js, /<input type="color" class="sgpe-rc-color"/);         // colorlabel.js adds the hex box and shades to it
  assert.match(js, /data-a="pick"[^>]*>💧 Pick from photo</);
  assert.match(js, /input\[name\^="theme_"\]\[name\$="Color"\]/);         // the site's own colors as swatches
  for (const a of ['rc-apply', 'rc-reset', 'compare', 'save']) assert.match(js, new RegExp('data-a="' + a + '"'));
  assert.match(js, /post\('keep-mask', await maskPng\(S\.masks\[mid\]\), 'image\/png'\)/);
  assert.match(js, /work\('full', \{ url: api\('full\/' \+ S\.key\), layers: S\.layers, type: 'image\/webp' \}\)/);
  assert.match(js, /hist\.list\.push\(\{ sel: S\.sel \? S\.sel\.slice\(\) : null, soft: S\.soft, layers: JSON\.stringify\(S\.layers\) \}\)/);
  const ed = read('views/editor.ejs');
  assert.match(ed, /window\.SGPhotoEdit\.open\(\{ siteId, src: v, onSave \}\)/);
  assert.match(ed, /window\.SGPhotoEdit\.open\(\{ siteId, src: v, onSave: \(u\) => setPhoto\(field, u\) \}\)/);
});

test('Change color keeps the shading: darker stays darker, the average takes the new color', async () => {
  const sent = [];
  const box = { self: { postMessage: (m) => sent.push(m) }, Uint8Array, Uint8ClampedArray, Int32Array, Math, String, Map, Number };
  vm.createContext(box); vm.runInContext(read('public/photoedit-worker.js'), box);
  const ask = (q) => new Promise((res) => { const n = sent.length; box.self.onmessage({ data: { id: 1, w: 4, h: 1, t: 1, soft: 0, ...q } }); const t = setInterval(() => { if (sent.length > n) { clearInterval(t); res(sent[n]); } }, 1); });
  // four teal pixels, dark to light, the last one not selected
  const px = new Uint8ClampedArray([10, 70, 70, 255, 20, 110, 110, 255, 40, 150, 150, 255, 40, 150, 150, 255]);
  await ask({ cmd: 'base', px: px.buffer });
  await ask({ cmd: 'mask', mid: 'm1', mask: new Uint8Array([255, 255, 255, 0]).buffer });
  const r = await ask({ cmd: 'render', layers: [{ id: 'l', type: 'recolor', mask: 'm1', color: '#fdeef4', strength: 1, shading: 1 }] });
  const o = new Uint8Array(r.px), lum = (i) => o[i * 4] + o[i * 4 + 1] + o[i * 4 + 2];
  assert.ok(lum(0) < lum(1) && lum(1) < lum(2), 'shading order kept');
  for (let i = 0; i < 3; i++) assert.ok(o[i * 4] > o[i * 4 + 1], 'pink: more red than green');
  assert.deepEqual([...o.slice(12, 16)], [40, 150, 150, 255]);          // outside the mask: untouched
  const hidden = await ask({ cmd: 'render', layers: [{ id: 'l', type: 'recolor', mask: 'm1', color: '#fdeef4', hidden: true }] });
  assert.deepEqual([...new Uint8Array(hidden.px)], [...px]);            // a hidden change shows the original
});

test('part 3: Adjust changes and the Changes list settings are kept, and the worker draws them', () => {
  const pe = require('../photoedit');
  const e = pe.cleanEdit({ src: '/uploads/a.png', out: '/uploads/b.webp', w: 2, h: 1, masks: { m1234: '/uploads/pe-1.png' },
    layers: [{ id: 'l1234', type: 'adjust', mask: 'm1234', bright: 250, contrast: -20, sat: 10, warm: 5, opacity: 0.5, locked: true, name: 'Lighter<b>' }] });
  assert.equal(e.layers.length, 1);
  assert.deepEqual([e.layers[0].bright, e.layers[0].contrast, e.layers[0].opacity, e.layers[0].locked, e.layers[0].name], [100, -20, 0.5, true, 'Lighterb']);
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const ctx = { self: {}, module: { exports: {} }, Math, Object, Uint8Array, Uint8ClampedArray, Map, Promise };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'photoedit-worker.js'), 'utf8'), ctx);
  const { render } = ctx.module.exports;
  const px = new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]);
  render(px, 2, 1, [{ type: 'adjust', mask: 'm', bright: 50 }], () => new Uint8Array([255, 0]));
  assert.ok(px[0] > 150 && px[4] === 100, 'only the masked pixel got lighter');
  const half = new Uint8ClampedArray([100, 100, 100, 255]);
  render(half, 1, 1, [{ type: 'adjust', mask: 'm', bright: 50, opacity: 0.5 }], () => new Uint8Array([255]));
  assert.ok(half[0] > 110 && half[0] < px[0], 'half strength is in between');
  const warm = new Uint8ClampedArray([120, 120, 120, 255]);
  render(warm, 1, 1, [{ type: 'adjust', mask: 'm', warm: 100 }], () => new Uint8Array([255]));
  assert.ok(warm[0] > warm[2]);
});
