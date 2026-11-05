const test = require('node:test');
const assert = require('node:assert');
const tw = require('../twinphotos');

test('two photos and links: words, two photos, up to 6 links, two colors; bad parts dropped; site photos fill gaps', () => {
  const body = ['text: First words', 'text: Second | words', 'text: Third', 'text: Fourth is too many', 'photo: javascript:x', 'photo: /uploads/b.jpg', 'photo: /uploads/c.jpg',
    'link: Training tips | /services', 'link: Bad | javascript:alert(1)', 'link:  | /x', 'link: Call | tel:5551234', 'color: #F2B705', 'panel: grey', 'noise'].join('\n');
  const p = tw.parse(body);
  assert.deepEqual(p.text, ['First words', 'Second words', 'Third']);
  assert.deepEqual(p.photos, ['', '/uploads/b.jpg'], 'two photo spots; a bad one is kept empty so the second stays second');
  assert.deepEqual(p.links, [{ label: 'Training tips', url: '/services' }, { label: 'Bad', url: '' }, { label: 'Call', url: 'tel:5551234' }]);
  assert.equal(p.color, '#f2b705'); assert.equal(p.panel, '');
  assert.equal(tw.cleanBody('panel: #eeeeee\nlink: A | /a\nphoto: \nphoto: /uploads/x.jpg\ntext: Hi'), 'text: Hi\nphoto: \nphoto: /uploads/x.jpg\nlink: A | /a\npanel: #eeeeee');
  assert.equal(tw.cleanSide('left'), 'left'); assert.equal(tw.cleanSide('x'), 'right');
  const site = { theme: { primaryColor: '#f2c200' }, sections: { hero: { imageUrl: '/uploads/hero.jpg' }, about: { imageUrl: '/uploads/about.jpg' } } };
  const v = tw.view(site, { heading: 'A [true] friend', body: 'photo: \nphoto: /uploads/cut-dog.webp' }, []);
  assert.equal(v.photos[1].url, '/uploads/cut-dog.webp'); assert.equal(v.photos[1].cut, true);
  assert.ok(v.photos[0].url && v.photos[0].url !== v.photos[1].url, 'an empty spot borrows a site photo');
  assert.equal(v.color, '#f2c200'); assert.notEqual(v.headColor, '#f2c200', 'a pale color is darkened for the big words');
  assert.equal(v.colorOn, '#111111');
  assert.match(v.headingHtml, /<em class="sg-hl">true<\/em>/);
});
