const test = require('node:test');
const assert = require('node:assert');
const rc = require('../reviewcard');

test('reviews on a card: two colors and up to 3 reviews; bad parts dropped; falls back to the Reviews section, never made up', () => {
  const body = ['bg: #EEF2F7', 'card: red', 'review: /uploads/max.jpg | Max loves | it here | Sam, Max\'s owner', 'review: javascript:x | Great groomers | Ana',
    'review: /uploads/z.jpg |  | No words', 'review:  | Third | ', 'review:  | Fourth | Too many', 'noise'].join('\n');
  const p = rc.parse(body);
  assert.equal(p.bg, '#eef2f7'); assert.equal(p.card, '', 'a bad color is dropped');
  assert.equal(p.reviews.length, 3, 'up to 3, and a review needs words');
  assert.deepEqual(p.reviews[0], { photo: '/uploads/max.jpg', quote: 'Max loves', name: "it here Sam, Max's owner" });
  assert.deepEqual(p.reviews[1], { photo: '', quote: 'Great groomers', name: 'Ana' });
  assert.equal(rc.cleanBody('card: #112233\nbg: #ffffff\nreview: /uploads/a.jpg | Hi | Jo'), 'bg: #ffffff\ncard: #112233\nreview: /uploads/a.jpg | Hi | Jo');
  assert.equal(rc.cleanSide('right'), 'right'); assert.equal(rc.cleanSide('x'), 'left');
  const site = { theme: { primaryColor: '#d97706' }, sections: { about: { imageUrl: '/uploads/about.jpg' }, testimonials: { items: [{ quote: 'Lovely', author: 'Kim' }, { quote: 'Kind', author: '', photo: '/uploads/k.jpg' }] } } };
  const v = rc.view(site, { heading: 'What [pet parents] say', body: 'card: #1b2a4a\nreview:  | So good | bella' }, []);
  assert.equal(v.card, '#1b2a4a'); assert.equal(v.cardOn, '#ffffff', 'light words on a dark card');
  assert.equal(v.bg, ''); assert.equal(v.photo, '/uploads/about.jpg', 'no big photo: the About photo');
  assert.equal(v.reviews[0].initial, 'B'); assert.match(v.headingHtml, /<em class="sg-hl">pet parents<\/em>/);
  const fb = rc.view(site, { heading: 'Reviews' }, []);
  assert.deepEqual(fb.reviews.map(r => r.quote), ['Lovely', 'Kind'], 'no reviews typed: the Reviews section ones');
  assert.equal(fb.reviews[1].photo, '/uploads/k.jpg');
  assert.equal(rc.view({ sections: {} }, {}, []).reviews.length, 0, 'nothing typed anywhere: no reviews are invented');
});

test('reviews on a card: the big photo size and position, a cut-out shown whole unless set to fill', () => {
  assert.equal(rc.cleanSide('right:100:0:0:all'), 'right', 'the defaults stay the old value');
  assert.equal(rc.cleanSide('right:70:-10:5:fill'), 'right:70:-10:5:fill');
  assert.equal(rc.cleanSide('left:999:-99:x:zz'), 'left:150:-40:0:all', 'out of range is held in range');
  assert.deepEqual(rc.settings('bogus'), { side: 'left', size: 100, x: 0, y: 0, fit: 'all' });
  const cut = rc.view({ sections: {} }, { imageUrl: '/uploads/cut-cat.webp', side: 'right:80:5:-4:all' }, []);
  assert.equal(cut.cut, true); assert.equal(cut.fit, 'all'); assert.equal(cut.side, 'right');
  assert.equal(cut.photoStyle, ' --rc-scale: 0.8; --rc-x: 5%; --rc-y: -4%;');
  const plain = rc.view({ sections: {} }, { imageUrl: '/uploads/dog.jpg', side: 'left' }, []);
  assert.equal(plain.cut, false); assert.equal(plain.photoStyle, ''); assert.equal(plain.fit, 'fill');
  const css = require('fs').readFileSync(require('path').join(__dirname, '../public/sg-site.css'), 'utf8');
  assert.match(css, /\.sg-rc-cut\.sg-rc-fit-all \.sg-rc-img \{ object-fit: contain; \}/);
  assert.match(css, /scale\(var\(--rc-scale, 1\)\)/);
});
