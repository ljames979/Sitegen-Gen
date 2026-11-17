const test = require('node:test');
const assert = require('node:assert');
const pb = require('../photoblend');

test('photo that blends in: words, 1 to 4 photos, own color or matched, photo side and blend', () => {
  const body = 'top: Super | offer\nbadge: Use code: HAPPY50\nnote: Only today\nphotos: /uploads/a.jpg bad /uploads/b.jpg /uploads/c.jpg /uploads/d.jpg /uploads/e.jpg\ncolor: #ECECEC\nnoise: x';
  const p = pb.parse(body);
  assert.equal(p.top, 'Super offer'); assert.equal(p.badge, 'Use code: HAPPY50'); assert.equal(p.note, 'Only today');
  assert.deepEqual(p.photos, ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', '/uploads/d.jpg']);
  assert.equal(p.color, '#ececec');
  assert.equal(pb.cleanBody(body), 'top: Super offer\nbadge: Use code: HAPPY50\nnote: Only today\nphotos: /uploads/a.jpg /uploads/b.jpg /uploads/c.jpg /uploads/d.jpg\ncolor: #ececec');
  assert.equal(pb.parse('color: red').color, '');
  assert.equal(pb.cleanSide('left:fade'), 'left:fade'); assert.equal(pb.cleanSide('x:y'), 'right:both'); assert.equal(pb.cleanSide(''), 'right:both');
  const site = { theme: {}, sections: {} };
  const v = pb.view(site, { heading: 'Cyber [Monday]', body: 'photos: /uploads/a.jpg /uploads/b.jpg\ncolor: #ececec', side: 'left:match' }, []);
  assert.equal(v.turns, true); assert.equal(v.side, 'left'); assert.equal(v.blend, 'match'); assert.equal(v.ownColor, true);
  assert.match(v.style, /^--pb-bg: #ececec; --pb-ink: #/);
  assert.match(v.headingHtml, /<em class="sg-hl">Monday<\/em>/);
  const f = pb.view(site, { body: 'photos: /uploads/a.jpg\ncolor: #ececec', side: 'right:fade' }, []);
  assert.equal(f.match, false); assert.equal(f.style, '', 'fade only: the block keeps its own background');
  assert.equal(f.turns, false);
});

test('photo that blends in: pets cut out stand on the block color; only cut-outs made here are used', () => {
  const body = 'photos: /uploads/a.jpg https://images.pexels.com/p/1.jpeg?w=1 /uploads/b.jpg\ncutouts: /uploads/a.jpg|/uploads/cut-abc.webp /uploads/gone.jpg|/uploads/cut-q.webp /uploads/b.jpg|/evil.png https://images.pexels.com/p/1.jpeg?w=1|/uploads/cut-zz9.png';
  const p = pb.parse(body);
  assert.deepEqual(p.cutouts, { '/uploads/a.jpg': '/uploads/cut-abc.webp', '/uploads/gone.jpg': '/uploads/cut-q.webp', 'https://images.pexels.com/p/1.jpeg?w=1': '/uploads/cut-zz9.png' });
  assert.match(pb.cleanBody(body), /\ncutouts: \/uploads\/a\.jpg\|\/uploads\/cut-abc\.webp https:\/\/images\.pexels\.com\/p\/1\.jpeg\?w=1\|\/uploads\/cut-zz9\.png$/, 'only photos still listed');
  assert.equal(pb.cleanSide('left:cut'), 'left:cut');
  const site = { theme: { primaryColor: '#c2410c' }, sections: {} };
  const v = pb.view(site, { body, side: 'right:cut' }, []);
  assert.deepEqual(v.photos, ['/uploads/cut-abc.webp', '/uploads/cut-zz9.png', '/uploads/b.jpg']);
  assert.equal(v.cut, true); assert.equal(v.uncut, 1); assert.equal(v.match, false);
  assert.match(v.style, /^--pb-bg: #[0-9a-f]{6}; --pb-ink: #111111$/, 'a light shade of the brand color');
  assert.match(pb.view(site, { body: body + '\ncolor: #123456', side: 'right:cut' }, []).style, /^--pb-bg: #123456;/);
  assert.deepEqual(pb.view(site, { body, side: 'right:both' }, []).photos, ['/uploads/a.jpg', 'https://images.pexels.com/p/1.jpeg?w=1', '/uploads/b.jpg'], 'other blends keep the photos');
});

test('cutting out: only this app\'s uploads or stock photos, and a clear message when the tool is not installed', async () => {
  const cut = require('../cutout');
  assert.deepEqual(cut.HOSTS, ['images.pexels.com', 'images.unsplash.com', 'plus.unsplash.com', 'cdn.pixabay.com']);
  for (const bad of ['', 'http://images.pexels.com/x.jpg', 'https://evil.example/x.jpg', '/uploads/../server.js', '/etc/passwd', 'file:///etc/passwd']) {
    await assert.rejects(cut.cutout(bad), e => /Only your uploads|Not a photo|not in this app|Cutting out needs/.test(e.message), bad);
  }
});

test('photo that blends in: the circle behind cut-out pets is the owner\'s to change (colors, size, spot) or hide', () => {
  const site = { theme: { tokens: { colors: [{ key: 'glass-blue-light', hex: '#EAF5FC' }, { key: 'glass-blue', hex: '#D6EBF8' }] } }, sections: {} };
  const view = (body, side = 'right:cut') => pb.view(site, { body: 'photos: /uploads/a.png\n' + body, side }, []);
  assert.equal(view('').disc, '--d-in:#eaf5fc;--d-out:#d6ebf8;--d-size:56%;--d-x:50%;--d-y:46%', 'no line: the theme\'s glass blue circle, as it always looked');
  assert.equal(view('disc: #FFE4EF #c9e4f5 70 40 52').disc, '--d-in:#ffe4ef;--d-out:#c9e4f5;--d-size:70%;--d-x:40%;--d-y:52%');
  assert.equal(view('disc: off').disc, '', 'hidden');
  assert.equal(view('', 'right:both').disc, '', 'only behind cut-out pets');
  assert.equal(pb.view({ theme: {} }, { body: 'photos: /uploads/a.png', side: 'right:cut' }, []).disc, '', 'no theme circle: none unless the owner adds one');
  assert.equal(pb.view({ theme: {} }, { body: 'photos: /uploads/a.png\ndisc: #ffe4ef', side: 'right:cut' }, []).disc, '--d-in:#ffe4ef;--d-out:#ffe4ef;--d-size:56%;--d-x:50%;--d-y:46%');
  assert.deepEqual(pb.parseDisc('#aaaaaa #bbbbbb 999 -5 abc'), { in: '#aaaaaa', out: '#bbbbbb', size: 140, x: 0, y: 46 }, 'numbers kept in range');
  assert.equal(pb.parseDisc('red; background:url(x) 1 2 3'), null);
  assert.equal(pb.cleanBody('photos: /uploads/a.png\ndisc: #EAF5FC #c9e4f5 70 40 50'), 'photos: /uploads/a.png\ndisc: #eaf5fc #c9e4f5 70 40 50');
  assert.equal(pb.cleanBody('disc: OFF'), 'disc: off');
  assert.equal(pb.cleanBody('disc: nonsense'), '');
});
