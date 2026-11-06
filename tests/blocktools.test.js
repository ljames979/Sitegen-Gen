const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('blocks screen: Edit mode has the same page tools as the editor, saved through their own route', () => {
  const blocks = read('views/blocks.ejs'), editor = read('views/editor.ejs'), routes = read('routes/design-tools.js');
  for (const page of [blocks, editor]) {
    assert.match(page, /include\('_page-tools'\)/);
    assert.match(page, /include\('_page-tools-bar'/);
    assert.match(page, /include\('_page-tools-pick'\)/);
  }
  ['textsJson', 'tstylesJson', 'estylesJson', 'picsJson'].forEach(id => assert.match(blocks, new RegExp('id="' + id + '"')));
  assert.match(blocks, /post\('\/blocks\/tools'/);
  assert.match(routes, /app\.post\('\/sites\/:id\/blocks\/tools', requireAuth, loadOwnedSite/);
  // the tools in the bar: words, pictures, shapes, stamps, Style text, Move & size
  const bar = read('views/_page-tools-bar.ejs');
  ['addTextBtn', 'addPicBtn', 'addShapeBtn', 'addStampBtn', 'styleTextBtn', 'moveSizeBtn'].forEach(id => assert.match(bar, new RegExp('id="' + id + '"')));
  // the tools' own clicks go first on the Blocks preview
  assert.match(blocks, /H\.contains\('sg-ts-mode'\) \|\| H\.contains\('sg-es-mode'\)/);
});
