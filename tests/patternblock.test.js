const test = require('node:test');
const assert = require('node:assert');
const pb = require('../patternblock');

test('gradient pattern: settings fall back to safe values', () => {
  assert.equal(pb.cleanSide(''), 'checks:card:zoom:1');
  assert.equal(pb.cleanSide('confetti:plain:drift:12'), 'confetti:plain:drift:12');
  assert.equal(pb.cleanSide('nope:x:y:13'), 'checks:card:zoom:1');
  assert.equal(pb.cleanSide('retro:dark:still:0'), 'retro:dark:still:1');
  assert.equal(pb.cleanBody('  a  b \r\n\n\n\nc<script>'), 'a b\n\nc<script>');   // escaped when drawn
  assert.ok(pb.cleanBody('x'.repeat(900)).length <= 600);
});

test('gradient pattern: every pattern and version draws only gradients, the same way each time', () => {
  const theme = { primaryColor: '#e11d48', accentColor: '#0ea5e9' };
  pb.PATTERNS.forEach(([p]) => {
    for (let v = 1; v <= pb.VERSIONS; v++) {
      ['', 'brand', 'rainbow', '#16a34a', '#16a34a,#f59e0b,#111111'].forEach(ink => {
        const a = pb.css(p, v, ink, theme), b = pb.css(p, v, ink, theme);
        assert.equal(a.css, b.css);
        assert.match(a.under, /^#[0-9a-f]{6}$/);
        // nothing but gradients, colors, numbers and units: no url(), quotes or semicolons that could break the style
        assert.match(a.css, /^((repeating-linear|linear|radial)-gradient\([0-9a-z.,%#()\s-]+\)(, )?)+$/, p + ' v' + v + ' ' + ink);
        if (a.size) { assert.equal(a.size.split(',').length, a.css.split('gradient(').length - 1); assert.match(a.size + a.pos, /^[0-9.% ,]+$/); }
        assert.doesNotMatch(a.css, /url|;|"|'|NaN|undefined/);
      });
    }
    // versions differ
    assert.notEqual(pb.css(p, 1, '', theme).css, pb.css(p, 2, '', theme).css);
  });
  // the colors follow the brand
  assert.match(pb.css('checks', 1, '', theme).css, /225, 29, 72|14, 165, 233/);
  assert.match(pb.css('confetti', 1, 'rainbow', theme).css, /#ff5e5e/);
});

test('gradient pattern: view has the words, the button only with a link, and plain words that read', () => {
  const site = { theme: { primaryColor: '#1e3a8a' } };
  const v = pb.view(site, { heading: 'Spring [sale]', body: 'One\n\nTwo', buttonText: 'Book', buttonUrl: '/contact', side: 'facets:plain:drift:3' });
  assert.equal(v.pattern, 'facets'); assert.equal(v.look, 'plain'); assert.equal(v.motion, 'drift'); assert.equal(v.version, 3);
  assert.deepEqual(v.paras, ['One', 'Two']);
  assert.deepEqual(v.button, { text: 'Book', url: '/contact' });
  assert.match(v.headingHtml, /sale/);
  assert.match(v.style, /--gp-ink: #(ffffff|111111)/);
  // arrows place their four corner pieces
  const ar = pb.view(site, { side: 'arrows:card:zoom:2' });
  assert.match(ar.bgPlace, /^; background-size: [0-9.% ,]+; background-position: [0-9% ,]+; background-repeat: no-repeat$/);
  assert.equal(pb.view(site, { side: 'boards:card:zoom:2' }).bgPlace, '');
  assert.equal(pb.PATTERNS.length, 7);
  const bare = pb.view(site, { side: 'confetti:card:zoom:4', buttonText: 'Book' });
  assert.equal(bare.words, false); assert.equal(bare.button, null); assert.equal(bare.style, '');
});
