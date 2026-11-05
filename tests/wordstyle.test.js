const test = require('node:test');
const assert = require('node:assert');
const ws = require('../wordstyle');

test('word styling: markers become styled words in the text and plain words elsewhere', () => {
  const html = '<html><head><title>{{Big|huge}} Co</title><script type="application/ld+json">{"name":"{{Big|huge}} Co"}</script>' +
    '<script>var x = "{{keep|me}}";</script></head><body><img alt="{{Big|huge}} Co"><h1>The {{best pizza|bigger|Playfair Display|#E11D48|bold|italic}} in town</h1>' +
    '<p>{{brand words|brand}} and {{accent|accent|smaller}} and {{nothing|nonsense}}</p></body></html>';
  const out = ws.apply(html);
  assert.match(out, /<title>Big Co<\/title>/);
  assert.match(out, /"name":"Big Co"/);
  assert.match(out, /var x = "\{\{keep\|me\}\}"/, 'code is left alone');
  assert.match(out, /<img alt="Big Co">/);
  assert.match(out, /<h1>The <span class="sg-w" style="font-size:1\.6em;font-family:'Playfair Display',inherit;color:#e11d48;font-weight:700;font-style:italic">best pizza<\/span> in town<\/h1>/);
  assert.match(out, /<span class="sg-w" style="color:var\(--primary\)">brand words<\/span>/);
  assert.match(out, /<span class="sg-w" style="color:var\(--accent\);font-size:0\.8em">accent<\/span>/);
  assert.match(out, /and nothing<\/p>/, 'unknown options leave the words plain');
  assert.match(out, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display:wght@500;600;700&display=swap" data-sg-wordfonts><\/head>/);
  assert.equal(ws.apply('<p>no markers</p>'), '<p>no markers</p>');
  assert.equal(ws.plain('Say {{hi|big}} {{there|#000000}}'), 'Say hi there');
  assert.equal(ws.apply('<p>{{a|bad"><script>|big}}</p>'), '<p>{{a|bad"><script>|big}}</p>', 'markup inside a marker is not a marker');
});
